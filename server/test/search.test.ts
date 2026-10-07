import { describe, expect, it } from 'vitest';
import { acronym, parseQuery } from '../src/search/parseQuery.js';
import { reciprocalRankFusion, RRF_K } from '../src/search/search.js';

const courses = [
  { code: 'CS43', title: 'Design and Analysis of Algorithms' },
  { code: 'IS43', title: 'Design and Analysis of Algorithms' },
  { code: 'CS33', title: 'Data Structures' },
];
const now = new Date('2026-10-07');

describe('parseQuery', () => {
  it('turns relative years into a range and keeps the topic', () => {
    const p = parseQuery('deadlock avoidance questions from the last 3 years', courses, now);
    expect(p.filters).toEqual({ yearFrom: 2024 });
    expect(p.text).toBe('deadlock avoidance');
  });

  it('reads explicit ranges, marks, semester and exam type', () => {
    const p = parseQuery('10 marks SEE questions on hashing 2021-2023 sem 3', courses, now);
    expect(p.filters).toMatchObject({ yearFrom: 2021, yearTo: 2023, marks: 10, semester: 3, examType: 'SEE' });
    expect(p.text).toBe('hashing');
  });

  it('maps a course acronym to every course with that title', () => {
    const p = parseQuery('DAA greedy algorithms', courses, now);
    expect(p.filters.courseCodes?.sort()).toEqual(['CS43', 'IS43']);
    expect(p.text).toBe('greedy algorithms');
  });

  it('matches a course code or a full course title', () => {
    expect(parseQuery('cs33 linked lists', courses, now).filters.courseCodes).toEqual(['CS33']);
    expect(parseQuery('data structures stack', courses, now)).toMatchObject({ filters: { courseCodes: ['CS33'] }, text: 'stack' });
  });

  it('only treats two-letter branch codes as branches in capitals', () => {
    expect(parseQuery('what is a heap', courses, now).filters.branch).toBeUndefined();
    expect(parseQuery('IS heap', courses, now).filters.branch).toBe('ISE');
  });

  it('leaves topic-free queries with an empty text', () => {
    expect(parseQuery('CS43 2023', courses, now)).toMatchObject({ text: '', filters: { courseCodes: ['CS43'], yearFrom: 2023, yearTo: 2023 } });
  });

  it('builds acronyms without filler words', () => {
    expect(acronym('Design and Analysis of Algorithms')).toBe('DAA');
    expect(acronym('Data Structures using C++')).toBe('DSC');
  });
});

describe('reciprocalRankFusion', () => {
  const id = (s: string) => ({ _id: s });

  it('rewards documents found by both searches', () => {
    const fused = reciprocalRankFusion({ vector: [id('a'), id('b'), id('c')], keyword: [id('c'), id('d')] });
    // c: 1/(60+3) + 1/(60+1) beats a: 1/(60+1) alone.
    expect(fused[0]!.id).toBe('c');
    expect(fused[0]!.score).toBeCloseTo(1 / (RRF_K + 3) + 1 / (RRF_K + 1));
    expect(fused[0]!.ranks).toEqual({ vector: 3, keyword: 1 });
  });

  it('keeps single-list order when there is no overlap', () => {
    const fused = reciprocalRankFusion({ vector: [id('a'), id('b')], keyword: [] });
    expect(fused.map((f) => f.id)).toEqual(['a', 'b']);
  });
});
