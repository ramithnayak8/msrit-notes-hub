import { Router } from 'express';
import { z } from 'zod';
import { cached } from '../lib/cache.js';
import { searchLimit } from '../middleware/limits.js';
import { searchQuestions } from '../search/search.js';

export const searchRouter = Router();

const csv = z.preprocess((v) => (typeof v === 'string' && v ? v.split(',').map((s) => s.trim().toUpperCase()) : undefined), z.array(z.string()).optional());
const int = z.coerce.number().int().optional();

const searchQuery = z.object({
  q: z.string().trim().max(300).default(''),
  mode: z.enum(['hybrid', 'vector', 'keyword']).default('hybrid'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Optional explicit filters; they override anything parsed from `q`.
  yearFrom: int,
  yearTo: int,
  course: csv,
  branch: z.string().toUpperCase().optional(),
  semester: int,
  marks: int,
  minMarks: int,
  examType: z.enum(['SEE', 'CIE', 'Makeup', 'Model', 'Question bank', 'Other']).optional(),
  kind: z.enum(['question', 'note']).optional(),
});

/** GET /api/search?q=deadlock avoidance last 3 years — no language model involved. */
searchRouter.get('/', searchLimit, async (req, res) => {
  const t = Date.now();
  const p = searchQuery.parse(req.query);
  // Popular searches repeat across students in exam week; one minute of caching skips the embedding and both searches.
  const key = `search:${JSON.stringify({ ...p, q: p.q.toLowerCase().replace(/\s+/g, ' ') })}`;
  const result = await cached(key, () => searchQuestions({
    q: p.q,
    mode: p.mode,
    limit: p.limit,
    filters: {
      yearFrom: p.yearFrom,
      yearTo: p.yearTo,
      courseCodes: p.course,
      branch: p.branch,
      semester: p.semester,
      marks: p.marks,
      minMarks: p.minMarks,
      examType: p.examType,
      kind: p.kind,
    },
  }));
  res.json({ ...result, tookMs: Date.now() - t });
});
