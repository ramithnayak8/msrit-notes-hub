import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { istDay } from '../assistant/grounded.js';
import { config } from '../config.js';
import { nativeDb } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AssistantUsageModel } from '../models/AssistantAnswer.js';
import { QuestionModel } from '../models/Question.js';
import { RefreshTokenModel } from '../models/RefreshToken.js';
import { ReviewItemModel } from '../models/ReviewItem.js';
import { SourceDocumentModel } from '../models/SourceDocument.js';
import { TopicModel } from '../models/Topic.js';
import { ROLES, UserModel } from '../models/User.js';

/** The moderators' dashboard: the state of the archive at a glance, and the people using it. */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('moderator'));

/** Atlas's free tier stops accepting writes at 512 MB. */
const FREE_TIER_BYTES = 512 * 1024 * 1024;

adminRouter.get('/summary', async (_req, res) => {
  const [byStatus, questions, topics, reviews, roles, unverified, aiToday, stats] = await Promise.all([
    SourceDocumentModel.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    QuestionModel.countDocuments({ kind: 'question' }),
    TopicModel.aggregate<{ _id: string; n: number }>([{ $match: { mergedInto: { $exists: false } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ReviewItemModel.aggregate<{ _id: string; n: number }>([{ $match: { status: 'open' } }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
    UserModel.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    UserModel.countDocuments({ emailVerified: false }),
    AssistantUsageModel.findOne({ scope: 'global', day: istDay() }).lean(),
    nativeDb().stats(),
  ]);
  const map = (rows: { _id: string; n: number }[]) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  res.json({
    documents: map(byStatus),
    questions,
    topics: map(topics),
    openReviews: map(reviews),
    users: { byRole: map(roles), unverified },
    assistant: { usedToday: aiToday?.n ?? 0, dailyLimit: config.ASSISTANT_GLOBAL_DAILY },
    storage: { usedBytes: (stats.dataSize as number) + (stats.indexSize as number), limitBytes: FREE_TIER_BYTES },
  });
});

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  role: z.enum(ROLES).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

adminRouter.get('/users', async (req, res) => {
  const { q, role, page } = listQuery.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (q) {
    const re = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [{ name: re }, { email: re }];
  }
  const limit = 25;
  const [items, total] = await Promise.all([
    UserModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('name email role emailVerified createdAt').lean(),
    UserModel.countDocuments(filter),
  ]);
  res.json({ items: items.map(({ _id, ...u }) => ({ id: String(_id), ...u })), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

const userId = (id: string | undefined) => {
  if (!id || !isValidObjectId(id)) throw notFound('User');
  return id;
};

/**
 * Change someone's role; it takes effect on their next request (requireRole
 * reads the database). A moderator can't change their own role, and the last
 * moderator can't be demoted: if two moderators demote each other at once,
 * the recount after each change undoes whichever would leave none.
 */
adminRouter.patch('/users/:id', async (req, res) => {
  const id = userId(req.params.id);
  const { role } = z.object({ role: z.enum(ROLES) }).parse(req.body);
  if (id === req.user!.id) throw badRequest('You cannot change your own role');
  const before = await UserModel.findByIdAndUpdate(id, { $set: { role } }).select('role').lean();
  if (!before) throw notFound('User');
  if (before.role === 'moderator' && role !== 'moderator' && (await UserModel.countDocuments({ role: 'moderator' })) === 0) {
    await UserModel.updateOne({ _id: id }, { $set: { role: 'moderator' } });
    throw conflict('There must always be at least one moderator');
  }
  const user = (await UserModel.findById(id).select('name email role emailVerified createdAt').lean())!;
  res.json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified, createdAt: user.createdAt } });
});

/** Remove an account and sign it out everywhere. Papers it uploaded stay in the archive. Moderators are demoted first. */
adminRouter.delete('/users/:id', async (req, res) => {
  const id = userId(req.params.id);
  if (id === req.user!.id) throw badRequest('You cannot delete your own account here');
  const user = await UserModel.findOneAndDelete({ _id: id, role: { $ne: 'moderator' } });
  if (!user) {
    if (await UserModel.exists({ _id: id })) throw conflict('Change a moderator to another role before deleting the account');
    throw notFound('User');
  }
  await RefreshTokenModel.deleteMany({ userId: id });
  res.status(204).end();
});
