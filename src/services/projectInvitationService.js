import { query, transaction } from '../config/database.js';
import { cacheDel } from '../config/redis.js';
import { createNotification } from './notificationService.js';
import { emitToUser, emitToProject } from '../config/socket.js';

/**
 * Get organization members who are NOT already project members
 */
export async function getAvailableOrgMembers(projectId, orgId, search) {
  const searchClause = search ? `AND (u.name ILIKE $3 OR u.email ILIKE $3)` : '';
  const params = search ? [projectId, orgId, `%${search}%`] : [projectId, orgId];

  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.avatar, u.designation, om.role AS org_role,
       d.name AS department_name,
       EXISTS (
         SELECT 1 FROM project_invitations pi 
         WHERE pi.project_id = $1 AND pi.user_id = u.id AND pi.status = 'pending'
       ) AS has_pending_invite
     FROM users u
     JOIN organization_members om ON om.user_id = u.id AND om.organization_id = $2
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id NOT IN (
       SELECT pm.user_id FROM project_members pm WHERE pm.project_id = $1
     )
     ${searchClause}
     ORDER BY u.name ASC`,
    params
  );

  return rows;
}

/**
 * Get pending project invitations for a project
 */
export async function getProjectInvitations(projectId) {
  const { rows } = await query(
    `SELECT pi.*, 
       u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar,
       inv.name AS inviter_name
     FROM project_invitations pi
     JOIN users u ON u.id = pi.user_id
     JOIN users inv ON inv.id = pi.invited_by
     WHERE pi.project_id = $1
     ORDER BY pi.created_at DESC`,
    [projectId]
  );
  return rows;
}

/**
 * Invite an organization member to a project
 */
export async function inviteToProject(projectId, userId, invitedBy, { role = 'developer', message = '' }) {
  // Check if user is already a member
  const { rows: existing } = await query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );

  if (existing.length > 0) {
    return { error: 'User is already a member of this project', status: 409 };
  }

  // Check for existing pending invitation
  const { rows: existingInvite } = await query(
    `SELECT 1 FROM project_invitations WHERE project_id = $1 AND user_id = $2 AND status = 'pending'`,
    [projectId, userId]
  );

  if (existingInvite.length > 0) {
    return { error: 'User already has a pending invitation', status: 409 };
  }

  // Get project and inviter details for notification
  const { rows: projectRows } = await query(
    'SELECT name FROM projects WHERE id = $1',
    [projectId]
  );
  const { rows: inviterRows } = await query(
    'SELECT name FROM users WHERE id = $1',
    [invitedBy]
  );

  const projectName = projectRows[0]?.name || 'Unknown Project';
  const inviterName = inviterRows[0]?.name || 'Someone';

  // Create invitation
  const { rows } = await query(
    `INSERT INTO project_invitations (project_id, user_id, invited_by, role, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [projectId, userId, invitedBy, role, message || null]
  );

  const invitation = rows[0];

  // Create notification for the invited user
  await createNotification({
    userId,
    type: 'project_invitation',
    title: 'Project Invitation',
    message: `${inviterName} invited you to join "${projectName}" as ${role}`,
    data: {
      invitationId: invitation.id,
      projectId,
      projectName,
      invitedBy,
      inviterName,
      role,
    },
    actionUrl: `/notifications`,
  });

  // Get full invitation data to return
  const { rows: fullInvite } = await query(
    `SELECT pi.*, 
       u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar,
       inv.name AS inviter_name
     FROM project_invitations pi
     JOIN users u ON u.id = pi.user_id
     JOIN users inv ON inv.id = pi.invited_by
     WHERE pi.id = $1`,
    [invitation.id]
  );

  emitToProject(projectId, 'project-invitation:created', fullInvite[0]);

  return { data: fullInvite[0] };
}

/**
 * Get pending invitations for a user
 */
