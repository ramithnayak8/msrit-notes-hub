
/**
 * Rule-based query understanding, so search needs no language model.
 * Structured parts of the query (years, course, branch, semester, marks, exam
 * type) become exact filters; what's left is the topic, which is what gets
 * embedded and keyword-matched. Embeddings are poor at exact constraints
 * ("CS43", "10 marks", "last 3 years"), which is why these are pulled out first.
 */
export type SearchFilters = {
  yearFrom?: number;
  yearTo?: number;
  courseCodes?: string[];
  branch?: string;
  semester?: number;
  marks?: number;
  minMarks?: number;
  examType?: string;
  kind?: 'question' | 'note';
};

export type ParsedQuery = {
  raw: string;
  /** The topic part of the query, sent to the vector and keyword searches. */
  text: string;
  filters: SearchFilters;
  /** Human-readable notes on what was understood, for the UI. */
  understood: string[];
};

/**
 * A course the parser can recognise. `filterCodes` are the paper course codes
 * a mention of it should filter to (see catalog.ts); defaults to its own code.
 */
export type Course = { code: string; title: string; filterCodes?: string[] };
const filterCodesOf = (c: Course) => c.filterCodes ?? [c.code.toUpperCase()];

const BRANCHES: Record<string, string> = {
  cse: 'CSE', cs: 'CSE', ise: 'ISE', is: 'ISE', aiml: 'AIML', 'ai&ml': 'AIML', 'ai-ml': 'AIML', aids: 'AIDS', 'ai&ds': 'AIDS',
  ece: 'ECE', ec: 'ECE', eee: 'EEE', eie: 'EIE', ete: 'ETE', me: 'ME', mech: 'ME', civil: 'CV', cv: 'CV', bt: 'BT', cyber: 'CY', cy: 'CY',
};

const FILLER = new Set(
  'a an the of on in for about from to and or with show me give list find all any some questions question qs pyq pyqs papers paper asked previous year years important imp repeated topic topics related please what which how why when is are do does can i'.split(' '),
);
const TITLE_STOP = new Set(['and', 'of', 'to', 'using', 'with', 'in', 'the', 'for', '&']);

