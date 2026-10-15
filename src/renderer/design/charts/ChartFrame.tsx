import { useId, useState, type ReactNode } from 'react';
import { Button } from '../Button';

export interface LegendItem {
  label: string;
  color: string;
  kind: 'line' | 'dashed' | 'bar' | 'dot';
}

/**
 * Shared chart chrome: a title, an always-present legend for two or more series
 * (identity never relies on colour alone), a text summary for screen readers, and
 * a table view that exposes every value without hovering.
 */
export function ChartFrame({
  title,
  summary,
  legend,
  table,
  children,
  actions,
}: {
  title: string;
  summary: string;
  legend: LegendItem[];
  table: { columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
  actions?: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const summaryId = useId();
  return (
    <figure className="m-0" aria-labelledby={`${summaryId}-title`} aria-describedby={summaryId}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <figcaption id={`${summaryId}-title`} className="text-[13.5px] font-semibold text-ink">
          {title}
        </figcaption>
        <div className="flex items-center gap-4">
          {legend.length > 1 ? (
            <ul className="flex items-center gap-4" aria-label="Legend">
              {legend.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-1.5 text-[12px] text-ink-muted"
                >
                  <LegendKey item={item} />
                  {item.label}
                </li>
              ))}
            </ul>
          ) : null}
          {actions}
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={showTable}
            onClick={() => {
              setShowTable((v) => !v);
            }}
          >
            {showTable ? 'Chart' : 'Table'}
          </Button>
        </div>
      </div>
      <p id={summaryId} className="sr-only">
        {summary}
      </p>
      {showTable ? (
        <div className="max-h-[260px] overflow-auto rounded-lg border border-rule">
          <table className="w-full text-left text-[12.5px]">
            <thead className="sticky top-0 bg-surface">
              <tr>
                {table.columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="border-b border-rule px-3 py-2 font-medium text-ink-muted"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i} className="border-b border-rule last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="tabular px-3 py-1.5 text-ink">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div aria-hidden="true">{children}</div>
      )}
    </figure>
  );
}

function LegendKey({ item }: { item: LegendItem }) {
  if (item.kind === 'dot') {
    return (
      <span
        className="inline-block h-2 w-2 rounded-full opacity-60"
        style={{ background: item.color }}
      />
    );
  }
  if (item.kind === 'bar') {
    return (
      <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: item.color }} />
    );
  }
  return (
    <svg width="16" height="6" aria-hidden="true">
      <line
        x1="1"
        y1="3"
        x2="15"
        y2="3"
        stroke={item.color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={item.kind === 'dashed' ? '3 3' : undefined}
      />
    </svg>
  );
}

/** Tooltip body: values lead (strong), labels follow; rows keyed with a line stroke. */
export function TooltipCard({
  heading,
  rows,
}: {
  heading: string;
  rows: { label: string; value: string; color: string; dashed?: boolean }[];
}) {
  return (
    <div className="rounded-lg border border-rule bg-surface px-3 py-2 text-[12px] shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
      <div className="mb-1 text-ink-muted">{heading}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <svg width="12" height="4" aria-hidden="true">
            <line
              x1="0"
              y1="2"
              x2="12"
              y2="2"
              stroke={r.color}
              strokeWidth="2"
              strokeDasharray={r.dashed ? '3 2' : undefined}
            />
          </svg>
          <span className="tabular font-semibold text-ink">{r.value}</span>
          <span className="text-ink-muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}
