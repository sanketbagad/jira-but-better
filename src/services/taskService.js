import { query } from '../config/database.js';
import { cacheGetOrSet, cacheDel } from '../config/redis.js';
import { logActivity } from './activity.js';
import { emitToProject } from '../config/socket.js';
import { enqueueJob } from '../config/qstash.js';
import { paginatedResponse } from '../utils/pagination.js';

export async function getTasks(projectId, filters, { page, limit, offset }) {
  const cacheKey = `tasks:${projectId}:${JSON.stringify(filters)}:${page}:${limit}`;
  const { status, priority, type, assignee_id, sprint_id, search } = filters;

  return cacheGetOrSet(cacheKey, async () => {
    const conditions = ['t.project_id = $1'];
    const params = [projectId];
    let idx = 2;

    if (status) { conditions.push(`t.status = $${idx}`); params.push(status); idx++; }
    if (priority) { conditions.push(`t.priority = $${idx}`); params.push(priority); idx++; }
    if (type) { conditions.push(`t.type = $${idx}`); params.push(type); idx++; }
    if (assignee_id) { conditions.push(`t.assignee_id = $${idx}`); params.push(assignee_id); idx++; }
    if (sprint_id) { conditions.push(`t.sprint_id = $${idx}`); params.push(sprint_id); idx++; }
    if (search) { conditions.push(`t.title ILIKE $${idx}`); params.push(`%${search}%`); idx++; }

    const where = conditions.join(' AND ');

    params.push(limit, offset);
    const { rows } = await query(`
      SELECT t.*,
        u.name AS assignee_name, u.avatar AS assignee_avatar,
        r.name AS reporter_name, r.avatar AS reporter_avatar,
        s.name AS sprint_name,
        (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id) AS attachment_count
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN users r ON r.id = t.reporter_id
      LEFT JOIN sprints s ON s.id = t.sprint_id
      WHERE ${where}
      ORDER BY t.sort_order ASC, t.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, params);

    const countParams = params.slice(0, idx - 1);
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM tasks t WHERE ${where}`,
      countParams
    );

    return paginatedResponse(rows, parseInt(countRows[0].count), page, limit);
  }, 30);
}

export async function getTaskById(projectId, taskId) {
  const { rows } = await query(`
    SELECT t.*,
      u.name AS assignee_name, u.avatar AS assignee_avatar,
      r.name AS reporter_name, r.avatar AS reporter_avatar,
      s.name AS sprint_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users r ON r.id = t.reporter_id
    LEFT JOIN sprints s ON s.id = t.sprint_id
    WHERE t.id = $1 AND t.project_id = $2
  `, [taskId, projectId]);

  if (!rows[0]) return null;

  const { rows: attachments } = await query(
    'SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at DESC',
    [taskId]
  );

  return { ...rows[0], attachments };
}

export async function createTask(projectId, userId, { title, description, type, priority, status, assignee_id, sprint_id, due_date }) {
  const { rows } = await query(`
    INSERT INTO tasks (project_id, title, description, type, priority, status, assignee_id, reporter_id, sprint_id, due_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
    projectId, title, description, type, priority, status,
    assignee_id || null, userId, sprint_id || null, due_date || null,
  ]);

  const task = rows[0];
  await cacheDel(`tasks:${projectId}:*`);

  emitToProject(projectId, 'task:created', task);

  await logActivity({
    projectId,
    userId,
    action: 'created',
    entityType: 'task',
    entityId: task.id,
    entityTitle: task.title,
  });

  if (assignee_id && assignee_id !== userId) {
    await enqueueJob('task-assigned', {
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: assignee_id,
      assignerId: userId,
      projectId,
    });
  }

  return task;
}

export async function updateTask(projectId, taskId, userId, fields) {
  const { rows: origRows } = await query(
    'SELECT * FROM tasks WHERE id = $1 AND project_id = $2',
    [taskId, projectId]
  );
  if (!origRows[0]) return null;
  const original = origRows[0];

  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${i}`);
    values.push(value === '' ? null : value);
    i++;
  }

  values.push(taskId, projectId);
  const { rows } = await query(
    `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${i} AND project_id = $${i + 1} RETURNING *`,
    values
  );

  const task = rows[0];
  await cacheDel(`tasks:${projectId}:*`);

  emitToProject(projectId, 'task:updated', task);

  if (fields.status && fields.status !== original.status) {
    const action = fields.status === 'Done' ? 'completed' : 'moved';
    await logActivity({
      projectId,
      userId,
      action,
      entityType: 'task',
      entityId: task.id,
      entityTitle: task.title,
      metadata: { from: original.status, to: fields.status },
    });
  }

  if (fields.assignee_id && fields.assignee_id !== original.assignee_id && fields.assignee_id !== userId) {
    await enqueueJob('task-assigned', {
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: fields.assignee_id,
      assignerId: userId,
      projectId,
    });
  }

  return task;
}

export async function deleteTask(projectId, taskId, userId) {
  const { rows } = await query(
    'DELETE FROM tasks WHERE id = $1 AND project_id = $2 RETURNING id, title',
    [taskId, projectId]
  );

  if (!rows[0]) return null;

  await cacheDel(`tasks:${projectId}:*`);

  emitToProject(projectId, 'task:deleted', { id: rows[0].id });

  await logActivity({
    projectId,
    userId,
    action: 'deleted',
    entityType: 'task',
    entityId: rows[0].id,
    entityTitle: rows[0].title,
  });

  return rows[0];
}
