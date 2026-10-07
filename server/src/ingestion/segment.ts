/**
 * Rule-based question segmentation for MSRIT papers.
 *
 * Works line by line on the text from extract.ts. A line can start a question
 * ("1." / "Q1)"), a part ("a)" / "(b)"), a sub-part ("i)" / "(ii)"), a unit
 * heading ("UNIT - II"), or continue whatever came before. A numbering marker
 * only counts if it is the *next expected* one (1 -> 2, a -> b), which is what
 * stops table rows ("2  3  12") and MCQ options ("a) cd  b) echo") from being
 * mistaken for questions. Marks, CO and Bloom's level are read from the end of
 * lines ("... CO2 (08)").
 *
 * Each question gets a confidence score from numbering continuity, length,
 * missing marks and junk characters. Low-confidence questions (or a whole
 * paper the parser can't follow) are sent to the language model fallback.
 */
import type { PageText } from './extract.js';

export type Segment = {
  label: string;
  q?: number;
  part?: string;
  sub?: string;
  unit?: number;
  text: string;
  marks?: number;
  co?: string;
  bloom?: string;
  page: number;
  confidence: number;
  flags: string[];
};

export type HeaderMeta = {
  courseCode?: string;
  courseTitle?: string;
  semester?: number;
  examType?: 'SEE' | 'CIE' | 'Makeup';
  month?: string;
  year?: number;
  maxMarks?: number;
  branch?: string;
};

export type SegmentResult = {
  meta: HeaderMeta;
  segments: Segment[];
  /** False when the paper as a whole couldn't be followed (send it all to the fallback). */
  parsed: boolean;
  bodyText: string;
};

export const LOW_CONFIDENCE = 0.6;

type Line = { text: string; page: number };

// ── Normalisation ──────────────────────────────────────────────────────────

const FOOTER = /^(page\s*\d+\s*(of\s*\d+)?|\*{3,}|-{3,}|_{3,}|\d+\s*\|\s*page|ALL THE BEST\.?)$/i;
const FIGURE = /^fig(ure)?\.?\s*\d+\s*(\(?[a-z]\)?)?\.?$/i;

/**
 * Join pages into lines, dropping running headers/footers: anything that
 * repeats on most pages (the course code at the top, "Page 1 of 3").
 */
export function normalisePages(pages: PageText[]): Line[] {
  const perPage = pages.map((p) => p.text.split('\n').map((l) => l.trim()).filter(Boolean));
  // Running headers/footers live in the first or last few lines of a page.
  const EDGE = 3;
  const edges = (lines: string[]) => new Set([...lines.slice(0, EDGE), ...lines.slice(-EDGE)]);
  const counts = new Map<string, number>();
  for (const lines of perPage) for (const l of edges(lines)) counts.set(l, (counts.get(l) ?? 0) + 1);
  const repeated = (l: string) => pages.length >= 2 && (counts.get(l) ?? 0) >= Math.max(2, Math.ceil(pages.length * 0.5)) && l.length < 60;

  const out: Line[] = [];
  perPage.forEach((lines, i) => {
    lines.forEach((l, j) => {
      const atEdge = j < EDGE || j >= lines.length - EDGE;
      if (FOOTER.test(l.replace(/\t/g, ' ')) || FIGURE.test(l) || (atEdge && repeated(l))) return;
      out.push({ text: l, page: pages[i]!.page });
    });
  });
  return out;
}

// ── Header metadata ────────────────────────────────────────────────────────

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
export const romanToInt = (s: string) => ROMAN[s.toUpperCase()] ?? (Number.isFinite(+s) ? +s : undefined);

const BRANCHES: [RegExp, string][] = [
  [/artificial intelligence\s*(and|&)\s*machine learning|\bAI\s*&?\s*ML\b/i, 'AIML'],
  [/artificial intelligence\s*(and|&)\s*data science/i, 'AIDS'],
  [/cyber\s*security/i, 'CY'],
  [/computer science/i, 'CSE'],
  [/information science/i, 'ISE'],
  [/electronics\s*(and|&)\s*communication/i, 'ECE'],
  [/electrical\s*(and|&)\s*electronics/i, 'EEE'],
  [/electronics\s*(and|&)\s*instrumentation/i, 'EIE'],
  [/telecommunication/i, 'ETE'],
  [/mechanical/i, 'ME'],
  [/civil/i, 'CV'],
  [/chemical/i, 'CH'],
  [/biotechnology/i, 'BT'],
];

