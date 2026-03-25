import { Router } from 'express';
import { authenticate, requireProjectMember, requireProjectAdmin } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as sprintController from '../controllers/sprintController.js';

const router = Router();

router.use(authenticate);

router.get('/:projectId/sprints', requireProjectMember, sprintController.list);
router.post('/:projectId/sprints', requireProjectMember, validate(schemas.createSprint), sprintController.create);
router.patch('/:projectId/sprints/:sprintId', requireProjectMember, validate(schemas.updateSprint), sprintController.update);
router.delete('/:projectId/sprints/:sprintId', requireProjectMember, requireProjectAdmin, sprintController.remove);

export default router;
