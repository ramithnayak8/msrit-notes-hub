import { NextResponse } from 'next/server';
import { withBackendErrors } from '@/lib/api-errors';
import { getAllCourses, getDepartments, getLibrarySubjects } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Branches, courses and past-paper subjects in one small payload, for client-side fuzzy navigation. */
async function get() {
  const [allDepartments, allCourses, subjects] = await Promise.all([getDepartments(), getAllCourses(), getLibrarySubjects()]);
  const departments = allDepartments.map((d) => ({
    code: d.code,
    name: d.name,
    fullName: d.full_name,
    courses: d.course_count,
  }));
  const courses = allCourses.map((c) => ({
    code: c.code,
    title: c.title,
    dept: c.dept_code,
    semester: c.semester,
  }));
  return NextResponse.json({ departments, courses, subjects });
}

export const GET = withBackendErrors(get);
