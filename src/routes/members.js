import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate, requireProjectMember, requireProjectAdmin } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { cacheDel } from '../config/redis.js';
import { logActivity } from '../services/activity.js';
import { emitToProject } from '../config/socket.js';

const router = Router();

router.use(authenticate);

// GET /api/projects/:projectId/members
router.get('/:projectId/members', requireProjectMember, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT pm.id, pm.role, pm.status, pm.joined_at,
        u.id AS user_id, u.name, u.email, u.avatar,
        (SELECT COUNT(*) FROM tasks WHERE assignee_id = u.id AND project_id = $1) AS task_count
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY pm.joined_at ASC
    `, [req.params.projectId]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId/members/:memberId
router.patch('/:projectId/members/:memberId', requireProjectMember, requireProjectAdmin, validate(schemas.updateMember), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE project_members SET role = $1 WHERE id = $2 AND project_id = $3 RETURNING *`,
      [req.body.role, req.params.memberId, req.params.projectId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Member not found' });
    }

    emitToProject(req.params.projectId, 'member:updated', rows[0]);

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/members/:memberId
router.delete('/:projectId/members/:memberId', requireProjectMember, requireProjectAdmin, async (req, res, next) => {
  try {
    // Don't allow removing the owner
    const { rows: memberRows } = await query(
      `SELECT pm.user_id, p.owner_id
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
       WHERE pm.id = $1 AND pm.project_id = $2`,
      [req.params.memberId, req.params.projectId]
    );

    if (!memberRows[0]) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (memberRows[0].user_id === memberRows[0].owner_id) {
      return res.status(400).json({ error: 'Cannot remove the project owner' });
    }

    await query(
      'DELETE FROM project_members WHERE id = $1 AND project_id = $2',
      [req.params.memberId, req.params.projectId]
    );

    await cacheDel(`projects:${memberRows[0].user_id}:*`);
    emitToProject(req.params.projectId, 'member:removed', { id: req.params.memberId });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
