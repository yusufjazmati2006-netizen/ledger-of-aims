import { useState, type ReactNode } from 'react';
import { formatDateLong } from '@shared/domain/time/localDate';
import type { DevlogEntry } from '@shared/schemas/game';
import { useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { cx } from '../../lib/cx';
import { toast } from '../../stores/toasts';
import { Card, EmptyState } from '../../design/Card';
import { Button } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { Field, LabeledInput, SegmentedControl, TextArea, TextInput } from '../../design/Field';
import { Markdown } from '../../design/Markdown';

/** Splits "art, Pong,  #ui" into ["art", "pong", "ui"]. */
function parseTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(',')
        .map((t) => t.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean),
    ),
  ];
}

/**
 * A dated, tagged journal of the work in markdown. Writing down what was done and
 * what was learned is what turns hours into progress you can see.
 */
export function DevlogPage() {
  const query = useLedger('devlog.list', undefined, { domains: ['game'] });
  const [tag, setTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<DevlogEntry | 'new' | null>(null);
  const entries = query.data ?? [];

  const counts = new Map<string, number>();
  for (const e of entries) for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const needle = search.trim().toLowerCase();
  const shown = entries.filter(
    (e) =>
      (tag === null || e.tags.includes(tag)) &&
      (!needle || e.title.toLowerCase().includes(needle) || e.body.toLowerCase().includes(needle)),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <TextInput
          type="search"
          aria-label="Search the devlog"
          placeholder="Search entries"
          className="w-[240px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-[12.5px] text-ink-faint">
          {shown.length === entries.length
            ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
            : `${shown.length} of ${entries.length}`}
        </span>
        <Button variant="accent" icon="plus" className="ml-auto" onClick={() => setEditing('new')}>
          New entry
        </Button>
      </div>

      {tags.length > 0 ? (
        <div role="group" aria-label="Filter by tag" className="-mt-1 flex flex-wrap gap-1.5">
          <TagChip active={tag === null} onClick={() => setTag(null)}>
            All
          </TagChip>
          {tags.map(([t, n]) => (
            <TagChip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              #{t} <span className="opacity-60">{n}</span>
            </TagChip>
          ))}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          icon="edit"
          title="Start the devlog"
          action={
            <Button variant="accent" icon="plus" onClick={() => setEditing('new')}>
              Write the first entry
            </Button>
          }
        >
          A few lines after each session — what you did, what broke, what you learned — make
          progress visible on the days it feels slow, and become material for a Steam page later.
          Markdown is supported.
        </EmptyState>
      ) : shown.length === 0 ? (
        <p className="text-[13px] text-ink-muted">No entries match.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {shown.map((e) => (
            <li key={e.id}>
              <DevlogCard entry={e} onEdit={() => setEditing(e)} onTag={setTag} />
            </li>
          ))}
        </ol>
      )}

      {editing ? (
        <DevlogEditor entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function TagChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'h-6 rounded-full px-2.5 text-[12px] font-medium transition-colors duration-150',
        active ? 'bg-accent text-paper' : 'bg-sunken text-ink-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

const COLLAPSE_AT = 900;

function DevlogCard({
  entry,
  onEdit,
  onTag,
}: {
  entry: DevlogEntry;
  onEdit: () => void;
  onTag: (tag: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = entry.body.length > COLLAPSE_AT;
  return (
    <Card as="article" className="px-6 py-5" aria-labelledby={`devlog-${entry.id}`}>
      <header className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <time dateTime={entry.date} className="eyebrow">
            {formatDateLong(entry.date)}
          </time>
          <h2
            id={`devlog-${entry.id}`}
            className="mt-1 font-serif text-[19px] font-semibold text-ink"
          >
            {entry.title}
          </h2>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon="edit"
          onClick={onEdit}
          aria-label={`Edit ${entry.title}`}
        >
          Edit
        </Button>
      </header>
      {entry.body ? (
        <div className={cx('relative', long && !expanded && 'max-h-[220px] overflow-hidden')}>
          <Markdown>{entry.body}</Markdown>
          {long && !expanded ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
          ) : null}
        </div>
      ) : null}
      <footer className="mt-3 flex flex-wrap items-center gap-1.5">
        {entry.tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTag(t)}
            className="rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] font-semibold text-accent"
            aria-label={`Show entries tagged ${t}`}
          >
            #{t}
          </button>
        ))}
        {long ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'Read more'}
          </Button>
        ) : null}
      </footer>
    </Card>
  );
}

function DevlogEditor({ entry, onClose }: { entry: DevlogEntry | null; onClose: () => void }) {
  const today = useToday();
  const [date, setDate] = useState(entry?.date ?? today);
  const [title, setTitle] = useState(entry?.title ?? '');
  const [tags, setTags] = useState(entry?.tags.join(', ') ?? '');
  const [body, setBody] = useState(entry?.body ?? '');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      setError('Give the entry a title.');
      return;
    }
    try {
      await api('devlog.save', {
        id: entry?.id,
        date,
        title: title.trim(),
        body,
        tags: parseTags(tags),
      });
      toast.success(entry ? 'Entry updated.' : 'Entry added to the devlog.');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the entry.');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      goal="game"
      width={720}
      title={entry ? 'Edit devlog entry' : 'New devlog entry'}
      footer={
        <>
          {entry ? (
            confirmDelete ? (
              <Button
                variant="danger"
                className="mr-auto"
                onClick={() =>
                  void api('devlog.delete', { id: entry.id }).then(() => {
                    toast.success('Entry deleted.');
                    onClose();
                  })
                }
              >
                Delete permanently
              </Button>
            ) : (
              <Button variant="ghost" className="mr-auto" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_170px] gap-3">
          <LabeledInput
            label="Title"
            autoFocus
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
            error={error}
          />
          <LabeledInput
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <LabeledInput
          label="Tags"
          placeholder="e.g. pong, input, art"
          hint="Separate tags with commas."
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <Field label="Entry" htmlFor="devlog-body">
          <SegmentedControl
            label="Editor mode"
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'write', label: 'Write' },
              { value: 'preview', label: 'Preview' },
            ]}
          />
          {mode === 'write' ? (
            <TextArea
              id="devlog-body"
              className="min-h-[260px] font-mono text-[13px]"
              placeholder={
                'What did you do?\nWhat broke, and how did you fix it?\nWhat will you do next?'
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          ) : (
            <div className="min-h-[260px] rounded-lg border border-rule px-4 py-3">
              {body.trim() ? (
                <Markdown>{body}</Markdown>
              ) : (
                <p className="text-[13px] text-ink-faint">Nothing to preview yet.</p>
              )}
            </div>
          )}
          <p className="text-[12px] text-ink-faint">
            Markdown: **bold**, _italic_, # headings, - lists, - [ ] checklists, `code`,
            [links](https://…).
          </p>
        </Field>
      </div>
    </Dialog>
  );
}
