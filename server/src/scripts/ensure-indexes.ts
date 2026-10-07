/** Create the Atlas Search and Vector Search indexes and wait until they are queryable. */
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { ensureSearchIndexes } from '../search/indexes.js';

await connectDb(config.MONGODB_URI);
await ensureSearchIndexes({ wait: true, timeoutMs: 300_000 });
await disconnectDb();
