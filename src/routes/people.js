import { Router } from 'express';
import { authenticate, requireHR } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as peopleController from '../controllers/peopleController.js';

const router = Router();

router.use(authenticate);

router.post('/', requireHR, validate(schemas.createPerson), peopleController.createPerson);
router.get('/', peopleController.getPeople);
router.get('/stats', peopleController.getOrgStats);
router.get('/:userId', peopleController.getPerson);
router.patch('/:userId', validate(schemas.updatePerson), peopleController.updatePerson);
router.get('/:userId/reports', peopleController.getDirectReports);
router.get('/:userId/chain', peopleController.getReportingChain);

export default router;
