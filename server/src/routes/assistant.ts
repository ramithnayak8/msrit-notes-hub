import { Router } from 'express';
import { z } from 'zod';
import { answerSchema, buildContext, cacheKey, describeScope, reserve, SYSTEM, tidyAnswer, usedToday, type Quota, type Source } from '../assistant/grounded.js';
import { config } from '../config.js';
import { cached } from '../lib/cache.js';
import { logger } from '../lib/logger.js';
import { answerLlmAvailable, generateJson } from '../llm/provider.js';
import { optionalAuth } from '../middleware/auth.js';
import { assistantLimit } from '../middleware/limits.js';
import { AssistantAnswerModel } from '../models/AssistantAnswer.js';
import { QuestionModel } from '../models/Question.js';
import { TopicModel } from '../models/Topic.js';
import { courseCatalog } from '../search/catalog.js';
import { parseQuery, type SearchFilters } from '../search/parseQuery.js';
import { searchQuestions, type SearchHit, type SearchResponse } from '../search/search.js';
import { overview, parseLenient, type AnalyticsFilters } from './analytics.js';

/**
 * The study assistant, answered from retrieval alone: no language model runs
 * at query time, so asking it costs nothing (the synopsis' cost model). It
 * reads the question with the same rule-based parser as search, then either
 * ranks topics by how many papers examined them ("what should I revise"), or
 * returns the closest questions. Every answer cites the papers it used.
 */
export const assistantRouter = Router();


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

/** Filters from the page (the insights view) override what was read from the sentence. */
const toSearchFilters = (f: AnalyticsFilters): SearchFilters =>
  Object.fromEntries(
    Object.entries({ yearFrom: f.yearFrom, yearTo: f.yearTo, semester: f.semester, examType: f.examType, branch: f.branch, courseCodes: f.course?.split(',') }).filter(([, v]) => v !== undefined),
  );

