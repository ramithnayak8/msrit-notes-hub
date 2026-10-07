/**
 * Turns the raw Drive listing (data/sources/drive-files.json, from
 * crawl-sources.mjs) into a catalogue of past papers:
 * data/sources/external-papers.json, which `npm run seed` loads.
 *
 * Decides which files are papers, and reads subject, exam type, year and
 * semester from the folder path and file name. Links only; nothing is copied.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { courses } from './seed-data.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawPath = join(root, 'data', 'sources', 'drive-files.json');
const outPath = join(root, 'data', 'sources', 'external-papers.json');

export const SOURCES = {
  ritnotebook: { name: 'RIT Notebook', url: 'https://ritnotebook.netlify.app' },
  riserit: { name: 'RIT ISE', url: 'https://riserit.vercel.app/resources' },
};

/** Branch labels used by the source sites -> our department codes. */
const BRANCH_TO_DEPT = {
  CSE: 'CSE', ISE: 'ISE', AIML: 'AIML', AIDS: 'AIML', 'CSE-AIML': 'AIML', 'CSE-Cyber': 'CSE',
  ECE: 'ECE', ETE: 'ECE', EIE: 'ECE', MD: 'ECE', EEE: 'EEE', ME: 'ME', IEM: 'ME', CH: 'ME', Civil: 'CV', BT: 'BT',
  'CSE stream': 'CSE', 'EEE stream': 'EEE', 'Civil stream': 'CV', 'Mech stream': 'ME',
};

const PAPER_FOLDER = /\b(pyqs?|pycies?|cies?|see|make ?-?up|backlog|question ?papers?|q ?papers?|qps?|(?:old|model|test|cie|see) papers?|papers|question ?bank|qb|old qp|model test papers)\b/i;
const PAPER_FILE = /\b(pyqs?|cie|see|make ?-?up|backlog|supple\w*|question ?paper|qp|model ?paper|end ?sem|mid ?sem|t1|t2|test ?[12]|internals?)\b|(?:^|[_\s-])(?:cie|see)(?:[_\s-]?\d)?(?=$|[_\s.-])/i;
const NOT_PAPER = /\b(notes?|module|modules|mod ?\d|chapter|textbook|text book|lab ?manual|manual|ppt|slides?|syllabus|lecture|unit ?\d+ ?notes|handwritten notes|assignment|record|observation|report|project|resume|timetable|time table|calendar|scheme of|notice|circular|instructions?|guidelines?|rubrics?)\b/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE_ONLY = new RegExp(`^(?:(?:${MONTHS.join('|')})[a-z]*[\\s_-]*)?20\\d\\d(?:[\\s_-]*(?:${MONTHS.join('|')})[a-z]*)?(?:[\\s_-]*\\(?\\d\\)?)?$`, 'i');

const OK_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'doc', 'docx', '']);

/** Folder names that describe a kind of paper, a year or a semester, not a subject. */
const GENERIC = /^(?:\d+\.?\s*)?(?:[ivx]+\s*-?\s*sem(?:ester)?|.*\bcycle\b.*|.*\bbatch\b.*|.*\bseniors?'?s?\b.*|electives?|.*extra notes.*|cies? (?:&|and) sees?.*|.*\bpyqs?\b.*|.*\bpycies?\b.*|cies?(?:[\s-]*(?:\d|i+|papers?|sem \d))?|see(?:\s*papers?)?|make ?-?up|backlog|question ?bank|qb.*|.*papers?\b.*|q ?papers|qps?|old qp|20\d\d.*|(?:sem(?:ester)?|year)[\s-]*\d.*|\d(?:st|nd|rd|th) (?:sem(?:ester)?|year).*|answers?|solutions?|same papers|misc.*|others?|all|new folder.*|dump|esc|etc|plc|aec)$/i;

const ext = (name) => (/\.([a-z0-9]{2,5})$/i.exec(name)?.[1] ?? '').toLowerCase();
const stripExt = (name) => name.replace(/\.[a-z0-9]{2,5}$/i, '');
const clean = (s) => s.replace(/^\d+(?:\s*\([a-z]\))?\s*[.)-]\s*/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
/** Underscores are word characters, so "SEE_32" would hide "SEE" from \b-anchored patterns. */
const spaced = (s) => s.replace(/[_]+/g, ' ');

/** Short forms used as folder names on the source sites. */
const ABBR = {
  ds: 'Data Structures', dsa: 'Data Structures and Applications', oop: 'Object Oriented Programming', oops: 'Object Oriented Programming',
  daa: 'Design and Analysis of Algorithms', dbms: 'Database Management Systems', dbs: 'Database Systems', os: 'Operating Systems',
  cn: 'Computer Networks', acn: 'Advanced Computer Networks', dcn: 'Data Communication and Networks', ml: 'Machine Learning',
  dl: 'Deep Learning', ai: 'Artificial Intelligence', se: 'Software Engineering', toc: 'Theory of Computation',
  fafl: 'Finite Automata and Formal Languages', dms: 'Discrete Mathematical Structures', ddco: 'Digital Design and Computer Organization',
  uhv: 'Universal Human Values', evs: 'Environmental Studies', rm: 'Research Methodology', ipr: 'Intellectual Property Rights',
  dec: 'Digital Electronic Circuits', edc: 'Electronic Devices and Circuits', dsp: 'Digital Signal Processing',
  emi: 'Electrical Measurements and Instrumentation', aec: 'Ability Enhancement Course', plc: 'Programming Language Course',
  esc: 'Engineering Science Course', etc: 'Emerging Technology Course', fpd: 'Fluid Power Drives', mes: 'Microcontrollers and Embedded Systems',
  cc: 'Cloud Computing', bda: 'Big Data Analytics', coa: 'Computer Organization and Architecture', me: 'Management and Entrepreneurship',
};

function subjectName(raw) {
  let s = clean(raw).replace(/\s*\((?:\d{4} batch)\)$/i, '');
  const key = s.toLowerCase().replace(/[^a-z]/g, '');
  if (ABBR[key]) return ABBR[key];
  if (/^maths?$|^mathematics$/i.test(s)) return 'Mathematics';
  s = s.replace(/\s*&\s*/g, ' and ');
  // Title-case names typed in all lower or all upper case.
  if (s === s.toLowerCase() || (s === s.toUpperCase() && s.length > 6)) {
    s = s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(And|Of|The|To|For|In|With)\b/g, (w) => w.toLowerCase());
  }
  return s;
}

