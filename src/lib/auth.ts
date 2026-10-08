import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';

/** user < uploader < admin: each role can do everything the one below it can. */
export const ROLES = ['user', 'uploader', 'admin'] as const;
export type Role = (typeof ROLES)[number];
const RANK: Record<Role, number> = { user: 0, uploader: 1, admin: 2 };
export const hasRole = (actual: Role, required: Role) => RANK[actual] >= RANK[required];

export type SessionUser = { id: number; name: string; email: string; role: Role };

const COOKIE = 'cq_session';
const SECRET = process.env.SESSION_SECRET ?? 'dev-only-session-secret-change-me';
const SESSION_DAYS = 7;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let ready = false;

/** Creates the users table and the three demo accounts on first use. */
export function ensureAuthTables() {
  if (ready) return;
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'uploader', 'admin')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const cols = d.prepare('PRAGMA table_info(notes)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'created_by')) {
    d.exec('ALTER TABLE notes ADD COLUMN created_by INTEGER REFERENCES users(id)');
  }
  const count = (d.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  if (count === 0) {
    const insert = d.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    insert.run('Admin', 'admin@msrit.edu', hashPassword('admin123'), 'admin');
    insert.run('Uploader', 'uploader@msrit.edu', hashPassword('uploader123'), 'uploader');
    insert.run('Student', 'student@msrit.edu', hashPassword('student123'), 'user');
  }
  ready = true;
}

const sign = (value: string) => createHmac('sha256', SECRET).update(value).digest('hex');

export async function startSession(userId: number) {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `${userId}.${expires}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expires),
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user, or null. Reads the role from the database so role changes apply at once. */
export async function currentUser(): Promise<SessionUser | null> {
  ensureAuthTables();
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, expires, sig] = raw.split('.');
  const payload = `${id}.${expires}`;
  const expected = sign(payload);
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(expires) < Date.now()) return null;
  const user = db().prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(Number(id));
  return (user as SessionUser | undefined) ?? null;
}

export function login(email: string, password: string): SessionUser | null {
  ensureAuthTables();
  const row = db()
    .prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as (SessionUser & { password_hash: string }) | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  const { password_hash: _, ...user } = row;
  return user;
}

export function register(name: string, email: string, password: string): SessionUser {
  ensureAuthTables();
  const result = db()
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name.trim(), email.trim().toLowerCase(), hashPassword(password));
  return { id: Number(result.lastInsertRowid), name: name.trim(), email: email.trim().toLowerCase(), role: 'user' };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Throws 401 when signed out and 403 when the role is too low. */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Please sign in first');
  if (!hasRole(user.role, role)) throw new HttpError(403, `This needs the ${role} role (you are ${user.role})`);
  return user;
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: 'Something went wrong' }, { status: 500 });
}