/** A header line that holds a "Label : value" field, as opposed to a wrapped value. */
// "Durat[il]on": OCR'd text layers misread the i ("Duratlon").
const LABELLED = /\b(program(me)?|semester|course|subject|max\s*\.?\s*marks|durat[il1]on|instructions|usn|branch|credits|term|date)\b.*:|^(course|subject)\s*code|^max\s*\.?\s*marks|instructions/i;
/** Other fields printed on the same line as the one we want, to cut off. */
const OTHER_FIELDS = /\s*(Max\s*\.?\s*Marks|Semester|Durat[il1]on|Course\s*Code|Subject\s*Code|CourseCode)\b.*$/i;

/**
 * Read a header field. In the MSRIT template the value cell is vertically
 * centred, so a two-line value wraps *around* its label line:
 *   "Introduction to Data Structures and" / "Course Name : : Max. Marks : 100" / "Algorithms".
 * Unlabelled neighbour lines are taken as the wrapped parts of the value.
 */
function headerField(lines: string[], label: RegExp): string | undefined {
  const i = lines.findIndex((l) => label.test(l));
  if (i < 0) return undefined;
  const own = lines[i]!.replace(new RegExp(`^.*?(?:${label.source})\\s*[:.]?\\s*:?`, 'i'), '').replace(OTHER_FIELDS, '').replace(/^[:\s]+|[:\s]+$/g, '');
  const before = lines[i - 1]?.trim() ?? '';
  let after = lines[i + 1]?.trim() ?? '';
  // The other column's label can sit between a value and its wrapped tail:
  // "Course Name  Research Methodology and Intellectual" / "Max. Marks : 100" / "Property Rights".
  if (/^max\s*\.?\s*marks/i.test(after)) after = lines[i + 2]?.trim() ?? '';
  const free = (l: string) => l.length > 1 && !LABELLED.test(l) && !/^(USN|RAMAIAH|\(|Accredited|SEMESTER END)/i.test(l);
  // A value that is empty or starts with "/" continues from the line above.
  const needsBefore = own === '' || own.startsWith('/');
  const parts = [needsBefore && free(before) ? before : '', own, free(after) ? after : ''];
  const value = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return value || undefined;
}

export function extractHeaderMeta(header: string): HeaderMeta {
  const meta: HeaderMeta = {};
  const flat = header.replace(/\t/g, ' ');
  const lines = flat.split('\n').map((l) => l.trim());

  // "EI52/EI52(O)" and "CI33 / CY33" are shared papers; the first code is the primary one.
  // "21/22/23/AL58" lists scheme years before the code, so take the first token that has letters.
  const firstCode = (s: string | undefined) => s?.toUpperCase().match(/\b(\d{0,2}[A-Z]{2,6}\d{2,3}[A-Z]?)\b/)?.[1];
  const codeLine = flat.match(/(?:Course|Subject)\s*Code\s*:?\s*:?\s*([^\n]*)/i)?.[1]?.replace(OTHER_FIELDS, '');
  const code = firstCode(codeLine) ?? firstCode(lines[0]);
  if (code) meta.courseCode = code;

  const title = headerField(lines, /(?:Course|Subject)\s*Name|^Subject(?!\s*Code)/i);
  if (title) meta.courseTitle = title;

  const sem = flat.match(/Semester\s*:?\s*:?\s*([IVX]{1,4}|\d)\b/i)?.[1];
  if (sem) meta.semester = romanToInt(sem);

  // "SEMESTER END / BACKLOG SUBJECT EXAMINATIONS" is still the SEE.
  if (/semester\s*end/i.test(flat)) meta.examType = 'SEE';
  if (/make\s*-?\s*up|supplementary|re\s*-?\s*registered/i.test(flat)) meta.examType = 'Makeup';
  if (!meta.examType && /internal\s*assessment|\bCIE\b|\btest\s*[- ]?\d/i.test(flat)) meta.examType = 'CIE';

  const exam = flat.match(new RegExp(`(${MONTHS.join('|')})(?:\\s*[-–/]\\s*(${MONTHS.join('|')}))?\\s*,?\\s*((?:19|20)\\d{2})`, 'i'));
  if (exam) {
    meta.month = exam[2] ? `${cap(exam[1]!)}–${cap(exam[2])}` : cap(exam[1]!);
    meta.year = +exam[3]!;
  } else {
    const date = flat.match(/Date\s*:?\s*\d{1,2}[./-](\d{1,2})[./-]((?:19|20)\d{2})/i);
    if (date) {
      meta.month = cap(MONTHS[+date[1]! - 1] ?? '');
      meta.year = +date[2]!;
    }
  }

  const max = flat.match(/Max(?:imum)?\.?\s*Marks\s*:?\s*(\d{2,3})/i)?.[1];
  if (max) meta.maxMarks = +max;

  const pi = lines.findIndex((l) => /^(Program(me)?|Course\s*&\s*Branch|Branch)\b/i.test(l));
  const program = pi >= 0 ? lines.slice(Math.max(0, pi - 1), pi + 2).join(' ') : flat;
  for (const [re, b] of BRANCHES) {
    if (re.test(program)) {
      meta.branch = b;
      break;
    }
  }
  if (/common to all/i.test(program)) delete meta.branch;
  return meta;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1).toLowerCase() : s);

