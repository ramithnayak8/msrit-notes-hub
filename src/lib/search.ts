import { db, getYearRange } from './db';
import type { ParsedQuery, QuestionHit, SearchResponse } from './types';

/*
 * Retrieval pipeline
 * ------------------
 *  1. parseQuery()    natural language -> structured filters + content terms
 *  2. expandQuery()   content terms -> weighted term set, using a curated concept
 *                     map plus co-occurrence statistics mined from the corpus itself
 *  3. rank()          BM25F scoring over weighted fields, then filters + recency
 *
 * Step 2 is what lets "multithreading" reach a paper that only ever says "thread",
 * without an embedding model or an API call. Swapping in real vector embeddings
 * later means replacing expandQuery/rank behind the same searchQuestions() signature.
 */

const STOPWORDS = new Set([
  'a','an','the','and','or','of','in','on','for','to','from','with','without','by','as','at','is','are','was','were',
  'be','been','it','its','this','that','these','those','there','their','them','they','you','your','we','our','i','me',
  'my','can','could','would','should','will','shall','may','might','must','do','does','did','done','have','has','had',
  'not','no','any','all','some','more','most','much','many','few','than','then','so','if','but','about','into','over',
  'under','out','up','down','which','what','when','where','who','whom','how','why','show','give','list','find','get',
  'want','need','please','explain','describe','define','write','state','discuss','illustrate','suitable','example',
  'examples','following','given','question','questions','paper','papers','marks','mark','using','use','used','also',
  'last','past','recent','year','years','ago','since','between','during','me','let','see','look','looking','search',
  // study-intent phrasing: signals what the student wants, never what a paper is about
  'revise','revising','revision','study','studying','prepare','preparing','preparation','prep','important',
  'priority','prioritise','prioritize','focus','cover','syllabus','scheme','curriculum','exam','exams','semester',
]);

const CONCEPTS: Record<string, string[]> = {
  'binary tree': ['tree', 'bst', 'traversal', 'inorder', 'preorder', 'postorder', 'node', 'leaf', 'avl'],
  'bst': ['binary', 'search', 'tree', 'node', 'traversal'],
  'avl': ['tree', 'rotation', 'balance', 'binary'],
  'tree': ['binary', 'traversal', 'node', 'bst', 'leaf', 'height'],
  'multithreading': ['thread', 'process', 'concurrency', 'synchronization', 'parallel'],
  'thread': ['process', 'multithreading', 'concurrency', 'synchronization'],
  'deadlock': ['banker', 'resource', 'allocation', 'prevention', 'avoidance', 'starvation', 'safe'],
  'scheduling': ['fcfs', 'sjf', 'priority', 'robin', 'waiting', 'turnaround', 'preemptive', 'cpu'],
  'memory': ['paging', 'segmentation', 'virtual', 'page', 'replacement', 'thrashing', 'frame', 'allocation'],
  'paging': ['memory', 'page', 'frame', 'virtual', 'segmentation'],
  'normalization': ['normal', 'form', 'bcnf', 'functional', 'dependency', 'decomposition', '3nf', '2nf'],
  'sql': ['query', 'relational', 'select', 'join', 'aggregate', 'database'],
  'transaction': ['acid', 'concurrency', 'locking', 'serializability', 'recovery', 'commit'],
  'indexing': ['index', 'tree', 'hashing', 'file', 'organization'],
  'sorting': ['sort', 'quick', 'merge', 'heap', 'bubble', 'insertion', 'complexity'],
  'searching': ['search', 'binary', 'linear', 'complexity'],
  'graph': ['bfs', 'dfs', 'traversal', 'spanning', 'shortest', 'path', 'adjacency', 'vertex', 'edge'],
  'hashing': ['hash', 'collision', 'table', 'chaining', 'probing'],
  'complexity': ['time', 'space', 'asymptotic', 'notation', 'analysis', 'worst', 'best'],
  'dynamic programming': ['knapsack', 'optimal', 'substructure', 'memoization', 'floyd'],
  'greedy': ['optimal', 'huffman', 'spanning', 'dijkstra', 'knapsack', 'job'],
  'network': ['osi', 'tcp', 'udp', 'routing', 'packet', 'layer', 'protocol', 'ip'],
  'tcp': ['transport', 'congestion', 'handshake', 'udp', 'connection'],
  'routing': ['distance', 'vector', 'link', 'state', 'shortest', 'path', 'network'],
  'machine learning': ['regression', 'classification', 'clustering', 'training', 'model', 'supervised'],
  'neural network': ['backpropagation', 'deep', 'layer', 'activation', 'cnn', 'perceptron', 'gradient'],
  'deep learning': ['neural', 'cnn', 'lstm', 'transformer', 'gradient', 'dropout'],
  'clustering': ['kmeans', 'unsupervised', 'cluster', 'distance'],
  'inheritance': ['polymorphism', 'class', 'object', 'override', 'java'],
  'exception': ['handling', 'try', 'catch', 'throw', 'java'],
  'flip flop': ['sequential', 'circuit', 'counter', 'clock', 'latch'],
  'karnaugh': ['kmap', 'boolean', 'minimization', 'simplify'],
  'fourier': ['transform', 'frequency', 'signal', 'spectrum'],
  'thermodynamics': ['entropy', 'carnot', 'cycle', 'efficiency', 'law'],
  'testing': ['unit', 'integration', 'system', 'acceptance', 'software'],
  'agile': ['scrum', 'waterfall', 'model', 'process', 'devops'],
};

