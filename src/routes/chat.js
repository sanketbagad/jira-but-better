import { Router } from 'express';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import * as chatController from '../controllers/chatController.js';

const router = Router();

router.use(authenticate);

// Channel routes
router.get('/:projectId/channels', requireProjectMember, chatController.listChannels);
router.post('/:projectId/channels', requireProjectMember, validate(schemas.createChannel), chatController.createChannel);
router.post('/:projectId/channels/direct/:userId', requireProjectMember, chatController.getOrCreateDirect);
router.get('/:projectId/channels/unread', requireProjectMember, chatController.getUnreadCounts);
router.get('/:projectId/messages/search', requireProjectMember, chatController.searchMessages);

router.get('/:projectId/channels/:channelId', requireProjectMember, chatController.getChannel);
router.patch('/:projectId/channels/:channelId', requireProjectMember, validate(schemas.updateChannel), chatController.updateChannel);
router.delete('/:projectId/channels/:channelId', requireProjectMember, chatController.deleteChannel);

router.get('/:projectId/channels/:channelId/members', requireProjectMember, chatController.getChannelMembers);
router.post('/:projectId/channels/:channelId/members', requireProjectMember, chatController.addChannelMember);
router.delete('/:projectId/channels/:channelId/members/:userId', requireProjectMember, chatController.removeChannelMember);

router.post('/:projectId/channels/:channelId/read', requireProjectMember, chatController.markAsRead);
router.post('/:projectId/channels/:channelId/mute', requireProjectMember, chatController.toggleMute);

// Message routes
router.get('/:projectId/channels/:channelId/messages', requireProjectMember, chatController.listMessages);
router.post('/:projectId/channels/:channelId/messages', requireProjectMember, validate(schemas.sendMessage), chatController.sendMessage);
router.patch('/:projectId/messages/:messageId', requireProjectMember, chatController.updateMessage);
router.delete('/:projectId/messages/:messageId', requireProjectMember, chatController.deleteMessage);

router.post('/:projectId/messages/:messageId/reactions', requireProjectMember, chatController.addReaction);
router.delete('/:projectId/messages/:messageId/reactions/:emoji', requireProjectMember, chatController.removeReaction);

export default router;
