/** Route-level loading state: the page header and a grid of placeholder cards. */
export function PageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <main aria-busy="true" aria-label="Loading">
      <section className="page-head">
        <div className="shell stack gap-16">
          <span className="skeleton" style={{ width: 140, height: 12 }} />
          <span className="skeleton" style={{ width: 'min(520px, 80%)', height: 48 }} />
          <span className="skeleton" style={{ width: 'min(380px, 60%)', height: 16 }} />
        </div>
      </section>
      <section style={{ paddingBottom: 'var(--space-16)' }}>
        <div className="shell book-grid">
          {Array.from({ length: cards }, (_, i) => (
            <span key={i} className="skeleton" style={{ height: 250, borderRadius: '4px 12px 12px 4px' }} />
          ))}
        </div>
      </section>
    </main>
  );
}
