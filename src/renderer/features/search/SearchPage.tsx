import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SEARCH_KINDS, type SearchHit } from '@shared/schemas/data';
import { formatDate } from '@shared/domain/time/localDate';
import { useLedger } from '../../lib/useLedger';
import { Card, EmptyState, PageHeader } from '../../design/Card';
import { TextInput } from '../../design/Field';
import { Highlight, SEARCH_DOMAINS } from './Highlight';

/** Search everything you have written: notes, devlog, reviews, tasks, milestones… */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const q = text.trim();
  const results = useLedger('search.query', { q, limit: 50 }, { domains: [...SEARCH_DOMAINS] });
  const hits = q ? (results.data ?? []) : [];

  const groups = new Map<string, SearchHit[]>();
  for (const h of hits) groups.set(h.kind, [...(groups.get(h.kind) ?? []), h]);

  return (
    <div className="animate-fade-in pt-6">
      <PageHeader
        title="Search"
        description="Notes, devlog entries, reviews, tasks, milestones, page notes — everything you have written."
      />
      <TextInput
        type="search"
        autoFocus
        aria-label="Search everything"
        placeholder="Search…"
        className="mb-6 h-11 text-[15px]"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setParams(e.target.value ? { q: e.target.value } : {}, { replace: true });
        }}
      />
      {!q ? (
        <EmptyState icon="search" title="Find anything you have written">
          Words match as prefixes — “paddl” finds “paddles”. Press ⌘K anywhere to search or log
          without leaving the screen you are on.
        </EmptyState>
      ) : results.data && hits.length === 0 ? (
        <p className="text-[13.5px] text-ink-muted">Nothing matches “{q}”.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {[...groups.entries()].map(([kind, list]) => (
            <section key={kind} aria-labelledby={`sr-${kind}`}>
              <h2 id={`sr-${kind}`} className="eyebrow mb-2">
                {SEARCH_KINDS[kind as keyof typeof SEARCH_KINDS]}
              </h2>
              <Card as="div">
                <ul>
                  {list.map((h) => (
                    <li key={`${h.kind}-${h.ref}`} className="border-b border-rule last:border-0">
                      <Link to={h.path} className="block px-5 py-3 hover:bg-sunken/60">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="truncate text-[14px] font-medium text-ink">
                            <Highlight text={h.titleMarked} />
                          </span>
                          {h.date ? (
                            <span className="shrink-0 text-[12px] text-ink-faint">
                              {formatDate(h.date)}
                            </span>
                          ) : null}
                        </div>
                        {h.snippet.includes('\u0001') ||
                        (h.snippet && !h.titleMarked.includes('\u0001')) ? (
                          <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-muted">
                            <Highlight text={h.snippet} />
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
