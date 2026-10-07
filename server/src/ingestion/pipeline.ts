import { Types } from 'mongoose';
import { filesBucket, nativeDb } from '../db.js';
import { logger } from '../lib/logger.js';
import { llmAvailable } from '../llm/provider.js';
import { EMBEDDING_MODEL, cosine, embedPassages } from '../ml/embedder.js';
import { JobModel, STAGES, type JobDoc, type Stage } from '../models/Job.js';
import { QuestionModel } from '../models/Question.js';
import { ReviewItemModel } from '../models/ReviewItem.js';
import { SourceDocumentModel, type SourceDocumentDoc } from '../models/SourceDocument.js';
import { VECTOR_INDEX } from '../search/indexes.js';
import { refreshCourseCatalog } from '../search/parseQuery.js';
import { repairLowConfidence, segmentWholeWithModel } from './fallback.js';
import type { PageText } from './extract.js';
import { extractDocument } from './ocr.js';
import { LOW_CONFIDENCE, chunkNotes, segmentPaper, type HeaderMeta, type Segment } from './segment.js';
import { tagQuestions, type TagResult } from './tag.js';

/** OCR pages below this confidence are worth a moderator's look. */
const OCR_REVIEW_BELOW = 0.6;
/**
 * Cosine similarity, on plain question text, above which two questions count
 * as the same question asked again. Calibrated on real papers: pairs at 0.90+
 * were rewordings of one question; 0.86-0.90 were same-concept, different
 * questions (src/scripts/near-duplicates.ts prints the pairs).
 */
export const DUPLICATE_SIMILARITY = 0.9;

type Outputs = {
  extract?: { pages: PageText[] };
  segment?: { meta: HeaderMeta; segments: Segment[]; method: string; regionsRepaired: number };
  tag?: TagResult;
  embed?: { vectors: number[][]; rawVectors: number[][] };
  write?: { inserted: number; grouped: number; reviewItems: number };
};

type Ctx = { job: JobDoc; doc: SourceDocumentDoc; out: Outputs };

async function readFile(fileId: Types.ObjectId): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of filesBucket().openDownloadStream(fileId)) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}

// ── Stages ─────────────────────────────────────────────────────────────────

async function extract({ doc }: Ctx): Promise<Outputs['extract']> {
  const pages = await extractDocument(await readFile(doc.fileId), doc.mimeType ?? 'application/pdf');
  const sources = new Set(pages.map((p) => p.source));
  doc.pageCount = pages.length;
  doc.textSource = sources.has('ocr') ? (sources.has('text-layer') ? 'mixed' : 'ocr') : 'text-layer';
  await doc.save();
  return { pages };
}

async function segment({ doc, out }: Ctx): Promise<Outputs['segment']> {
  const pages = out.extract!.pages;
  if (doc.kind === 'notes') return { meta: {}, segments: chunkNotes(pages), method: 'notes-chunks', regionsRepaired: 0 };

  const r = segmentPaper(pages);
  let segments = r.segments;
  let method = 'rules';
  let regionsRepaired = 0;

  if (!r.parsed) {
    if (llmAvailable()) {
      const allText = r.bodyText || pages.map((p) => p.text).join('\n');
      segments = await segmentWholeWithModel(allText);
      method = 'llm';
    } else {
      method = 'unparsed';
    }
  } else if (llmAvailable() && segments.some((s) => s.confidence < LOW_CONFIDENCE)) {
    ({ segments, regionsRepaired } = await repairLowConfidence(segments));
    method = 'rules+llm';
  }

  // Nothing usable: index the text as passages so the paper is at least searchable.
  if (segments.length === 0) {
    segments = chunkNotes(pages).map((s) => ({ ...s, confidence: 0.3, flags: ['unsegmented'] }));
    method += '+passages';
  }
  return { meta: r.meta, segments, method, regionsRepaired };
}

/**
 * The paper's own header is more reliable than what an uploader typed (the
 * catalogue we started from mislabelled several papers' years), so it fills
 * gaps, and a disagreement on course code or year goes to a moderator.
 */
