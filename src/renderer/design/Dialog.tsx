import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { IconButton } from './Button';

/**
 * A modal built on the native <dialog> element, which provides focus trapping,
 * Escape-to-close and an inert background for free.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
  goal,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  goal?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-goal={goal}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        'm-auto max-h-[85vh] rounded-2xl border border-rule bg-surface p-0 text-ink shadow-[0_24px_60px_rgb(0_0_0/0.18)] backdrop:bg-scrim',
        open && 'animate-scale-in',
      )}
      style={{ width }}
      aria-labelledby="dialog-title"
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
            <div>
              <h2 id="dialog-title" className="font-serif text-[20px] font-semibold">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-[13px] text-ink-muted">{description}</p>
              ) : null}
            </div>
            <IconButton icon="close" label="Close" onClick={onClose} />
          </div>
          <div className="overflow-y-auto px-6 pb-5">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-rule px-6 py-3.5">{footer}</div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
