import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { QuestionModel } from '../models/Question.js';
import { TopicModel } from '../models/Topic.js';
import { courseCatalog } from '../search/catalog.js';
import { parseQuery, type SearchFilters } from '../search/parseQuery.js';
import { searchQuestions, type SearchHit } from '../search/search.js';

/**
 * The study assistant, answered from retrieval alone: no language model runs
 * at query time, so asking it costs nothing (the synopsis' cost model). It
 * reads the question with the same rule-based parser as search, then either
 * ranks topics by how many papers examined them ("what should I revise"), or
 * returns the closest questions. Every answer cites the papers it used.
 */
export const assistantRouter = Router();

type Source = { kind: 'question' | 'topic'; label: string; detail: string };

const REVISION = /\b(revise|revision|prepare|important|imp|focus|priorit|repeat|recurring|frequent|most (asked|examined|common)|common|weightage|which topics)\b/i;

const cite = (h: SearchHit) => `${h.course.code ?? '?'} ${h.examType ?? ''} ${h.source.month ? `${h.source.month} ` : ''}${h.year ?? ''} ${h.label}`.replace(/\s+/g, ' ').trim();

function matchFilter(f: SearchFilters) {
  const m: Record<string, unknown> = { kind: 'question' };
  if (f.yearFrom !== undefined || f.yearTo !== undefined) m.year = { ...(f.yearFrom !== undefined && { $gte: f.yearFrom }), ...(f.yearTo !== undefined && { $lte: f.yearTo }) };
  if (f.courseCodes?.length) m.courseCode = { $in: f.courseCodes };
  if (f.branch) m.branch = f.branch;
  if (f.semester !== undefined) m.semester = f.semester;
  if (f.examType) m.examType = f.examType;
  return m;
}

async function revisionAnswer(q: string) {
  const parsed = parseQuery(q, courseCatalog());
  const match = matchFilter(parsed.filters);
  const rows = await QuestionModel.aggregate<{ _id: string; papers: number; questions: number; years: number[]; marks: number }>([
    { $match: match },
    { $unwind: '$topics' },
    { $group: { _id: '$topics', docs: { $addToSet: '$documentId' }, questions: { $sum: 1 }, years: { $addToSet: '$year' }, marks: { $sum: { $ifNull: ['$marks', 0] } } } },
    { $project: { papers: { $size: '$docs' }, questions: 1, years: 1, marks: 1 } },
    { $sort: { papers: -1, marks: -1 } },
    { $limit: 8 },
  ]);
  const paperCount = (await QuestionModel.distinct('documentId', match)).length;
  if (!rows.length) return null;

  const labels = new Map((await TopicModel.find({ name: { $in: rows.map((r) => r._id) } }).select('name label').lean()).map((t) => [t.name, t.label]));
  const scope = parsed.understood.length ? parsed.understood.join(', ') : 'the whole archive';
  const lines = rows.map((r) => {
    const years = r.years.filter(Boolean).sort();
    return `• **${labels.get(r._id) ?? r._id}**: in ${r.papers} of ${paperCount} papers (${years.join(', ')}), ${r.questions} question${r.questions === 1 ? '' : 's'}, ${r.marks} marks in total`;
  });
  const answer = [
    `Ranked by how many papers examined each topic, for ${scope}. Topics that keep coming back across years are the safest to revise first.`,
    '',
    ...lines,
    '',
    `Search any of these to see the exact questions with their papers.`,
  ].join('\n');
  const sources: Source[] = rows.map((r) => ({ kind: 'topic', label: labels.get(r._id) ?? r._id, detail: `${r.papers} papers` }));
  return { answer, sources, retrieved: rows.length };
}

async function questionAnswer(q: string) {
  const { hits, query, total } = await searchQuestions({ q, limit: 6 });
  if (!hits.length) return null;
  const scope = query.understood.length ? ` (${query.understood.join(', ')})` : '';
  const repeated = hits.filter((h) => h.recurrence.count > 1);
  const lines = hits.map((h) => {
    const marks = h.marks ? `, ${h.marks} marks` : '';
    const again = h.recurrence.count > 1 ? `, asked in ${h.recurrence.count} papers` : '';
    return `• **${cite(h)}**${marks}${again}\n   ${h.text.length > 260 ? `${h.text.slice(0, 257)}…` : h.text}`;
  });
  const answer = [
    `The ${hits.length} closest of ${total} matching questions${scope}:`,
    '',
    ...lines,
    ...(repeated.length ? ['', `**${repeated.length}** of these have been asked in more than one paper, which makes them worth practising.`] : []),
  ].join('\n');
  const sources: Source[] = hits.map((h) => ({ kind: 'question', label: cite(h), detail: h.course.title ?? '' }));
  return { answer, sources, retrieved: hits.length };
}

assistantRouter.post('/', rateLimit({ windowMs: 60_000, limit: 30 }), async (req, res) => {
  const t = Date.now();
  const { question } = z.object({ question: z.string().trim().min(2).max(400) }).parse(req.body);
  const result = (REVISION.test(question) ? await revisionAnswer(question) : null) ?? (await questionAnswer(question));
  res.json({
    answer: result?.answer ?? 'Nothing in the archive matches that yet. Try naming a topic ("deadlock", "agile") or a course ("ML", "CS43").',
    sources: result?.sources ?? [],
    mode: 'retrieval',
    retrieved: result?.retrieved ?? 0,
    tookMs: Date.now() - t,
  });
});