const DEPT_ALIASES: Record<string, string> = {
  'cse': 'CSE', 'computer science': 'CSE',
  'ise': 'ISE', 'information science': 'ISE',
  'ece': 'ECE', 'electronics': 'ECE',
  'eee': 'EEE', 'electrical': 'EEE',
  'mechanical': 'ME',
  'civil': 'CV',
  'aiml': 'AIML', 'artificial intelligence': 'AIML',
  'biotechnology': 'BT',
  'mca': 'MCA',
};

/*
 * Codes that are also ordinary English words ("show ME the last 3 years") only
 * count as a department filter when the student actually capitalised them.
 */
const CASE_SENSITIVE_DEPT_CODES: Record<string, string> = {
  ME: 'ME', CV: 'CV', AI: 'AIML', BT: 'BT', IS: 'ISE',
};

/*
 * Students name courses by abbreviation far more often than by code. Each alias
 * resolves to a substring matched against course titles, so one alias can select
 * the equivalent course in several departments (DS -> CS304 and IS304).
 */
const COURSE_ALIASES: Record<string, string> = {
  os: 'operating systems',
  dbms: 'database management',
  daa: 'design and analysis of algorithms',
  algo: 'algorithms',
  cn: 'computer networks',
  ml: 'machine learning',
  dl: 'deep learning',
  ds: 'data structures',
  oop: 'object oriented',
  oops: 'object oriented',
  se: 'software engineering',
  wt: 'web technologies',
  de: 'digital electronics',
  ss: 'signals and systems',
  thermo: 'thermodynamics',
  fm: 'fluid mechanics',
  sa: 'structural analysis',
};

function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ing') && w.length - 3 >= 4) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed') && w.length - 2 >= 4) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem)
    .filter((t) => t.length > 1);
}

// ── Index ──────────────────────────────────────────────────────────────────

type IndexedDoc = {
  id: number;
  courseCode: string;
  courseTitle: string;
  deptCode: string;
  number: string;
  text: string;
  marks: number;
  unit: number;
  topics: string[];
  level: string;
  examType: string;
  year: number;
  month: string;
  paperLabel: string;
  tf: Map<string, number>;
  length: number;
};

