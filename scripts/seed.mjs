import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { departments, courses, questions, notes, syllabusVersions } from './seed-data.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbDir = join(root, 'data');
const dbPath = join(dbDir, 'msrit.db');

mkdirSync(dbDir, { recursive: true });
if (existsSync(dbPath)) rmSync(dbPath);

const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE departments (
    code        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    full_name   TEXT NOT NULL,
    status      TEXT NOT NULL,
    accent_from TEXT NOT NULL,
    accent_to   TEXT NOT NULL
  );

  CREATE TABLE courses (
    code      TEXT PRIMARY KEY,
    title     TEXT NOT NULL,
    dept_code TEXT NOT NULL REFERENCES departments(code),
    semester  INTEGER NOT NULL,
    credits   INTEGER NOT NULL
  );

  CREATE TABLE papers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code TEXT NOT NULL REFERENCES courses(code),
    exam_type   TEXT NOT NULL,
    year        INTEGER NOT NULL,
    month       TEXT NOT NULL,
    label       TEXT NOT NULL,
    UNIQUE (course_code, exam_type, year, month)
  );

  CREATE TABLE questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id    INTEGER NOT NULL REFERENCES papers(id),
    course_code TEXT NOT NULL REFERENCES courses(code),
    number      TEXT NOT NULL,
    text        TEXT NOT NULL,
    marks       INTEGER NOT NULL,
    unit        INTEGER NOT NULL,
    topics      TEXT NOT NULL,
    level       TEXT NOT NULL
  );

  -- Past papers shared by other student sites: links to the original files, never copies.
  CREATE TABLE external_papers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL,
    branch      TEXT,
    dept_code   TEXT,
    semester    INTEGER,
    study_year  INTEGER,
    subject     TEXT NOT NULL,
    course_code TEXT REFERENCES courses(code),
    exam_type   TEXT NOT NULL,
    year        INTEGER,
    month       TEXT,
    title       TEXT NOT NULL,
    kind        TEXT NOT NULL,
    url         TEXT NOT NULL
  );
  CREATE INDEX external_papers_course ON external_papers(course_code);
  CREATE INDEX external_papers_subject ON external_papers(subject);

  CREATE TABLE notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code TEXT NOT NULL REFERENCES courses(code),
    title       TEXT NOT NULL,
    kind        TEXT NOT NULL,
    pages       INTEGER NOT NULL,
    contributor TEXT NOT NULL,
    year        INTEGER NOT NULL
  );

  CREATE TABLE syllabus_versions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code    TEXT NOT NULL REFERENCES courses(code),
    academic_year  TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    UNIQUE (course_code, academic_year)
  );

  CREATE TABLE syllabus_topics (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL REFERENCES syllabus_versions(id),
    unit       INTEGER NOT NULL,
    unit_title TEXT NOT NULL,
    hours      INTEGER NOT NULL,
    topic      TEXT NOT NULL
  );

  CREATE INDEX idx_courses_dept     ON courses(dept_code);
  CREATE INDEX idx_papers_course    ON papers(course_code);
  CREATE INDEX idx_questions_course ON questions(course_code);
  CREATE INDEX idx_questions_paper  ON questions(paper_id);
  CREATE INDEX idx_notes_course     ON notes(course_code);
  CREATE INDEX idx_syl_course       ON syllabus_versions(course_code);
  CREATE INDEX idx_syltopics_ver    ON syllabus_topics(version_id);
`);

const insertDept = db.prepare(
  'INSERT INTO departments (code, name, full_name, status, accent_from, accent_to) VALUES (?, ?, ?, ?, ?, ?)'
);
for (const d of departments) {
  insertDept.run(d.code, d.name, d.fullName, d.status, d.accentFrom, d.accentTo);
}

const insertCourse = db.prepare(
  'INSERT INTO courses (code, title, dept_code, semester, credits) VALUES (?, ?, ?, ?, ?)'
);
for (const c of courses) {
  insertCourse.run(c.code, c.title, c.dept, c.semester, c.credits);
}

const insertPaper = db.prepare(
  'INSERT INTO papers (course_code, exam_type, year, month, label) VALUES (?, ?, ?, ?, ?)'
);
const findPaper = db.prepare(
  'SELECT id FROM papers WHERE course_code = ? AND exam_type = ? AND year = ? AND month = ?'
);
const insertQuestion = db.prepare(
  'INSERT INTO questions (paper_id, course_code, number, text, marks, unit, topics, level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);

for (const q of questions) {
  let paper = findPaper.get(q.course, q.exam, q.year, q.month);
  if (!paper) {
    const label = `${q.course} ${q.exam} ${q.month} ${q.year}.pdf`;
    insertPaper.run(q.course, q.exam, q.year, q.month, label);
    paper = findPaper.get(q.course, q.exam, q.year, q.month);
  }
  insertQuestion.run(paper.id, q.course, q.num, q.text, q.marks, q.unit, q.topics.join('|'), q.level);
}

const insertNote = db.prepare(
  'INSERT INTO notes (course_code, title, kind, pages, contributor, year) VALUES (?, ?, ?, ?, ?, ?)'
);
for (const n of notes) {
  insertNote.run(n.course, n.title, n.kind, n.pages, n.contributor, n.year);
}

const insertVersion = db.prepare(
  'INSERT INTO syllabus_versions (course_code, academic_year, effective_from) VALUES (?, ?, ?)'
);
const findVersion = db.prepare(
  'SELECT id FROM syllabus_versions WHERE course_code = ? AND academic_year = ?'
);
const insertTopic = db.prepare(
  'INSERT INTO syllabus_topics (version_id, unit, unit_title, hours, topic) VALUES (?, ?, ?, ?, ?)'
);

for (const v of syllabusVersions) {
  insertVersion.run(v.course, v.academicYear, v.effectiveFrom);
  const { id } = findVersion.get(v.course, v.academicYear);
  for (const u of v.units) {
    for (const topic of u.topics) {
      insertTopic.run(id, u.unit, u.title, u.hours, topic);
    }
  }
}

// Optional: the catalogue built by scripts/crawl-sources.mjs + classify-papers.mjs.
const externalPath = join(root, 'data', 'sources', 'external-papers.json');
if (existsSync(externalPath)) {
  const { papers } = JSON.parse(readFileSync(externalPath, 'utf8'));
  const insertExternal = db.prepare(
    `INSERT INTO external_papers (source, branch, dept_code, semester, study_year, subject, course_code, exam_type, year, month, title, kind, url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  db.exec('BEGIN');
  for (const x of papers) {
    insertExternal.run(x.source, x.branch ?? null, x.dept ?? null, x.semester ?? null, x.studyYear ?? null, x.subject,
      x.courseCode ?? null, x.examType, x.year ?? null, x.month ?? null, x.title, x.kind, x.url);
  }
  db.exec('COMMIT');
}

const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
console.log(`Seeded ${dbPath}`);
console.log(
  `  departments=${count('departments')} courses=${count('courses')} papers=${count('papers')} ` +
  `questions=${count('questions')} notes=${count('notes')} ` +
  `syllabus_versions=${count('syllabus_versions')} syllabus_topics=${count('syllabus_topics')} ` +
  `external_papers=${count('external_papers')}`
);
db.close();
