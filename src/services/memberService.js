import { query } from '../config/database.js';
import { cacheDel } from '../config/redis.js';
import { emitToProject } from '../config/socket.js';

export async function getMembers(projectId) {
  const { rows } = await query(`
    SELECT pm.id, pm.role, pm.status, pm.joined_at,
      u.id AS user_id, u.name, u.email, u.avatar,
      COALESCE(tc.task_count, 0) AS task_count
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    LEFT JOIN (
      SELECT assignee_id, COUNT(*) AS task_count
      FROM tasks WHERE project_id = $1
      GROUP BY assignee_id
    ) tc ON tc.assignee_id = u.id
    WHERE pm.project_id = $1
    ORDER BY pm.joined_at ASC
  `, [projectId]);

  return rows;
}

export async function updateMemberRole(projectId, memberId, role) {
  const { rows } = await query(
    `UPDATE project_members SET role = $1 WHERE id = $2 AND project_id = $3 RETURNING *`,
    [role, memberId, projectId]
  );

  if (!rows[0]) return null;

  emitToProject(projectId, 'member:updated', rows[0]);

  return rows[0];
}

export async function removeMember(projectId, memberId) {
  const { rows: memberRows } = await query(
    `SELECT pm.user_id, p.owner_id
     FROM project_members pm
     JOIN projects p ON p.id = pm.project_id
     WHERE pm.id = $1 AND pm.project_id = $2`,
    [memberId, projectId]
  );

  if (!memberRows[0]) return { error: 'Member not found', status: 404 };

  if (memberRows[0].user_id === memberRows[0].owner_id) {
    return { error: 'Cannot remove the project owner', status: 400 };
  }

  await query(
    'DELETE FROM project_members WHERE id = $1 AND project_id = $2',
    [memberId, projectId]
  );

  await cacheDel(`projects:${memberRows[0].user_id}:*`);
  emitToProject(projectId, 'member:removed', { id: memberId });

  return { success: true };
}
