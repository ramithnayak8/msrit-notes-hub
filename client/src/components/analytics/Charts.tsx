'use client';

import Link from 'next/link';
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

/**
 * Single-series charts for the insights page, drawn in HTML so they reflow on
 * phones and stay keyboard-readable. One hue (the theme accent), values in ink,
 * a tooltip on hover and focus (Escape dismisses it), and a table view of the
 * same numbers.
 */

export type Datum = { key: string; label: string; value: number; detail?: string; href?: string };

type Table = { head: string[]; rows: (string | number)[][] };

export function ChartCard({ title, subtitle, table, children }: { title: string; subtitle?: string; table: Table; children: ReactNode }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const id = useId();
  return (
    <section className="panel panel-pad chart-card" aria-labelledby={id}>
      <header className="chart-head">
        <div>
          <h2 id={id} className="chart-title">{title}</h2>
          {subtitle && <p className="xs muted" style={{ marginTop: 4 }}>{subtitle}</p>}
        </div>
        <div className="chart-toggle" role="group" aria-label={`${title}: view as`}>
          {(['chart', 'table'] as const).map((v) => (
            <button key={v} type="button" className="chip" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === 'chart' ? 'Chart' : 'Table'}
            </button>
          ))}
        </div>
      </header>
      {view === 'chart' ? (
        children
      ) : (
        <div className="table-wrap">
          <table className="table chart-table">
            <thead>
              <tr>{table.head.map((h, i) => <th key={i} className={i ? 'num' : undefined}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'num' : undefined}>{typeof c === 'number' ? c.toLocaleString('en-IN') : c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const fmt = (n: number) => n.toLocaleString('en-IN');
/** "1 question", "44 questions": units are passed in the plural. */
const unitFor = (n: number, unit: string) => (n === 1 ? unit.replace(/s$/, '') : unit);
const describe = (d: Datum, unit: string) => `${d.label}: ${fmt(d.value)} ${unitFor(d.value, unit)}${d.detail ? `, ${d.detail}` : ''}`;

const dismissOnEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
};

/** Vertical columns for an ordered axis (years, units, marks). */
export function ColumnChart({ data, unit }: { data: Datum[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="col-chart" data-dense={data.length > 8 || undefined} style={{ ['--cols' as string]: data.length }} onKeyDown={dismissOnEscape}>
      {data.map((d) => (
        <li key={d.key} className="col-slot" tabIndex={0} style={{ ['--h' as string]: `${(d.value / max) * 100}%` }}>
          <span className="visually-hidden">{describe(d, unit)}</span>
          <span className="col-value nums" aria-hidden>{d.value ? fmt(d.value) : ''}</span>
          <span className="col-bar" aria-hidden />
          <span className="col-label" aria-hidden>{d.label}</span>
          <Tip d={d} unit={unit} />
        </li>
      ))}
    </ul>
  );
}

/** Horizontal bars for a ranked list (topics, exam types). */
export function BarList({ data, unit }: { data: Datum[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ol className="hbar-list" onKeyDown={dismissOnEscape}>
      {data.map((d) => (
        <li key={d.key} className="hbar-row" tabIndex={d.href ? undefined : 0}>
          {d.href ? (
            <Link href={d.href} className="hbar-label">
              {d.label}
              <span className="visually-hidden">, {fmt(d.value)} {unitFor(d.value, unit)}{d.detail ? `, ${d.detail}` : ''}</span>
            </Link>
          ) : (
            <span className="hbar-label">
              {d.label}
              <span className="visually-hidden">, {fmt(d.value)} {unitFor(d.value, unit)}{d.detail ? `, ${d.detail}` : ''}</span>
            </span>
          )}
          <span className="hbar-track" aria-hidden>
            <span className="hbar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
            <span className="hbar-value nums">{fmt(d.value)}</span>
          </span>
          <Tip d={d} unit={unit} />
        </li>
      ))}
    </ol>
  );
}

function Tip({ d, unit }: { d: Datum; unit: string }) {
  return (
    <span className="chart-tip" aria-hidden>
      <span className="chart-tip-value"><strong className="nums">{fmt(d.value)}</strong> {unitFor(d.value, unit)}</span>
      <span className="chart-tip-label">{d.label}</span>
      {d.detail && <span className="chart-tip-detail">{d.detail}</span>}
    </span>
  );
}
