/**
 * Queue every PDF/image in a folder for ingestion, through the same path as
 * the upload endpoint (type check, duplicate check, GridFS, job). The running
 * server's worker then processes them.
 *
 *   npm run import:papers -w server -- ../samples/papers [--kind=notes]
 *
 * A manifest.json next to the files ([{ file, url, ... }]) supplies the
 * source link for each file. Course, year etc. are read from the paper itself.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { acceptUpload, uploadMeta } from '../ingestion/upload.js';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: import-papers <folder> [--kind=notes]');
  process.exit(1);
}
const kind = process.argv.find((a) => a.startsWith('--kind='))?.split('=')[1] ?? 'question_paper';

type ManifestRow = { file: string; url?: string };
const manifestPath = join(dir, 'manifest.json');
const manifest: ManifestRow[] = existsSync(manifestPath) ? JSON.parse((await readFile(manifestPath, 'utf8')).replace(/^﻿/, '')) : [];
const urlFor = new Map(manifest.map((m) => [m.file, m.url]));

await connectDb(config.MONGODB_URI);
let queued = 0;
let duplicates = 0;
// Subfolders too (papers are often filed by subject); paths are relative to `dir`.
const files = (await readdir(dir, { recursive: true })).filter((f) => /\.(pdf|png|jpe?g)$/i.test(f)).sort();
const skipped = (await readdir(dir, { recursive: true })).filter((f) => /\.(docx?|pptx?)$/i.test(f));
for (const file of files) {
  try {
    const meta = uploadMeta.parse({ kind, sourceUrl: urlFor.get(file) });
    const r = await acceptUpload(await readFile(join(dir, file)), basename(file), meta);
    if (r.duplicate) duplicates++;
    else queued++;
    console.log(`${r.duplicate ? 'duplicate' : 'queued   '}  ${file}`);
  } catch (err) {
    console.log(`failed     ${file}: ${(err as Error).message}`);
  }
}
console.log(`\n${queued} queued, ${duplicates} already present`);
if (skipped.length) console.log(`Skipped (Word/PowerPoint not supported, export to PDF): ${skipped.join(', ')}`);
await disconnectDb();
