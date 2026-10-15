import { useToasts } from '../stores/toasts';
import { cx } from '../lib/cx';
import { Icon } from './icons';

/** Quiet confirmations in the bottom corner, announced politely to screen readers. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-5 bottom-5 z-50 flex w-[340px] flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="animate-fade-in pointer-events-auto flex items-center gap-3 rounded-xl border border-rule bg-surface px-4 py-3 text-[13px] shadow-[0_10px_30px_rgb(0_0_0/0.12)]"
        >
          <span
            className={cx(
              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
              t.tone === 'positive' && 'bg-positive-soft text-positive',
              t.tone === 'critical' && 'bg-critical-soft text-critical',
              t.tone === 'neutral' && 'bg-sunken text-ink-muted',
            )}
          >
            <Icon
              name={t.tone === 'critical' ? 'alert' : t.tone === 'positive' ? 'check' : 'info'}
              size={12}
            />
          </span>
          <span className="min-w-0 flex-1 text-ink">{t.message}</span>
          {t.action ? (
            <button
              type="button"
              className="text-[12.5px] font-semibold text-ink underline-offset-2 hover:underline"
              onClick={() => {
                t.action?.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
