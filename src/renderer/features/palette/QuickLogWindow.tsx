import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Icon } from '../../design/icons';
import { Palette } from './Palette';
import type { QuickOutcome } from './useQuickLog';

/**
 * The floating quick-log window (global shortcut / menu bar). Log, see it confirmed,
 * and the window gets out of the way — the whole round trip in a few seconds.
 */
export function QuickLogWindow({ onboarded }: { onboarded: boolean }) {
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState<string | null>(null);

  useEffect(
    () =>
      window.ledger.on('quick:shown', () => {
        setDone(null);
        setShown((n) => n + 1);
      }),
    [],
  );

  const hide = () => void api('quick.hide');
  const finish = (outcome: QuickOutcome) => {
    setDone(outcome.message);
    setTimeout(() => {
      if (outcome.open) void api('app.openMain', { path: outcome.open });
      else hide();
    }, 900);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-rule bg-surface">
      {!onboarded ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-[14px] text-ink">Finish setting up Ledger of Aims first.</p>
          <button
            type="button"
            className="text-[13px] font-medium text-accent underline underline-offset-2"
            onClick={() => void api('app.openMain', { path: '/' })}
          >
            Open the app
          </button>
        </div>
      ) : done ? (
        <div
          role="status"
          className="flex flex-1 items-center justify-center gap-3 p-8 text-[15px] text-ink"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-positive-soft text-positive">
            <Icon name="check" size={18} />
          </span>
          {done}
        </div>
      ) : (
        <Palette
          resetSignal={shown}
          placeholder="w 72.4 · p 3 · g 45m · s 1.5h — or go to…"
          onClose={hide}
          onNavigate={(path) => void api('app.openMain', { path })}
          onDone={finish}
        />
      )}
    </div>
  );
}
