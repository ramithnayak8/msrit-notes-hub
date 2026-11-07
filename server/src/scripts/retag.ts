/**
 * Re-run topic tagging on papers that are already ingested, without repeating
 * extraction, OCR or embedding (after a tagging fix, or a better model):
 *
 *   npm run retag -w server                 # every ingested paper
 *   npm run retag -w server -- CI51 CI54    # only these course codes
 */
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { tagQuestions } from '../ingestion/tag.js';
import { QuestionModel } from '../models/Question.js';
import { SourceDocumentModel } from '../models/SourceDocument.js';

const codes = process.argv.slice(2).filter((a) => !a.startsWith('--'));
await connectDb(config.MONGODB_URI);
const docs = await SourceDocumentModel.find({ status: { $in: ['ready', 'needs_review'] }, ...(codes.length && { courseCode: { $in: codes } }) })
  .select('fileName courseCode courseTitle')
  .lean();
for (const doc of docs) {
  const questions = await QuestionModel.find({ documentId: doc._id }).sort({ order: 1 }).select('text').lean();
  if (!questions.length) continue;
  const t = Date.now();
  const r = await tagQuestions(questions, { courseCode: doc.courseCode ?? undefined, courseTitle: doc.courseTitle ?? undefined, documentId: String(doc._id) });
  await QuestionModel.bulkWrite(questions.map((q, i) => ({ updateOne: { filter: { _id: q._id }, update: { $set: { topics: r.topics[i] ?? [] } } } })));
  console.log(`${doc.fileName}: ${questions.length} questions, ${r.newTopics.length} new topics, ${Math.round((Date.now() - t) / 1000)}s`);
}
await disconnectDb();
