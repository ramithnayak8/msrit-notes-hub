import { NextResponse } from 'next/server';
import { withBackendErrors } from '@/lib/api-errors';
import { getStats, getYearRange } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function get() {
  const [stats, yearRange] = await Promise.all([getStats(), getYearRange()]);
  return NextResponse.json({ ...stats, yearRange });
}

export const GET = withBackendErrors(get);
