import { NextResponse } from 'next/server';
import { withBackendErrors } from '@/lib/api-errors';
import { getLibraryForCourses, searchQuestions } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function get(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });
  }

  const result = await searchQuestions(q, limit);
  // Full papers from the library for the courses the top hits come from.
  const courses = [...new Set(result.hits.slice(0, 10).map((h) => h.courseCode))].slice(0, 4);
  return NextResponse.json({ ...result, papers: await getLibraryForCourses(courses) });
}

export const GET = withBackendErrors(get);
