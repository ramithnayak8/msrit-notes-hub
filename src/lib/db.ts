import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import type {
  Course,
  CourseWithStats,
  Department,
  ExternalPaper,
  DepartmentWithStats,
  Note,
  Paper,
  Question,
  SyllabusDiff,
  SyllabusUnit,
  SyllabusVersion,
} from './types';

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

export function getDepartment(code: string): Department | undefined {
  return one<Department>('SELECT * FROM departments WHERE code = ?', code.toUpperCase());
}

export function getCoursesByDept(deptCode: string): CourseWithStats[] {
  return all<CourseWithStats>(`
    SELECT c.*,
      (SELECT COUNT(*) FROM papers p WHERE p.course_code = c.code) AS paper_count,
      (SELECT COUNT(*) FROM questions q WHERE q.course_code = c.code) AS question_count,
      (SELECT COUNT(*) FROM notes n WHERE n.course_code = c.code) AS note_count
    FROM courses c
    WHERE c.dept_code = ?
    ORDER BY c.semester, c.code
  `, deptCode.toUpperCase());
}

export function getCourse(code: string): Course | undefined {
  return one<Course>('SELECT * FROM courses WHERE code = ?', code.toUpperCase());
}

export function getAllCourses(): Course[] {
  return all<Course>('SELECT * FROM courses ORDER BY dept_code, semester, code');
}

export function getPapersByCourse(courseCode: string): Paper[] {
  return all<Paper>(`
    SELECT p.*, (SELECT COUNT(*) FROM questions q WHERE q.paper_id = p.id) AS question_count
    FROM papers p
    WHERE p.course_code = ?
    ORDER BY p.year DESC, p.exam_type
  `, courseCode.toUpperCase());
}

export function getQuestionsByCourse(courseCode: string): Question[] {
  return all<Question>(`
    SELECT q.* FROM questions q
    JOIN papers p ON p.id = q.paper_id
    WHERE q.course_code = ?
    ORDER BY p.year DESC, q.number
  `, courseCode.toUpperCase());
}

export function getNotesByCourse(courseCode: string): Note[] {
  return all<Note>('SELECT * FROM notes WHERE course_code = ? ORDER BY year DESC', courseCode.toUpperCase());
}

export function getAllNotes(): (Note & { course_title: string; dept_code: string })[] {
  return all(`
    SELECT n.*, c.title AS course_title, c.dept_code
    FROM notes n JOIN courses c ON c.code = n.course_code
    ORDER BY n.year DESC, n.title
  `);
}

export function getStats() {
  return one<{
    departments: number; courses: number; papers: number;
    questions: number; notes: number; years: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM departments) AS departments,
      (SELECT COUNT(*) FROM courses) AS courses,
      (SELECT COUNT(*) FROM papers) AS papers,
      (SELECT COUNT(*) FROM questions) AS questions,
      (SELECT COUNT(*) FROM notes) AS notes,
      (SELECT COUNT(DISTINCT year) FROM papers) AS years
  `)!;
}

export function getYearRange(): { min: number; max: number } {
  return one<{ min: number; max: number }>('SELECT MIN(year) AS min, MAX(year) AS max FROM papers')!;
}

// ── Syllabus ───────────────────────────────────────────────────────────────

export function getSyllabusCourses(): { code: string; title: string; versions: number }[] {
  return all(`
    SELECT c.code, c.title, COUNT(v.id) AS versions
    FROM syllabus_versions v JOIN courses c ON c.code = v.course_code
    GROUP BY c.code, c.title
    HAVING COUNT(v.id) >= 2
    ORDER BY c.code
  `);
}

export function getSyllabusVersions(courseCode: string): SyllabusVersion[] {
  return all<SyllabusVersion>(
    'SELECT * FROM syllabus_versions WHERE course_code = ? ORDER BY academic_year',
    courseCode.toUpperCase()
  );
}

export function getSyllabusUnits(versionId: number): SyllabusUnit[] {
  const rows = all<{ unit: number; unit_title: string; hours: number; topic: string }>(
    'SELECT unit, unit_title, hours, topic FROM syllabus_topics WHERE version_id = ? ORDER BY unit, id',
    versionId
  );
  const byUnit = new Map<number, SyllabusUnit>();
  for (const r of rows) {
    if (!byUnit.has(r.unit)) {
      byUnit.set(r.unit, { unit: r.unit, unitTitle: r.unit_title, hours: r.hours, topics: [] });
    }
    byUnit.get(r.unit)!.topics.push(r.topic);
  }
  return [...byUnit.values()];
}

/** Diffs the two most recent syllabus versions of a course (or the two given). */
export function diffSyllabus(courseCode: string): SyllabusDiff | null {
  const versions = getSyllabusVersions(courseCode);
  if (versions.length < 2) return null;

  const from = versions[versions.length - 2];
  const to = versions[versions.length - 1];
  const fromUnits = getSyllabusUnits(from.id);
  const toUnits = getSyllabusUnits(to.id);

  const key = (u: number, t: string) => `${u}::${t.toLowerCase()}`;
  const fromTopics = new Map<string, { unit: number; unitTitle: string; topic: string }>();
  const toTopics = new Map<string, { unit: number; unitTitle: string; topic: string }>();

  for (const u of fromUnits) {
    for (const t of u.topics) fromTopics.set(key(u.unit, t), { unit: u.unit, unitTitle: u.unitTitle, topic: t });
  }
  for (const u of toUnits) {
    for (const t of u.topics) toTopics.set(key(u.unit, t), { unit: u.unit, unitTitle: u.unitTitle, topic: t });
  }

  const added = [...toTopics.entries()].filter(([k]) => !fromTopics.has(k)).map(([, v]) => v);
  const removed = [...fromTopics.entries()].filter(([k]) => !toTopics.has(k)).map(([, v]) => v);
  const unchangedCount = [...toTopics.keys()].filter((k) => fromTopics.has(k)).length;

  const fromUnitNums = new Set(fromUnits.map((u) => u.unit));
  const newUnits = toUnits
    .filter((u) => !fromUnitNums.has(u.unit))
    .map((u) => ({ unit: u.unit, unitTitle: u.unitTitle, hours: u.hours }));

  const course = getCourse(courseCode);
  return {
    courseCode: courseCode.toUpperCase(),
    courseTitle: course?.title ?? courseCode,
    from,
    to,
    added,
    removed,
    unchangedCount,
    newUnits,
  };
}

// ── Past papers from other student archives ───────────────────────────────

const EXAM_ORDER = `CASE e.exam_type WHEN 'SEE' THEN 0 WHEN 'Makeup' THEN 1 WHEN 'Backlog' THEN 2 WHEN 'CIE 2' THEN 3 WHEN 'CIE 1' THEN 4 ELSE 5 END`;

export function getExternalPapersByCourse(courseCode: string): ExternalPaper[] {
  return all<ExternalPaper>(
    `SELECT e.* FROM external_papers e WHERE e.course_code = ?
     ORDER BY e.year IS NULL, e.year DESC, ${EXAM_ORDER}, e.title`,
    courseCode
  );
}

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
