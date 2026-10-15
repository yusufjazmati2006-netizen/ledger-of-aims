import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

/**
 * A circular progress ring. `value` is 0–1. The ring is labelled for assistive
 * technology via `label`, and draws in the surrounding goal accent by default.
 */
export function Ring({
  value,
  size = 56,
  stroke = 5,
  label,
  children,
  color = 'var(--accent)',
  track = 'var(--rule)',
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  children?: ReactNode;
  color?: string;
  track?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={cx('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 600ms var(--ease-out-soft)' }}
          opacity={clamped === 0 ? 0 : 1}
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      ) : null}
    </div>
  );
}

/** A thin horizontal meter, optionally with a target marker. */
export function Meter({
  value,
  target,
  label,
  className,
  color = 'var(--accent)',
}: {
  value: number;
  target?: number;
  label: string;
  className?: string;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cx('relative h-1.5 w-full rounded-full bg-rule', className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${clamped * 100}%`,
          background: color,
          transition: 'width 600ms var(--ease-out-soft)',
        }}
      />
      {target !== undefined ? (
        <div
          className="absolute -top-1 -bottom-1 w-[2px] rounded bg-ink"
          style={{ left: `calc(${Math.max(0, Math.min(1, target)) * 100}% - 1px)` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
