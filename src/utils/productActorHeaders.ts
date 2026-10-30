import { STORAGE_AUTH_KEY } from '../features/_shared/storageKeys';

/** Header gửi kèm API san_pham để server ghi audit log. */
export function productActorHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_AUTH_KEY);
    if (!raw) return {};
    const user = JSON.parse(raw) as {
      id?: string;
      username?: string;
      name?: string;
    };
    const headers: Record<string, string> = {};
    if (user.id) headers['X-Actor-Id'] = String(user.id);
    if (user.username) headers['X-Actor-Username'] = String(user.username);
    if (user.name) headers['X-Actor-Name'] = String(user.name);
    return headers;
  } catch {
    return {};
  }
}

export function productApiHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...productActorHeaders(),
    ...extra
  };
}
