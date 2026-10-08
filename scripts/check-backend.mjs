/**
 * Checks a backend against docs/BACKEND_CONTRACT.md.
 *
 *   BACKEND_URL=http://localhost:5000/api node scripts/check-backend.mjs
 *
 * Optional: CHECK_DEPT (default CSE) and CHECK_COURSE (default: first course
 * the backend lists) pick which branch and course to probe.
 * Exits non-zero if any endpoint is missing or returns the wrong shape.
 */
const BASE = process.env.BACKEND_URL?.replace(/\/+$/, '');
if (!BASE) {
  console.error('Set BACKEND_URL, e.g. BACKEND_URL=http://localhost:5000/api node scripts/check-backend.mjs');
  process.exit(2);
}

const SHAPES = {
  Department: ['code', 'name', 'full_name', 'status', 'accent_from', 'accent_to'],
  DepartmentWithStats: ['code', 'name', 'full_name', 'status', 'course_count', 'paper_count', 'question_count', 'note_count', 'library_count'],
  Course: ['code', 'title', 'dept_code', 'semester', 'credits'],
  CourseWithStats: ['code', 'title', 'semester', 'credits', 'paper_count', 'question_count', 'note_count'],
  Paper: ['id', 'course_code', 'exam_type', 'year', 'month', 'label'],
  Question: ['id', 'paper_id', 'course_code', 'number', 'text', 'marks', 'unit', 'topics', 'level'],
  Note: ['id', 'course_code', 'title', 'kind', 'pages', 'contributor', 'year'],
  SyllabusVersion: ['id', 'course_code', 'academic_year', 'effective_from'],
  SyllabusUnit: ['unit', 'unitTitle', 'hours', 'topics'],
  SyllabusDiff: ['courseCode', 'courseTitle', 'from', 'to', 'added', 'removed', 'unchangedCount', 'newUnits'],
  Stats: ['departments', 'courses', 'papers', 'questions', 'notes', 'years'],
  YearRange: ['min', 'max'],
  SearchResponse: ['query', 'hits', 'total', 'tookMs', 'topicSummary', 'yearSummary'],
  QuestionHit: ['id', 'courseCode', 'courseTitle', 'number', 'text', 'marks', 'unit', 'topics', 'level', 'examType', 'year', 'month', 'score', 'matchedTerms'],
  ChatReply: ['answer', 'sources', 'mode', 'retrieved', 'tookMs'],
  PaperLibrary: ['shelves', 'totalShelves', 'totalPapers', 'page', 'pages'],
  ExternalPaper: ['id', 'source', 'subject', 'exam_type', 'title', 'kind', 'url'],
  LibraryStats: ['papers', 'subjects', 'sources'],
  LibraryYear: ['year', 'papers', 'subjects', 'top'],
  LibrarySubject: ['subject', 'papers'],
  LibraryCourse: ['code', 'title', 'papers'],
  SyllabusCourse: ['code', 'title', 'versions'],
};

const results = [];

async function call(method, path, body) {
  const started = Date.now();
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
    return { status: res.status, data, ms: Date.now() - started, text };
  } catch (err) {
    return { status: 0, data: undefined, ms: Date.now() - started, text: err.message };
  }
}

function missingKeys(value, shape) {
  if (!value || typeof value !== 'object') return ['(not an object)'];
  return SHAPES[shape].filter((k) => !(k in value));
}

/** expect: 'Shape' (object), 'Shape[]' (array), or 'Shape|404'. */
async function check(label, method, path, expect, body) {
  const r = await call(method, path, body);
  const allow404 = expect.endsWith('|404');
  const shape = expect.replace('|404', '').replace('[]', '');
  const isList = expect.includes('[]');
  let problem = null;

  if (r.status === 404 && allow404) problem = null;
  else if (r.status < 200 || r.status >= 300) problem = `HTTP ${r.status || 'unreachable'}${r.text ? `: ${r.text.slice(0, 80)}` : ''}`;
  else if (r.data === undefined) problem = 'response is not JSON';
  else if (isList && !Array.isArray(r.data)) problem = 'expected an array';
  else if (isList && r.data.length && SHAPES[shape]) {
    const miss = missingKeys(r.data[0], shape);
    if (miss.length) problem = `items missing: ${miss.join(', ')}`;
  } else if (!isList && SHAPES[shape]) {
    const miss = missingKeys(r.data, shape);
    if (miss.length) problem = `missing: ${miss.join(', ')}`;
  }

  results.push({ label, path: `${method} ${path}`, ok: !problem, problem, ms: r.ms, count: Array.isArray(r.data) ? r.data.length : null });
  return r.data;
}

