import { NextResponse } from 'next/server';
import { withBackendErrors } from '@/lib/api-errors';
import { getDepartments, getCoursesByDept } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function get(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const courses = await getCoursesByDept(code);
    if (!courses.length) {
      return NextResponse.json({ error: `No courses for department "${code}"` }, { status: 404 });
    }
    return NextResponse.json({ department: code.toUpperCase(), courses });
  }

  return NextResponse.json({ departments: await getDepartments() });
}

export const GET = withBackendErrors(get);
