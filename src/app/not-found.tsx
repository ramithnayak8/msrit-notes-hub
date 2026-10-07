import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

export default function NotFound() {
  return (
    <main className="state-page">
      <div className="shell-narrow center">
        <span className="empty-mark"><Icon name="bookOpen" size={48} strokeWidth={1.1} /></span>
        <p className="eyebrow" style={{ justifyContent: 'center' }}>404</p>
        <h1 style={{ marginTop: 12 }}>This page isn&rsquo;t on the shelf</h1>
        <p className="lead" style={{ marginTop: 16 }}>
          The course, branch or page you were looking for doesn&rsquo;t exist, or it has moved.
        </p>
        <div className="row gap-12 wrap" style={{ marginTop: 28, justifyContent: 'center' }}>
          <Link href="/search" className="btn btn-primary"><Icon name="search" size={17} /> Search the archive</Link>
          <Link href="/departments" className="btn btn-outline">Browse branches</Link>
        </div>
      </div>
    </main>
  );
}