async function applyHeaderMeta(doc: SourceDocumentDoc, meta: HeaderMeta) {
  const conflicts: string[] = [];
  const fill = <K extends 'courseCode' | 'courseTitle' | 'semester' | 'year' | 'month' | 'examType' | 'branch'>(key: K, value: HeaderMeta[K]) => {
    if (value === undefined || value === null || value === '') return;
    const current = doc.get(key);
    if (current === undefined || current === null || current === '') doc.set(key, value);
    else if ((key === 'courseCode' || key === 'year') && String(current).toUpperCase() !== String(value).toUpperCase()) conflicts.push(`${key}: uploaded "${current}", paper says "${value}"`);
  };
  fill('courseCode', meta.courseCode);
  fill('courseTitle', meta.courseTitle);
  fill('semester', meta.semester);
  fill('year', meta.year);
  fill('month', meta.month);
  fill('examType', meta.examType);
  fill('branch', meta.branch);
  await doc.save();
  if (conflicts.length)
    await ReviewItemModel.create({ type: 'metadata', documentId: doc._id, reason: 'Uploaded details disagree with the paper header', payload: { conflicts } });
}

async function tag({ doc, out }: Ctx): Promise<TagResult> {
  await applyHeaderMeta(doc, out.segment!.meta);
  return tagQuestions(out.segment!.segments, { courseCode: doc.courseCode ?? undefined, courseTitle: doc.courseTitle ?? undefined, documentId: doc.id });
}

/**
 * The search vector: the question plus its topic labels, so a concept query
 * matches even when the question's wording doesn't. (The course title is left
 * out: it made unrelated questions from one course look alike, and course
 * filtering is the query parser's job.)
 */
export function embeddingText(text: string, topicLabels: string[]) {
  return [topicLabels.length ? `Topics: ${topicLabels.join(', ')}.` : '', text].filter(Boolean).join(' ');
}

async function embed({ out }: Ctx): Promise<Outputs['embed']> {
  const { segments } = out.segment!;
  const { topics, labels } = out.tag!;
  const texts = segments.map((s, i) => embeddingText(s.text, topics[i]!.map((n) => labels[n] ?? n)));
  // Plain-text vectors too, for duplicate detection: shared topic tags would make different questions look alike.
  const [vectors, rawVectors] = await Promise.all([embedPassages(texts), embedPassages(segments.map((s) => s.text))]);
  return { vectors, rawVectors };
}

/**
 * Find an earlier question this one repeats. The vector index proposes the
 * nearest candidates by search vector; the plain-text vectors decide.
 */
async function findDuplicate(vector: number[], raw: number[]): Promise<{ _id: Types.ObjectId; groupId?: Types.ObjectId } | null> {
  const candidates = await nativeDb()
    .collection('questions')
    .aggregate<{ _id: Types.ObjectId; groupId?: Types.ObjectId; rawEmbedding?: number[] }>([
      { $vectorSearch: { index: VECTOR_INDEX, path: 'embedding', queryVector: vector, numCandidates: 100, limit: 10, filter: { kind: 'question' } } },
      { $project: { groupId: 1, rawEmbedding: 1 } },
    ])
    .toArray();
  let best: { _id: Types.ObjectId; groupId?: Types.ObjectId; sim: number } | null = null;
  for (const c of candidates) {
    if (!c.rawEmbedding?.length) continue;
    const sim = cosine(raw, c.rawEmbedding);
    if (sim >= DUPLICATE_SIMILARITY && (!best || sim > best.sim)) best = { _id: c._id, groupId: c.groupId, sim };
  }
  return best;
}

