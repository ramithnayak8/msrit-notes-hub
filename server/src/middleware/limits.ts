import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { hashToken, verifyAccessToken } from '../auth/tokens.js';

/**
 * Rate limits sized for a college: most students reach the site from campus
 * Wi-Fi, where hundreds of people share one public IP. So limits count per
 * student wherever there is something better than an IP to count by (a valid
 * access token, a refresh session, the email being logged into), and the
 * per-IP limits that remain are campus-sized. Abuse from one IP is still
 * bounded, and password guessing is limited per account.
 */

const ip = (req: Request) => ipKeyGenerator(req.ip ?? '');

/** The signed-in student, if the request carries a valid access token. */
export function userKey(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return undefined;
  try {
    return `user:${verifyAccessToken(h.slice(7)).sub}`;
  } catch {
    return undefined;
  }
}

const common: Partial<Options> = { standardHeaders: 'draft-8', legacyHeaders: false };

/** Per student when signed in, per IP (campus-sized) otherwise. */
const perStudent = (windowMs: number, perUser: number, perIp: number) =>
  rateLimit({
    ...common,
    windowMs,
    keyGenerator: (req) => userKey(req) ?? `ip:${ip(req)}`,
    limit: (req) => (userKey(req) ? perUser : perIp),
  });

/** Search: a student searching hard is ~20 a minute; a campus behind one IP is many students. */
export const searchLimit = perStudent(60_000, 120, 1200);

/** The assistant: retrieval for everyone, a model call for signed-in students (also capped per day). */
export const assistantLimit = perStudent(60_000, 30, 600);

/** Password guessing: failed attempts per account being logged into, whatever IP they come from. */
export const loginPerAccount = rateLimit({
  ...common,
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${String(req.body?.email ?? '').toLowerCase().trim() || ip(req)}`,
});

/** Sign-up, login and resend-verification spam from one IP, sized for a campus. */
export const authPerIp = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 300, keyGenerator: (req) => `auth:${ip(req)}` });

/**
 * Refresh runs on every page load. Signed in, it counts per session (the
 * refresh cookie); signed out there is no cookie and the request is answered
 * without touching the database, so it isn't limited at all.
 */
export const refreshLimit = rateLimit({
  ...common,
  windowMs: 15 * 60_000,
  limit: 300,
  skip: (req) => !req.cookies?.cq_refresh,
  keyGenerator: (req) => `session:${hashToken(String(req.cookies.cq_refresh))}`,
});
