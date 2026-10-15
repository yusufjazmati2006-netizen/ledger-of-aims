import { useState } from 'react';
import { useApp } from '../../stores/app';
import { api, ApiError } from '../../lib/api';
import { Button } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { Icon } from '../../design/icons';
import { Pill } from '../../design/Card';

const REASONS = {
  corrupt: 'The database file appears to be damaged.',
  'schema-newer': 'The database was created by a newer version of Ledger of Aims.',
  'open-failed': 'The database file could not be opened.',
} as const;

/**
 * Shown instead of the app when the database cannot be opened safely. Nothing is
 * ever deleted: the damaged file is moved to a quarantine folder before a restore
 * or a fresh start.
 */
export function RecoveryScreen() {
  const recovery = useApp((s) => s.recovery);
  const bootstrap = useApp((s) => s.bootstrap);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmFresh, setConfirmFresh] = useState(false);
  if (!recovery) return null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      // The main process reopens the database and reloads this window.
      setTimeout(() => void bootstrap(), 300);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work. Please try again.');
      setBusy(false);
    }
  };

  const valid = recovery.backups.filter((b) => b.valid);

  return (
    <div className="flex h-full flex-col bg-paper">
      <div className="drag-region h-[52px] shrink-0" />
      <main className="flex flex-1 justify-center overflow-y-auto px-8 pb-16">
        <div className="w-full max-w-[600px] pt-[5vh]">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-warning-soft text-warning">
            <Icon name="alert" size={20} />
          </span>
          <h1 className="mt-5 font-serif text-[34px] leading-tight font-semibold">
            Your ledger needs attention
          </h1>
          <p className="mt-3 text-[15px] text-ink-muted">
            {REASONS[recovery.reason]} Your data has not been changed or deleted.
          </p>
          <details className="mt-3 text-[12.5px] text-ink-faint">
            <summary className="cursor-default">Technical detail</summary>
            <p className="selectable mt-2 font-mono break-all">{recovery.detail}</p>
            <p className="selectable mt-1 font-mono break-all">{recovery.dbPath}</p>
          </details>

          <h2 className="mt-10 font-serif text-[20px] font-semibold">Restore from a backup</h2>
          {valid.length === 0 ? (
            <p className="mt-2 text-[13.5px] text-ink-muted">
              No valid backups were found in the backup folder.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-rule rounded-xl border border-rule bg-surface">
              {recovery.backups.map((b, index) => (
                <li key={b.path} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] text-ink">{b.name}</div>
                    <div className="text-[12px] text-ink-muted">
                      {new Date(b.createdAt).toLocaleString('en-GB')} ·{' '}
                      {(b.sizeBytes / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  {index === 0 && b.valid ? <Pill tone="positive">Newest</Pill> : null}
                  {b.valid ? (
                    <Button
                      variant={index === 0 ? 'primary' : 'secondary'}
                      size="sm"
                      disabled={busy}
                      onClick={() => void run(() => api('recovery.restore', { path: b.path }))}
                    >
                      Restore
                    </Button>
                  ) : (
                    <Pill tone="critical">Unreadable</Pill>
                  )}
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-10 font-serif text-[20px] font-semibold">Other options</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                setConfirmFresh(true);
              }}
            >
              Start with a fresh ledger
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void api('app.revealDataFolder')}
            >
              Reveal data folder
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void api('recovery.quit')}>
              Quit
            </Button>
          </div>
          {error ? (
            <p role="alert" className="mt-4 text-[13px] text-critical">
              {error}
            </p>
          ) : null}
        </div>
      </main>

      <Dialog
        open={confirmFresh}
        onClose={() => {
          setConfirmFresh(false);
        }}
        title="Start a fresh ledger?"
        description="The damaged database is moved to a quarantine folder inside the data folder, not deleted. A new ledger is created with the default goals and milestones."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmFresh(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmFresh(false);
                void run(() => api('recovery.startFresh'));
              }}
            >
              Start fresh
            </Button>
          </>
        }
      />
    </div>
  );
}
