import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../auth/tokens.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { hasRole, type Role } from '../models/User.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

function bearer(req: Request) {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined;
}

/** Attach the user if a valid token is present; never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  if (token) {
    try {
      const c = verifyAccessToken(token);
      req.user = { id: c.sub, role: c.role };
    } catch {
      /* treated as anonymous */
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) throw unauthorized();
  const c = verifyAccessToken(token);
  req.user = { id: c.sub, role: c.role };
  next();
}

/** Role check; moderators pass uploader checks too. Use after requireAuth. */
export const requireRole = (role: Role) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) throw unauthorized();
  if (!hasRole(req.user.role, role)) throw forbidden(`Requires the ${role} role`);
  next();
};
