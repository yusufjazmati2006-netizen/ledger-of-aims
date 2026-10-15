import { create } from 'zustand';
import type { AppInfo, Bootstrap, RecoveryInfo } from '@shared/ipc/contract';
import type { SettingsMap, SettingsNamespace } from '@shared/schemas/settings';
import { api } from '../lib/api';

interface AppState {
  status: 'loading' | 'ready' | 'recovery' | 'error';
  error: string | null;
  today: string;
  /** "Now" according to the main process clock (which tests may pin). */
  nowIso: string;
  /** Main-process clock minus the renderer's, so live displays follow the same clock. */
  clockOffsetMs: number;
  info: AppInfo | null;
  settings: SettingsMap | null;
  recovery: RecoveryInfo | null;
  bootstrap: () => Promise<void>;
  refreshToday: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  updateSettings: <K extends SettingsNamespace>(
    namespace: K,
    patch: Partial<SettingsMap[K]>,
  ) => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  status: 'loading',
  error: null,
  today: '',
  nowIso: '',
  clockOffsetMs: 0,
  info: null,
  settings: null,
  recovery: null,

  bootstrap: async () => {
    try {
      const boot: Bootstrap = await api('app.bootstrap');
      if (boot.mode === 'recovery') {
        set({ status: 'recovery', info: boot.info, recovery: boot.recovery });
        return;
      }
      set({
        status: 'ready',
        today: boot.today,
        nowIso: boot.nowIso,
        clockOffsetMs: offsetOf(boot.nowIso),
        info: boot.info,
        settings: boot.settings,
        recovery: null,
      });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  },

  refreshToday: async () => {
    const { today, nowIso } = await api('app.today');
    const clockOffsetMs = offsetOf(nowIso);
    set(today !== get().today ? { today, nowIso, clockOffsetMs } : { nowIso, clockOffsetMs });
  },

  refreshSettings: async () => {
    set({ settings: await api('settings.get') });
  },

  updateSettings: async (namespace, patch) => {
    const previous = get().settings;
    if (previous) {
      // Optimistic: settings toggles should feel instantaneous.
      set({ settings: { ...previous, [namespace]: { ...previous[namespace], ...patch } } });
    }
    try {
      const settings = await api('settings.update', { namespace, patch });
      set({ settings });
    } catch (error) {
      if (previous) set({ settings: previous });
      throw error;
    }
  },
}));

function offsetOf(nowIso: string): number {
  return new Date(nowIso).getTime() - Date.now();
}

export function useSettings(): SettingsMap {
  const settings = useApp((s) => s.settings);
  if (!settings) throw new Error('Settings accessed before bootstrap.');
  return settings;
}

export function useToday(): string {
  return useApp((s) => s.today);
}

/** Minutes after local midnight right now, by the main-process clock. */
export function useNowMinute(): number {
  const nowIso = useApp((s) => s.nowIso);
  const d = nowIso ? new Date(nowIso) : new Date();
  return d.getHours() * 60 + d.getMinutes();
}
