import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';

export type PageText = {
  page: number;
  text: string;
  /** How the text was obtained; OCR pages may contain recognition errors. */
  source: 'text-layer' | 'ocr' | 'none';
  ocrConfidence?: number;
};

/** A page with fewer characters than this has no usable text layer (it's a scan). */
export const MIN_TEXT_CHARS = 40;

/**
 * Pull text from a PDF's embedded text layer, rebuilding lines from word
 * positions. pdf.js returns text runs in drawing order, which for tables
 * (question | marks | CO | BL columns) is not reading order, so we group runs
 * by baseline (y) and sort each line by x. A wide horizontal gap becomes a tab,
 * which keeps table cells apart for the segmenter.
 */
export async function extractTextLayer(data: Uint8Array): Promise<PageText[]> {
  const task = getDocument({ data, useSystemFonts: false, verbosity: 0 });
  const pdf = await task.promise;
  const pages: PageText[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const items = content.items.filter((i): i is TextItem => 'str' in i && i.str.trim() !== '');
      const text = itemsToLines(items);
      pages.push({ page: n, text, source: text.replace(/\s/g, '').length >= MIN_TEXT_CHARS ? 'text-layer' : 'none' });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

type Run = { x: number; y: number; w: number; h: number; str: string };

export function itemsToLines(items: TextItem[]): string {
  const runs: Run[] = items.map((i) => ({
    x: i.transform[4] as number,
    y: i.transform[5] as number,
    w: i.width,
    h: Math.abs((i.transform[3] as number) || i.height || 10),
    str: i.str,
  }));
  // Top of the page first (PDF y grows upwards), then left to right.
  runs.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: Run[][] = [];
  for (const r of runs) {
    const line = lines.at(-1);
    // Same line if the baselines are within ~half a character height.
    if (line && Math.abs(line[0]!.y - r.y) <= Math.max(2, Math.min(line[0]!.h, r.h) * 0.5)) line.push(r);
    else lines.push([r]);
  }

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      let out = '';
      let end = -Infinity;
      for (const r of line) {
        const gap = r.x - end;
        const charW = r.str.length ? r.w / r.str.length : 5;
        if (out === '') out = r.str;
        else if (gap > charW * 3) out += '\t' + r.str;
        else if (gap > charW * 0.15 && !out.endsWith(' ') && !r.str.startsWith(' ')) out += ' ' + r.str;
        else out += r.str;
        end = Math.max(end, r.x + r.w);
      }
      return out.replace(/[  ]+/g, ' ').replace(/ ?\t ?/g, '\t').trim();
    })
    .filter(Boolean)
    .join('\n');
}
