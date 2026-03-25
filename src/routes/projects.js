import { Router } from 'express';
import { query, transaction } from '../config/database.js';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { cacheGetOrSet, cacheDel } from '../config/redis.js';
import { logActivity } from '../services/activity.js';
import { emitToUser } from '../config/socket.js';
import { paginationParams, paginatedResponse } from '../utils/pagination.js';

const router = Router();

// All routes require auth
router.use(authenticate);

// GET /api/projects
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, offset } = paginationParams(req.query);
    const search = req.query.search || '';

    const cacheKey = `projects:${req.user.id}:${page}:${limit}:${search}`;

    const result = await cacheGetOrSet(cacheKey, async () => {
      const whereSearch = search
        ? `AND (p.name ILIKE $3 OR p.key ILIKE $3)`
        : '';
      const params = search
        ? [req.user.id, limit, `%${search}%`, offset]
        : [req.user.id, limit, offset];

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
      `, search ? [req.user.id, `%${search}%`] : [req.user.id]);

      return paginatedResponse(rows, parseInt(countRows[0].count), page, limit);
    }, 60);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId
router.get('/:projectId', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count
      FROM projects p
      WHERE p.id = $1
    `, [req.params.projectId]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects
router.post('/', validate(schemas.createProject), async (req, res, next) => {
  try {
    const { name, key, description, color } = req.body;

    const project = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO projects (name, key, description, color, owner_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, key, description, color, req.user.id]
      );

      // Auto-add creator as admin member
      await client.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, 'admin')`,
        [rows[0].id, req.user.id]
      );

      // Create default backlog sprint
      await client.query(
        `INSERT INTO sprints (project_id, name, status, sort_order)
         VALUES ($1, 'Backlog', 'backlog', 99)`,
        [rows[0].id]
      );

      return rows[0];
    });

    await cacheDel(`projects:${req.user.id}:*`);

    await logActivity({
      projectId: project.id,
      userId: req.user.id,
      action: 'created',
      entityType: 'project',
      entityId: project.id,
      entityTitle: project.name,
    });

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId
router.patch('/:projectId', requireProjectMember, validate(schemas.updateProject), async (req, res, next) => {
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

    values.push(req.params.projectId);
    const { rows } = await query(
      `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await cacheDel(`projects:${req.user.id}:*`);

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId
router.delete('/:projectId', requireProjectMember, async (req, res, next) => {
  try {
    // Only owner or project admin can delete
    const { rows: projectRows } = await query(
      'SELECT owner_id FROM projects WHERE id = $1',
      [req.params.projectId]
    );

    if (!projectRows[0]) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (projectRows[0].owner_id !== req.user.id && req.projectRole !== 'admin') {
      return res.status(403).json({ error: 'Only the project owner or admin can delete' });
    }

    await query('DELETE FROM projects WHERE id = $1', [req.params.projectId]);
    await cacheDel(`projects:${req.user.id}:*`);

    // Notify all project members
    const { rows: members } = await query(
      'SELECT user_id FROM project_members WHERE project_id = $1',
      [req.params.projectId]
    );
    members.forEach(m => {
      emitToUser(m.user_id, 'project:deleted', { projectId: req.params.projectId });
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
