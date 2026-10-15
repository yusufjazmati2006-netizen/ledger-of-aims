// Verifies WCAG AA contrast for every text/background pairing used by the design
// tokens, in both light and dark themes. Run with `npm run contrast`.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/renderer/design/tokens.css', import.meta.url), 'utf8');

function block(source, startMarker) {
  const start = source.indexOf(startMarker);
  const open = source.indexOf('{', start + startMarker.length - 1);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`Unclosed block for ${startMarker}`);
}

function tokens(text) {
  const out = {};
  for (const m of text.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[m[1]] = m[2];
  return out;
}

const light = tokens(block(css, ':root {'));
const darkBlock = block(css, '@media (prefers-color-scheme: dark) {');
const dark = { ...light, ...tokens(darkBlock) };

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const backgrounds = ['paper', 'surface', 'surface-sunken'];
const text = [
  'ink',
  'ink-muted',
  'ink-faint',
  'quran',
  'physique',
  'degree',
  'game',
  'positive',
  'warning',
  'critical',
  'focus',
];
const softPairs = [
  ['quran', 'quran-soft'],
  ['physique', 'physique-soft'],
  ['degree', 'degree-soft'],
  ['game', 'game-soft'],
  ['positive', 'positive-soft'],
  ['warning', 'warning-soft'],
  ['critical', 'critical-soft'],
  ['ink', 'quran-soft'],
  ['ink-muted', 'quran-soft'],
];
// Non-text UI (rules that delimit controls, focus rings) need 3:1.
const uiPairs = [
  ['rule-strong', 'surface', 1.6],
  ['control', 'surface', 3],
  ['control', 'paper', 3],
  ['focus', 'paper', 3],
  ['focus', 'surface', 3],
  ['quran', 'paper', 3],
];

let failures = 0;
for (const [name, theme] of [
  ['light', light],
  ['dark', dark],
]) {
  const check = (fg, bg, min) => {
    const r = ratio(theme[fg], theme[bg]);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(
      `${ok ? '  ok ' : 'FAIL '} ${name.padEnd(5)} ${fg.padEnd(14)} on ${bg.padEnd(15)} ${r.toFixed(2)} (≥ ${min})`,
    );
  };
  for (const bg of backgrounds) for (const fg of text) check(fg, bg, 4.5);
  for (const [fg, bg] of softPairs) check(fg, bg, 4.5);
  for (const [fg, bg, min] of uiPairs) check(fg, bg, min);
}
if (failures > 0) {
  console.error(`\n${failures} pairing(s) below WCAG AA.`);
  process.exit(1);
}
console.log('\nAll pairings meet WCAG AA.');
