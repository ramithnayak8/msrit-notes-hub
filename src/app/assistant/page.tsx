'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnswerBody } from '@/components/AnswerBody';
import type { ChatReply } from '@/lib/chat';

type Turn =
  | { role: 'question'; text: string }
  | { role: 'answer'; reply: ChatReply };

const PROMPTS = [
  'How has the Operating Systems syllabus changed from last year?',
  'What should I revise first for Operating Systems?',
  'Show me deadlock questions from the last 2 years',
  'Which DBMS topics repeat the most?',
  'Binary tree questions worth 10 marks',
];

function Assistant() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const params = useSearchParams();
  const initial = params.get('q');
  const askedInitial = useRef(false);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, pending]);

  const ask = useCallback(async function ask(question: string) {
    if (!question.trim()) return;
    setTurns((prev) => [...prev, { role: 'question', text: question }]);
    setInput('');
    setPending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const reply: ChatReply = await response.json();
      setTurns((prev) => [...prev, { role: 'answer', reply }]);
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          role: 'answer',
          reply: {
            answer: 'The assistant could not be reached. Check that the server is running.',
            sources: [],
            mode: 'local',
            retrieved: 0,
            tookMs: 0,
          },
        },
      ]);
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    if (initial && !askedInitial.current) {
      askedInitial.current = true;
      ask(initial);
    }
  }, [initial, ask]);

  return (
    <main className="assistant">
      <aside className="assistant-side">
        <div className="label">Study assistant</div>
        <p className="small muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
          Answers are grounded in retrieved questions and syllabus schemes from the archive. Every
          answer lists the papers it drew on.
        </p>

        <div className="label" style={{ marginTop: 28 }}>Try asking</div>
        <div className="stack gap-6" style={{ marginTop: 12 }}>
          {PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              className="btn btn-quiet small"
              style={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                lineHeight: 1.45,
                height: 'auto',
                padding: '8px 10px',
                whiteSpace: 'normal',
              }}
              onClick={() => ask(p)}
              disabled={pending}
            >
              {p}
            </button>
          ))}
        </div>

        {turns.length > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ marginTop: 28, width: '100%' }}
            onClick={() => setTurns([])}
          >
            Clear conversation
          </button>
        )}
      </aside>

      <div className="assistant-main">
        <div className="assistant-log" ref={logRef}>
          {turns.length === 0 && !pending && (
            <div style={{ margin: 'auto', maxWidth: 520, textAlign: 'center' }}>
              <h2 style={{ fontSize: 24 }}>Ask the archive what to revise</h2>
              <p className="lead" style={{ marginTop: 12, fontSize: 15 }}>
                The assistant searches indexed question papers and syllabus schemes, then answers
                from what it finds — with the source papers cited underneath.
              </p>
            </div>
          )}

          {turns.map((turn, i) =>
            turn.role === 'question' ? (
              <div key={i} className="turn-question fade-in">{turn.text}</div>
            ) : (
              <div key={i} className="turn-answer fade-in">
                <AnswerBody text={turn.reply.answer} />

                {turn.reply.sources.length > 0 && (
                  <div className="sources">
                    <div className="label">Sources</div>
                    <div style={{ marginTop: 8 }}>
                      {turn.reply.sources.map((s, si) => (
                        <div key={`${s.label}-${si}`} className="source-item">
                          <span className="source-index">[{si + 1}]</span>
                          <span>
                            <span style={{ color: 'var(--ink)' }}>{s.label}</span>
                            <span className="muted"> — {s.detail}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="xs muted" style={{ marginTop: 12 }}>
                      {turn.reply.retrieved} record{turn.reply.retrieved === 1 ? '' : 's'} retrieved ·{' '}
                      {turn.reply.tookMs} ms ·{' '}
                      {turn.reply.mode === 'claude'
                        ? 'composed by Claude from retrieved context'
                        : 'composed directly from the archive'}
                    </p>
                  </div>
                )}
              </div>
            )
          )}

          {pending && (
            <div className="turn-answer fade-in">
              <div className="row gap-10 muted small">
                <span className="thinking"><span /><span /><span /></span>
                Searching the archive…
              </div>
            </div>
          )}
        </div>

        <div className="assistant-foot">
          <form
            className="searchbar"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a topic, a paper, or what changed this year…"
              aria-label="Ask the study assistant"
              disabled={pending}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending || !input.trim()}>
              {pending ? 'Working…' : 'Ask'}
            </button>
          </form>
          <p className="xs muted" style={{ marginTop: 10 }}>
            Grounded in the indexed archive only. It will say so when it cannot find something
            rather than guessing.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="shell section-sm"><span className="spinner" /></div>}>
      <Assistant />
    </Suspense>
  );
}
