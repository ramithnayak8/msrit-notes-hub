import type { Metadata } from 'next';
import Link from 'next/link';
import { getStats, getYearRange } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'About',
  description: 'How ConceptQuery indexes, searches and answers questions about MSRIT previous year papers.',
};

const ENDPOINTS = [
  { method: 'GET', path: '/api/search?q=…&limit=20', description: 'Ranked question search with parsed filters' },
  { method: 'GET', path: '/api/departments', description: 'All branches with coverage counts' },
  { method: 'GET', path: '/api/departments?code=CSE', description: 'Courses within one branch' },
  { method: 'GET', path: '/api/syllabus', description: 'Courses with two or more tracked schemes' },
  { method: 'GET', path: '/api/syllabus?course=CS501', description: 'Structural diff between the two latest schemes' },
  { method: 'GET', path: '/api/stats', description: 'Archive totals and the indexed year range' },
  { method: 'POST', path: '/api/chat', description: 'Retrieval-augmented answer; body { question }' },
];

export default function AboutPage() {
  const stats = getStats();
  const years = getYearRange();

  return (
    <main>
      <section className="page-head">
        <div className="shell-narrow">
          <p className="eyebrow">About</p>
          <h1>A topic-aware retrieval platform for previous year question papers</h1>
          <p className="lead" style={{ marginTop: 16 }}>
            ConceptQuery indexes examination content at the granularity of the individual question and
            organises it by concept instead of by subject, so a topic can be retrieved irrespective of
            which course it was historically taught under, with citation back to the source paper, year
            and question number.
          </p>
        </div>
      </section>

      <section className="section-sm">
        <div className="shell-narrow stack gap-40">
          <div>
            <div className="row between wrap gap-12" style={{ alignItems: 'baseline' }}>
              <h2>This build: a frontend preview</h2>
              <span className="tag tag-amber">Preview, not final architecture</span>
            </div>
            <p className="soft" style={{ marginTop: 12 }}>
              What is running today is the interface and interaction model for ConceptQuery, built
              ahead of the full ingestion and retrieval backend described in the project synopsis, so
              the experience can be reviewed before that work starts. Three things are stand-ins, on
              purpose:
            </p>
            <div className="panel" style={{ marginTop: 18 }}>
              <div className="divide">
                <div style={{ padding: '18px 22px' }}>
                  <div className="row between wrap gap-10">
                    <h4>Retrieval engine</h4>
                    <span className="xs muted">Target: Sentence-BERT embeddings + Atlas Vector Search</span>
                  </div>
                  <p className="small soft" style={{ marginTop: 6 }}>
                    Today this runs on BM25 lexical ranking with corpus-derived query expansion — no
                    embeddings, no vector index. It produces the same experience (search by concept, not
                    keyword) without the model or database work, which lets the UI be reviewed now.
                  </p>
                </div>
                <div style={{ padding: '18px 22px' }}>
                  <div className="row between wrap gap-10">
                    <h4>Data</h4>
                    <span className="xs muted">Target: OCR + LLM-assisted ingestion from real papers</span>
                  </div>
                  <p className="small soft" style={{ marginTop: 6 }}>
                    The {stats.questions} questions in this build are realistic development samples
                    written to exercise every screen, not digitised MSRIT papers. No parsing, OCR or
                    tagging pipeline runs yet.
                  </p>
                </div>
                <div style={{ padding: '18px 22px' }}>
                  <div className="row between wrap gap-10">
                    <h4>Accounts</h4>
                    <span className="xs muted">Target: JWT auth, user / uploader / moderator roles</span>
                  </div>
                  <p className="small soft" style={{ marginTop: 6 }}>
                    Every page here is open with no login, so the search, branch and syllabus views can
                    be reviewed directly.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2>How the preview&rsquo;s search actually works</h2>
            <div className="panel" style={{ marginTop: 18 }}>
              <div className="divide">
                <div style={{ padding: '20px 24px' }}>
                  <div className="feature-num">Step 01</div>
                  <h3 style={{ marginTop: 8 }}>Query parsing</h3>
                  <p className="small soft" style={{ marginTop: 8 }}>
                    The raw sentence is scanned for structure before anything is matched: relative
                    year ranges (&ldquo;last 3 years&rdquo;), absolute ranges, course codes,
                    branch names and mark thresholds are lifted out and become database filters.
                    What is left over is the topic.
                  </p>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  <div className="feature-num">Step 02</div>
                  <h3 style={{ marginTop: 8 }}>Query expansion</h3>
                  <p className="small soft" style={{ marginTop: 8 }}>
                    Topic terms are expanded two ways: a curated concept map for the obvious
                    equivalences, and term co-occurrence statistics mined from the corpus&rsquo; own
                    topic tags, scored by pointwise mutual information. Expanded terms carry lower
                    weight than the words the student actually typed. This is the stand-in for
                    embedding-based semantic similarity.
                  </p>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  <div className="feature-num">Step 03</div>
                  <h3 style={{ marginTop: 8 }}>Ranking</h3>
                  <p className="small soft" style={{ marginTop: 8 }}>
                    Documents are scored with BM25 over weighted fields — topic tags and course codes
                    count for more than body text — then nudged by recency so current papers surface
                    first among equally relevant results.
                  </p>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  <div className="feature-num">Step 04</div>
                  <h3 style={{ marginTop: 8 }}>Grounded answering</h3>
                  <p className="small soft" style={{ marginTop: 8 }}>
                    The study assistant runs the same retrieval, then composes an answer from the
                    retrieved rows and cites them. With no model key configured it answers directly
                    from the data; with one, the retrieved context is passed to Claude under
                    instructions to use nothing else.
                  </p>
                </div>
              </div>
            </div>
            <p className="notice" style={{ marginTop: 20 }}>
              The synopsis specifies MongoDB with an Atlas Vector Search index and locally-run
              Sentence-BERT embeddings, with language model calls confined to one-time ingestion so
              query cost stays flat. None of that runs yet — this preview substitutes a local lexical
              index behind the same search interface, so the retrieval layer can be swapped in later
              without changing a page.
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
                  <div className="stat-value">{stats.papers}</div>
                  <div className="stat-label">Papers</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{stats.courses}</div>
                  <div className="stat-label">Courses</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{years.min}–{years.max}</div>
                  <div className="stat-label">Years covered</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2>API</h2>
            <p className="soft" style={{ marginTop: 12 }}>
              Every page is built on the same public endpoints, so the archive can be queried
              directly.
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
              The <Link href="/papers">past papers library</Link> lists papers that students already share on{' '}
              <a href="https://ritnotebook.netlify.app" target="_blank" rel="noopener noreferrer">RIT Notebook</a> and{' '}
              <a href="https://riserit.vercel.app/resources" target="_blank" rel="noopener noreferrer">RIT ISE</a>. Upload a paper
              to either and it appears here when the catalogue is next refreshed (<code className="mono">npm run crawl</code>).
              Every entry links to the original file; nothing is copied. If you shared a file and want it unlisted, open an
              issue on the repository and it will be excluded.
            </p>
            <p className="soft" style={{ marginTop: 12 }}>
              Once ingestion is built, three things will help most, in order:
            </p>
            <div className="panel" style={{ marginTop: 18 }}>
              <div className="divide">
                <div style={{ padding: '18px 22px' }}>
                  <h4>Question papers with readable text</h4>
                  <p className="small soft" style={{ marginTop: 6 }}>
                    A clean scan or an original PDF is far more useful than a photo, since the question
                    text has to be extracted — directly, or through OCR — to be indexed.
                  </p>
                </div>
                <div style={{ padding: '18px 22px' }}>
                  <h4>Syllabus schemes, per academic year</h4>
                  <p className="small soft" style={{ marginTop: 6 }}>
                    Two consecutive years of a scheme is all the change tracker needs to start
                    working for that course.
                  </p>
                </div>
                <div style={{ padding: '18px 22px' }}>
                  <h4>Notes worth keeping</h4>
                  <p className="small soft" style={{ marginTop: 6 }}>
                    Unit-wise notes and solved problem sets, attributed to whoever wrote them.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="center" style={{ paddingTop: 8 }}>
            <Link href="/search" className="btn btn-primary">Search the archive</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
