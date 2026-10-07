import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * The controlled vocabulary. Topics come from syllabi (approved), from
 * moderators (approved) or are proposed by the tagger during ingestion and
 * wait for a moderator. `name` is the normalised slug used as the tag.
 */
const topicSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    aliases: { type: [String], default: [] },
    courseCodes: { type: [String], default: [] },
    status: { type: String, enum: ['approved', 'proposed'], default: 'proposed', index: true },
    source: { type: String, enum: ['syllabus', 'llm', 'manual'], default: 'manual' },
    // When a moderator merges a proposed topic into another, tags are rewritten to this name.
    mergedInto: { type: String },
    embedding: { type: [Number], select: false },
  },
  { timestamps: true },
);

export type Topic = InferSchemaType<typeof topicSchema>;
export type TopicDoc = HydratedDocument<Topic>;
export const TopicModel = model('Topic', topicSchema);

/** "Banker's Algorithm" -> "bankers-algorithm" */
export function topicSlug(label: string) {
  return label
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9+#]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
