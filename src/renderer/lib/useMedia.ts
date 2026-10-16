import { useSyncExternalStore } from 'react';
import { useApp } from '../stores/app';

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
    };
  };
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(subscribeMedia(query), () => window.matchMedia(query).matches);
}

/** True when either macOS or the app's own setting asks for reduced motion. */
export function useReducedMotion(): boolean {
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  const setting = useApp((s) => s.settings?.general.reduceMotion ?? false);
  return system || setting;
}

/** Changes whenever the effective colour scheme flips, so colour reads re-run. */
export function useColorScheme(): 'light' | 'dark' {
  const system = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useApp((s) => s.settings?.general.theme ?? 'system');
  if (theme !== 'system') return theme;
  return system ? 'dark' : 'light';
}
