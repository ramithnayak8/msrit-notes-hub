/**
 * The Express API (server/), as used by this site. Server components call it
 * directly; browser code calls /api/..., which next.config.mjs forwards.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** GET from a server component. Always fresh: the archive changes as papers are ingested. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.message ?? `API ${res.status}`, body?.error?.code);
  }
  return res.json() as Promise<T>;
}

/** Like apiGet, but a 404 becomes null. */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Link to the original uploaded file, opened at a page when the browser's PDF viewer supports it. */
export const paperFileUrl = (documentId: string, page?: number | null) => `/api/documents/${documentId}/file${page ? `#page=${page}` : ''}`;

// ── Response shapes ────────────────────────────────────────────────────────

export type TopicRef = { name: string; label: string };

export type SearchHit = {
  id: string;
  label: string;
  text: string;
  kind: string;
  marks?: number;
  co?: string;
  bloom?: string;
  unit?: number;
  topics: TopicRef[];
  course: { code?: string; title?: string };
  branch?: string;
  semester?: number;
  year?: number;
  examType?: string;
  page?: number;
  source: { documentId: string; title: string; month?: string };
  recurrence: { count: number; years: number[] };
  score: number;
  ranks: { vector?: number; keyword?: number };
};

export type SearchResponse = {
  query: { raw: string; text: string; filters: Record<string, unknown>; understood: string[] };
  mode: 'hybrid' | 'vector' | 'keyword';
  total: number;
  hits: SearchHit[];
  tookMs: number;
};

export type Stats = {
  documents: number;
  documentsByStatus: Record<string, number>;
  questions: number;
  notePassages: number;
  topics: Record<string, number>;
  courses: number;
  yearRange: { min: number; max: number } | null;
};

export type BranchStat = { code: string; courses: number; papers: number; questions: number };

export type CatalogCourse = { code: string; title: string; branches: string[]; semester: number | null; papers: number; questions: number; years: number[] };

export type CourseQuestion = {
  id: string;
  label: string;
  text: string;
  kind: string;
  marks: number | null;
  co: string | null;
  bloom: string | null;
  unit: number | null;
  page: number | null;
  topics: TopicRef[];
  askedIn: number;
};

export type CoursePaper = {
  id: string;
  title: string;
  courseCode?: string;
  courseTitle?: string;
  branch?: string;
  semester?: number;
  year?: number;
  month?: string;
  examType?: string;
  status: string;
  questionCount: number;
  pageCount?: number;
  textSource?: string;
  questions: CourseQuestion[];
};

export type CourseDetail = {
  code: string;
  title: string;
  official: { scheme: string; semester?: number; linked: { code: string; title: string; similarity: number }[] } | null;
  codeReused: boolean;
  papers: CoursePaper[];
  topics: { name: string; label: string; papers: number; questions: number }[];
};

export type SchemeCourse = {
  code: string;
  title: string;
  scheme: string;
  semester: number;
  pastPapers: { code: string; title: string; titleSimilarity: number; papers: number; years: number[] }[];
  codeReusedBy: { title: string; papers: number; years: number[] }[];
};

export type TopicStat = { topic: string; label: string; questions: number; papers: number; totalMarks: number; years: number[] };