// ── Line classification ────────────────────────────────────────────────────

// "1." / "Q1)" but not "3.0 from the following" (a decimal at the start of a wrapped line).
// ":" too, an OCR misread of "." ("12: Ecosystem is...").
const Q_START = /^(?:Q(?:uestion)?\s*\.?\s*(?:No\.?)?\s*)?(\d{1,2})\s*[.):](?!\d)\s*(.*)$/i;
// "2  a) Define ..." with no dot after the number: only valid straight before part (a).
const Q_BARE_PART = /^(\d{1,2})\s+(\(?\s*a\s*\).*)$/;
const Q_PART_COMPACT = /^(\d{1,2})\s*\(\s*([a-h])\s*\)\s*(.*)$/i; // "1(b) Explain..."
const PART = /^(?:\(\s*([a-h])\s*\)|([a-h])\s*\)|([a-h])\.\s)\s*(.*)$/;
const SUB = /^\(?\s*(x|ix|iv|v?i{1,3}|v)\s*\)\s*(.*)$/i;
// Matched anywhere in a short line: OCR leaves junk before headings ("$a UNIT - I").
const UNIT = /\bunit\s*[-–:]?\s*([IVX]{1,4}|\d{1,2})\b/i;
const isUnitLine = (flat: string) => flat.length < 25 && UNIT.test(flat);
const SECTION = /^(section|part)\s*[-–:]?\s*([IVX]{1,4}|[A-C]|\d)\b/i;
const OR_LINE = /^(\(?\s*or\s*\)?|-+\s*or\s*-+)$/i;
const MULTI_OPTION = /(?:^|\s)\(?[a-d]\s*\)[^()]*\s\(?[b-d]\s*\)/; // "a) cd  b) echo"

const ROMANS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
const nextLetter = (c?: string) => (c ? String.fromCharCode(c.charCodeAt(0) + 1) : 'a');
const nextRoman = (r?: string) => (r ? ROMANS[ROMANS.indexOf(r) + 1] : 'i');

