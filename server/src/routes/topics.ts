import { Router } from 'express';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import { invalidateVocabulary } from '../ingestion/vocabulary.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { QuestionModel } from '../models/Question.js';
import { ReviewItemModel } from '../models/ReviewItem.js';
import { TopicModel, topicSlug } from '../models/Topic.js';

export const topicsRouter = Router();

/** Topics with how many questions use each. */
topicsRouter.get('/', async (req, res) => {
  const { status, q } = z.object({ status: z.enum(['approved', 'proposed']).optional(), q: z.string().optional() }).parse(req.query);
  const filter: Record<string, unknown> = { mergedInto: { $exists: false } };
  if (status) filter.status = status;
  if (q) filter.label = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [topics, counts] = await Promise.all([
    TopicModel.find(filter).sort({ label: 1 }).lean(),
    QuestionModel.aggregate<{ _id: string; n: number }>([{ $unwind: '$topics' }, { $group: { _id: '$topics', n: { $sum: 1 } } }]),
  ]);
  const count = new Map(counts.map((c) => [c._id, c.n]));
  res.json({ items: topics.map((t) => ({ ...t, questionCount: count.get(t.name) ?? 0 })) });
});

topicsRouter.post('/', requireAuth, requireRole('moderator'), async (req, res) => {
  const body = z.object({ label: z.string().trim().min(2).max(60), aliases: z.array(z.string()).default([]), courseCodes: z.array(z.string()).default([]) }).parse(req.body);
  const topic = await TopicModel.create({ ...body, name: topicSlug(body.label), status: 'approved', source: 'manual' });
  invalidateVocabulary();
  res.status(201).json({ topic });
});

/**
 * Moderate a topic: approve it, rename its label, or merge it into another
 * topic (every question tagged with it is re-tagged with the target).
 */
topicsRouter.patch('/:name', requireAuth, requireRole('moderator'), async (req, res) => {
  const body = z
    .object({ status: z.literal('approved').optional(), label: z.string().trim().min(2).max(60).optional(), mergeInto: z.string().optional() })
    .parse(req.body);
  const topic = await TopicModel.findOne({ name: req.params.name });
  if (!topic) throw notFound('Topic');

  if (body.mergeInto) {
    const target = await TopicModel.findOne({ name: body.mergeInto, mergedInto: { $exists: false } });
    if (!target || target.name === topic.name) throw badRequest('Merge target not found');
    // Add the target tag, then drop the old one (two steps: one update can't $addToSet and $pull the same array).
    await QuestionModel.updateMany({ topics: topic.name }, { $addToSet: { topics: target.name } });
    await QuestionModel.updateMany({ topics: topic.name }, { $pull: { topics: topic.name } });
    topic.mergedInto = target.name;
    target.aliases = [...new Set([...target.aliases, topic.label, ...topic.aliases])];
    target.courseCodes = [...new Set([...target.courseCodes, ...topic.courseCodes])];
    await target.save();
  }
  if (body.status) topic.status = body.status;
  if (body.label) topic.label = body.label;
  await topic.save();

  await ReviewItemModel.updateMany(
    { type: 'topic', topicName: topic.name, status: 'open' },
    { $set: { status: 'resolved', resolvedBy: req.user!.id, resolvedAt: new Date(), resolution: body.mergeInto ? `merged into ${body.mergeInto}` : 'approved' } },
  );
  invalidateVocabulary();
  res.json({ topic });
});
