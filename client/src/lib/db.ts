/**
 * The past-papers library: links to papers shared on other student sites
 * (RIT Notebook, RIT ISE), stored in a local SQLite file built by
 * `npm run seed`. Everything else on the site comes from the API (lib/api.ts).
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import type { DepartmentWithStats, ExternalPaper } from './types';

const dbPath = path.join(process.cwd(), 'data', 'msrit.db');

// Next dev re-evaluates modules on every change; keep one handle on globalThis.
const globalForDb = globalThis as unknown as { __msritDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!globalForDb.__msritDb) {
    globalForDb.__msritDb = new DatabaseSync(dbPath);
  }
  return globalForDb.__msritDb;
}

const all = <T>(sql: string, ...params: unknown[]): T[] =>
  db().prepare(sql).all(...(params as never[])) as T[];

const one = <T>(sql: string, ...params: unknown[]): T | undefined =>
  db().prepare(sql).get(...(params as never[])) as T | undefined;

export function getDepartments(): DepartmentWithStats[] {
  return all<DepartmentWithStats>(`
    SELECT d.*,
      (SELECT COUNT(*) FROM courses c WHERE c.dept_code = d.code) AS course_count,
      (SELECT COUNT(*) FROM papers p JOIN courses c ON c.code = p.course_code WHERE c.dept_code = d.code) AS paper_count,
      (SELECT COUNT(*) FROM questions q JOIN courses c ON c.code = q.course_code WHERE c.dept_code = d.code) AS question_count,
      (SELECT COUNT(*) FROM notes n JOIN courses c ON c.code = n.course_code WHERE c.dept_code = d.code) AS note_count
    FROM departments d
    ORDER BY CASE d.status WHEN 'active' THEN 0 WHEN 'growing' THEN 1 ELSE 2 END, question_count DESC
  `);
}

// ── Past papers from other student archives ───────────────────────────────

const EXAM_ORDER = `CASE e.exam_type WHEN 'SEE' THEN 0 WHEN 'Makeup' THEN 1 WHEN 'Backlog' THEN 2 WHEN 'CIE 2' THEN 3 WHEN 'CIE 1' THEN 4 ELSE 5 END`;

export type LibraryFilters = { q?: string; year?: number; dept?: string; exam?: readonly string[]; page?: number };

export type SubjectShelf = {
  subject: string;
  studyYear: number | null;
  semesters: number[];
  courseCode: string | null;
  branches: string[];
  papers: ExternalPaper[];
};

export const SHELVES_PER_PAGE = 18;

/** Papers matching the filters, grouped into one shelf per subject and year of study. */
export function getPaperLibrary(filters: LibraryFilters): {
  shelves: SubjectShelf[];
  totalShelves: number;
  totalPapers: number;
  page: number;
  pages: number;
} {
  const where: string[] = [];
  const params: unknown[] = [];
  for (const word of (filters.q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6)) {
    where.push(`(e.subject || ' ' || e.title || ' ' || IFNULL(e.branch, '') || ' ' || IFNULL(e.course_code, '')) LIKE ?`);
    params.push(`%${word.replace(/[%_]/g, '')}%`);
  }
  if (filters.year) {
    where.push('e.study_year = ?');
    params.push(filters.year);
  }
  if (filters.dept) {
    // First-year papers are shared by a whole stream, so they stay visible under every branch.
    where.push('(e.dept_code = ? OR e.study_year = 1)');
    params.push(filters.dept);
  }
  if (filters.exam?.length) {
    where.push(`e.exam_type IN (${filters.exam.map(() => '?').join(', ')})`);
    params.push(...filters.exam);
  }

  const rows = all<ExternalPaper>(
    `SELECT e.* FROM external_papers e ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY e.study_year IS NULL, e.study_year, e.subject, e.year IS NULL, e.year DESC, ${EXAM_ORDER}, e.title`,
    ...params
  );

  const groups = new Map<string, SubjectShelf>();
  for (const row of rows) {
    const key = `${row.study_year ?? 0}|${row.subject.toLowerCase()}`;
    let shelf = groups.get(key);
    if (!shelf) {
      shelf = { subject: row.subject, studyYear: row.study_year, semesters: [], courseCode: null, branches: [], papers: [] };
      groups.set(key, shelf);
    }
    shelf.papers.push(row);
    if (row.semester && !shelf.semesters.includes(row.semester)) shelf.semesters.push(row.semester);
    if (row.course_code) shelf.courseCode ??= row.course_code;
    for (const b of (row.branch ?? '').split(', ').filter(Boolean)) if (!shelf.branches.includes(b)) shelf.branches.push(b);
  }

  // Bigger shelves first within a year, so the most useful subjects lead.
  const shelves = [...groups.values()].sort(
    (a, b) => (a.studyYear ?? 9) - (b.studyYear ?? 9) || b.papers.length - a.papers.length || a.subject.localeCompare(b.subject)
  );
  const pages = Math.max(1, Math.ceil(shelves.length / SHELVES_PER_PAGE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pages);
  return {
    shelves: shelves.slice((page - 1) * SHELVES_PER_PAGE, page * SHELVES_PER_PAGE),
    totalShelves: shelves.length,
    totalPapers: rows.length,
    page,
    pages,
  };
}

export function getLibraryStats() {
  return one<{ papers: number; subjects: number; sources: number }>(`
    SELECT COUNT(*) AS papers, COUNT(DISTINCT lower(subject) || '|' || IFNULL(study_year, 0)) AS subjects, COUNT(DISTINCT source) AS sources
    FROM external_papers
  `)!;
}

export function getLibrarySubjects(): { subject: string; papers: number }[] {
  return all(`
    SELECT subject, COUNT(*) AS papers FROM external_papers
    GROUP BY lower(subject) ORDER BY papers DESC, subject LIMIT 400
  `);
}
