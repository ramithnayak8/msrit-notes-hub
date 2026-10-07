import type { Types } from 'mongoose';
import { nativeDb } from '../db.js';
import { embedQuery } from '../ml/embedder.js';
import { QuestionModel } from '../models/Question.js';
import { SourceDocumentModel } from '../models/SourceDocument.js';
import { TopicModel } from '../models/Topic.js';
import { TEXT_INDEX, VECTOR_INDEX } from './indexes.js';
import { courseCatalog } from './catalog.js';
import { parseQuery, type ParsedQuery, type SearchFilters } from './parseQuery.js';

export type SearchMode = 'hybrid' | 'vector' | 'keyword';

/** Reciprocal rank fusion constant. 60 is the value from the original paper and the usual default. */
export const RRF_K = 60;
const CANDIDATES = 50;

export type SearchHit = {
  id: string;
  label: string;
  text: string;
  kind: string;
  marks?: number;
  co?: string;
  bloom?: string;
  unit?: number;
  topics: { name: string; label: string }[];
  course: { code?: string; title?: string };
  branch?: string;
  semester?: number;
  year?: number;
  examType?: string;
  page?: number;
  source: { documentId: string; title: string; month?: string };
  /** How many times this question (or a near-identical one) has been asked, and in which years. */
  recurrence: { count: number; years: number[] };
  score: number;
  ranks: { vector?: number; keyword?: number };
};

export type SearchResponse = {
  query: ParsedQuery;
  mode: SearchMode;
  total: number;
  hits: SearchHit[];
  tookMs: number;
};

/** The same filters, in the two dialects: $vectorSearch takes MQL, $search takes its own operators. */
function vectorFilter(f: SearchFilters) {
  const and: Record<string, unknown>[] = [];
  if (f.yearFrom !== undefined || f.yearTo !== undefined) and.push({ year: { ...(f.yearFrom !== undefined && { $gte: f.yearFrom }), ...(f.yearTo !== undefined && { $lte: f.yearTo }) } });
  if (f.courseCodes?.length) and.push({ courseCode: { $in: f.courseCodes } });
  if (f.branch) and.push({ branch: { $eq: f.branch } });
  if (f.semester !== undefined) and.push({ semester: { $eq: f.semester } });
  if (f.marks !== undefined) and.push({ marks: { $eq: f.marks } });
  if (f.minMarks !== undefined) and.push({ marks: { $gte: f.minMarks } });
  if (f.examType) and.push({ examType: { $eq: f.examType } });
  if (f.kind) and.push({ kind: { $eq: f.kind } });
  return and.length ? { $and: and } : undefined;
}

function searchFilter(f: SearchFilters) {
  const out: Record<string, unknown>[] = [];
  if (f.yearFrom !== undefined || f.yearTo !== undefined) out.push({ range: { path: 'year', ...(f.yearFrom !== undefined && { gte: f.yearFrom }), ...(f.yearTo !== undefined && { lte: f.yearTo }) } });
  if (f.courseCodes?.length) out.push({ in: { path: 'courseCode', value: f.courseCodes } });
  if (f.branch) out.push({ equals: { path: 'branch', value: f.branch } });
  if (f.semester !== undefined) out.push({ equals: { path: 'semester', value: f.semester } });
  if (f.marks !== undefined) out.push({ equals: { path: 'marks', value: f.marks } });
  if (f.minMarks !== undefined) out.push({ range: { path: 'marks', gte: f.minMarks } });
  if (f.examType) out.push({ equals: { path: 'examType', value: f.examType } });
  if (f.kind) out.push({ equals: { path: 'kind', value: f.kind } });
  return out;
}

/** Same filters for a plain find(), used when the query has no topic words. */
function findFilter(f: SearchFilters) {
  return vectorFilter(f) ?? {};
}

type Ranked = { _id: Types.ObjectId; score: number }[];

async function vectorSearch(text: string, f: SearchFilters): Promise<Ranked> {
  const queryVector = await embedQuery(text);
  const filter = vectorFilter(f);
  return nativeDb()
    .collection('questions')
    .aggregate<{ _id: Types.ObjectId; score: number }>([
      // numCandidates: how many neighbours HNSW explores before returning the best `limit`. More = better recall, slower.
      { $vectorSearch: { index: VECTOR_INDEX, path: 'embedding', queryVector, numCandidates: CANDIDATES * 10, limit: CANDIDATES, ...(filter && { filter }) } },
      { $project: { _id: 1, score: { $meta: 'vectorSearchScore' } } },
    ])
    .toArray();
}

async function keywordSearch(text: string, f: SearchFilters): Promise<Ranked> {
  return nativeDb()
    .collection('questions')
    .aggregate<{ _id: Types.ObjectId; score: number }>([
      {
        $search: {
          index: TEXT_INDEX,
          compound: {
            // BM25 over three fields; a match in the topic tags counts double, course title half.
            should: [
              { text: { query: text, path: 'text' } },
              { text: { query: text, path: 'topics', score: { boost: { value: 2 } } } },
              { text: { query: text, path: 'courseTitle', score: { boost: { value: 0.5 } } } },
            ],
            minimumShouldMatch: 1,
            filter: searchFilter(f),
          },
        },
      },
      { $limit: CANDIDATES },
      { $project: { _id: 1, score: { $meta: 'searchScore' } } },
    ])
    .toArray();
}