export async function getUserPendingInvitations(userId) {
  const { rows } = await query(
    `SELECT pi.*, 
       p.name AS project_name, p.key AS project_key, p.color AS project_color,
       inv.name AS inviter_name, inv.avatar AS inviter_avatar
     FROM project_invitations pi
     JOIN projects p ON p.id = pi.project_id
     JOIN users inv ON inv.id = pi.invited_by
     WHERE pi.user_id = $1 AND pi.status = 'pending'
     ORDER BY pi.created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Accept a project invitation
 */
export async function acceptInvitation(invitationId, userId) {
  const { rows: inviteRows } = await query(
    `SELECT * FROM project_invitations WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
    [invitationId, userId]
  );

  if (!inviteRows[0]) {
    return { error: 'Invitation not found or already responded', status: 404 };
  }

  const invitation = inviteRows[0];

  await transaction(async (client) => {
    // Update invitation status
    await client.query(
      `UPDATE project_invitations SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
      [invitationId]
    );

    // Add user to project members
    await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [invitation.project_id, userId, invitation.role]
    );
  });

  // Clear project cache for the user
  await cacheDel(`projects:${userId}:*`);

  // Get project details for notification
  const { rows: projectRows } = await query(
    'SELECT name FROM projects WHERE id = $1',
    [invitation.project_id]
  );
  const { rows: userRows } = await query(
    'SELECT name FROM users WHERE id = $1',
    [userId]
  );

  // Notify the inviter that invitation was accepted
  await createNotification({
    userId: invitation.invited_by,
    type: 'invitation_accepted',
    title: 'Invitation Accepted',
    message: `${userRows[0]?.name} accepted your invitation to join "${projectRows[0]?.name}"`,
    data: {
      projectId: invitation.project_id,
      userId,
    },
    actionUrl: `/projects/${invitation.project_id}/team`,
  });

  // Emit to project that a new member joined
  emitToProject(invitation.project_id, 'member:joined', {
    userId,
    name: userRows[0]?.name,
    role: invitation.role,
  });

  return { success: true, projectId: invitation.project_id };
}

/**
 * Decline a project invitation
 */
export async function declineInvitation(invitationId, userId) {
  const { rows: inviteRows } = await query(
    `SELECT * FROM project_invitations WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
    [invitationId, userId]
  );

  if (!inviteRows[0]) {
    return { error: 'Invitation not found or already responded', status: 404 };
  }

  const invitation = inviteRows[0];

  await query(
    `UPDATE project_invitations SET status = 'declined', responded_at = NOW() WHERE id = $1`,
    [invitationId]
  );

  // Get details for notification
  const { rows: projectRows } = await query(
    'SELECT name FROM projects WHERE id = $1',
    [invitation.project_id]
  );
  const { rows: userRows } = await query(
    'SELECT name FROM users WHERE id = $1',
    [userId]
  );

  // Notify the inviter that invitation was declined
  await createNotification({
    userId: invitation.invited_by,
    type: 'invitation_declined',
    title: 'Invitation Declined',
    message: `${userRows[0]?.name} declined your invitation to join "${projectRows[0]?.name}"`,
    data: {
      projectId: invitation.project_id,
      userId,
    },
  });

  emitToProject(invitation.project_id, 'project-invitation:declined', { invitationId });

  return { success: true };
}

/**
 * Cancel/revoke a project invitation (by project admin)
 */
export async function revokeProjectInvitation(invitationId, projectId) {
  const { rows } = await query(
    `DELETE FROM project_invitations 
     WHERE id = $1 AND project_id = $2 AND status = 'pending'
     RETURNING *`,
    [invitationId, projectId]
  );

  if (!rows[0]) {
    return { error: 'Invitation not found', status: 404 };
  }

  emitToProject(projectId, 'project-invitation:revoked', { invitationId });
  emitToUser(rows[0].user_id, 'project-invitation:revoked', { invitationId });

  return { success: true };
}
