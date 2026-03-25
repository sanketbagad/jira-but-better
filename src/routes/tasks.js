import { Router } from 'express';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as taskController from '../controllers/taskController.js';

const router = Router();

router.use(authenticate);

router.get('/:projectId/tasks', requireProjectMember, taskController.list);
router.get('/:projectId/tasks/:taskId', requireProjectMember, taskController.getById);
router.post('/:projectId/tasks', requireProjectMember, validate(schemas.createTask), taskController.create);
router.patch('/:projectId/tasks/:taskId', requireProjectMember, validate(schemas.updateTask), taskController.update);
router.delete('/:projectId/tasks/:taskId', requireProjectMember, taskController.remove);

export default router;