/** Pull "CO2", "L3", "(08)" off a line. */
export function takeLineMeta(raw: string): { text: string; marks?: number; co?: string; bloom?: string } {
  let text = raw;
  let marks: number | undefined;
  let co: string | undefined;
  let bloom: string | undefined;

  const m1 = text.match(/[([]\s*(\d{1,2})\s*(?:M|marks?)?\s*[)\]]\s*$/i);
  if (m1) {
    marks = +m1[1]!;
    text = text.slice(0, m1.index).trimEnd();
  }

  // Table cells after the question text: "CO1 ⇥ L2 ⇥ 6", in any order.
  for (;;) {
    const cell = text.match(/(?:^|[\t ,])(CO\s*-?\s*\d{1,2}|B?L\s*-?\s*[1-6]|\d{1,2}(?:\s*M(?:arks?)?)?)\s*,?\s*$/i);
    if (!cell || cell.index === undefined) break;
    const token = cell[1]!.replace(/\s|-/g, '').toUpperCase();
    const before = text.slice(0, cell.index);
    if (token.startsWith('CO') && !co) co = 'CO' + token.slice(2);
    else if (/^B?L[1-6]$/.test(token) && !bloom && (co || marks !== undefined || /\t/.test(cell[0]))) bloom = 'L' + token.at(-1);
    // A bare number is a marks cell only next to question words, not at the end of a data row ("55 66 44 77").
    else if (/^\d{1,2}(M|MARKS?)?$/.test(token) && marks === undefined && (co || bloom || /\t/.test(cell[0]) || /M/.test(token)) && /[A-Za-z]{2,}/.test(before))
      marks = parseInt(token, 10);
    else break;
    text = before.trimEnd();
  }

  // CO with marks before it, mid-line: "... CO2 (08)" already handled; also "CO1, (05)".
  const coMid = text.match(/[\t ]CO\s*-?\s*(\d{1,2})\s*,?\s*$/i);
  if (coMid && !co) {
    co = 'CO' + coMid[1];
    text = text.slice(0, coMid.index).trimEnd();
  }
  return { text: text.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim(), marks, co, bloom };
}

const OCR_DIGIT: Record<string, string> = { l: '1', i: '1', I: '1', z: '2', Z: '2' };

/**
 * Undo common OCR misreads in the markers the parser relies on:
 * "¢)" / "©)" / "€)" for "c)", "B)" for "b)", and "co1" / "COo1" / "coi" / "COZ" for "CO1" / "CO2".
 */
export function fixOcrMarkers(line: string) {
  return line
    .replace(/^[|!+*•«$~]+\s*/, '')
    .replace(/^\s*\(?\s*[¢©€]\s*\)/, 'c)')
    .replace(/^\s*\(?\s*([A-H])\s*\)\s/, (_, l: string) => `${l.toLowerCase()}) `)
    .replace(/\b[cC][oO0][oO0]?\s*-?\s*([0-9lIiZz])\b/g, (_, d: string) => `CO${OCR_DIGIT[d] ?? d}`);
}

// ── Parser ─────────────────────────────────────────────────────────────────

type Node = {
  q: number;
  part?: string;
  sub?: string;
  unit?: number;
  page: number;
  lines: string[];
  marks?: number;
  co?: string;
  bloom?: string;
  flags: string[];
  children: Node[];
};

