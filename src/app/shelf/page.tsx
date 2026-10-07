'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useStudyRoom } from '@/components/study/StudyRoomProvider';
import { dayKey, summarise, useActivity } from '@/lib/client/activity';
import { clearRecent, toggleCourse, toggleQuestion, useShelf, type SavedCourse } from '@/lib/client/shelf';

const WEEKS = 12;

function timeAgo(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function CourseList({ courses, onRemove }: { courses: SavedCourse[]; onRemove?: (c: SavedCourse) => void }) {
  return (
    <ul className="shelf-courses">
      {courses.map((c) => (
        <li key={c.code} className="shelf-course">
          <Link href={`/courses/${c.code}`} className="shelf-course-link">
            <span className="tag tag-code tag-accent">{c.code}</span>
            <span className="shelf-course-title">{c.title}</span>
            <span className="xs muted">{c.dept} · Sem {c.semester} · {timeAgo(c.at)}</span>
          </Link>
          {onRemove && (
            <button type="button" className="icon-btn" onClick={() => onRemove(c)} aria-label={`Remove ${c.title} from your shelf`}>
              <Icon name="close" size={16} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function ShelfPage() {
  const shelf = useShelf();
  const { days } = useActivity();
  const { open } = useStudyRoom();
  // Storage only exists in the browser; render the empty frame until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const streak = summarise(days);
  // Calendar grid: columns are weeks (oldest first), rows are days of the week.
  const today = new Date();
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const offset = WEEKS * 7 - 1 - i - (6 - today.getDay());
    const key = dayKey(offset);
    const day = days[key];
    const level = offset < 0 ? -1 : !day ? 0 : day.focusMin >= 50 ? 3 : day.focusMin > 0 || day.visits >= 4 ? 2 : 1;
    return { key, level, day };
  });

  return (
    <main>
      <section className="page-head">
        <div className="shell">
          <p className="eyebrow">Your desk</p>
          <h1 style={{ marginTop: 12 }}>My shelf</h1>
          <p className="lead" style={{ marginTop: 14, maxWidth: 620 }}>
            Questions you saved, courses you keep coming back to and how steady your study has been.
            Everything stays in this browser; there is no account.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--space-16)' }}>
        <div className="shell shelf-layout">
          <div className="stack gap-32">
            <section aria-labelledby="saved-q">
              <div className="row between wrap gap-12">
                <h2 id="saved-q" className="shelf-h">Saved questions</h2>
                <span className="xs muted nums">{mounted ? shelf.questions.length : 0}</span>
              </div>
              {mounted && shelf.questions.length > 0 ? (
                <div className="panel divide" style={{ marginTop: 14 }}>
                  {shelf.questions.map((q) => (
                    <article key={q.id} className="question-card">
                      <div className="row between wrap gap-10">
                        <div className="row gap-10 wrap">
                          <span className="tag tag-code tag-accent">{q.courseCode}</span>
                          <span className="xs muted">{q.paper} · Q{q.number} · {q.marks} marks</span>
                        </div>
                        <button
                          type="button"
                          className="bookmark-btn is-saved"
                          aria-pressed="true"
                          aria-label={`Remove Q${q.number} from your shelf`}
                          onClick={() => toggleQuestion(q)}
                        >
                          <Icon name="bookmark" size={16} filled />
                        </button>
                      </div>
                      <p className="reading" style={{ marginTop: 10 }}>{q.text}</p>
                      <Link href={`/courses/${q.courseCode}#q-${q.id}`} className="small" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
                        Open in {q.courseTitle} <Icon name="arrowRight" size={14} />
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty" style={{ marginTop: 14 }}>
                  <span className="empty-mark"><Icon name="bookmark" size={32} strokeWidth={1.3} /></span>
                  <p className="empty-title">No saved questions yet</p>
                  <p className="small" style={{ marginTop: 8 }}>
                    Tap the bookmark on any question in <Link href="/search">search</Link> or on a course page.
                  </p>
                </div>
              )}
            </section>

            <section aria-labelledby="saved-c">
              <h2 id="saved-c" className="shelf-h">Saved courses</h2>
              {mounted && shelf.courses.length > 0 ? (
                <CourseList courses={shelf.courses} onRemove={(c) => toggleCourse(c)} />
              ) : (
                <p className="small muted" style={{ marginTop: 10 }}>
                  Use &ldquo;Save course&rdquo; on a course page to keep it here. <Link href="/departments">Browse branches</Link>.
                </p>
              )}
            </section>
          </div>

          <aside className="stack gap-24">
            <div className="panel panel-pad">
              <div className="label">Study streak</div>
              <div className="streak-figures">
                <div>
                  <span className="streak-value nums"><Icon name="flame" size={22} /> {mounted ? streak.current : 0}</span>
                  <span className="xs muted">day{streak.current === 1 ? '' : 's'} in a row</span>
                </div>
                <div>
                  <span className="streak-value nums">{mounted ? streak.longest : 0}</span>
                  <span className="xs muted">longest run</span>
                </div>
                <div>
                  <span className="streak-value nums">{mounted ? streak.focusWeek : 0}</span>
                  <span className="xs muted">focus min this week</span>
                </div>
              </div>
              <div className="streak-grid" role="img" aria-label={`Activity over the last ${WEEKS} weeks`}>
                {cells.map((c) => (
                  <span
                    key={c.key}
                    className="streak-cell"
                    data-level={mounted ? c.level : 0}
                    title={c.level < 0 ? undefined : `${c.key}: ${c.day ? `${c.day.visits} course visits, ${c.day.focusMin} focus min` : 'no study'}`}
                  />
                ))}
              </div>
              <p className="xs muted" style={{ marginTop: 12 }}>
                {mounted && !streak.activeToday && streak.current > 0
                  ? 'Open a course or finish a focus session today to keep the streak.'
                  : 'A day counts when you open a course or finish a focus session.'}
              </p>
              <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 16, width: '100%' }} onClick={() => open('focus')}>
                <Icon name="timer" size={16} /> Start a focus session
              </button>
            </div>

            <div className="panel panel-pad">
              <div className="row between">
                <div className="label">Recently opened</div>
                {mounted && shelf.recent.length > 0 && (
                  <button type="button" className="btn btn-quiet btn-sm" onClick={clearRecent}>Clear</button>
                )}
              </div>
              {mounted && shelf.recent.length > 0 ? (
                <CourseList courses={shelf.recent} />
              ) : (
                <p className="small muted" style={{ marginTop: 10 }}>Courses you open will show up here.</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
