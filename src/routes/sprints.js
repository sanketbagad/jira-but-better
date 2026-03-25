import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate, requireProjectMember, requireProjectAdmin } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { emitToProject } from '../config/socket.js';

const router = Router();

router.use(authenticate);

// GET /api/projects/:projectId/sprints
router.get('/:projectId/sprints', requireProjectMember, async (req, res, next) => {
  try {
    const { rows: sprints } = await query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM tasks WHERE sprint_id = s.id) AS task_count,
        (SELECT COUNT(*) FROM tasks WHERE sprint_id = s.id AND status = 'Done') AS done_count
      FROM sprints s
      WHERE s.project_id = $1
      ORDER BY s.sort_order ASC, s.created_at ASC
    `, [req.params.projectId]);

    // Fetch tasks for each sprint
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

    // Also get unassigned tasks (no sprint)
    const { rows: backlogTasks } = await query(`
      SELECT t.*, u.name AS assignee_name, u.avatar AS assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id = $1 AND t.sprint_id IS NULL
      ORDER BY t.sort_order ASC, t.created_at DESC
    `, [req.params.projectId]);

    res.json({ sprints, unassigned_tasks: backlogTasks });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/sprints
router.post('/:projectId/sprints', requireProjectMember, validate(schemas.createSprint), async (req, res, next) => {
  try {
    const { name, status, start_date, end_date, goal } = req.body;

    // Get next sort order
    const { rows: maxRows } = await query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM sprints WHERE project_id = $1',
      [req.params.projectId]
    );

    const { rows } = await query(`
      INSERT INTO sprints (project_id, name, status, start_date, end_date, goal, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [req.params.projectId, name, status, start_date || null, end_date || null, goal, maxRows[0].next_order]);

    emitToProject(req.params.projectId, 'sprint:created', rows[0]);

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId/sprints/:sprintId
router.patch('/:projectId/sprints/:sprintId', requireProjectMember, validate(schemas.updateSprint), async (req, res, next) => {
  try {
    const fields = req.body;
    const setClauses = [];
    const values = [];
    let i = 1;

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }

    values.push(req.params.sprintId, req.params.projectId);
    const { rows } = await query(
      `UPDATE sprints SET ${setClauses.join(', ')} WHERE id = $${i} AND project_id = $${i + 1} RETURNING *`,
      values
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Sprint not found' });
    }

    emitToProject(req.params.projectId, 'sprint:updated', rows[0]);

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/sprints/:sprintId
router.delete('/:projectId/sprints/:sprintId', requireProjectMember, requireProjectAdmin, async (req, res, next) => {
  try {
    // Move tasks to unassigned before deleting sprint
    await query(
      'UPDATE tasks SET sprint_id = NULL WHERE sprint_id = $1',
      [req.params.sprintId]
    );

    const { rows } = await query(
      'DELETE FROM sprints WHERE id = $1 AND project_id = $2 RETURNING id, name',
      [req.params.sprintId, req.params.projectId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Sprint not found' });
    }

    emitToProject(req.params.projectId, 'sprint:deleted', { id: rows[0].id });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
