export interface KeyLike {
  code: string;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const NAMED: Record<string, string> = {
  Space: 'Space',
  Enter: 'Return',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
};

/**
 * An Electron accelerator ("Control+Shift+Space") from a key press, or null while only
 * modifiers are held or when the combination is unusable as a global shortcut (a plain
 * letter would hijack typing everywhere, so a modifier is required except for F-keys).
 */
export function acceleratorFrom(e: KeyLike): string | null {
  let key: string | undefined;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (/^F\d{1,2}$/.test(e.code)) key = e.code;
  else key = NAMED[e.code];
  if (!key) return null;
  const mods = [
    e.metaKey ? 'Command' : null,
    e.ctrlKey ? 'Control' : null,
    e.altKey ? 'Alt' : null,
    e.shiftKey ? 'Shift' : null,
  ].filter((m): m is string => m !== null);
  const isFunctionKey = /^F\d/.test(key);
  if (mods.length === 0 && !isFunctionKey) return null;
  // Shift alone with a printable key would just type a capital or symbol.
  if (mods.length === 1 && mods[0] === 'Shift' && !isFunctionKey) return null;
  return [...mods, key].join('+');
}
