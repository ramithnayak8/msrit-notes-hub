/**
 * The one place pages and API routes get data from.
 *
 * With BACKEND_URL set, every call goes to the team backend over REST (the
 * endpoints are specified in docs/BACKEND_CONTRACT.md). Without it, the same
 * functions read the bundled SQLite database, so the site still runs on its
 * own for development and demos.
 *
 * Server-only: browsers keep calling this app's /api/* routes, which call
 * these functions, so the backend URL never reaches the client and there is
 * no CORS to configure.
 */
import * as local from './db';
import { searchQuestions as localSearch } from './search';
import { answerQuestion as localAnswer, type ChatReply } from './chat';
import type {
  Course,
  CourseWithStats,
  Department,
  DepartmentWithStats,
  ExternalPaper,
  Note,
  Paper,
  Question,
  SearchResponse,
  SyllabusDiff,
  SyllabusUnit,
  SyllabusVersion,
} from './types';

const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/+$/, '') || null;
const TIMEOUT_MS = Number(process.env.BACKEND_TIMEOUT_MS) || 8000;

export const dataSource = BACKEND_URL ? { mode: 'backend' as const, url: BACKEND_URL } : { mode: 'local' as const, url: null };

export class BackendError extends Error {
  constructor(
    public status: number,
    public path: string,
    detail?: string
  ) {
    super(`Backend ${status} for ${path}${detail ? `: ${detail}` : ''}`);
  }
}

async function request<T>(path: string, init: RequestInit = {}, allow404 = false): Promise<T | undefined> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new BackendError(503, path, err instanceof Error ? err.message : 'unreachable');
  }
  if (allow404 && res.status === 404) return undefined;
  if (!res.ok) throw new BackendError(res.status, path, await res.text().catch(() => ''));
  return (await res.json()) as T;
}

const get = <T>(path: string) => request<T>(path) as Promise<T>;
const find = <T>(path: string) => request<T>(path, {}, true);
const enc = encodeURIComponent;

/** Picks the backend call when BACKEND_URL is set, the local one otherwise. */
const pick = <A extends unknown[], R>(remote: (...a: A) => Promise<R>, offline: (...a: A) => R | Promise<R>) =>
  (...args: A): Promise<R> => (BACKEND_URL ? remote(...args) : Promise.resolve(offline(...args)));

// ── Branches and courses ─────────────────────────────────────

export const getDepartments = pick(() => get<DepartmentWithStats[]>('/departments'), local.getDepartments);
export const getDepartment = pick((code: string) => find<Department>(`/departments/${enc(code)}`), local.getDepartment);
export const getCoursesByDept = pick(
  (code: string) => get<CourseWithStats[]>(`/departments/${enc(code)}/courses`),
  local.getCoursesByDept
);
export const getAllCourses = pick(() => get<Course[]>('/courses'), local.getAllCourses);
export const getCourse = pick((code: string) => find<Course>(`/courses/${enc(code)}`), local.getCourse);
export const getPapersByCourse = pick((code: string) => get<Paper[]>(`/courses/${enc(code)}/papers`), local.getPapersByCourse);
export const getQuestionsByCourse = pick(
  (code: string) => get<Question[]>(`/courses/${enc(code)}/questions`),
  local.getQuestionsByCourse
);
export const getNotesByCourse = pick((code: string) => get<Note[]>(`/courses/${enc(code)}/notes`), local.getNotesByCourse);

// ── Stats ────────────────────────────────────────────────────

export type Stats = ReturnType<typeof local.getStats>;
export const getStats = pick(() => get<Stats>('/stats'), local.getStats);
export const getYearRange = pick(() => get<{ min: number; max: number }>('/stats/years'), local.getYearRange);

// ── Syllabus ─────────────────────────────────────────────────

export const getSyllabusCourses = pick(
  () => get<{ code: string; title: string; versions: number }[]>('/syllabus/courses'),
  local.getSyllabusCourses
);
export const getSyllabusVersions = pick(
  (code: string) => get<SyllabusVersion[]>(`/courses/${enc(code)}/syllabus`),
  local.getSyllabusVersions
);
export const getSyllabusUnits = pick(
  (versionId: number) => get<SyllabusUnit[]>(`/syllabus/versions/${versionId}/units`),
  local.getSyllabusUnits
);
export const diffSyllabus = pick(
  async (code: string) => (await find<SyllabusDiff>(`/courses/${enc(code)}/syllabus/diff`)) ?? null,
  local.diffSyllabus
);

// ── Search and assistant ─────────────────────────────────────

export const searchQuestions = pick(
  (q: string, limit = 20) => get<SearchResponse>(`/search?q=${enc(q)}&limit=${limit}`),
  localSearch
);
export const answerQuestion = pick(
  (question: string) => request<ChatReply>('/chat', { method: 'POST', body: JSON.stringify({ question }) }) as Promise<ChatReply>,
  localAnswer
);

// ── Past papers library ──────────────────────────────────────

export type PaperLibrary = ReturnType<typeof local.getPaperLibrary>;

export const getPaperLibrary = pick((f: local.LibraryFilters) => {
  const qs = new URLSearchParams();
  if (f.q) qs.set('q', f.q);
  if (f.year) qs.set('year', String(f.year));
  if (f.dept) qs.set('dept', f.dept);
  if (f.exam?.length) qs.set('exam', f.exam.join(','));
  if (f.page) qs.set('page', String(f.page));
  return get<PaperLibrary>(`/library?${qs}`);
}, local.getPaperLibrary);
export const getLibraryStats = pick(
  () => get<{ papers: number; subjects: number; sources: number }>('/library/stats'),
  local.getLibraryStats
);
export const getLibraryByYear = pick(
  () => get<{ year: number; papers: number; subjects: number; top: string[] }[]>('/library/years'),
  local.getLibraryByYear
);
export const getLibrarySubjects = pick(
  () => get<{ subject: string; papers: number }[]>('/library/subjects'),
  local.getLibrarySubjects
);
export const getLibraryForCourses = pick(
  (codes: string[]) =>
    codes.length
      ? get<{ code: string; title: string; papers: number }[]>(`/library/courses?codes=${codes.map(enc).join(',')}`)
      : Promise.resolve([]),
  local.getLibraryForCourses
);
export const getExternalPapersByCourse = pick(
  (code: string) => get<ExternalPaper[]>(`/courses/${enc(code)}/library`),
  local.getExternalPapersByCourse
);

// ── Health ───────────────────────────────────────────────────

/** For /api/health: which source is live, and whether the backend answers. */
export async function checkSource(): Promise<{ mode: 'backend' | 'local'; url: string | null; ok: boolean; ms: number; error?: string }> {
  const started = Date.now();
  if (!BACKEND_URL) return { ...dataSource, ok: true, ms: 0 };
  try {
    await get('/health');
    return { ...dataSource, ok: true, ms: Date.now() - started };
  } catch (err) {
    return { ...dataSource, ok: false, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
  }
}
