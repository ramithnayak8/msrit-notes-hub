import { Router } from 'express';
import { z } from 'zod';
import { SourceDocumentModel } from '../models/SourceDocument.js';
import { courseCatalog, shareKeyword } from '../search/catalog.js';

/**
 * Courses of the current scheme, each with the past papers that cover the
 * same subject (matched by title, since codes get reused across schemes) and
 * a warning where papers under the same code are about something else.
 */
export const coursesRouter = Router();

coursesRouter.get('/', async (req, res) => {
  const { semester, scheme } = z.object({ semester: z.coerce.number().int().optional(), scheme: z.string().optional() }).parse(req.query);
  const papers = await SourceDocumentModel.aggregate<{ _id: { code: string; title: string }; papers: number; years: (number | null)[] }>([
    { $match: { courseCode: { $ne: null } } },
    { $group: { _id: { code: '$courseCode', title: '$courseTitle' }, papers: { $sum: 1 }, years: { $addToSet: '$year' } } },
  ]);
  const stats = (code: string, title: string) => papers.find((p) => p._id.code === code && p._id.title === title);

  const items = courseCatalog()
    .filter((c) => c.official && (semester === undefined || c.semester === semester) && (!scheme || c.scheme === scheme))
    .map((c) => ({
      code: c.code,
      title: c.title,
      scheme: c.scheme,
      semester: c.semester,
      pastPapers: c.linked.map((l) => {
        const s = stats(l.code, l.title);
        return { code: l.code, title: l.title, titleSimilarity: l.similarity, papers: s?.papers ?? 0, years: (s?.years ?? []).filter(Boolean).sort() };
      }),
      // Papers filed under this exact code whose subject is something else.
      codeReusedBy: papers
        .filter((p) => p._id.code === c.code && p._id.title && !c.linked.some((l) => l.title === p._id.title) && !shareKeyword(c.title, p._id.title))
        .map((p) => ({ title: p._id.title, papers: p.papers, years: p.years.filter(Boolean).sort() })),
    }));
  res.json({ items });
});
