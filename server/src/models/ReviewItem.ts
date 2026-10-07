import { Schema, model, type InferSchemaType } from 'mongoose';

/** Something the pipeline wasn't sure about, waiting for a moderator. */
const reviewItemSchema = new Schema(
  {
    type: { type: String, enum: ['segment', 'ocr', 'topic', 'metadata'], required: true },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
    reason: { type: String, required: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'SourceDocument', index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question' },
    topicName: { type: String },
    payload: { type: Schema.Types.Mixed },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    resolution: { type: String },
  },
  { timestamps: true },
);

reviewItemSchema.index({ type: 1, topicName: 1 });

export type ReviewItem = InferSchemaType<typeof reviewItemSchema>;
export const ReviewItemModel = model('ReviewItem', reviewItemSchema);
