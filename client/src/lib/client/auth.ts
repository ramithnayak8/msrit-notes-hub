import { useSyncExternalStore } from 'react';

/**
 * Sign-in state. The access token (15 minutes) lives only in memory, never in
 * localStorage, so a script injected into the page can't read it from
 * storage. The refresh token is an httpOnly cookie the browser sends to
 * /api/auth/refresh on its own; on page load and whenever the access token
 * expires we call that to get a new one.
 */
export type User = { id: string; name: string; email: string; role: 'user' | 'uploader' | 'moderator'; emailVerified: boolean };
type AuthState = { user: User | null; token: string | null; ready: boolean };

let state: AuthState = { user: null, token: null, ready: false };
const listeners = new Set<() => void>();
const set = (next: Partial<AuthState>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER_STATE: AuthState = { user: null, token: null, ready: false };

export const useAuth = () => useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);

const RANK = { user: 0, uploader: 1, moderator: 2 } as const;
export const canUpload = (u: User | null) => !!u && RANK[u.role] >= RANK.uploader;
export const isModerator = (u: User | null) => u?.role === 'moderator';

/** The API's error message, for showing to the user. */
async function errorMessage(res: Response) {
  const body = await res.json().catch(() => null);
  return (body?.error?.message as string) ?? `Request failed (${res.status})`;
}

let refreshing: Promise<boolean> | null = null;

/** Exchange the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!res.ok) {
        set({ user: null, token: null, ready: true });
        return false;
      }
      const data = await res.json();
      set({ user: data.user, token: data.accessToken, ready: true });
      return true;
    } catch {
      set({ ready: true });
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function login(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  const data = await res.json();
  set({ user: data.user, token: data.accessToken, ready: true });
  return data.user as User;
}

export async function register(name: string, email: string, password: string) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const field = body?.error?.details?.fieldErrors;
    const first = field && (Object.values(field).flat()[0] as string | undefined);
    throw new Error(first ?? body?.error?.message ?? 'Could not register');
  }
  return (await res.json()).message as string;
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  set({ user: null, token: null, ready: true });
}

/** fetch() with the access token; on 401 it refreshes once and retries. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const attempt = () => fetch(input, { ...init, headers: { ...init.headers, ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) } });
  let res = await attempt();
  if (res.status === 401 && (await refreshSession())) res = await attempt();
  return res;
}

export { errorMessage };
