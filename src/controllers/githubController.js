import * as githubService from '../services/githubService.js';
import * as aiCodeService from '../services/aiCodeService.js';

export async function connect(req, res, next) {
  try {
    const result = await githubService.connectRepo(req.params.projectId, req.user.id, req.body);
    res.json(result);
  } catch (err) {
    if (err.status === 404 || err.status === 403) {
      return res.status(400).json({ error: 'Repository not found or inaccessible' });
    }
    next(err);
  }
}

export async function getConnection(req, res, next) {
  try {
    const conn = await githubService.getConnection(req.params.projectId);
    if (!conn) return res.status(404).json({ error: 'No GitHub repo connected' });
    res.json(conn);
  } catch (err) {
    next(err);
  }
}

export async function disconnect(req, res, next) {
  try {
    await githubService.disconnectRepo(req.params.projectId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getRepo(req, res, next) {
  try {
    const data = await githubService.getRepo(req.params.projectId);
    if (!data) return res.status(404).json({ error: 'No GitHub repo connected' });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getCommits(req, res, next) {
  try {
    const data = await githubService.getCommits(req.params.projectId);
    if (!data) return res.status(404).json({ error: 'No GitHub repo connected' });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getBranches(req, res, next) {
  try {
    const data = await githubService.getBranches(req.params.projectId);
    if (!data) return res.status(404).json({ error: 'No GitHub repo connected' });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getPulls(req, res, next) {
  try {
    const data = await githubService.getPulls(req.params.projectId);
    if (!data) return res.status(404).json({ error: 'No GitHub repo connected' });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getFiles(req, res, next) {
  try {
    const data = await githubService.getFiles(req.params.projectId, req.query.path || '');
    if (!data) return res.status(404).json({ error: 'No GitHub repo connected' });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function chatWithCode(req, res, next) {
  try {
    const result = await aiCodeService.chatWithCode(req.params.projectId, req.body);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

export async function getCodeImprovements(req, res, next) {
  try {
    const result = await aiCodeService.getCodeImprovements(req.params.projectId, req.body);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

export async function explainCode(req, res, next) {
  try {
    const result = await aiCodeService.explainCode(req.params.projectId, req.body);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}
