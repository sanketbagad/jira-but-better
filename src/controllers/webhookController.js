import * as webhookService from '../services/webhookService.js';

export async function sendInviteEmail(req, res) {
  try {
    const { to, name, inviterName, projectName, role, tempPassword, loginUrl } = req.body;
    await webhookService.processInviteEmail({ to, name, inviterName, projectName, role, tempPassword, loginUrl });

    console.log(`[Job] Invite email sent to ${to}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Job] Failed to send invite email:', err.message);
    res.status(500).json({ error: err.message });
  }
}

export async function taskAssigned(req, res) {
  try {
    const { taskId, taskTitle, assigneeId, assignerId, projectId } = req.body;
    await webhookService.processTaskAssigned({ taskId, taskTitle, assigneeId, assignerId, projectId });

    console.log(`[Job] Task assignment notification sent for ${taskTitle}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Job] Failed to process task-assigned:', err.message);
    res.status(500).json({ error: err.message });
  }
}

export async function cleanupExpiredInvites(req, res) {
  try {
    const count = await webhookService.cleanupExpiredInvites();
    console.log(`[Job] Expired ${count} invites`);
    res.json({ success: true, expired: count });
  } catch (err) {
    console.error('[Job] Failed to cleanup invites:', err.message);
    res.status(500).json({ error: err.message });
  }
}

export async function dailyDigest(req, res) {
  try {
    const count = await webhookService.processDailyDigest();
    console.log(`[Job] Daily digest: ${count} users with overdue tasks`);
    res.json({ success: true, notified: count });
  } catch (err) {
    console.error('[Job] Failed daily digest:', err.message);
    res.status(500).json({ error: err.message });
  }
}
