/** Print the most similar question pairs across different papers, to calibrate the duplicate threshold. */
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { cosine, embedPassages } from '../ml/embedder.js';
import { QuestionModel } from '../models/Question.js';

await connectDb(config.MONGODB_URI);
const qs = await QuestionModel.find({ kind: 'question', segmentConfidence: { $gte: 0.6 } }).select('text documentId').lean();
const raw = await embedPassages(qs.map((q) => q.text));
const pairs: [number, string, string][] = [];
for (let i = 0; i < qs.length; i++)
  for (let j = i + 1; j < qs.length; j++) {
    if (String(qs[i]!.documentId) === String(qs[j]!.documentId)) continue;
    const s = cosine(raw[i]!, raw[j]!);
    if (s > 0.86) pairs.push([s, qs[i]!.text, qs[j]!.text]);
  }
pairs.sort((a, b) => b[0] - a[0]);
for (const [s, a, b] of pairs.slice(0, Number(process.argv[2] ?? 25))) console.log(`${s.toFixed(3)}\n  A: ${a.slice(0, 110)}\n  B: ${b.slice(0, 110)}`);
await disconnectDb();
