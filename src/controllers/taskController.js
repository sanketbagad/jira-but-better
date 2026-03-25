import * as taskService from '../services/taskService.js';
import { paginationParams } from '../utils/pagination.js';

export async function list(req, res, next) {
  try {
    const { page, limit, offset } = paginationParams(req.query);
    const { status, priority, type, assignee_id, sprint_id, search } = req.query;
    const filters = { status, priority, type, assignee_id, sprint_id, search };

    const result = await taskService.getTasks(req.params.projectId, filters, { page, limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const task = await taskService.getTaskById(req.params.projectId, req.params.taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const task = await taskService.createTask(req.params.projectId, req.user.id, req.body);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const task = await taskService.updateTask(
      req.params.projectId, req.params.taskId, req.user.id, req.body
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await taskService.deleteTask(
      req.params.projectId, req.params.taskId, req.user.id
    );

    if (!result) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
