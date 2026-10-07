import { TopicModel, topicSlug } from '../models/Topic.js';
import { cosine, embedPassages } from '../ml/embedder.js';

/**
 * The controlled vocabulary, held in memory with its embeddings. It is small
 * (hundreds to a few thousand topics), so finding the closest topics to a
 * question is a quick linear scan; it doesn't need its own vector index.
 */
type Entry = { name: string; label: string; status: string; embedding: number[]; courseCodes: string[] };

let cache: Entry[] | null = null;

export function invalidateVocabulary() {
  cache = null;
}

export async function loadVocabulary(): Promise<Entry[]> {
  if (cache) return cache;
  const topics = await TopicModel.find({ mergedInto: { $exists: false } }).select('+embedding').lean();
  // Topics added without an embedding (by a moderator or the syllabus importer) get one now.
  const missing = topics.filter((t) => !t.embedding?.length);
  if (missing.length) {
    const vecs = await embedPassages(missing.map((t) => t.label));
    await TopicModel.bulkWrite(missing.map((t, i) => ({ updateOne: { filter: { _id: t._id }, update: { $set: { embedding: vecs[i] } } } })));
    missing.forEach((t, i) => (t.embedding = vecs[i]!));
  }
  cache = topics.map((t) => ({ name: t.name, label: t.label, status: t.status, embedding: t.embedding, courseCodes: t.courseCodes }));
  return cache;
}

/** The k vocabulary topics closest to a question, preferring ones already used for this course. */
export function nearestTopics(vocab: Entry[], vector: number[], k: number, courseCode?: string) {
  return vocab
    .map((t) => ({ ...t, score: cosine(vector, t.embedding) + (courseCode && t.courseCodes.includes(courseCode) ? 0.03 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Map a topic label the model proposed onto the vocabulary. Same slug, or an
 * existing topic whose embedding is nearly identical ("Banker's algorithm" vs
 * "Bankers Algorithm for Deadlock Avoidance"), counts as that topic, which
 * stops the vocabulary filling up with near-duplicates.
 */
export const SAME_TOPIC = 0.9;

export async function resolveTopic(vocab: Entry[], label: string): Promise<{ name: string; isNew: boolean; label: string; embedding: number[] }> {
  const name = topicSlug(label);
  const exact = vocab.find((t) => t.name === name);
  if (exact) return { name: exact.name, isNew: false, label: exact.label, embedding: exact.embedding };
  const [vec] = await embedPassages([label]);
  const best = nearestTopics(vocab, vec!, 1)[0];
  if (best && best.score >= SAME_TOPIC) return { name: best.name, isNew: false, label: best.label, embedding: best.embedding };
  return { name, isNew: true, label, embedding: vec! };
}
