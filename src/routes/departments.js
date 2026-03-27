import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as deptController from '../controllers/departmentController.js';

const router = Router();

router.use(authenticate);

router.get('/', deptController.getDepartments);
router.post('/', validate(schemas.createDepartment), deptController.createDepartment);
router.get('/:deptId', deptController.getDepartment);
router.patch('/:deptId', validate(schemas.updateDepartment), deptController.updateDepartment);
router.delete('/:deptId', deptController.deleteDepartment);
router.get('/:deptId/members', deptController.getDepartmentMembers);

export default router;
