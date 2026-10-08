import { endSession } from '@/lib/demo-auth';

export const runtime = 'nodejs';

export async function POST() {
  await endSession();
  return Response.json({ ok: true });
}
