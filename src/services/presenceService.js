import { query } from '../config/database.js';
import { emitToProject, emitToUser } from '../config/socket.js';

/**
 * Update user presence status
 */
export async function updatePresence(userId, status, customStatus = null) {
  const result = await query(
    `INSERT INTO user_presence (user_id, status, custom_status, last_seen_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE
     SET status = $2, custom_status = $3, last_seen_at = NOW(), updated_at = NOW()
     RETURNING *`,
    [userId, status, customStatus]
  );
  
  // Get user's projects to broadcast presence
  const projects = await query(
    `SELECT DISTINCT project_id FROM project_members WHERE user_id = $1`,
    [userId]
  );
  
  const user = await query('SELECT name, avatar FROM users WHERE id = $1', [userId]);
  
  for (const p of projects.rows) {
    emitToProject(p.project_id, 'presence:updated', {
      userId,
      status,
      customStatus,
      userName: user.rows[0]?.name,
      avatar: user.rows[0]?.avatar,
    });
  }
  
  return result.rows[0];
}

/**
 * Get presence for multiple users
 */
export async function getPresence(userIds) {
  if (!userIds || userIds.length === 0) return [];
  
  const result = await query(
    `SELECT up.*, u.name, u.avatar
     FROM user_presence up
     JOIN users u ON u.id = up.user_id
     WHERE up.user_id = ANY($1)`,
    [userIds]
  );
  return result.rows;
}

/**
 * Get online users for a project
 */
export async function getProjectOnlineUsers(projectId) {
  const result = await query(
    `SELECT up.*, u.name, u.avatar, u.email, pm.role AS member_role
     FROM user_presence up
     JOIN users u ON u.id = up.user_id
     JOIN project_members pm ON pm.user_id = u.id AND pm.project_id = $1
     WHERE up.status != 'offline'
       AND up.last_seen_at > NOW() - INTERVAL '5 minutes'
     ORDER BY up.status = 'online' DESC, u.name ASC`,
    [projectId]
  );
  return result.rows;
}

/**
 * Set user offline (called on disconnect)
 */
export async function setOffline(userId) {
  return updatePresence(userId, 'offline');
}

/**
 * Check and update stale presence (users who haven't pinged recently)
 */
export async function cleanupStalePresence() {
  const result = await query(
    `UPDATE user_presence
     SET status = 'offline'
     WHERE status != 'offline'
       AND last_seen_at < NOW() - INTERVAL '5 minutes'
     RETURNING user_id`
  );
  
  // Broadcast offline status for affected users
  for (const row of result.rows) {
    const projects = await query(
      `SELECT DISTINCT project_id FROM project_members WHERE user_id = $1`,
      [row.user_id]
    );
    
    for (const p of projects.rows) {
      emitToProject(p.project_id, 'presence:updated', {
        userId: row.user_id,
        status: 'offline',
      });
    }
  }
  
  return result.rows.length;
}
