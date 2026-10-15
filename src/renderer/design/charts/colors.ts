import { useMemo } from 'react';
import { useColorScheme } from '../../lib/useMedia';

/**
 * Recharts writes colours into SVG presentation attributes, where CSS variables do
 * not resolve. This reads the resolved token values and re-reads them when the
 * colour scheme changes, so charts follow light/dark like everything else.
 */
export function useTokenColors<T extends string>(names: readonly T[]): Record<T, string> {
  const scheme = useColorScheme();
  const key = names.join('|');
  return useMemo(() => {
    // `scheme` is a dependency only: a theme change must re-read the tokens.
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      key.split('|').map((n) => [n, style.getPropertyValue(`--${n}`).trim() || '#888888']),
    ) as Record<T, string>;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [key, scheme]);
}
