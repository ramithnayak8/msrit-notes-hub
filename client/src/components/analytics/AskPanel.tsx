'use client';

import { useState } from 'react';
import { askAssistant, AssistantReply, type ChatReply } from '@/components/AssistantReply';
import { Icon } from '@/components/ui/Icon';
import type { InsightFilters } from '@/lib/api';
import { useAuth } from '@/lib/client/auth';

const SUGGESTIONS = ['What should I revise first?', 'Which units carry the most marks?', 'Which questions keep coming back?', 'How are the marks split between short and long questions?'];

/**
 * The assistant, scoped to the slice on screen: the filters go with the
 * question, so the answer is written from the same numbers as the charts.
 * The parent remounts it (by key) when the filters change.
 */
export function AskPanel({ filters, scope }: { filters: InsightFilters; scope: string }) {
  const auth = useAuth();
  const [input, setInput] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [reply, setReply] = useState<ChatReply | null>(null);
  const [pending, setPending] = useState(false);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || pending) return;
    setAsked(q);
    setReply(null);
    setPending(true);
    setReply(await askAssistant(q, auth.ready, { ...filters }));
    setPending(false);
  };

  return (
    <section className="panel panel-pad ask-panel" aria-labelledby="ask-title">
      <div className="row gap-10 wrap" style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 id="ask-title" className="chart-title">
          <Icon name="sparkles" size={18} /> Ask about this view
        </h2>
        <span className="xs muted">Answers from {scope} only</span>
      </div>

      <div className="examples" style={{ marginTop: 14 }}>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="example" onClick={() => ask(s)} disabled={pending}>
            {s}
          </button>
        ))}
      </div>

      <form
        className="searchbar"
        style={{ marginTop: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about these papers, e.g. what to focus on for 10-mark questions"
          aria-label="Ask about this view"
          maxLength={400}
          disabled={pending}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending || !input.trim()}>
          {pending ? 'Working…' : 'Ask'}
        </button>
      </form>

      {(pending || reply) && (
        <div className="ask-answer" aria-live="polite">
          {asked && <p className="turn-question" style={{ marginBottom: 14 }}>{asked}</p>}
          {pending ? (
            <div className="row gap-10 muted small">
              <span className="thinking"><span /><span /><span /></span>
              Reading the papers in this view…
            </div>
          ) : (
            reply && <div><AssistantReply reply={reply} /></div>
          )}
        </div>
      )}
    </section>
  );
}
