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

/** Lấy chuỗi nguyên nhân lỗi từ Error / API body / string. */
export function resolveErrorMessage(error: unknown, fallback: string): string {
  const fallbackText = String(fallback || 'Không thể lưu. Vui lòng thử lại.').trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error === 'object') {
    const body = error as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    for (const key of ['message', 'error', 'details', 'hint'] as const) {
      const value = String(body[key] ?? '').trim();
      if (value) return value;
    }
  }
  return fallbackText || 'Không thể lưu. Vui lòng thử lại.';
}

/**
 * Luôn hiện nguyên nhân khi hệ thống không lưu được (toast lỗi).
 * Trả về chuỗi đã hiển thị để gán vào banner form.
 */
export function showSaveFailure(
  error: unknown,
  fallback = 'Không thể lưu. Vui lòng thử lại.'
): string {
  const text = resolveErrorMessage(error, fallback);
  showAppToast(text, 'error');
  return text;
}

/** Đọc lỗi từ Response + JSON body (kể cả khi thiếu `error`). */
export function readApiErrorMessage(
  res: Response,
  data: unknown,
  fallback: string
): string {
  if (data && typeof data === 'object') {
    const body = data as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    for (const key of ['error', 'message', 'details', 'hint'] as const) {
      const value = String(body[key] ?? '').trim();
      if (value) return value;
    }
  }
  const statusText = String(res.statusText || '').trim();
  if (statusText) return `${fallback} (HTTP ${res.status}: ${statusText})`;
  return `${fallback} (HTTP ${res.status})`;
}