type SearchIndex = {
  docs: IndexedDoc[];
  df: Map<string, number>;
  avgLength: number;
  cooccurrence: Map<string, Map<string, number>>;
  termFreq: Map<string, number>;
  maxYear: number;
  minYear: number;
};

const FIELD_WEIGHTS = { text: 1, topics: 3, courseTitle: 1.5, courseCode: 4, level: 0.5 };

const globalForIndex = globalThis as unknown as { __msritIndex?: SearchIndex };

function buildIndex(): SearchIndex {
  const rows = db().prepare(`
    SELECT q.id, q.course_code, q.number, q.text, q.marks, q.unit, q.topics, q.level,
           c.title AS course_title, c.dept_code,
           p.exam_type, p.year, p.month, p.label
    FROM questions q
    JOIN courses c ON c.code = q.course_code
    JOIN papers  p ON p.id   = q.paper_id
  `).all() as Record<string, string | number>[];

  const docs: IndexedDoc[] = [];
  const df = new Map<string, number>();
  const termFreq = new Map<string, number>();
  const cooccurrence = new Map<string, Map<string, number>>();

  for (const r of rows) {
    const topics = String(r.topics).split('|').filter(Boolean);
    const tf = new Map<string, number>();

    const addField = (value: string, weight: number) => {
      for (const t of tokenize(value)) tf.set(t, (tf.get(t) ?? 0) + weight);
    };
    addField(String(r.text), FIELD_WEIGHTS.text);
    addField(topics.join(' '), FIELD_WEIGHTS.topics);
    addField(String(r.course_title), FIELD_WEIGHTS.courseTitle);
    addField(String(r.course_code), FIELD_WEIGHTS.courseCode);
    addField(String(r.level), FIELD_WEIGHTS.level);

    let length = 0;
    for (const v of tf.values()) length += v;

    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);

    // Co-occurrence is mined over curated topic tags: high signal, low noise.
    const topicTerms = [...new Set(tokenize(topics.join(' ')))];
    for (const t of topicTerms) {
      termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
      if (!cooccurrence.has(t)) cooccurrence.set(t, new Map());
      const bucket = cooccurrence.get(t)!;
      for (const other of topicTerms) {
        if (other !== t) bucket.set(other, (bucket.get(other) ?? 0) + 1);
      }
    }

    docs.push({
      id: Number(r.id),
      courseCode: String(r.course_code),
      courseTitle: String(r.course_title),
      deptCode: String(r.dept_code),
      number: String(r.number),
      text: String(r.text),
      marks: Number(r.marks),
      unit: Number(r.unit),
      topics,
      level: String(r.level),
      examType: String(r.exam_type),
      year: Number(r.year),
      month: String(r.month),
      paperLabel: String(r.label),
      tf,
      length,
    });
  }

  const avgLength = docs.reduce((s, d) => s + d.length, 0) / Math.max(docs.length, 1);
  const { min, max } = getYearRange();

  return { docs, df, avgLength, cooccurrence, termFreq, minYear: min, maxYear: max };
}

export function getIndex(): SearchIndex {
  if (!globalForIndex.__msritIndex) globalForIndex.__msritIndex = buildIndex();
  return globalForIndex.__msritIndex;
}

// ── Query understanding ────────────────────────────────────────────────────

