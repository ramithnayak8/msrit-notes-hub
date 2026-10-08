import { redirect } from 'next/navigation';

/** The old syllabus-diff page; the current scheme now lives under /courses. */
export default function SyllabusPage() {
  redirect('/courses');
}
