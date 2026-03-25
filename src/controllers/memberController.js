import * as memberService from '../services/memberService.js';

export async function list(req, res, next) {
  try {
    const members = await memberService.getMembers(req.params.projectId);
    res.json(members);
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req, res, next) {
  try {
    const member = await memberService.updateMemberRole(
      req.params.projectId, req.params.memberId, req.body.role
    );

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json(member);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await memberService.removeMember(
      req.params.projectId, req.params.memberId
    );

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
