import { query } from '../config/database.js';
import { logActivity } from './activity.js';
import { emitToProject } from '../config/socket.js';

export async function getFlowcharts(projectId) {
  const { rows } = await query(`
    SELECT f.*, u.name AS author_name, u.avatar AS author_avatar
    FROM flowcharts f
    JOIN users u ON u.id = f.author_id
    WHERE f.project_id = $1
    ORDER BY f.updated_at DESC
  `, [projectId]);

  return rows;
}

export async function getFlowchartById(projectId, flowchartId) {
  const { rows } = await query(`
    SELECT f.*, u.name AS author_name, u.avatar AS author_avatar
    FROM flowcharts f
    JOIN users u ON u.id = f.author_id
    WHERE f.id = $1 AND f.project_id = $2
  `, [flowchartId, projectId]);

  return rows[0] || null;
}

export async function createFlowchart(projectId, userId, { title, description, nodes, connections }) {
  const { rows } = await query(`
    INSERT INTO flowcharts (project_id, title, description, author_id, nodes, connections)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    projectId, title, description, userId,
    JSON.stringify(nodes), JSON.stringify(connections),
  ]);

  const flowchart = rows[0];

  emitToProject(projectId, 'flowchart:created', flowchart);

  await logActivity({
    projectId,
    userId,
    action: 'created',
    entityType: 'flowchart',
    entityId: flowchart.id,
    entityTitle: flowchart.title,
  });

  return flowchart;
}

export async function updateFlowchart(projectId, flowchartId, fields) {
  if (fields.nodes) fields.nodes = JSON.stringify(fields.nodes);
  if (fields.connections) fields.connections = JSON.stringify(fields.connections);

  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${i}`);
    values.push(value);
    i++;
  }

  values.push(flowchartId, projectId);
  const { rows } = await query(
    `UPDATE flowcharts SET ${setClauses.join(', ')} WHERE id = $${i} AND project_id = $${i + 1} RETURNING *`,
    values
  );

  if (!rows[0]) return null;

  emitToProject(projectId, 'flowchart:updated', rows[0]);

  return rows[0];
}

export async function deleteFlowchart(projectId, flowchartId, userId) {
  const { rows } = await query(
    'DELETE FROM flowcharts WHERE id = $1 AND project_id = $2 RETURNING id, title',
    [flowchartId, projectId]
  );

  if (!rows[0]) return null;

  emitToProject(projectId, 'flowchart:deleted', { id: rows[0].id });

  await logActivity({
    projectId,
    userId,
    action: 'deleted',
    entityType: 'flowchart',
    entityId: rows[0].id,
    entityTitle: rows[0].title,
  });

  return rows[0];
}
