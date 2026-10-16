import { Notification } from 'electron';
import { dueNotifications, type PendingNotification } from '@shared/domain/notifications/schedule';
import type { RepoContext } from '../db/repositories/context';
import { getSettings } from '../db/repositories/settings';
import { gatherNotifyState, recordSent, sentKeys } from './notifyState';

/** At most this many reminders at once; the rest follow on the next minute. */
const PER_TICK = 2;

export interface Notifier {
  /** Checks now; returns what was sent. */
  tick: () => PendingNotification[];
  /** Sends a sample notification immediately (Settings → Send a test). */
  test: () => boolean;
  stop: () => void;
}

/**
 * Checks the reminder rules once a minute and shows native notifications. Clicking a
 * notification opens the relevant screen. Nothing is scheduled with the OS: if the app
 * is not running, no reminders are shown.
 */
export function startNotifier(
  getCtx: () => RepoContext | null,
  open: (path: string) => void,
): Notifier {
  const show = (n: Pick<PendingNotification, 'title' | 'body' | 'path'>): boolean => {
    if (!Notification.isSupported()) return false;
    const note = new Notification({ title: n.title, body: n.body, silent: false });
    note.on('click', () => {
      open(n.path);
    });
    note.show();
    return true;
  };

  const tick = (): PendingNotification[] => {
    const ctx = getCtx();
    if (!ctx) return [];
    const due = dueNotifications(
      gatherNotifyState(ctx),
      getSettings(ctx, 'notifications'),
      sentKeys(ctx),
    ).slice(0, PER_TICK);
    for (const n of due) {
      recordSent(ctx, n);
      show(n);
    }
    return due;
  };

  // Align with the start of each minute so "08:00" means 08:00. End-to-end tests turn
  // the automatic check off and call `tick` themselves, so results are deterministic.
  let interval: NodeJS.Timeout | undefined;
  const first = process.env.LEDGER_NOTIFY_MANUAL
    ? undefined
    : setTimeout(
        () => {
          tick();
          interval = setInterval(tick, 60_000);
        },
        60_000 - (Date.now() % 60_000) + 500,
      );

  return {
    tick,
    test: () =>
      show({
        title: 'Ledger of Aims',
        body: 'Notifications are working. Reminders respect your quiet hours and shifts.',
        path: '/settings',
      }),
    stop: () => {
      clearTimeout(first);
      clearInterval(interval);
    },
  };
}
