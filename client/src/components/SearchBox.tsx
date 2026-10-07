'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SearchBox({
  initial = '',
  large = false,
  autoFocus = false,
}: {
  initial?: string;
  large?: boolean;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const router = useRouter();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = value.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={submit} className={`searchbar${large ? ' searchbar-lg' : ''}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="searchbar-icon" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask in plain English — e.g. binary tree questions from the last 3 years"
        aria-label="Search question papers"
        autoFocus={autoFocus}
      />
      <button type="submit" className="btn btn-primary btn-sm">
        Search
      </button>
    </form>
  );
}

export function ExampleQueries({ queries }: { queries: string[] }) {
  const router = useRouter();
  return (
    <div className="examples">
      {queries.map((q) => (
        <button
          key={q}
          type="button"
          className="example"
          onClick={() => router.push(`/search?q=${encodeURIComponent(q)}`)}
        >
          {q}
        </button>
      ))}
    </div>
  );
}