/** "Design and Analysis of Algorithms" -> "DAA" */
export function acronym(title: string) {
  return title
    .split(/[\s\-/]+/)
    .filter((w) => w && !TITLE_STOP.has(w.toLowerCase()) && /^[A-Za-z]/.test(w))
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function parseQuery(raw: string, courses: Course[] = [], now = new Date()): ParsedQuery {
  const filters: SearchFilters = {};
  const understood: string[] = [];
  let q = ` ${raw.trim()} `;
  const take = (re: RegExp) => {
    const m = q.match(re);
    if (m) q = q.replace(m[0], ' ');
    return m;
  };
  const year = now.getFullYear();

  // ── Years ──
  let m = take(/\b(?:last|past|previous)\s+(\d{1,2}|two|three|four|five)\s+years?\b/i);
  if (m) {
    const n = { two: 2, three: 3, four: 4, five: 5 }[m[1]!.toLowerCase()] ?? +m[1]!;
    filters.yearFrom = year - n + 1;
    understood.push(`from ${filters.yearFrom}`);
  }
  if ((m = take(/\b((?:19|20)\d{2})\s*(?:-|–|to|till|until)\s*((?:19|20)\d{2})\b/i))) {
    filters.yearFrom = Math.min(+m[1]!, +m[2]!);
    filters.yearTo = Math.max(+m[1]!, +m[2]!);
    understood.push(`${filters.yearFrom}–${filters.yearTo}`);
  }
  if ((m = take(/\b(?:since|after|from)\s+((?:19|20)\d{2})\b/i))) {
    filters.yearFrom = +m[1]! + (/after/i.test(m[0]) ? 1 : 0);
    understood.push(`from ${filters.yearFrom}`);
  }
  if ((m = take(/\b(?:before|until|till)\s+((?:19|20)\d{2})\b/i))) {
    filters.yearTo = +m[1]! - (/before/i.test(m[0]) ? 1 : 0);
    understood.push(`up to ${filters.yearTo}`);
  }
  if ((m = take(/\b(?:in\s+)?((?:19|20)\d{2})\b/i))) {
    filters.yearFrom = filters.yearTo = +m[1]!;
    understood.push(`year ${m[1]}`);
  }

  // ── Marks ──
  if ((m = take(/\b(?:above|over|more than|at least|>=?)\s*(\d{1,2})\s*-?\s*marks?\b|\b(\d{1,2})\s*\+\s*marks?\b/i))) {
    filters.minMarks = +(m[1] ?? m[2])!;
    understood.push(`${filters.minMarks}+ marks`);
  } else if ((m = take(/\b(\d{1,2})\s*-?\s*(?:marks?|marker|m)\b/i))) {
    filters.marks = +m[1]!;
    understood.push(`${filters.marks} marks`);
  }

  // ── Semester ──
  if ((m = take(/\b(?:sem(?:ester)?\s*-?\s*([1-8])|([1-8])(?:st|nd|rd|th)?\s*sem(?:ester)?)\b/i))) {
    filters.semester = +(m[1] ?? m[2])!;
    understood.push(`semester ${filters.semester}`);
  }

  // ── Exam type ──
  if ((m = take(/\b(SEE|end\s*sem(?:ester)?(?:\s*exams?)?|semester\s*end)\b/i))) (filters.examType = 'SEE'), understood.push('SEE papers');
  else if ((m = take(/\b(CIE|internals?|internal\s*assessment)\b/i))) (filters.examType = 'CIE'), understood.push('CIE papers');
  else if ((m = take(/\b(make\s*-?up|supplementary)\b/i))) (filters.examType = 'Makeup'), understood.push('make-up papers');

  // ── Notes vs questions ──
  if (take(/\bnotes?\b/i)) (filters.kind = 'note'), understood.push('notes');

  // ── Course: code, full title, or acronym ──
  // A course only becomes a filter if it leads to papers; otherwise its name
  // stays in the text and is searched as a topic ("Edge Computing" with no
  // papers yet still finds related questions).
  const codes = new Set<string>();
  let courseTitle: string | undefined;
  for (const c of courses) {
    const code = c.code.toUpperCase();
    const re = new RegExp(`\\b${code}\\b`, 'i');
    if (re.test(q) && filterCodesOf(c).length) {
      filterCodesOf(c).forEach((x) => codes.add(x));
      courseTitle ??= c.title;
    }
  }
  if (codes.size) for (const code of codes) q = q.replace(new RegExp(`\\b${code}\\b`, 'ig'), ' ');
  if (!codes.size) {
    const byTitle = [...courses].sort((a, b) => b.title.length - a.title.length);
    for (const c of byTitle) {
      const title = c.title.toLowerCase();
      if (title.length > 3 && q.toLowerCase().includes(title)) {
        for (const x of courses) if (x.title.toLowerCase() === title) filterCodesOf(x).forEach((code) => codes.add(code));
        if (codes.size) {
          courseTitle = c.title;
          q = q.replace(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
        }
        break;
      }
    }
  }
  if (!codes.size) {
    for (const token of q.split(/\s+/).filter((t) => /^[A-Za-z]{2,6}$/.test(t))) {
      const matches = courses.filter((c) => acronym(c.title).length >= 2 && acronym(c.title) === token.toUpperCase());
      // Only uppercase tokens count as acronyms ("DAA", "ML"), so ordinary words like "ds" in text don't.
      const target = matches.flatMap(filterCodesOf);
      if (target.length && token === token.toUpperCase()) {
        target.forEach((c) => codes.add(c));
        courseTitle = matches[0]!.title;
        q = q.replace(new RegExp(`\\b${token}\\b`), ' ');
        break;
      }
    }
  }
  if (codes.size) {
    filters.courseCodes = [...codes];
    understood.push(`course ${courseTitle ?? ''} (${filters.courseCodes.join(', ')})`.replace('  ', ' '));
  }

  // ── Branch ──
  for (const token of q.split(/\s+/)) {
    const b = BRANCHES[token.toLowerCase()];
    // Two-letter forms are ordinary words too ("is", "me"), so they only count in capitals.
    if (b && (token.length > 2 || token === token.toUpperCase())) {
      filters.branch = b;
      understood.push(`${b} branch`);
      q = q.replace(new RegExp(`(^|\\s)${token.replace(/[&]/g, '\\&')}(?=\\s|$)`), ' ');
      break;
    }
  }

  const text = q
    .replace(/[?!.,;:]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w.toLowerCase()))
    .join(' ')
    .trim();
  return { raw, text, filters, understood };
}
