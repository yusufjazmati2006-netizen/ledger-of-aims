import { describe, expect, it } from 'vitest';
import { acceleratorFrom } from './accelerator';

const press = (
  code: string,
  mods: Partial<Record<'meta' | 'ctrl' | 'alt' | 'shift', boolean>> = {},
) => ({
  code,
  key: '',
  metaKey: mods.meta ?? false,
  ctrlKey: mods.ctrl ?? false,
  altKey: mods.alt ?? false,
  shiftKey: mods.shift ?? false,
});

describe('acceleratorFrom', () => {
  it('builds Electron accelerators from key presses', () => {
    expect(acceleratorFrom(press('Space', { ctrl: true, shift: true }))).toBe(
      'Control+Shift+Space',
    );
    expect(acceleratorFrom(press('KeyL', { meta: true, alt: true }))).toBe('Command+Alt+L');
    expect(acceleratorFrom(press('Digit1', { ctrl: true }))).toBe('Control+1');
    expect(acceleratorFrom(press('F9'))).toBe('F9');
  });

  it('rejects combinations that would hijack typing', () => {
    expect(acceleratorFrom(press('KeyL'))).toBeNull();
    expect(acceleratorFrom(press('KeyL', { shift: true }))).toBeNull();
    expect(acceleratorFrom(press('ShiftLeft', { shift: true }))).toBeNull();
  });
});
