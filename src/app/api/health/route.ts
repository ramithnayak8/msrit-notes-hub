import { NextResponse } from 'next/server';
import { checkSource } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Which data source the site is using, and whether the backend answers. */
export async function GET() {
  const source = await checkSource();
  return NextResponse.json(source, { status: source.ok ? 200 : 503 });
}
