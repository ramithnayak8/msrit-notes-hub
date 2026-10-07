import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import { createWorker, type Worker } from 'tesseract.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { logger } from '../lib/logger.js';
import { extractTextLayer, type PageText } from './extract.js';

// Rendering at 3x the PDF's 72 dpi gives ~216 dpi for an A4 page, near the
// 200-300 dpi Tesseract is tuned for. Scans saved with oversized page
// dimensions are capped so OCR time stays bounded.
const RENDER_SCALE = 3;
const MAX_RENDER_PX = 2600;
const cachePath = fileURLToPath(new URL('../../.model-cache/tesseract/', import.meta.url));

let worker: Promise<Worker> | null = null;
function getWorker() {
  worker ??= (async () => {
    const w = await createWorker('eng', 1, { cachePath, logger: () => {} });
    // Rendered pages carry no DPI metadata; tell Tesseract roughly what we rendered at.
    await w.setParameters({ user_defined_dpi: '220' });
    return w;
  })();
  return worker;
}

export async function shutdownOcr() {
  if (worker) await (await worker).terminate();
  worker = null;
}

/**
 * Clean a scanned page before recognition.
 *
 * Phone photos of papers are lit unevenly (shadow on one side, glare on the
 * other). Tesseract binarises with one global threshold (Otsu), which on such
 * a photo turns half the page black and finds no text at all. So we first do
 * flat-field correction: estimate the lighting with a heavy blur and divide it
 * out, which leaves the paper evenly white and the ink dark. Then stretch the
 * contrast and sharpen. Tesseract binarises and corrects small skew itself.
 */
export async function preprocess(image: Buffer) {
  const grey = sharp(image).flatten({ background: '#ffffff' }).greyscale();
  const { data, info } = await grey.clone().raw().toBuffer({ resolveWithObject: true });
  const background = await grey
    .clone()
    .blur(Math.max(info.width, info.height) / 60)
    .raw()
    .toBuffer();
  const flat = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) flat[i] = Math.min(255, Math.round((data[i]! / Math.max(1, background[i]!)) * 245));
  return sharp(flat, { raw: { width: info.width, height: info.height, channels: 1 } })
    .normalise()
    .sharpen()
    .png()
    .toBuffer();
}

export async function ocrImage(image: Buffer): Promise<{ text: string; confidence: number }> {
  const w = await getWorker();
  const { data } = await w.recognize(await preprocess(image));
  return { text: data.text.trim(), confidence: Math.round(data.confidence) / 100 };
}

async function renderPdfPages(data: Uint8Array, pageNumbers: number[]): Promise<Map<number, Buffer>> {
  const task = getDocument({ data: data.slice(), verbosity: 0 });
  const pdf = await task.promise;
  const out = new Map<number, Buffer>();
  try {
    for (const n of pageNumbers) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(RENDER_SCALE, MAX_RENDER_PX / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // pdf.js is typed against the DOM canvas; @napi-rs/canvas implements the same API.
      await page.render({ canvas: canvas as never, canvasContext: ctx as never, viewport }).promise;
      out.set(n, canvas.toBuffer('image/png'));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return out;
}

/**
 * Text for every page of an upload. PDF pages with a text layer use it
 * directly; scanned pages (and image uploads) go through OCR.
 */
export async function extractDocument(data: Uint8Array, mimeType: string): Promise<PageText[]> {
  if (mimeType.startsWith('image/')) {
    const { text, confidence } = await ocrImage(Buffer.from(data));
    return [{ page: 1, text, source: 'ocr', ocrConfidence: confidence }];
  }

  const pages = await extractTextLayer(data.slice());
  const scanned = pages.filter((p) => p.source === 'none').map((p) => p.page);
  if (scanned.length === 0) return pages;

  const t = Date.now();
  const images = await renderPdfPages(data, scanned);
  for (const p of pages) {
    const img = images.get(p.page);
    if (!img) continue;
    const { text, confidence } = await ocrImage(img);
    p.text = text;
    p.source = 'ocr';
    p.ocrConfidence = confidence;
  }
  logger.debug({ pages: scanned.length, ms: Date.now() - t }, 'OCR done');
  return pages;
}
