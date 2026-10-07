import { NextResponse } from 'next/server';
import { answerQuestion } from '@/lib/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let question: unknown;
  try {
    ({ question } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  if (typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ error: 'Field "question" is required' }, { status: 400 });
  }

  return NextResponse.json(await answerQuestion(question.trim()));
}