export function segmentPaper(pages: PageText[]): SegmentResult {
  const lines = normalisePages(pages);

  // Everything before question 1 is the header.
  const qNumberAt = (l: Line) => {
    const m = l.text.replace(/\t/g, ' ').match(Q_START) ?? l.text.match(Q_PART_COMPACT);
    return m ? +m[1]! : undefined;
  };
  let firstQ = lines.findIndex((l) => qNumberAt(l) === 1);
  // OCR sometimes garbles "1. a)" itself ("+8) Describe..."). If question 2 is
  // there, the body starts after the first UNIT heading and question 1 is implied.
  let impliedQ1 = false;
  if (firstQ < 0) {
    const unitAt = lines.findIndex((l) => isUnitLine(l.text.replace(/\t/g, ' ').trim()));
    if (unitAt >= 0 && lines.some((l, i) => i > unitAt && qNumberAt(l) === 2)) {
      firstQ = unitAt + 1;
      impliedQ1 = true;
    }
  }
  const headerLines = firstQ >= 0 ? lines.slice(0, firstQ) : lines.slice(0, 15);
  const meta = extractHeaderMeta(headerLines.map((l) => l.text).join('\n'));
  const body = firstQ >= 0 ? lines.slice(firstQ) : [];
  const bodyText = body.map((l) => l.text).join('\n');

  const questions: Node[] = [];
  // "UNIT - I" is printed just above question 1, so it ends up at the bottom of the header.
  const headUnit = headerLines
    .slice(-3)
    .map((l) => l.text.replace(/\t/g, ' ').trim())
    .filter(isUnitLine)
    .map((l) => l.match(UNIT))
    .find(Boolean);
  let unit: number | undefined = headUnit ? romanToInt(headUnit[1]!) : undefined;
  let curQ: Node | undefined;
  let curPart: Node | undefined;
  let curSub: Node | undefined;

  const current = () => curSub ?? curPart ?? curQ;
  const addMeta = (n: Node, m: ReturnType<typeof takeLineMeta>) => {
    if (m.marks !== undefined && n.marks === undefined) n.marks = m.marks;
    if (m.co && !n.co) n.co = m.co;
    if (m.bloom && !n.bloom) n.bloom = m.bloom;
  };

  const startQ = (q: number, page: number, rest: string, jumped: boolean) => {
    curQ = { q, unit, page, lines: [], flags: jumped ? ['numbering-gap'] : [], children: [] };
    curPart = curSub = undefined;
    questions.push(curQ);
    if (rest) handleRest(rest, page);
  };

  const startPart = (letter: string, page: number, rest: string) => {
    curPart = { q: curQ!.q, part: letter, unit, page, lines: [], flags: [], children: [] };
    curSub = undefined;
    // "1.  CO1 (10)" with the text on the next line as "a) ...": the marks belong to part (a).
    if (!curQ!.children.length && !curQ!.lines.length) {
      for (const k of ['marks', 'co', 'bloom'] as const) {
        if (curQ![k] !== undefined) {
          (curPart as Record<string, unknown>)[k] = curQ![k];
          delete curQ![k];
        }
      }
    }
    curQ!.children.push(curPart);
    if (rest) handleRest(rest, page);
  };

  const startSub = (roman: string, page: number, rest: string) => {
    const parent = curPart ?? curQ!;
    curSub = { q: curQ!.q, part: curPart?.part, sub: roman, unit, page, lines: [], flags: [], children: [] };
    parent.children.push(curSub);
    if (rest) appendText(rest);
  };

  const appendText = (raw: string) => {
    const node = current();
    if (!node) return;
    const m = takeLineMeta(raw);
    addMeta(node, m);
    if (m.text) node.lines.push(m.text);
  };

  // What follows a question/part marker on the same line: maybe a part or sub marker.
  const handleRest = (rest: string, page: number) => {
    const flat = rest.replace(/\t/g, ' ').trim();
    const p = flat.match(PART);
    const letter = p && (p[1] ?? p[2] ?? p[3])!;
    if (letter && !curPart && letter === 'a' && !MULTI_OPTION.test(flat)) return startPart('a', page, p![4]!);
    const s = flat.match(SUB);
    if (s && s[1]!.toLowerCase() === 'i' && !curSub) return startSub('i', page, s[2]!);
    appendText(rest);
  };

  for (const line of body) {
    const { page } = line;
    const text = fixOcrMarkers(line.text);
    const flat = text.replace(/\t/g, ' ').trim();
    if (OR_LINE.test(flat)) continue;

    if (isUnitLine(flat)) {
      unit = romanToInt(flat.match(UNIT)![1]!);
      continue;
    }
    if (SECTION.test(flat) && flat.length < 40) continue;

    // Question 1's own marker was unreadable: open it implicitly, flagged so the fallback checks it.
    if (!curQ && impliedQ1 && qNumberAt(line) !== 1) {
      startQ(1, page, '', true);
      curQ!.flags.push('number-unreadable');
    }

    const expectedQ = (curQ?.q ?? 0) + 1;

    const compact = flat.match(Q_PART_COMPACT);
    if (compact) {
      const n = +compact[1]!;
      const letter = compact[2]!.toLowerCase();
      if (n === expectedQ && letter === 'a') {
        startQ(n, page, '', false);
        startPart('a', page, compact[3]!);
        continue;
      }
      if (curQ && n === curQ.q && letter === nextLetter(curPart?.part)) {
        startPart(letter, page, compact[3]!);
        continue;
      }
    }

    const bare = flat.match(Q_BARE_PART);
    if (bare && +bare[1]! === expectedQ) {
      startQ(expectedQ, page, bare[2]!, false);
      continue;
    }

    const qm = flat.match(Q_START);
    if (qm) {
      const n = +qm[1]!;
      // Accept the next number, or one number skipped (flagged), never a step backwards.
      if (n === expectedQ || (n === expectedQ + 1 && curQ)) {
        startQ(n, page, text.replace(/^[^\d]*\d{1,2}\s*[.)]\s*/, ''), n !== expectedQ);
        continue;
      }
    }

    if (curQ && !MULTI_OPTION.test(flat)) {
      const pm = flat.match(PART);
      const letter = pm && (pm[1] ?? pm[2] ?? pm[3])!;
      if (letter && letter === nextLetter(curPart?.part)) {
        startPart(letter, page, text.replace(/^\s*\(?\s*[a-h]\s*[.)]\s*/, ''));
        continue;
      }
      const sm = flat.match(SUB);
      if (sm) {
        const roman = sm[1]!.toLowerCase();
        if (roman === nextRoman(curSub?.sub)) {
          startSub(roman, page, text.replace(/^\s*\(?\s*[ivx]+\s*\)\s*/i, ''));
          continue;
        }
      }
    }

    appendText(text);
  }

  const segments = flatten(questions);
  scoreSegments(segments);

  const covered = segments.reduce((s, x) => s + x.text.length, 0);
  const bodyChars = bodyText.replace(/\s/g, '').length;
  const parsed = segments.length >= 4 && (bodyChars === 0 || covered / bodyChars > 0.5);
  return { meta, segments, parsed, bodyText };
}