/**
 * Reciprocal rank fusion: score(d) = Σ 1 / (k + rank_i(d)) over the result
 * lists. It uses only ranks, so BM25 scores (unbounded) and cosine scores
 * (0–1) never need to be put on the same scale, and a question that ranks
 * well in both lists beats one that tops only one.
 */
export function reciprocalRankFusion(lists: Record<string, { _id: { toString(): string } }[]>, k = RRF_K) {
  const fused = new Map<string, { score: number; ranks: Record<string, number> }>();
  for (const [name, list] of Object.entries(lists)) {
    list.forEach((item, i) => {
      const id = item._id.toString();
      const entry = fused.get(id) ?? { score: 0, ranks: {} };
      entry.score += 1 / (k + i + 1);
      entry.ranks[name] = i + 1;
      fused.set(id, entry);
    });
  }
  return [...fused.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.score - a.score);
}

export async function searchQuestions(opts: { q: string; limit?: number; mode?: SearchMode; filters?: SearchFilters }): Promise<SearchResponse> {
  const t = Date.now();
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const mode = opts.mode ?? 'hybrid';
  const query = parseQuery(opts.q, courseCatalog());
  // Explicit filters from the UI override what was read from the sentence.
  Object.assign(query.filters, Object.fromEntries(Object.entries(opts.filters ?? {}).filter(([, v]) => v !== undefined)));

  let ranked: { id: string; score: number; ranks: { vector?: number; keyword?: number } }[];
  if (!query.text) {
    // Only filters ("CS43 SEE 2023"): list what matches, most-repeated first via a later sort.
    const rows = await QuestionModel.find(findFilter(query.filters)).sort({ year: -1, documentId: 1, order: 1 }).limit(200).select('_id').lean();
    ranked = rows.map((r, i) => ({ id: String(r._id), score: 1 / (i + 1), ranks: {} }));
  } else {
    const [vector, keyword] = await Promise.all([
      mode === 'keyword' ? Promise.resolve([]) : vectorSearch(query.text, query.filters),
      mode === 'vector' ? Promise.resolve([]) : keywordSearch(query.text, query.filters),
    ]);
    ranked = reciprocalRankFusion({ vector, keyword });
  }

  const total = ranked.length;
  const page = query.text ? ranked.slice(0, limit) : ranked;
  const hits = await hydrate(page);
  if (!query.text) hits.sort((a, b) => b.recurrence.count - a.recurrence.count || (b.year ?? 0) - (a.year ?? 0));
  return { query, mode, total, hits: hits.slice(0, limit), tookMs: Date.now() - t };
}

/** Load full questions for ranked ids, with source paper, topic labels and recurrence. */
async function hydrate(ranked: { id: string; score: number; ranks: { vector?: number; keyword?: number } }[]): Promise<SearchHit[]> {
  if (!ranked.length) return [];
  const questions = await QuestionModel.find({ _id: { $in: ranked.map((r) => r.id) } }).lean();
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  const docs = await SourceDocumentModel.find({ _id: { $in: [...new Set(questions.map((q) => q.documentId))] } })
    .select('title month')
    .lean();
  const docById = new Map(docs.map((d) => [String(d._id), d]));

  const topicNames = [...new Set(questions.flatMap((q) => q.topics))];
  const topics = await TopicModel.find({ name: { $in: topicNames } }).select('name label').lean();
  const label = new Map(topics.map((t) => [t.name, t.label]));

  const groups = await QuestionModel.aggregate<{ _id: Types.ObjectId; count: number; years: number[] }>([
    { $match: { groupId: { $in: [...new Set(questions.map((q) => q.groupId).filter(Boolean))] } } },
    // A repeat inside the same paper (e.g. an "OR" alternative) doesn't count twice.
    { $group: { _id: '$groupId', docs: { $addToSet: '$documentId' }, years: { $addToSet: '$year' } } },
    { $project: { count: { $size: '$docs' }, years: 1 } },
  ]);
  const groupById = new Map(groups.map((g) => [String(g._id), g]));

  return ranked.flatMap((r) => {
    const q = byId.get(r.id);
    if (!q) return [];
    const d = docById.get(String(q.documentId));
    const g = q.groupId ? groupById.get(String(q.groupId)) : undefined;
    return [
      {
        id: r.id,
        label: q.label,
        text: q.text,
        kind: q.kind ?? 'question',
        marks: q.marks ?? undefined,
        co: q.co ?? undefined,
        bloom: q.bloom ?? undefined,
        unit: q.unit ?? undefined,
        topics: q.topics.map((n) => ({ name: n, label: label.get(n) ?? n })),
        course: { code: q.courseCode ?? undefined, title: q.courseTitle ?? undefined },
        branch: q.branch ?? undefined,
        semester: q.semester ?? undefined,
        year: q.year ?? undefined,
        examType: q.examType ?? undefined,
        page: q.page ?? undefined,
        source: { documentId: String(q.documentId), title: d?.title ?? '', month: d?.month ?? undefined },
        recurrence: { count: g?.count ?? 1, years: (g?.years ?? [q.year]).filter((y): y is number => typeof y === 'number').sort() },
        score: Math.round(r.score * 10000) / 10000,
        ranks: r.ranks,
      },
    ];
  });
}
