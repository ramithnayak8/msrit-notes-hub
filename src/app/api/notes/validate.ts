import { HttpError } from '@/lib/auth';

export const KINDS = ['Handwritten', 'Summary', 'Cheat sheet', 'Solved', 'Typed', 'Slides'] as const;

export type NoteInput = { course_code: string; title: string; kind: string; pages: number; year: number };

export function readNote(body: Record<string, unknown>): NoteInput {
  const title = String(body.title ?? '').trim();
  const course_code = String(body.course_code ?? '').trim().toUpperCase();
  const kind = String(body.kind ?? '').trim();
  const pages = Number(body.pages);
  const year = Number(body.year);
  if (!title) throw new HttpError(400, 'Title is required');
  if (title.length > 120) throw new HttpError(400, 'Title is too long');
  if (!course_code) throw new HttpError(400, 'Course is required');
  if (!(KINDS as readonly string[]).includes(kind)) throw new HttpError(400, `Kind must be one of: ${KINDS.join(', ')}`);
  if (!Number.isInteger(pages) || pages < 1 || pages > 1000) throw new HttpError(400, 'Pages must be 1 to 1000');
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new HttpError(400, 'Year must be between 2000 and 2100');
  return { course_code, title, kind, pages, year };
}
