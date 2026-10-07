import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';
import { filesBucket } from '../db.js';
import { badRequest } from '../lib/errors.js';
import { JobModel } from '../models/Job.js';
import { DOC_KINDS, EXAM_TYPES, SourceDocumentModel, type SourceDocumentDoc } from '../models/SourceDocument.js';

export const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const optionalNumber = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v === undefined || v === null ? undefined : v), z.coerce.number().int().min(min).max(max).optional());
const optionalString = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(200).optional());

/** Metadata an uploader can supply. All optional: the paper header fills in what's missing. */
export const uploadMeta = z.object({
  kind: z.enum(DOC_KINDS).default('question_paper'),
  title: optionalString,
  courseCode: optionalString,
  courseTitle: optionalString,
  branch: optionalString,
  semester: optionalNumber(1, 8),
  year: optionalNumber(1990, 2100),
  month: optionalString,
  examType: z.preprocess((v) => (v === '' ? undefined : v), z.enum(EXAM_TYPES).optional()),
  sourceUrl: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
});
export type UploadMeta = z.infer<typeof uploadMeta>;

export type UploadResult =
  | { duplicate: false; document: SourceDocumentDoc; jobId: string }
  | { duplicate: true; document: SourceDocumentDoc };

/**
 * Store an uploaded file and queue it for ingestion. The file type is read
 * from the bytes themselves, not the name or the browser's Content-Type, and
 * exact duplicates are caught by SHA-256 of the content.
 */
export async function acceptUpload(buffer: Buffer, fileName: string, meta: UploadMeta, uploadedBy?: string): Promise<UploadResult> {
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !(ALLOWED_TYPES as readonly string[]).includes(type.mime)) throw badRequest('Only PDF, PNG and JPEG files are accepted');

  const fileHash = createHash('sha256').update(buffer).digest('hex');
  const existing = await SourceDocumentModel.findOne({ fileHash });
  if (existing) return { duplicate: true, document: existing };

  const upload = filesBucket().openUploadStream(fileName, { metadata: { contentType: type.mime, sha256: fileHash } });
  await pipeline(Readable.from(buffer), upload);

  const document = await SourceDocumentModel.create({
    ...meta,
    courseCode: meta.courseCode?.toUpperCase(),
    branch: meta.branch?.toUpperCase(),
    title: meta.title ?? fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
    fileId: upload.id,
    fileName,
    fileHash,
    fileSize: buffer.length,
    mimeType: type.mime,
    uploadedBy,
    status: 'queued',
  });
  const job = await JobModel.create({ documentId: document._id });
  return { duplicate: false, document, jobId: job.id };
}
