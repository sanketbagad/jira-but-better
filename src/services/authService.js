import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, transaction } from '../config/database.js';
import { cacheSet, cacheDel } from '../config/redis.js';
import { generateToken } from '../middleware/auth.js';
import { sendVerificationEmail } from './email.js';

export async function findUserByEmail(email) {
  const { rows } = await query(
    'SELECT id, name, email, password_hash, role, avatar, is_active, onboarding_completed, email_verified FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

export async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

export async function loginUser(email, password) {
  const user = await findUserByEmail(email);
  if (!user || !user.is_active) return null;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  // Block login if email not verified
  if (!user.email_verified) {
    return { unverified: true, email: user.email };
  }

  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  // Fetch org info
  const { rows: orgRows } = await query(
    `SELECT om.organization_id, om.role AS org_role, o.name AS org_name, o.slug AS org_slug
     FROM organization_members om
     JOIN organizations o ON o.id = om.organization_id
     WHERE om.user_id = $1
     LIMIT 1`,
    [user.id]
  );
  const orgInfo = orgRows[0] || {};

  const token = generateToken(user);
  await cacheSet(`session:${user.id}`, { id: user.id, role: user.role }, 86400);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      onboarding_completed: user.onboarding_completed,
      organization_id: orgInfo.organization_id || null,
      org_role: orgInfo.org_role || null,
      org_name: orgInfo.org_name || null,
      org_slug: orgInfo.org_slug || null,
    },
  };
}

export async function registerUser({ name, email, password, role, org_name, org_domain, org_industry, org_size }) {
  const hash = await bcrypt.hash(password, 12);
  const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Generate email verification token (valid 24 hours)
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const result = await transaction(async (client) => {
    // Create user with verification token
    const { rows: userRows } = await client.query(
      `INSERT INTO users (name, email, password_hash, role, avatar, onboarding_completed, email_verified, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8)
       RETURNING id, name, email, role, avatar, onboarding_completed`,
      [name, email, hash, role, avatar, !!org_name, verificationToken, verificationExpires]
    );
    const user = userRows[0];

    let orgInfo = {};

    // If org_name provided, create organization + set user as owner
    if (org_name) {
      // Generate unique slug
      const baseSlug = org_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 100);
      let slug = baseSlug;
      let suffix = 0;
      while (true) {
        const { rows: existing } = await client.query('SELECT 1 FROM organizations WHERE slug = $1', [slug]);
        if (existing.length === 0) break;
        suffix++;
        slug = `${baseSlug}-${suffix}`;
      }

      const { rows: orgRows } = await client.query(
        `INSERT INTO organizations (name, slug, domain, industry, size, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [org_name, slug, org_domain || null, org_industry || null, org_size || null, user.id]
      );
      const org = orgRows[0];

      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [org.id, user.id]
      );

      orgInfo = {
        organization_id: org.id,
        org_role: 'owner',
        org_name: org.name,
        org_slug: org.slug,
      };
    }

    return { user, orgInfo };
  });

  // Send verification email (don't block on failure)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${frontendUrl}/auth/verify-email?token=${verificationToken}`;
  sendVerificationEmail({ to: email, name, verifyUrl }).catch(err =>
    console.error('[Auth] Failed to send verification email:', err.message)
  );

  return {
    needsVerification: true,
    email,
    user: {
      ...result.user,
      ...result.orgInfo,
    },
  };
}

/**
 * Verify user email with token.
 */
export async function verifyEmailToken(token) {
  const { rows } = await query(
    `SELECT id, name, email, role, avatar, onboarding_completed,
            email_verification_token, email_verification_expires, email_verified
     FROM users WHERE email_verification_token = $1`,
    [token]
  );
  const user = rows[0];
  if (!user) return { error: 'Invalid verification link' };
  if (user.email_verified) return { error: 'Email already verified', alreadyVerified: true };
  if (new Date() > new Date(user.email_verification_expires)) {
    return { error: 'Verification link has expired. Please request a new one.' };
  }

  await query(
    `UPDATE users SET email_verified = TRUE, email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1`,
    [user.id]
  );

  // Fetch org info for login
  const { rows: orgRows } = await query(
    `SELECT om.organization_id, om.role AS org_role, o.name AS org_name, o.slug AS org_slug
     FROM organization_members om
     JOIN organizations o ON o.id = om.organization_id
     WHERE om.user_id = $1 LIMIT 1`,
    [user.id]
  );
  const orgInfo = orgRows[0] || {};

  const jwtToken = generateToken(user);
  await cacheSet(`session:${user.id}`, { id: user.id, role: user.role }, 86400);

  return {
    token: jwtToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      onboarding_completed: user.onboarding_completed,
      organization_id: orgInfo.organization_id || null,
      org_role: orgInfo.org_role || null,
      org_name: orgInfo.org_name || null,
      org_slug: orgInfo.org_slug || null,
    },
  };
}

/**
 * Resend verification email.
 */
export async function resendVerificationEmail(email) {
  const user = await findUserByEmail(email);
  if (!user) return { error: 'User not found' };
  if (user.email_verified) return { error: 'Email already verified' };

  const newToken = crypto.randomBytes(32).toString('hex');
  const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await query(
    `UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3`,
    [newToken, newExpires, user.id]
  );

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${frontendUrl}/auth/verify-email?token=${newToken}`;
  await sendVerificationEmail({ to: email, name: user.name, verifyUrl });

  return { sent: true };
}

export async function logoutUser(userId) {
  await cacheDel(`session:${userId}`);
  await cacheDel(`user:${userId}`);
}

export async function changePassword(userId, currentPassword, newPassword) {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) return false;

  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
  return true;
}
