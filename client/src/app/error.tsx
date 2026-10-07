'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="state-page">
      <div className="shell-narrow center">
        <span className="empty-mark"><Icon name="info" size={44} strokeWidth={1.2} /></span>
        <p className="eyebrow" style={{ justifyContent: 'center' }}>Something went wrong</p>
        <h1 style={{ marginTop: 12 }}>A page slipped off the shelf</h1>
        <p className="lead" style={{ marginTop: 16 }}>
          This page failed to load. It is usually temporary; trying again normally fixes it.
        </p>
        <div className="row gap-12 wrap" style={{ marginTop: 28, justifyContent: 'center' }}>
          <button type="button" className="btn btn-primary" onClick={reset}>
            <Icon name="reset" size={17} /> Try again
          </button>
          <Link href="/" className="btn btn-outline">Back to the library</Link>
        </div>
      </div>
    </main>
  );
}
