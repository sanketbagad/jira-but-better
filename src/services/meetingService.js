import { query, getClient } from '../config/database.js';
import { emitToProject, emitToUser } from '../config/socket.js';
import crypto from 'crypto';

/**
 * Get all meetings for a project
 */
export async function getMeetings(projectId, options = {}) {
  const { status, hostId, startAfter, startBefore, limit = 50 } = options;
  
  let sql = `
    SELECT m.*,
           u.name AS host_name,
           u.avatar AS host_avatar,
           u.email AS host_email,
           c.name AS channel_name,
           (SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = m.id) AS participant_count,
           (SELECT json_agg(json_build_object(
             'user_id', mp.user_id,
             'status', mp.status,
             'is_required', mp.is_required,
             'name', pu.name,
             'avatar', pu.avatar
           ))
            FROM meeting_participants mp
            JOIN users pu ON pu.id = mp.user_id
            WHERE mp.meeting_id = m.id) AS participants
    FROM meetings m
    JOIN users u ON u.id = m.host_id
    LEFT JOIN channels c ON c.id = m.channel_id
    WHERE m.project_id = $1
  `;
  
  const params = [projectId];
  let paramIndex = 2;
  
  if (status) {
    sql += ` AND m.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }
  
  if (hostId) {
    sql += ` AND m.host_id = $${paramIndex}`;
    params.push(hostId);
    paramIndex++;
  }
  
  if (startAfter) {
    sql += ` AND m.start_time >= $${paramIndex}`;
    params.push(startAfter);
    paramIndex++;
  }
  
  if (startBefore) {
    sql += ` AND m.start_time <= $${paramIndex}`;
    params.push(startBefore);
    paramIndex++;
  }
  
  sql += ` ORDER BY m.start_time ASC LIMIT $${paramIndex}`;
  params.push(limit);
  
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Get meeting by ID
 */
export async function getMeetingById(meetingId) {
  const result = await query(
    `SELECT m.*,
            u.name AS host_name,
            u.avatar AS host_avatar,
            u.email AS host_email,
            c.name AS channel_name,
            (SELECT json_agg(json_build_object(
              'user_id', mp.user_id,
              'status', mp.status,
              'is_required', mp.is_required,
              'joined_at', mp.joined_at,
              'left_at', mp.left_at,
              'name', pu.name,
              'avatar', pu.avatar,
              'email', pu.email
            ))
             FROM meeting_participants mp
             JOIN users pu ON pu.id = mp.user_id
             WHERE mp.meeting_id = m.id) AS participants
     FROM meetings m
     JOIN users u ON u.id = m.host_id
     LEFT JOIN channels c ON c.id = m.channel_id
     WHERE m.id = $1`,
    [meetingId]
  );
  return result.rows[0] || null;
}

/**
 * Find an active quick-call meeting in a channel, or create one.
 * "Active" = status is 'scheduled' or 'in_progress' and end_time is in the future.
 * This prevents multiple meetings from being created when several users click
 * the quick-call button in the same channel.
 */
export async function findOrCreateQuickMeeting(projectId, channelId, userId) {
  // 1. Look for an existing active meeting in this channel
  const existing = await query(
    `SELECT m.id
     FROM meetings m
     WHERE m.project_id = $1
       AND m.channel_id = $2
       AND m.status IN ('scheduled', 'in_progress')
       AND m.end_time > NOW()
       AND m.meeting_type = 'video'
     ORDER BY m.created_at DESC
     LIMIT 1`,
    [projectId, channelId]
  );

  if (existing.rows.length > 0) {
    // Join the user into the existing meeting and return it
    const meetingId = existing.rows[0].id;
    const joined = await joinMeeting(meetingId, userId);
    return joined;
  }

  // 2. No active meeting — create a new one
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  // We need the channel name for the title
  const chResult = await query(`SELECT name FROM channels WHERE id = $1`, [channelId]);
  const channelName = chResult.rows[0]?.name || 'general';

  return createMeeting(projectId, userId, {
    title: `Quick call in #${channelName}`,
    description: '',
    channel_id: channelId,
    start_time: now.toISOString(),
    end_time: end.toISOString(),
    meeting_type: 'video',
    participant_ids: [],
  });
}

