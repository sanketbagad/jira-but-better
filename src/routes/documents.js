import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { cacheDel } from '../config/redis.js';
import { logActivity } from '../services/activity.js';
import { emitToProject } from '../config/socket.js';
import { paginationParams, paginatedResponse } from '../utils/pagination.js';

const router = Router();

router.use(authenticate);

// GET /api/projects/:projectId/documents
router.get('/:projectId/documents', requireProjectMember, async (req, res, next) => {
  try {
    const { page, limit, offset } = paginationParams(req.query);
    const { category, search } = req.query;

    const conditions = ['d.project_id = $1'];
    const params = [req.params.projectId];
    let idx = 2;

    if (category && category !== 'all') {
      conditions.push(`d.category = $${idx}`);
      params.push(category);
      idx++;
    }
    if (search) {
      conditions.push(`d.title ILIKE $${idx}`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');

    params.push(limit, offset);
    const { rows } = await query(`
      SELECT d.*,
        a.name AS author_name, a.avatar AS author_avatar,
        e.name AS last_edited_by_name, e.avatar AS last_edited_by_avatar
      FROM documents d
      JOIN users a ON a.id = d.author_id
      LEFT JOIN users e ON e.id = d.last_edited_by
      WHERE ${where}
      ORDER BY d.updated_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, params);

    const countParams = params.slice(0, idx - 1);
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM documents d WHERE ${where}`,
      countParams
    );

    // Fetch collaborators for each document
    for (const doc of rows) {
      const { rows: collabs } = await query(`
        SELECT u.id, u.name, u.avatar
        FROM document_collaborators dc
        JOIN users u ON u.id = dc.user_id
        WHERE dc.document_id = $1
      `, [doc.id]);
      doc.collaborators = collabs;
    }

    res.json(paginatedResponse(rows, parseInt(countRows[0].count), page, limit));
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/documents/:docId
router.get('/:projectId/documents/:docId', requireProjectMember, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT d.*,
        a.name AS author_name, a.avatar AS author_avatar,
        e.name AS last_edited_by_name
      FROM documents d
      JOIN users a ON a.id = d.author_id
      LEFT JOIN users e ON e.id = d.last_edited_by
      WHERE d.id = $1 AND d.project_id = $2
    `, [req.params.docId, req.params.projectId]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { rows: collabs } = await query(`
      SELECT u.id, u.name, u.avatar
      FROM document_collaborators dc
      JOIN users u ON u.id = dc.user_id
      WHERE dc.document_id = $1
    `, [req.params.docId]);

    res.json({ ...rows[0], collaborators: collabs });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/documents
router.post('/:projectId/documents', requireProjectMember, validate(schemas.createDocument), async (req, res, next) => {
  try {
    const { title, category, content } = req.body;
    const defaultContent = content || `<h1>${title}</h1><p>Start writing...</p>`;
    const wordCount = defaultContent.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;

    const { rows } = await query(`
      INSERT INTO documents (project_id, title, category, content, author_id, last_edited_by, word_count)
      VALUES ($1, $2, $3, $4, $5, $5, $6)
      RETURNING *
    `, [req.params.projectId, title, category, defaultContent, req.user.id, wordCount]);

    const doc = rows[0];

    // Add creator as collaborator
    await query(
      'INSERT INTO document_collaborators (document_id, user_id) VALUES ($1, $2)',
      [doc.id, req.user.id]
    );

    emitToProject(req.params.projectId, 'document:created', doc);

    await logActivity({
      projectId: req.params.projectId,
      userId: req.user.id,
      action: 'created',
      entityType: 'document',
      entityId: doc.id,
      entityTitle: doc.title,
    });

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId/documents/:docId
router.patch('/:projectId/documents/:docId', requireProjectMember, validate(schemas.updateDocument), async (req, res, next) => {
  try {
    const fields = { ...req.body };
    fields.last_edited_by = req.user.id;

    if (fields.content) {
      fields.word_count = fields.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
    }

    const setClauses = [];
    const values = [];
    let i = 1;

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }

    values.push(req.params.docId, req.params.projectId);
    const { rows } = await query(
      `UPDATE documents SET ${setClauses.join(', ')} WHERE id = $${i} AND project_id = $${i + 1} RETURNING *`,
      values
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Add as collaborator if not already
    await query(`
      INSERT INTO document_collaborators (document_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [req.params.docId, req.user.id]);

    emitToProject(req.params.projectId, 'document:updated', rows[0]);

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/documents/:docId/duplicate
router.post('/:projectId/documents/:docId/duplicate', requireProjectMember, async (req, res, next) => {
  try {
    const { rows: origRows } = await query(
      'SELECT * FROM documents WHERE id = $1 AND project_id = $2',
      [req.params.docId, req.params.projectId]
    );

    if (!origRows[0]) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const orig = origRows[0];
    const { rows } = await query(`
      INSERT INTO documents (project_id, title, category, content, author_id, last_edited_by, word_count)
      VALUES ($1, $2, $3, $4, $5, $5, $6)
      RETURNING *
    `, [req.params.projectId, `${orig.title} (Copy)`, orig.category, orig.content, req.user.id, orig.word_count]);

    emitToProject(req.params.projectId, 'document:created', rows[0]);

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/documents/:docId
router.delete('/:projectId/documents/:docId', requireProjectMember, async (req, res, next) => {
  try {
    const { rows } = await query(
      'DELETE FROM documents WHERE id = $1 AND project_id = $2 RETURNING id, title',
      [req.params.docId, req.params.projectId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Document not found' });
    }

    emitToProject(req.params.projectId, 'document:deleted', { id: rows[0].id });

    await logActivity({
      projectId: req.params.projectId,
      userId: req.user.id,
      action: 'deleted',
      entityType: 'document',
      entityId: rows[0].id,
      entityTitle: rows[0].title,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
