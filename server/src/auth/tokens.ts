import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from '../lib/errors.js';
import { RefreshTokenModel } from '../models/RefreshToken.js';
import type { Role } from '../models/User.js';

export const ACCESS_TTL = '15m';
export const REFRESH_TTL_DAYS = 7;

export type AccessClaims = { sub: string; role: Role };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Short-lived access token, sent as `Authorization: Bearer ...` and kept in
 * memory by the client. Stateless: the server checks the signature, no lookup.
 */
export function signAccessToken(userId: string, role: Role) {
  return jwt.sign({ role } satisfies Omit<AccessClaims, 'sub'>, config.JWT_ACCESS_SECRET, { subject: userId, expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const p = jwt.verify(token, config.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    return { sub: p.sub!, role: p.role as Role };
  } catch {
    throw unauthorized('Access token invalid or expired');
  }
}

/**
 * Long-lived refresh token, in an httpOnly cookie that page scripts can't
 * read. It's a signed JWT, and the database keeps only its SHA-256 hash, so a
 * database leak doesn't leak usable tokens.
 */
export async function issueRefreshToken(userId: string, family: string = randomUUID(), userAgent?: string) {
  const token = jwt.sign({ fam: family }, config.JWT_REFRESH_SECRET, { subject: userId, expiresIn: `${REFRESH_TTL_DAYS}d`, jwtid: randomUUID() });
  await RefreshTokenModel.create({
    userId,
    tokenHash: sha256(token),
    family,
    userAgent,
    expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
  });
  return token;
}

/**
 * Rotation: every refresh revokes the presented token and issues a new one.
 * If a token that was already rotated away shows up again, someone is
 * replaying a stolen copy (or the real user is, after the thief used it), so
 * the whole family is revoked and both have to log in again.
 */
export async function rotateRefreshToken(token: string, userAgent?: string): Promise<{ userId: string; token: string }> {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  } catch {
    throw unauthorized('Refresh token invalid or expired');
  }
  const row = await RefreshTokenModel.findOne({ tokenHash: sha256(token) });
  if (!row) throw unauthorized('Refresh token not recognised');
  if (row.revokedAt) {
    await RefreshTokenModel.updateMany({ family: row.family, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    throw unauthorized('Refresh token reuse detected; please sign in again');
  }
  const next = await issueRefreshToken(String(row.userId), row.family, userAgent);
  row.revokedAt = new Date();
  row.replacedBy = sha256(next);
  await row.save();
  return { userId: payload.sub!, token: next };
}

export async function revokeRefreshToken(token: string) {
  await RefreshTokenModel.updateOne({ tokenHash: sha256(token), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
}

/** One-time token for email links. The user gets the raw value; we store its hash. */
export function newVerificationToken() {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: sha256(raw), expires: new Date(Date.now() + 24 * 3_600_000) };
}

export const hashToken = sha256;
