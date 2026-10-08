import { NextResponse } from 'next/server';
import { withBackendErrors } from '@/lib/api-errors';
import { diffSyllabus, getSyllabusCourses } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function get(request: Request) {
  const { searchParams } = new URL(request.url);
  const course = searchParams.get('course');

  if (!course) {
    return NextResponse.json({ tracked: await getSyllabusCourses() });
  }

  const diff = await diffSyllabus(course);
  if (!diff) {
    return NextResponse.json(
      { error: `No tracked syllabus versions for "${course}"` },
      { status: 404 }
    );
  }
  return NextResponse.json(diff);
}

export const GET = withBackendErrors(get);
