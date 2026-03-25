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
 * Require authentication. Populates req.user.
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
        'SELECT id, name, email, role, avatar, is_active FROM users WHERE id = $1',
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

/**
 * Check if user is a member of the project (from :projectId param).
 */
export async function requireProjectMember(req, res, next) {
  const projectId = req.params.projectId;
  if (!projectId) return next();

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
