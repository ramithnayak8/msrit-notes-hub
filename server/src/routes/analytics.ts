import { Router } from 'express';
import type { PipelineStage } from 'mongoose';
import { z } from 'zod';
import { QuestionModel } from '../models/Question.js';
import { SourceDocumentModel } from '../models/SourceDocument.js';
import { TopicModel } from '../models/Topic.js';

/** Aggregations over the indexed corpus, with the same filters search uses. */
export const analyticsRouter = Router();

/** Exam types as stored; filters match them in any case. */
const EXAM_TYPES = ['CIE', 'SEE', 'Makeup'];
const year = z.coerce.number().int().min(1990).max(2100);

export const filters = z.object({
  yearFrom: year.optional(),
  yearTo: year.optional(),
  course: z
    .string()
    .transform((s) => s.toUpperCase().split(',').map((c) => c.trim()).filter(Boolean).sort().join(','))
    .optional(),
  branch: z.string().transform((s) => s.toUpperCase()).optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  examType: z.string().transform((s) => EXAM_TYPES.find((e) => e.toLowerCase() === s.toLowerCase()) ?? s).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AnalyticsFilters = z.infer<typeof filters>;

/** Like filters.parse, but drops any field that doesn't parse instead of failing: a bad shared link still shows the rest. */
export function parseLenient(query: Record<string, unknown>, defaults: Partial<Record<keyof AnalyticsFilters, unknown>> = {}): AnalyticsFilters {
  const ok: Record<string, unknown> = {};
  for (const [k, schema] of Object.entries(filters.shape)) {
    const r = schema.safeParse(query[k] ?? defaults[k as keyof AnalyticsFilters]);
    if (r.success && r.data !== undefined && r.data !== '') ok[k] = r.data;
  }
  return filters.parse(ok);
}

export function match(f: AnalyticsFilters): PipelineStage.Match {
  const m: Record<string, unknown> = { kind: 'question' };
  if (f.yearFrom || f.yearTo) m.year = { ...(f.yearFrom && { $gte: f.yearFrom }), ...(f.yearTo && { $lte: f.yearTo }) };
  if (f.course) m.courseCode = { $in: f.course.split(',') };
  if (f.branch) m.branch = f.branch;
  if (f.semester) m.semester = f.semester;
  if (f.examType) m.examType = f.examType;
  return { $match: m };
}

/**
 * A small time-boxed cache for the dashboard: the corpus only changes when a
 * paper is ingested, and in exam week many students open the same course.
 * It holds the promise, so concurrent requests for an expired key share one
 * aggregation, and a hit moves the key to the back (least recently used goes first).
 */
const CACHE_MS = 60_000;
const CACHE_MAX = 200;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

export function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  cache.delete(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    cache.set(key, hit);
    return hit.value as Promise<T>;
  }
  while (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  const value = compute();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.get(key)?.value === value && cache.delete(key)); // never cache a failure
  return value;
}

async function topicLabels(names: string[]) {
  const t = await TopicModel.find({ name: { $in: names } }).select('name label').lean();
  return new Map(t.map((x) => [x.name, x.label]));
}

/** Most-examined topics: in how many questions, papers and distinct years each appears. */
analyticsRouter.get('/topics', async (req, res) => {
  const f = filters.parse(req.query);
  const rows = await QuestionModel.aggregate<{ _id: string; questions: number; papers: number; years: number[]; marks: number }>([
    match(f),
    { $unwind: '$topics' },
    { $group: { _id: '$topics', questions: { $sum: 1 }, docs: { $addToSet: '$documentId' }, years: { $addToSet: '$year' }, marks: { $sum: { $ifNull: ['$marks', 0] } } } },
    { $project: { questions: 1, marks: 1, years: 1, papers: { $size: '$docs' } } },
    { $sort: { papers: -1, questions: -1 } },
    { $limit: f.limit },
  ]);
  const labels = await topicLabels(rows.map((r) => r._id));
  res.json({ items: rows.map((r) => ({ topic: r._id, label: labels.get(r._id) ?? r._id, questions: r.questions, papers: r.papers, totalMarks: r.marks, years: r.years.filter(Boolean).sort() })) });
});

/** Question counts split by year, branch, exam type, semester or unit. */
analyticsRouter.get('/distribution', async (req, res) => {
  const { by, ...rest } = z.object({ by: z.enum(['year', 'branch', 'examType', 'semester', 'unit', 'courseCode']).default('year') }).and(filters).parse(req.query);
  const rows = await QuestionModel.aggregate<{ _id: string | number | null; questions: number; papers: number }>([
    match(rest),
    { $group: { _id: `$${by}`, questions: { $sum: 1 }, docs: { $addToSet: '$documentId' } } },
    { $project: { questions: 1, papers: { $size: '$docs' } } },
    { $sort: { _id: 1 } },
  ]);
  res.json({ by, items: rows.map((r) => ({ key: r._id, questions: r.questions, papers: r.papers })) });
});

/** Questions asked again and again: the near-duplicate groups that span the most papers. */
analyticsRouter.get('/recurring', async (req, res) => {
  const f = filters.parse(req.query);
  const rows = await QuestionModel.aggregate([
    match(f),
    { $sort: { year: -1 } },
    { $group: { _id: '$groupId', docs: { $addToSet: '$documentId' }, years: { $addToSet: '$year' }, text: { $first: '$text' }, topics: { $first: '$topics' }, courseTitle: { $first: '$courseTitle' } } },
    { $project: { text: 1, topics: 1, courseTitle: 1, years: 1, papers: { $size: '$docs' } } },
    { $match: { papers: { $gte: 2 } } },
    { $sort: { papers: -1 } },
    { $limit: f.limit },
  ]);
  res.json({ items: rows });
});

type Bucket = { key: string | number | null; questions: number; papers: number; marks: number };

const bucketBy = (field: string): PipelineStage.FacetPipelineStage[] => [
  { $group: { _id: `$${field}`, questions: { $sum: 1 }, docs: { $addToSet: '$documentId' }, marks: { $sum: { $ifNull: ['$marks', 0] } } } },
  { $project: { _id: 0, key: '$_id', questions: 1, marks: 1, papers: { $size: '$docs' } } },
  { $sort: { key: 1 } },
];

/** Everything the exam-insights page shows for one filtered slice, in one round trip. */
export async function overview(f: AnalyticsFilters) {
  const [result] = await QuestionModel.aggregate<{
    totals: { questions: number; marks: number; papers: number; courses: number; minYear: number | null; maxYear: number | null }[];
    topicCount: { n: number }[];
    byYear: Bucket[];
    byExamType: Bucket[];
    byUnit: Bucket[];
    byMarks: Bucket[];
    byBloom: Bucket[];
    topics: { _id: string; questions: number; papers: number; marks: number; years: number[] }[];
    recurring: { _id: unknown; text: string; courseCode: string | null; courseTitle: string | null; years: number[]; papers: number; questions: number }[];
    recurringCount: { n: number }[];
  }>([
    match(f),
    {
      $facet: {
        totals: [
          { $group: { _id: null, questions: { $sum: 1 }, marks: { $sum: { $ifNull: ['$marks', 0] } }, docs: { $addToSet: '$documentId' }, courses: { $addToSet: '$courseCode' }, minYear: { $min: '$year' }, maxYear: { $max: '$year' } } },
          { $project: { _id: 0, questions: 1, marks: 1, minYear: 1, maxYear: 1, papers: { $size: '$docs' }, courses: { $size: { $setDifference: ['$courses', [null, '']] } } } },
        ],
        topicCount: [{ $unwind: '$topics' }, { $group: { _id: '$topics' } }, { $count: 'n' }],
        byYear: bucketBy('year'),
        byExamType: bucketBy('examType'),
        byUnit: bucketBy('unit'),
        byMarks: bucketBy('marks'),
        byBloom: bucketBy('bloom'),
        topics: [
          { $unwind: '$topics' },
          { $group: { _id: '$topics', questions: { $sum: 1 }, docs: { $addToSet: '$documentId' }, years: { $addToSet: '$year' }, marks: { $sum: { $ifNull: ['$marks', 0] } } } },
          { $project: { questions: 1, marks: 1, years: 1, papers: { $size: '$docs' } } },
          { $sort: { papers: -1, questions: -1, _id: 1 } },
          { $limit: f.limit },
        ],
        recurring: [
          { $match: { groupId: { $ne: null } } },
          { $sort: { year: -1 } },
          { $group: { _id: '$groupId', docs: { $addToSet: '$documentId' }, years: { $addToSet: '$year' }, questions: { $sum: 1 }, text: { $first: '$text' }, courseCode: { $first: '$courseCode' }, courseTitle: { $first: '$courseTitle' } } },
          { $project: { text: 1, courseCode: 1, courseTitle: 1, years: 1, questions: 1, papers: { $size: '$docs' } } },
          { $match: { papers: { $gte: 2 } } },
          { $sort: { papers: -1, questions: -1 } },
          { $limit: f.limit },
        ],
        recurringCount: [
          { $match: { groupId: { $ne: null } } },
          { $group: { _id: '$groupId', docs: { $addToSet: '$documentId' } } },
          { $match: { 'docs.1': { $exists: true } } },
          { $count: 'n' },
        ],
      },
    },
  ]);

  const facets = result!; // $facet always returns exactly one document
  const totals = facets.totals[0];
  const labels = await topicLabels(facets.topics.map((t) => t._id));
  const known = (b: Bucket[]) => b.filter((x) => x.key !== null && x.key !== '');
  return {
    kpis: {
      questions: totals?.questions ?? 0,
      papers: totals?.papers ?? 0,
      courses: totals?.courses ?? 0,
      topics: facets.topicCount[0]?.n ?? 0,
      totalMarks: totals?.marks ?? 0,
      yearRange: totals?.minYear ? { min: totals.minYear, max: totals.maxYear } : null,
    },
    byYear: known(facets.byYear),
    byExamType: known(facets.byExamType),
    byUnit: known(facets.byUnit),
    byMarks: known(facets.byMarks).filter((b) => (b.key as number) > 0),
    byBloom: known(facets.byBloom),
    topics: facets.topics.map((t) => ({ topic: t._id, label: labels.get(t._id) ?? t._id, questions: t.questions, papers: t.papers, totalMarks: t.marks, years: t.years.filter(Boolean).sort() })),
    recurringCount: facets.recurringCount[0]?.n ?? 0,
    recurring: facets.recurring.map((r) => ({ text: r.text, courseCode: r.courseCode, courseTitle: r.courseTitle, papers: r.papers, questions: r.questions, years: r.years.filter(Boolean).sort() })),
  };
}

/** What the filters can be set to: every course, semester, year and exam type in the corpus. */
async function filterOptions() {
  const [courses, years, semesters, examTypes] = await Promise.all([
    QuestionModel.aggregate<{ _id: string; title: string | null; semesters: (number | null)[]; questions: number }>([
      { $match: { kind: 'question', courseCode: { $nin: [null, ''] } } },
      { $group: { _id: '$courseCode', title: { $first: '$courseTitle' }, semesters: { $addToSet: '$semester' }, first: { $min: '$semester' }, questions: { $sum: 1 } } },
      { $sort: { first: 1, _id: 1 } },
    ]),
    QuestionModel.distinct('year', { kind: 'question' }),
    QuestionModel.distinct('semester', { kind: 'question' }),
    QuestionModel.distinct('examType', { kind: 'question' }),
  ]);
  const clean = <T>(xs: (T | null)[]) => xs.filter((x): x is T => x !== null && x !== '').sort();
  return {
    courses: courses.map((c) => ({ code: c._id, title: c.title ?? c._id, semesters: clean(c.semesters), questions: c.questions })),
    years: clean(years as (number | null)[]),
    semesters: clean(semesters as (number | null)[]),
    examTypes: clean(examTypes as (string | null)[]),
  };
}

/** The exam-insights dashboard: KPIs, distributions, top topics and repeats for one slice, plus the filter options. */
analyticsRouter.get('/overview', async (req, res) => {
  const options = await cached('options', filterOptions);
  const f = parseLenient(req.query, { limit: 10 });
  // Only courses that exist: an unknown code would otherwise empty the page while the course picker reads "All courses".
  const known = new Set(options.courses.map((c) => c.code));
  f.course = f.course?.split(',').filter((c) => known.has(c)).join(',') || undefined;
  const data = await cached(`overview:${JSON.stringify(f)}`, () => overview(f));
  res.set('Cache-Control', 'private, max-age=60');
  res.json({ filters: { ...f, limit: undefined }, options, ...data });
});

analyticsRouter.get('/stats', async (_req, res) => {
  const [documents, byStatus, questions, notes, topics, years, courses] = await Promise.all([
    SourceDocumentModel.countDocuments(),
    SourceDocumentModel.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    QuestionModel.countDocuments({ kind: 'question' }),
    QuestionModel.countDocuments({ kind: 'note' }),
    TopicModel.aggregate([{ $match: { mergedInto: { $exists: false } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    QuestionModel.aggregate([{ $group: { _id: null, min: { $min: '$year' }, max: { $max: '$year' } } }]),
    SourceDocumentModel.distinct('courseCode'),
  ]);
  res.json({
    documents,
    documentsByStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
    questions,
    notePassages: notes,
    topics: Object.fromEntries(topics.map((t) => [t._id, t.n])),
    courses: courses.filter(Boolean).length,
    yearRange: years[0] ? { min: years[0].min, max: years[0].max } : null,
  });
});
