import { Router } from 'express';
import { query, transaction } from '../config/database.js';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { cacheGetOrSet, cacheDel } from '../config/redis.js';

const router = Router();

router.use(authenticate);

const GITHUB_API = 'https://api.github.com';

async function githubFetch(path, token) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ToDoApp-Server',
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }
  const response = await fetch(`${GITHUB_API}${path}`, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw Object.assign(new Error(`GitHub API error: ${response.status}`), { status: response.status, body });
  }
  return response.json();
}

// POST /api/github/connect/:projectId
router.post('/connect/:projectId', requireProjectMember, validate(schemas.connectGitHub), async (req, res, next) => {
  try {
    const { owner, repo, access_token } = req.body;
    const projectId = req.params.projectId;

    // Verify repo exists
    try {
      await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, access_token);
    } catch {
      return res.status(400).json({ error: 'Repository not found or inaccessible' });
    }

    const { rows } = await query(`
      INSERT INTO github_connections (project_id, owner, repo, access_token, connected_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (project_id) DO UPDATE SET
        owner = EXCLUDED.owner,
        repo = EXCLUDED.repo,
        access_token = EXCLUDED.access_token,
        connected_by = EXCLUDED.connected_by
      RETURNING id, project_id, owner, repo, created_at
    `, [projectId, owner, repo, access_token || null, req.user.id]);

    await cacheDel(`github:${projectId}:*`);

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/github/disconnect/:projectId
router.delete('/disconnect/:projectId', requireProjectMember, async (req, res, next) => {
  try {
    await query('DELETE FROM github_connections WHERE project_id = $1', [req.params.projectId]);
    await cacheDel(`github:${req.params.projectId}:*`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/github/:projectId/repo
router.get('/:projectId/repo', requireProjectMember, async (req, res, next) => {
  try {
    const conn = await getConnection(req.params.projectId);
    if (!conn) return res.status(404).json({ error: 'No GitHub repo connected' });

    const cacheKey = `github:${req.params.projectId}:repo`;
    const data = await cacheGetOrSet(cacheKey, async () => {
      return githubFetch(`/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}`, conn.access_token);
    }, 120);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/github/:projectId/commits
router.get('/:projectId/commits', requireProjectMember, async (req, res, next) => {
  try {
    const conn = await getConnection(req.params.projectId);
    if (!conn) return res.status(404).json({ error: 'No GitHub repo connected' });

    const cacheKey = `github:${req.params.projectId}:commits`;
    const data = await cacheGetOrSet(cacheKey, async () => {
      return githubFetch(
        `/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}/commits?per_page=30`,
        conn.access_token
      );
    }, 60);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/github/:projectId/branches
router.get('/:projectId/branches', requireProjectMember, async (req, res, next) => {
  try {
    const conn = await getConnection(req.params.projectId);
    if (!conn) return res.status(404).json({ error: 'No GitHub repo connected' });

    const cacheKey = `github:${req.params.projectId}:branches`;
    const data = await cacheGetOrSet(cacheKey, async () => {
      return githubFetch(
        `/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}/branches`,
        conn.access_token
      );
    }, 120);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/github/:projectId/pulls
router.get('/:projectId/pulls', requireProjectMember, async (req, res, next) => {
  try {
    const conn = await getConnection(req.params.projectId);
    if (!conn) return res.status(404).json({ error: 'No GitHub repo connected' });

    const cacheKey = `github:${req.params.projectId}:pulls`;
    const data = await cacheGetOrSet(cacheKey, async () => {
      return githubFetch(
        `/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}/pulls?state=open`,
        conn.access_token
      );
    }, 60);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/github/:projectId/files?path=
router.get('/:projectId/files', requireProjectMember, async (req, res, next) => {
  try {
    const conn = await getConnection(req.params.projectId);
    if (!conn) return res.status(404).json({ error: 'No GitHub repo connected' });

    const filePath = req.query.path || '';
    const cacheKey = `github:${req.params.projectId}:files:${filePath}`;
    const data = await cacheGetOrSet(cacheKey, async () => {
      return githubFetch(
        `/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}/contents/${filePath}`,
        conn.access_token
      );
    }, 120);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

async function getConnection(projectId) {
  const { rows } = await query(
    'SELECT * FROM github_connections WHERE project_id = $1',
    [projectId]
  );
  return rows[0] || null;
}

export default router;
