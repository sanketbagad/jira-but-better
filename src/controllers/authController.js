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

    // Email not verified
    if (result.unverified) {
      return res.status(403).json({ error: 'Please verify your email before logging in.', unverified: true, email: result.email });
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

    // Don't set cookie — user must verify email first
    res.status(201).json({
      needsVerification: true,
      email: result.email,
      message: 'Account created! Please check your email to verify your account.',
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const result = await authService.verifyEmailToken(token);
    if (result.error) {
      return res.status(400).json({ error: result.error, alreadyVerified: result.alreadyVerified || false });
    }

    // Auto-login after verification
    res.cookie('token', result.token, COOKIE_OPTIONS);
    res.json({ user: result.user, message: 'Email verified successfully!' });
  } catch (err) {
    next(err);
  }
}

export async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await authService.resendVerificationEmail(email);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'Verification email sent! Please check your inbox.' });
  } catch (err) {
    next(err);
  }
}

export function me(req, res) {
  const u = req.user;
  res.json({
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      onboarding_completed: u.onboarding_completed ?? false,
      organization_id: u.organization_id || null,
      org_role: u.org_role || null,
      org_name: u.org_name || null,
      org_slug: u.org_slug || null,
      org_domain: u.org_domain || null,
      designation: u.designation || null,
      employee_code: u.employee_code || null,
      department_id: u.department_id || null,
      department_name: u.department_name || null,
      reports_to: u.reports_to || null,
      employment_type: u.employment_type || null,
      employee_status: u.employee_status || null,
      phone: u.phone || null,
      bio: u.bio || null,
    },
  });
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
