import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from '../../stores/toasts';
import { Palette } from './Palette';

/**
 * ⌘K in the main window: an overlay palette for quick logs and navigation. Opened by
 * the Go menu's accelerator (via the main process) or the key itself.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(
    () =>
      window.ledger.on('command', ({ id }) => {
        if (id === 'palette') setOpen(true);
      }),
    [],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = window.ledger.platform === 'darwin' ? e.metaKey : e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;
  const close = () => setOpen(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-scrim pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="animate-scale-in flex max-h-[62vh] w-[620px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-rule bg-surface shadow-[0_24px_60px_rgb(0_0_0/0.22)]"
      >
        <Palette
          onClose={close}
          onNavigate={(path) => {
            close();
            void navigate(path);
          }}
          onDone={(outcome) => {
            close();
            toast.success(outcome.message);
            if (outcome.open) void navigate(outcome.open);
          }}
        />
      </div>
    </div>
  );
}
