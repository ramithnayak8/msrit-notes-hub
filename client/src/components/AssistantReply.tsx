'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AnswerBody } from '@/components/AnswerBody';
import { Icon } from '@/components/ui/Icon';
import { authFetch, refreshSession } from '@/lib/client/auth';

/** The API's answer: written by the model from retrieved archive data (mode 'ai'), or composed from retrieval alone. */
export type ChatReply = {
  answer: string;
  sources: { kind: string; label: string; detail: string }[];
  mode: 'ai' | 'retrieval';
  provider?: string;
  cached?: boolean;
  notice?: 'sign-in' | 'user-limit' | 'global-limit' | 'unavailable';
  usage?: { used: number; limit: number };
  retrieved: number;
  tookMs: number;
};

const UNREACHABLE: ChatReply = { answer: 'The assistant could not be reached. Check that the server is running.', sources: [], mode: 'retrieval', retrieved: 0, tookMs: 0 };

/** Ask the assistant, signed in when possible so the answer can be written by the model. `filters` scope it to a slice. */
export async function askAssistant(question: string, authReady: boolean, filters?: Record<string, string | number | undefined>): Promise<ChatReply> {
  try {
    if (!authReady) await refreshSession();
    const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, ...(filters && { filters }) }) };
    let res = await authFetch('/api/assistant', init);
    // The session ended and couldn't be refreshed: ask signed out rather than fail.
    if (res.status === 401) res = await fetch('/api/assistant', init);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { ...UNREACHABLE, answer: body?.error?.message ?? `The assistant answered with an error (${res.status}).` };
    }
    return (await res.json()) as ChatReply;
  } catch {
    return UNREACHABLE;
  }
}

const NOTICE: Record<NonNullable<ChatReply['notice']>, ReactNode> = {
  'sign-in': (
    <>
      <Link href="/login">Sign in</Link> with your MSRIT email to get answers written by AI from these results.
    </>
  ),
  'user-limit': <>You have used all of today&rsquo;s AI answers. This one is built from the archive directly; AI answers reset at midnight.</>,
  'global-limit': <>The site has used today&rsquo;s AI answers. This one is built from the archive directly; AI answers reset at midnight.</>,
  unavailable: <>The AI model couldn&rsquo;t answer just now, so this one is built from the archive directly. Try again in a minute.</>,
};

/** An answer with its numbered sources and a line saying how it was produced. */
export function AssistantReply({ reply }: { reply: ChatReply }) {
  const ai = reply.mode === 'ai';
  return (
    <>
      {ai && (
        <div className="reply-badge">
          <Icon name="sparkles" size={14} /> AI answer, written only from the papers below
        </div>
      )}
      <AnswerBody text={reply.answer} />
      {reply.notice && (
        <p className="reply-notice small">
          <Icon name="info" size={15} />{' '}
          <span>
            {NOTICE[reply.notice]}
            {reply.notice === 'user-limit' && reply.usage ? ` (${reply.usage.used} of ${reply.usage.limit} used)` : ''}
          </span>
        </p>
      )}
      {reply.sources.length > 0 && (
        <div className="sources">
          <div className="label">Sources</div>
          <div style={{ marginTop: 8 }}>
            {reply.sources.map((s, si) => (
              <div key={`${s.label}-${si}`} className="source-item">
                <span className="source-index">[{si + 1}]</span>
                <span>
                  <span style={{ color: 'var(--ink)' }}>{s.label}</span>
                  {s.detail && <span className="muted"> — {s.detail}</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="xs muted" style={{ marginTop: 12 }}>
            {reply.retrieved} record{reply.retrieved === 1 ? '' : 's'} retrieved · {reply.tookMs} ms ·{' '}
            {ai ? `written by ${reply.provider === 'groq' ? 'Llama (Groq)' : 'Gemini'}${reply.cached ? ', saved answer' : ''}` : 'answered from retrieval, no language model'}
            {reply.usage && ai ? ` · ${reply.usage.used} of ${reply.usage.limit} AI answers used today` : ''}
          </p>
        </div>
      )}
    </>
  );
}
