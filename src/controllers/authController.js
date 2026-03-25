import * as authService from '../services/authService.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);

    if (!result) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.cookie('token', result.token, COOKIE_OPTIONS);
    res.json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function register(req, res, next) {
  try {
    const result = await authService.registerUser(req.body);
    res.cookie('token', result.token, COOKIE_OPTIONS);
    res.status(201).json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export function me(req, res) {
  res.json({ user: req.user });
}

export async function logout(req, res, next) {
  try {
    await authService.logoutUser(req.user.id);
    res.clearCookie('token', { path: '/' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const changed = await authService.changePassword(req.user.id, currentPassword, newPassword);

    if (!changed) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
