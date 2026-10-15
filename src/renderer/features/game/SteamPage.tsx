import { useState } from 'react';
import { STEAM_VERIFY_NOTE } from '@shared/seed/game';
import type { SteamItem } from '@shared/schemas/game';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { cx } from '../../lib/cx';
import { toast } from '../../stores/toasts';
import { Card, Pill, SectionTitle } from '../../design/Card';
import { Button, IconButton } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { Field, LabeledInput, TextArea } from '../../design/Field';
import { Icon } from '../../design/icons';
import { Meter } from '../../design/Ring';

/**
 * What a Steam release needs, as a checklist. Valve's requirements, sizes and fees
 * change, so nothing here is presented as current fact: seeded details are "last
 * known" values flagged for verification against the Steamworks documentation.
 */
export function SteamPage() {
  const query = useLedger('steam.list', undefined, { domains: ['game'] });
  const [editing, setEditing] = useState<SteamItem | { section: string } | null>(null);
  const items = query.data ?? [];
  const sections = [...new Set(items.map((i) => i.section))];
  const done = items.filter((i) => i.done).length;

  return (
    <div className="flex flex-col gap-6">
      <div
        role="note"
        aria-label="Verification required"
        className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-warning"
      >
        <Icon name="alert" className="mt-0.5 shrink-0" />
        <div className="text-[13px]">
          <p className="font-semibold">
            Verify everything here against the current Steamworks documentation.
          </p>
          <p className="mt-0.5">
            Fees, image sizes, review times and rules change. Items marked{' '}
            <span className="font-semibold">Verify</span> carry last-known values only — they are
            reminders of what to check, not guarantees. This app never goes online to check them for
            you.
          </p>
        </div>
      </div>

      <Card className="flex items-center gap-6 px-6 py-4">
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-1.5">Readiness</div>
          <Meter
            value={items.length ? done / items.length : 0}
            label="Steam readiness checklist progress"
          />
        </div>
        <div className="tabular text-[13px] text-ink-muted">
          <span className="text-[20px] font-semibold text-ink">{done}</span> of {items.length} done
        </div>
        <Button
          size="sm"
          icon="plus"
          onClick={() => setEditing({ section: sections[0] ?? 'Other' })}
        >
          Add item
        </Button>
      </Card>

      {sections.map((section) => {
        const inSection = items.filter((i) => i.section === section);
        const sectionDone = inSection.filter((i) => i.done).length;
        const id = `steam-${section.replace(/\W+/g, '-').toLowerCase()}`;
        return (
          <section key={section} aria-labelledby={id}>
            <SectionTitle
              id={id}
              action={
                <span className="tabular text-[12.5px] text-ink-faint">
                  {sectionDone}/{inSection.length}
                </span>
              }
            >
              {section}
            </SectionTitle>
            <Card as="div">
              <ul>
                {inSection.map((item) => (
                  <SteamRow key={item.id} item={item} onEdit={() => setEditing(item)} />
                ))}
              </ul>
              <div className="border-t border-rule px-5 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  icon="plus"
                  onClick={() => setEditing({ section })}
                >
                  Add to {section}
                </Button>
              </div>
            </Card>
          </section>
        );
      })}

      {editing ? (
        <SteamItemDialog
          item={'id' in editing ? editing : null}
          section={editing.section}
          sections={sections}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function SteamRow({ item, onEdit }: { item: SteamItem; onEdit: () => void }) {
  const needsVerify = item.detail.includes(STEAM_VERIFY_NOTE);
  const detail = item.detail.replace(STEAM_VERIFY_NOTE, '').trim();
  // Optimistic, so the box does not flicker back while the change round-trips.
  const [pending, setPending] = useState<boolean | null>(null);
  if (pending !== null && pending === item.done) setPending(null);
  const done = pending ?? item.done;
  const toggle = () => {
    setPending(!done);
    void api('steam.setDone', { id: item.id, done: !done }).catch(() => {
      setPending(null);
      toast.error('Could not update the checklist.');
    });
  };
  return (
    <li className="group flex items-start gap-3 border-b border-rule px-5 py-3 last:border-0">
      <input
        type="checkbox"
        id={`steam-item-${item.id}`}
        className="mt-[3px] h-4 w-4 shrink-0 accent-[var(--game)]"
        checked={done}
        onChange={toggle}
      />
      <div className="min-w-0 flex-1">
        <label
          htmlFor={`steam-item-${item.id}`}
          className={cx(
            'text-[13.5px] font-medium',
            done ? 'text-ink-faint line-through' : 'text-ink',
          )}
        >
          {item.title}
        </label>
        {detail || needsVerify ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-muted">
            {needsVerify ? (
              <Pill tone="warning" icon="alert">
                Verify
              </Pill>
            ) : null}
            <span>{detail}</span>
          </p>
        ) : null}
      </div>
      <IconButton
        icon="edit"
        size="sm"
        label={`Edit ${item.title}`}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={onEdit}
      />
    </li>
  );
}

function SteamItemDialog({
  item,
  section: initialSection,
  sections,
  onClose,
}: {
  item: SteamItem | null;
  section: string;
  sections: string[];
  onClose: () => void;
}) {
  const [section, setSection] = useState(item?.section ?? initialSection);
  const [title, setTitle] = useState(item?.title ?? '');
  const [detail, setDetail] = useState(item?.detail.replace(STEAM_VERIFY_NOTE, '').trim() ?? '');
  const [verify, setVerify] = useState(item ? item.detail.includes(STEAM_VERIFY_NOTE) : false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim() || !section.trim()) {
      setError('An item needs a title and a section.');
      return;
    }
    try {
      await api('steam.save', {
        id: item?.id,
        section: section.trim(),
        title: title.trim(),
        detail: [detail.trim(), verify ? STEAM_VERIFY_NOTE : ''].filter(Boolean).join(' '),
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the item.');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      goal="game"
      width={520}
      title={item ? 'Edit checklist item' : 'Add checklist item'}
      footer={
        <>
          {item ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => void api('steam.delete', { id: item.id }).then(onClose)}
            >
              Delete
            </Button>
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
        <LabeledInput
          label="Item"
          autoFocus
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          error={error}
        />
        <LabeledInput
          label="Section"
          list="steam-sections"
          value={section}
          maxLength={60}
          onChange={(e) => setSection(e.target.value)}
        />
        <datalist id="steam-sections">
          {sections.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Field label="Details" htmlFor="steam-detail">
          <TextArea
            id="steam-detail"
            value={detail}
            maxLength={900}
            onChange={(e) => setDetail(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-[13px] text-ink-muted">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--game)]"
            checked={verify}
            onChange={(e) => setVerify(e.target.checked)}
          />
          Mark as “verify against Steamworks documentation”
        </label>
      </div>
    </Dialog>
  );
}
