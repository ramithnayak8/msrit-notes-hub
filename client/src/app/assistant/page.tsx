'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { askAssistant, AssistantReply, type ChatReply } from '@/components/AssistantReply';
import { useAuth } from '@/lib/client/auth';

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
  const auth = useAuth();
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
      const reply = await askAssistant(question, auth.ready);
      setTurns((prev) => [...prev, { role: 'answer', reply }]);
    } finally {
      setPending(false);
    }
  }, [auth.ready]);

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
          Every answer starts from the archive: topic counts across papers for &ldquo;what to revise&rdquo;, and the
          closest questions otherwise. Signed in, an AI model then writes the answer from those results only, citing
          the papers it used.
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
                It ranks topics by how many papers examined them and finds the closest questions,
                then answers with the source papers cited underneath.
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
                <AssistantReply reply={turn.reply} />
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
