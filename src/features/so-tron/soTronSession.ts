import {
  assertSoTron,
  resolveSoTronRoles,
  type SoTronActor,
  type SoTronResource,
  type SoTronRole,
  type SoTronSlipGate
} from './soTronPhanQuyen';

const TOKEN_KEY = 'vietnhat.soTronToken';

export function saveSoTronToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearSoTronToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function readSoTronToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function soTronAuthHeaders(): Record<string, string> {
  const token = readSoTronToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function decodePayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Quản trị viên đăng nhập app được sửa mọi phần sổ trộn, kể cả khi JWT sổ trộn chưa kịp có vai ADMIN. */
export function actorForSoTron(authUser?: {
  id?: string;
  name?: string;
  username?: string;
  role?: string;
  fullAccess?: boolean;
} | null): SoTronActor | null {
  const tokenActor = readSoTronActor();
  const isAdmin = resolveSoTronRoles({
    role: authUser?.role,
    username: authUser?.username,
    fullAccess: authUser?.fullAccess
  }).includes('ADMIN');
  if (!isAdmin) return tokenActor;
  const roles: SoTronRole[] = [];
  for (const role of [...(tokenActor?.roles || []), 'ADMIN' as const]) {
    if (!roles.includes(role)) roles.push(role);
  }
  return {
    id: tokenActor?.id || authUser?.id || 'admin',
    username: tokenActor?.username || authUser?.username || '',
    name: tokenActor?.name || authUser?.name || 'Quản trị viên',
    roles,
    ca: ''
  };
}

export function readSoTronActor(): SoTronActor | null {
  const payload = decodePayload(readSoTronToken());
  if (!payload) return null;
  const exp = Number(payload.exp);
  const graceMs = 30 * 24 * 60 * 60 * 1000;
  if (!payload.sub || !Number.isFinite(exp) || exp * 1000 + graceMs < Date.now()) return null;
  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter(
        (role): role is SoTronRole =>
          role === 'ADMIN' || role === 'TRUONG_CA' || role === 'TO_TRON' || role === 'NV_PX'
      )
    : [];
  return {
    id: String(payload.sub),
    username: String(payload.username || ''),
    name: String(payload.name || ''),
    roles,
    ca: String(payload.ca || '')
  };
}

export function soTronScopesFor(
  actor: SoTronActor | null,
  action: 'create' | 'update',
  slip: SoTronSlipGate | null
): SoTronResource[] {
  if (!actor) return [];
  return (['vat_tu', 'thanh_pham'] as const).filter(
    resource => assertSoTron(actor, action, resource, slip).ok
  );
}
