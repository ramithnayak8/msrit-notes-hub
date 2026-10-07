/**
 * Retrieval evaluation: run every labelled query in eval/queries.json in each
 * search mode and report Recall@10 and MRR.
 *
 *   npm run eval -w server [-- --verbose]
 *
 * A question is identified as "<courseCode>-<year>-<examType>:<label>", e.g.
 * "CS43-2023-SEE:Q8(b)", which survives re-ingestion (database ids don't).
 *
 * Recall@10: of the questions that should be found, the share in the top 10.
 * MRR (mean reciprocal rank): 1/rank of the first relevant hit, averaged; 1.0
 * means a relevant question was always ranked first.
 */
import { readFile } from 'node:fs/promises';
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { refreshCourseCatalog } from '../search/catalog.js';
import { searchQuestions, type SearchHit, type SearchMode } from '../search/search.js';

type Labelled = { q: string; relevant: string[]; note?: string };

const K = 10;
const verbose = process.argv.includes('--verbose');
const key = (h: SearchHit) => `${h.course.code}-${h.year}-${h.examType}:${h.label}`;

const queries: Labelled[] = JSON.parse(await readFile(new URL('../../eval/queries.json', import.meta.url), 'utf8'));
await connectDb(config.MONGODB_URI);
await refreshCourseCatalog();

const modes: SearchMode[] = ['keyword', 'vector', 'hybrid'];
const totals = Object.fromEntries(modes.map((m) => [m, { recall: 0, mrr: 0 }]));

for (const item of queries) {
  const relevant = new Set(item.relevant);
  const row: string[] = [];
  for (const mode of modes) {
    const { hits } = await searchQuestions({ q: item.q, mode, limit: K });
    const keys = hits.map(key);
    const found = keys.filter((k) => relevant.has(k)).length;
    const firstRank = keys.findIndex((k) => relevant.has(k)) + 1;
    const recall = found / relevant.size;
    const rr = firstRank ? 1 / firstRank : 0;
    totals[mode]!.recall += recall;
    totals[mode]!.mrr += rr;
    row.push(`${mode} R=${recall.toFixed(2)} RR=${rr.toFixed(2)}`);
    if (verbose && recall < 1) console.log(`    [${mode}] missed: ${item.relevant.filter((r) => !keys.includes(r)).join(', ')}`);
  }
  console.log(`${item.q.padEnd(48)} ${row.join('   ')}`);
}

console.log(`\n${queries.length} queries, top ${K}`);
console.log('mode      Recall@10   MRR');
for (const mode of modes) console.log(`${mode.padEnd(9)} ${(totals[mode]!.recall / queries.length).toFixed(3).padStart(9)}   ${(totals[mode]!.mrr / queries.length).toFixed(3)}`);
await disconnectDb();
