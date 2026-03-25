import { supabase } from './supabase.js';

const channels = new Map();

function getOrCreateChannel(room) {
  if (channels.has(room)) return channels.get(room);

  if (!supabase) return null;

  const channel = supabase.channel(room);
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channels.set(room, channel);
    }
  });
  channels.set(room, channel);
  return channel;
}

/**
 * Emit a realtime event to everyone in a project room.
 */
export function emitToProject(projectId, event, data) {
  const channel = getOrCreateChannel(`project:${projectId}`);
  if (!channel) return;
  channel.send({ type: 'broadcast', event, payload: data });
}

/**
 * Emit a realtime event to a specific user.
 */
export function emitToUser(userId, event, data) {
  const channel = getOrCreateChannel(`user:${userId}`);
  if (!channel) return;
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
}
