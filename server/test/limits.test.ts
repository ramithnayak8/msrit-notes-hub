import type { AddressInfo } from 'node:net';
import cookieParser from 'cookie-parser';
import express, { type RequestHandler } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signAccessToken } from '../src/auth/tokens.js';
import { assistantLimit, loginPerAccount, refreshLimit, searchLimit, userKey } from '../src/middleware/limits.js';

// The real limiters on a throwaway server: every request comes from 127.0.0.1, like a campus behind one IP.
let base = '';
let close = () => {};
beforeAll(async () => {
  const app = express();
  app.use(express.json(), cookieParser());
  const ok: RequestHandler = (_req, res) => void res.json({ ok: true });
  app.get('/search', searchLimit, ok);
  app.post('/assistant', assistantLimit, ok);
  app.post('/refresh', refreshLimit, ok);
  app.post('/login', loginPerAccount, (req, res) => void res.status(req.body.password === 'right' ? 200 : 401).end());
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

const hit = async (n: number, path: string, init: RequestInit = {}) => {
  const codes: number[] = [];
  for (let i = 0; i < n; i++) codes.push((await fetch(base + path, init)).status);
  return codes;
};
const count = (codes: number[], code: number) => codes.filter((c) => c === code).length;
const bearer = (id: string) => ({ Authorization: `Bearer ${signAccessToken(id, 'user')}` });
const json = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('rate limits for a campus behind one IP', () => {
  it('lets one IP search far more than one student may', async () => {
    expect(count(await hit(200, '/search'), 200)).toBe(200);
  });

  it('counts signed-in students separately, each with their own allowance', async () => {
    const a = await hit(125, '/search', { headers: bearer('aaaaaaaaaaaaaaaaaaaaaaaa') });
    expect(count(a, 200)).toBe(120);
    expect(count(a, 429)).toBe(5);
    // Another student on the same IP is unaffected by the first one's limit.
    expect(count(await hit(10, '/search', { headers: bearer('bbbbbbbbbbbbbbbbbbbbbbbb') }), 200)).toBe(10);
  });

  it('limits the assistant per student', async () => {
    const codes = await hit(32, '/assistant', { method: 'POST', headers: bearer('cccccccccccccccccccccccc') });
    expect(count(codes, 429)).toBe(2);
  });

  it('never limits refresh calls from signed-out visitors, and limits a session on its own', async () => {
    expect(count(await hit(400, '/refresh', { method: 'POST' }), 200)).toBe(400);
    const s = await hit(302, '/refresh', { method: 'POST', headers: { Cookie: 'cq_refresh=session-one' } });
    expect(count(s, 429)).toBe(2);
    expect((await fetch(base + '/refresh', { method: 'POST', headers: { Cookie: 'cq_refresh=session-two' } })).status).toBe(200);
  });

  it('stops password guessing per account but not successful sign-ins or other accounts', async () => {
    const wrong = await hit(12, '/login', json({ email: 'victim@msrit.edu', password: 'wrong' }));
    expect(count(wrong, 429)).toBe(2);
    expect((await fetch(base + '/login', json({ email: 'VICTIM@msrit.edu ', password: 'right' }))).status).toBe(429);
    expect(count(await hit(15, '/login', json({ email: 'other@msrit.edu', password: 'right' })), 200)).toBe(15);
  });
});

describe('userKey', () => {
  it('reads a valid token and ignores missing or bad ones', () => {
    const req = (authorization?: string) => ({ headers: { authorization } }) as never;
    expect(userKey(req(`Bearer ${signAccessToken('dddddddddddddddddddddddd', 'user')}`))).toBe('user:dddddddddddddddddddddddd');
    expect(userKey(req())).toBeUndefined();
    expect(userKey(req('Bearer nope'))).toBeUndefined();
  });
});
