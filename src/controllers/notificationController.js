import * as notificationService from '../services/notificationService.js';
import * as projectInvitationService from '../services/projectInvitationService.js';

/**
 * Get all notifications for the current user
 */
export async function list(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await notificationService.getNotifications(req.user.id, { page, limit, unreadOnly });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(req, res, next) {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

/**
 * Mark a notification as read
 */
export async function markRead(req, res, next) {
  try {
    const notification = await notificationService.markAsRead(req.params.notificationId, req.user.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(notification);
  } catch (err) {
    next(err);
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllRead(req, res, next) {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a notification
 */
export async function remove(req, res, next) {
  try {
    await notificationService.deleteNotification(req.params.notificationId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Clear all notifications
 */
export async function clearAll(req, res, next) {
  try {
    await notificationService.clearAllNotifications(req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Get pending project invitations for the current user
 */
export async function getPendingInvitations(req, res, next) {
  try {
    const invitations = await projectInvitationService.getUserPendingInvitations(req.user.id);
    res.json(invitations);
  } catch (err) {
    next(err);
  }
}

/**
 * Accept a project invitation
 */
export async function acceptInvitation(req, res, next) {
  try {
    const result = await projectInvitationService.acceptInvitation(
      req.params.invitationId,
      req.user.id
    );

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Decline a project invitation
 */
export async function declineInvitation(req, res, next) {
  try {
    const result = await projectInvitationService.declineInvitation(
      req.params.invitationId,
      req.user.id
    );

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}
