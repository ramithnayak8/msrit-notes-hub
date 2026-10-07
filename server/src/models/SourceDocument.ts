import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const DOC_KINDS = ['question_paper', 'notes'] as const;
export const EXAM_TYPES = ['CIE', 'SEE', 'Makeup', 'Model', 'Question bank', 'Other'] as const;
export const DOC_STATUSES = ['queued', 'processing', 'ready', 'needs_review', 'failed'] as const;

/** An uploaded paper or notes file, and where it came from. */
const sourceDocumentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    kind: { type: String, enum: DOC_KINDS, required: true },
    courseCode: { type: String, uppercase: true, trim: true },
    courseTitle: { type: String, trim: true },
    branch: { type: String, uppercase: true, trim: true },
    semester: { type: Number, min: 1, max: 8 },
    year: { type: Number, min: 1990, max: 2100 },
    month: { type: String },
    examType: { type: String, enum: EXAM_TYPES },

    fileId: { type: Schema.Types.ObjectId, required: true },
    fileName: { type: String },
    fileHash: { type: String, required: true, unique: true },
    fileSize: { type: Number },
    mimeType: { type: String },
    sourceUrl: { type: String },

    status: { type: String, enum: DOC_STATUSES, default: 'queued', index: true },
    pageCount: { type: Number },
    textSource: { type: String, enum: ['text-layer', 'ocr', 'mixed'] },
    questionCount: { type: Number, default: 0 },
    error: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

sourceDocumentSchema.index({ courseCode: 1, year: -1 });
sourceDocumentSchema.index({ branch: 1, semester: 1 });

export type SourceDocument = InferSchemaType<typeof sourceDocumentSchema>;
export type SourceDocumentDoc = HydratedDocument<SourceDocument>;
export const SourceDocumentModel = model('SourceDocument', sourceDocumentSchema, 'documents');
