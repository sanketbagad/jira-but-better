import { query } from '../config/database.js';
import { cacheGetOrSet } from '../config/redis.js';

export async function checkProjectMembership(projectId, userId) {
  const { rows } = await query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
  return !!rows[0];
}

export async function getDashboardData(projectId) {
  // Run all independent queries in parallel
  const [statusResult, memberResult, overdueResult, sprintResult, activityResult, priorityResult] = await Promise.all([
    query('SELECT status, COUNT(*) AS count FROM tasks WHERE project_id = $1 GROUP BY status', [projectId]),
    query('SELECT COUNT(*) FROM project_members WHERE project_id = $1', [projectId]),
    query(`SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND due_date < CURRENT_DATE AND status != 'Done'`, [projectId]),
    query(`
      SELECT s.name, COUNT(t.id) AS total, COUNT(t.id) FILTER (WHERE t.status = 'Done') AS done
      FROM sprints s
      LEFT JOIN tasks t ON t.sprint_id = s.id
      WHERE s.project_id = $1 AND s.status IN ('active', 'planned')
      GROUP BY s.id, s.name, s.sort_order
      ORDER BY s.sort_order ASC
      LIMIT 5
    `, [projectId]),
    query(`
      SELECT al.*, u.name AS user_name, u.avatar AS user_avatar
      FROM activity_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.project_id = $1
      ORDER BY al.created_at DESC
      LIMIT 20
    `, [projectId]),
    query('SELECT priority, COUNT(*) AS count FROM tasks WHERE project_id = $1 GROUP BY priority', [projectId]),
  ]);

  const statMap = {};
  statusResult.rows.forEach(r => { statMap[r.status] = parseInt(r.count); });
  const totalTasks = Object.values(statMap).reduce((a, b) => a + b, 0);
  const doneTasks = statMap['Done'] || 0;
  const inProgress = statMap['In Progress'] || 0;
  const inReview = statMap['In Review'] || 0;

  const sprintProgress = sprintResult.rows.map(s => ({
    name: s.name,
    total: parseInt(s.total),
    done: parseInt(s.done),
    progress: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0,
  }));

  return {
    stats: {
      totalTasks,
      completedTasks: doneTasks,
      inProgressTasks: inProgress,
      inReviewTasks: inReview,
      teamMembers: parseInt(memberResult.rows[0].count),
      overdueTasks: parseInt(overdueResult.rows[0].count),
      completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    },
    statusBreakdown: statMap,
    priorityBreakdown: Object.fromEntries(priorityResult.rows.map(r => [r.priority, parseInt(r.count)])),
    sprintProgress,
    recentActivity: activityResult.rows,
  };
}

export async function getCachedDashboard(projectId) {
  const cacheKey = `dashboard:${projectId}`;
  return cacheGetOrSet(cacheKey, () => getDashboardData(projectId), 30);
}
