import { supabase } from './supabase.js';

const channels = new Map();
const subscribed = new Map(); // tracks subscription promises

function getOrCreateChannel(room) {
  if (channels.has(room)) return { channel: channels.get(room), ready: subscribed.get(room) };

  if (!supabase) return { channel: null, ready: Promise.resolve() };

  const channel = supabase.channel(room);
  const ready = new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        resolve();
      }
    });
  });
  channels.set(room, channel);
  subscribed.set(room, ready);
  return { channel, ready };
}

/**
 * Emit a realtime event to everyone in a project room.
 * Waits for channel to be subscribed before sending to avoid REST fallback.
 */
export async function emitToProject(projectId, event, data) {
  const { channel, ready } = getOrCreateChannel(`project:${projectId}`);
  if (!channel) return;
  await ready;
  channel.send({ type: 'broadcast', event, payload: data });
}

/**
 * Emit a realtime event to a specific user.
 */
export async function emitToUser(userId, event, data) {
  const { channel, ready } = getOrCreateChannel(`user:${userId}`);
  if (!channel) return;
  await ready;
  channel.send({ type: 'broadcast', event, payload: data });
}

/**
 * Clean up all active channels on shutdown.
 */
export async function cleanupChannels() {
  if (!supabase) return;
  for (const channel of channels.values()) {
    supabase.removeChannel(channel);
  }
  channels.clear();
  subscribed.clear();
}
