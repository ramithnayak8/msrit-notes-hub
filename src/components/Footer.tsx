import Link from 'next/link';

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer-cols">
          <div>
            <div className="row gap-10">
              <span className="brand-mark">C</span>
              <span className="brand-name serif">ConceptQuery</span>
            </div>
            <p className="small muted" style={{ marginTop: 14, maxWidth: 320 }}>
              A topic-aware semantic retrieval platform for previous year question papers and
              academic notes — indexed by concept, not by subject code.
            </p>
          </div>

          <div>
            <div className="label">Archive</div>
            <div style={{ marginTop: 10 }}>
              <Link href="/search" className="footer-link">Search questions</Link>
              <Link href="/departments" className="footer-link">Branches</Link>
              <Link href="/syllabus" className="footer-link">Syllabus changes</Link>
            </div>
          </div>

          <div>
            <div className="label">Tools</div>
            <div style={{ marginTop: 10 }}>
              <Link href="/assistant" className="footer-link">Study assistant</Link>
              <Link href="/api/stats" className="footer-link">Public API</Link>
            </div>
          </div>

          <div>
            <div className="label">Project</div>
            <div style={{ marginTop: 10 }}>
              <Link href="/about" className="footer-link">About</Link>
              <Link href="/about#contribute" className="footer-link">Contribute papers</Link>
            </div>
          </div>
        </div>

        <div
          className="row between wrap gap-16"
          style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--rule)' }}
        >
          <p className="xs muted">
            An independent student project. Not officially affiliated with or endorsed by
            Ramaiah Institute of Technology.
          </p>
          <p className="xs muted">© {new Date().getFullYear()} ConceptQuery</p>
        </div>
      </div>
    </footer>
  );
}
