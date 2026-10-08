import { db } from '@/lib/db';
import { errorResponse, HttpError, requireRole, ROLES, type Role } from '@/lib/auth';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Change a user's role: admin only, and never your own, so an admin cannot lock themselves out. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireRole('admin');
    const id = Number((await params).id);
    const { role } = (await req.json()) as { role: Role };
    if (!ROLES.includes(role)) throw new HttpError(400, `Role must be one of: ${ROLES.join(', ')}`);
    if (id === admin.id) throw new HttpError(400, 'You cannot change your own role');
    const result = db().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    if (result.changes === 0) throw new HttpError(404, 'User not found');
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Delete a user: admin only, never yourself. Their notes stay, without an owner. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const admin = await requireRole('admin');
    const id = Number((await params).id);
    if (id === admin.id) throw new HttpError(400, 'You cannot delete your own account');
    db().prepare('UPDATE notes SET created_by = NULL WHERE created_by = ?').run(id);
    const result = db().prepare('DELETE FROM users WHERE id = ?').run(id);
    if (result.changes === 0) throw new HttpError(404, 'User not found');
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
