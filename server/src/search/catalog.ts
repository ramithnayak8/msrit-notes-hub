import { cosine, embedPassages } from '../ml/embedder.js';
import { CourseModel } from '../models/Course.js';
import { SourceDocumentModel } from '../models/SourceDocument.js';
import type { Course } from './parseQuery.js';

/**
 * The course catalogue the query parser uses to recognise course names.
 *
 * Two sources: courses that papers were set under (code + title read from
 * each paper's header), and the official current scheme. Codes are reused
 * and titles change between schemes (old-scheme papers have CI52 =
 * "Introduction to Machine Learning"; in the 2024 scheme ML is CI53 and CI52
 * is a different subject), so each current course is linked to past papers
 * by title, not by code. Asking for "Machine Learning" then searches the
 * papers that were actually about machine learning, whatever their code.
 */
export type CourseLink = { code: string; title: string; similarity: number };
export type CatalogCourse = Course & { official: boolean; scheme?: string; semester?: number; linked: CourseLink[] };

/** Title embeddings this close, sharing a meaningful word, are the same subject. */
export const SAME_SUBJECT = 0.8;
const GENERIC = new Set(['introduction', 'foundations', 'fundamentals', 'advanced', 'principles', 'laboratory', 'techniques', 'systems', 'theory', 'applications', 'concepts']);

/** Distinctive words of a title (4+ letters, not generic). */
const keywords = (title: string) =>
  title
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !GENERIC.has(w));

/** True if the titles share a distinctive word; spaces are ignored on the other side ("EnvironmentalStudies"). */
export function shareKeyword(a: string, b: string) {
  const squashed = b.toLowerCase().replace(/[^a-z]/g, '');
  return keywords(a).some((w) => squashed.includes(w));
}

let catalog: CatalogCourse[] = [];

export async function refreshCourseCatalog(): Promise<CatalogCourse[]> {
  const fromPapers = await SourceDocumentModel.aggregate<{ _id: { code: string; title: string }; n: number }>([
    { $match: { courseCode: { $exists: true, $ne: null }, courseTitle: { $exists: true, $ne: null } } },
    { $group: { _id: { code: '$courseCode', title: '$courseTitle' }, n: { $sum: 1 } } },
  ]);
  const official = await CourseModel.find().lean();

  const paperCourses = fromPapers.map((r) => ({ code: r._id.code, title: r._id.title }));
  const [officialVecs, paperVecs] = await Promise.all([embedPassages(official.map((c) => c.title)), embedPassages(paperCourses.map((c) => c.title))]);

  const officialEntries: CatalogCourse[] = official.map((c, i) => {
    const linked = paperCourses
      .map((p, j) => ({ ...p, similarity: Math.round(cosine(officialVecs[i]!, paperVecs[j]!) * 100) / 100 }))
      .filter((p) => p.similarity >= SAME_SUBJECT && shareKeyword(c.title, p.title))
      .sort((a, b) => b.similarity - a.similarity);
    return {
      code: c.code,
      title: c.title,
      official: true,
      scheme: c.scheme,
      semester: c.semester ?? undefined,
      linked,
      filterCodes: [...new Set(linked.map((l) => l.code))],
    };
  });
  const paperEntries: CatalogCourse[] = paperCourses.map((p) => ({ ...p, official: false, linked: [], filterCodes: [p.code] }));

  catalog = [...officialEntries, ...paperEntries];
  return catalog;
}

export const courseCatalog = () => catalog;
