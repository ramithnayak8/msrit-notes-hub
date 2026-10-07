import { NextResponse } from 'next/server';
import { getAllCourses, getDepartments } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Branches and courses in one small payload, for client-side fuzzy navigation. */
export async function GET() {
  const departments = getDepartments().map((d) => ({
    code: d.code,
    name: d.name,
    fullName: d.full_name,
    courses: d.course_count,
  }));
  const courses = getAllCourses().map((c) => ({
    code: c.code,
    title: c.title,
    dept: c.dept_code,
    semester: c.semester,
  }));
  return NextResponse.json({ departments, courses });
}
