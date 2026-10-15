import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './icons';

export function Card({
  className,
  children,
  as: Tag = 'section',
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: 'section' | 'article' | 'div' | 'li' }) {
  return (
    <Tag
      className={cx(
        'rounded-xl border border-rule bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.03)]',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  goal,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  goal?: string;
}) {
  return (
    <header className="mb-8 flex items-end justify-between gap-6" data-goal={goal}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2 !text-accent">{eyebrow}</p> : null}
        <h1 className="font-serif text-[34px] leading-[1.1] font-semibold tracking-[-0.015em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[62ch] text-[14px] text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({
  children,
  action,
  id,
}: {
  children: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-serif text-[19px] font-semibold text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <div className="eyebrow">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-[24px] leading-none font-semibold tracking-[-0.01em] text-ink">
          {value}
        </span>
        {unit ? <span className="text-[13px] text-ink-muted">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-[12.5px] text-ink-muted">{hint}</div> : null}
    </div>
  );
}

export type PillTone = 'neutral' | 'positive' | 'warning' | 'critical' | 'accent';

const pillTones: Record<PillTone, string> = {
  neutral: 'bg-sunken text-ink-muted',
  positive: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  critical: 'bg-critical-soft text-critical',
  accent: 'bg-accent-soft text-accent',
};

export function Pill({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: PillTone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap',
        pillTones[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-rule-strong bg-surface px-1 font-sans text-[11px] text-ink-muted">
      {children}
    </kbd>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-start gap-2 rounded-xl border border-dashed border-rule-strong px-6 py-6',
        className,
      )}
    >
      {icon ? (
        <span className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon name={icon} size={18} />
        </span>
      ) : null}
      <h3 className="font-serif text-[17px] font-semibold text-ink">{title}</h3>
      {children ? (
        <div className="max-w-[60ch] text-[13.5px] text-ink-muted">{children}</div>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Note({
  children,
  icon = 'info',
  tone = 'neutral',
}: {
  children: ReactNode;
  icon?: IconName;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <p
      className={cx(
        'flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px]',
        tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-sunken text-ink-muted',
      )}
    >
      <Icon name={icon} size={14} className="mt-[2px] shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
