import { nativeDb } from '../db.js';
import { EMBEDDING_DIMS } from '../ml/embedder.js';
import { logger } from '../lib/logger.js';

export const TEXT_INDEX = 'questions_text';
export const VECTOR_INDEX = 'questions_vector';

/** Fields both indexes can filter on, so one parsed query drives both searches. */
export const FILTER_FIELDS = ['kind', 'courseCode', 'branch', 'semester', 'year', 'examType', 'marks', 'topics'] as const;

/**
 * Atlas Search (BM25 keyword ranking). Strings that are only ever filtered on
 * exactly are mapped as `token`; topics get both so they can be searched and filtered.
 */
const textIndex = {
  name: TEXT_INDEX,
  definition: {
    mappings: {
      dynamic: false,
      fields: {
        text: { type: 'string', analyzer: 'lucene.english' },
        topics: [{ type: 'string', analyzer: 'lucene.standard' }, { type: 'token' }],
        courseTitle: { type: 'string', analyzer: 'lucene.standard' },
        courseCode: { type: 'token' },
        branch: { type: 'token' },
        examType: { type: 'token' },
        kind: { type: 'token' },
        year: { type: 'number' },
        semester: { type: 'number' },
        marks: { type: 'number' },
      },
    },
  },
};

/** Atlas Vector Search (approximate nearest neighbour over the embeddings, HNSW). */
const vectorIndex = {
  name: VECTOR_INDEX,
  type: 'vectorSearch',
  definition: {
    fields: [
      { type: 'vector', path: 'embedding', numDimensions: EMBEDDING_DIMS, similarity: 'cosine' },
      ...FILTER_FIELDS.map((path) => ({ type: 'filter', path })),
    ],
  },
};

type IndexInfo = { name: string; status?: string; queryable?: boolean };

/** Create any missing search index and wait until both can be queried. */
export async function ensureSearchIndexes({ wait = true, timeoutMs = 120_000 } = {}) {
  const db = nativeDb();
  const existingCollections = await db.listCollections({ name: 'questions' }).toArray();
  if (existingCollections.length === 0) await db.createCollection('questions');
  const questions = db.collection('questions');

  const existing = (await questions.listSearchIndexes().toArray()) as IndexInfo[];
  for (const def of [textIndex, vectorIndex]) {
    if (!existing.some((i) => i.name === def.name)) {
      logger.info({ index: def.name }, 'Creating search index');
      await questions.createSearchIndex(def);
    }
  }
  if (!wait) return;

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const all = (await questions.listSearchIndexes().toArray()) as IndexInfo[];
    const ready = [TEXT_INDEX, VECTOR_INDEX].every((n) => all.find((i) => i.name === n)?.queryable);
    if (ready) {
      logger.info('Search indexes ready');
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  logger.warn('Search indexes are still building; search results may be empty for a moment');
}
