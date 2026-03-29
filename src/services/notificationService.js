import { query } from '../config/database.js';
import { emitToUser } from '../config/socket.js';

/**
 * Create a notification and emit it in real-time
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  data = {},
  actionUrl = null,
}) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, title, message, data, action_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, type, title, message, JSON.stringify(data), actionUrl]
  );

  const notification = rows[0];

  // Emit real-time notification to user
  emitToUser(userId, 'notification:new', notification);

  return notification;
}

/**
 * Get all notifications for a user with pagination
 */
export async function getNotifications(userId, { page = 1, limit = 20, unreadOnly = false }) {
  const offset = (page - 1) * limit;
  const unreadClause = unreadOnly ? 'AND read = FALSE' : '';

  const { rows } = await query(
    `SELECT * FROM notifications
     WHERE user_id = $1 ${unreadClause}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const { rows: countRows } = await query(
    `SELECT COUNT(*) FROM notifications WHERE user_id = $1 ${unreadClause}`,
    [userId]
  );

  return {
    data: rows,
    total: parseInt(countRows[0].count),
    page,
    limit,
    totalPages: Math.ceil(parseInt(countRows[0].count) / limit),
  };
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId) {
  const { rows } = await query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE',
    [userId]
  );
  return parseInt(rows[0].count);
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId, userId) {
  const { rows } = await query(
    `UPDATE notifications SET read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );
  return rows[0] || null;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId) {
  await query(
    'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE',
    [userId]
  );
  return { success: true };
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId, userId) {
  await query(
    'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );
  return { success: true };
}

/**
 * Clear all notifications for a user
 */
export async function clearAllNotifications(userId) {
  await query('DELETE FROM notifications WHERE user_id = $1', [userId]);
  return { success: true };
}