async function revisionAnswer(q: string, explicit: SearchFilters, scopeNote?: string) {
  const parsed = parseQuery(q, courseCatalog());
  Object.assign(parsed.filters, explicit);
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
  const scope = scopeNote ?? (parsed.understood.length ? parsed.understood.join(', ') : 'the whole archive');
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

/** The closest questions, from a search the caller already ran (the same results feed the model). */
function questionAnswer({ hits, query, total }: SearchResponse, scopeNote?: string) {
  if (!hits.length) return null;
  const scope = scopeNote ? ` (${scopeNote})` : query.understood.length ? ` (${query.understood.join(', ')})` : '';
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

const body = z.object({
  question: z.string().trim().min(2).max(400),
  // The insights page sends the slice the student is looking at.
  filters: z.record(z.string(), z.unknown()).optional(),
});

type Reply = {
  answer: string;
  sources: Source[];
  mode: 'ai' | 'retrieval';
  provider?: string;
  cached?: boolean;
  /** Why an AI answer wasn't written: not signed in, daily limit, site budget, or the model failed. */
  notice?: 'sign-in' | 'user-limit' | 'global-limit' | 'unavailable';
  usage?: { used: number; limit: number };
  retrieved: number;
  tookMs: number;
};

/**
 * Answers in two steps. Retrieval always runs: the closest questions, topic
 * counts, and the statistics for the slice. A signed-in student under the daily
 * cap then gets the answer written by the model from that data alone, with
 * citations; anyone else, and any failure on the way, gets the retrieval answer.
 * Written answers are cached per question and slice. A student always gets
 * their own cached answer back; other people (signed out included) only once
 * two different students have asked it, so one account can't push a crafted
 * answer to everyone through a shared link.
 */
assistantRouter.post('/', assistantLimit, optionalAuth, async (req, res) => {
  const t = Date.now();
  const { question, filters: rawFilters } = body.parse(req.body);
  const f = parseLenient(rawFilters ?? {}, { limit: 10 });
  // Page-scoped only when the page sent at least one usable filter; `{}` is the whole archive, read from the question.
  const pageScoped = Object.keys(f).some((k) => k !== 'limit');
  const explicit = toSearchFilters(f);
  const parsed = parseQuery(question, courseCatalog());
  Object.assign(parsed.filters, explicit);
  const qf = parsed.filters;
  // The slice the statistics cover: the page's filters, or what the question itself names.
  const slice: AnalyticsFilters = pageScoped
    ? f
    : { limit: 10, course: qf.courseCodes?.length ? [...qf.courseCodes].sort().join(',') : undefined, branch: qf.branch, semester: qf.semester, yearFrom: qf.yearFrom, yearTo: qf.yearTo, examType: qf.examType };
  const courseTitle = f.course ? courseCatalog().find((c) => c.code === f.course)?.title : undefined;
  const scope = pageScoped ? describeScope(f, courseTitle) : parsed.understood.length ? parsed.understood.join(', ') : 'the whole archive';
  const done = (r: Omit<Reply, 'tookMs'>) => res.json({ ...r, tookMs: Date.now() - t } satisfies Reply);

  const useLlm = config.ASSISTANT_LLM && answerLlmAvailable() && config.ASSISTANT_USER_DAILY > 0 && config.ASSISTANT_GLOBAL_DAILY > 0;
  const key = cacheKey(question, slice, pageScoped);
  if (useLlm) {
    const hit = await AssistantAnswerModel.findOne({ key }).lean().catch((err) => void logger.warn({ err: err.message }, 'assistant cache read failed'));
    const mine = !!req.user && !!hit?.askers?.includes(req.user.id);
    if (hit && (mine || (hit.askers?.length ?? 0) >= 2)) {
      return done({ answer: hit.answer, sources: hit.sources as Source[], mode: 'ai', provider: hit.provider ?? undefined, cached: true, retrieved: hit.retrieved });
    }
  }

  // Retrieval: the answer students get without the model, and the data the model writes from. One search serves both.
  const search = await searchQuestions({ q: question, limit: 6, filters: explicit });
  const scopeNote = pageScoped ? scope : undefined;
  const retrieval = ((REVISION.test(question) ? await revisionAnswer(question, explicit, scopeNote) : null) ?? questionAnswer(search, scopeNote)) ?? {
    answer: 'Nothing in the archive matches that yet. Try naming a topic ("deadlock", "agile") or a course ("ML", "CS43").',
    sources: [],
    retrieved: 0,
  };
  const plain = (notice?: Reply['notice'], usage?: Reply['usage']) =>
    done({ answer: retrieval.answer, sources: retrieval.sources as Source[], mode: 'retrieval', notice, usage, retrieved: retrieval.retrieved });

  if (!useLlm) return plain();
  if (!req.user) return plain('sign-in');
  const userId = req.user.id;
  const usage = () => usedToday(userId).catch(() => undefined);

  let quota: Quota | undefined;
  try {
    const stats = await cached(`overview:${JSON.stringify(slice)}`, () => overview(slice));
    const { context, sources, questionCount } = buildContext(scope, stats, search.query.text ? search.hits : [], cite);
    if (!stats.kpis.questions && !questionCount) return plain();

    quota = await reserve(userId);
    if (!quota.ok) return plain(quota.reason === 'user' ? 'user-limit' : 'global-limit', await usage());
    const { data, provider } = await generateJson(
      {
        system: SYSTEM,
        prompt: `${context}\n\nSTUDENT'S QUESTION: ${question}`,
        schema: answerSchema,
        task: 'assistant',
        live: { model: config.ASSISTANT_MODEL, timeoutMs: config.ASSISTANT_TIMEOUT_MS },
      },
      { apiOnly: true, attempts: 1 },
    );
    quota = undefined; // spent: from here on nothing refunds it
    const answer = tidyAnswer(data.answer, questionCount);
    // The student has the answer either way; a failed cache write only costs a future model call.
    void AssistantAnswerModel.updateOne(
      { key },
      { $set: { question, answer, sources, retrieved: questionCount, provider, createdAt: new Date() }, $addToSet: { askers: userId } },
      { upsert: true },
    ).catch((err) => logger.warn({ err: err.message }, 'assistant cache write failed'));
    return done({ answer, sources, mode: 'ai', provider, retrieved: questionCount, usage: await usage() });
  } catch (err) {
    if (quota?.ok) await quota.release().catch(() => undefined);
    logger.warn({ err: (err as Error).message?.slice(0, 300) }, 'assistant answer fell back to retrieval');
    return plain('unavailable');
  }
});
