import { query, transaction } from '../config/database.js';
import { cacheDel } from '../config/redis.js';

/**
 * Generate a URL-safe slug from a name.
 */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/**
 * Ensure slug is unique by appending a number if needed.
 */
async function uniqueSlug(name) {
  let slug = slugify(name);
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const { rows } = await query('SELECT 1 FROM organizations WHERE slug = $1', [candidate]);
    if (rows.length === 0) return candidate;
    suffix++;
  }
}

// ============== ORGANIZATIONS ==============

export async function createOrganization(userId, { name, domain, industry, size, website, address, logo_url }) {
  const slug = await uniqueSlug(name);

  const org = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO organizations (name, slug, domain, industry, size, website, address, logo_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, slug, domain || null, industry || null, size || null, website || null, address || null, logo_url || null, userId]
    );

    // Creator becomes the owner
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [rows[0].id, userId]
    );

    // Mark user as onboarding complete
    await client.query(
      `UPDATE users SET onboarding_completed = true WHERE id = $1`,
      [userId]
    );

    return rows[0];
  });

  return org;
}

export async function getOrganizationById(orgId) {
  const { rows } = await query(
    `SELECT o.*,
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) AS member_count,
       (SELECT COUNT(*) FROM teams WHERE organization_id = o.id) AS team_count,
       (SELECT COUNT(*) FROM projects WHERE organization_id = o.id) AS project_count
     FROM organizations o WHERE o.id = $1`,
    [orgId]
  );
  return rows[0] || null;
}

export async function getOrganizationBySlug(slug) {
  const { rows } = await query(
    'SELECT * FROM organizations WHERE slug = $1',
    [slug]
  );
  return rows[0] || null;
}

export async function getUserOrganizations(userId) {
  const { rows } = await query(
    `SELECT o.*, om.role AS member_role,
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) AS member_count,
       (SELECT COUNT(*) FROM projects WHERE organization_id = o.id) AS project_count
     FROM organizations o
     JOIN organization_members om ON om.organization_id = o.id AND om.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function updateOrganization(orgId, fields) {
  const allowed = ['name', 'domain', 'logo_url', 'description', 'industry', 'size', 'website', 'address', 'settings'];
  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      setClauses.push(`${key} = $${i}`);
      values.push(key === 'settings' ? JSON.stringify(value) : value);
      i++;
    }
  }

  if (setClauses.length === 0) return null;

  values.push(orgId);
  const { rows } = await query(
    `UPDATE organizations SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function deleteOrganization(orgId) {
  await query('DELETE FROM organizations WHERE id = $1', [orgId]);
  return { success: true };
}

// ============== ORGANIZATION MEMBERS ==============

export async function getOrgMembers(orgId, search) {
  const searchClause = search ? `AND (u.name ILIKE $2 OR u.email ILIKE $2)` : '';
  const params = search ? [orgId, `%${search}%`] : [orgId];

  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.avatar, u.is_active, u.last_login_at,
       u.designation, u.employee_code, u.department_id, u.employment_type, u.employee_status, u.phone,
       om.role, om.joined_at,
       d.name AS department_name
     FROM users u
     JOIN organization_members om ON om.user_id = u.id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE om.organization_id = $1 ${searchClause}
     ORDER BY om.role = 'owner' DESC, om.role = 'admin' DESC, om.role = 'hr' DESC, om.role = 'manager' DESC, u.name ASC`,
    params
  );
  return rows;
}

export async function addOrgMember(orgId, userId, role = 'member', invitedBy = null) {
  const { rows } = await query(
    `INSERT INTO organization_members (organization_id, user_id, role, invited_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = $3
     RETURNING *`,
    [orgId, userId, role, invitedBy]
  );

  // Mark user onboarding as done
  await query('UPDATE users SET onboarding_completed = true WHERE id = $1', [userId]);

  return rows[0];
}

export async function updateOrgMemberRole(orgId, userId, newRole) {
  const { rows } = await query(
    `UPDATE organization_members SET role = $3 WHERE organization_id = $1 AND user_id = $2 RETURNING *`,
    [orgId, userId, newRole]
  );
  return rows[0] || null;
}

export async function removeOrgMember(orgId, userId) {
  await query(
    'DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2',
    [orgId, userId]
  );
  return { success: true };
}

export async function getOrgMemberRole(orgId, userId) {
  const { rows } = await query(
    'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
    [orgId, userId]
  );
  return rows[0]?.role || null;
}

// ============== TEAMS ==============

export async function getTeams(orgId) {
  const { rows } = await query(
    `SELECT t.*,
       u.name AS lead_name, u.avatar AS lead_avatar,
       (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count
     FROM teams t
     LEFT JOIN users u ON u.id = t.lead_id
     WHERE t.organization_id = $1
     ORDER BY t.name ASC`,
    [orgId]
  );
  return rows;
}

export async function createTeam(orgId, userId, { name, description, color, lead_id }) {
  const { rows } = await query(
    `INSERT INTO teams (organization_id, name, description, color, lead_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [orgId, name, description || '', color || 0, lead_id || null, userId]
  );
  return rows[0];
}

export async function updateTeam(teamId, fields) {
  const allowed = ['name', 'description', 'color', 'lead_id'];
  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      setClauses.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
  }

  if (setClauses.length === 0) return null;

  values.push(teamId);
  const { rows } = await query(
    `UPDATE teams SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function deleteTeam(teamId) {
  await query('DELETE FROM teams WHERE id = $1', [teamId]);
  return { success: true };
}

export async function getTeamMembers(teamId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.avatar, tm.role, tm.joined_at
     FROM users u
     JOIN team_members tm ON tm.user_id = u.id
     WHERE tm.team_id = $1
     ORDER BY u.name ASC`,
    [teamId]
  );
  return rows;
}

export async function addTeamMember(teamId, userId, role = 'member') {
  const { rows } = await query(
    `INSERT INTO team_members (team_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (team_id, user_id) DO UPDATE SET role = $3
     RETURNING *`,
    [teamId, userId, role]
  );
  return rows[0];
}

export async function removeTeamMember(teamId, userId) {
  await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
  return { success: true };
}
