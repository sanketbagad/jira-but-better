import { query } from '../config/database.js';
import crypto from 'crypto';

// ============== INTERVIEWS ==============

export async function getInterviews(filters = {}) {
  let sql = `
    SELECT i.*,
           iu.name AS interviewer_name,
           iu.avatar AS interviewer_avatar,
           iu.email AS interviewer_email,
           su.name AS scheduler_name,
           su.avatar AS scheduler_avatar
    FROM interviews i
    LEFT JOIN users iu ON i.interviewer_id = iu.id
    LEFT JOIN users su ON i.scheduled_by = su.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 0;

  if (filters.status) {
    paramCount++;
    sql += ` AND i.status = $${paramCount}`;
    params.push(filters.status);
  }

  if (filters.round) {
    paramCount++;
    sql += ` AND i.round = $${paramCount}`;
    params.push(filters.round);
  }

  if (filters.interviewer_id) {
    paramCount++;
    sql += ` AND i.interviewer_id = $${paramCount}`;
    params.push(filters.interviewer_id);
  }

  if (filters.search) {
    paramCount++;
    sql += ` AND (i.candidate_name ILIKE $${paramCount} OR i.candidate_email ILIKE $${paramCount} OR i.position_title ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
  }

  if (filters.from_date) {
    paramCount++;
    sql += ` AND i.scheduled_at >= $${paramCount}`;
    params.push(filters.from_date);
  }

  if (filters.to_date) {
    paramCount++;
    sql += ` AND i.scheduled_at <= $${paramCount}`;
    params.push(filters.to_date);
  }

  sql += ' ORDER BY i.scheduled_at ASC';

  const { rows } = await query(sql, params);
  return rows;
}

export async function getInterviewById(id) {
  const { rows } = await query(
    `SELECT i.*,
            iu.name AS interviewer_name,
            iu.avatar AS interviewer_avatar,
            iu.email AS interviewer_email,
            su.name AS scheduler_name,
            su.avatar AS scheduler_avatar
     FROM interviews i
     LEFT JOIN users iu ON i.interviewer_id = iu.id
     LEFT JOIN users su ON i.scheduled_by = su.id
     WHERE i.id = $1`,
    [id]
  );
  return rows[0];
}

export async function createInterview(userId, data) {
  // Generate a unique meeting room ID and link
  const roomId = crypto.randomBytes(8).toString('hex');
  const meetingLink = `/meeting/${roomId}`;

  const { rows } = await query(
    `INSERT INTO interviews (
      scheduled_by,
      candidate_name, candidate_email, candidate_phone,
      position_title, department,
      round, round_number,
      interviewer_id,
      scheduled_at, duration_minutes,
      meeting_link, meeting_room_id,
      interview_type, status,
      notes, resume_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
    [
      userId,
      data.candidate_name, data.candidate_email, data.candidate_phone || null,
      data.position_title, data.department || null,
      data.round || 'screening', data.round_number || 1,
      data.interviewer_id || null,
      data.scheduled_at, data.duration_minutes || 60,
      meetingLink, roomId,
      data.interview_type || 'video', 'scheduled',
      data.notes || null, data.resume_url || null,
    ]
  );

  // Re-fetch with joins for names
  return getInterviewById(rows[0].id);
}

export async function updateInterview(id, userId, data) {
  const updates = [];
  const params = [id];
  let paramCount = 1;

  const allowedFields = [
    'candidate_name', 'candidate_email', 'candidate_phone',
    'position_title', 'department',
    'round', 'round_number',
    'interviewer_id',
    'scheduled_at', 'duration_minutes',
    'interview_type', 'status',
    'notes', 'feedback', 'rating',
    'resume_url',
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      paramCount++;
      updates.push(`${field} = $${paramCount}`);
      params.push(data[field]);
    }
  }

  if (updates.length === 0) return getInterviewById(id);

  updates.push('updated_at = NOW()');

  // If rescheduling, generate new meeting link
  if (data.status === 'rescheduled' && data.scheduled_at) {
    const roomId = crypto.randomBytes(8).toString('hex');
    paramCount++;
    updates.push(`meeting_room_id = $${paramCount}`);
    params.push(roomId);
    paramCount++;
    updates.push(`meeting_link = $${paramCount}`);
    params.push(`/meeting/${roomId}`);
    // Reset status back to scheduled
    paramCount++;
    updates.push(`status = $${paramCount}`);
    params.push('scheduled');
  }

  await query(
    `UPDATE interviews SET ${updates.join(', ')} WHERE id = $1`,
    params
  );

  return getInterviewById(id);
}

export async function deleteInterview(id) {
  await query('DELETE FROM interviews WHERE id = $1', [id]);
}

// Get all interviewers (users with admin, hr, or manager roles)
export async function getInterviewers() {
  const { rows } = await query(
    `SELECT id, name, email, avatar, role
     FROM users
     WHERE role IN ('admin', 'hr', 'manager', 'developer', 'designer')
     ORDER BY name`
  );
  return rows;
}
