import { Router } from 'express';
import type { PipelineStage } from 'mongoose';
import { z } from 'zod';
import { QuestionModel } from '../models/Question.js';
import { SourceDocumentModel } from '../models/SourceDocument.js';
import { TopicModel } from '../models/Topic.js';

/** Aggregations over the indexed corpus, with the same filters search uses. */
export const analyticsRouter = Router();

const filters = z.object({
  yearFrom: z.coerce.number().int().optional(),
  yearTo: z.coerce.number().int().optional(),
  course: z.string().optional(),
  branch: z.string().optional(),
  examType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function match(f: z.infer<typeof filters>): PipelineStage.Match {
  const m: Record<string, unknown> = { kind: 'question' };
  if (f.yearFrom || f.yearTo) m.year = { ...(f.yearFrom && { $gte: f.yearFrom }), ...(f.yearTo && { $lte: f.yearTo }) };
  if (f.course) m.courseCode = { $in: f.course.toUpperCase().split(',') };
  if (f.branch) m.branch = f.branch.toUpperCase();
  if (f.examType) m.examType = f.examType;
  return { $match: m };
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
