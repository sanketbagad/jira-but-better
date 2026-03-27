import { Router } from 'express';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as meetingController from '../controllers/meetingController.js';

const router = Router();

router.use(authenticate);

// User's upcoming meetings (across all projects)
router.get('/me/upcoming', meetingController.getUserMeetings);

// Presence
router.post('/presence', meetingController.updatePresence);
router.get('/:projectId/presence', requireProjectMember, meetingController.getOnlineUsers);

// Meeting routes
router.get('/:projectId/meetings', requireProjectMember, meetingController.listMeetings);
router.post('/:projectId/meetings', requireProjectMember, validate(schemas.createMeeting), meetingController.createMeeting);
router.get('/:projectId/meetings/:meetingId', requireProjectMember, meetingController.getMeeting);
router.patch('/:projectId/meetings/:meetingId', requireProjectMember, validate(schemas.updateMeeting), meetingController.updateMeeting);
router.delete('/:projectId/meetings/:meetingId', requireProjectMember, meetingController.deleteMeeting);

router.post('/:projectId/meetings/:meetingId/cancel', requireProjectMember, meetingController.cancelMeeting);
router.post('/:projectId/meetings/:meetingId/respond', requireProjectMember, meetingController.respondToMeeting);
router.post('/:projectId/meetings/:meetingId/join', requireProjectMember, meetingController.joinMeeting);
router.post('/:projectId/meetings/:meetingId/leave', requireProjectMember, meetingController.leaveMeeting);

export default router;
