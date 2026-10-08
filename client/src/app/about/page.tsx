import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGet, type Stats } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'About',
  description: 'How ConceptQuery ingests, indexes and searches MSRIT previous year papers.',
};

const ENDPOINTS = [
  { method: 'GET', path: '/api/search?q=…&mode=hybrid|keyword|vector', description: 'Question search with parsed filters' },
  { method: 'POST', path: '/api/documents', description: 'Upload a paper (uploader); processed in the background' },
  { method: 'GET', path: '/api/documents/:id', description: 'A paper and its processing status' },
  { method: 'GET', path: '/api/course/:code', description: 'A course: its papers, questions and most examined topics' },
  { method: 'GET', path: '/api/courses?semester=5', description: 'Current scheme, linked to past papers by subject' },
  { method: 'GET', path: '/api/analytics/topics', description: 'Topics ranked by how many papers examined them' },
  { method: 'GET', path: '/api/analytics/recurring', description: 'Questions asked again across papers' },
  { method: 'POST', path: '/api/assistant', description: 'Retrieval-only answer; body { question }' },
  { method: 'POST', path: '/api/auth/login', description: 'JWT access token + httpOnly refresh cookie' },
];

const INGEST = [
  ['Extract', 'Text comes from the PDF text layer, rebuilt into lines from word positions so table columns (marks, CO, Bloom level) stay in reading order. Scanned pages and phone photos are rendered, corrected for uneven lighting, and read with Tesseract OCR.'],
  ['Segment', 'A rule-based parser built on real MSRIT papers splits the text into questions (Q1, a), i)), reads marks, CO and unit, and scores its own confidence: numbering gaps, parts whose marks don’t add up, garbled text. Only low-confidence parts, or papers it can’t follow at all, go to a language model.'],
  ['Tag', 'Each question is matched to its closest topics in a controlled vocabulary by embedding similarity, and one batched language-model call per paper picks from those candidates or proposes new topics, which wait for a moderator.'],
  ['Embed', 'Questions are embedded with bge-small-en-v1.5, a Sentence-BERT-style model run on the server itself: no API, no per-question cost.'],
  ['Index', 'Questions are written to MongoDB with Atlas Search (BM25) and Atlas Vector Search indexes. Near-identical questions across papers are grouped, which is how “asked in 4 papers” is known.'],
] as const;

export default async function AboutPage() {
  const stats = await apiGet<Stats>('/analytics/stats');
  const years = stats.yearRange;
  const topics = Object.values(stats.topics).reduce((a, b) => a + b, 0);

  return (
    <main>
      <section className="page-head">
        <div className="shell-narrow">
          <p className="eyebrow">About</p>
          <h1>A topic-aware retrieval platform for previous year question papers</h1>
          <p className="lead" style={{ marginTop: 16 }}>
            ConceptQuery indexes examination content at the granularity of the individual question and organises it by
            concept instead of by subject, so a topic can be found whichever course it was taught under, with a citation back
            to the source paper, year and question number.
          </p>
        </div>
      </section>

      <section className="section-sm">
        <div className="shell-narrow stack gap-40">
          <div>
            <h2>Ingestion: once per uploaded paper</h2>
            <div className="panel" style={{ marginTop: 18 }}>
              <div className="divide">
                {INGEST.map(([title, body], i) => (
                  <div key={title} style={{ padding: '20px 24px' }}>
                    <div className="feature-num">Step 0{i + 1}</div>
                    <h3 style={{ marginTop: 8 }}>{title}</h3>
                    <p className="small soft" style={{ marginTop: 8 }}>{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h2>Search: every query, no language model</h2>
            <p className="soft" style={{ marginTop: 12 }}>
              The query is parsed by rules first: &ldquo;last 3 years&rdquo;, &ldquo;10 marks&rdquo;, &ldquo;SEE&rdquo; and course names or codes
              become exact filters, since embeddings are poor at those. The remaining topic runs through two searches with
              the same filters, keyword (BM25) and meaning (vector nearest neighbours), and their rankings are merged by
              reciprocal rank fusion. Because language models only run at ingestion, an extra search costs nothing.
            </p>
            <p className="notice" style={{ marginTop: 18 }}>
              On 20 hand-labelled queries over 39 real papers, Recall@10 was 0.748 keyword-only, 0.799 meaning-only and
              0.803 hybrid. Run it yourself with <code className="mono">npm run eval -w server</code>.
            </p>
          </div>

          <div>
            <h2>Current contents</h2>
            <div className="panel panel-pad" style={{ marginTop: 18 }}>
              <div className="stats">
                <div className="stat">
                  <div className="stat-value">{stats.questions}</div>
                  <div className="stat-label">Questions</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{stats.documents}</div>
                  <div className="stat-label">Papers</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{topics}</div>
                  <div className="stat-label">Topics</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{years ? `${years.min}–${years.max}` : '—'}</div>
                  <div className="stat-label">Years covered</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2>Accounts and moderation</h2>
            <p className="soft" style={{ marginTop: 12 }}>
              Searching is open. Uploading needs an @msrit.edu account, verified by email, with the uploader role. Sessions
              use a 15-minute access token kept in memory and a refresh token in an httpOnly cookie that rotates on every
              use; replaying an old one signs out every session in that chain. Moderators review what the pipeline wasn&rsquo;t
              sure about: low-confidence questions, poor OCR pages, proposed topics and paper details.
            </p>
          </div>

          <div>
            <h2>API</h2>
            <p className="soft" style={{ marginTop: 12 }}>
              The site is built on the same REST API (Express + MongoDB), so the archive can be queried directly.
            </p>
            <div className="panel panel-pad" style={{ marginTop: 18 }}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>Method</th>
                      <th>Endpoint</th>
                      <th>Returns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENDPOINTS.map((e) => (
                      <tr key={e.path}>
                        <td>
                          <span className={`tag ${e.method === 'POST' ? 'tag-accent' : ''}`}>{e.method}</span>
                        </td>
                        <td className="mono" style={{ fontSize: 12.5 }}>{e.path}</td>
                        <td className="small soft">{e.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div id="contribute">
            <h2>Contributing papers</h2>
            <p className="soft" style={{ marginTop: 12 }}>
              Signed-in uploaders can add papers on the <Link href="/upload">upload page</Link>; they are searchable within a
              minute. The <Link href="/papers">past papers library</Link> separately lists papers students already share on{' '}
              <a href="https://ritnotebook.netlify.app" target="_blank" rel="noopener noreferrer">RIT Notebook</a> and{' '}
              <a href="https://riserit.vercel.app/resources" target="_blank" rel="noopener noreferrer">RIT ISE</a>, linking to
              the original files.
            </p>
          </div>

          <div className="center" style={{ paddingTop: 8 }}>
            <Link href="/search" className="btn btn-primary">Search the archive</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
