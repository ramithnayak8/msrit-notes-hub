import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { isValidObjectId, Types } from 'mongoose';
import { z } from 'zod';
import { filesBucket } from '../db.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { JobModel } from '../models/Job.js';
import { QuestionModel } from '../models/Question.js';
import { ReviewItemModel } from '../models/ReviewItem.js';
import { DOC_STATUSES, SourceDocumentModel } from '../models/SourceDocument.js';
import { MAX_UPLOAD_BYTES, acceptUpload, uploadMeta } from '../ingestion/upload.js';
import { refreshCourseCatalog } from '../search/catalog.js';

export const documentsRouter = Router();

// Files are held in memory (max 25 MB) just long enough to hash, type-check and stream into GridFS.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

const objectId = (id: string | string[] | undefined) => {
  if (typeof id !== 'string' || !isValidObjectId(id)) throw notFound('Document');
  return new Types.ObjectId(id);
};

documentsRouter.post(
  '/',
  requireAuth,
  requireRole('uploader'),
  rateLimit({ windowMs: 60 * 60_000, limit: 100, keyGenerator: (req) => req.user!.id }),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) throw badRequest('Attach the file as multipart field "file"');
    const meta = uploadMeta.parse(req.body);
    const result = await acceptUpload(req.file.buffer, req.file.originalname, meta, req.user!.id);
    if (result.duplicate) {
      res.status(409).json({ error: { code: 'duplicate_file', message: 'This exact file has already been uploaded', details: { documentId: result.document.id } } });
      return;
    }
    // 202: accepted, processing continues in the background. Poll GET /documents/:id for status.
    res.status(202).json({ document: result.document, jobId: result.jobId });
  },
);

const listQuery = z.object({
  status: z.enum(DOC_STATUSES).optional(),
  courseCode: z.string().optional(),
  branch: z.string().optional(),
  year: z.coerce.number().int().optional(),
  kind: z.enum(['question_paper', 'notes']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

documentsRouter.get('/', async (req, res) => {
  const q = listQuery.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.courseCode) filter.courseCode = q.courseCode.toUpperCase();
  if (q.branch) filter.branch = q.branch.toUpperCase();
  if (q.year) filter.year = q.year;
  if (q.kind) filter.kind = q.kind;
  const [items, total] = await Promise.all([
    SourceDocumentModel.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    SourceDocumentModel.countDocuments(filter),
  ]);
  res.json({ items, total, page: q.page, pages: Math.ceil(total / q.limit) });
});

documentsRouter.get('/:id', async (req, res) => {
  const id = objectId(req.params.id);
  const doc = await SourceDocumentModel.findById(id).lean();
  if (!doc) throw notFound('Document');
  const [job, openReviews] = await Promise.all([
    JobModel.findOne({ documentId: id }).sort({ createdAt: -1 }).select('-outputs').lean(),
    ReviewItemModel.countDocuments({ documentId: id, status: 'open' }),
  ]);
  res.json({ document: doc, job, openReviews });
});

/** The original file, streamed from GridFS. */
documentsRouter.get('/:id/file', async (req, res) => {
  const doc = await SourceDocumentModel.findById(objectId(req.params.id)).lean();
  if (!doc) throw notFound('Document');
  res.setHeader('Content-Type', doc.mimeType ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName ?? 'paper.pdf')}"`);
  await new Promise<void>((resolve, reject) => {
    filesBucket().openDownloadStream(doc.fileId).on('error', reject).pipe(res).on('finish', resolve);
  });
});

documentsRouter.get('/:id/questions', async (req, res) => {
  const id = objectId(req.params.id);
  const items = await QuestionModel.find({ documentId: id }).sort({ order: 1 }).lean();
  res.json({ items });
});

/**
 * Correct a document's details (scanned headers are often unreadable). The
 * fields are copied onto its questions too, since search filters on those.
 */
documentsRouter.patch('/:id', requireAuth, requireRole('moderator'), async (req, res) => {
  const id = objectId(req.params.id);
  const body = uploadMeta.omit({ kind: true, sourceUrl: true }).partial().parse(req.body);
  const set = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
  if (typeof set.courseCode === 'string') set.courseCode = set.courseCode.toUpperCase();
  if (typeof set.branch === 'string') set.branch = set.branch.toUpperCase();
  const doc = await SourceDocumentModel.findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after', runValidators: true });
  if (!doc) throw notFound('Document');

  const copied = (['courseCode', 'courseTitle', 'branch', 'semester', 'year', 'examType'] as const).filter((k) => k in set);
  if (copied.length) await QuestionModel.updateMany({ documentId: id }, { $set: Object.fromEntries(copied.map((k) => [k, set[k]])) });
  await ReviewItemModel.updateMany(
    { documentId: id, type: 'metadata', status: 'open' },
    { $set: { status: 'resolved', resolvedBy: req.user!.id, resolvedAt: new Date(), resolution: 'details corrected' } },
  );
  await refreshCourseCatalog();
  res.json({ document: doc });
});

/** Run the pipeline again from scratch, e.g. after vocabulary changes or a parser fix. */
documentsRouter.post('/:id/reprocess', requireAuth, requireRole('moderator'), async (req, res) => {
  const id = objectId(req.params.id);
  if (!(await SourceDocumentModel.exists({ _id: id }))) throw notFound('Document');
  await SourceDocumentModel.updateOne({ _id: id }, { $set: { status: 'queued' }, $unset: { error: 1 } });
  const job = await JobModel.create({ documentId: id });
  res.status(202).json({ jobId: job.id });
});

documentsRouter.delete('/:id', requireAuth, requireRole('moderator'), async (req, res) => {
  const id = objectId(req.params.id);
  const doc = await SourceDocumentModel.findById(id);
  if (!doc) throw notFound('Document');
  await Promise.all([
    QuestionModel.deleteMany({ documentId: id }),
    ReviewItemModel.deleteMany({ documentId: id }),
    JobModel.deleteMany({ documentId: id }),
    filesBucket().delete(doc.fileId).catch(() => undefined),
  ]);
  await doc.deleteOne();
  res.status(204).end();
});
