import { authFetch, errorMessage } from './auth';

/** Moderator-only API calls for the dashboard. Errors carry the server's message, ready to show. */
export async function adminJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(`/api${path}`, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body !== undefined && { body: JSON.stringify(body) }) });

export type Summary = {
  documents: Record<string, number>;
  questions: number;
  topics: Record<string, number>;
  openReviews: Record<string, number>;
  users: { byRole: Record<string, number>; unverified: number };
  assistant: { usedToday: number; dailyLimit: number };
  storage: { usedBytes: number; limitBytes: number };
};

export type AdminUser = { id: string; name: string; email: string; role: 'user' | 'uploader' | 'moderator'; emailVerified: boolean; createdAt: string };

export type ReviewItem = {
  _id: string;
  type: 'segment' | 'ocr' | 'topic' | 'metadata';
  reason: string;
  documentId?: { _id: string; title: string; courseCode?: string; year?: number } | null;
  questionId?: { _id: string; label: string; text: string; marks?: number } | null;
  createdAt: string;
};

export type Topic = { name: string; label: string; status: 'approved' | 'proposed'; source?: string; courseCodes: string[]; questionCount: number };

export type Paper = {
  _id: string;
  title: string;
  courseCode?: string;
  courseTitle?: string;
  year?: number;
  examType?: string;
  status: 'queued' | 'processing' | 'ready' | 'needs_review' | 'failed';
  questionCount: number;
  error?: string;
  fileStored?: boolean;
  sourceUrl?: string;
  createdAt: string;
};
