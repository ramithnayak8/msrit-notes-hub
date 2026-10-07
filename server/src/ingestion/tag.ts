import { z } from 'zod';
import { generateJson, llmAvailable } from '../llm/provider.js';
import { embedPassages } from '../ml/embedder.js';
import { TopicModel } from '../models/Topic.js';
import { ReviewItemModel } from '../models/ReviewItem.js';
import { invalidateVocabulary, loadVocabulary, nearestTopics, resolveTopic } from './vocabulary.js';

const CANDIDATES_PER_QUESTION = 15;
const MAX_TOPICS = 3;
const QUESTIONS_PER_CALL = 40;
/** Without a language model, a vocabulary topic this close to the question is used as a tag. */
const EMBEDDING_ONLY_THRESHOLD = 0.78;

export type TagResult = {
  /** Topic names (slugs) for each input question, same order. */
  topics: string[][];
  labels: Record<string, string>;
  newTopics: string[];
  llmCalls: number;
  method: 'llm' | 'embedding';
};

const tagSchema = z.object({
  questions: z.array(
    z.object({
      id: z.number().int(),
      topics: z.array(z.string()).describe('Chosen from that question\'s candidate list, copied exactly'),
      newTopics: z.array(z.string()).describe('Only if no candidate fits: short concept names'),
    }),
  ),
});

const SYSTEM = `You tag university exam questions with the concepts they examine, for a topic-based search engine.
Tag the CONCEPT being tested (e.g. "Banker's Algorithm", "AVL Tree Rotation", "Huffman Coding"), not the subject name or the question type.
For each question:
- Choose 1-${MAX_TOPICS} topics from its candidate list when they fit. Copy candidate names exactly.
- Only when no candidate fits, propose up to 2 new topic names: 1-5 words, Title Case, concept-level, reusable across subjects (not "Question about stacks").
- Fewer accurate tags beat many loose ones.`;

/**
 * Concept-level tagging. Candidates come from the controlled vocabulary by
 * embedding similarity; one model call per document (batched) picks from
 * them, or proposes new topics that then wait for a moderator.
 */
export async function tagQuestions(
  questions: { text: string }[],
  ctx: { courseCode?: string; courseTitle?: string; documentId: string },
): Promise<TagResult> {
  const vocab = [...(await loadVocabulary())];
  const vectors = await embedPassages(questions.map((q) => q.text));
  const candidates = vectors.map((v) => nearestTopics(vocab, v, CANDIDATES_PER_QUESTION, ctx.courseCode));
  const labels: Record<string, string> = {};

  if (!llmAvailable()) {
    const topics = candidates.map((c) =>
      c.filter((t) => t.score >= EMBEDDING_ONLY_THRESHOLD).slice(0, MAX_TOPICS).map((t) => {
        labels[t.name] = t.label;
        return t.name;
      }),
    );
    return { topics, labels, newTopics: [], llmCalls: 0, method: 'embedding' };
  }

  const topics: string[][] = questions.map(() => []);
  const newTopics: string[] = [];
  let llmCalls = 0;

  for (let start = 0; start < questions.length; start += QUESTIONS_PER_CALL) {
    const batch = questions.slice(start, start + QUESTIONS_PER_CALL);
    const prompt =
      `Course: ${ctx.courseTitle ?? 'unknown'}${ctx.courseCode ? ` (${ctx.courseCode})` : ''}\n\n` +
      batch
        .map((q, j) => {
          const cands = candidates[start + j]!.map((c) => c.label);
          return `[${start + j}] ${q.text.slice(0, 700)}\nCandidates: ${cands.length ? cands.join(' | ') : '(none yet)'}`;
        })
        .join('\n\n');
    const { data } = await generateJson({ task: 'tag', system: SYSTEM, prompt, schema: tagSchema });
    llmCalls++;

    for (const r of data.questions) {
      if (r.id < start || r.id >= start + batch.length) continue;
      const own = candidates[r.id]!;
      const chosen: string[] = [];
      for (const label of r.topics) {
        const hit = own.find((c) => c.label.toLowerCase() === label.trim().toLowerCase());
        if (hit) {
          chosen.push(hit.name);
          labels[hit.name] = hit.label;
        } else r.newTopics.push(label); // a "choice" that isn't a candidate is really a proposal
      }
      for (const label of r.newTopics.slice(0, 2)) {
        const clean = label.trim().replace(/\s+/g, ' ');
        if (clean.length < 3 || clean.length > 60) continue;
        const t = await resolveTopic(vocab, clean);
        if (t.isNew) {
          await TopicModel.updateOne(
            { name: t.name },
            { $setOnInsert: { name: t.name, label: t.label, status: 'proposed', source: 'llm', embedding: t.embedding } },
            { upsert: true },
          );
          // Upsert so a retried job doesn't queue the same topic twice.
          await ReviewItemModel.updateOne(
            { type: 'topic', topicName: t.name, status: 'open' },
            {
              $setOnInsert: {
                documentId: ctx.documentId,
                reason: `New topic "${t.label}" proposed by the tagger`,
                payload: { label: t.label, example: questions[r.id]!.text.slice(0, 300) },
              },
            },
            { upsert: true },
          );
          vocab.push({ name: t.name, label: t.label, status: 'proposed', embedding: t.embedding, courseCodes: [] });
          newTopics.push(t.name);
        }
        chosen.push(t.name);
        labels[t.name] = t.label;
      }
      topics[r.id] = [...new Set(chosen)].slice(0, MAX_TOPICS);
    }
  }

  // Remember which courses each topic appears in; it nudges future candidate ranking.
  const used = [...new Set(topics.flat())];
  if (ctx.courseCode && used.length) await TopicModel.updateMany({ name: { $in: used } }, { $addToSet: { courseCodes: ctx.courseCode } });
  invalidateVocabulary();
  return { topics, labels, newTopics, llmCalls, method: 'llm' };
}
