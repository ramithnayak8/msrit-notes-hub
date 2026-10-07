import { NextResponse } from 'next/server';
import { searchQuestions } from '@/lib/search';
import { getLibraryForCourses } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });
  }

  const result = searchQuestions(q, limit);
  // Full papers from the library for the courses the top hits come from.
  const courses = [...new Set(result.hits.slice(0, 10).map((h) => h.courseCode))].slice(0, 4);
  return NextResponse.json({ ...result, papers: getLibraryForCourses(courses) });
}
