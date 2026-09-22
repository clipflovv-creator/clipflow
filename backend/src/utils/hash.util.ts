import crypto from 'crypto';

/**
 * Generates a cryptographically secure random hex string.
 * @param bytes Number of random bytes (default 32 -> 64 hex chars)
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generates a cryptographically secure numeric OTP.
 * crypto.randomInt is used instead of Math.random() because OTPs are security-sensitive.
 * @param length Number of digits (default 6)
 */
export function generateNumericOTP(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length);
  return crypto.randomInt(min, max).toString();
}

/**
 * Produces a SHA-256 hash of a string (used for session IDs, email verification tokens, reset tokens).
 */
export function hashToken(token: string): string {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(bufA, bufB);
}
