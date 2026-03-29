import { query, getClient } from '../config/database.js';
import { emitToProject, emitToUser } from '../config/socket.js';

/**
 * Get messages for a channel with pagination
 */
export async function getMessages(channelId, options = {}) {
  const { limit = 50, before, after } = options;
  
  let sql = `
    SELECT m.*,
           u.name AS sender_name,
           u.avatar AS sender_avatar,
           u.email AS sender_email,
           reply.content AS reply_content,
           reply_user.name AS reply_sender_name,
           (SELECT json_agg(json_build_object('emoji', mr.emoji, 'user_id', mr.user_id, 'user_name', ru.name))
            FROM message_reactions mr
            JOIN users ru ON ru.id = mr.user_id
            WHERE mr.message_id = m.id) AS reactions
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN messages reply ON reply.id = m.reply_to_id
    LEFT JOIN users reply_user ON reply_user.id = reply.sender_id
    WHERE m.channel_id = $1 AND m.is_deleted = false
  `;
  
  const params = [channelId];
  let paramIndex = 2;
  
  if (before) {
    sql += ` AND m.created_at < $${paramIndex}`;
    params.push(before);
    paramIndex++;
  }
  
  if (after) {
    sql += ` AND m.created_at > $${paramIndex}`;
    params.push(after);
    paramIndex++;
  }
  
  sql += ` ORDER BY m.created_at DESC LIMIT $${paramIndex}`;
  params.push(limit);
  
  const result = await query(sql, params);
  return result.rows.reverse(); // Return in chronological order
}

/**
 * Get message by ID
 */
export async function getMessageById(messageId) {
  const result = await query(
    `SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = $1`,
    [messageId]
  );
  return result.rows[0] || null;
}

/**
 * Send a new message
 */
export async function sendMessage(channelId, senderId, data, projectId) {
  const { content, type = 'text', reply_to_id, metadata = {} } = data;
  
  // Single query: INSERT message and JOIN sender + optional reply info
  const result = await query(
    `WITH inserted AS (
       INSERT INTO messages (channel_id, sender_id, content, type, reply_to_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *
     )
     SELECT i.*,
            u.name AS sender_name, u.avatar AS sender_avatar, u.email AS sender_email,
            reply.content AS reply_content,
            reply_user.name AS reply_sender_name
     FROM inserted i
     JOIN users u ON u.id = i.sender_id
     LEFT JOIN messages reply ON reply.id = i.reply_to_id
     LEFT JOIN users reply_user ON reply_user.id = reply.sender_id`,
    [channelId, senderId, content, type, reply_to_id, JSON.stringify(metadata)]
  );
  
  const message = result.rows[0];
  
  // projectId is already known from the route — no extra query needed
  if (projectId) {
    emitToProject(projectId, 'message:new', { ...message, channelId });
  }
  
  return message;
}

/**
 * Update a message
 */
export async function updateMessage(messageId, senderId, content, projectId) {
  const result = await query(
    `UPDATE messages
     SET content = $2, is_edited = true, updated_at = NOW()
     WHERE id = $1 AND sender_id = $3
     RETURNING *`,
    [messageId, content, senderId]
  );
  
  const message = result.rows[0];
  if (message && projectId) {
    emitToProject(projectId, 'message:updated', message);
  }
  
  return message || null;
}

/**
 * Delete a message (soft delete)
 */
export async function deleteMessage(messageId, senderId, projectId) {
  const result = await query(
    `UPDATE messages
     SET is_deleted = true, content = '[Message deleted]', updated_at = NOW()
     WHERE id = $1 AND sender_id = $2
     RETURNING *`,
    [messageId, senderId]
  );
  
  const message = result.rows[0];
  if (message && projectId) {
    emitToProject(projectId, 'message:deleted', { id: messageId, channelId: message.channel_id });
  }
  
  return message || null;
}

/**
 * Add reaction to message
 */
export async function addReaction(messageId, userId, emoji, projectId) {
  const result = await query(
    `WITH ins AS (
       INSERT INTO message_reactions (message_id, user_id, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING
       RETURNING *
     )
     SELECT ins.*, u.name AS user_name, m.channel_id
     FROM ins
     JOIN users u ON u.id = ins.user_id
     JOIN messages m ON m.id = ins.message_id`,
    [messageId, userId, emoji]
  );
  
  const row = result.rows[0];
  if (row && projectId) {
    emitToProject(projectId, 'message:reaction:added', {
      messageId,
      userId,
      userName: row.user_name,
      emoji,
      channelId: row.channel_id,
    });
  }
  
  return row || null;
}

/**
 * Remove reaction from message
 */
export async function removeReaction(messageId, userId, emoji, projectId) {
  // Delete and get the channel_id from the message in one round-trip
  const result = await query(
    `WITH del AS (
       DELETE FROM message_reactions
       WHERE message_id = $1 AND user_id = $2 AND emoji = $3
       RETURNING message_id
     )
     SELECT m.channel_id FROM del JOIN messages m ON m.id = del.message_id`,
    [messageId, userId, emoji]
  );
  
  const row = result.rows[0];
  if (row && projectId) {
    emitToProject(projectId, 'message:reaction:removed', {
      messageId,
      userId,
      emoji,
      channelId: row.channel_id,
    });
  }
  
  return { success: true };
}

/**
 * Search messages
 */
export async function searchMessages(projectId, searchQuery, options = {}) {
  const { channelId, limit = 50 } = options;
  
  let sql = `
    SELECT m.*, c.name AS channel_name, u.name AS sender_name, u.avatar AS sender_avatar
    FROM messages m
    JOIN channels c ON c.id = m.channel_id
    JOIN users u ON u.id = m.sender_id
    WHERE c.project_id = $1
      AND m.is_deleted = false
      AND m.content ILIKE $2
  `;
  
  const params = [projectId, `%${searchQuery}%`];
  let paramIndex = 3;
  
  if (channelId) {
    sql += ` AND m.channel_id = $${paramIndex}`;
    params.push(channelId);
    paramIndex++;
  }
  
  sql += ` ORDER BY m.created_at DESC LIMIT $${paramIndex}`;
  params.push(limit);
  
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Get unread message counts for all channels
 */
export async function getUnreadCounts(projectId, userId) {
  const result = await query(
    `SELECT c.id AS channel_id, COUNT(m.id) AS unread_count
     FROM channels c
     LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = $2
     LEFT JOIN messages m ON m.channel_id = c.id AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')
     WHERE c.project_id = $1
       AND (c.type = 'public' OR cm.user_id IS NOT NULL)
     GROUP BY c.id`,
    [projectId, userId]
  );
  
  return result.rows.reduce((acc, row) => {
    acc[row.channel_id] = parseInt(row.unread_count) || 0;
    return acc;
  }, {});
}
