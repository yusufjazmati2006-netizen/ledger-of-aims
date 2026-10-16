import { useState } from 'react';
import type { BackupFile } from '@shared/ipc/contract';
import type { ImportPreview } from '@shared/schemas/data';
import { formatDate, localDateOf } from '@shared/domain/time/localDate';
import { fromMinutes } from '@shared/domain/time/clockTime';
import { useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { toast } from '../../stores/toasts';
import { Button } from '../../design/Button';
import { Card, Note, Pill } from '../../design/Card';
import { Dialog } from '../../design/Dialog';

const LABELS: Record<string, string> = {
  daily: 'Daily',
  manual: 'Manual',
  'pre-restore': 'Before a restore',
  'pre-import': 'Before an import',
  'pre-migration': 'Before an update',
  other: 'Copy',
};

const TABLE_NAMES: Record<string, string> = {
  weigh_ins: 'Weigh-ins',
  quran_pages: 'Quran pages',
  quran_reviews: 'Revision ratings',
  workouts: 'Workouts',
  workout_sets: 'Workout sets',
  food_entries: 'Food entries',
  study_sessions: 'Study sessions',
  time_entries: 'Game time entries',
  devlog_entries: 'Devlog entries',
  milestones: 'Milestones',
  assessments: 'Assessments',
  modules: 'Modules',
  roadmap_tasks: 'Roadmap tasks',
  plan_blocks: 'Plan blocks',
  weekly_reviews: 'Weekly reviews',
  habits: 'Habits',
  habit_checks: 'Habit ticks',
  photos: 'Photos',
};

function when(iso: string, today: string): string {
  const d = new Date(iso);
  const date = localDateOf(d);
  const time = fromMinutes(d.getHours() * 60 + d.getMinutes());
  return date === today ? `Today ${time}` : `${formatDate(date)} ${time}`;
}

const size = (bytes: number) =>
  bytes > 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;

/**
 * Backups (daily, rolling 30, with photos), restore with a snapshot taken first, JSON
 * export and import, and calendar export.
 */
export function BackupSettingsSection() {
  const today = useToday();
  const status = useLedger('backups.status', undefined, { domains: ['backups'] });
  const list = useLedger('backups.list', undefined, { domains: ['backups'] });
  const [restoring, setRestoring] = useState<BackupFile | null>(null);
  const [showAll, setShowAll] = useState(false);
  const backups = list.data ?? [];

  const run = (work: () => Promise<unknown>) =>
    void work().catch((err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'That did not work.');
    });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-[12.5px] font-medium text-ink-muted">Backup folder</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code
            className="selectable min-w-0 flex-1 truncate rounded-md bg-sunken px-2.5 py-1.5 font-mono text-[12px] text-ink"
            data-testid="backup-folder"
          >
            {status.data?.directory}
          </code>
          <Button size="sm" onClick={() => run(() => api('backups.chooseFolder'))}>
            Change…
          </Button>
          {status.data && !status.data.isDefault ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => run(() => api('backups.useDefaultFolder'))}
            >
              Use default
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            icon="folder"
            onClick={() => run(() => api('backups.reveal'))}
          >
            Reveal
          </Button>
        </div>
        <p className="mt-1.5 text-[12px] text-ink-faint">
          A backup is made every day you use the app; the last 30 are kept, with your photos. An
          external drive or a synced folder (iCloud Drive, Dropbox) protects against losing the Mac.
        </p>
      </div>

      {status.data?.lastError ? (
        <Note tone="warning" icon="alert">
          The last backup failed: {status.data.lastError}
        </Note>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-ink">
          {status.data?.lastBackupAt
            ? `Last backup: ${when(status.data.lastBackupAt, today)}`
            : 'No backups yet.'}
        </span>
        <Button
          size="sm"
          variant="accent"
          icon="download"
          className="ml-auto"
          onClick={() =>
            run(async () => {
              await api('backups.create');
              toast.success('Backed up.');
            })
          }
        >
          Back up now
        </Button>
      </div>

      {backups.length > 0 ? (
        <Card as="div">
          <ul aria-label="Backups">
            {(showAll ? backups : backups.slice(0, 6)).map((b) => (
              <li
                key={b.path}
                className="flex items-center gap-3 border-b border-rule px-4 py-2 last:border-0"
              >
                <span className="w-[150px] shrink-0 text-[13px] text-ink">
                  {when(b.createdAt, today)}
                </span>
                <Pill tone={b.label === 'daily' ? 'neutral' : 'accent'}>
                  {LABELS[b.label] ?? b.label}
                </Pill>
                <span className="tabular flex-1 text-[12px] text-ink-faint">
                  {size(b.sizeBytes)}
                </span>
                {b.valid ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRestoring(b)}
                    aria-label={`Restore backup from ${when(b.createdAt, today)}`}
                  >
                    Restore…
                  </Button>
                ) : (
                  <Pill tone="critical">Damaged</Pill>
                )}
              </li>
            ))}
          </ul>
          {backups.length > 6 ? (
            <div className="border-t border-rule px-4 py-1.5">
              <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show fewer' : `Show all ${backups.length}`}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}
      <div>
        <Button
          size="sm"
          variant="ghost"
          icon="upload"
          onClick={() =>
            run(async () => {
              const file = await api('backups.chooseFile');
              if (!file) return;
              if (!file.valid) toast.error('That file is not a valid Ledger of Aims backup.');
              else setRestoring(file);
            })
          }
        >
          Restore from a file…
        </Button>
      </div>

      {restoring ? (
        <Dialog
          open
          onClose={() => setRestoring(null)}
          title="Restore this backup?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setRestoring(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  run(async () => {
                    await api('backups.restore', { path: restoring.path });
                    setRestoring(null);
                  })
                }
              >
                Restore
              </Button>
            </>
          }
        >
          <p className="text-[13.5px] text-ink">
            Your data will be replaced with the backup from{' '}
            <strong>{when(restoring.createdAt, today)}</strong>.
          </p>
          <p className="mt-2 text-[13px] text-ink-muted">
            Your current data is saved first as a “Before a restore” backup, so you can go back. The
            app reloads when it is done.
          </p>
        </Dialog>
      ) : null}
    </div>
  );
}

