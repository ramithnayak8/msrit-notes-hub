/**
 * Builds a catalogue of past papers shared by other MSRIT student sites.
 *
 * Only file names and links are collected. No files are downloaded or copied:
 * every entry points back to the original Google Drive file and credits the
 * site it came from.
 *
 *   node scripts/crawl-sources.mjs        -> data/sources/drive-files.json
 *   npm run seed                          -> classifies them into external_papers
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'data', 'sources');

const RIT_NOTEBOOK = 'https://ritnotebook.netlify.app';
const RIT_ISE_LIST = 'https://raw.githubusercontent.com/themohitnair/rise/main/src/app/resources/ResourceList.ts';

const CONCURRENCY = 4;
const MAX_DEPTH = 7;

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#9662;?/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const folderId = (url) => url.match(/\/folders\/([\w-]+)/)?.[1] ?? null;

async function get(url, attempt = 1) {
  const res = await fetch(url, { headers: { 'user-agent': 'ConceptQuery catalogue builder (student project)' } });
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 4) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return get(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// ── Roots ───────────────────────────────────────────────────────

async function ritNotebookRoots() {
  const roots = [];
  const years = { first: 1, second: 2, third: 3, fourth: 4 };

  for (const [slug, year] of Object.entries(years)) {
    const html = await get(`${RIT_NOTEBOOK}/notes/${slug}`);
    if (year === 1) {
      // Streams (h2) > cycles (h3) > subject links.
      let stream = '';
      let cycle = '';
      const re = /<h2>([^<]+)<\/h2>|<h3>([^<]+)<\/h3>|<a href="(https:\/\/drive\.google\.com\/drive\/folders\/[^"]+)"[^>]*>([^<]*)<\/a>/g;
      for (const m of html.matchAll(re)) {
        if (m[1]) stream = decode(m[1]);
        else if (m[2]) cycle = decode(m[2]);
        else roots.push({ id: folderId(m[3]), path: ['First year', stream, cycle, decode(m[4])], year: 1, branch: streamBranch(stream) });
      }
    } else {
      const re = /<h3>([^<]+)<\/h3>\s*<p>[^<]*<\/p>\s*<a[^>]*href="(https:\/\/drive\.google\.com\/drive\/folders\/[^"]+)"/g;
      for (const m of html.matchAll(re)) {
        const branch = decode(m[1]);
        roots.push({ id: folderId(m[2]), path: [`Year ${year}`, branch], year, branch });
      }
    }
  }

  // Mathematics question bank: semester (h1) > course code (h3).
  const html = await get(`${RIT_NOTEBOOK}/mathqb`);
  let sem = '';
  const re = /<h1 class="year">([^<]+)<\/h1>|<h3>([^<]+)<\/h3>\s*<p>([^<]*)<\/p>\s*<div class="actions">\s*<a href="(https:\/\/drive\.google\.com\/drive\/folders\/[^"]+)"/g;
  for (const m of html.matchAll(re)) {
    if (m[1]) sem = decode(m[1]);
    else roots.push({ id: folderId(m[4]), path: ['Mathematics question bank', sem, `${decode(m[2])} (${decode(m[3])})`], year: null, branch: null, questionBank: true });
  }

  return roots.map((r) => ({ ...r, source: 'ritnotebook' }));
}

function streamBranch(stream) {
  if (/computer/i.test(stream)) return 'CSE stream';
  if (/electrical/i.test(stream)) return 'EEE stream';
  if (/civil/i.test(stream)) return 'Civil stream';
  if (/mechanical/i.test(stream)) return 'Mech stream';
  return null;
}

async function ritIseRoots() {
  const src = await get(RIT_ISE_LIST);
  const roots = [];
  const re = /name:\s*"([^"]+)",\s*link:\s*"([^"]+)",\s*year:\s*(\d+),\s*semester:\s*(\d+)/g;
  for (const m of src.matchAll(re)) {
    const id = folderId(m[2]);
    if (!id) continue;
    roots.push({ id, path: [`Semester ${m[4]}`, `${m[1]} (${m[3]} batch)`], semester: Number(m[4]), branch: 'ISE', source: 'riserit' });
  }
  return roots;
}

// ── Drive crawl ─────────────────────────────────────────────────

async function listFolder(id) {
  const html = await get(`https://drive.google.com/embeddedfolderview?id=${id}`);
  const entries = [];
  const re = /<a href="([^"]+)"[^>]*>[\s\S]*?flip-entry-title">([^<]+)</g;
  for (const m of html.matchAll(re)) {
    const url = decode(m[1]);
    const name = decode(m[2]);
    const sub = folderId(url);
    entries.push(sub ? { type: 'folder', id: sub, name } : { type: 'file', url, name });
  }
  return entries;
}

async function crawl(roots) {
  const files = [];
  const seen = new Map(); // folder id -> first path, so shared folders are listed once per root context
  const queue = roots.map((r) => ({ ...r, depth: 0 }));
  let folders = 0;
  let failed = 0;

  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      const key = `${job.source}:${job.id}:${job.path.slice(0, 3).join('/')}`;
      if (seen.has(key)) continue;
      seen.set(key, true);
      try {
        const entries = await listFolder(job.id);
        folders++;
        if (folders % 50 === 0) console.log(`  ${folders} folders, ${files.length} files`);
        for (const e of entries) {
          if (e.type === 'folder') {
            if (job.depth < MAX_DEPTH) queue.push({ ...job, id: e.id, path: [...job.path, e.name], depth: job.depth + 1 });
          } else {
            files.push({
              source: job.source,
              branch: job.branch ?? null,
              year: job.year ?? null,
              semester: job.semester ?? null,
              questionBank: !!job.questionBank,
              path: job.path,
              name: e.name,
              url: e.url,
            });
          }
        }
      } catch (err) {
        failed++;
        console.warn(`  skipped folder ${job.path.join(' / ')}: ${err.message}`);
      }
    }
  }

  // Workers drain a shared queue; new folders are appended as they are found.
  let active = [];
  do {
    active = Array.from({ length: CONCURRENCY }, worker);
    await Promise.all(active);
  } while (queue.length);

  return { files, folders, failed };
}

const roots = [...(await ritNotebookRoots()), ...(await ritIseRoots())].filter((r) => r.id);
console.log(`${roots.length} root folders (RIT Notebook + RIT ISE)`);
const { files, folders, failed } = await crawl(roots);

// The same Drive file is often linked from several roots (shared first-year folders).
const unique = [...new Map(files.map((f) => [`${f.url}|${f.path.join('/')}`, f])).values()];

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'drive-files.json'),
  JSON.stringify({ crawledAt: new Date().toISOString(), folders, failed, files: unique }, null, 1)
);
console.log(`done: ${folders} folders, ${unique.length} files, ${failed} folders skipped`);
