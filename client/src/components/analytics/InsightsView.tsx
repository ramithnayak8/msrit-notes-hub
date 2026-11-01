'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { InsightBucket, Insights } from '@/lib/api';
import { AskPanel } from './AskPanel';
import { BarList, ChartCard, ColumnChart, type Datum } from './Charts';

const BLOOM: Record<string, string> = { L1: 'Remember', L2: 'Understand', L3: 'Apply', L4: 'Analyse', L5: 'Evaluate', L6: 'Create' };
const EXAM: Record<string, string> = { CIE: 'CIE (internals)', SEE: 'SEE (semester end)', Makeup: 'Makeup' };

const fmt = (n: number) => n.toLocaleString('en-IN');
const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;

/** The filters, KPIs, charts and repeats for one slice of the archive. Filters live in the URL. */
export function InsightsView({ data }: { data: Insights }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  // The UI shows the filters the server actually applied, so a junk or stale link never shows a filter that isn't in effect.
  const applied = data.filters;
  const semester = applied.semester ? String(applied.semester) : '';
  const course = applied.course ?? '';
  const from = applied.yearFrom ? String(applied.yearFrom) : '';
  const to = applied.yearTo ? String(applied.yearTo) : '';
  const exam = applied.examType ?? '';

  const go = (qs: string) => startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));

  const set = (change: Partial<Record<'semester' | 'course' | 'from' | 'to' | 'exam', string>>) => {
    const next = { semester, course, from, to, exam, ...change };
    // Keep the year range the right way round.
    if (next.from && next.to && Number(next.from) > Number(next.to)) [next.from, next.to] = [next.to, next.from];
    go(new URLSearchParams(Object.entries(next).filter(([, v]) => v)).toString());
  };

  const inSemester = (c: Insights['options']['courses'][number], s: string) => !s || c.semesters.includes(Number(s));
  const courses = data.options.courses.filter((c) => inSemester(c, semester) || c.code === course);
  const selectedCourse = data.options.courses.find((c) => c.code === course);
  const filtered = !!(semester || course || from || to || exam);
  const { kpis } = data;
  const years = fillYears(data.byYear);
  const scopeLabel =
    [
      selectedCourse ? selectedCourse.title : applied.course,
      semester && `semester ${semester}`,
      exam,
      from && to ? (from === to ? from : `${from}–${to}`) : from ? `${from} on` : to ? `up to ${to}` : '',
    ]
      .filter(Boolean)
      .join(', ') || 'the whole archive';
  const reset = () => go('');

  return (
    <>
      <section className="shell insights-filters" aria-label="Filter the insights">
        <Select label="Semester" value={semester} onChange={(v) => {
          const keep = !!selectedCourse && inSemester(selectedCourse, v);
          set({ semester: v, course: keep ? course : '' });
        }}>
          <option value="">All semesters</option>
          {data.options.semesters.map((s) => <option key={s} value={s}>Semester {s}</option>)}
        </Select>
        <Select label="Course" value={selectedCourse ? course : ''} onChange={(v) => set({ course: v })} wide>
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.code} value={c.code}>{c.title} ({c.code})</option>)}
        </Select>
        <Select label="From" value={from} onChange={(v) => set({ from: v })}>
          <option value="">Any year</option>
          {data.options.years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select label="To" value={to} onChange={(v) => set({ to: v })}>
          <option value="">Any year</option>
          {data.options.years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select label="Exam" value={exam} onChange={(v) => set({ exam: v })}>
          <option value="">All exams</option>
          {data.options.examTypes.map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
        {filtered && (
          <button type="button" className="btn btn-quiet btn-sm insights-reset" onClick={reset}>
            <Icon name="reset" size={15} /> Reset
          </button>
        )}
      </section>

      <div className="shell insights-body" data-pending={pending || undefined} aria-busy={pending}>
        {kpis.questions === 0 ? (
          <div className="empty panel">
            <p className="empty-title">Nothing matches these filters</p>
            <p className="small" style={{ marginTop: 8 }}>No indexed questions for this slice yet. Try a wider year range or another course.</p>
            <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 16 }} onClick={reset}>
              <Icon name="reset" size={15} /> Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="panel panel-pad">
              <div className="stats">
                <Kpi value={kpis.papers} label="Papers" />
                <Kpi value={kpis.questions} label="Questions" />
                <Kpi value={kpis.topics} label="Topics examined" />
                <div className="stat">
                  <div className="stat-value nums">{kpis.yearRange ? (kpis.yearRange.min === kpis.yearRange.max ? kpis.yearRange.min : `${kpis.yearRange.min}–${String(kpis.yearRange.max).slice(2)}`) : '–'}</div>
                  <div className="stat-label">Years covered</div>
                </div>
              </div>
            </div>

            <Takeaways data={data} />

            <AskPanel
              key={JSON.stringify(applied)}
              filters={{ semester: applied.semester, course: applied.course, yearFrom: applied.yearFrom, yearTo: applied.yearTo, examType: applied.examType }}
              scope={scopeLabel}
            />

            {selectedCourse && (
              <div className="row gap-10 wrap">
                <Link href={`/assistant?q=${encodeURIComponent(`what should I revise for ${selectedCourse.code}`)}`} className="btn btn-outline btn-sm">
                  <Icon name="message" size={16} /> What to revise for {selectedCourse.title}
                </Link>
                <Link href={`/courses/${encodeURIComponent(selectedCourse.code)}`} className="btn btn-quiet btn-sm">
                  <Icon name="bookOpen" size={16} /> Every question in this course
                </Link>
              </div>
            )}

            <div className="insights-grid">
              <ChartCard
                title="Most-examined topics"
                subtitle="How many papers asked about each topic"
                table={{ head: ['Topic', 'Papers', 'Questions', 'Marks'], rows: data.topics.map((t) => [t.label, t.papers, t.questions, t.totalMarks]) }}
              >
                <BarList
                  unit="papers"
                  data={data.topics.map((t) => ({
                    key: t.topic,
                    label: t.label,
                    value: t.papers,
                    detail: `${plural(t.questions, 'question')}, ${fmt(t.totalMarks)} marks · ${t.years.join(', ')}`,
                    href: `/search?q=${encodeURIComponent([selectedCourse?.code, t.label].filter(Boolean).join(' '))}`,
                  }))}
                />
              </ChartCard>

              <ChartCard title="Questions by year" subtitle="Questions indexed from each year's papers" table={bucketTable('Year', years, String)}>
                <ColumnChart unit="questions" data={columns(years, String, (b) => (b.papers ? `${plural(b.papers, 'paper')}, ${fmt(b.marks)} marks` : 'no papers indexed'))} />
              </ChartCard>

              <ChartCard title="Marks by unit" subtitle="Total marks set from each syllabus unit" table={bucketTable('Unit', data.byUnit, unitLabel)}>
                <ColumnChart unit="marks" data={columns(data.byUnit, unitLabel, (b) => plural(b.questions, 'question'), 'marks')} />
              </ChartCard>

              <ChartCard title="By exam" subtitle="Questions from internals, semester-end and makeup papers" table={bucketTable('Exam', data.byExamType, examLabel)}>
                <BarList
                  unit="questions"
                  data={data.byExamType.map((b) => ({ key: String(b.key), label: examLabel(b.key), value: b.questions, detail: `${plural(b.papers, 'paper')}, ${fmt(b.marks)} marks` }))}
                />
              </ChartCard>

              <ChartCard title="Question size" subtitle="How many questions carry each mark value" table={bucketTable('Worth', data.byMarks, marksLabel)}>
                <ColumnChart unit="questions" data={columns(data.byMarks, marksLabel, (b) => `${fmt(b.marks)} marks in total`)} />
              </ChartCard>

              {data.byBloom.length > 0 && (
                <ChartCard title="Thinking level" subtitle="Bloom's level printed against each question, where the paper gives one" table={bucketTable('Level', data.byBloom, bloomLabel)}>
                  <ColumnChart unit="questions" data={columns(data.byBloom, String, (b) => `${bloomLabel(b.key)}, ${fmt(b.marks)} marks`)} />
                </ChartCard>
              )}
            </div>

            <section className="panel panel-pad" aria-labelledby="repeats-title">
              <h2 id="repeats-title" className="chart-title">Asked again and again</h2>
              <p className="xs muted" style={{ marginTop: 4 }}>The same question, or one nearly identical, set in more than one paper</p>
              {data.recurring.length ? (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="table repeats-table">
                    <thead>
                      <tr><th>Question</th><th>Course</th><th className="num">Papers</th><th className="num">Years</th></tr>
                    </thead>
                    <tbody>
                      {data.recurring.map((r, i) => (
                        <tr key={i}>
                          <td><Link href={`/search?q=${encodeURIComponent(r.text.slice(0, 120))}`} className="repeat-text">{r.text}</Link></td>
                          <td className="small muted">{r.courseTitle ?? r.courseCode ?? '–'}</td>
                          <td className="num">{r.papers}</td>
                          <td className="num repeat-years">{r.years.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small muted" style={{ marginTop: 12 }}>No repeated questions in this slice. Widen the year range to compare more papers.</p>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

function Select({ label, value, onChange, wide, children }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`insights-field${wide ? ' wide' : ''}`}>
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </label>
  );
}

function Kpi({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value nums">{fmt(value)}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

type Key = string | number;
const unitLabel = (k: Key) => `Unit ${k}`;
const marksLabel = (k: Key) => `${k}m`;
const examLabel = (k: Key) => EXAM[String(k)] ?? String(k);
const bloomLabel = (k: Key) => `${k} ${BLOOM[String(k)] ?? ''}`.trim();

function columns(b: InsightBucket[], label: (k: Key) => string, detail: (b: InsightBucket) => string, metric: 'questions' | 'marks' = 'questions'): Datum[] {
  return b.map((x) => ({ key: String(x.key), label: label(x.key), value: x[metric], detail: detail(x) }));
}

function bucketTable(head: string, b: InsightBucket[], label: (k: Key) => string) {
  return { head: [head, 'Questions', 'Papers', 'Marks'], rows: b.map((x) => [label(x.key), x.questions, x.papers, x.marks]) };
}

/** Every year from the first to the last, so a gap in the archive shows as a gap, not as continuity. */
function fillYears(b: InsightBucket[]): InsightBucket[] {
  if (b.length < 2) return b;
  const by = new Map(b.map((x) => [Number(x.key), x]));
  const lo = Number(b[0]!.key), hi = Number(b[b.length - 1]!.key);
  return Array.from({ length: hi - lo + 1 }, (_, i) => by.get(lo + i) ?? { key: lo + i, questions: 0, papers: 0, marks: 0 });
}

/** Three plain-language findings from the numbers on the page. */
function Takeaways({ data }: { data: Insights }) {
  const out: string[] = [];
  const top = data.topics[0];
  if (top) out.push(`${top.label} is the most-examined topic: it came up in ${plural(top.papers, 'paper')} out of ${fmt(data.kpis.papers)}.`);
  const units = data.byUnit.filter((u) => u.marks > 0);
  const totalUnitMarks = units.reduce((s, u) => s + u.marks, 0);
  if (units.length > 1 && totalUnitMarks) {
    const best = units.reduce((a, b) => (b.marks > a.marks ? b : a));
    out.push(`Unit ${best.key} carries the most marks, ${Math.round((best.marks / totalUnitMarks) * 100)}% of all marks tagged to a unit.`);
  }
  const sizes = data.byMarks;
  if (sizes.length) {
    const common = sizes.reduce((a, b) => (b.questions > a.questions ? b : a));
    out.push(`The most common question is worth ${common.key} marks (${plural(common.questions, 'question')}).`);
  }
  const n = data.recurringCount;
  if (n) out.push(`${plural(n, 'question')} ${n === 1 ? 'has' : 'have'} been set in more than one paper${n > data.recurring.length ? `; the ${data.recurring.length} most repeated are listed at the bottom` : '. They are listed at the bottom'}.`);
  if (!out.length) return null;
  return (
    <section className="panel panel-pad" aria-labelledby="takeaways-title">
      <h2 id="takeaways-title" className="chart-title">Takeaways</h2>
      <ul className="takeaways">{out.map((t) => <li key={t}>{t}</li>)}</ul>
    </section>
  );
}
