import { query, transaction } from '../config/database.js';

// ============== DEPARTMENTS ==============

export async function getDepartments(orgId) {
  const { rows } = await query(
    `SELECT d.*,
       u_head.name AS head_name, u_head.avatar AS head_avatar, u_head.email AS head_email,
       pd.name AS parent_department_name,
       (SELECT COUNT(*) FROM users WHERE department_id = d.id) AS member_count
     FROM departments d
     LEFT JOIN users u_head ON u_head.id = d.head_id
     LEFT JOIN departments pd ON pd.id = d.parent_department_id
     WHERE d.organization_id = $1
     ORDER BY d.name ASC`,
    [orgId]
  );
  return rows;
}

export async function getDepartmentById(deptId) {
  const { rows } = await query(
    `SELECT d.*,
       u_head.name AS head_name, u_head.avatar AS head_avatar,
       pd.name AS parent_department_name,
       (SELECT COUNT(*) FROM users WHERE department_id = d.id) AS member_count
     FROM departments d
     LEFT JOIN users u_head ON u_head.id = d.head_id
     LEFT JOIN departments pd ON pd.id = d.parent_department_id
     WHERE d.id = $1`,
    [deptId]
  );
  return rows[0] || null;
}

export async function createDepartment(orgId, userId, { name, description, head_id, parent_department_id, color }) {
  const { rows } = await query(
    `INSERT INTO departments (organization_id, name, description, head_id, parent_department_id, color, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [orgId, name, description || '', head_id || null, parent_department_id || null, color || 0, userId]
  );
  return rows[0];
}

export async function updateDepartment(deptId, fields) {
  const allowed = ['name', 'description', 'head_id', 'parent_department_id', 'color'];
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

  values.push(deptId);
  const { rows } = await query(
    `UPDATE departments SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function deleteDepartment(deptId) {
  // Set users' department_id to null first
  await query('UPDATE users SET department_id = NULL WHERE department_id = $1', [deptId]);
  await query('DELETE FROM departments WHERE id = $1', [deptId]);
  return { success: true };
}

export async function getDepartmentMembers(deptId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.avatar, u.designation, u.employee_code,
       u.employment_type, u.employee_status, u.date_of_joining, u.phone,
       u_mgr.name AS reports_to_name, u_mgr.avatar AS reports_to_avatar,
       om.role AS org_role
     FROM users u
     LEFT JOIN users u_mgr ON u_mgr.id = u.reports_to
     LEFT JOIN organization_members om ON om.user_id = u.id
     WHERE u.department_id = $1
     ORDER BY u.name ASC`,
    [deptId]
  );
  return rows;
}