export function parseQuery(raw: string): ParsedQuery {
  const index = getIndex();
  const lower = raw.toLowerCase();
  const filters: ParsedQuery['filters'] = {};
  const explanation: string[] = [];
  let working = lower;

  // "last 3 years" / "past two years"
  const wordNums: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const lastN = working.match(/\b(?:last|past|previous)\s+(\d+|one|two|three|four|five|six)\s+year/);
  if (lastN) {
    const n = Number(lastN[1]) || wordNums[lastN[1]] || 3;
    filters.yearFrom = index.maxYear - (n - 1);
    filters.yearTo = index.maxYear;
    explanation.push(`last ${n} years (${filters.yearFrom}–${filters.yearTo})`);
    working = working.replace(lastN[0], ' ');
  }

  // explicit ranges and single years
  const range = working.match(/\b(20\d{2})\s*(?:-|–|to)\s*(20\d{2})\b/);
  if (range && filters.yearFrom === undefined) {
    filters.yearFrom = Math.min(+range[1], +range[2]);
    filters.yearTo = Math.max(+range[1], +range[2]);
    explanation.push(`years ${filters.yearFrom}–${filters.yearTo}`);
    working = working.replace(range[0], ' ');
  }
  const since = working.match(/\bsince\s+(20\d{2})\b/);
  if (since && filters.yearFrom === undefined) {
    filters.yearFrom = +since[1];
    explanation.push(`since ${since[1]}`);
    working = working.replace(since[0], ' ');
  }
  if (filters.yearFrom === undefined) {
    const years = [...working.matchAll(/\b(20\d{2})\b/g)].map((m) => +m[1]);
    if (years.length === 1) {
      filters.yearFrom = filters.yearTo = years[0];
      explanation.push(`year ${years[0]}`);
      working = working.replace(String(years[0]), ' ');
    } else if (years.length > 1) {
      filters.yearFrom = Math.min(...years);
      filters.yearTo = Math.max(...years);
      explanation.push(`years ${filters.yearFrom}–${filters.yearTo}`);
      for (const y of years) working = working.replace(String(y), ' ');
    }
  }

  // course code, e.g. CS501
  const courseCodes = new Set(
    (db().prepare('SELECT code FROM courses').all() as { code: string }[]).map((r) => r.code.toLowerCase())
  );
  const codeMatch = [...working.matchAll(/\b([a-z]{2,4}\s?\d{3})\b/g)]
    .map((m) => m[1].replace(/\s/g, ''))
    .find((c) => courseCodes.has(c));
  if (codeMatch) {
    filters.courseCode = codeMatch.toUpperCase();
    explanation.push(`course ${filters.courseCode}`);
    working = working.replace(new RegExp(`\\b${codeMatch}\\b`, 'g'), ' ');
  }

  // department
  if (!filters.courseCode) {
    for (const [alias, code] of Object.entries(DEPT_ALIASES)) {
      const re = new RegExp(`\\b${alias}\\b`);
      if (re.test(working)) {
        filters.deptCode = code;
        explanation.push(`department ${code}`);
        working = working.replace(re, ' ');
        break;
      }
    }
  }
  if (!filters.courseCode && !filters.deptCode) {
    for (const [code, dept] of Object.entries(CASE_SENSITIVE_DEPT_CODES)) {
      const re = new RegExp(`\\b${code}\\b`);
      if (re.test(raw)) {
        filters.deptCode = dept;
        explanation.push(`department ${dept}`);
        working = working.replace(new RegExp(`\\b${code.toLowerCase()}\\b`), ' ');
        break;
      }
    }
  }

  // course named in words ("operating systems") or by abbreviation ("OS")
  if (!filters.courseCode) {
    const allCourses = db()
      .prepare('SELECT code, title FROM courses')
      .all() as { code: string; title: string }[];

    let needle: string | null = null;
    let consumed: string | null = null;

    for (const [alias, title] of Object.entries(COURSE_ALIASES)) {
      // Abbreviations are only meaningful when capitalised or standing alone,
      // so "ds" inside prose does not hijack the query.
      if (new RegExp(`\\b${alias.toUpperCase()}\\b`).test(raw) || new RegExp(`\\b${alias}\\b`).test(working)) {
        needle = title;
        consumed = alias;
        break;
      }
    }
    if (!needle) {
      const byTitle = allCourses.find((c) => working.includes(c.title.toLowerCase()));
      if (byTitle) {
        needle = byTitle.title.toLowerCase();
        consumed = byTitle.title.toLowerCase();
      }
    }

    if (needle) {
      const matched = allCourses.filter((c) => c.title.toLowerCase().includes(needle));
      if (matched.length) {
        filters.courseCodes = matched.map((c) => c.code);
        explanation.push(
          matched.length === 1
            ? `course ${matched[0].code} (${matched[0].title})`
            : `courses ${matched.map((c) => c.code).join(', ')}`
        );
        if (consumed) working = working.replace(new RegExp(`\\b${consumed}\\b`, 'g'), ' ');
        working = working.replace(new RegExp(`\\b${needle}\\b`, 'g'), ' ');
      }
    }
  }

  // marks
  const marks = working.match(/\b(\d{1,2})\s*marks?\b/);
  if (marks) {
    filters.minMarks = +marks[1];
    explanation.push(`${marks[1]}+ marks`);
    working = working.replace(marks[0], ' ');
  } else if (/\b(high|heavy|big|long)\s+(marks?|weightage|questions?)\b/.test(working)) {
    filters.minMarks = 10;
    explanation.push('high-mark questions (10+)');
  }

  // intent
  let intent: ParsedQuery['intent'] = 'questions';
  if (/\b(syllabus|scheme|curriculum)\b/.test(lower) && /\b(chang|diff|new|updat|compar|remov|add)/.test(lower)) {
    intent = 'syllabus-change';
  } else if (/\bhow (has|did|have).*(chang|differ|updat)/.test(lower)) {
    intent = 'syllabus-change';
  } else if (/\bnotes?\b/.test(lower) && !/\bquestions?\b/.test(lower)) {
    intent = 'notes';
  }

  const terms = [...new Set(tokenize(working))];
  const expandedTerms = expandQuery(terms, lower);

  if (terms.length) explanation.unshift(`topic: ${terms.join(', ')}`);

  return { raw, terms, expandedTerms, intent, filters, explanation };
}

