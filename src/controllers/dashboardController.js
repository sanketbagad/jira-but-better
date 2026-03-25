import * as dashboardService from '../services/dashboardService.js';

export async function getDashboard(req, res, next) {
  try {
    const projectId = req.query.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId query parameter is required' });
    }

    const isMember = await dashboardService.checkProjectMembership(projectId, req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const dashboard = await dashboardService.getCachedDashboard(projectId);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
}