export function ExportSettingsSection() {
  const [includePhotos, setIncludePhotos] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [calendar, setCalendar] = useState({
    milestones: true,
    deadlines: true,
    plan: true,
    shifts: true,
  });
  const run = (work: () => Promise<unknown>) =>
    void work().catch((err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'That did not work.');
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-[13.5px] font-semibold text-ink">Export and import</h3>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">
          Everything in one JSON file — readable, and yours to keep or move to another Mac.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-ink-muted">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={includePhotos}
              onChange={(e) => setIncludePhotos(e.target.checked)}
            />
            Include photos (larger file)
          </label>
          <Button
            size="sm"
            icon="download"
            onClick={() =>
              run(async () => {
                const done = await api('data.export', { includePhotos });
                if (done)
                  toast.success(`Exported to ${done.path.split(/[\\/]/).pop() ?? done.path}.`);
              })
            }
          >
            Export all data…
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon="upload"
            onClick={() =>
              run(async () => {
                const p = await api('data.importChoose');
                if (p) setPreview(p);
              })
            }
          >
            Import…
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-[13.5px] font-semibold text-ink">Calendar</h3>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">
          An .ics file for Apple Calendar or any other calendar. Importing it again updates the same
          events instead of duplicating them.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {(
            [
              ['milestones', 'Milestones'],
              ['deadlines', 'Deadlines'],
              ['plan', 'Plan (8 weeks)'],
              ['shifts', 'Shifts (8 weeks)'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-[13px] text-ink-muted">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={calendar[key]}
                onChange={(e) => setCalendar({ ...calendar, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <Button
            size="sm"
            icon="calendar"
            className="ml-auto"
            disabled={!Object.values(calendar).some(Boolean)}
            onClick={() =>
              run(async () => {
                const done = await api('calendar.export', calendar);
                if (done) toast.success(`Exported ${done.events} events.`);
              })
            }
          >
            Export to Calendar…
          </Button>
        </div>
      </div>

      {preview ? (
        <Dialog
          open
          onClose={() => setPreview(null)}
          width={520}
          title="Replace your data with this export?"
          description={`${preview.fileName} · exported ${formatDate(localDateOf(new Date(preview.exportedAt)))} by version ${preview.appVersion}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  run(async () => {
                    await api('data.importApply', { token: preview.token });
                    setPreview(null);
                  })
                }
              >
                Replace my data
              </Button>
            </>
          }
        >
          <Note tone="warning" icon="alert">
            Everything currently in Ledger of Aims is replaced. A “Before an import” backup is made
            first, so this can be undone from Backups.
          </Note>
          {preview.olderSchema ? (
            <p className="mt-2 text-[12.5px] text-ink-muted">
              This export is from an earlier version; anything it does not include starts empty.
            </p>
          ) : null}
          <table className="mt-3 w-full text-[13px]" aria-label="What the import contains">
            <thead>
              <tr className="text-left text-[12px] text-ink-muted">
                <th className="py-1 font-medium">Data</th>
                <th className="py-1 text-right font-medium">Now</th>
                <th className="py-1 text-right font-medium">After import</th>
              </tr>
            </thead>
            <tbody>
              {preview.tables
                .filter((t) => TABLE_NAMES[t.table])
                .map((t) => (
                  <tr key={t.table} className="border-t border-rule">
                    <td className="py-1 text-ink">{TABLE_NAMES[t.table]}</td>
                    <td className="tabular py-1 text-right text-ink-muted">{t.current}</td>
                    <td className="tabular py-1 text-right text-ink">{t.incoming}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {preview.photos > 0 ? (
            <p className="mt-2 text-[12.5px] text-ink-muted">Includes {preview.photos} photos.</p>
          ) : null}
        </Dialog>
      ) : null}
    </div>
  );
}