/** Curated concept map + corpus co-occurrence -> weighted term set. */
function expandQuery(terms: string[], rawLower: string): { term: string; weight: number }[] {
  const index = getIndex();
  const weights = new Map<string, number>();
  for (const t of terms) weights.set(t, 1);

  // multi-word concepts matched on the raw string
  for (const [phrase, related] of Object.entries(CONCEPTS)) {
    if (!rawLower.includes(phrase)) continue;
    for (const r of related.map(stem)) {
      weights.set(r, Math.max(weights.get(r) ?? 0, 0.45));
    }
  }
  // single-term concepts
  for (const t of terms) {
    const related = CONCEPTS[t];
    if (!related) continue;
    for (const r of related.map(stem)) {
      weights.set(r, Math.max(weights.get(r) ?? 0, 0.4));
    }
  }

  // corpus co-occurrence: top associated topic terms by pointwise association
  const total = index.docs.length;
  for (const t of terms) {
    const bucket = index.cooccurrence.get(t);
    if (!bucket) continue;
    const scored = [...bucket.entries()]
      .map(([other, count]) => {
        const pA = (index.termFreq.get(t) ?? 1) / total;
        const pB = (index.termFreq.get(other) ?? 1) / total;
        const pAB = count / total;
        return { other, pmi: Math.log(pAB / (pA * pB) + 1e-9) * Math.log(1 + count) };
      })
      .filter((x) => x.pmi > 0)
      .sort((a, b) => b.pmi - a.pmi)
      .slice(0, 4);
    for (const s of scored) {
      weights.set(s.other, Math.max(weights.get(s.other) ?? 0, 0.3));
    }
  }

  return [...weights.entries()]
    .map(([term, weight]) => ({ term, weight }))
    .sort((a, b) => b.weight - a.weight);
}

// ── Ranking ────────────────────────────────────────────────────────────────

const K1 = 1.4;
const B = 0.72;

