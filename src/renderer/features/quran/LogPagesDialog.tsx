import { useState } from 'react';
import { pageRangeLabel } from '@shared/domain/quran/mushaf';
import { Dialog } from '../../design/Dialog';
import { Button, IconButton } from '../../design/Button';
import { useQuran } from './useQuran';
import { learnNext } from './actions';

/** Logs today's newly learned pages in two keystrokes: a count and Enter. */
export function LogPagesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const quran = useQuran();
  const [count, setCount] = useState(1);
  const preview = quran.nextPages.slice(0, count);
  const juzOf = (p: number) => quran.layout.juzOfPage[p] ?? 0;
  const juzList = [...new Set(preview.map(juzOf))];

  const submit = async () => {
    await learnNext(count);
    onClose();
    setCount(1);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      goal="quran"
      title="Log new pages"
      description="Pages are taken in your memorisation order. To log specific pages, select them in the Mushaf."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" disabled={preview.length === 0} onClick={() => void submit()}>
            Log {count} page{count === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-4"
      >
        <div className="flex items-center gap-1 rounded-lg border border-control p-1">
          <IconButton
            icon="minus"
            label="Fewer pages"
            size="sm"
            disabled={count <= 1}
            onClick={() => setCount((c) => Math.max(1, c - 1))}
          />
          <input
            aria-label="Pages learned today"
            inputMode="numeric"
            autoFocus
            className="tabular w-10 bg-transparent text-center text-[18px] font-semibold text-ink outline-none"
            value={count}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\D/g, ''));
              setCount(Math.max(1, Math.min(40, Number.isFinite(n) && n > 0 ? n : 1)));
            }}
          />
          <IconButton
            icon="plus"
            label="More pages"
            size="sm"
            disabled={count >= 40}
            onClick={() => setCount((c) => Math.min(40, c + 1))}
          />
        </div>
        <div className="text-[13.5px]">
          <div className="font-medium text-ink">
            {preview.length > 0 ? pageRangeLabel(preview) : 'All pages learned'}
          </div>
          <div className="text-ink-muted">
            {juzList.length > 0 ? `Juz ${juzList.join(', ')} · learned today` : ''}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
