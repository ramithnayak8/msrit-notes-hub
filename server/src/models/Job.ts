import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const STAGES = ['extract', 'segment', 'tag', 'embed', 'write'] as const;
export type Stage = (typeof STAGES)[number];

/**
 * A background ingestion job. Workers claim one atomically with
 * findOneAndUpdate, so two workers can never run the same job. Each finished
 * stage stores its output in `outputs`, so a retry resumes where it failed.
 */
const jobSchema = new Schema(
  {
    type: { type: String, enum: ['ingest'], default: 'ingest' },
    documentId: { type: Schema.Types.ObjectId, ref: 'SourceDocument', required: true, index: true },
    status: { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued' },
    stage: { type: String, enum: STAGES },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    runAfter: { type: Date, default: () => new Date() },
    lockedAt: { type: Date },
    lockedBy: { type: String },
    lastError: { type: String },
    outputs: { type: Schema.Types.Mixed, default: {} },
    timings: { type: Schema.Types.Mixed, default: {} },
    finishedAt: { type: Date },
  },
  { timestamps: true, minimize: false },
);

jobSchema.index({ status: 1, runAfter: 1 });

export type Job = InferSchemaType<typeof jobSchema>;
export type JobDoc = HydratedDocument<Job>;
export const JobModel = model('Job', jobSchema);
