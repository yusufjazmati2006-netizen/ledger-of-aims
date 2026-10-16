/** Renders an FTS snippet, where matches are wrapped in \u0001 … \u0002. */
export function Highlight({ text }: { text: string }) {
  const parts: { text: string; match: boolean }[] = [];
  let rest = text;
  while (rest) {
    const open = rest.indexOf('\u0001');
    const close = open >= 0 ? rest.indexOf('\u0002', open) : -1;
    if (open < 0 || close < 0) {
      parts.push({ text: rest, match: false });
      break;
    }
    if (open > 0) parts.push({ text: rest.slice(0, open), match: false });
    parts.push({ text: rest.slice(open + 1, close), match: true });
    rest = rest.slice(close + 1);
  }
  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded-[3px] bg-accent-soft px-0.5 text-ink">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Every data domain search results may come from. */
export const SEARCH_DOMAINS = [
  'goals',
  'milestones',
  'quran',
  'training',
  'nutrition',
  'photos',
  'degree',
  'game',
  'review',
  'habits',
  'weighIns',
] as const;
