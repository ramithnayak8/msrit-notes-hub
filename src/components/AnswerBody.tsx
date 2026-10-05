import React from 'react';

/** Renders **bold** spans without dangerouslySetInnerHTML. */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>
    )
  );
}

/**
 * The assistant answers in a light markdown subset: blank-line paragraphs,
 * `+`/`-`/`•` bullets, and **bold**. Anything else renders as plain text.
 */
export function AnswerBody({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (!paragraph.length) return;
    const joined = paragraph.join(' ');
    blocks.push(<p key={`p-${blocks.length}`}>{inline(joined, `p-${blocks.length}`)}</p>);
    paragraph = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trim();

    if (!line) {
      flush();
      return;
    }

    const bullet = line.match(/^([+\-•])\s+(.*)$/);
    if (bullet) {
      flush();
      const [, sign, rest] = bullet;
      const tone =
        sign === '+' ? 'var(--positive)' : sign === '-' ? 'var(--negative)' : 'var(--ink-muted)';
      blocks.push(
        <div className="bullet" key={`b-${index}`}>
          <span className="mono" style={{ color: tone, flexShrink: 0 }}>{sign}</span>
          <span>{inline(rest, `b-${index}`)}</span>
        </div>
      );
      return;
    }

    if (line.startsWith('   ') || raw.startsWith('   ')) {
      flush();
      blocks.push(
        <p key={`q-${index}`} className="serif soft" style={{ paddingLeft: 16, fontSize: 14.5 }}>
          {inline(line, `q-${index}`)}
        </p>
      );
      return;
    }

    paragraph.push(line);
  });

  flush();
  return <div className="answer-body">{blocks}</div>;
}
