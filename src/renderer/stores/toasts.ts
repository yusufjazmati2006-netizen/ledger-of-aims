import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'neutral' | 'positive' | 'critical';
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast, durationMs = 4500) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-2), { ...toast, id }] });
    setTimeout(() => {
      get().dismiss(id);
    }, durationMs);
  },
  dismiss: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  info: (message: string, action?: Toast['action']) => {
    useToasts.getState().push({ message, tone: 'neutral', action });
  },
  success: (message: string, action?: Toast['action']) => {
    useToasts.getState().push({ message, tone: 'positive', action });
  },
  error: (message: string) => {
    useToasts.getState().push({ message, tone: 'critical' }, 7000);
  },
};
