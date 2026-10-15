import { useState, type SyntheticEvent } from 'react';
import { formatDate } from '@shared/domain/time/localDate';
import type { LearningItem } from '@shared/schemas/game';
import { useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { toast } from '../../stores/toasts';
import { cx } from '../../lib/cx';
import { Card, Note, SectionTitle } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { LabeledInput, TextArea, TextInput } from '../../design/Field';
import { Icon } from '../../design/icons';

/**
 * The first phase's learning path: fundamentals to work through, each with notes and
 * resource links you add yourself, plus a log of engine decisions and their reasons.
 */
export function LearningPage() {
  const query = useLedger('game.learning', undefined, { domains: ['game'] });
  const items = query.data?.items ?? [];
  const done = items.filter((i) => i.done).length;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] text-ink-muted">
        {done} of {items.length} fundamentals done. Links open in your browser; Ledger of Aims
        itself never goes online.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <LearningCard key={item.id} item={item} />
        ))}
      </div>
      <AddLearningItem />
      <Decisions decisions={query.data?.decisions ?? []} />
    </div>
  );
}

function LearningCard({ item }: { item: LearningItem }) {
  const [notes, setNotes] = useState(item.notes);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = (patch: Partial<LearningItem>) =>
    api('game.saveLearningItem', { ...item, ...patch }).catch((e: unknown) => {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    });

  const addLink = (e: SyntheticEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!/^https?:\/\/\S+$/i.test(trimmed)) {
      setError('Links must start with http:// or https://');
      return;
    }
    setError(null);
    void save({ links: [...item.links, { label: label.trim() || trimmed, url: trimmed }] }).then(
      () => {
        setLabel('');
        setUrl('');
      },
    );
  };

  return (
    <Card className={cx('p-5', item.done && 'opacity-80')} aria-labelledby={`learn-${item.id}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={item.done}
          aria-label={`${item.title} done`}
          onClick={() => void save({ done: !item.done })}
          className={cx(
            'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2',
            item.done
              ? 'border-accent bg-accent text-paper'
              : 'border-accent text-transparent hover:bg-accent-soft',
          )}
        >
          <Icon name="check" size={11} strokeWidth={2.5} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="eyebrow !text-accent">{item.category}</div>
          <h3
            id={`learn-${item.id}`}
            className={cx('text-[14.5px] font-semibold', item.done ? 'text-ink-muted' : 'text-ink')}
          >
            {item.title}
          </h3>
        </div>
      </div>
      <TextArea
        aria-label={`Notes for ${item.title}`}
        className="mt-3 min-h-[72px] text-[13px]"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes !== item.notes) void save({ notes });
        }}
      />
      {item.links.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1">
          {item.links.map((l, i) => (
            <li key={`${l.url}-${i}`} className="flex items-center gap-2 text-[13px]">
              <Icon name="link" size={13} className="text-ink-faint" />
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate text-ink underline underline-offset-2"
              >
                {l.label}
              </a>
              <IconButton
                icon="close"
                size="sm"
                label={`Remove link ${l.label}`}
                onClick={() => void save({ links: item.links.filter((_, j) => j !== i) })}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <form
        onSubmit={addLink}
        className="mt-3 flex gap-2"
        aria-label={`Add a resource link to ${item.title}`}
      >
        <TextInput
          aria-label="Link label"
          placeholder="Label"
          className="w-[120px]"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <TextInput
          aria-label="Link URL"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button type="submit" size="md" icon="plus" aria-label="Add link" />
      </form>
      {error ? (
        <p role="alert" className="mt-1 text-[12px] text-critical">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function AddLearningItem() {
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      aria-label="Add a fundamental"
      onSubmit={(e) => {
        e.preventDefault();
        if (!category.trim() || !title.trim()) return;
        void api('game.saveLearningItem', { category: category.trim(), title: title.trim() }).then(
          () => {
            setCategory('');
            setTitle('');
          },
        );
      }}
    >
      <LabeledInput
        label="Category"
        placeholder="e.g. Animation"
        className="w-[180px]"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <LabeledInput
        label="What to learn"
        className="w-[320px]"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Button type="submit" icon="plus">
        Add to the path
      </Button>
    </form>
  );
}

function Decisions({
  decisions,
}: {
  decisions: { id: string; date: string; engine: string; decision: string; rationale: string }[];
}) {
  const today = useToday();
  const [engine, setEngine] = useState('');
  const [decision, setDecision] = useState('');
  const [rationale, setRationale] = useState('');
  return (
    <section aria-labelledby="decisions">
      <SectionTitle id="decisions">Engine decision log</SectionTitle>
      <Note>
        Write down what you chose and why. When doubt creeps in at month six, the reasons you had at
        the start are worth rereading before switching.
      </Note>
      <Card as="div" className="mt-3 p-5">
        <form
          className="flex flex-col gap-3"
          aria-label="Record an engine decision"
          onSubmit={(e) => {
            e.preventDefault();
            if (!engine.trim() || !decision.trim()) return;
            void api('game.addDecision', {
              date: today,
              engine: engine.trim(),
              decision: decision.trim(),
              rationale: rationale.trim(),
            }).then(() => {
              setEngine('');
              setDecision('');
              setRationale('');
              toast.success('Decision recorded.');
            });
          }}
        >
          <div className="grid grid-cols-[180px_1fr] gap-3">
            <LabeledInput
              label="Engine"
              placeholder="e.g. Godot"
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
            />
            <LabeledInput
              label="Decision"
              placeholder="e.g. Use it for the first game"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
            />
          </div>
          <TextArea
            aria-label="Why"
            placeholder="Why — the trade-offs you weighed"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
          <div>
            <Button type="submit" variant="accent">
              Record decision
            </Button>
          </div>
        </form>
        {decisions.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-3 border-t border-rule pt-4">
            {decisions.map((d) => (
              <li key={d.id} className="text-[13px]">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-ink">{d.engine}</span>
                  <span className="text-ink">— {d.decision}</span>
                  <span className="ml-auto text-[12px] text-ink-faint">{formatDate(d.date)}</span>
                  <IconButton
                    icon="trash"
                    size="sm"
                    tone="danger"
                    label={`Delete decision about ${d.engine}`}
                    onClick={() => void api('game.deleteDecision', { id: d.id })}
                  />
                </div>
                {d.rationale ? (
                  <p className="selectable mt-0.5 whitespace-pre-wrap text-ink-muted">
                    {d.rationale}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}
