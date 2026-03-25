import { Router } from 'express';
import { authenticate, requireProjectMember, requireProjectAdmin } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as memberController from '../controllers/memberController.js';

const router = Router();

router.use(authenticate);

router.get('/:projectId/members', requireProjectMember, memberController.list);
router.patch('/:projectId/members/:memberId', requireProjectMember, requireProjectAdmin, validate(schemas.updateMember), memberController.updateRole);
router.delete('/:projectId/members/:memberId', requireProjectMember, requireProjectAdmin, memberController.remove);

export default router;
