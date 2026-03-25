import { query } from '../config/database.js';
import { cacheGetOrSet, cacheDel } from '../config/redis.js';

const GITHUB_API = 'https://api.github.com';

export async function githubFetch(path, token) {
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

export async function getConnection(projectId) {
  const { rows } = await query(
    'SELECT * FROM github_connections WHERE project_id = $1',
    [projectId]
  );
  return rows[0] || null;
}

export async function connectRepo(projectId, userId, { owner, repo, access_token }) {
  // Verify repo exists
  await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, access_token);

  const { rows } = await query(`
    INSERT INTO github_connections (project_id, owner, repo, access_token, connected_by)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (project_id) DO UPDATE SET
      owner = EXCLUDED.owner,
      repo = EXCLUDED.repo,
      access_token = EXCLUDED.access_token,
      connected_by = EXCLUDED.connected_by
    RETURNING id, project_id, owner, repo, created_at
  `, [projectId, owner, repo, access_token || null, userId]);

  await cacheDel(`github:${projectId}:*`);

  return rows[0];
}

export async function disconnectRepo(projectId) {
  await query('DELETE FROM github_connections WHERE project_id = $1', [projectId]);
  await cacheDel(`github:${projectId}:*`);
}

export async function getRepo(projectId) {
  const conn = await getConnection(projectId);
  if (!conn) return null;

  const cacheKey = `github:${projectId}:repo`;
  return cacheGetOrSet(cacheKey, () =>
    githubFetch(`/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}`, conn.access_token),
    120
  );
}

export async function getCommits(projectId) {
  const conn = await getConnection(projectId);
  if (!conn) return null;

  const cacheKey = `github:${projectId}:commits`;
  return cacheGetOrSet(cacheKey, () =>
    githubFetch(`/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}/commits?per_page=30`, conn.access_token),
    60
  );
}

export async function getBranches(projectId) {
  const conn = await getConnection(projectId);
  if (!conn) return null;

  const cacheKey = `github:${projectId}:branches`;
  return cacheGetOrSet(cacheKey, () =>
    githubFetch(`/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}/branches`, conn.access_token),
    120
  );
}

export async function getPulls(projectId) {
  const conn = await getConnection(projectId);
  if (!conn) return null;

  const cacheKey = `github:${projectId}:pulls`;
  return cacheGetOrSet(cacheKey, () =>
    githubFetch(`/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}/pulls?state=open`, conn.access_token),
    60
  );
}

export async function getFiles(projectId, filePath = '') {
  const conn = await getConnection(projectId);
  if (!conn) return null;

  const cacheKey = `github:${projectId}:files:${filePath}`;
  return cacheGetOrSet(cacheKey, () =>
    githubFetch(`/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}/contents/${filePath}`, conn.access_token),
    120
  );
}
