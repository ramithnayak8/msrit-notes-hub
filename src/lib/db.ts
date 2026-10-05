import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import type {
  Course,
  CourseWithStats,
  Department,
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
