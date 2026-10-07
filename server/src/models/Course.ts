import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * A course as defined by an official scheme of teaching. The same code can
 * mean different subjects in different schemes (CI52 was "Introduction to
 * Machine Learning" in older papers; in the 2024 scheme it is "Foundations of
 * AI and Computational Agents"), so a course is identified by code + scheme.
 */
const courseSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    scheme: { type: String, required: true },
    program: { type: String, required: true },
    semester: { type: Number, min: 1, max: 8 },
    department: { type: String },
    category: { type: String },
    credits: { L: Number, T: Number, P: Number, total: Number },
    source: { type: String },
  },
  { timestamps: true },
);

courseSchema.index({ code: 1, scheme: 1, program: 1 }, { unique: true });

export type Course = InferSchemaType<typeof courseSchema>;
export const CourseModel = model('Course', courseSchema);
