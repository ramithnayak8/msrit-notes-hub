'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnswerBody } from '@/components/AnswerBody';
/** The API's answer: composed from retrieved questions and topic counts, with no language model. */
type ChatReply = {
  answer: string;
  sources: { kind: string; label: string; detail: string }[];
  mode: string;
  retrieved: number;
  tookMs: number;
};

type Turn =
  | { role: 'question'; text: string }
  | { role: 'answer'; reply: ChatReply };

const PROMPTS = [
  'What should I revise first for ML?',
  'Which Software Engineering topics repeat the most?',
  'Most important topics for DAA',
  'Show me agile process questions',
  'Shortest path questions worth 8 marks',
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
      const response = await fetch('/api/assistant', {
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
            mode: 'retrieval',
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
          Answers are built only from the archive: topic counts across papers for &ldquo;what to revise&rdquo;,
          and the closest questions otherwise. No language model runs here, and every answer lists its sources.
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
              <h2 style={{ fontSize: 34 }}>Ask the archive what to revise</h2>
              <p className="lead" style={{ marginTop: 12, fontSize: 15 }}>
                It ranks topics by how many papers examined them, or finds the closest questions,
                with the source papers cited underneath.
              </p>
              {/* The sidebar with these prompts is hidden on small screens. */}
              <div className="examples assistant-prompts-mobile" style={{ marginTop: 20, justifyContent: 'center' }}>
                {PROMPTS.map((p) => (
                  <button key={p} type="button" className="example" onClick={() => ask(p)}>
                    {p}
                  </button>
                ))}
              </div>
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
                      answered from retrieval, no language model
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
