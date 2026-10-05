import { NextResponse } from 'next/server';
import { diffSyllabus, getSyllabusCourses } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const course = searchParams.get('course');

  if (!course) {
    return NextResponse.json({ tracked: getSyllabusCourses() });
  }

  const diff = diffSyllabus(course);
  if (!diff) {
    return NextResponse.json(
      { error: `No tracked syllabus versions for "${course}"` },
      { status: 404 }
    );
  }
  return NextResponse.json(diff);
}
