import { Router } from 'express';
import { Receiver } from '@upstash/qstash';
import { webhookLimiter } from '../middleware/rateLimit.js';
import * as webhookController from '../controllers/webhookController.js';

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
  if (!receiver) return next();

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

router.post('/qstash/send-invite-email', webhookLimiter, verifyQStash, webhookController.sendInviteEmail);
router.post('/qstash/task-assigned', webhookLimiter, verifyQStash, webhookController.taskAssigned);
router.post('/qstash/cleanup-expired-invites', webhookLimiter, verifyQStash, webhookController.cleanupExpiredInvites);
router.post('/qstash/daily-digest', webhookLimiter, verifyQStash, webhookController.dailyDigest);

export default router;
