import { query } from '../config/database.js';
import { emitToProject } from '../config/socket.js';
import { logActivity } from './activity.js';

// ============== Comments ==============

export async function getComments(taskId) {
  const { rows } = await query(`
    SELECT c.*,
      u.name AS user_name,
      u.avatar AS user_avatar,
      u.email AS user_email
    FROM task_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.task_id = $1
    ORDER BY c.created_at ASC
  `, [taskId]);

  // Build threaded structure
  const commentsMap = {};
  const rootComments = [];

  for (const comment of rows) {
    comment.replies = [];
    commentsMap[comment.id] = comment;
  }

  for (const comment of rows) {
    if (comment.parent_id && commentsMap[comment.parent_id]) {
      commentsMap[comment.parent_id].replies.push(comment);
    } else {
      rootComments.push(comment);
    }
  }

  return rootComments;
}

export async function createComment(taskId, userId, { content, parent_id }) {
  const { rows } = await query(`
    INSERT INTO task_comments (task_id, user_id, content, parent_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [taskId, userId, content, parent_id || null]);

  const comment = rows[0];

  // Get user info
  const { rows: userRows } = await query(
    'SELECT name, avatar, email FROM users WHERE id = $1',
    [userId]
  );

  comment.user_name = userRows[0]?.name;
  comment.user_avatar = userRows[0]?.avatar;
  comment.user_email = userRows[0]?.email;
  comment.replies = [];

  // Get task for project info
  const { rows: taskRows } = await query(
    'SELECT project_id, title FROM tasks WHERE id = $1',
    [taskId]
  );

  if (taskRows[0]) {
    emitToProject(taskRows[0].project_id, 'task:comment:created', { taskId, comment });

    await logActivity({
      projectId: taskRows[0].project_id,
      userId,
      action: 'commented',
      entityType: 'task',
      entityId: taskId,
      entityTitle: taskRows[0].title,
    });
  }

  return comment;
}

export async function updateComment(commentId, userId, content) {
  const { rows } = await query(`
    UPDATE task_comments 
    SET content = $1, is_edited = TRUE, updated_at = NOW()
    WHERE id = $2 AND user_id = $3
    RETURNING *
  `, [content, commentId, userId]);

  if (!rows[0]) return null;

  const comment = rows[0];

  // Get user info
  const { rows: userRows } = await query(
    'SELECT name, avatar, email FROM users WHERE id = $1',
    [userId]
  );

  comment.user_name = userRows[0]?.name;
  comment.user_avatar = userRows[0]?.avatar;
  comment.user_email = userRows[0]?.email;

  // Get task for project info
  const { rows: taskRows } = await query(
    'SELECT project_id FROM tasks WHERE id = $1',
    [comment.task_id]
  );

  if (taskRows[0]) {
    emitToProject(taskRows[0].project_id, 'task:comment:updated', { taskId: comment.task_id, comment });
  }

  return comment;
}

export async function deleteComment(commentId, userId) {
  // First get comment info for the emit
  const { rows: commentRows } = await query(
    'SELECT c.*, t.project_id FROM task_comments c JOIN tasks t ON t.id = c.task_id WHERE c.id = $1',
    [commentId]
  );

  if (!commentRows[0]) return false;

  const { rows } = await query(
    'DELETE FROM task_comments WHERE id = $1 AND user_id = $2 RETURNING id',
    [commentId, userId]
  );

  if (rows[0]) {
    emitToProject(commentRows[0].project_id, 'task:comment:deleted', { 
      taskId: commentRows[0].task_id, 
      commentId 
    });
    return true;
  }

  return false;
}

// ============== Document Links ==============

export async function getLinkedDocuments(taskId) {
  const { rows } = await query(`
    SELECT tdl.*, d.title, d.content, d.created_at AS doc_created_at,
      u.name AS linked_by_name
    FROM task_document_links tdl
    JOIN documents d ON d.id = tdl.document_id
    JOIN users u ON u.id = tdl.linked_by
    WHERE tdl.task_id = $1
    ORDER BY tdl.created_at DESC
  `, [taskId]);

  return rows;
}

export async function linkDocument(taskId, documentId, userId) {
  const { rows } = await query(`
    INSERT INTO task_document_links (task_id, document_id, linked_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (task_id, document_id) DO NOTHING
    RETURNING *
  `, [taskId, documentId, userId]);

  if (!rows[0]) return null;

  // Get full info
  const { rows: docRows } = await query(`
    SELECT tdl.*, d.title, d.content,
      u.name AS linked_by_name
    FROM task_document_links tdl
    JOIN documents d ON d.id = tdl.document_id
    JOIN users u ON u.id = tdl.linked_by
    WHERE tdl.id = $1
  `, [rows[0].id]);

  // Get task for project info
  const { rows: taskRows } = await query(
    'SELECT project_id, title FROM tasks WHERE id = $1',
    [taskId]
  );

  if (taskRows[0]) {
    emitToProject(taskRows[0].project_id, 'task:document:linked', { taskId, document: docRows[0] });

    await logActivity({
      projectId: taskRows[0].project_id,
      userId,
      action: 'linked_document',
      entityType: 'task',
      entityId: taskId,
      entityTitle: taskRows[0].title,
    });
  }

  return docRows[0];
}

export async function unlinkDocument(taskId, documentId, userId) {
  // Get task for project info
  const { rows: taskRows } = await query(
    'SELECT project_id FROM tasks WHERE id = $1',
    [taskId]
  );

  const { rows } = await query(
    'DELETE FROM task_document_links WHERE task_id = $1 AND document_id = $2 RETURNING id',
    [taskId, documentId]
  );

  if (rows[0] && taskRows[0]) {
    emitToProject(taskRows[0].project_id, 'task:document:unlinked', { taskId, documentId });
    return true;
  }

  return false;
}

// ============== Task History ==============

export async function getTaskHistory(taskId) {
  const { rows } = await query(`
    SELECT h.*, u.name AS user_name, u.avatar AS user_avatar
    FROM task_history h
    JOIN users u ON u.id = h.user_id
    WHERE h.task_id = $1
    ORDER BY h.created_at DESC
    LIMIT 100
  `, [taskId]);

  return rows;
}

// ============== Task Watchers ==============

export async function getWatchers(taskId) {
  const { rows } = await query(`
    SELECT w.*, u.name, u.avatar, u.email
    FROM task_watchers w
    JOIN users u ON u.id = w.user_id
    WHERE w.task_id = $1
  `, [taskId]);

  return rows;
}

export async function addWatcher(taskId, userId) {
  await query(`
    INSERT INTO task_watchers (task_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (task_id, user_id) DO NOTHING
  `, [taskId, userId]);

  return true;
}

export async function removeWatcher(taskId, userId) {
  await query(
    'DELETE FROM task_watchers WHERE task_id = $1 AND user_id = $2',
    [taskId, userId]
  );

  return true;
}

export async function isWatching(taskId, userId) {
  const { rows } = await query(
    'SELECT 1 FROM task_watchers WHERE task_id = $1 AND user_id = $2',
    [taskId, userId]
  );

  return rows.length > 0;
}
