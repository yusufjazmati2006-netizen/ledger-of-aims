import { useState } from 'react';
import { diffDays, formatDate } from '@shared/domain/time/localDate';
import type { Photo } from '@shared/schemas/physique';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { formatWeight } from '../../lib/units';
import { toast } from '../../stores/toasts';
import { cx } from '../../lib/cx';
import { Card, EmptyState, Note, SectionTitle } from '../../design/Card';
import { Button } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { Field, Select, TextInput } from '../../design/Field';
import { usePhysique } from './usePhysique';

const POSES = ['front', 'side', 'back', 'relaxed', 'flexed'];

/**
 * Private progress photos. Files are copied into the app's data folder and served
 * only to this window; they are never uploaded anywhere.
 */
export function PhotosPage() {
  const today = useToday();
  const settings = useSettings();
  const physique = usePhysique();
  const photos = useLedger('photos.list', undefined, { domains: ['photos'] });
  const [date, setDate] = useState(today);
  const [pose, setPose] = useState('front');
  const [compare, setCompare] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<Photo | null>(null);
  const list = photos.data ?? [];

  const trendOn = (d: string) => {
    let best: number | null = null;
    for (const p of physique.trend) if (p.date <= d) best = p.trend;
    return best;
  };

  const add = async () => {
    try {
      const added = await api('photos.import', { date, pose, note: '' });
      if (added.length > 0)
        toast.success(`Added ${added.length} photo${added.length === 1 ? '' : 's'}.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not add the photo.');
    }
  };

  const toggleCompare = (id: string) => {
    setCompare((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-2),
    );
  };

  const [a, b] = compare
    .map((id) => list.find((p) => p.id === id))
    .filter((p): p is Photo => p !== undefined)
    .sort((x, y) => x.date.localeCompare(y.date));

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-end gap-3 p-5">
        <Field label="Date" htmlFor="photo-date">
          <TextInput
            id="photo-date"
            type="date"
            className="w-[150px]"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
          />
        </Field>
        <Field label="Pose" htmlFor="photo-pose">
          <Select
            id="photo-pose"
            className="w-[140px]"
            value={pose}
            onChange={(e) => setPose(e.target.value)}
          >
            {POSES.map((p) => (
              <option key={p} value={p}>
                {p[0]?.toUpperCase()}
                {p.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="accent" icon="camera" onClick={() => void add()}>
          Add photos…
        </Button>
        <div className="ml-auto max-w-[360px]">
          <Note icon="lock">Stored only in your data folder and its backups. Never uploaded.</Note>
        </div>
      </Card>

      {a && b ? (
        <section aria-labelledby="compare">
          <SectionTitle
            id="compare"
            action={
              <Button size="sm" variant="ghost" onClick={() => setCompare([])}>
                Clear comparison
              </Button>
            }
          >
            {diffDays(a.date, b.date)} days apart
          </SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            {[a, b].map((p) => {
              const w = trendOn(p.date);
              return (
                <figure key={p.id} className="m-0">
                  <img
                    src={p.url}
                    alt={`${p.pose} pose on ${formatDate(p.date)}`}
                    className="max-h-[560px] w-full rounded-xl bg-sunken object-contain"
                  />
                  <figcaption className="mt-2 flex justify-between text-[12.5px] text-ink-muted">
                    <span>
                      {formatDate(p.date)} · {p.pose}
                    </span>
                    <span>
                      {w !== null ? `trend ${formatWeight(w, settings.general.units)}` : ''}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="gallery">
        <SectionTitle id="gallery">Gallery</SectionTitle>
        {list.length === 0 ? (
          <EmptyState icon="camera" title="No photos yet">
            A photo every four weeks — same light, same pose, same time of day — shows change that
            the scale and mirror hide. Select two to compare them side by side.
          </EmptyState>
        ) : (
          <>
            <p className="-mt-1 mb-3 text-[12.5px] text-ink-muted">
              Select two photos to compare them side by side.
            </p>
            <ul className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
              {list.map((p) => {
                const selected = compare.includes(p.id);
                return (
                  <li key={p.id} className="group relative">
                    <button
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${p.pose} pose on ${formatDate(p.date)}${selected ? ', selected for comparison' : ''}`}
                      onClick={() => toggleCompare(p.id)}
                      className={cx(
                        'block w-full overflow-hidden rounded-lg border-2 bg-sunken',
                        selected ? 'border-accent' : 'border-transparent hover:border-rule-strong',
                      )}
                    >
                      <img
                        src={p.thumbUrl}
                        alt=""
                        className="aspect-[3/4] w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                    <div className="mt-1 flex items-center justify-between text-[11.5px] text-ink-muted">
                      <span>
                        {formatDate(p.date, { year: false })} · {p.pose}
                      </span>
                      <button
                        type="button"
                        className="text-ink-faint hover:text-critical"
                        onClick={() => setDeleting(p)}
                        aria-label={`Delete photo from ${formatDate(p.date)}`}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this photo?"
        description="The image file is removed from your data folder. Backups made earlier keep their copy."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleting) {
                  setCompare((c) => c.filter((id) => id !== deleting.id));
                  void api('photos.delete', { id: deleting.id });
                }
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
