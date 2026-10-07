import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';
import { shutdownOcr } from './ingestion/ocr.js';
import { startWorker } from './ingestion/worker.js';
import { logger } from './lib/logger.js';
import { llmProviders } from './llm/provider.js';
import { warmUpEmbedder } from './ml/embedder.js';
import { ensureSearchIndexes } from './search/indexes.js';
import { refreshCourseCatalog } from './search/catalog.js';

await connectDb(config.MONGODB_URI);
await ensureSearchIndexes({ wait: false });
await refreshCourseCatalog();
warmUpEmbedder();

const server = createApp().listen(config.PORT, () => {
  logger.info({ port: config.PORT, llm: llmProviders().join(', ') || 'none (embedding-only tagging)' }, 'API listening');
});

const stopWorker = config.RUN_WORKER ? startWorker() : null;

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  server.close();
  await stopWorker?.();
  await shutdownOcr();
  await disconnectDb();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
