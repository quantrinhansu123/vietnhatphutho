import { useEffect, useState } from 'react';
import { STORAGE_AUTH_KEY } from './storageKeys';
import { normalizeHrBranches, normalizeHrMachineCodes } from './hr';
import type { AuthUser } from '../../app/authUser';

/**
 * Phạm vi máy của người đang đăng nhập.
 * - `null` = không giới hạn: các ô chọn máy vẫn bình thường, không cố định máy nào.
 * - mảng mã máy = chỉ được chọn các máy đó.
 */

export function normalizeScopeCodes(value: unknown): string[] {
  return normalizeHrMachineCodes(value);
}

/** Máy có thuộc phạm vi không (so theo cả mã và tên, không phân biệt hoa thường). */
export function machineInScope(
  machine: { code?: string; name?: string },
  scopeCodes: string[]
): boolean {
  if (scopeCodes.length === 0) return true;
  const keys = [machine.code, machine.name]
    .map(value => String(value ?? '').trim().toLowerCase())
    .filter(Boolean);
  if (keys.length === 0) return false;
  return scopeCodes.some(scope => {
    const needle = String(scope ?? '').trim().toLowerCase();
    return needle !== '' && keys.includes(needle);
  });
}

/** Lọc danh sách máy theo phạm vi. Không giới hạn = giữ nguyên, không cố định máy nào. */
export function filterMachinesByScope<T extends { code?: string; name?: string }>(
  machines: T[],
  scope: string[] | null
): T[] {
  if (!scope || scope.length === 0) return machines;
  return machines.filter(machine => machineInScope(machine, scope));
}

/**
 * Dựng tập khóa cho phép từ catalog + phạm vi (gồm cả mã và tên, thường hóa).
 * Dùng khi dữ liệu lưu tên máy nhưng phạm vi lưu mã máy (và ngược lại).
 */
export function buildScopeKeys(
  catalog: Array<{ code?: string; name?: string }>,
  scope: string[] | null
): string[] {
  if (!scope || scope.length === 0) return [];
  const keys: string[] = [];
  const push = (value: unknown) => {
    const key = String(value ?? '').trim().toLowerCase();
    if (key && !keys.includes(key)) keys.push(key);
  };
  for (const entry of scope) {
    const needle = String(entry ?? '').trim().toLowerCase();
    if (!needle) continue;
    push(needle);
    const found = catalog.find(
      item =>
        String(item.code ?? '').trim().toLowerCase() === needle ||
        String(item.name ?? '').trim().toLowerCase() === needle
    );
    if (found) {
      push(found.code);
      push(found.name);
    }
  }
  return keys;
}

/** Giá trị máy (mã hoặc tên) có thuộc tập khóa phạm vi không (khớp nới lỏng). */
export function matchesScopeKeys(value: unknown, scopeKeys: string[]): boolean {
  if (scopeKeys.length === 0) return true;
  const key = String(value ?? '').trim().toLowerCase();
  if (!key || key === '-') return false;
  return scopeKeys.some(
    allowed => allowed === key || allowed.includes(key) || key.includes(allowed)
  );
}

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function resolveScopeFromUser(user: AuthUser | null): string[] | null {
  if (!user || user.fullAccess) return null;
  const codes = normalizeScopeCodes(user.machineCodes ?? []);
  return codes.length > 0 ? codes : null;
}

let scopePromise: Promise<string[] | null> | null = null;

/** Tra máy phân công mới nhất của user từ /api/nhan-su (cache theo phiên). */
function fetchFreshScope(): Promise<string[] | null> {
  if (!scopePromise) {
    scopePromise = (async () => {
      const stored = readStoredUser();
      const fallback = resolveScopeFromUser(stored);
      try {
        const res = await fetch('/api/nhan-su?format=groups&scope=all');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !stored) return fallback;
        const members = normalizeHrBranches(data).flatMap(branch =>
          branch.departments.map(department => ({ department, members: department.members }))
        );
        const all = members.flatMap(group => group.members);
        const username = String(stored.username || '').trim().toLowerCase();
        const matched =
          all.find(member => member.id && member.id === stored.id) ??
          (username
            ? all.find(member => String(member.username || '').trim().toLowerCase() === username)
            : undefined) ??
          all.find(member => member.name === stored.name);
        if (!matched || stored.fullAccess) return fallback;
        const codes = normalizeScopeCodes(matched.machineCodes ?? []);
        return codes.length > 0 ? codes : null;
      } catch {
        return fallback;
      }
    })();
  }
  return scopePromise;
}

export function resetMachineScopeCache() {
  scopePromise = null;
}

/**
 * Hook phạm vi máy của người đăng nhập.
 * `scope === null` = tất cả máy; mảng = chỉ các máy đó.
 */
export function useMyMachineScope(): { scope: string[] | null; loaded: boolean } {
  const [scope, setScope] = useState<string[] | null>(() => {
    try {
      return resolveScopeFromUser(readStoredUser());
    } catch {
      return null;
    }
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchFreshScope().then(next => {
      if (!active) return;
      setScope(next);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return { scope, loaded };
}