export function searchQuestions(raw: string, limit = 20): SearchResponse {
  const started = performance.now();
  const index = getIndex();
  const query = parseQuery(raw);

  const candidates = index.docs.filter((d) => {
    const f = query.filters;
    if (f.yearFrom !== undefined && d.year < f.yearFrom) return false;
    if (f.yearTo !== undefined && d.year > f.yearTo) return false;
    if (f.deptCode && d.deptCode !== f.deptCode) return false;
    if (f.courseCode && d.courseCode !== f.courseCode) return false;
    if (f.courseCodes?.length && !f.courseCodes.includes(d.courseCode)) return false;
    if (f.minMarks !== undefined && d.marks < f.minMarks) return false;
    return true;
  });

  /*
   * "What should I revise first for OS" leaves filters but no topic terms. Rank
   * those by how often each question's topics recur across the filtered set —
   * repetition across papers is the signal a student actually wants.
   */
  const termless = query.expandedTerms.length === 0;
  const topicRecurrence = new Map<string, number>();
  if (termless) {
    for (const doc of candidates) {
      for (const t of doc.topics) topicRecurrence.set(t, (topicRecurrence.get(t) ?? 0) + 1);
    }
  }

  const N = index.docs.length;
  const scored: QuestionHit[] = [];

  for (const doc of candidates) {
    let score = 0;
    const matched: string[] = [];

    if (termless) {
      for (const t of doc.topics) score += topicRecurrence.get(t) ?? 0;
      score = score / Math.max(doc.topics.length, 1) + 0.5;
    } else {
      for (const { term, weight } of query.expandedTerms) {
        const tf = doc.tf.get(term);
        if (!tf) continue;
        const df = index.df.get(term) ?? 1;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const norm = tf * (K1 + 1) / (tf + K1 * (1 - B + B * (doc.length / index.avgLength)));
        score += idf * norm * weight;
        if (weight >= 0.9) matched.push(term);
      }
    }

    if (score <= 0) continue;

    // gentle recency preference so "recent papers" surface first among equals
    const span = Math.max(index.maxYear - index.minYear, 1);
    score *= 1 + 0.12 * ((doc.year - index.minYear) / span);

    scored.push({
      id: doc.id,
      courseCode: doc.courseCode,
      courseTitle: doc.courseTitle,
      deptCode: doc.deptCode,
      number: doc.number,
      text: doc.text,
      marks: doc.marks,
      unit: doc.unit,
      topics: doc.topics,
      level: doc.level,
      examType: doc.examType,
      year: doc.year,
      month: doc.month,
      paperLabel: doc.paperLabel,
      score,
      matchedTerms: matched,
    });
  }

  scored.sort((a, b) => b.score - a.score || b.year - a.year);

  // normalise to a 0-100 relevance figure relative to the best hit
  const top = scored[0]?.score ?? 1;
  for (const hit of scored) hit.score = Math.round((hit.score / top) * 100);

  const hits = scored.slice(0, limit);

  const topicCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();
  for (const hit of scored) {
    for (const t of hit.topics) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
    yearCounts.set(hit.year, (yearCounts.get(hit.year) ?? 0) + 1);
  }

  return {
    query,
    hits,
    total: scored.length,
    tookMs: Math.round((performance.now() - started) * 100) / 100,
    topicSummary: [...topicCounts.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    yearSummary: [...yearCounts.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year),
  };
}

export function searchNotes(raw: string) {
  const query = parseQuery(raw);
  const rows = db().prepare(`
    SELECT n.*, c.title AS course_title, c.dept_code
    FROM notes n JOIN courses c ON c.code = n.course_code
  `).all() as Record<string, string | number>[];

  const scored = rows
    .map((r) => {
      const haystack = tokenize(`${r.title} ${r.course_title} ${r.course_code} ${r.kind}`);
      const bag = new Set(haystack);
      let score = 0;
      for (const { term, weight } of query.expandedTerms) if (bag.has(term)) score += weight;
      return { row: r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.row);

  return scored;
}
