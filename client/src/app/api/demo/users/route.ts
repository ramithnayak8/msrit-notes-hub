import { db } from '@/lib/db';
import { errorResponse, requireRole } from '@/lib/demo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** List users: admin only. */
export async function GET() {
  try {
    await requireRole('admin');
    const users = db().prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id').all();
    return Response.json({ users });
  } catch (err) {
    return errorResponse(err);
  }
}
