import { fileURLToPath } from 'node:url';
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { logger } from '../lib/logger.js';

/**
 * Sentence embeddings computed on our own server: no API, no per-call cost.
 * bge-small-en-v1.5 is a Sentence-BERT-style bi-encoder producing 384-dim
 * vectors; it uses the [CLS] token as the sentence vector, and we normalise
 * so cosine similarity is a plain dot product.
 */
export const EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';
export const EMBEDDING_DIMS = 384;

// bge models are trained to put this instruction before short search queries
// (not before the passages being searched).
const QUERY_INSTRUCTION = 'Represent this sentence for searching relevant passages: ';

env.cacheDir = fileURLToPath(new URL('../../.model-cache/', import.meta.url));

let extractor: Promise<FeatureExtractionPipeline> | null = null;

function load() {
  extractor ??= (async () => {
    const t = Date.now();
    // q8 = 8-bit quantised weights: about 4x smaller and faster, with little loss in quality.
    const p = await pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'q8' });
    logger.info({ model: EMBEDDING_MODEL, ms: Date.now() - t }, 'Embedding model loaded');
    return p;
  })();
  return extractor;
}

/** Start loading at boot so the first search isn't slow. */
export function warmUpEmbedder() {
  load().catch((err) => logger.error({ err }, 'Embedding model failed to load'));
}

/** Embed passages (questions, notes, topics). */
export async function embedPassages(texts: string[], batchSize = 32): Promise<number[][]> {
  const p = await load();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => t.slice(0, 2000));
    const tensor = await p(batch, { pooling: 'cls', normalize: true });
    out.push(...(tensor.tolist() as number[][]));
  }
  return out;
}

/** Embed a search query, with the bge query instruction. */
export async function embedQuery(text: string): Promise<number[]> {
  const p = await load();
  const tensor = await p([QUERY_INSTRUCTION + text], { pooling: 'cls', normalize: true });
  return (tensor.tolist() as number[][])[0]!;
}

/** Vectors are normalised, so the dot product is the cosine similarity. */
export function cosine(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}
