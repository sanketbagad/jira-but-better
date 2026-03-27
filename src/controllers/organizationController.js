import * as orgService from '../services/organizationService.js';

// ============== ORGANIZATIONS ==============

export async function createOrganization(req, res, next) {
  try {
    const org = await orgService.createOrganization(req.user.id, req.body);
    res.status(201).json({ data: org });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Organization with this name already exists' });
    }
    next(err);
  }
}

export async function getOrganization(req, res, next) {
  try {
    const org = await orgService.getOrganizationById(req.params.orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json({ data: org });
  } catch (err) {
    next(err);
  }
}

export async function getUserOrganizations(req, res, next) {
  try {
    const orgs = await orgService.getUserOrganizations(req.user.id);
    res.json({ data: orgs });
  } catch (err) {
    next(err);
  }
}

export async function updateOrganization(req, res, next) {
  try {
    const org = await orgService.updateOrganization(req.params.orgId, req.body);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json({ data: org });
  } catch (err) {
    next(err);
  }
}

export async function deleteOrganization(req, res, next) {
  try {
    // Only owner can delete
    const role = await orgService.getOrgMemberRole(req.params.orgId, req.user.id);
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Only the organization owner can delete it' });
    }
    await orgService.deleteOrganization(req.params.orgId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ============== ORGANIZATION MEMBERS ==============

export async function getMembers(req, res, next) {
  try {
    const { search } = req.query;
    const members = await orgService.getOrgMembers(req.params.orgId, search);
    res.json({ data: members });
  } catch (err) {
    next(err);
  }
}

export async function addMember(req, res, next) {
  try {
    const { user_id, role } = req.body;
    const member = await orgService.addOrgMember(req.params.orgId, user_id, role || 'member', req.user.id);
    res.status(201).json({ data: member });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'User is already a member' });
    }
    next(err);
  }
}

export async function updateMemberRole(req, res, next) {
  try {
    const { role } = req.body;
    const member = await orgService.updateOrgMemberRole(req.params.orgId, req.params.userId, role);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json({ data: member });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req, res, next) {
  try {
    // Can't remove yourself if owner
    const targetRole = await orgService.getOrgMemberRole(req.params.orgId, req.params.userId);
    if (targetRole === 'owner') {
      return res.status(403).json({ error: 'Cannot remove the organization owner' });
    }
    await orgService.removeOrgMember(req.params.orgId, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ============== TEAMS ==============

export async function getTeams(req, res, next) {
  try {
    const teams = await orgService.getTeams(req.params.orgId);
    res.json({ data: teams });
  } catch (err) {
    next(err);
  }
}

export async function createTeam(req, res, next) {
  try {
    const team = await orgService.createTeam(req.params.orgId, req.user.id, req.body);
    res.status(201).json({ data: team });
  } catch (err) {
    next(err);
  }
}

export async function updateTeam(req, res, next) {
  try {
    const team = await orgService.updateTeam(req.params.teamId, req.body);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ data: team });
  } catch (err) {
    next(err);
  }
}

export async function deleteTeam(req, res, next) {
  try {
    await orgService.deleteTeam(req.params.teamId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getTeamMembers(req, res, next) {
  try {
    const members = await orgService.getTeamMembers(req.params.teamId);
    res.json({ data: members });
  } catch (err) {
    next(err);
  }
}

export async function addTeamMember(req, res, next) {
  try {
    const { user_id, role } = req.body;
    const member = await orgService.addTeamMember(req.params.teamId, user_id, role || 'member');
    res.status(201).json({ data: member });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'User is already a team member' });
    }
    next(err);
  }
}

export async function removeTeamMember(req, res, next) {
  try {
    await orgService.removeTeamMember(req.params.teamId, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