/**
 * Turn the question tree into leaf segments. Sub-parts become their own
 * questions only when they carry their own marks ("i) ... (02)  ii) ... (03)");
 * otherwise they're fragments of one question ("traverse: i) inorder ii) BFS")
 * and are folded back into their parent's text.
 */
function flatten(questions: Node[]): Segment[] {
  const out: Segment[] = [];

  const fold = (n: Node): string =>
    [n.lines.join(' '), ...n.children.map((c) => `(${c.sub ?? c.part}) ${fold(c)}`)].filter(Boolean).join(' ');

  const emit = (n: Node, stem: string, inherited: string[] = []) => {
    const isQuestion = n.part === undefined && n.sub === undefined;
    const splitChildren =
      n.children.length > 0 &&
      (n.children.filter((c) => c.marks !== undefined).length >= 2 || (isQuestion && n.children[0]?.part !== undefined && !isMcq(n)));
    if (splitChildren) {
      const own = n.lines.join(' ').trim();
      const childStem = [stem, own].filter(Boolean).join(' ');
      for (const c of n.children) emit(c, childStem, [...inherited, ...n.flags]);
      return;
    }
    const body = fold(n).trim();
    out.push({
      label: `Q${n.q}${n.part ? `(${n.part})` : ''}${n.sub ? `(${n.sub})` : ''}`,
      q: n.q,
      part: n.part,
      sub: n.sub,
      unit: n.unit,
      text: [stem, body].filter(Boolean).join(' — '),
      marks: n.marks ?? sumMarks(n),
      co: n.co ?? n.children.find((c) => c.co)?.co,
      bloom: n.bloom ?? n.children.find((c) => c.bloom)?.bloom,
      page: n.page,
      confidence: 1,
      flags: [...new Set([...inherited, ...n.flags])],
    });
  };

  for (const q of questions) emit(q, '');
  return out;
}

/**
 * A multiple-choice question: marks printed against the question, none against
 * its "parts", which are short options ("a) Abiotic factor", "b) Biotic factor").
 */
function isMcq(n: Node) {
  return (
    n.marks !== undefined &&
    n.children.length >= 2 &&
    n.children.every((c) => c.marks === undefined && c.children.length === 0 && c.lines.join(' ').length < 80)
  );
}

function sumMarks(n: Node): number | undefined {
  const marks = n.children.map((c) => c.marks).filter((m): m is number => m !== undefined);
  return marks.length ? marks.reduce((a, b) => a + b, 0) : undefined;
}