/**
 * Create a new meeting
 */
export async function createMeeting(projectId, hostId, data) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const {
      title,
      description,
      channel_id,
      start_time,
      end_time,
      timezone = 'UTC',
      meeting_type = 'video',
      recurrence,
      participant_ids = [],
    } = data;
    
    // Generate a unique meeting link/room ID
    const roomId = crypto.randomBytes(8).toString('hex');
    const meeting_link = `/meeting/${roomId}`;
    
    const result = await client.query(
      `INSERT INTO meetings (
        project_id, channel_id, title, description, host_id,
        start_time, end_time, timezone, meeting_link, meeting_type, recurrence
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        projectId, channel_id, title, description, hostId,
        start_time, end_time, timezone, meeting_link, meeting_type,
        recurrence ? JSON.stringify(recurrence) : null
      ]
    );
    
    const meeting = result.rows[0];
    
    // Add host as participant
    await client.query(
      `INSERT INTO meeting_participants (meeting_id, user_id, status, is_required)
       VALUES ($1, $2, 'accepted', true)`,
      [meeting.id, hostId]
    );
    
    // Add other participants
    for (const participantId of participant_ids) {
      if (participantId !== hostId) {
        await client.query(
          `INSERT INTO meeting_participants (meeting_id, user_id, is_required)
           VALUES ($1, $2, true)
           ON CONFLICT (meeting_id, user_id) DO NOTHING`,
          [meeting.id, participantId]
        );
        
        // Notify participant
        emitToUser(participantId, 'meeting:invite', {
          meeting,
          hostId,
        });
      }
    }
    
    await client.query('COMMIT');
    
    // Get full meeting with participants
    const fullMeeting = await getMeetingById(meeting.id);
    
    // Emit to project
    emitToProject(projectId, 'meeting:created', fullMeeting);
    
    // If channel_id is provided, send a message to the channel
    if (channel_id) {
      const { sendMessage } = await import('./messageService.js');
      await sendMessage(channel_id, hostId, {
        content: `📅 Meeting scheduled: **${title}**\n🕐 ${new Date(start_time).toLocaleString()} - ${new Date(end_time).toLocaleString()}`,
        type: 'meeting',
        metadata: { meetingId: meeting.id },
      }, projectId);
    }
    
    return fullMeeting;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update meeting
 */
export async function updateMeeting(meetingId, hostId, data) {
  const {
    title,
    description,
    start_time,
    end_time,
    timezone,
    meeting_type,
    status,
    recurrence,
  } = data;
  
  const result = await query(
    `UPDATE meetings
     SET title = COALESCE($2, title),
         description = COALESCE($3, description),
         start_time = COALESCE($4, start_time),
         end_time = COALESCE($5, end_time),
         timezone = COALESCE($6, timezone),
         meeting_type = COALESCE($7, meeting_type),
         status = COALESCE($8, status),
         recurrence = COALESCE($9, recurrence),
         updated_at = NOW()
     WHERE id = $1 AND host_id = $10
     RETURNING *`,
    [meetingId, title, description, start_time, end_time, timezone, meeting_type, status, recurrence ? JSON.stringify(recurrence) : null, hostId]
  );
  
  const meeting = result.rows[0];
  if (meeting) {
    const fullMeeting = await getMeetingById(meetingId);
    emitToProject(meeting.project_id, 'meeting:updated', fullMeeting);
    return fullMeeting;
  }
  
  return null;
}

/**
 * Cancel meeting
 */
export async function cancelMeeting(meetingId, hostId) {
  const result = await query(
    `UPDATE meetings
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND host_id = $2
     RETURNING *`,
    [meetingId, hostId]
  );
  
  const meeting = result.rows[0];
  if (meeting) {
    emitToProject(meeting.project_id, 'meeting:cancelled', { id: meetingId });
    
    // Notify all participants
    const participants = await query(
      'SELECT user_id FROM meeting_participants WHERE meeting_id = $1',
      [meetingId]
    );
    
    for (const p of participants.rows) {
      if (p.user_id !== hostId) {
        emitToUser(p.user_id, 'meeting:cancelled', { meetingId, title: meeting.title });
      }
    }
  }
  
  return meeting || null;
}

/**
 * Delete meeting
 */
export async function deleteMeeting(meetingId, hostId) {
  const meeting = await getMeetingById(meetingId);
  if (!meeting || meeting.host_id !== hostId) return null;
  
  await query('DELETE FROM meetings WHERE id = $1', [meetingId]);
  
  emitToProject(meeting.project_id, 'meeting:deleted', { id: meetingId });
  
  return { success: true };
}

/**
 * Respond to meeting invite
 */
export async function respondToMeeting(meetingId, userId, status) {
  const result = await query(
    `UPDATE meeting_participants
     SET status = $2
     WHERE meeting_id = $1 AND user_id = $3
     RETURNING *`,
    [meetingId, status, userId]
  );
  
  if (result.rows[0]) {
    const meeting = await getMeetingById(meetingId);
    if (meeting) {
      emitToProject(meeting.project_id, 'meeting:response', {
        meetingId,
        userId,
        status,
      });
    }
  }
  
  return result.rows[0] || null;
}

/**
 * Join meeting (for video call tracking)
 */
export async function joinMeeting(meetingId, userId) {
  // Upsert participant so non-invited users can also join (e.g. quick calls).
  // On re-join, clear left_at so the user counts as active again.
  await query(
    `INSERT INTO meeting_participants (meeting_id, user_id, status, joined_at)
     VALUES ($1, $2, 'accepted', NOW())
     ON CONFLICT (meeting_id, user_id)
     DO UPDATE SET joined_at = NOW(), left_at = NULL`,
    [meetingId, userId]
  );
  
  // Update meeting status if first person joining
  const meeting = await getMeetingById(meetingId);
  if (meeting && meeting.status === 'scheduled') {
    await query(
      `UPDATE meetings SET status = 'in_progress' WHERE id = $1`,
      [meetingId]
    );
    emitToProject(meeting.project_id, 'meeting:started', { meetingId });
  }
  
  if (meeting) {
    // Look up user name + avatar to send with the event
    const userRow = await query('SELECT name, avatar FROM users WHERE id = $1', [userId]);
    const u = userRow.rows[0] || {};
    emitToProject(meeting.project_id, 'meeting:participant:joined', {
      meetingId,
      userId,
      userName: u.name,
      userAvatar: u.avatar,
    });
  }
  
  return meeting;
}

/**
 * Leave meeting
 */
export async function leaveMeeting(meetingId, userId) {
  await query(
    `UPDATE meeting_participants
     SET left_at = NOW()
     WHERE meeting_id = $1 AND user_id = $2`,
    [meetingId, userId]
  );
  
  const meeting = await getMeetingById(meetingId);
  if (meeting) {
    const userRow = await query('SELECT name, avatar FROM users WHERE id = $1', [userId]);
    const u = userRow.rows[0] || {};
    emitToProject(meeting.project_id, 'meeting:participant:left', {
      meetingId,
      userId,
      userName: u.name,
      userAvatar: u.avatar,
    });
    
    // Check if all participants have left
    const activeParticipants = await query(
      `SELECT COUNT(*) FROM meeting_participants
       WHERE meeting_id = $1 AND joined_at IS NOT NULL AND left_at IS NULL`,
      [meetingId]
    );
    
    if (parseInt(activeParticipants.rows[0].count) === 0 && meeting.status === 'in_progress') {
      await query(
        `UPDATE meetings SET status = 'completed' WHERE id = $1`,
        [meetingId]
      );
      emitToProject(meeting.project_id, 'meeting:ended', { meetingId });
    }
  }
  
  return { success: true };
}

/**
 * Get user's upcoming meetings across all projects
 */
export async function getUserUpcomingMeetings(userId, limit = 10) {
  const result = await query(
    `SELECT m.*, p.name AS project_name, p.key AS project_key, u.name AS host_name
     FROM meetings m
     JOIN projects p ON p.id = m.project_id
     JOIN users u ON u.id = m.host_id
     WHERE m.start_time >= NOW()
       AND m.status IN ('scheduled', 'in_progress')
       AND (m.host_id = $1 OR EXISTS (
         SELECT 1 FROM meeting_participants WHERE meeting_id = m.id AND user_id = $1
       ))
     ORDER BY m.start_time ASC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}
