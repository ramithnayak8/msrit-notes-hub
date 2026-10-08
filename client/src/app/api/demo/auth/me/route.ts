import { currentUser } from '@/lib/demo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ user: await currentUser() });
}
