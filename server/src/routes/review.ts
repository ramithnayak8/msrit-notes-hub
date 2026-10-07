import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { embeddingText } from '../ingestion/pipeline.js';
import { notFound } from '../lib/errors.js';
import { embedPassages } from '../ml/embedder.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { QuestionModel } from '../models/Question.js';
import { ReviewItemModel } from '../models/ReviewItem.js';
import { SourceDocumentModel } from '../models/SourceDocument.js';
import { TopicModel } from '../models/Topic.js';

/** The moderator queue: everything the pipeline wasn't sure about. */
export const reviewRouter = Router();
reviewRouter.use(requireAuth, requireRole('moderator'));

reviewRouter.get('/', async (req, res) => {
  const { type, status } = z
    .object({ type: z.enum(['segment', 'ocr', 'topic', 'metadata']).optional(), status: z.enum(['open', 'resolved', 'dismissed']).default('open') })
    .parse(req.query);
  const items = await ReviewItemModel.find({ status, ...(type && { type }) })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('documentId', 'title courseCode year')
    .lean();
  const counts = await ReviewItemModel.aggregate([{ $match: { status: 'open' } }, { $group: { _id: '$type', n: { $sum: 1 } } }]);
  res.json({ items, openByType: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
});

reviewRouter.post('/:id/resolve', async (req, res) => {
  const { status, resolution } = z.object({ status: z.enum(['resolved', 'dismissed']).default('resolved'), resolution: z.string().max(300).optional() }).parse(req.body);
  if (!isValidObjectId(req.params.id)) throw notFound('Review item');
  const item = await ReviewItemModel.findByIdAndUpdate(
    req.params.id,
    { $set: { status, resolution, resolvedBy: req.user!.id, resolvedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!item) throw notFound('Review item');
  // A paper becomes "ready" once nothing about it is waiting for review.
  if (item.documentId && !(await ReviewItemModel.exists({ documentId: item.documentId, status: 'open', type: { $ne: 'topic' } })))
    await SourceDocumentModel.updateOne({ _id: item.documentId, status: 'needs_review' }, { $set: { status: 'ready' } });
  res.json({ item });
});

export const questionsRouter = Router();

questionsRouter.get('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw notFound('Question');
  const q = await QuestionModel.findById(req.params.id).lean();
  if (!q) throw notFound('Question');
  res.json({ question: q });
});

/** A moderator corrects a question; it is re-embedded so search reflects the fix immediately. */
questionsRouter.patch('/:id', requireAuth, requireRole('moderator'), async (req, res) => {
  const body = z
    .object({
      text: z.string().trim().min(3).optional(),
      label: z.string().trim().optional(),
      marks: z.number().int().min(0).max(100).nullable().optional(),
      co: z.string().nullable().optional(),
      bloom: z.string().nullable().optional(),
      topics: z.array(z.string()).max(5).optional(),
    })
    .parse(req.body);
  if (!isValidObjectId(req.params.id)) throw notFound('Question');
  const q = await QuestionModel.findById(req.params.id);
  if (!q) throw notFound('Question');
  Object.assign(q, Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)));
  q.segmentConfidence = 1;

  const labels = await TopicModel.find({ name: { $in: q.topics } }).select('name label').lean();
  const [vector, raw] = await embedPassages([embeddingText(q.text, labels.map((t) => t.label)), q.text]);
  q.embedding = vector!;
  q.rawEmbedding = raw!;
  await q.save();
  await ReviewItemModel.updateMany({ questionId: q._id, status: 'open' }, { $set: { status: 'resolved', resolvedBy: req.user!.id, resolvedAt: new Date(), resolution: 'edited' } });
  res.json({ question: { ...q.toObject(), embedding: undefined } });
});
