import { query } from '../config/database.js';
import { emitToProject } from '../config/socket.js';

/**
 * Log an activity and broadcast it in realtime.
 */
export async function logActivity({ projectId, userId, action, entityType, entityId, entityTitle, metadata = {} }) {
  const { rows } = await query(`
    INSERT INTO activity_log (project_id, user_id, action, entity_type, entity_id, entity_title, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [projectId, userId, action, entityType, entityId, entityTitle, JSON.stringify(metadata)]);

  const activity = rows[0];

  // Fetch user info for realtime broadcast
  const { rows: userRows } = await query(
    'SELECT name, avatar FROM users WHERE id = $1',
    [userId]
  );

  const enriched = {
    ...activity,
    user_name: userRows[0]?.name,
    user_avatar: userRows[0]?.avatar,
  };

  emitToProject(projectId, 'activity:new', enriched);

  return activity;
}
