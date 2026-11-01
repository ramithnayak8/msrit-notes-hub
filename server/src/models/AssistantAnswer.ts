import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * A written assistant answer, kept so the same question about the same slice
 * is never paid for twice. Expires after a few days, so answers catch up with
 * newly ingested papers.
 */
const assistantAnswerSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    sources: { type: [{ _id: false, kind: String, label: String, detail: String }], default: [] },
    retrieved: { type: Number, default: 0 },
    provider: { type: String },
    // Students who asked it; shared with everyone else from the second one on.
    askers: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now, expires: 3 * 24 * 3600 },
  },
  { versionKey: false },
);

export type AssistantAnswer = InferSchemaType<typeof assistantAnswerSchema>;
export const AssistantAnswerModel = model('AssistantAnswer', assistantAnswerSchema);

/** AI answers used per scope (`user:<id>` or `global`) per day, for the daily caps. */
const assistantUsageSchema = new Schema(
  {
    scope: { type: String, required: true },
    day: { type: String, required: true },
    n: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: 3 * 24 * 3600 },
  },
  { versionKey: false },
);
assistantUsageSchema.index({ scope: 1, day: 1 }, { unique: true });

export const AssistantUsageModel = model('AssistantUsage', assistantUsageSchema);
