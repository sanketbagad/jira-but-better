import { Router } from 'express';
import { Receiver } from '@upstash/qstash';
import { query } from '../config/database.js';
import { sendInviteEmail, sendTaskAssignmentEmail } from '../services/email.js';
import { emitToUser } from '../config/socket.js';
import { webhookLimiter } from '../middleware/rateLimit.js';

const router = Router();

// QStash signature verification (skip in dev if keys not set)
let receiver;
if (process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY) {
  receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  });
}

async function verifyQStash(req, res, next) {
  if (!receiver) return next(); // Skip in dev

  const signature = req.headers['upstash-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing QStash signature' });
  }

  try {
    await receiver.verify({ signature, body: JSON.stringify(req.body) });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid QStash signature' });
  }
}

// POST /api/webhooks/qstash/send-invite-email
router.post('/qstash/send-invite-email', webhookLimiter, verifyQStash, async (req, res) => {
  try {
    const { to, name, inviterName, projectName, role, tempPassword, loginUrl } = req.body;

    await sendInviteEmail({
      to,
      name,
      inviterName,
      projectName,
      role,
      tempPassword,
      loginUrl,
    });

    console.log(`[Job] Invite email sent to ${to}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Job] Failed to send invite email:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhooks/qstash/task-assigned
router.post('/qstash/task-assigned', webhookLimiter, verifyQStash, async (req, res) => {
  try {
    const { taskId, taskTitle, assigneeId, assignerId, projectId } = req.body;

    // Get user details
    const { rows: assigneeRows } = await query(
      'SELECT name, email FROM users WHERE id = $1',
      [assigneeId]
    );
    const { rows: assignerRows } = await query(
      'SELECT name FROM users WHERE id = $1',
      [assignerId]
    );
    const { rows: projRows } = await query(
      'SELECT name FROM projects WHERE id = $1',
      [projectId]
    );

    if (assigneeRows[0] && assignerRows[0]) {
      // Send email notification
      await sendTaskAssignmentEmail({
        to: assigneeRows[0].email,
        assigneeName: assigneeRows[0].name,
        taskTitle,
        projectName: projRows[0]?.name || 'Project',
        assignerName: assignerRows[0].name,
      });

      // Realtime notification
      emitToUser(assigneeId, 'notification:task-assigned', {
        taskId,
        taskTitle,
        assignerName: assignerRows[0].name,
        projectName: projRows[0]?.name,
      });
    }

    console.log(`[Job] Task assignment notification sent for ${taskTitle}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Job] Failed to process task-assigned:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhooks/qstash/cleanup-expired-invites
router.post('/qstash/cleanup-expired-invites', webhookLimiter, verifyQStash, async (req, res) => {
  try {
    const { rows } = await query(`
      UPDATE invites SET status = 'expired'
      WHERE status = 'pending' AND expires_at < NOW()
      RETURNING id
    `);

    console.log(`[Job] Expired ${rows.length} invites`);
    res.json({ success: true, expired: rows.length });
  } catch (err) {
    console.error('[Job] Failed to cleanup invites:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhooks/qstash/daily-digest
router.post('/qstash/daily-digest', webhookLimiter, verifyQStash, async (req, res) => {
  try {
    // Get all active users with overdue tasks
    const { rows: overdue } = await query(`
      SELECT u.id, u.name, u.email, COUNT(*) AS overdue_count
      FROM tasks t
      JOIN users u ON u.id = t.assignee_id
      WHERE t.due_date < CURRENT_DATE AND t.status != 'Done'
      GROUP BY u.id, u.name, u.email
    `);

    for (const user of overdue) {
      emitToUser(user.id, 'notification:daily-digest', {
        overdueCount: parseInt(user.overdue_count),
      });
    }

    console.log(`[Job] Daily digest: ${overdue.length} users with overdue tasks`);
    res.json({ success: true, notified: overdue.length });
  } catch (err) {
    console.error('[Job] Failed daily digest:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
