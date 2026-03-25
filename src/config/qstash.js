import { Client } from '@upstash/qstash';

const hasQStashConfig = process.env.QSTASH_TOKEN;

export const qstash = hasQStashConfig
  ? new Client({
      token: process.env.QSTASH_TOKEN,
      ...(process.env.QSTASH_URL && { baseUrl: process.env.QSTASH_URL }),
    })
  : createNoopQStash();

function createNoopQStash() {
  return {
    publishJSON: async (opts) => {
      console.log('[QStash NoOp] Would publish:', opts.url || opts.topic);
      return { messageId: 'noop-' + Date.now() };
    },
  };
}

const CALLBACK_BASE = process.env.QSTASH_CALLBACK_URL || 'http://localhost:3001/api/webhooks/qstash';

/**
 * Schedule a background job via QStash.
 * If QStash publish fails (e.g. loopback in dev), falls back to running the job directly.
 * @param {string} jobType - e.g. 'send-invite-email', 'daily-digest', 'cleanup-expired-invites'
 * @param {object} payload - data for the job
 * @param {object} [options] - { delay (seconds), cron, retries }
 */
export async function enqueueJob(jobType, payload, options = {}) {
  const url = `${CALLBACK_BASE}/${jobType}`;
  const publishOpts = {
    url,
    body: payload,
    retries: options.retries ?? 3,
  };

  if (options.delay) {
    publishOpts.delay = options.delay;
  }
  if (options.cron) {
    publishOpts.cron = options.cron;
  }

  try {
    const result = await qstash.publishJSON(publishOpts);
    console.log(`[QStash] Enqueued ${jobType}: ${result.messageId}`);
    return result;
  } catch (err) {
    console.warn(`[QStash] Publish failed for ${jobType}: ${err.message} — running locally`);
    return runJobLocally(jobType, payload);
  }
}

/**
 * Fallback: execute the job handler directly when QStash can't deliver (e.g. loopback).
 */
async function runJobLocally(jobType, payload) {
  try {
    const webhookService = await import('../services/webhookService.js');

    const handlers = {
      'send-invite-email': () => webhookService.processInviteEmail(payload),
      'task-assigned': () => webhookService.processTaskAssigned(payload),
      'cleanup-expired-invites': () => webhookService.cleanupExpiredInvites(),
      'daily-digest': () => webhookService.processDailyDigest(),
    };

    const handler = handlers[jobType];
    if (!handler) {
      console.warn(`[QStash Fallback] No handler for job type: ${jobType}`);
      return { messageId: 'fallback-noop-' + Date.now() };
    }

    // Run async so the caller doesn't block
    handler().then(() => {
      console.log(`[QStash Fallback] Completed ${jobType}`);
    }).catch((err) => {
      console.error(`[QStash Fallback] Failed ${jobType}:`, err.message);
    });

    return { messageId: 'fallback-' + Date.now() };
  } catch (err) {
    console.error(`[QStash Fallback] Error loading handler for ${jobType}:`, err.message);
    return { messageId: 'fallback-error-' + Date.now() };
  }
}
