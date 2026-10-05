import { NextResponse } from 'next/server';
import { getDepartments, getCoursesByDept } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const courses = getCoursesByDept(code);
    if (!courses.length) {
      return NextResponse.json({ error: `No courses for department "${code}"` }, { status: 404 });
    }
    return NextResponse.json({ department: code.toUpperCase(), courses });
  }

  return NextResponse.json({ departments: getDepartments() });
}
