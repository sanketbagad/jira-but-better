import { query, transaction } from '../config/database.js';
import { cacheGetOrSet, cacheDel } from '../config/redis.js';
import { logActivity } from './activity.js';
import { emitToUser } from '../config/socket.js';
import { paginatedResponse } from '../utils/pagination.js';

export async function getProjects(userId, { page, limit, offset, search }) {
  const cacheKey = `projects:${userId}:${page}:${limit}:${search}`;

  return cacheGetOrSet(cacheKey, async () => {
    const whereSearch = search
      ? `AND (p.name ILIKE $3 OR p.key ILIKE $3)`
      : '';
    const params = search
      ? [userId, limit, `%${search}%`, offset]
      : [userId, limit, offset];

    const offsetIdx = search ? '$4' : '$3';

    const { rows } = await query(`
      SELECT p.*, pm.role AS member_role,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      WHERE 1=1 ${whereSearch}
      ORDER BY p.starred DESC, p.created_at DESC
      LIMIT $2 OFFSET ${offsetIdx}
    `, params);

    const { rows: countRows } = await query(`
      SELECT COUNT(*) FROM projects p
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      WHERE 1=1 ${whereSearch}
    `, search ? [userId, `%${search}%`] : [userId]);

    return paginatedResponse(rows, parseInt(countRows[0].count), page, limit);
  }, 60);
}

export async function getProjectById(projectId) {
  const { rows } = await query(`
    SELECT p.*,
      (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count
    FROM projects p
    WHERE p.id = $1
  `, [projectId]);

  return rows[0] || null;
}

export async function createProject(userId, { name, key, description, color }) {
  const project = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO projects (name, key, description, color, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, key, description, color, userId]
    );

    await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [rows[0].id, userId]
    );

    await client.query(
      `INSERT INTO sprints (project_id, name, status, sort_order)
       VALUES ($1, 'Backlog', 'backlog', 99)`,
      [rows[0].id]
    );

    return rows[0];
  });

  await cacheDel(`projects:${userId}:*`);

  await logActivity({
    projectId: project.id,
    userId,
    action: 'created',
    entityType: 'project',
    entityId: project.id,
    entityTitle: project.name,
  });

  return project;
}

export async function updateProject(projectId, userId, fields) {
  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${i}`);
    values.push(value);
    i++;
  }

  values.push(projectId);
  const { rows } = await query(
    `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );

  if (!rows[0]) return null;

  await cacheDel(`projects:${userId}:*`);

  return rows[0];
}

export async function deleteProject(projectId, userId, projectRole) {
  const { rows: projectRows } = await query(
    'SELECT owner_id FROM projects WHERE id = $1',
    [projectId]
  );

  if (!projectRows[0]) return { error: 'Project not found', status: 404 };

  if (projectRows[0].owner_id !== userId && projectRole !== 'admin') {
    return { error: 'Only the project owner or admin can delete', status: 403 };
  }

  const { rows: members } = await query(
    'SELECT user_id FROM project_members WHERE project_id = $1',
    [projectId]
  );

  await query('DELETE FROM projects WHERE id = $1', [projectId]);
  await cacheDel(`projects:${userId}:*`);

  members.forEach(m => {
    emitToUser(m.user_id, 'project:deleted', { projectId });
  });

  return { success: true };
}
