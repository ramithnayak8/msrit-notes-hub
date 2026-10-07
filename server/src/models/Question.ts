import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * One question (or sub-question) from a paper, or one passage from a notes
 * file. Document metadata (course, year, branch...) is copied onto every
 * question so search filters never need a join.
 */
const questionSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'SourceDocument', required: true, index: true },
    kind: { type: String, enum: ['question', 'note'], default: 'question' },

    // Position in the paper: Q1(a)(i) -> q=1, part='a', sub='i'
    label: { type: String, required: true },
    q: { type: Number },
    part: { type: String },
    sub: { type: String },
    unit: { type: Number },
    order: { type: Number, required: true },
    page: { type: Number },

    text: { type: String, required: true },
    marks: { type: Number },
    co: { type: String },
    bloom: { type: String },
    topics: { type: [String], default: [] },

    courseCode: { type: String },
    courseTitle: { type: String },
    branch: { type: String },
    semester: { type: Number },
    year: { type: Number },
    examType: { type: String },
    docKind: { type: String },

    // Search vector (question + topic labels), indexed for Atlas Vector Search.
    embedding: { type: [Number], select: false },
    // Plain question text vector, only for duplicate detection; not indexed.
    rawEmbedding: { type: [Number], select: false },
    embeddingModel: { type: String },
    segmentConfidence: { type: Number },
    // Near-identical questions across papers share a group; its size is the recurrence count.
    groupId: { type: Schema.Types.ObjectId, index: true },
  },
  { timestamps: true },
);

questionSchema.index({ topics: 1 });
questionSchema.index({ courseCode: 1, year: -1 });

export type Question = InferSchemaType<typeof questionSchema>;
export type QuestionDoc = HydratedDocument<Question>;
export const QuestionModel = model('Question', questionSchema);
