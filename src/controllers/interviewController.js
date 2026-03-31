import * as interviewService from '../services/interviewService.js';
import { supabase } from '../config/supabase.js';
import { sendInterviewInvite } from '../services/email.js';

// Helper to emit to global HR channel (all connected clients)
function emitToAll(event, data) {
  if (!supabase) return;
  const channel = supabase.channel('global:hr');
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({ type: 'broadcast', event, payload: data });
    }
  });
}

// ============== INTERVIEWS ==============

export async function getInterviews(req, res, next) {
  try {
    const interviews = await interviewService.getInterviews(req.query);
    res.json(interviews);
  } catch (err) {
    next(err);
  }
}

export async function getInterview(req, res, next) {
  try {
    const interview = await interviewService.getInterviewById(req.params.id);
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    res.json(interview);
  } catch (err) {
    next(err);
  }
}

export async function createInterview(req, res, next) {
  try {
    const interview = await interviewService.createInterview(req.user.id, req.body);

    emitToAll('hr:interview:created', interview);

    res.status(201).json(interview);
  } catch (err) {
    next(err);
  }
}

export async function updateInterview(req, res, next) {
  try {
    const { id } = req.params;
    const interview = await interviewService.updateInterview(id, req.user.id, req.body);

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    emitToAll('hr:interview:updated', interview);

    res.json(interview);
  } catch (err) {
    next(err);
  }
}

export async function deleteInterview(req, res, next) {
  try {
    const { id } = req.params;
    await interviewService.deleteInterview(id);

    emitToAll('hr:interview:deleted', { id });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function sendInterviewInviteEmail(req, res, next) {
  try {
    const { id } = req.params;
    const interview = await interviewService.getInterviewById(id);

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    if (!interview.candidate_email) {
      return res.status(400).json({ error: 'Candidate email is required to send the invite' });
    }

    await sendInterviewInvite(interview);

    // Update status to confirmed after sending invite
    const updated = await interviewService.updateInterview(id, req.user.id, { status: 'confirmed' });

    emitToAll('hr:interview:updated', updated);

    res.json({ message: 'Interview invite sent successfully', sent_to: interview.candidate_email });
  } catch (err) {
    next(err);
  }
}

export async function getInterviewers(req, res, next) {
  try {
    const interviewers = await interviewService.getInterviewers();
    res.json(interviewers);
  } catch (err) {
    next(err);
  }
}
