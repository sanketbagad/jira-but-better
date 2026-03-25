import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { cacheGetOrSet, cacheDel } from '../config/redis.js';
import { logActivity } from '../services/activity.js';
import { emitToProject } from '../config/socket.js';
import { enqueueJob } from '../config/qstash.js';
import { paginationParams, paginatedResponse } from '../utils/pagination.js';

const router = Router();

router.use(authenticate);

// GET /api/projects/:projectId/tasks
router.get('/:projectId/tasks', requireProjectMember, async (req, res, next) => {
  try {
    const { page, limit, offset } = paginationParams(req.query);
    const { status, priority, type, assignee_id, sprint_id, search } = req.query;

    const cacheKey = `tasks:${req.params.projectId}:${JSON.stringify(req.query)}`;

    const result = await cacheGetOrSet(cacheKey, async () => {
      const conditions = ['t.project_id = $1'];
      const params = [req.params.projectId];
      let idx = 2;

      if (status) {
        conditions.push(`t.status = $${idx}`);
        params.push(status);
        idx++;
      }
      if (priority) {
        conditions.push(`t.priority = $${idx}`);
        params.push(priority);
        idx++;
      }
      if (type) {
        conditions.push(`t.type = $${idx}`);
        params.push(type);
        idx++;
      }
      if (assignee_id) {
        conditions.push(`t.assignee_id = $${idx}`);
        params.push(assignee_id);
        idx++;
      }
      if (sprint_id) {
        conditions.push(`t.sprint_id = $${idx}`);
        params.push(sprint_id);
        idx++;
      }
      if (search) {
        conditions.push(`t.title ILIKE $${idx}`);
        params.push(`%${search}%`);
        idx++;
      }

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

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/tasks/:taskId
router.get('/:projectId/tasks/:taskId', requireProjectMember, async (req, res, next) => {
  try {
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
    `, [req.params.taskId, req.params.projectId]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Fetch attachments
    const { rows: attachments } = await query(
      'SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at DESC',
      [req.params.taskId]
    );

    res.json({ ...rows[0], attachments });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/tasks
router.post('/:projectId/tasks', requireProjectMember, validate(schemas.createTask), async (req, res, next) => {
  try {
    const { title, description, type, priority, status, assignee_id, sprint_id, due_date } = req.body;

    const { rows } = await query(`
      INSERT INTO tasks (project_id, title, description, type, priority, status, assignee_id, reporter_id, sprint_id, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      req.params.projectId, title, description, type, priority, status,
      assignee_id || null, req.user.id, sprint_id || null, due_date || null,
    ]);

    const task = rows[0];
    await cacheDel(`tasks:${req.params.projectId}:*`);

    // Broadcast realtime
    emitToProject(req.params.projectId, 'task:created', task);

    // Log activity
    await logActivity({
      projectId: req.params.projectId,
      userId: req.user.id,
      action: 'created',
      entityType: 'task',
      entityId: task.id,
      entityTitle: task.title,
    });

    // If assigned, send notification via background job
    if (assignee_id && assignee_id !== req.user.id) {
      await enqueueJob('task-assigned', {
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: assignee_id,
        assignerId: req.user.id,
        projectId: req.params.projectId,
      });
    }

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId/tasks/:taskId
router.patch('/:projectId/tasks/:taskId', requireProjectMember, validate(schemas.updateTask), async (req, res, next) => {
  try {
    const fields = req.body;

    // Get original for comparison
    const { rows: origRows } = await query(
      'SELECT * FROM tasks WHERE id = $1 AND project_id = $2',
      [req.params.taskId, req.params.projectId]
    );
    if (!origRows[0]) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const original = origRows[0];

    const setClauses = [];
    const values = [];
    let i = 1;

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${i}`);
      values.push(value === '' ? null : value);
      i++;
    }

    values.push(req.params.taskId, req.params.projectId);
    const { rows } = await query(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${i} AND project_id = $${i + 1} RETURNING *`,
      values
    );

    const task = rows[0];
    await cacheDel(`tasks:${req.params.projectId}:*`);

    // Broadcast realtime
    emitToProject(req.params.projectId, 'task:updated', task);

    // Log status change
    if (fields.status && fields.status !== original.status) {
      const action = fields.status === 'Done' ? 'completed' : 'moved';
      await logActivity({
        projectId: req.params.projectId,
        userId: req.user.id,
        action,
        entityType: 'task',
        entityId: task.id,
        entityTitle: task.title,
        metadata: { from: original.status, to: fields.status },
      });
    }

    // Notify new assignee
    if (fields.assignee_id && fields.assignee_id !== original.assignee_id && fields.assignee_id !== req.user.id) {
      await enqueueJob('task-assigned', {
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: fields.assignee_id,
        assignerId: req.user.id,
        projectId: req.params.projectId,
      });
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete('/:projectId/tasks/:taskId', requireProjectMember, async (req, res, next) => {
  try {
    const { rows } = await query(
      'DELETE FROM tasks WHERE id = $1 AND project_id = $2 RETURNING id, title',
      [req.params.taskId, req.params.projectId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await cacheDel(`tasks:${req.params.projectId}:*`);

    emitToProject(req.params.projectId, 'task:deleted', { id: rows[0].id });

    await logActivity({
      projectId: req.params.projectId,
      userId: req.user.id,
      action: 'deleted',
      entityType: 'task',
      entityId: rows[0].id,
      entityTitle: rows[0].title,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
