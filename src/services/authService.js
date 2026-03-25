import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { cacheSet, cacheDel } from '../config/redis.js';
import { generateToken } from '../middleware/auth.js';

export async function findUserByEmail(email) {
  const { rows } = await query(
    'SELECT id, name, email, password_hash, role, avatar, is_active FROM users WHERE email = $1',
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

  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const token = generateToken(user);
  await cacheSet(`session:${user.id}`, { id: user.id, role: user.role }, 86400);

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
  };
}

export async function registerUser({ name, email, password, role }) {
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
  return { token, user };
}

export async function logoutUser(userId) {
  await cacheDel(`session:${userId}`);
}

export async function changePassword(userId, currentPassword, newPassword) {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) return false;

  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
  return true;
}
