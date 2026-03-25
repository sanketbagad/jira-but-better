import { Router } from 'express';
import { authenticate, requireProjectMember, requireProjectAdmin } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as inviteController from '../controllers/inviteController.js';

const router = Router();

router.use(authenticate);

router.get('/:projectId/invites', requireProjectMember, inviteController.list);
router.post('/:projectId/invites', requireProjectMember, requireProjectAdmin, validate(schemas.createInvite), inviteController.create);
router.post('/:projectId/invites/:inviteId/resend', requireProjectMember, requireProjectAdmin, inviteController.resend);
router.delete('/:projectId/invites/:inviteId', requireProjectMember, requireProjectAdmin, inviteController.revoke);
router.post('/:projectId/invites/:inviteId/accept', inviteController.accept);

export default router;
