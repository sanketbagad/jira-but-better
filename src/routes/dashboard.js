import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate, requireProjectMember } from '../middleware/auth.js';
import { cacheGetOrSet } from '../config/redis.js';

const router = Router();

router.use(authenticate);

// GET /api/dashboard?projectId=xxx
router.get('/', async (req, res, next) => {
  try {
    const projectId = req.query.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId query parameter is required' });
    }

    // Verify membership
    const { rows: memberCheck } = await query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );
    if (!memberCheck[0]) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const cacheKey = `dashboard:${projectId}`;

    const dashboard = await cacheGetOrSet(cacheKey, async () => {
      // Task counts by status
      const { rows: statusCounts } = await query(`
        SELECT status, COUNT(*) AS count
        FROM tasks WHERE project_id = $1
        GROUP BY status
      `, [projectId]);

      const statMap = {};
      statusCounts.forEach(r => { statMap[r.status] = parseInt(r.count); });

      const totalTasks = Object.values(statMap).reduce((a, b) => a + b, 0);
      const doneTasks = statMap['Done'] || 0;
      const inProgress = statMap['In Progress'] || 0;
      const inReview = statMap['In Review'] || 0;

      // Member count
      const { rows: memberCount } = await query(
        'SELECT COUNT(*) FROM project_members WHERE project_id = $1',
        [projectId]
      );

      // Overdue tasks
      const { rows: overdue } = await query(
        `SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND due_date < CURRENT_DATE AND status != 'Done'`,
        [projectId]
      );

      // Sprint progress
      const { rows: sprints } = await query(`
        SELECT s.name,
          (SELECT COUNT(*) FROM tasks WHERE sprint_id = s.id) AS total,
          (SELECT COUNT(*) FROM tasks WHERE sprint_id = s.id AND status = 'Done') AS done
        FROM sprints s
        WHERE s.project_id = $1 AND s.status IN ('active', 'planned')
        ORDER BY s.sort_order ASC
        LIMIT 5
      `, [projectId]);

      const sprintProgress = sprints.map(s => ({
        name: s.name,
        total: parseInt(s.total),
        done: parseInt(s.done),
        progress: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0,
      }));

      // Recent activity
      const { rows: activity } = await query(`
        SELECT al.*, u.name AS user_name, u.avatar AS user_avatar
        FROM activity_log al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.project_id = $1
        ORDER BY al.created_at DESC
        LIMIT 20
      `, [projectId]);

      // Task priority distribution
      const { rows: priorityCounts } = await query(`
        SELECT priority, COUNT(*) AS count
        FROM tasks WHERE project_id = $1
        GROUP BY priority
      `, [projectId]);

      return {
        stats: {
          totalTasks,
          completedTasks: doneTasks,
          inProgressTasks: inProgress,
          inReviewTasks: inReview,
          teamMembers: parseInt(memberCount[0].count),
          overdueTasks: parseInt(overdue[0].count),
          completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        },
        statusBreakdown: statMap,
        priorityBreakdown: Object.fromEntries(priorityCounts.map(r => [r.priority, parseInt(r.count)])),
        sprintProgress,
        recentActivity: activity,
      };
    }, 30); // Cache for 30 seconds

    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

export default router;
