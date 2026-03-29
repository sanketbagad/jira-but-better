import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as notificationController from '../controllers/notificationController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Notifications
router.get('/', notificationController.list);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/:notificationId/read', notificationController.markRead);
router.post('/mark-all-read', notificationController.markAllRead);
router.delete('/:notificationId', notificationController.remove);
router.delete('/', notificationController.clearAll);

// Project invitations
router.get('/invitations', notificationController.getPendingInvitations);
router.post('/invitations/:invitationId/accept', notificationController.acceptInvitation);
router.post('/invitations/:invitationId/decline', notificationController.declineInvitation);

export default router;
