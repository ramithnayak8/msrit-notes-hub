import type { Metadata } from 'next';
import { InsightsView } from '@/components/analytics/InsightsView';
import { apiGet, type Insights } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Exam insights',
  description: 'What MSRIT papers actually ask: most-examined topics, marks by unit, repeated questions and trends by year, for any course and year range.',
};

type Param = string | string[] | undefined;
type Search = { semester?: Param; course?: Param; from?: Param; to?: Param; exam?: Param };

/** The first value of a param, trimmed to a sane length; the API ignores anything it can't use. */
const one = (v: Param, max = 40) => (Array.isArray(v) ? v[0] : v)?.slice(0, max) || undefined;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const p = await searchParams;
  const query = new URLSearchParams(
    Object.entries({
      semester: one(p.semester, 2),
      course: one(p.course),
      yearFrom: one(p.from, 4),
      yearTo: one(p.to, 4),
      examType: one(p.exam, 20),
    }).filter((e): e is [string, string] => !!e[1]),
  );
  const data = await apiGet<Insights>(`/analytics/overview?${query}`);

  return (
    <main>
      <section className="page-head" style={{ paddingBottom: 'var(--space-6)' }}>
        <div className="shell">
          <p className="eyebrow">Exam insights</p>
          <h1>What the papers actually ask</h1>
          <p className="lead">
            Every question in the archive, counted. Pick a semester, course and years to see which topics come up most,
            where the marks are, and which questions keep coming back.
          </p>
        </div>
      </section>
      <InsightsView data={data} />
    </main>
  );
}
