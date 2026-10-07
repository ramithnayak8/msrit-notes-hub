import argon2 from 'argon2';
import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { sendVerificationEmail } from '../auth/mail.js';
import { REFRESH_TTL_DAYS, hashToken, issueRefreshToken, newVerificationToken, revokeRefreshToken, rotateRefreshToken, signAccessToken } from '../auth/tokens.js';
import { config, isProd } from '../config.js';
import { HttpError, badRequest, conflict, notFound, unauthorized } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { UserModel, publicUser } from '../models/User.js';

export const authRouter = Router();

// Slow down password guessing and sign-up spam.
authRouter.use(rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));

const COOKIE = 'cq_refresh';
const cookieOptions = {
  httpOnly: true, // page scripts can't read it, so an XSS bug can't steal it
  secure: isProd, // HTTPS only in production
  sameSite: 'lax' as const, // not sent on cross-site POSTs (CSRF)
  path: '/api/auth', // only sent to the endpoints that need it
  maxAge: REFRESH_TTL_DAYS * 86_400_000,
};

const apiBase = () => config.API_PUBLIC_URL ?? `http://localhost:${config.PORT}`;

const email = z
  .email()
  .transform((e) => e.toLowerCase().trim())
  .refine((e) => e.endsWith(`@${config.ALLOWED_EMAIL_DOMAIN}`), `Use your @${config.ALLOWED_EMAIL_DOMAIN} email address`);

const registerBody = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

async function startVerification(user: InstanceType<typeof UserModel>) {
  const t = newVerificationToken();
  user.verifyTokenHash = t.hash;
  user.verifyExpires = t.expires;
  await user.save();
  await sendVerificationEmail(user.email, user.name, `${apiBase()}/api/auth/verify-email?token=${t.raw}`);
}

authRouter.post('/register', async (req, res) => {
  const body = registerBody.parse(req.body);
  if (await UserModel.exists({ email: body.email })) throw conflict('An account with this email already exists');
  // argon2id: memory-hard, so guessing passwords on GPUs is expensive. The salt is stored inside the hash.
  const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
  const user = await UserModel.create({ name: body.name, email: body.email, passwordHash });
  await startVerification(user);
  res.status(201).json({ user: publicUser(user), message: 'Check your email for a verification link' });
});

authRouter.get('/verify-email', async (req, res) => {
  const token = z.string().min(10).parse(req.query.token);
  const user = await UserModel.findOne({ verifyTokenHash: hashToken(token), verifyExpires: { $gt: new Date() } });
  if (!user) throw badRequest('This verification link is invalid or has expired');
  user.emailVerified = true;
  user.verifyTokenHash = undefined;
  user.verifyExpires = undefined;
  await user.save();
  if (req.accepts(['html', 'json']) === 'html') res.redirect(`${config.CLIENT_ORIGIN}/?verified=1`);
  else res.json({ ok: true });
});

authRouter.post('/resend-verification', async (req, res) => {
  const { email: address } = z.object({ email: z.email() }).parse(req.body);
  const user = await UserModel.findOne({ email: address.toLowerCase() });
  // Same answer whether or not the account exists, so this can't be used to discover emails.
  if (user && !user.emailVerified) await startVerification(user);
  res.json({ message: 'If that account exists and is unverified, a new link has been sent' });
});

function sendSession(res: Response, user: InstanceType<typeof UserModel>, refreshToken: string) {
  res.cookie(COOKIE, refreshToken, cookieOptions);
  res.json({ accessToken: signAccessToken(user.id, user.role), user: publicUser(user) });
}

authRouter.post('/login', async (req, res) => {
  const body = z.object({ email: z.email(), password: z.string().min(1) }).parse(req.body);
  const user = await UserModel.findOne({ email: body.email.toLowerCase() }).select('+passwordHash');
  // Same message for unknown email and wrong password.
  if (!user || !(await argon2.verify(user.passwordHash, body.password))) throw unauthorized('Email or password is incorrect');
  if (!user.emailVerified) throw new HttpError(403, 'Verify your email before signing in', 'email_not_verified');
  sendSession(res, user, await issueRefreshToken(user.id, undefined, req.get('user-agent')));
});

authRouter.post('/refresh', async (req: Request, res) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw unauthorized('No refresh token');
  try {
    const { userId, token: next } = await rotateRefreshToken(token, req.get('user-agent'));
    const user = await UserModel.findById(userId);
    if (!user) throw notFound('User');
    sendSession(res, user, next);
  } catch (err) {
    res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
    throw err;
  }
});

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) await revokeRefreshToken(token);
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw notFound('User');
  res.json({ user: publicUser(user) });
});
