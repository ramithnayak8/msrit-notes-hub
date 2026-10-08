import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors.js';
import { QuestionModel } from '../models/Question.js';
import { SourceDocumentModel } from '../models/SourceDocument.js';
import { TopicModel } from '../models/Topic.js';
import { courseCatalog } from '../search/catalog.js';

/**
 * Read-only views for browsing the archive by branch and course, built from
 * the papers that have actually been ingested.
 */
export const browseRouter = Router();

type CourseRow = { code: string; title: string; branches: string[]; semester: number | null; papers: number; questions: number; years: number[] };

/** Every course that has papers, with counts. Titles are the most common title seen for the code. */
async function coursesFromPapers(): Promise<CourseRow[]> {
  const [docs, questions] = await Promise.all([
    SourceDocumentModel.aggregate<{ _id: string; titles: string[]; branches: (string | null)[]; semesters: (number | null)[]; papers: number; years: (number | null)[] }>([
      { $match: { courseCode: { $ne: null } } },
      { $group: { _id: '$courseCode', titles: { $push: '$courseTitle' }, branches: { $addToSet: '$branch' }, semesters: { $push: '$semester' }, papers: { $sum: 1 }, years: { $addToSet: '$year' } } },
    ]),
    QuestionModel.aggregate<{ _id: string; n: number }>([{ $match: { courseCode: { $ne: null } } }, { $group: { _id: '$courseCode', n: { $sum: 1 } } }]),
  ]);
  const qCount = new Map(questions.map((q) => [q._id, q.n]));
  const mode = <T,>(xs: T[]) => {
    const counts = new Map<T, number>();
    for (const x of xs) if (x !== null && x !== undefined && x !== '') counts.set(x, (counts.get(x) ?? 0) + 1);
    // Ties go to the shorter value: OCR noise only ever adds characters ("... EI NT").
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).length - String(b[0]).length)[0]?.[0];
  };
  return docs
    .map((d) => ({
      code: d._id,
      // OCR'd headers can garble a title; the most frequent (and then shortest) reading wins.
      title: mode(d.titles.filter((t) => t && t.length < 80)) ?? d._id,
      branches: d.branches.filter((b): b is string => !!b),
      semester: mode(d.semesters) ?? null,
      papers: d.papers,
      questions: qCount.get(d._id) ?? 0,
      years: d.years.filter((y): y is number => typeof y === 'number').sort(),
    }))
    .sort((a, b) => b.questions - a.questions);
}

/** Questions and papers per branch. Papers common to all branches (no branch on the header) are counted under COMMON. */
browseRouter.get('/branches', async (_req, res) => {
  const courses = await coursesFromPapers();
  const byBranch = new Map<string, { courses: Set<string>; papers: number; questions: number }>();
  const docs = await SourceDocumentModel.aggregate<{ _id: string | null; papers: number; courses: string[] }>([
    { $group: { _id: '$branch', papers: { $sum: 1 }, courses: { $addToSet: '$courseCode' } } },
  ]);
  const questions = await QuestionModel.aggregate<{ _id: string | null; n: number }>([{ $group: { _id: '$branch', n: { $sum: 1 } } }]);
  for (const d of docs) {
    const key = d._id ?? 'COMMON';
    byBranch.set(key, { courses: new Set(d.courses.filter(Boolean)), papers: d.papers, questions: 0 });
  }
  for (const q of questions) {
    const entry = byBranch.get(q._id ?? 'COMMON');
    if (entry) entry.questions = q.n;
  }
  res.json({
    items: [...byBranch.entries()].map(([code, v]) => ({ code, courses: v.courses.size, papers: v.papers, questions: v.questions })).sort((a, b) => b.questions - a.questions),
    courses: courses.length,
  });
});

/** Courses with papers, optionally for one branch, for browsing and the command palette. */
browseRouter.get('/catalog', async (req, res) => {
  const { branch } = z.object({ branch: z.string().toUpperCase().optional() }).parse(req.query);
  const courses = await coursesFromPapers();
  const items =
    branch === undefined ? courses : courses.filter((c) => (branch === 'COMMON' ? c.branches.length === 0 : c.branches.includes(branch)));
  res.json({ items });
});

/**
 * Everything about one course: its papers with their questions, the most
 * examined topics, and how it relates to the current scheme. Works for a code
 * from a paper (CI52) and for a current-scheme code (CI53 -> its linked papers).
 */
browseRouter.get('/course/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();
  const official = courseCatalog().find((c) => c.official && c.code === code);
  const linkedCodes = official?.filterCodes ?? [];
  const codes = [...new Set([code, ...linkedCodes])];

  const docs = await SourceDocumentModel.find({ courseCode: { $in: codes } })
    .sort({ year: -1, examType: 1 })
    .select('title courseCode courseTitle branch semester year month examType status questionCount pageCount textSource')
    .lean();
  if (!docs.length && !official) throw notFound('Course');

  const questions = await QuestionModel.find({ documentId: { $in: docs.map((d) => d._id) } })
    .sort({ order: 1 })
    .select('documentId label text marks co bloom unit topics page groupId kind')
    .lean();

  const topicCounts = new Map<string, Set<string>>();
  for (const q of questions) for (const t of q.topics) (topicCounts.get(t) ?? topicCounts.set(t, new Set()).get(t)!).add(String(q.documentId));
  const topicNames = [...topicCounts.keys()];
  const labels = new Map((await TopicModel.find({ name: { $in: topicNames } }).select('name label').lean()).map((t) => [t.name, t.label]));

  const groups = await QuestionModel.aggregate<{ _id: string; docs: string[] }>([
    { $match: { groupId: { $in: questions.map((q) => q.groupId).filter(Boolean) } } },
    { $group: { _id: '$groupId', docs: { $addToSet: '$documentId' } } },
  ]);
  const repeats = new Map(groups.map((g) => [String(g._id), g.docs.length]));

  const ownTitle = docs.find((d) => d.courseCode === code)?.courseTitle;
  res.json({
    code,
    title: official?.title ?? ownTitle ?? docs[0]?.courseTitle ?? code,
    official: official ? { scheme: official.scheme, semester: official.semester, linked: official.linked } : null,
    // A current course whose code was used for a different subject in older papers.
    codeReused: !!official && docs.some((d) => d.courseCode === code && !official.linked.some((l) => l.code === code)),
    papers: docs.map((d) => ({
      ...d,
      id: String(d._id),
      questions: questions
        .filter((q) => String(q.documentId) === String(d._id))
        .map((q) => ({
          id: String(q._id),
          label: q.label,
          text: q.text,
          kind: q.kind,
          marks: q.marks ?? null,
          co: q.co ?? null,
          bloom: q.bloom ?? null,
          unit: q.unit ?? null,
          page: q.page ?? null,
          topics: q.topics.map((n) => ({ name: n, label: labels.get(n) ?? n })),
          askedIn: q.groupId ? (repeats.get(String(q.groupId)) ?? 1) : 1,
        })),
    })),
    topics: [...topicCounts.entries()]
      .map(([name, docSet]) => ({ name, label: labels.get(name) ?? name, papers: docSet.size, questions: questions.filter((q) => q.topics.includes(name)).length }))
      .sort((a, b) => b.papers - a.papers || b.questions - a.questions)
      .slice(0, 15),
  });
});