function fileKind(file) {
  const e = ext(file.name);
  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(e)) return 'image';
  if (e === 'pdf') return 'pdf';
  if (e === 'doc' || e === 'docx' || /docs\.google\.com\/document/.test(file.url)) return 'doc';
  return 'file';
}

function examType(texts) {
  // Nearest evidence wins: file name first, then folders from deepest up.
  for (const t of texts) {
    const s = t.toLowerCase();
    if (/make ?-?up/.test(s)) return 'Makeup';
    if (/backlog|supple|\bsupply\b|re-?exam/.test(s)) return 'Backlog';
    if (/\bquiz\b/.test(s)) return 'Quiz';
    if (/\bvtu\b/.test(s)) return 'VTU paper';
    if (/question ?bank|\bqb\b/.test(s)) return 'Question bank';
    if (/model/.test(s)) return 'Model paper';
    const cie = /\b(?:cie|t|test|internal)[\s_-]*(1|2|3|i{1,3})\b/.exec(s);
    if (cie) return `CIE ${{ i: 1, ii: 2, iii: 3 }[cie[1]] ?? cie[1]}`;
    if (/\bcies?\b|internals?|mid ?sem/.test(s)) return 'CIE';
    if (/\bsee\b|end ?sem|semester end/.test(s)) return 'SEE';
  }
  return 'Paper';
}

function examYear(texts) {
  for (const t of texts) {
    if (/batch/i.test(t)) continue; // "(2022 batch)" is when notes were compiled, not an exam date
    const y = /\b(20(?:1[5-9]|2[0-6]))\b/.exec(t);
    if (y) return Number(y[1]);
  }
  return null;
}

