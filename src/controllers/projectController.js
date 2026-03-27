import * as projectService from '../services/projectService.js';
import { paginationParams } from '../utils/pagination.js';

export async function list(req, res, next) {
  try {
    const { page, limit, offset } = paginationParams(req.query);
    const search = req.query.search || '';

    const result = await projectService.getProjects(req.user.id, { page, limit, offset, search });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const project = await projectService.getProjectById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const organizationId = req.user.organization_id || null;
    const project = await projectService.createProject(req.user.id, req.body, organizationId);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const project = await projectService.updateProject(
      req.params.projectId, req.user.id, req.body
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await projectService.deleteProject(
      req.params.projectId, req.user.id, req.projectRole
    );

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
