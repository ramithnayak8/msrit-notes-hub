import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { searchQuestions } from '@/lib/search';
import { answerQuestion } from '@/lib/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reference implementation of docs/BACKEND_CONTRACT.md over the local SQLite
 * database. Lets the team compare a real backend against known-good answers,
 * and lets this app test its own backend mode:
 *   BACKEND_URL=http://localhost:3000/api/v1
 */
type Ctx = { params: Promise<{ path: string[] }> };

const json = (body: unknown) => NextResponse.json(body);
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

export async function GET(request: Request, { params }: Ctx) {
  const [a, b, c, d] = (await params).path;
  const url = new URL(request.url);

  switch (a) {
    case 'health':
      return json({ ok: true });
    case 'departments':
      if (!b) return json(db.getDepartments());
      if (c === 'courses') return json(db.getCoursesByDept(b));
      return db.getDepartment(b) ? json(db.getDepartment(b)) : notFound();
    case 'courses': {
      if (!b) return json(db.getAllCourses());
      if (!c) return db.getCourse(b) ? json(db.getCourse(b)) : notFound();
      if (c === 'papers') return json(db.getPapersByCourse(b));
      if (c === 'questions') return json(db.getQuestionsByCourse(b));
      if (c === 'notes') return json(db.getNotesByCourse(b));
      if (c === 'library') return json(db.getExternalPapersByCourse(b));
      if (c === 'syllabus' && d === 'diff') return db.diffSyllabus(b) ? json(db.diffSyllabus(b)) : notFound();
      if (c === 'syllabus') return json(db.getSyllabusVersions(b));
      return notFound();
    }
    case 'syllabus':
      if (b === 'courses') return json(db.getSyllabusCourses());
      if (b === 'versions' && d === 'units') return json(db.getSyllabusUnits(Number(c)));
      return notFound();
    case 'stats':
      return json(b === 'years' ? db.getYearRange() : db.getStats());
    case 'search': {
      const q = url.searchParams.get('q')?.trim();
      if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 });
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50);
      return json(searchQuestions(q, limit));
    }
    case 'library': {
      if (b === 'stats') return json(db.getLibraryStats());
      if (b === 'years') return json(db.getLibraryByYear());
      if (b === 'subjects') return json(db.getLibrarySubjects());
      if (b === 'courses') return json(db.getLibraryForCourses((url.searchParams.get('codes') ?? '').split(',').filter(Boolean)));
      if (b) return notFound();
      const s = url.searchParams;
      return json(
        db.getPaperLibrary({
          q: s.get('q') ?? undefined,
          year: Number(s.get('year')) || undefined,
          dept: s.get('dept') ?? undefined,
          exam: s.get('exam')?.split(',').filter(Boolean),
          page: Number(s.get('page')) || 1,
        })
      );
    }
    default:
      return notFound();
  }
}

export async function POST(request: Request, { params }: Ctx) {
  const [a] = (await params).path;
  if (a !== 'chat') return notFound();
  const body = (await request.json().catch(() => ({}))) as { question?: unknown };
  if (typeof body.question !== 'string' || !body.question.trim()) {
    return NextResponse.json({ error: 'Field "question" is required' }, { status: 400 });
  }
  return json(await answerQuestion(body.question.trim()));
}
