import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireOrgMember, requireOrgAdmin } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as orgController from '../controllers/organizationController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---- Organizations ----
router.get('/', orgController.getUserOrganizations);
router.post('/', validate(schemas.createOrganization), orgController.createOrganization);

// Org-specific routes require membership
router.get('/:orgId', requireOrgMember, orgController.getOrganization);
router.patch('/:orgId', requireOrgAdmin, validate(schemas.updateOrganization), orgController.updateOrganization);
router.delete('/:orgId', requireOrgMember, orgController.deleteOrganization); // owner check inside controller

// ---- Members ----
router.get('/:orgId/members', requireOrgMember, orgController.getMembers);
router.post('/:orgId/members', requireOrgAdmin, orgController.addMember);
router.patch('/:orgId/members/:userId', requireOrgAdmin, orgController.updateMemberRole);
router.delete('/:orgId/members/:userId', requireOrgAdmin, orgController.removeMember);

// ---- Teams ----
router.get('/:orgId/teams', requireOrgMember, orgController.getTeams);
router.post('/:orgId/teams', requireOrgAdmin, validate(schemas.createTeam), orgController.createTeam);
router.patch('/:orgId/teams/:teamId', requireOrgAdmin, validate(schemas.updateTeam), orgController.updateTeam);
router.delete('/:orgId/teams/:teamId', requireOrgAdmin, orgController.deleteTeam);

// ---- Team Members ----
router.get('/:orgId/teams/:teamId/members', requireOrgMember, orgController.getTeamMembers);
router.post('/:orgId/teams/:teamId/members', requireOrgAdmin, orgController.addTeamMember);
router.delete('/:orgId/teams/:teamId/members/:userId', requireOrgAdmin, orgController.removeTeamMember);

export default router;
