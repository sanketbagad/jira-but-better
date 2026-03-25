import { query } from '../config/database.js';
import { emitToProject } from '../config/socket.js';

export async function getSprints(projectId) {
  const { rows: sprints } = await query(`
    SELECT s.*,
      (SELECT COUNT(*) FROM tasks WHERE sprint_id = s.id) AS task_count,
      (SELECT COUNT(*) FROM tasks WHERE sprint_id = s.id AND status = 'Done') AS done_count
    FROM sprints s
    WHERE s.project_id = $1
    ORDER BY s.sort_order ASC, s.created_at ASC
  `, [projectId]);

  for (const sprint of sprints) {
    const { rows: tasks } = await query(`
      SELECT t.*, u.name AS assignee_name, u.avatar AS assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.sprint_id = $1
      ORDER BY t.sort_order ASC, t.created_at DESC
    `, [sprint.id]);
    sprint.tasks = tasks;
  }

  const { rows: backlogTasks } = await query(`
    SELECT t.*, u.name AS assignee_name, u.avatar AS assignee_avatar
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = $1 AND t.sprint_id IS NULL
    ORDER BY t.sort_order ASC, t.created_at DESC
  `, [projectId]);

  return { sprints, unassigned_tasks: backlogTasks };
}

export async function createSprint(projectId, { name, status, start_date, end_date, goal }) {
  const { rows: maxRows } = await query(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM sprints WHERE project_id = $1',
    [projectId]
  );

  const { rows } = await query(`
    INSERT INTO sprints (project_id, name, status, start_date, end_date, goal, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [projectId, name, status, start_date || null, end_date || null, goal, maxRows[0].next_order]);

  emitToProject(projectId, 'sprint:created', rows[0]);

  return rows[0];
}

export async function updateSprint(projectId, sprintId, fields) {
  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${i}`);
    values.push(value);
    i++;
  }

  values.push(sprintId, projectId);
  const { rows } = await query(
    `UPDATE sprints SET ${setClauses.join(', ')} WHERE id = $${i} AND project_id = $${i + 1} RETURNING *`,
    values
  );

  if (!rows[0]) return null;

  emitToProject(projectId, 'sprint:updated', rows[0]);

  return rows[0];
}

export async function deleteSprint(projectId, sprintId) {
  await query(
    'UPDATE tasks SET sprint_id = NULL WHERE sprint_id = $1',
    [sprintId]
  );

  const { rows } = await query(
    'DELETE FROM sprints WHERE id = $1 AND project_id = $2 RETURNING id, name',
    [sprintId, projectId]
  );

  if (!rows[0]) return null;

  emitToProject(projectId, 'sprint:deleted', { id: rows[0].id });

  return rows[0];
}
