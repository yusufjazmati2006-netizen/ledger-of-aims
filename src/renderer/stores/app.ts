import { create } from 'zustand';
import type { AppInfo, Bootstrap, RecoveryInfo } from '@shared/ipc/contract';
import type { SettingsMap, SettingsNamespace } from '@shared/schemas/settings';
import { api } from '../lib/api';

interface AppState {
  status: 'loading' | 'ready' | 'recovery' | 'error';
  error: string | null;
  today: string;
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
        info: boot.info,
        settings: boot.settings,
        recovery: null,
      });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  },

  refreshToday: async () => {
    const { today } = await api('app.today');
    if (today !== get().today) set({ today });
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

export function useSettings(): SettingsMap {
  const settings = useApp((s) => s.settings);
  if (!settings) throw new Error('Settings accessed before bootstrap.');
  return settings;
}

export function useToday(): string {
  return useApp((s) => s.today);
}
