import { Router } from 'express';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as projectController from '../controllers/projectController.js';

const router = Router();

router.use(authenticate);

router.get('/', projectController.list);
router.get('/:projectId', projectController.getById);
router.post('/', validate(schemas.createProject), projectController.create);
router.patch('/:projectId', requireProjectMember, validate(schemas.updateProject), projectController.update);
router.delete('/:projectId', requireProjectMember, projectController.remove);

export default router;
