import { NextResponse } from 'next/server';
import { apiGet, type BranchStat, type CatalogCourse } from '@/lib/api';
import { branchInfo } from '@/lib/branches';
import { getLibrarySubjects } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Branches, courses and past-paper subjects in one small payload, for the
 * command palette's fuzzy navigation. Courses come from the API; library
 * subjects from the linked past-papers catalogue stored with this app.
 */
export async function GET() {
  const [{ items: branches }, { items: courses }] = await Promise.all([
    apiGet<{ items: BranchStat[] }>('/branches'),
    apiGet<{ items: CatalogCourse[] }>('/catalog'),
  ]);
  return NextResponse.json({
    departments: branches.map((b) => {
      const info = branchInfo(b.code);
      return { code: b.code, name: info.name, fullName: info.fullName, courses: b.courses };
    }),
    courses: courses.map((c) => ({ code: c.code, title: c.title, dept: c.branches[0] ?? 'COMMON', semester: c.semester ?? 0 })),
    subjects: getLibrarySubjects(),
  });
}
