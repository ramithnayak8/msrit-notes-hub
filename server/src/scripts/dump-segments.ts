/** Run extraction (with OCR) + segmentation on PDFs and print the result: tsx src/scripts/dump-segments.ts [--brief] [--text] file.pdf... */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { extractDocument, shutdownOcr } from '../ingestion/ocr.js';
import { LOW_CONFIDENCE, segmentPaper } from '../ingestion/segment.js';

const brief = process.argv.includes('--brief');
const showText = process.argv.includes('--text');
for (const file of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
  const t = Date.now();
  const mime = /\.(png|jpe?g)$/i.test(file) ? 'image/png' : 'application/pdf';
  const pages = await extractDocument(new Uint8Array(await readFile(file)), mime);
  const sources = [...new Set(pages.map((p) => p.source))].join('+');
  const ocrConf = pages.filter((p) => p.ocrConfidence !== undefined).map((p) => p.ocrConfidence!.toFixed(2));
  if (showText) for (const p of pages) console.log(`--- page ${p.page} [${p.source}] ---\n${p.text.replace(/\t/g, ' ⇥ ')}`);
  const r = segmentPaper(pages);
  const low = r.segments.filter((s) => s.confidence < LOW_CONFIDENCE).length;
  console.log(`\n${basename(file)} [${sources}${ocrConf.length ? ' conf ' + ocrConf.join(',') : ''}, ${Date.now() - t}ms]: ${r.segments.length} questions, ${low} low-confidence, parsed=${r.parsed}`);
  console.log('  meta', JSON.stringify(r.meta));
  if (brief) continue;
  for (const s of r.segments) {
    const tag = [s.marks !== undefined ? `${s.marks}m` : '-', s.co ?? '-', s.bloom ?? '-', `u${s.unit ?? '?'}`, `p${s.page}`, s.confidence.toFixed(2)].join(' ');
    console.log(`  ${s.label.padEnd(12)} [${tag}]${s.flags.length ? ' {' + s.flags.join(',') + '}' : ''} ${s.text.slice(0, 110)}`);
  }
}
await shutdownOcr();
