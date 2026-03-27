import { query, getClient } from '../config/database.js';
import { emitToProject, emitToUser } from '../config/socket.js';

/**
 * Get all channels for a project
 */
export async function getChannels(projectId, userId, options = {}) {
  const { type, includeArchived = false } = options;
  
  let sql = `
    SELECT c.*,
           u.name AS creator_name,
           u.avatar AS creator_avatar,
           cm.last_read_at,
           cm.is_muted,
           (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')) AS unread_count,
           (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) AS member_count
    FROM channels c
    JOIN users u ON u.id = c.created_by
    LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = $2
    WHERE c.project_id = $1
  `;
  
  const params = [projectId, userId];
  let paramIndex = 3;
  
  if (!includeArchived) {
    sql += ` AND c.is_archived = false`;
  }
  
  if (type) {
    sql += ` AND c.type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }
  
  // Only show channels user has access to
  sql += `
    AND (
      c.type = 'public'
      OR EXISTS (SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $2)
    )
  `;
  
  sql += ` ORDER BY c.type = 'direct' DESC, c.name ASC`;
  
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Get channel by ID
 */
export async function getChannelById(channelId, userId) {
  const result = await query(
    `SELECT c.*,
            u.name AS creator_name,
            cm.last_read_at,
            cm.is_muted,
            (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) AS member_count
     FROM channels c
     JOIN users u ON u.id = c.created_by
     LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = $2
     WHERE c.id = $1`,
    [channelId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Create a new channel
 */
export async function createChannel(projectId, userId, data) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { name, description, type = 'public', memberIds = [] } = data;
    
    const result = await client.query(
      `INSERT INTO channels (project_id, name, description, type, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, name, description, type, userId]
    );
    
    const channel = result.rows[0];
    
    // Add creator as admin member
    await client.query(
      `INSERT INTO channel_members (channel_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [channel.id, userId]
    );
    
    // Add additional members for private channels or direct messages
    if ((type === 'private' || type === 'direct') && memberIds.length > 0) {
      for (const memberId of memberIds) {
        if (memberId !== userId) {
          await client.query(
            `INSERT INTO channel_members (channel_id, user_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (channel_id, user_id) DO NOTHING`,
            [channel.id, memberId]
          );
        }
      }
    }
    
    await client.query('COMMIT');
    
    // Emit realtime event
    emitToProject(projectId, 'channel:created', channel);
    
    return channel;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get or create a direct message channel between two users
 */
export async function getOrCreateDirectChannel(projectId, userId, otherUserId) {
  // Check if direct channel already exists
  const existing = await query(
    `SELECT c.* FROM channels c
     WHERE c.project_id = $1
       AND c.type = 'direct'
       AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $2)
       AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $3)
       AND (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) = 2`,
    [projectId, userId, otherUserId]
  );
  
  if (existing.rows[0]) {
    return existing.rows[0];
  }
  
  // Get other user's name for channel name
  const otherUser = await query('SELECT name FROM users WHERE id = $1', [otherUserId]);
  const currentUser = await query('SELECT name FROM users WHERE id = $1', [userId]);
  
  // Create new direct channel
  return createChannel(projectId, userId, {
    name: `dm-${userId.slice(0, 8)}-${otherUserId.slice(0, 8)}`,
    description: `Direct message between ${currentUser.rows[0]?.name} and ${otherUser.rows[0]?.name}`,
    type: 'direct',
    memberIds: [otherUserId],
  });
}

/**
 * Update channel
 */
export async function updateChannel(channelId, userId, data) {
  const { name, description, is_archived } = data;
  
  const result = await query(
    `UPDATE channels
     SET name = COALESCE($2, name),
         description = COALESCE($3, description),
         is_archived = COALESCE($4, is_archived),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [channelId, name, description, is_archived]
  );
  
  if (result.rows[0]) {
    emitToProject(result.rows[0].project_id, 'channel:updated', result.rows[0]);
  }
  
  return result.rows[0] || null;
}

/**
 * Delete channel
 */
export async function deleteChannel(channelId) {
  const channel = await getChannelById(channelId);
  if (!channel) return null;
  
  await query('DELETE FROM channels WHERE id = $1', [channelId]);
  
  emitToProject(channel.project_id, 'channel:deleted', { id: channelId });
  
  return { success: true };
}

/**
 * Get channel members
 */
export async function getChannelMembers(channelId) {
  const result = await query(
    `SELECT cm.*, u.name, u.email, u.avatar, u.role AS user_role,
            up.status AS presence_status, up.custom_status
     FROM channel_members cm
     JOIN users u ON u.id = cm.user_id
     LEFT JOIN user_presence up ON up.user_id = u.id
     WHERE cm.channel_id = $1
     ORDER BY cm.role = 'admin' DESC, u.name ASC`,
    [channelId]
  );
  return result.rows;
}

/**
 * Add member to channel
 */
export async function addChannelMember(channelId, userId, role = 'member') {
  const result = await query(
    `INSERT INTO channel_members (channel_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (channel_id, user_id) DO UPDATE SET role = $3
     RETURNING *`,
    [channelId, userId, role]
  );
  
  const channel = await getChannelById(channelId, userId);
  if (channel) {
    emitToProject(channel.project_id, 'channel:member:added', { channelId, userId });
  }
  
  return result.rows[0];
}

/**
 * Remove member from channel
 */
export async function removeChannelMember(channelId, userId) {
  await query(
    'DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2',
    [channelId, userId]
  );
  
  const channel = await getChannelById(channelId, userId);
  if (channel) {
    emitToProject(channel.project_id, 'channel:member:removed', { channelId, userId });
  }
  
  return { success: true };
}

/**
 * Update last read timestamp
 */
export async function markChannelAsRead(channelId, userId) {
  await query(
    `UPDATE channel_members
     SET last_read_at = NOW()
     WHERE channel_id = $1 AND user_id = $2`,
    [channelId, userId]
  );
  return { success: true };
}

/**
 * Toggle mute status
 */
export async function toggleChannelMute(channelId, userId) {
  const result = await query(
    `UPDATE channel_members
     SET is_muted = NOT is_muted
     WHERE channel_id = $1 AND user_id = $2
     RETURNING is_muted`,
    [channelId, userId]
  );
  return result.rows[0] || null;
}
