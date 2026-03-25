import * as sprintService from '../services/sprintService.js';

export async function list(req, res, next) {
  try {
    const result = await sprintService.getSprints(req.params.projectId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const sprint = await sprintService.createSprint(req.params.projectId, req.body);
    res.status(201).json(sprint);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const sprint = await sprintService.updateSprint(
      req.params.projectId, req.params.sprintId, req.body
    );

    if (!sprint) {
      return res.status(404).json({ error: 'Sprint not found' });
    }

    res.json(sprint);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await sprintService.deleteSprint(
      req.params.projectId, req.params.sprintId
    );

    if (!result) {
      return res.status(404).json({ error: 'Sprint not found' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
