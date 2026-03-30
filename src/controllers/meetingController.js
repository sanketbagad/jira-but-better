import * as meetingService from '../services/meetingService.js';
import * as presenceService from '../services/presenceService.js';

// Meeting Controllers
export async function listMeetings(req, res, next) {
  try {
    const meetings = await meetingService.getMeetings(req.params.projectId, req.query);
    res.json(meetings);
  } catch (err) {
    next(err);
  }
}

export async function getMeeting(req, res, next) {
  try {
    const meeting = await meetingService.getMeetingById(req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function createMeeting(req, res, next) {
  try {
    const meeting = await meetingService.createMeeting(
      req.params.projectId,
      req.user.id,
      req.body
    );
    res.status(201).json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function updateMeeting(req, res, next) {
  try {
    const meeting = await meetingService.updateMeeting(
      req.params.meetingId,
      req.user.id,
      req.body
    );
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or unauthorized' });
    }
    res.json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function cancelMeeting(req, res, next) {
  try {
    const meeting = await meetingService.cancelMeeting(req.params.meetingId, req.user.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or unauthorized' });
    }
    res.json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function deleteMeeting(req, res, next) {
  try {
    const result = await meetingService.deleteMeeting(req.params.meetingId, req.user.id);
    if (!result) {
      return res.status(404).json({ error: 'Meeting not found or unauthorized' });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function respondToMeeting(req, res, next) {
  try {
    const response = await meetingService.respondToMeeting(
      req.params.meetingId,
      req.user.id,
      req.body.status
    );
    if (!response) {
      return res.status(404).json({ error: 'Meeting participation not found' });
    }
    res.json(response);
  } catch (err) {
    next(err);
  }
}

export async function joinMeeting(req, res, next) {
  try {
    const meeting = await meetingService.joinMeeting(req.params.meetingId, req.user.id);
    res.json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function quickCall(req, res, next) {
  try {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: 'channelId is required' });
    }
    const meeting = await meetingService.findOrCreateQuickMeeting(
      req.params.projectId,
      channelId,
      req.user.id
    );
    res.json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function leaveMeeting(req, res, next) {
  try {
    await meetingService.leaveMeeting(req.params.meetingId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getUserMeetings(req, res, next) {
  try {
    const meetings = await meetingService.getUserUpcomingMeetings(req.user.id, req.query.limit);
    res.json(meetings);
  } catch (err) {
    next(err);
  }
}

// Presence Controllers
export async function updatePresence(req, res, next) {
  try {
    const presence = await presenceService.updatePresence(
      req.user.id,
      req.body.status,
      req.body.customStatus
    );
    res.json(presence);
  } catch (err) {
    next(err);
  }
}

export async function getOnlineUsers(req, res, next) {
  try {
    const users = await presenceService.getProjectOnlineUsers(req.params.projectId);
    res.json(users);
  } catch (err) {
    next(err);
  }
}
