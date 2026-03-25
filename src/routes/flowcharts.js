import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { logActivity } from '../services/activity.js';
import { emitToProject } from '../config/socket.js';

const router = Router();

router.use(authenticate);

// GET /api/projects/:projectId/flowcharts
router.get('/:projectId/flowcharts', requireProjectMember, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT f.*, u.name AS author_name, u.avatar AS author_avatar
      FROM flowcharts f
      JOIN users u ON u.id = f.author_id
      WHERE f.project_id = $1
      ORDER BY f.updated_at DESC
    `, [req.params.projectId]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/flowcharts/:flowchartId
router.get('/:projectId/flowcharts/:flowchartId', requireProjectMember, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT f.*, u.name AS author_name, u.avatar AS author_avatar
      FROM flowcharts f
      JOIN users u ON u.id = f.author_id
      WHERE f.id = $1 AND f.project_id = $2
    `, [req.params.flowchartId, req.params.projectId]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Flowchart not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/flowcharts
router.post('/:projectId/flowcharts', requireProjectMember, validate(schemas.createFlowchart), async (req, res, next) => {
  try {
    const { title, description, nodes, connections } = req.body;

    const { rows } = await query(`
      INSERT INTO flowcharts (project_id, title, description, author_id, nodes, connections)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      req.params.projectId, title, description, req.user.id,
      JSON.stringify(nodes), JSON.stringify(connections),
    ]);

    const flowchart = rows[0];

    emitToProject(req.params.projectId, 'flowchart:created', flowchart);

    await logActivity({
      projectId: req.params.projectId,
      userId: req.user.id,
      action: 'created',
      entityType: 'flowchart',
      entityId: flowchart.id,
      entityTitle: flowchart.title,
    });

    res.status(201).json(flowchart);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId/flowcharts/:flowchartId
router.patch('/:projectId/flowcharts/:flowchartId', requireProjectMember, validate(schemas.updateFlowchart), async (req, res, next) => {
  try {
    const fields = { ...req.body };

    // Serialize JSONB fields
    if (fields.nodes) fields.nodes = JSON.stringify(fields.nodes);
    if (fields.connections) fields.connections = JSON.stringify(fields.connections);

    const setClauses = [];
    const values = [];
    let i = 1;

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }

    values.push(req.params.flowchartId, req.params.projectId);
    const { rows } = await query(
      `UPDATE flowcharts SET ${setClauses.join(', ')} WHERE id = $${i} AND project_id = $${i + 1} RETURNING *`,
      values
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Flowchart not found' });
    }

    emitToProject(req.params.projectId, 'flowchart:updated', rows[0]);

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/flowcharts/:flowchartId
router.delete('/:projectId/flowcharts/:flowchartId', requireProjectMember, async (req, res, next) => {
  try {
    const { rows } = await query(
      'DELETE FROM flowcharts WHERE id = $1 AND project_id = $2 RETURNING id, title',
      [req.params.flowchartId, req.params.projectId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Flowchart not found' });
    }

    emitToProject(req.params.projectId, 'flowchart:deleted', { id: rows[0].id });

    await logActivity({
      projectId: req.params.projectId,
      userId: req.user.id,
      action: 'deleted',
      entityType: 'flowchart',
      entityId: rows[0].id,
      entityTitle: rows[0].title,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
