/** Print the extracted text of PDFs, for developing the segmenter: tsx src/scripts/dump-text.ts file.pdf... */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { extractTextLayer } from '../ingestion/extract.js';

for (const file of process.argv.slice(2)) {
  const pages = await extractTextLayer(new Uint8Array(await readFile(file)));
  console.log(`\n===== ${basename(file)} (${pages.length} pages) =====`);
  for (const p of pages) {
    console.log(`--- page ${p.page} [${p.source}] ---`);
    console.log(p.text.replace(/\t/g, ' ⇥ '));
  }
}
