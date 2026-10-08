import Link from 'next/link';
import { BookmarkButton } from '@/components/study/ShelfButtons';
import { Icon } from '@/components/ui/Icon';
import { paperFileUrl, type SearchHit } from '@/lib/api';

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Wraps words that start with a query term in <mark> without trusting the term as a pattern. */
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

/** Which of the two searches found this question, and at what rank. */
function foundBy(ranks: SearchHit['ranks']) {
  const parts = [];
  if (ranks.keyword) parts.push(`keyword #${ranks.keyword}`);
  if (ranks.vector) parts.push(`meaning #${ranks.vector}`);
  return parts.join(' · ');
}

export function QuestionResult({ hit, rank, terms = [] }: { hit: SearchHit; rank: number; terms?: string[] }) {
  const paper = [hit.examType, [hit.source.month, hit.year].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  const how = foundBy(hit.ranks);
  const repeatedYears = hit.recurrence.years;
  return (
    <article className="result fade-in">
      <div className="result-head">
        <div className="row gap-10 wrap">
          <span className="result-cite nums">{String(rank).padStart(2, '0')}</span>
          {hit.course.code && (
            <Link href={`/courses/${hit.course.code}`} className="tag tag-accent tag-code">
              {hit.course.code}
            </Link>
          )}
          <span className="small soft">{hit.course.title}</span>
        </div>
        <span className="row gap-10">
          {how && <span className="relevance" title="Rank in the keyword (BM25) and meaning (vector) searches, merged by reciprocal rank fusion">{how}</span>}
          <BookmarkButton
            question={{
              id: hit.id,
              number: hit.label.replace(/^Q/, ''),
              text: hit.text,
              marks: hit.marks ?? 0,
              courseCode: hit.course.code ?? '',
              courseTitle: hit.course.title ?? '',
              paper,
            }}
          />
        </span>
      </div>

      <p className="result-text reading">{highlight(hit.text, terms)}</p>

      <div className="result-meta">
        {paper && <span className="tag">{paper}</span>}
        <span className="tag">{hit.label}</span>
        {hit.marks !== undefined && <span className="tag">{hit.marks} marks</span>}
        {hit.unit !== undefined && <span className="tag">Unit {hit.unit}</span>}
        {hit.co && <span className="tag">{hit.co}</span>}
        {hit.bloom && <span className="tag">{hit.bloom}</span>}
        {hit.recurrence.count > 1 && (
          <span className="tag tag-amber" title={`Near-identical question found in ${hit.recurrence.count} papers`}>
            Asked in {hit.recurrence.count} papers{repeatedYears.length > 1 ? ` · ${repeatedYears[0]}–${repeatedYears.at(-1)}` : ''}
          </span>
        )}
        <a href={paperFileUrl(hit.source.documentId, hit.page)} target="_blank" rel="noopener noreferrer" className="xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="file" size={13} /> Open paper{hit.page ? ` · p.${hit.page}` : ''}
        </a>
      </div>

      {hit.topics.length > 0 && (
        <div className="row wrap gap-6" style={{ marginTop: 10 }}>
          {hit.topics.map((t) => (
            <Link key={t.name} href={`/search?q=${encodeURIComponent(t.label)}`} className="xs muted">
              # {t.label}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
