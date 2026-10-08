import { db } from '@/lib/db';
import { errorResponse, hasRole, HttpError, requireRole } from '@/lib/auth';
import { readNote } from '../validate';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

function findNote(id: string) {
  const note = db().prepare('SELECT id, created_by FROM notes WHERE id = ?').get(Number(id)) as
    | { id: number; created_by: number | null }
    | undefined;
  if (!note) throw new HttpError(404, 'Note not found');
  return note;
}

/** Update: admins can edit any note, uploaders only their own. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireRole('uploader');
    const existing = findNote((await params).id);
    if (!hasRole(user.role, 'admin') && existing.created_by !== user.id) {
      throw new HttpError(403, 'Uploaders can only edit notes they created');
    }
    const note = readNote(await req.json());
    const exists = db().prepare('SELECT 1 FROM courses WHERE code = ?').get(note.course_code);
    if (!exists) throw new HttpError(400, 'Unknown course code');
    db()
      .prepare('UPDATE notes SET course_code = ?, title = ?, kind = ?, pages = ?, year = ? WHERE id = ?')
      .run(note.course_code, note.title, note.kind, note.pages, note.year, existing.id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Delete: admin only. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireRole('admin');
    const existing = findNote((await params).id);
    db().prepare('DELETE FROM notes WHERE id = ?').run(existing.id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