console.log(`Checking ${BASE}\n`);

await check('health', 'GET', '/health', 'Health');
const departments = await check('departments', 'GET', '/departments', 'DepartmentWithStats[]');
const dept = process.env.CHECK_DEPT ?? (Array.isArray(departments) && departments[0]?.code) ?? 'CSE';
await check('department', 'GET', `/departments/${dept}`, 'Department');
await check('department courses', 'GET', `/departments/${dept}/courses`, 'CourseWithStats[]');
await check('unknown department → 404', 'GET', '/departments/NOPE404', 'Department|404');
const courses = await check('courses', 'GET', '/courses', 'Course[]');
const course = process.env.CHECK_COURSE ?? (Array.isArray(courses) && courses[0]?.code) ?? 'CS501';
await check('course', 'GET', `/courses/${course}`, 'Course');
await check('unknown course → 404', 'GET', '/courses/NOPE404', 'Course|404');
await check('course papers', 'GET', `/courses/${course}/papers`, 'Paper[]');
await check('course questions', 'GET', `/courses/${course}/questions`, 'Question[]');
await check('course notes', 'GET', `/courses/${course}/notes`, 'Note[]');
await check('course syllabus', 'GET', `/courses/${course}/syllabus`, 'SyllabusVersion[]');
await check('course syllabus diff', 'GET', `/courses/${course}/syllabus/diff`, 'SyllabusDiff|404');
await check('course library', 'GET', `/courses/${course}/library`, 'ExternalPaper[]');
const tracked = await check('syllabus courses', 'GET', '/syllabus/courses', 'SyllabusCourse[]');
if (Array.isArray(tracked) && tracked.length) {
  const versions = await call('GET', `/courses/${tracked[0].code}/syllabus`);
  const id = Array.isArray(versions.data) && versions.data[0]?.id;
  if (id) await check('syllabus units', 'GET', `/syllabus/versions/${id}/units`, 'SyllabusUnit[]');
}
await check('stats', 'GET', '/stats', 'Stats');
await check('stats years', 'GET', '/stats/years', 'YearRange');
const search = await check('search', 'GET', '/search?q=algorithm&limit=5', 'SearchResponse');
if (search?.hits?.length) {
  const miss = missingKeys(search.hits[0], 'QuestionHit');
  if (miss.length) results.push({ label: 'search hit shape', path: 'GET /search', ok: false, problem: `hits missing: ${miss.join(', ')}` });
}
await check('chat', 'POST', '/chat', 'ChatReply', { question: 'What should I revise first?' });
const library = await check('library', 'GET', '/library?page=1', 'PaperLibrary');
if (library?.shelves?.[0]?.papers?.length) {
  const miss = missingKeys(library.shelves[0].papers[0], 'ExternalPaper');
  if (miss.length) results.push({ label: 'library paper shape', path: 'GET /library', ok: false, problem: `papers missing: ${miss.join(', ')}` });
}
await check('library stats', 'GET', '/library/stats', 'LibraryStats');
await check('library years', 'GET', '/library/years', 'LibraryYear[]');
await check('library subjects', 'GET', '/library/subjects', 'LibrarySubject[]');
await check('library courses', 'GET', `/library/courses?codes=${course}`, 'LibraryCourse[]');

const width = Math.max(...results.map((r) => r.label.length));
for (const r of results) {
  const extra = r.ok ? `${r.ms ?? '-'} ms${r.count !== null && r.count !== undefined ? `, ${r.count} items` : ''}` : r.problem;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label.padEnd(width)}  ${extra}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? '' : '. Set BACKEND_URL in .env.local and restart the frontend.'}`);
process.exit(failed ? 1 : 0);
