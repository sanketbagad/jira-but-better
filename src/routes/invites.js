import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, transaction } from '../config/database.js';
import { authenticate, requireProjectMember, requireProjectAdmin } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { generateTempPassword, generateInviteToken } from '../utils/tokens.js';
import { enqueueJob } from '../config/qstash.js';
import { logActivity } from '../services/activity.js';
import { emitToProject } from '../config/socket.js';

const router = Router();

router.use(authenticate);

// GET /api/projects/:projectId/invites
router.get('/:projectId/invites', requireProjectMember, async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT i.*, u.name AS invited_by_name
      FROM invites i
      JOIN users u ON u.id = i.invited_by
      WHERE i.project_id = $1
      ORDER BY i.created_at DESC
    `, [req.params.projectId]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/invites
router.post('/:projectId/invites', requireProjectMember, requireProjectAdmin, validate(schemas.createInvite), async (req, res, next) => {
  try {
    const { name, email, role } = req.body;
    const projectId = req.params.projectId;

    // Check if already a member
    const { rows: existing } = await query(`
      SELECT 1 FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1 AND u.email = $2
    `, [projectId, email]);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'User is already a member of this project' });
    }

    // Check for existing pending invite
    const { rows: existingInvite } = await query(
      `SELECT id FROM invites WHERE project_id = $1 AND email = $2 AND status = 'pending'`,
      [projectId, email]
    );

    if (existingInvite.length > 0) {
      return res.status(409).json({ error: 'A pending invite already exists for this email' });
    }

    const tempPassword = generateTempPassword();
    const token = generateInviteToken();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 12);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await transaction(async (client) => {
      const { rows } = await client.query(`
        INSERT INTO invites (project_id, invited_by, name, email, role, temp_password, token, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [projectId, req.user.id, name, email, role, tempPasswordHash, token, expiresAt]);

      // Pre-create user account if doesn't exist
      const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      await client.query(`
        INSERT INTO users (name, email, password_hash, role, avatar)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO NOTHING
      `, [name, email, tempPasswordHash, role, avatar]);

      return rows[0];
    });

    // Get project name for email
    const { rows: projRows } = await query('SELECT name FROM projects WHERE id = $1', [projectId]);

    // Enqueue email via QStash
    await enqueueJob('send-invite-email', {
      inviteId: invite.id,
      to: email,
      name,
      inviterName: req.user.name,
      projectName: projRows[0]?.name || 'Project',
      role,
      tempPassword,
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
    });

    await logActivity({
      projectId,
      userId: req.user.id,
      action: 'invited',
      entityType: 'invite',
      entityId: invite.id,
      entityTitle: name,
    });

    emitToProject(projectId, 'invite:created', invite);

    res.status(201).json(invite);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/invites/:inviteId/resend
router.post('/:projectId/invites/:inviteId/resend', requireProjectMember, requireProjectAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM invites WHERE id = $1 AND project_id = $2',
      [req.params.inviteId, req.params.projectId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    const invite = rows[0];
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Can only resend pending invites' });
    }

    // Generate new temp password
    const tempPassword = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 12);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      'UPDATE invites SET temp_password = $1, expires_at = $2 WHERE id = $3',
      [tempPasswordHash, expiresAt, invite.id]
    );

    const { rows: projRows } = await query('SELECT name FROM projects WHERE id = $1', [req.params.projectId]);

    await enqueueJob('send-invite-email', {
      inviteId: invite.id,
      to: invite.email,
      name: invite.name,
      inviterName: req.user.name,
      projectName: projRows[0]?.name || 'Project',
      role: invite.role,
      tempPassword,
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:projectId/invites/:inviteId (revoke)
router.delete('/:projectId/invites/:inviteId', requireProjectMember, requireProjectAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE invites SET status = 'revoked' WHERE id = $1 AND project_id = $2 AND status = 'pending' RETURNING *`,
      [req.params.inviteId, req.params.projectId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Pending invite not found' });
    }

    emitToProject(req.params.projectId, 'invite:revoked', { id: req.params.inviteId });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/invites/:inviteId/accept (called when invited user logs in)
router.post('/:projectId/invites/:inviteId/accept', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM invites WHERE id = $1 AND status = 'pending' AND expires_at > NOW()`,
      [req.params.inviteId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    const invite = rows[0];

    await transaction(async (client) => {
      // Add user as project member
      const { rows: userRows } = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [invite.email]
      );

      if (userRows[0]) {
        await client.query(`
          INSERT INTO project_members (project_id, user_id, role)
          VALUES ($1, $2, $3)
          ON CONFLICT (project_id, user_id) DO NOTHING
        `, [invite.project_id, userRows[0].id, invite.role]);
      }

      // Mark invite accepted
      await client.query(
        `UPDATE invites SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
        [invite.id]
      );
    });

    emitToProject(invite.project_id, 'invite:accepted', { id: invite.id, name: invite.name });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
