import * as inviteService from '../services/inviteService.js';

export async function list(req, res, next) {
  try {
    const invites = await inviteService.getInvites(req.params.projectId);
    res.json(invites);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const result = await inviteService.createInvite(
      req.params.projectId, req.user.id, req.user.name, req.body
    );

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.status(201).json(result.data);
  } catch (err) {
    next(err);
  }
}

export async function resend(req, res, next) {
  try {
    const result = await inviteService.resendInvite(
      req.params.projectId, req.params.inviteId, req.user.name
    );

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function revoke(req, res, next) {
  try {
    const result = await inviteService.revokeInvite(
      req.params.projectId, req.params.inviteId
    );

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function accept(req, res, next) {
  try {
    const result = await inviteService.acceptInvite(
      req.params.projectId, req.params.inviteId
    );

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
