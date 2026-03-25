import { Router } from 'express';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as flowchartController from '../controllers/flowchartController.js';

const router = Router();

router.use(authenticate);

router.get('/:projectId/flowcharts', requireProjectMember, flowchartController.list);
router.get('/:projectId/flowcharts/:flowchartId', requireProjectMember, flowchartController.getById);
router.post('/:projectId/flowcharts', requireProjectMember, validate(schemas.createFlowchart), flowchartController.create);
router.patch('/:projectId/flowcharts/:flowchartId', requireProjectMember, validate(schemas.updateFlowchart), flowchartController.update);
router.delete('/:projectId/flowcharts/:flowchartId', requireProjectMember, flowchartController.remove);

export default router;
