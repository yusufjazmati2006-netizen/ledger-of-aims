import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { GRAMMAR_HELP } from '@shared/domain/quicklog/parse';
import { cx } from '../../lib/cx';
import { ApiError } from '../../lib/api';
import { Icon, type IconName } from '../../design/icons';
import { Kbd } from '../../design/Card';
import { PALETTE_ENTRIES, searchEntries } from './entries';
import { useQuickLog, type QuickOutcome } from './useQuickLog';

interface Row {
  id: string;
  label: string;
  detail?: string;
  icon: IconName;
  group: string;
  disabled?: boolean;
  action: () => void;
}

const SUGGESTED = ['/', '/planner', '/review', '/quran/revision', '/game/time'];

/**
 * A command palette: type a quick-log command (w 72.4, p 3, g 45m…) to log it with
 * Enter, or type words to jump to a screen. Arrow keys move, Escape closes. Used for
 * ⌘K in the main window and for the global quick-log window.
 */
export function Palette({
  onClose,
  onNavigate,
  onDone,
  resetSignal = 0,
  placeholder = 'Log something, or go to…',
}: {
  onClose: () => void;
  onNavigate: (path: string) => void;
  onDone: (outcome: QuickOutcome) => void;
  /** Changing this clears the input (the quick-log window reuses one palette). */
  resetSignal?: number;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastReset, setLastReset] = useState(resetSignal);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const quick = useQuickLog(text);

  if (resetSignal !== lastReset) {
    setLastReset(resetSignal);
    setText('');
    setActive(0);
    setError(null);
  }
  useEffect(() => {
    input.current?.focus();
  }, [resetSignal]);

  const type = (value: string) => {
    setText(value);
    setActive(0);
    setError(null);
  };

  const execute = async () => {
    setBusy(true);
    try {
      const outcome = await quick.run();
      setText('');
      onDone(outcome);
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error ? err.message : 'That did not work.',
      );
    } finally {
      setBusy(false);
    }
  };

  const rows: Row[] = [];
  if (quick.parsed.status === 'command' && quick.preview) {
    const { preview } = quick;
    rows.push({
      id: 'command',
      label: preview.label,
      detail: preview.blocked,
      icon: 'bolt',
      group: 'Quick log',
      disabled: Boolean(preview.blocked) || busy,
      action: () => void execute(),
    });
  } else if (quick.parsed.status === 'incomplete') {
    rows.push({
      id: 'hint',
      label: quick.parsed.hint,
      icon: 'info',
      group: 'Quick log',
      disabled: true,
      action: () => undefined,
    });
  }
  const matches = text.trim()
    ? searchEntries(text)
    : PALETTE_ENTRIES.filter((e) => e.path && SUGGESTED.includes(e.path));
  if (quick.parsed.status !== 'command') {
    for (const e of matches.slice(0, 8)) {
      rows.push({
        id: e.id,
        label: e.label,
        icon: e.icon,
        group: e.group,
        action: () => {
          if (e.path) onNavigate(e.path);
          else if (e.insert !== undefined) type(e.insert);
        },
      });
    }
  }
  const selectable = rows.map((r, i) => (r.disabled ? -1 : i)).filter((i) => i >= 0);
  const current = selectable.includes(active) ? active : (selectable[0] ?? -1);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (text) type('');
      else onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (selectable.length === 0) return;
      const pos = selectable.indexOf(current);
      const next = e.key === 'ArrowDown' ? pos + 1 : pos - 1;
      setActive(selectable[(next + selectable.length) % selectable.length] ?? 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      rows[current]?.action();
    }
  };

  let lastGroup = '';
  return (
    <div className="flex max-h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-rule px-4">
        <Icon name="search" className="shrink-0 text-ink-faint" />
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={current >= 0 ? `${listId}-${current}` : undefined}
          aria-autocomplete="list"
          aria-label="Command"
          spellCheck={false}
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onChange={(e) => type(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint"
        />
        <Kbd>esc</Kbd>
      </div>
      {error ? (
        <p
          role="alert"
          className="border-b border-rule bg-critical-soft px-4 py-2 text-[12.5px] text-critical"
        >
          {error}
        </p>
      ) : null}
      <ul
        id={listId}
        role="listbox"
        aria-label="Results"
        className="min-h-0 flex-1 overflow-y-auto py-1.5"
      >
        {rows.map((row, i) => {
          const heading = row.group !== lastGroup ? row.group : null;
          lastGroup = row.group;
          return (
            <li key={row.id} role="presentation">
              {heading ? (
                <div className="eyebrow px-4 pt-2 pb-1" aria-hidden="true">
                  {heading}
                </div>
              ) : null}
              <div
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === current}
                aria-disabled={row.disabled || undefined}
                // Keep focus in the input when choosing with the mouse.
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onMouseMove={() => {
                  if (!row.disabled && active !== i) setActive(i);
                }}
                onClick={() => {
                  if (!row.disabled) row.action();
                }}
                className={cx(
                  'mx-1.5 flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px]',
                  i === current ? 'bg-accent-soft text-ink' : 'text-ink',
                  row.disabled && 'text-ink-muted',
                )}
              >
                <Icon name={row.icon} size={16} className="shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                {row.detail ? (
                  <span className="shrink-0 text-[12px] text-warning">{row.detail}</span>
                ) : i === current ? (
                  <Kbd>↵</Kbd>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {!text.trim() ? (
        <div className="border-t border-rule px-4 py-2.5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] text-ink-muted sm:grid-cols-3">
            {GRAMMAR_HELP.map((g) => (
              <button
                key={g.example}
                type="button"
                className="truncate text-left hover:text-ink"
                onClick={() => {
                  type(`${g.example.split(' ')[0] ?? ''} `);
                  input.current?.focus();
                }}
              >
                <span className="font-mono text-ink">{g.example}</span> {g.description}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
