import { db } from '@/lib/db';
import { ensureAuthTables, errorResponse, HttpError, requireRole } from '@/lib/demo-auth';
import { readNote } from './validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Read: anyone, signed in or not. */
export async function GET() {
  try {
    ensureAuthTables();
    const notes = db()
      .prepare(
        `SELECT n.id, n.course_code, c.title AS course_title, n.title, n.kind, n.pages, n.contributor, n.year,
                n.created_by, u.name AS created_by_name
         FROM notes n
         JOIN courses c ON c.code = n.course_code
         LEFT JOIN users u ON u.id = n.created_by
         ORDER BY n.id DESC`,
      )
      .all();
    const courses = db().prepare('SELECT code, title FROM courses ORDER BY code').all();
    return Response.json({ notes, courses });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Create: uploader or admin. */
export async function POST(req: Request) {
  try {
    const user = await requireRole('uploader');
    const note = readNote(await req.json());
    const exists = db().prepare('SELECT 1 FROM courses WHERE code = ?').get(note.course_code);
    if (!exists) throw new HttpError(400, 'Unknown course code');
    const result = db()
      .prepare(
        'INSERT INTO notes (course_code, title, kind, pages, contributor, year, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(note.course_code, note.title, note.kind, note.pages, user.name, note.year, user.id);
    return Response.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
