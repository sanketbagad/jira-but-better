import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import * as authController from '../controllers/authController.js';

const router = Router();

router.post('/login', authLimiter, validate(schemas.login), authController.login);
router.post('/register', authLimiter, validate(schemas.register), authController.register);
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);
router.patch('/password', authenticate, authController.changePassword);

export default router;
