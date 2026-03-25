import crypto from 'crypto';

/**
 * Generate a random temporary password (10 alphanumeric chars).
 */
export function generateTempPassword() {
  return crypto.randomBytes(5).toString('hex');
}

/**
 * Generate a cryptographically random token for invite links.
 */
export function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}
