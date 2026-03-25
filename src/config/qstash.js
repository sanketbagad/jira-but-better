import { Client } from '@upstash/qstash';

const hasQStashConfig = process.env.QSTASH_TOKEN;

export const qstash = hasQStashConfig
  ? new Client({ token: process.env.QSTASH_TOKEN })
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
    console.error(`[QStash] Failed to enqueue ${jobType}:`, err.message);
    throw err;
  }
}
