import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
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
searchRouter.get('/', rateLimit({ windowMs: 60_000, limit: 120 }), async (req, res) => {
  const p = searchQuery.parse(req.query);
  const result = await searchQuestions({
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
  });
  res.json(result);
});
