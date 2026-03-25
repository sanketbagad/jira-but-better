import { query } from '../config/database.js';
import { logActivity } from './activity.js';
import { emitToProject } from '../config/socket.js';

export async function getDocuments(projectId, { page, limit, offset, category, search }) {
  const conditions = ['d.project_id = $1'];
  const params = [projectId];
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

  for (const doc of rows) {
    const { rows: collabs } = await query(`
      SELECT u.id, u.name, u.avatar
      FROM document_collaborators dc
      JOIN users u ON u.id = dc.user_id
      WHERE dc.document_id = $1
    `, [doc.id]);
    doc.collaborators = collabs;
  }

  return { rows, total: parseInt(countRows[0].count) };
}

export async function getDocumentById(projectId, docId) {
  const { rows } = await query(`
    SELECT d.*,
      a.name AS author_name, a.avatar AS author_avatar,
      e.name AS last_edited_by_name
    FROM documents d
    JOIN users a ON a.id = d.author_id
    LEFT JOIN users e ON e.id = d.last_edited_by
    WHERE d.id = $1 AND d.project_id = $2
  `, [docId, projectId]);

  if (!rows[0]) return null;

  const { rows: collabs } = await query(`
    SELECT u.id, u.name, u.avatar
    FROM document_collaborators dc
    JOIN users u ON u.id = dc.user_id
    WHERE dc.document_id = $1
  `, [docId]);

  return { ...rows[0], collaborators: collabs };
}

export async function createDocument(projectId, userId, { title, category, content }) {
  const defaultContent = content || `<h1>${title}</h1><p>Start writing...</p>`;
  const wordCount = defaultContent.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;

  const { rows } = await query(`
    INSERT INTO documents (project_id, title, category, content, author_id, last_edited_by, word_count)
    VALUES ($1, $2, $3, $4, $5, $5, $6)
    RETURNING *
  `, [projectId, title, category, defaultContent, userId, wordCount]);

  const doc = rows[0];

  await query(
    'INSERT INTO document_collaborators (document_id, user_id) VALUES ($1, $2)',
    [doc.id, userId]
  );

  emitToProject(projectId, 'document:created', doc);

  await logActivity({
    projectId,
    userId,
    action: 'created',
    entityType: 'document',
    entityId: doc.id,
    entityTitle: doc.title,
  });

  return doc;
}

export async function updateDocument(projectId, docId, userId, fields) {
  fields.last_edited_by = userId;

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

  values.push(docId, projectId);
  const { rows } = await query(
    `UPDATE documents SET ${setClauses.join(', ')} WHERE id = $${i} AND project_id = $${i + 1} RETURNING *`,
    values
  );

  if (!rows[0]) return null;

  await query(`
    INSERT INTO document_collaborators (document_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `, [docId, userId]);

  emitToProject(projectId, 'document:updated', rows[0]);

  return rows[0];
}

export async function duplicateDocument(projectId, docId, userId) {
  const { rows: origRows } = await query(
    'SELECT * FROM documents WHERE id = $1 AND project_id = $2',
    [docId, projectId]
  );

  if (!origRows[0]) return null;

  const orig = origRows[0];
  const { rows } = await query(`
    INSERT INTO documents (project_id, title, category, content, author_id, last_edited_by, word_count)
    VALUES ($1, $2, $3, $4, $5, $5, $6)
    RETURNING *
  `, [projectId, `${orig.title} (Copy)`, orig.category, orig.content, userId, orig.word_count]);

  emitToProject(projectId, 'document:created', rows[0]);

  return rows[0];
}

export async function deleteDocument(projectId, docId, userId) {
  const { rows } = await query(
    'DELETE FROM documents WHERE id = $1 AND project_id = $2 RETURNING id, title',
    [docId, projectId]
  );

  if (!rows[0]) return null;

  emitToProject(projectId, 'document:deleted', { id: rows[0].id });

  await logActivity({
    projectId,
    userId,
    action: 'deleted',
    entityType: 'document',
    entityId: rows[0].id,
    entityTitle: rows[0].title,
  });

  return rows[0];
}
