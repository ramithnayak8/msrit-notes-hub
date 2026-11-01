import { describe, expect, it } from 'vitest';
import { buildContext, cacheKey, describeScope, istDay, tidyAnswer } from '../src/assistant/grounded.js';
import type { SearchHit } from '../src/search/search.js';

const hit = (over: Partial<SearchHit> = {}): SearchHit => ({
  id: '1',
  label: 'Q1(a)',
  text: 'Explain Prim’s algorithm with an example.',
  kind: 'question',
  marks: 10,
  topics: [{ name: 'mst', label: 'Minimum Spanning Tree' }],
  course: { code: 'CS43', title: 'Design and Analysis of Algorithms' },
  year: 2023,
  examType: 'SEE',
  source: { documentId: 'd1', title: 'DAA SEE 2023' },
  recurrence: { count: 3, years: [2022, 2023] },
  score: 1,
  ranks: {},
  ...over,
});

const stats = {
  kpis: { questions: 56, papers: 2, courses: 1, topics: 30, totalMarks: 400, yearRange: { min: 2022, max: 2023 } },
  byYear: [],
  byExamType: [{ key: 'SEE', questions: 56, papers: 2, marks: 400 }],
  byUnit: [{ key: 1, questions: 10, papers: 2, marks: 80 }, { key: 2, questions: 12, papers: 2, marks: 0 }],
  byMarks: [{ key: 10, questions: 20, papers: 2, marks: 200 }],
  byBloom: [],
  topics: [{ topic: 'mst', label: 'Minimum Spanning Tree', questions: 4, papers: 2, totalMarks: 40, years: [2022, 2023] }],
  recurringCount: 2,
  recurring: [
    { text: 'Explain Prim’s algorithm with an example.', courseCode: 'CS43', courseTitle: 'DAA', papers: 3, questions: 3, years: [2022, 2023] },
    { text: 'State the master theorem.', courseCode: 'CS43', courseTitle: 'DAA', papers: 2, questions: 2, years: [2022, 2023] },
  ],
};

const cite = (h: SearchHit) => `${h.course.code} ${h.examType} ${h.year} ${h.label}`;

describe('assistant context', () => {
  it('numbers the matched questions, then repeats not already listed, then the statistics', () => {
    const { context, sources, questionCount } = buildContext('DAA, 2022–2023', stats, [hit()], cite);
    expect(questionCount).toBe(2);
    expect(sources.map((s) => s.kind)).toEqual(['question', 'question', 'stats']);
    expect(context).toContain('[1] CS43 SEE 2023 Q1(a) (10 marks; asked in 3 papers; topics: Minimum Spanning Tree)');
    expect(context).toContain('[2] Repeated in 2 papers (2022, 2023), DAA: State the master theorem.');
    expect(context).not.toMatch(/\[3\]/);
    expect(context).toContain('Marks by unit: Unit 1 80 (10 questions)'); // units with no marks are left out
    expect(context).toContain('Questions set in more than one paper: 2');
  });

  it('says so when no question matched', () => {
    const { context, questionCount } = buildContext('the whole archive', { ...stats, recurring: [] }, [], cite);
    expect(questionCount).toBe(0);
    expect(context).toContain('QUESTIONS\n(none matched)');
  });

  it('clips very long question text', () => {
    const { context } = buildContext('x', { ...stats, recurring: [] }, [hit({ text: 'a'.repeat(1000) })], cite);
    expect(context).toMatch(/a{319}…/);
  });
});

describe('tidyAnswer', () => {
  it('keeps the renderer subset: bullets as •, no headings', () => {
    expect(tidyAnswer('## Revise first\n- **MST** [1]\n* Greedy', 2)).toBe('Revise first\n• **MST** [1]\n• Greedy');
  });

  it('drops citations that point past the listed questions', () => {
    expect(tidyAnswer('Prim [1], Kruskal [3] and [0].', 2)).toBe('Prim [1], Kruskal  and .');
  });

  it('checks every number in a grouped citation', () => {
    expect(tidyAnswer('Traversals [1, 2,4] and [5, 6].', 4)).toBe('Traversals [1, 2, 4] and .');
  });

  it('collapses runs of blank lines', () => {
    expect(tidyAnswer('a\n\n\n\nb  \n', 0)).toBe('a\n\nb');
  });
});

describe('cacheKey', () => {
  it('ignores case, spacing, trailing punctuation and the result limit', () => {
    expect(cacheKey('What should I revise?', { course: 'CS43', limit: 10 })).toBe(cacheKey('  what should i   REVISE ', { course: 'CS43' }));
  });

  it('keeps page-scoped and question-scoped answers apart', () => {
    expect(cacheKey('revise', { course: 'CS43' }, true)).not.toBe(cacheKey('revise', { course: 'CS43' }, false));
  });

  it('differs by slice', () => {
    expect(cacheKey('revise', { course: 'CS43' })).not.toBe(cacheKey('revise', { course: 'IS43' }));
    expect(cacheKey('revise', { semester: 5 })).not.toBe(cacheKey('revise', {}));
  });
});

describe('describeScope', () => {
  it('names the course, semester, exam and years', () => {
    expect(describeScope({ course: 'CS43', semester: 4, examType: 'SEE', yearFrom: 2022, yearTo: 2024 }, 'DAA')).toBe('DAA (CS43), semester 4, SEE, 2022–2024');
    expect(describeScope({ yearFrom: 2023, yearTo: 2023 })).toBe('2023');
    expect(describeScope({ yearTo: 2023 })).toBe('up to 2023');
    expect(describeScope({})).toBe('the whole archive');
  });
});

describe('istDay', () => {
  it('rolls over at midnight India time, not UTC', () => {
    expect(istDay(Date.parse('2026-11-01T18:29:00Z'))).toBe('2026-11-01');
    expect(istDay(Date.parse('2026-11-01T18:31:00Z'))).toBe('2026-11-02');
  });
});
