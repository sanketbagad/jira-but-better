import * as projectInvitationService from '../services/projectInvitationService.js';

/**
 * Get organization members available to invite (not already in project)
 */
export async function getAvailableMembers(req, res, next) {
  try {
    const { projectId } = req.params;
    const search = req.query.search || '';
    
    // Get organization ID from project
    const project = req.project;
    if (!project?.organization_id) {
      return res.status(400).json({ error: 'Project is not part of an organization' });
    }

    const members = await projectInvitationService.getAvailableOrgMembers(
      projectId,
      project.organization_id,
      search
    );

    res.json(members);
  } catch (err) {
    next(err);
  }
}

/**
 * Get pending project invitations
 */
export async function listInvitations(req, res, next) {
  try {
    const invitations = await projectInvitationService.getProjectInvitations(req.params.projectId);
    res.json(invitations);
  } catch (err) {
    next(err);
  }
}

/**
 * Invite an organization member to the project
 */
export async function inviteMember(req, res, next) {
  try {
    const { projectId } = req.params;
    const { userId, role, message } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await projectInvitationService.inviteToProject(
      projectId,
      userId,
      req.user.id,
      { role, message }
    );

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.status(201).json(result.data);
  } catch (err) {
    next(err);
  }
}

/**
 * Revoke a project invitation
 */
export async function revokeInvitation(req, res, next) {
  try {
    const { projectId, invitationId } = req.params;

    const result = await projectInvitationService.revokeProjectInvitation(invitationId, projectId);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}