const JUNK = /[^A-Za-z0-9\s.,;:()'"?!\-+*/=<>%&_[\]{}^|$#@~`’‘“”–—…→←≤≥≠∑√π∞∈∪∩θλμσΣΔ]/g;

/**
 * In an MSRIT paper every main question is worth the same (20 marks in a SEE).
 * If a question's parts add up to something else, a part was probably missed
 * or merged into its neighbour, so all of that question's parts are suspect.
 */
function marksMismatches(segments: Segment[]): Set<number> {
  const totals = new Map<number, number>();
  for (const s of segments) if (s.q !== undefined && s.marks !== undefined) totals.set(s.q, (totals.get(s.q) ?? 0) + s.marks);
  if (totals.size < 4) return new Set();
  const freq = new Map<number, number>();
  for (const t of totals.values()) freq.set(t, (freq.get(t) ?? 0) + 1);
  const [mode, count] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]!;
  // Only trust the pattern when most questions follow it.
  if (count / totals.size < 0.6) return new Set();
  return new Set([...totals.entries()].filter(([, t]) => t !== mode).map(([q]) => q));
}

function scoreSegments(segments: Segment[]) {
  const mismatched = marksMismatches(segments);
  const withMarks = segments.filter((s) => s.marks !== undefined).length / Math.max(1, segments.length);
  const fragmented = new Set(segments.filter((s) => isFragmented(s.text)));
  const garbledDocument = fragmented.size / Math.max(1, segments.length) >= 0.3;
  for (const s of segments) {
    let c = 1;
    const len = s.text.length;
    if (len < 15) (c -= 0.45), s.flags.push('too-short');
    if (len > 900) (c -= 0.35), s.flags.push('too-long');
    if (s.marks === undefined && withMarks > 0.5) (c -= 0.2), s.flags.push('no-marks');
    if (s.marks !== undefined && (s.marks <= 0 || s.marks > 25)) (c -= 0.2), s.flags.push('odd-marks');
    const junk = (s.text.match(JUNK)?.length ?? 0) / Math.max(1, len);
    if (junk > 0.06) (c -= 0.35), s.flags.push('junk-characters');
    if (fragmented.has(s) && garbledDocument) (c -= 0.45), s.flags.push('fragmented-text');
    // A skipped number usually means the missing question was swallowed by the one before.
    if (s.flags.includes('numbering-gap')) c -= 0.45;
    if (s.q !== undefined && mismatched.has(s.q)) (c -= 0.45), s.flags.push('marks-dont-add-up');
    s.confidence = Math.max(0, Math.round(c * 100) / 100);
  }
}

/**
 * Garbled text breaks into lots of 1-character "words" ("i +n in_n5x<0 ... E").
 * So do questions with data tables ("Traverse: A B C D E"), so one fragmented
 * question means nothing; it only counts when a large share of the paper is
 * fragmented, i.e. the text layer itself is bad.
 */
function isFragmented(text: string) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const singles = tokens.filter((t) => t.length === 1 && /[A-Za-z0-9]/.test(t) && !/^[aAI]$/.test(t)).length;
  return tokens.length >= 8 && singles >= 3 && singles / tokens.length > 0.2;
}

// ── Notes ──────────────────────────────────────────────────────────────────

/** Notes aren't numbered questions; split them into ~800-character passages on paragraph boundaries. */
export function chunkNotes(pages: PageText[], target = 800): Segment[] {
  const out: Segment[] = [];
  for (const p of pages) {
    const paras = p.text.replace(/\t/g, ' ').split(/\n(?=[A-Z0-9•\-–])|\n\s*\n/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length > 0);
    let buf = '';
    let n = 1;
    const flush = () => {
      if (buf.trim().length >= 40) out.push({ label: `p.${p.page} §${n++}`, text: buf.trim(), page: p.page, confidence: p.source === 'ocr' ? 0.7 : 1, flags: [] });
      buf = '';
    };
    for (const para of paras) {
      if (buf.length + para.length > target && buf) flush();
      buf += (buf ? ' ' : '') + para;
    }
    flush();
  }
  return out;
}
