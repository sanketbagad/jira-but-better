import { query } from '../config/database.js';
import { emitToProject } from '../config/socket.js';

export async function getSprints(projectId) {
  // Single query for sprints with task counts (replaces correlated subqueries)
  const { rows: sprints } = await query(`
    SELECT s.*,
      COUNT(t.id) AS task_count,
      COUNT(t.id) FILTER (WHERE t.status = 'Done') AS done_count
    FROM sprints s
    LEFT JOIN tasks t ON t.sprint_id = s.id
    WHERE s.project_id = $1
    GROUP BY s.id
    ORDER BY s.sort_order ASC, s.created_at ASC
  `, [projectId]);

  // Single query for ALL tasks across all sprints (eliminates N+1 loop)
  const sprintIds = sprints.map(s => s.id);
  let allTasks = [];
  if (sprintIds.length > 0) {
    const { rows } = await query(`
      SELECT t.*, u.name AS assignee_name, u.avatar AS assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.sprint_id = ANY($1::uuid[])
      ORDER BY t.sort_order ASC, t.created_at DESC
    `, [sprintIds]);
    allTasks = rows;
  }

  // Group tasks by sprint_id in application code
  const tasksBySprint = {};
  for (const task of allTasks) {
    if (!tasksBySprint[task.sprint_id]) tasksBySprint[task.sprint_id] = [];
    tasksBySprint[task.sprint_id].push(task);
  }
  for (const sprint of sprints) {
    sprint.tasks = tasksBySprint[sprint.id] || [];
  }

  // Backlog tasks (no sprint)
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