function examMonth(texts) {
  for (const t of texts) {
    const m = new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\b`, 'i').exec(t);
    if (m) return m[1][0].toUpperCase() + m[1].slice(1, 3).toLowerCase();
  }
  return null;
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };

/** Only explicit labels count; "3. Data Structures" is a list position, not a semester. */
function semesterOf(file, texts) {
  for (const t of texts) {
    const m = /\bsem(?:ester)?[\s-]*(\d)\b|\b(\d)(?:st|nd|rd|th)[\s-]*sem|\b([ivx]{1,4})[\s-]*-?[\s-]*sem(?:ester)?\b/i.exec(t);
    if (m) return Number(m[1] ?? m[2] ?? ROMAN[m[3].toLowerCase()]) || null;
  }
  if (file.semester) return file.semester;
  if (file.year === 1) return /chemistry cycle/i.test(file.path.join(' ')) ? 2 : 1;
  return null;
}

/** How many leading path parts describe the source's own structure (year, branch, stream...). */
function rootDepth(file) {
  if (file.source === 'riserit') return 2;
  if (file.questionBank) return 2;
  if (file.year === 1) return 3; // First year / stream / cycle; the 4th part is the subject
  return 2; // Year n / branch
}

function subjectOf(file) {
  if (file.questionBank) return `Mathematics ${clean(file.path[2] ?? '')}`.trim();
  for (const part of file.path.slice(rootDepth(file))) {
    const c = clean(part);
    if (c.length > 1 && !GENERIC.test(c)) return subjectName(part);
  }
  return null;
}

// ── Course matching ────────────────────────────────────────────

const STOP = new Set(['and', 'of', 'the', 'to', 'for', 'with', 'in', 'using', 'applications', 'application', 'engineering', 'systems', 'system', 'introduction', 'basics', 'fundamentals']);
const words = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const keyWords = (s) => words(s).filter((w) => !STOP.has(w));
const initials = (s) => words(s).filter((w) => !['and', 'of', 'the', 'to', 'with', 'using', 'in', 'for'].includes(w)).map((w) => w[0]).join('');

const COURSE_INDEX = courses.map((c) => ({
  code: c.code,
  dept: c.dept_code ?? c.dept,
  semester: c.semester,
  keys: new Set(keyWords(c.title)),
  initials: initials(c.title),
  titleWords: words(c.title).join(' '),
}));

function matchCourse(subject, dept, semester) {
  if (!subject || !dept) return null;
  const subj = words(subject).join(' ');
  const keys = new Set(keyWords(subject));
  const abbr = /^[A-Za-z]{2,6}$/.test(subject.trim()) ? subject.trim().toLowerCase() : null;
  let best = null;
  for (const c of COURSE_INDEX) {
    if (c.dept !== dept) continue;
    if (semester && Math.abs(semester - c.semester) > 1) continue;
    let score = 0;
    if (subj === c.titleWords || subj.includes(c.titleWords) || c.titleWords.includes(subj)) score = 1;
    else if (abbr && (abbr === c.initials || abbr === `${c.initials}a`)) score = 0.9;
    else {
      const shared = [...keys].filter((k) => c.keys.has(k)).length;
      score = shared / Math.max(c.keys.size, keys.size, 1);
    }
    if (score >= 0.6 && (!best || score > best.score)) best = { code: c.code, score };
  }
  return best?.code ?? null;
}

// ── Classify ───────────────────────────────────────────────────

export function classify(files) {
  const papers = [];
  for (const file of files) {
    const e = ext(file.name);
    if (!OK_EXT.has(e)) continue;
    const base = stripExt(file.name);
    const folders = file.path.slice(rootDepth(file));

    const fileSaysPaper = PAPER_FILE.test(spaced(base)) || DATE_ONLY.test(spaced(base).trim());
    const folderSaysPaper = file.questionBank || folders.some((p) => PAPER_FOLDER.test(p) && !/notes/i.test(p));
    if (!fileSaysPaper && !folderSaysPaper) continue;
    if (NOT_PAPER.test(spaced(base)) && !fileSaysPaper) continue;

    const texts = [spaced(base), ...[...folders].reverse().map(spaced)];
    const subject = subjectOf(file);
    if (!subject) continue;
    const dept = BRANCH_TO_DEPT[file.branch] ?? null;
    const semester = semesterOf(file, [...folders].reverse().map(spaced));
    const studyYear = file.year ?? (semester ? Math.ceil(semester / 2) : null);

    papers.push({
      source: file.source,
      branch: file.branch,
      dept,
      semester,
      studyYear,
      subject,
      courseCode: matchCourse(subject, dept, semester),
      examType: file.questionBank ? 'Question bank' : examType(texts),
      year: examYear(texts),
      month: examMonth([spaced(base)]),
      title: spaced(base).replace(/\s+/g, ' ').trim(),
      kind: fileKind(file),
      url: file.url,
      path: file.path.join(' / '),
    });
  }

  // One entry per Drive file per subject: shared folders are linked from several branches.
  const byKey = new Map();
  for (const p of papers) {
    const key = `${p.url}|${p.subject.toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, { ...p, branches: p.branch ? [p.branch] : [] });
    else if (p.branch && !prev.branches.includes(p.branch)) prev.branches.push(p.branch);
  }
  return [...byKey.values()].map(({ branch, ...rest }) => ({ ...rest, branch: rest.branches.join(', ') || branch }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(rawPath)) {
    console.error('No crawl found. Run: node scripts/crawl-sources.mjs');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
  const papers = classify(raw.files);
  writeFileSync(outPath, JSON.stringify({ crawledAt: raw.crawledAt, sources: SOURCES, papers }, null, 1));
  const matched = papers.filter((p) => p.courseCode).length;
  console.log(`${raw.files.length} files -> ${papers.length} papers (${matched} matched to a course)`);
}
