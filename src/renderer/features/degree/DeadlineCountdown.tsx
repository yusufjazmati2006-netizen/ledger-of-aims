import { countdownText, urgencyOf, type Urgency } from '@shared/domain/degree/deadlines';
import { formatDate, weekdayShort } from '@shared/domain/time/localDate';
import { cx } from '../../lib/cx';
import { Icon, type IconName } from '../../design/icons';

const STYLE: Record<Urgency, { box: string; text: string; icon: IconName; label: string }> = {
  calm: {
    box: 'border-rule bg-surface',
    text: 'text-ink-muted',
    icon: 'calendar',
    label: 'Plenty of time',
  },
  soon: {
    box: 'border-accent/40 bg-accent-soft',
    text: 'text-accent',
    icon: 'clock',
    label: 'Coming up',
  },
  near: {
    box: 'border-warning/50 bg-warning-soft',
    text: 'text-warning',
    icon: 'clock',
    label: 'This week',
  },
  imminent: {
    box: 'border-critical/60 bg-critical-soft',
    text: 'text-critical',
    icon: 'alert',
    label: 'Imminent',
  },
  overdue: {
    box: 'border-critical bg-critical-soft',
    text: 'text-critical',
    icon: 'alert',
    label: 'Overdue',
  },
};

/**
 * One deadline with escalating urgency. Colour is never the only signal: each tier
 * also has an icon and a label, and the countdown is written out.
 */
export function DeadlineCountdown({
  title,
  subtitle,
  due,
  today,
}: {
  title: string;
  subtitle?: string;
  due: string;
  today: string;
}) {
  const urgency = urgencyOf(today, due);
  const s = STYLE[urgency];
  return (
    <div className={cx('flex flex-col gap-2 rounded-xl border p-4', s.box)} data-urgency={urgency}>
      <div
        className={cx(
          'flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase',
          s.text,
        )}
      >
        <Icon name={s.icon} size={13} />
        {s.label}
      </div>
      <div
        className={cx(
          'text-[26px] leading-none font-semibold',
          urgency === 'calm' ? 'text-ink' : s.text,
        )}
      >
        {countdownText(today, due)}
      </div>
      <div>
        <div className="truncate text-[13.5px] font-medium text-ink">{title}</div>
        <div className="truncate text-[12px] text-ink-muted">
          {subtitle ? `${subtitle} · ` : ''}
          {weekdayShort(due)} {formatDate(due)}
        </div>
      </div>
    </div>
  );
}
