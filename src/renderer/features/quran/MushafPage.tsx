import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { pageRangeLabel, TOTAL_PAGES } from '@shared/domain/quran/mushaf';
import {
  strength,
  type PageRecord,
  type PageState,
  type Rating,
} from '@shared/domain/quran/scheduler';
import { diffDays, formatDate, relativeDays } from '@shared/domain/time/localDate';
import { api } from '../../lib/api';
import { cx } from '../../lib/cx';
import { Card, Pill } from '../../design/Card';
import { Button } from '../../design/Button';
import { TextArea } from '../../design/Field';
import { Ring } from '../../design/Ring';
import { toast } from '../../stores/toasts';
import { useQuran } from './useQuran';
import { ratePages, RATING_LABEL, setPagesState } from './actions';

const STATE_TEXT: Record<PageState, string> = {
  not_started: 'Not started',
  new: 'Recently learned',
  memorized: 'Memorised',
  revision: 'Needs revision',
};

const COLUMNS = 10;

/**
 * The 604-page mushaf, grouped by juz. Click (or Space/Enter) selects a page;
 * Shift extends a range; arrow keys move between pages. The inspector on the right
 * acts on the selection.
 */
export function MushafPage() {
  const quran = useQuran();
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<number[]>([]);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [focusPage, setFocusPage] = useState(1);
  const cellRefs = useRef(new Map<number, HTMLButtonElement>());
  const byPage = useMemo(() => new Map(quran.records.map((r) => [r.page, r])), [quran.records]);

  // Deep link from the juz overview: /quran/mushaf?juz=17
  const juzParam = Number(params.get('juz'));
  useEffect(() => {
    const range = quran.layout.juz[juzParam - 1];
    if (!range) return;
    document.getElementById(`juz-${juzParam}`)?.scrollIntoView({ block: 'start' });
  }, [juzParam, quran.layout]);

  const selectPage = (page: number, extend: boolean) => {
    if (extend && anchor !== null) {
      const [a, b] = anchor < page ? [anchor, page] : [page, anchor];
      setSelected(Array.from({ length: b - a + 1 }, (_, i) => a + i));
    } else {
      setSelected((current) => (current.length === 1 && current[0] === page ? [] : [page]));
      setAnchor(page);
    }
  };

  const moveFocus = (page: number) => {
    const target = Math.min(TOTAL_PAGES, Math.max(1, page));
    setFocusPage(target);
    cellRefs.current.get(target)?.focus();
    return target;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, page: number) => {
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUMNS,
      ArrowUp: -COLUMNS,
    };
    const delta = moves[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      const target = moveFocus(page + delta);
      if (e.shiftKey) selectPage(target, true);
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const range = quran.layout.juz[(quran.layout.juzOfPage[page] ?? 1) - 1];
      if (range) moveFocus(e.key === 'Home' ? range.first : range.last);
      return;
    }
    if (e.key === 'Escape') setSelected([]);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <Legend />
        {/* One grid per juz (each a single row of pages); arrow keys move across juz. */}
        <div className="flex flex-col gap-5">
          {quran.juz.map((summary) => {
            const range = quran.layout.juz[summary.juz - 1];
            if (!range) return null;
            const pages = Array.from({ length: range.size }, (_, i) => range.first + i);
            return (
              <section
                key={summary.juz}
                id={`juz-${summary.juz}`}
                aria-label={`Juz ${summary.juz}`}
                className="scroll-mt-10"
              >
                <div className="mb-2 flex items-center gap-3">
                  <Ring value={summary.learned / summary.size} size={22} stroke={3} label="" />
                  <h3 className="text-[13.5px] font-semibold text-ink">Juz {summary.juz}</h3>
                  <span className="tabular text-[12px] text-ink-faint">
                    {summary.learned}/{summary.size}
                    {summary.strength !== null
                      ? ` · ${Math.round(summary.strength * 100)}% retention`
                      : ''}
                  </span>
                  <button
                    type="button"
                    className="ml-auto text-[12px] font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                    onClick={() => {
                      setSelected(pages);
                      setAnchor(range.first);
                    }}
                  >
                    Select juz
                  </button>
                </div>
                <div
                  role="grid"
                  aria-label={`Pages of juz ${summary.juz}`}
                  aria-multiselectable="true"
                >
                  <div role="row" className="grid grid-cols-10 gap-1">
                    {pages.map((page) => {
                      const record = byPage.get(page);
                      return (
                        <PageCell
                          key={page}
                          page={page}
                          record={record}
                          today={quran.today}
                          selected={selected.includes(page)}
                          focusable={page === focusPage}
                          hasNote={Boolean(quran.notes[page])}
                          refCallback={(el) => {
                            if (el) cellRefs.current.set(page, el);
                            else cellRefs.current.delete(page);
                          }}
                          onSelect={(extend) => {
                            setFocusPage(page);
                            selectPage(page, extend);
                          }}
                          onKeyDown={(e) => onKeyDown(e, page)}
                        />
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <aside className="lg:sticky lg:top-10 lg:self-start">
        <Inspector
          selected={selected}
          byPage={byPage}
          notes={quran.notes}
          today={quran.today}
          juzOf={(p) => quran.layout.juzOfPage[p] ?? 0}
          onClear={() => setSelected([])}
        />
      </aside>
    </div>
  );
}

function cellClasses(state: PageState | undefined): string {
  switch (state) {
    case 'memorized':
      return 'border-accent bg-accent text-paper';
    case 'new':
      return 'border-accent bg-accent-soft text-accent';
    case 'revision':
      return 'border-warning text-warning [background:repeating-linear-gradient(135deg,var(--warning-soft)_0_4px,var(--surface)_4px_7px)]';
    default:
      return 'border-rule-strong bg-transparent text-ink-faint hover:border-ink-faint';
  }
}

function PageCell({
  page,
  record,
  today,
  selected,
  focusable,
  hasNote,
  refCallback,
  onSelect,
  onKeyDown,
}: {
  page: number;
  record: PageRecord | undefined;
  today: string;
  selected: boolean;
  focusable: boolean;
  hasNote: boolean;
  refCallback: (el: HTMLButtonElement | null) => void;
  onSelect: (extend: boolean) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const state = record?.state;
  const due = record && state !== 'not_started' && record.dueOn !== null && record.dueOn <= today;
  const s = record ? strength(record, today) : null;
  const label = [
    `Page ${page}`,
    STATE_TEXT[state ?? 'not_started'],
    s !== null ? `retention ${Math.round(s * 100)}%` : null,
    due ? 'due for revision' : null,
    hasNote ? 'has a note' : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <button
      ref={refCallback}
      type="button"
      role="gridcell"
      aria-selected={selected}
      aria-label={label}
      tabIndex={focusable ? 0 : -1}
      onClick={(e) => onSelect(e.shiftKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(e.shiftKey);
          return;
        }
        onKeyDown(e);
      }}
      className={cx(
        'tabular relative h-8 rounded-[5px] border text-[11px] font-medium transition-[background-color,box-shadow] duration-150',
        cellClasses(state),
        selected && 'ring-2 ring-focus ring-offset-1 ring-offset-paper',
      )}
    >
      {page}
      {due ? (
        <span
          aria-hidden="true"
          className={cx(
            'absolute right-[3px] bottom-[3px] h-[5px] w-[5px] rounded-full',
            state === 'memorized' ? 'bg-paper' : 'bg-ink',
          )}
        />
      ) : null}
      {hasNote ? (
        <span
          aria-hidden="true"
          className="absolute top-[3px] left-[3px] h-[4px] w-[4px] rounded-full bg-current opacity-70"
        />
      ) : null}
    </button>
  );
}

function Legend() {
  const items: { state: PageState; label: string }[] = [
    { state: 'not_started', label: 'Not started' },
    { state: 'new', label: 'Recently learned' },
    { state: 'memorized', label: 'Memorised' },
    { state: 'revision', label: 'Needs revision' },
  ];
  return (
    <ul
      className="mb-5 flex flex-wrap items-center gap-4 text-[12px] text-ink-muted"
      aria-label="Legend"
    >
      {items.map((i) => (
        <li key={i.state} className="flex items-center gap-1.5">
          <span
            className={cx('inline-block h-3.5 w-3.5 rounded-[3px] border', cellClasses(i.state))}
          />
          {i.label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-[5px] w-[5px] rounded-full bg-ink" /> Due for revision
      </li>
    </ul>
  );
}

function Inspector({
  selected,
  byPage,
  notes,
  today,
  juzOf,
  onClear,
}: {
  selected: number[];
  byPage: Map<number, PageRecord>;
  notes: Record<number, string>;
  today: string;
  juzOf: (page: number) => number;
  onClear: () => void;
}) {
  if (selected.length === 0) {
    return (
      <Card className="p-5">
        <h2 className="font-serif text-[17px] font-semibold">Pages</h2>
        <p className="mt-2 text-[13px] text-ink-muted">
          Select a page to see its revision schedule, rate a review, or change its state.
          Shift-click (or Shift + arrow keys) selects a range; “Select juz” takes a whole juz.
        </p>
      </Card>
    );
  }
  const records = selected
    .map((p) => byPage.get(p))
    .filter((r): r is PageRecord => r !== undefined);
  const learned = records.filter((r) => r.state !== 'not_started');
  const single = records.length === 1 ? records[0] : undefined;

  return (
    <Card className="p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-[19px] font-semibold">
            {single ? `Page ${single.page}` : `${records.length} pages`}
          </h2>
          <p className="text-[12.5px] text-ink-muted">
            {single ? `Juz ${juzOf(single.page)}` : pageRangeLabel(selected)}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>

      {single ? <PageDetails record={single} today={today} /> : null}

      <div className="mt-5">
        <div className="eyebrow mb-2">Set state</div>
        <div className="grid grid-cols-2 gap-1.5">
          {(['new', 'memorized', 'revision', 'not_started'] as PageState[]).map((state) => (
            <Button
              key={state}
              size="sm"
              variant={single?.state === state ? 'primary' : 'secondary'}
              disabled={state === 'revision' && learned.length === 0}
              onClick={() => void setPagesState(selected, state)}
            >
              {state === 'new' ? 'Learned today' : STATE_TEXT[state]}
            </Button>
          ))}
        </div>
      </div>

      {learned.length > 0 ? (
        <div className="mt-5">
          <div className="eyebrow mb-2">
            Record a revision{learned.length > 1 ? ` (${learned.length} pages)` : ''}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['solid', 'shaky', 'forgotten'] as Rating[]).map((rating) => (
              <Button
                key={rating}
                size="sm"
                onClick={() =>
                  void ratePages(
                    learned.map((r) => r.page),
                    rating,
                  )
                }
              >
                {RATING_LABEL[rating]}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {single ? (
        <NoteEditor key={single.page} page={single.page} initial={notes[single.page] ?? ''} />
      ) : null}
    </Card>
  );
}

function PageDetails({ record, today }: { record: PageRecord; today: string }) {
  const s = strength(record, today);
  const rows: [string, string][] = [
    ['State', STATE_TEXT[record.state]],
    ['Retention', s === null ? '—' : `${Math.round(s * 100)}%`],
    [
      'Next revision',
      record.dueOn
        ? `${formatDate(record.dueOn)} (${relativeDays(diffDays(today, record.dueOn))})`
        : '—',
    ],
    [
      'Interval',
      record.state === 'not_started'
        ? '—'
        : `${record.intervalDays} day${record.intervalDays === 1 ? '' : 's'}`,
    ],
    ['Ease', record.state === 'not_started' ? '—' : record.ease.toFixed(2)],
    ['Last revised', record.lastReviewedOn ? formatDate(record.lastReviewedOn) : '—'],
    [
      'Learned',
      record.learnedOn
        ? formatDate(record.learnedOn)
        : record.state === 'not_started'
          ? '—'
          : 'before tracking',
    ],
    ['Reviews · lapses', `${record.reviews} · ${record.lapses}`],
  ];
  return (
    <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-muted">{k}</dt>
          <dd className="tabular text-right text-ink">
            {k === 'State' ? (
              <Pill
                tone={
                  record.state === 'revision'
                    ? 'warning'
                    : record.state === 'not_started'
                      ? 'neutral'
                      : 'accent'
                }
              >
                {v}
              </Pill>
            ) : (
              v
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function NoteEditor({ page, initial }: { page: number; initial: string }) {
  const [text, setText] = useState(initial);
  const save = async () => {
    if (text.trim() === initial.trim()) return;
    try {
      await api('quran.setNote', { page, note: text });
      toast.success(`Note saved for page ${page}.`);
    } catch {
      toast.error('Could not save the note.');
    }
  };
  return (
    <div className="mt-5">
      <label htmlFor={`note-${page}`} className="eyebrow mb-2 block">
        Note
      </label>
      <TextArea
        id={`note-${page}`}
        value={text}
        maxLength={2000}
        placeholder="Anything to remember about this page — similar passages, a tricky transition…"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void save()}
      />
    </div>
  );
}
