import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { generateToken, authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { cacheSet, cacheDel } from '../config/redis.js';

const router = Router();

// POST /api/auth/login
router.post('/login', authLimiter, validate(schemas.login), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await query(
      'SELECT id, name, email, password_hash, role, avatar, is_active FROM users WHERE email = $1',
      [email]
    );

    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = generateToken(user);

    // Cache user session
    await cacheSet(`session:${user.id}`, { id: user.id, role: user.role }, 86400);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register
router.post('/register', authLimiter, validate(schemas.register), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const hash = await bcrypt.hash(password, 12);
    const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role, avatar)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, avatar`,
      [name, email, hash, role, avatar]
    );

    const user = rows[0];
    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await cacheDel(`session:${req.user.id}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/password
router.patch('/password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
