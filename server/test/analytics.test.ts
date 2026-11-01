import { describe, expect, it, vi } from 'vitest';
import { cached } from '../src/lib/cache.js';
import { filters, match, parseLenient } from '../src/routes/analytics.js';

const parse = (q: Record<string, string>) => filters.parse(q);

describe('analytics filters', () => {
  it('matches only questions when no filter is set', () => {
    expect(match(parse({}))).toEqual({ $match: { kind: 'question' } });
  });

  it('builds a year range from either or both ends', () => {
    expect(match(parse({ yearFrom: '2022' })).$match.year).toEqual({ $gte: 2022 });
    expect(match(parse({ yearTo: '2024' })).$match.year).toEqual({ $lte: 2024 });
    expect(match(parse({ yearFrom: '2022', yearTo: '2024' })).$match.year).toEqual({ $gte: 2022, $lte: 2024 });
  });

  it('accepts several course codes, in any case and with stray spaces or commas', () => {
    expect(match(parse({ course: 'cs43, is43,' })).$match.courseCode).toEqual({ $in: ['CS43', 'IS43'] });
  });

  it('filters by semester, branch and exam type', () => {
    expect(match(parse({ semester: '5', branch: 'cse', examType: 'SEE' })).$match).toEqual({ kind: 'question', semester: 5, branch: 'CSE', examType: 'SEE' });
  });

  it('rejects semesters outside 1 to 8 and impossible years', () => {
    expect(() => parse({ semester: '9' })).toThrow();
    expect(() => parse({ semester: '0' })).toThrow();
    expect(() => parse({ yearFrom: 'abc' })).toThrow();
    expect(() => parse({ yearTo: '99999999999999999999' })).toThrow();
  });

  it('matches exam types in any case', () => {
    expect(match(parse({ examType: 'see' })).$match.examType).toBe('SEE');
    expect(match(parse({ examType: 'MAKEUP' })).$match.examType).toBe('Makeup');
  });

  it('keeps one cache key per slice whatever the course order or case', () => {
    expect(parse({ course: 'is43,CS43' }).course).toBe(parse({ course: 'cs43, IS43' }).course);
  });
});

describe('lenient parsing (shared links)', () => {
  it('drops the bad fields and keeps the good ones', () => {
    expect(parseLenient({ semester: '9', yearFrom: 'xyz', course: 'cs43', examType: 'see' })).toEqual({ course: 'CS43', examType: 'SEE', limit: 20 });
  });

  it('drops repeated params rather than guessing', () => {
    expect(parseLenient({ course: ['CS43', 'IS43'], semester: '5' })).toEqual({ semester: 5, limit: 20 });
  });

  it('applies defaults only where the query is silent', () => {
    expect(parseLenient({}, { limit: 10 }).limit).toBe(10);
    expect(parseLenient({ limit: '5' }, { limit: 10 }).limit).toBe(5);
  });
});

describe('analytics cache', () => {
  it('computes once per key within the window, then again after it', async () => {
    vi.useFakeTimers();
    const compute = vi.fn(async () => ({ n: compute.mock.calls.length }));
    expect(await cached('test:a', compute)).toEqual({ n: 1 });
    expect(await cached('test:a', compute)).toEqual({ n: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
    await cached('test:b', compute);
    expect(compute).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(61_000);
    expect(await cached('test:a', compute)).toEqual({ n: 3 });
    vi.useRealTimers();
  });

  it('shares one computation between concurrent callers and forgets failures', async () => {
    let calls = 0;
    const slow = () => new Promise<number>((r) => setTimeout(() => r(++calls), 5));
    expect(await Promise.all([cached('test:c', slow), cached('test:c', slow)])).toEqual([1, 1]);
    const fail = vi.fn(async () => { throw new Error('db down'); });
    await expect(cached('test:d', fail)).rejects.toThrow('db down');
    await expect(cached('test:d', fail)).rejects.toThrow('db down');
    expect(fail).toHaveBeenCalledTimes(2);
  });
});
