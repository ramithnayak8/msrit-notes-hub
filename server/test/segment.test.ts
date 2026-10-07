import { describe, expect, it } from 'vitest';
import type { PageText } from '../src/ingestion/extract.js';
import { extractHeaderMeta, LOW_CONFIDENCE, segmentPaper, takeLineMeta } from '../src/ingestion/segment.js';

const page = (text: string, n = 1): PageText => ({ page: n, text, source: 'text-layer' });

// Synthetic paper in the MSRIT SEE layout (tabs mark table-cell gaps, as extract.ts produces).
const HEADER = `CS43
USN 1 M S
(Autonomous Institute, Affiliated to VTU)
SEMESTER END EXAMINATIONS – AUGUST / SEPTEMBER 2023
B.E. - Computer Science and
Program\t:\tSemester\t: IV
Engineering
Course Name\t: Design and Analysis of Algorithms\tMax. Marks : 100
Course Code\t: CS43\tDuration\t: 3 Hrs
Instructions to the Candidates:
Answer one full question from each unit.
UNIT - I`;

const BODY = `1.\ta) With example explain worst case, best case and average case timing CO1 (06)
with example.
b) Explain the various Asymptotic notations with example.\tCO1 (10)
c) List out the steps in mathematical analysis of non-recursive algorithms.\tCO1 (04)
2.\ta) Explain with example stable matching algorithm.\tCO1 (10)
b) Discuss linear time and quadratic time with examples.\tCO1 (10)
UNIT - II
3. a) Find the number of inversions for the following set of numbers.\tCO2 (08)
55\t66\t44\t77
b) Write the functions for the following traversals:\tCO2 (12)
i) Inorder Traversal
ii) Breadth First Traversal.
4 \ta) Prove that merge sort is O(n log n).\tCO2 (10)
b) Explain the knapsack problem.\tCO2 (10)`;

describe('extractHeaderMeta', () => {
  it('reads course, exam and branch from an SEE header', () => {
    const meta = extractHeaderMeta(HEADER);
    expect(meta).toMatchObject({
      courseCode: 'CS43',
      courseTitle: 'Design and Analysis of Algorithms',
      semester: 4,
      examType: 'SEE',
      month: 'August–September',
      year: 2023,
      maxMarks: 100,
      branch: 'CSE',
    });
  });

  it('joins a title that wraps around its label line', () => {
    const meta = extractHeaderMeta('Introduction to Data Structures and\nCourse Name\t:\tMax. Marks : 100\nAlgorithms\nCourse Code\t: CSOE06');
    expect(meta.courseTitle).toBe('Introduction to Data Structures and Algorithms');
    expect(meta.courseCode).toBe('CSOE06');
  });

  it('recognises a CIE paper and dates it from the test date', () => {
    const meta = extractHeaderMeta('Internal Assessment Question Paper\nCourse Name: Unix Shell Programming\tCourseCode:CSAEC310\nDate:03.01.2024');
    expect(meta).toMatchObject({ examType: 'CIE', year: 2024, month: 'January', courseCode: 'CSAEC310', courseTitle: 'Unix Shell Programming' });
  });
});

describe('takeLineMeta', () => {
  it('strips CO and marks from the end of a line', () => {
    expect(takeLineMeta('Explain deadlock.\tCO2 (08)')).toEqual({ text: 'Explain deadlock.', marks: 8, co: 'CO2', bloom: undefined });
  });
  it('reads table cells for marks and Bloom level', () => {
    expect(takeLineMeta('Explain the architecture of UNIX.\t3\tL2')).toMatchObject({ text: 'Explain the architecture of UNIX.', marks: 3, bloom: 'L2' });
  });
});

describe('segmentPaper', () => {
  const result = segmentPaper([page(`${HEADER}\n${BODY}`)]);
  const byLabel = Object.fromEntries(result.segments.map((s) => [s.label, s]));

  it('splits every part into its own question', () => {
    expect(result.parsed).toBe(true);
    expect(result.segments.map((s) => s.label)).toEqual(['Q1(a)', 'Q1(b)', 'Q1(c)', 'Q2(a)', 'Q2(b)', 'Q3(a)', 'Q3(b)', 'Q4(a)', 'Q4(b)']);
  });

  it('joins continuation lines and reads marks, CO and unit', () => {
    expect(byLabel['Q1(a)']).toMatchObject({
      text: 'With example explain worst case, best case and average case timing with example.',
      marks: 6,
      co: 'CO1',
      unit: 1,
    });
    expect(byLabel['Q3(a)']!.unit).toBe(2);
  });

  it('does not mistake table rows for questions', () => {
    expect(byLabel['Q3(a)']!.text).toContain('55 66 44 77');
  });

  it('keeps unmarked sub-parts inside their question', () => {
    expect(byLabel['Q3(b)']!.text).toBe('Write the functions for the following traversals: (i) Inorder Traversal (ii) Breadth First Traversal.');
  });

  it('accepts a question number without a dot before part (a)', () => {
    expect(byLabel['Q4(a)']).toMatchObject({ marks: 10, text: 'Prove that merge sort is O(n log n).' });
  });

  it('gives clean questions full confidence', () => {
    expect(result.segments.every((s) => s.confidence === 1)).toBe(true);
  });

  it('flags a question whose parts do not add up', () => {
    // Q3's part (b) is lost (its marker is garbled), so Q3 totals 8, not 20 like the rest.
    const broken = BODY.replace('b) Write the functions', '# Write the functions').replace('CO2 (12)', '');
    const r = segmentPaper([page(`${HEADER}\n${broken}\n5. a) One.\tCO3 (10)\nb) Two.\tCO3 (10)`)]);
    const q3 = r.segments.filter((s) => s.q === 3);
    expect(q3.every((s) => s.confidence < LOW_CONFIDENCE && s.flags.includes('marks-dont-add-up'))).toBe(true);
    expect(r.segments.filter((s) => s.q === 1).every((s) => s.confidence === 1)).toBe(true);
  });

  it('splits sub-parts that carry their own marks', () => {
    const r = segmentPaper([page(`${HEADER}\n1. a) i) Write Lagrange's formula.\t(02)\nii) Prove the identity.\t(03)\nb) Determine f(x).\t(08)\n2. a) x\t(10)\nb) y\t(10)`)]);
    expect(r.segments.slice(0, 3).map((s) => [s.label, s.marks])).toEqual([
      ['Q1(a)(i)', 2],
      ['Q1(a)(ii)', 3],
      ['Q1(b)', 8],
    ]);
  });

  it('removes running headers and page footers across pages', () => {
    const r = segmentPaper([page(`${HEADER}\n1. a) First part.\tCO1 (10)\nPage 1 of 2`, 1), page(`CS43\nb) Second part.\tCO1 (10)\nPage 2 of 2`, 2)]);
    expect(r.segments.map((s) => s.text)).toEqual(['First part.', 'Second part.']);
  });

  it('reports an unparseable paper so the fallback can take over', () => {
    const r = segmentPaper([page('Internal Assessment\nSL. No. Questions CO\nWhich command lists files?\na) ls b) cd c) pwd d) wc')]);
    expect(r.parsed).toBe(false);
  });
});
