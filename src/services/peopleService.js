import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, transaction } from '../config/database.js';
import { sendWelcomeEmail } from './email.js';

// ============== PEOPLE / EMPLOYEES ==============

/**
 * Create a new user in the organization (admin-initiated).
 * Hashes password, inserts user + org member, auto-adds to org projects,
 * and sends a welcome email with credentials.
 */
export async function createPerson(orgId, {
  name, email, password, org_role = 'developer',
  designation, department_id, employee_code, phone,
  employment_type = 'full-time', employee_status = 'onboarding',
  reports_to, bio, date_of_joining,
}) {
  const hash = await bcrypt.hash(password, 12);
  const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const result = await transaction(async (client) => {
    // Insert user (email pre-verified since admin created the account)
    const { rows: userRows } = await client.query(
      `INSERT INTO users (name, email, password_hash, role, avatar,
         designation, department_id, employee_code, phone, employment_type,
         employee_status, reports_to, bio, date_of_joining, onboarding_completed,
         email_verified)
       VALUES ($1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14, FALSE,
         TRUE)
       RETURNING id, name, email, avatar, designation, department_id, employee_code,
         phone, employment_type, employee_status, reports_to, bio, date_of_joining`,
      [
        name, email, hash, org_role, avatar,
        designation || null, department_id || null, employee_code || null, phone || null,
        employment_type, employee_status,
        reports_to || null, bio || null, date_of_joining || null,
      ]
    );
    const user = userRows[0];

    // Add to organization
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [orgId, user.id, org_role]
    );

    // Auto-add to all organization projects as a member
    const { rows: orgProjects } = await client.query(
      `SELECT id FROM projects WHERE organization_id = $1`,
      [orgId]
    );

    for (const project of orgProjects) {
      await client.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [project.id, user.id, org_role === 'admin' ? 'admin' : 'developer']
      );
    }

    return user;
  });

  // Fetch org name for the welcome email
  const { rows: orgRows } = await query(
    `SELECT name FROM organizations WHERE id = $1`, [orgId]
  );
  const orgName = orgRows[0]?.name || 'Nexora';

  // Send welcome email with credentials (non-blocking)
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/login`;
  sendWelcomeEmail({
    to: email,
    name,
    orgName,
    role: org_role,
    password,  // plaintext password so user knows their credentials
    loginUrl,
  }).catch(err => {
    console.error('[People] Failed to send welcome email:', err.message);
  });

  // Return enriched data with org_role and department_name
  const enriched = await getPersonById(result.id, orgId);
  return enriched || result;
}

/**
 * Get all people in the organization with full profile data.
 */
export async function getPeople(orgId, { search, department_id, role, status } = {}) {
  let whereClause = 'om.organization_id = $1';
  const params = [orgId];
  let idx = 2;

  if (search) {
    whereClause += ` AND (u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.employee_code ILIKE $${idx} OR u.designation ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }
  if (department_id) {
    whereClause += ` AND u.department_id = $${idx}`;
    params.push(department_id);
    idx++;
  }
  if (role) {
    whereClause += ` AND om.role = $${idx}`;
    params.push(role);
    idx++;
  }
  if (status) {
    whereClause += ` AND u.employee_status = $${idx}`;
    params.push(status);
    idx++;
  }

  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.avatar, u.role, u.is_active, u.last_login_at,
       u.department_id, u.designation, u.employee_code, u.phone, u.date_of_joining,
       u.reports_to, u.employment_type, u.employee_status, u.address, u.bio,
       u.created_at,
       om.role AS org_role, om.joined_at,
       d.name AS department_name,
       u_mgr.name AS reports_to_name, u_mgr.avatar AS reports_to_avatar, u_mgr.id AS reports_to_id
     FROM users u
     JOIN organization_members om ON om.user_id = u.id
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN users u_mgr ON u_mgr.id = u.reports_to
     WHERE ${whereClause}
     ORDER BY u.name ASC`,
    params
  );
  return rows;
}

/**
 * Get a single person by ID with full profile.
 */
export async function getPersonById(userId, orgId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.avatar, u.role, u.is_active, u.last_login_at,
       u.department_id, u.designation, u.employee_code, u.phone, u.date_of_joining,
       u.reports_to, u.employment_type, u.employee_status, u.address, u.bio,
       u.onboarding_completed, u.created_at,
       om.role AS org_role, om.joined_at,
       d.name AS department_name,
       u_mgr.name AS reports_to_name, u_mgr.avatar AS reports_to_avatar
     FROM users u
     JOIN organization_members om ON om.user_id = u.id AND om.organization_id = $2
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN users u_mgr ON u_mgr.id = u.reports_to
     WHERE u.id = $1`,
    [userId, orgId]
  );
  return rows[0] || null;
}

/**
 * Update employee profile fields.
 */
export async function updatePerson(userId, fields) {
  const allowed = [
    'name', 'designation', 'employee_code', 'phone', 'date_of_joining',
    'reports_to', 'employment_type', 'employee_status', 'department_id',
    'address', 'bio', 'avatar',
  ];
  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      setClauses.push(`${key} = $${i}`);
      values.push(value === '' ? null : value);
      i++;
    }
  }

  if (setClauses.length === 0) return null;

  values.push(userId);
  const { rows } = await query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING
       id, name, email, avatar, designation, employee_code, phone, date_of_joining,
       reports_to, employment_type, employee_status, department_id, address, bio`,
    values
  );
  return rows[0] || null;
}

/**
 * Get the direct reports of a manager.
 */
export async function getDirectReports(managerId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.avatar, u.designation, u.employee_code,
       u.department_id, d.name AS department_name,
       om.role AS org_role
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN organization_members om ON om.user_id = u.id
     WHERE u.reports_to = $1
     ORDER BY u.name ASC`,
    [managerId]
  );
  return rows;
}

/**
 * Get reporting chain (upward) for a user.
 */
export async function getReportingChain(userId) {
  const { rows } = await query(
    `WITH RECURSIVE chain AS (
       SELECT u.id, u.name, u.email, u.avatar, u.designation, u.reports_to, 0 AS level
       FROM users u WHERE u.id = $1
       UNION ALL
       SELECT u.id, u.name, u.email, u.avatar, u.designation, u.reports_to, c.level + 1
       FROM users u JOIN chain c ON u.id = c.reports_to
       WHERE c.level < 10
     )
     SELECT * FROM chain ORDER BY level ASC`,
    [userId]
  );
  return rows;
}

/**
 * Get org-level stats.
 */
export async function getOrgStats(orgId) {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1) AS total_members,
       (SELECT COUNT(*) FROM departments WHERE organization_id = $1) AS total_departments,
       (SELECT COUNT(*) FROM teams WHERE organization_id = $1) AS total_teams,
       (SELECT COUNT(*) FROM projects WHERE organization_id = $1) AS total_projects,
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND role = 'admin') AS admin_count,
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND role = 'hr') AS hr_count,
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND role = 'manager') AS manager_count,
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND role = 'developer') AS developer_count,
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND role = 'designer') AS designer_count`,
    [orgId]
  );
  return rows[0];
}
