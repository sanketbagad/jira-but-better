import { Router } from 'express';
import { authenticate, requireProjectMember, requireProjectAdmin } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as memberController from '../controllers/memberController.js';
import * as projectInvitationController from '../controllers/projectInvitationController.js';

const router = Router();

router.use(authenticate);

// Members
router.get('/:projectId/members', requireProjectMember, memberController.list);
router.patch('/:projectId/members/:memberId', requireProjectMember, requireProjectAdmin, validate(schemas.updateMember), memberController.updateRole);
router.delete('/:projectId/members/:memberId', requireProjectMember, requireProjectAdmin, memberController.remove);

// Organization members available to invite
router.get('/:projectId/available-members', requireProjectMember, projectInvitationController.getAvailableMembers);

// Project invitations (for org members)
router.get('/:projectId/project-invitations', requireProjectMember, projectInvitationController.listInvitations);
router.post('/:projectId/project-invitations', requireProjectMember, requireProjectAdmin, projectInvitationController.inviteMember);
router.delete('/:projectId/project-invitations/:invitationId', requireProjectMember, requireProjectAdmin, projectInvitationController.revokeInvitation);

export default router;
