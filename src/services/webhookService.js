import { query } from '../config/database.js';
import { sendInviteEmail, sendTaskAssignmentEmail } from './email.js';
import { emitToUser } from '../config/socket.js';

export async function processInviteEmail({ to, name, inviterName, projectName, role, tempPassword, loginUrl }) {
  await sendInviteEmail({ to, name, inviterName, projectName, role, tempPassword, loginUrl });
}

export async function processTaskAssigned({ taskId, taskTitle, assigneeId, assignerId, projectId }) {
  const [assigneeResult, assignerResult, projResult] = await Promise.all([
    query('SELECT name, email FROM users WHERE id = $1', [assigneeId]),
    query('SELECT name FROM users WHERE id = $1', [assignerId]),
    query('SELECT name FROM projects WHERE id = $1', [projectId]),
  ]);

  const assignee = assigneeResult.rows[0];
  const assigner = assignerResult.rows[0];
  const project = projResult.rows[0];

  if (assignee && assigner) {
    await sendTaskAssignmentEmail({
      to: assignee.email,
      assigneeName: assignee.name,
      taskTitle,
      projectName: project?.name || 'Project',
      assignerName: assigner.name,
    });

    emitToUser(assigneeId, 'notification:task-assigned', {
      taskId,
      taskTitle,
      assignerName: assigner.name,
      projectName: project?.name,
    });
  }
}

export async function cleanupExpiredInvites() {
  const { rows } = await query(`
    UPDATE invites SET status = 'expired'
    WHERE status = 'pending' AND expires_at < NOW()
    RETURNING id
  `);
  return rows.length;
}

export async function processDailyDigest() {
  const { rows: overdue } = await query(`
    SELECT u.id, u.name, u.email, COUNT(*) AS overdue_count
    FROM tasks t
    JOIN users u ON u.id = t.assignee_id
    WHERE t.due_date < CURRENT_DATE AND t.status != 'Done'
    GROUP BY u.id, u.name, u.email
  `);

  for (const user of overdue) {
    emitToUser(user.id, 'notification:daily-digest', {
      overdueCount: parseInt(user.overdue_count),
    });
  }

  return overdue.length;
}
