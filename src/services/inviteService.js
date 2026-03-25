import bcrypt from 'bcryptjs';
import { query, transaction } from '../config/database.js';
import { generateTempPassword, generateInviteToken } from '../utils/tokens.js';
import { enqueueJob } from '../config/qstash.js';
import { logActivity } from './activity.js';
import { emitToProject } from '../config/socket.js';

export async function getInvites(projectId) {
  const { rows } = await query(`
    SELECT i.*, u.name AS invited_by_name
    FROM invites i
    JOIN users u ON u.id = i.invited_by
    WHERE i.project_id = $1
    ORDER BY i.created_at DESC
  `, [projectId]);

  return rows;
}

export async function createInvite(projectId, userId, userName, { name, email, role }) {
  // Check if already a member
  const { rows: existing } = await query(`
    SELECT 1 FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = $1 AND u.email = $2
  `, [projectId, email]);

  if (existing.length > 0) {
    return { error: 'User is already a member of this project', status: 409 };
  }

  // Check for existing pending invite
  const { rows: existingInvite } = await query(
    `SELECT id FROM invites WHERE project_id = $1 AND email = $2 AND status = 'pending'`,
    [projectId, email]
  );

  if (existingInvite.length > 0) {
    return { error: 'A pending invite already exists for this email', status: 409 };
  }

  const tempPassword = generateTempPassword();
  const token = generateInviteToken();
  const tempPasswordHash = await bcrypt.hash(tempPassword, 12);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = await transaction(async (client) => {
    const { rows } = await client.query(`
      INSERT INTO invites (project_id, invited_by, name, email, role, temp_password, token, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [projectId, userId, name, email, role, tempPasswordHash, token, expiresAt]);

    const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role, avatar)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, [name, email, tempPasswordHash, role, avatar]);

    return rows[0];
  });

  const { rows: projRows } = await query('SELECT name FROM projects WHERE id = $1', [projectId]);

  await enqueueJob('send-invite-email', {
    inviteId: invite.id,
    to: email,
    name,
    inviterName: userName,
    projectName: projRows[0]?.name || 'Project',
    role,
    tempPassword,
    loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
  });

  await logActivity({
    projectId,
    userId,
    action: 'invited',
    entityType: 'invite',
    entityId: invite.id,
    entityTitle: name,
  });

  emitToProject(projectId, 'invite:created', invite);

  return { data: invite };
}

export async function resendInvite(projectId, inviteId, userName) {
  const { rows } = await query(
    'SELECT * FROM invites WHERE id = $1 AND project_id = $2',
    [inviteId, projectId]
  );

  if (!rows[0]) return { error: 'Invite not found', status: 404 };

  const invite = rows[0];
  if (invite.status !== 'pending') {
    return { error: 'Can only resend pending invites', status: 400 };
  }

  const tempPassword = generateTempPassword();
  const tempPasswordHash = await bcrypt.hash(tempPassword, 12);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query(
    'UPDATE invites SET temp_password = $1, expires_at = $2 WHERE id = $3',
    [tempPasswordHash, expiresAt, invite.id]
  );

  const { rows: projRows } = await query('SELECT name FROM projects WHERE id = $1', [projectId]);

  await enqueueJob('send-invite-email', {
    inviteId: invite.id,
    to: invite.email,
    name: invite.name,
    inviterName: userName,
    projectName: projRows[0]?.name || 'Project',
    role: invite.role,
    tempPassword,
    loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
  });

  return { success: true };
}

export async function revokeInvite(projectId, inviteId) {
  const { rows } = await query(
    `UPDATE invites SET status = 'revoked' WHERE id = $1 AND project_id = $2 AND status = 'pending' RETURNING *`,
    [inviteId, projectId]
  );

  if (!rows[0]) return { error: 'Pending invite not found', status: 404 };

  emitToProject(projectId, 'invite:revoked', { id: inviteId });

  return { success: true };
}

export async function acceptInvite(projectId, inviteId) {
  const { rows } = await query(
    `SELECT * FROM invites WHERE id = $1 AND status = 'pending' AND expires_at > NOW()`,
    [inviteId]
  );

  if (!rows[0]) return { error: 'Invite not found or expired', status: 404 };

  const invite = rows[0];

  await transaction(async (client) => {
    const { rows: userRows } = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [invite.email]
    );

    if (userRows[0]) {
      await client.query(`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (project_id, user_id) DO NOTHING
      `, [invite.project_id, userRows[0].id, invite.role]);
    }

    await client.query(
      `UPDATE invites SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
      [invite.id]
    );
  });

  emitToProject(invite.project_id, 'invite:accepted', { id: invite.id, name: invite.name });

  return { success: true };
}
