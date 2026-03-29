import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { cacheGet, cacheSet, cacheDel } from '../config/redis.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const USER_CACHE_TTL = 60; // 1 minute
const MEMBER_CACHE_TTL = 120; // 2 minutes

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Require authentication. Populates req.user with org info.
 */
export async function authenticate(req, res, next) {
  // Read token from cookie first, fall back to Authorization header
  const token = req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = verifyToken(token);

    // Try Redis cache first
    const cacheKey = `user:${decoded.id}`;
    let user = await cacheGet(cacheKey);
    if (user) {
      user = typeof user === 'string' ? JSON.parse(user) : user;
    } else {
      const { rows } = await query(
        `SELECT u.id, u.name, u.email, u.role, u.avatar, u.is_active, u.onboarding_completed,
          u.designation, u.employee_code, u.department_id, u.reports_to,
          u.employment_type, u.employee_status, u.phone, u.bio,
          om.organization_id, om.role AS org_role, o.name AS org_name, o.slug AS org_slug, o.domain AS org_domain,
          d.name AS department_name
         FROM users u
         LEFT JOIN organization_members om ON om.user_id = u.id
         LEFT JOIN organizations o ON o.id = om.organization_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.id = $1
         LIMIT 1`,
        [decoded.id]
      );
      user = rows[0];
    if (user) await cacheSet(cacheKey, user, USER_CACHE_TTL);
    }

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Require specific roles.
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if user is a member of the project (from :projectId param).
 */
export async function requireProjectMember(req, res, next) {
  const projectId = req.params.projectId;
  if (!projectId) return next();

  // Reject immediately if it's not a valid UUID (prevents pg crash)
  if (!UUID_RE.test(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  // Try Redis cache first
  const cacheKey = `pm:${projectId}:${req.user.id}`;
  let role = await cacheGet(cacheKey);
  if (role) {
    role = typeof role === 'string' ? role.replace(/"/g, '') : role;
  } else {
    const { rows } = await query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );
    if (!rows[0]) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }
    role = rows[0].role;
    await cacheSet(cacheKey, role, MEMBER_CACHE_TTL);
  }

  if (!role) {
    return res.status(403).json({ error: 'Not a member of this project' });
  }

  // Also fetch project data for use in controllers
  const { rows: projectRows } = await query(
    'SELECT * FROM projects WHERE id = $1',
    [projectId]
  );
  req.project = projectRows[0] || null;

  req.projectRole = role;
  next();
}

/**
 * Require project admin or owner role.
 */
export function requireProjectAdmin(req, res, next) {
  if (!['admin', 'lead'].includes(req.projectRole)) {
    return res.status(403).json({ error: 'Project admin access required' });
  }
  next();
}

/**
 * Invalidate cached user/member data.
 */
export async function clearUserCache(userId) {
  await cacheDel(`user:${userId}`);
}

export async function clearMemberCache(projectId, userId) {
  await cacheDel(`pm:${projectId}:${userId}`);
}

/**
 * Require that the user is a member of the org (from :orgId param).
 */
export async function requireOrgMember(req, res, next) {
  const orgId = req.params.orgId;
  if (!orgId) return next();

  const cacheKey = `om:${orgId}:${req.user.id}`;
  let role = await cacheGet(cacheKey);
  if (role) {
    role = typeof role === 'string' ? role.replace(/"/g, '') : role;
  } else {
    const { rows } = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [orgId, req.user.id]
    );
    if (!rows[0]) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }
    role = rows[0].role;
    await cacheSet(cacheKey, role, MEMBER_CACHE_TTL);
  }

  if (!role) {
    return res.status(403).json({ error: 'Not a member of this organization' });
  }

  req.orgRole = role;
  next();
}

/**
 * Require org admin/owner role. Must be used after requireOrgMember.
 */
export function requireOrgAdmin(req, res, next) {
  // If no orgId, try checking if they're org admin from their user record
  if (!req.orgRole) {
    // Try inline check
    const orgId = req.params.orgId;
    if (!orgId) return next();

    return (async () => {
      const { rows } = await query(
        'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [orgId, req.user.id]
      );
      if (!rows[0] || !['owner', 'admin'].includes(rows[0].role)) {
        return res.status(403).json({ error: 'Organization admin access required' });
      }
      req.orgRole = rows[0].role;
      next();
    })();
  }

  if (!['owner', 'admin'].includes(req.orgRole)) {
    return res.status(403).json({ error: 'Organization admin access required' });
  }
  next();
}

export async function clearOrgMemberCache(orgId, userId) {
  await cacheDel(`om:${orgId}:${userId}`);
}

/**
 * Require HR-level access (owner, admin, or hr role).
 */
export function requireHR(req, res, next) {
  const orgRole = req.user?.org_role || req.orgRole;
  if (!['owner', 'admin', 'hr'].includes(orgRole)) {
    return res.status(403).json({ error: 'HR access required' });
  }
  next();
}

/**
 * Require Manager-level access (owner, admin, hr, or manager role).
 */
export function requireManager(req, res, next) {
  const orgRole = req.user?.org_role || req.orgRole;
  if (!['owner', 'admin', 'hr', 'manager'].includes(orgRole)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
}
