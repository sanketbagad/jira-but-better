import * as channelService from '../services/channelService.js';
import * as messageService from '../services/messageService.js';

// Channel Controllers
export async function listChannels(req, res, next) {
  try {
    const channels = await channelService.getChannels(
      req.params.projectId,
      req.user.id,
      req.query
    );
    res.json(channels);
  } catch (err) {
    next(err);
  }
}

export async function getChannel(req, res, next) {
  try {
    const channel = await channelService.getChannelById(req.params.channelId, req.user.id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json(channel);
  } catch (err) {
    next(err);
  }
}

export async function createChannel(req, res, next) {
  try {
    const channel = await channelService.createChannel(
      req.params.projectId,
      req.user.id,
      req.body
    );
    res.status(201).json(channel);
  } catch (err) {
    next(err);
  }
}

export async function getOrCreateDirect(req, res, next) {
  try {
    const channel = await channelService.getOrCreateDirectChannel(
      req.params.projectId,
      req.user.id,
      req.params.userId
    );
    res.json(channel);
  } catch (err) {
    next(err);
  }
}

export async function updateChannel(req, res, next) {
  try {
    const channel = await channelService.updateChannel(
      req.params.channelId,
      req.user.id,
      req.body
    );
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json(channel);
  } catch (err) {
    next(err);
  }
}

export async function deleteChannel(req, res, next) {
  try {
    const result = await channelService.deleteChannel(req.params.channelId);
    if (!result) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getChannelMembers(req, res, next) {
  try {
    const members = await channelService.getChannelMembers(req.params.channelId);
    res.json(members);
  } catch (err) {
    next(err);
  }
}

export async function addChannelMember(req, res, next) {
  try {
    const member = await channelService.addChannelMember(
      req.params.channelId,
      req.body.userId,
      req.body.role
    );
    res.json(member);
  } catch (err) {
    next(err);
  }
}

export async function removeChannelMember(req, res, next) {
  try {
    await channelService.removeChannelMember(req.params.channelId, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    await channelService.markChannelAsRead(req.params.channelId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function toggleMute(req, res, next) {
  try {
    const result = await channelService.toggleChannelMute(req.params.channelId, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Message Controllers
export async function listMessages(req, res, next) {
  try {
    const messages = await messageService.getMessages(req.params.channelId, req.query);
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const message = await messageService.sendMessage(
      req.params.channelId,
      req.user.id,
      req.body
    );
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

export async function updateMessage(req, res, next) {
  try {
    const message = await messageService.updateMessage(
      req.params.messageId,
      req.user.id,
      req.body.content
    );
    if (!message) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }
    res.json(message);
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const message = await messageService.deleteMessage(req.params.messageId, req.user.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function addReaction(req, res, next) {
  try {
    const reaction = await messageService.addReaction(
      req.params.messageId,
      req.user.id,
      req.body.emoji
    );
    res.json(reaction);
  } catch (err) {
    next(err);
  }
}

export async function removeReaction(req, res, next) {
  try {
    await messageService.removeReaction(req.params.messageId, req.user.id, req.params.emoji);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function searchMessages(req, res, next) {
  try {
    const messages = await messageService.searchMessages(
      req.params.projectId,
      req.query.q,
      req.query
    );
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCounts(req, res, next) {
  try {
    const counts = await messageService.getUnreadCounts(req.params.projectId, req.user.id);
    res.json(counts);
  } catch (err) {
    next(err);
  }
}