async function write({ doc, out }: Ctx): Promise<Outputs['write']> {
  const { segments } = out.segment!;
  const { topics } = out.tag!;
  const { vectors, rawVectors } = out.embed!;

  // Idempotent: a retried write replaces whatever a failed attempt left behind.
  await QuestionModel.deleteMany({ documentId: doc._id });
  await ReviewItemModel.deleteMany({ documentId: doc._id, type: { $in: ['segment', 'ocr'] }, status: 'open' });

  const kind = doc.kind === 'notes' ? 'note' : 'question';
  let grouped = 0;
  const rows = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    const _id = new Types.ObjectId();
    let groupId = _id;
    if (kind === 'question') {
      // A repeat inside this same paper, else one from an earlier paper.
      const j = rows.findIndex((r) => cosine(rawVectors[r.idx]!, rawVectors[i]!) >= DUPLICATE_SIMILARITY);
      const dup = j >= 0 ? { _id: rows[j]!.row._id, groupId: rows[j]!.row.groupId } : await findDuplicate(vectors[i]!, rawVectors[i]!);
      if (dup) {
        groupId = dup.groupId ?? dup._id;
        grouped++;
      }
    }
    rows.push({
      idx: i,
      row: {
        _id,
        documentId: doc._id,
        kind,
        label: s.label,
        q: s.q,
        part: s.part,
        sub: s.sub,
        unit: s.unit,
        order: i,
        page: s.page,
        text: s.text,
        marks: s.marks,
        co: s.co,
        bloom: s.bloom,
        topics: topics[i] ?? [],
        courseCode: doc.courseCode,
        courseTitle: doc.courseTitle,
        branch: doc.branch,
        semester: doc.semester,
        year: doc.year,
        examType: doc.examType,
        docKind: doc.kind,
        embedding: vectors[i],
        rawEmbedding: rawVectors[i],
        embeddingModel: EMBEDDING_MODEL,
        segmentConfidence: s.confidence,
        groupId,
      },
    });
  }
  if (rows.length) await QuestionModel.insertMany(rows.map((r) => r.row));

  const reviews = [
    ...rows
      .filter((r) => r.row.segmentConfidence < LOW_CONFIDENCE)
      .map((r) => ({
        type: 'segment',
        documentId: doc._id,
        questionId: r.row._id,
        reason: `Low-confidence question split (${segments[r.idx]!.flags.join(', ') || 'unclear'})`,
        payload: { label: r.row.label, text: r.row.text.slice(0, 500), confidence: r.row.segmentConfidence },
      })),
    ...out.extract!.pages
      .filter((p) => p.source === 'ocr' && (p.ocrConfidence ?? 1) < OCR_REVIEW_BELOW)
      .map((p) => ({ type: 'ocr', documentId: doc._id, reason: `OCR confidence ${Math.round((p.ocrConfidence ?? 0) * 100)}% on page ${p.page}`, payload: { page: p.page } })),
  ];
  if (reviews.length) await ReviewItemModel.insertMany(reviews);
  return { inserted: rows.length, grouped, reviewItems: reviews.length };
}

const RUNNERS: Record<Stage, (ctx: Ctx) => Promise<unknown>> = { extract, segment, tag, embed, write };

// ── Job runner ─────────────────────────────────────────────────────────────

export async function runJob(job: JobDoc) {
  const doc = await SourceDocumentModel.findById(job.documentId);
  if (!doc) throw new Error(`Document ${job.documentId} no longer exists`);
  doc.status = 'processing';
  doc.error = undefined;
  await doc.save();

  const out = (job.outputs ?? {}) as Outputs;
  const ctx: Ctx = { job, doc, out };
  for (const stage of STAGES) {
    if (out[stage]) continue; // finished in an earlier attempt
    const t = Date.now();
    await JobModel.updateOne({ _id: job._id }, { $set: { stage } });
    const result = await RUNNERS[stage](ctx);
    (out as Record<string, unknown>)[stage] = result;
    await JobModel.updateOne({ _id: job._id }, { $set: { [`outputs.${stage}`]: result, [`timings.${stage}`]: Date.now() - t } });
    logger.info({ doc: doc.id, stage, ms: Date.now() - t }, 'Stage done');
  }

  const openReviews = await ReviewItemModel.countDocuments({ documentId: doc._id, status: 'open', type: { $ne: 'topic' } });
  doc.questionCount = out.write!.inserted;
  doc.status = openReviews > 0 ? 'needs_review' : 'ready';
  await doc.save();
  await refreshCourseCatalog();
}
