import type { QuestionHit } from '@/lib/types';

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Wraps stem-matched words in <mark> without trusting the term as a pattern. */
function highlight(text: string, terms: string[]) {
  const usable = terms.filter((t) => t.length > 2);
  if (!usable.length) return text;

  const pattern = new RegExp(`\\b(${usable.map(escapeRegExp).join('|')})\\w*`, 'gi');
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(<mark key={`${start}-${match[0]}`}>{match[0]}</mark>);
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export function QuestionResult({ hit, rank }: { hit: QuestionHit; rank: number }) {
  return (
    <article className="result fade-in">
      <div className="result-head">
        <div className="row gap-10 wrap">
          <span className="result-cite nums">{String(rank).padStart(2, '0')}</span>
          <span className="tag tag-accent tag-code">{hit.courseCode}</span>
          <span className="small soft">{hit.courseTitle}</span>
        </div>
        <span className="relevance">{hit.score}% match</span>
      </div>

      <p className="result-text reading">{highlight(hit.text, hit.matchedTerms)}</p>

      <div className="result-meta">
        <span className="tag">{hit.examType} · {hit.month} {hit.year}</span>
        <span className="tag">Q{hit.number}</span>
        <span className="tag">{hit.marks} marks</span>
        <span className="tag">Unit {hit.unit}</span>
        <span className="tag">{hit.level}</span>
        {hit.topics.slice(0, 3).map((t) => (
          <span key={t} className="xs muted">· {t}</span>
        ))}
      </div>
    </article>
  );
}
