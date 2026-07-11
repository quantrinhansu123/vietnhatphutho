export type AppToastType = 'success' | 'error';

export type AppToastPayload = {
  id: string;
  message: string;
  type: AppToastType;
};

type Listener = (toast: AppToastPayload) => void;

const listeners = new Set<Listener>();

export function subscribeAppToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Hiện toast toàn app; tự ẩn sau ~3s (do AppToastHost xử lý). */
export function showAppToast(message: string, type: AppToastType = 'success'): void {
  const text = String(message || '').trim();
  if (!text) return;
  const toast: AppToastPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: text,
    type
  };
  listeners.forEach(listener => listener(toast));
}
