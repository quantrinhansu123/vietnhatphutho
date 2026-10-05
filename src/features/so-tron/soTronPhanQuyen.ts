import { PRIMARY_ADMIN_USERNAME } from '../nhan-su/menuViews';

/** Vai trò sổ trộn. Một người có thể kiêm nhiều vai. */
export type SoTronRole = 'TRUONG_CA' | 'TO_TRON' | 'NV_PX' | 'ADMIN';
export type SoTronResource = 'vat_tu' | 'thanh_pham';
export type SoTronAction = 'view' | 'create' | 'update' | 'delete' | 'lock' | 'unlock';

export type SoTronActor = {
  id: string;
  username: string;
  name: string;
  roles: SoTronRole[];
  /** Ca được gán. Trống = không khóa theo ca. */
  ca: string;
};

export type SoTronSlipGate = {
  ca: string;
  khoa_ca: boolean;
  vat_tu_owner_id: string;
};

export type SoTronDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

const ROLE_ORDER: SoTronRole[] = ['ADMIN', 'TRUONG_CA', 'TO_TRON', 'NV_PX'];

export const VAT_TU_FIELDS = [
  'bang_nvl',
  'bang_ban_giao',
  'coi_tron_mau',
  'tong_nvl',
  'tong_nhap_nvl'
] as const;

export const THANH_PHAM_FIELDS = [
  'bang_san_pham',
  'bang_hang_loi',
  'tong_sp_co_mang',
  'tong_sp_khong_mang',
  'tong_loi_hong'
] as const;

const HEADER_FIELDS = [
  'chi_nhanh',
  'ngay',
  'ma_may',
  'ten_may',
  'ca',
  'nhan_su',
  'nhan_su_chi_tiet',
  'lenh_sx',
  'chi_tieu_phan_tram',
  'ghi_chu'
] as const;

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

function pushRole(roles: SoTronRole[], role: SoTronRole) {
  if (!roles.includes(role)) roles.push(role);
}

/** Suy vai trò từ chức vụ, vị trí gán, hoặc tài khoản quản trị. Không khớp vai nào → mảng rỗng (chỉ bị chặn khi ghi). */
export function resolveSoTronRoles(input: {
  role?: string;
  username?: string;
  fullAccess?: boolean;
  extra?: string[];
}): SoTronRole[] {
  const roles: SoTronRole[] = [];
  const username = String(input.username || '').trim().toLowerCase();
  if (input.fullAccess || username === PRIMARY_ADMIN_USERNAME.toLowerCase()) {
    pushRole(roles, 'ADMIN');
  }
  const blob = fold([input.role, ...(input.extra || [])].filter(Boolean).join(' | '));
  const inWorkshop = /phan\s*xuong\s*san\s*xuat/.test(blob);
  if (/truong\s*ca/.test(blob) || (inWorkshop && /truong\s*phong/.test(blob))) pushRole(roles, 'TRUONG_CA');
  if (/to\s*tron|tho\s*tron/.test(blob) || /(^|[^a-z])tron([^a-z]|$)/.test(blob)) pushRole(roles, 'TO_TRON');
  if (/nhan\s*vien\s*phan\s*xuong|nv[\s_-]*px/.test(blob) || (inWorkshop && /nhan\s*vien/.test(blob))) {
    pushRole(roles, 'NV_PX');
  }
  if (/quan\s*tri|admin|quan\s*doc|(^|[^a-z])it([^a-z]|$)/.test(blob)) pushRole(roles, 'ADMIN');
  return ROLE_ORDER.filter(role => roles.includes(role));
}

function hasRole(actor: SoTronActor, role: SoTronRole) {
  return actor.roles.includes(role);
}

function isMixer(actor: SoTronActor) {
  return hasRole(actor, 'TO_TRON') || hasRole(actor, 'NV_PX') || hasRole(actor, 'ADMIN');
}

/** Tổ trộn và nhân viên phân xưởng không thấy thành phẩm trên sổ. Trưởng ca và quản trị vẫn thấy. */
export function canSeeSoTronThanhPham(roles: readonly string[]): boolean {
  if (roles.includes('ADMIN') || roles.includes('TRUONG_CA')) return true;
  if (roles.includes('TO_TRON') || roles.includes('NV_PX')) return false;
  return true;
}

function isShiftLead(actor: SoTronActor) {
  return hasRole(actor, 'TRUONG_CA') || hasRole(actor, 'ADMIN');
}

export function canDeleteSoTron(roles: readonly string[] | undefined): boolean {
  return Boolean(roles?.includes('ADMIN') || roles?.includes('TRUONG_CA'));
}

/** Mã ca trên sổ trộn (12C1, HC2…). Ca hồ sơ kiểu «Ca Ngày (06:00 - 18:00)» không thuộc hệ này. */
function isProductionShiftCode(value: string) {
  return /^(?:12c|hc)\d+$/i.test(value.trim());
}

function sameCa(actorCa: string, slipCa: string) {
  const left = actorCa.trim().toLowerCase();
  const right = slipCa.trim().toLowerCase();
  if (!left || !right) return true;
  // Trưởng ca / trưởng phòng ghi ca làm việc theo hồ sơ, không theo mã 12C1/HC1 của sổ.
  if (!isProductionShiftCode(left) || !isProductionShiftCode(right)) return true;
  return left === right;
}

function deny(status: 401 | 403, error: string): SoTronDecision {
  return { ok: false, status, error };
}

/**
 * Deny by default.
 * Vật tư: Tổ trộn và NV phân xưởng tạo/sửa phiếu mình tạo, khi chưa chốt.
 * Thành phẩm: Trưởng ca và trưởng phòng phân xưởng tạo/sửa khi chưa chốt.
 * Khóa theo ca chỉ khi cả hai bên là mã ca sản xuất (12C1, HC1…) và khác nhau.
 * Xóa: trưởng ca và ADMIN. Chốt ca: Trưởng ca. Mở khóa: ADMIN và phải có lý do (kiểm tra ở API).
 */
export function assertSoTron(
  actor: SoTronActor | null,
  action: SoTronAction,
  resource: SoTronResource,
  slip?: SoTronSlipGate | null
): SoTronDecision {
  if (!actor || !actor.id) return deny(401, 'Chưa đăng nhập. Hãy đăng nhập lại để ghi sổ trộn.');
  if (actor.roles.length === 0) {
    return deny(403, 'Tài khoản chưa được gán vai trò sổ trộn (Trưởng ca, Tổ trộn, Nhân viên phân xưởng).');
  }

  if (action === 'view') {
    return { ok: true };
  }

  if (action === 'delete') {
    return canDeleteSoTron(actor.roles)
      ? { ok: true }
      : deny(403, 'Chỉ trưởng ca và quản trị được xóa sổ trộn.');
  }

  if (action === 'unlock') {
    return hasRole(actor, 'ADMIN')
      ? { ok: true }
      : deny(403, 'Chỉ quản trị được mở khóa ca đã chốt.');
  }

  if (slip?.khoa_ca) {
    return deny(403, 'Ca đã chốt. Muốn sửa phải mở khóa và nhập lý do.');
  }

  if (action === 'lock') {
    if (slip?.khoa_ca) return deny(403, 'Ca này đã chốt.');
    return isShiftLead(actor) ? { ok: true } : deny(403, 'Chỉ trưởng ca được chốt ca.');
  }

  if (resource === 'vat_tu') {
    if (!isMixer(actor)) return deny(403, 'Trưởng ca chỉ được xem vật tư.');
    if (action === 'update' && !hasRole(actor, 'ADMIN')) {
      const owner = String(slip?.vat_tu_owner_id || '').trim();
      if (owner && owner !== actor.id) {
        return deny(403, 'Chỉ sửa được phiếu vật tư do mình tạo.');
      }
    }
    return action === 'create' || action === 'update' ? { ok: true } : deny(403, 'Không có quyền vật tư.');
  }

  if (!isShiftLead(actor)) return deny(403, 'Tổ trộn và nhân viên phân xưởng không được ghi thành phẩm.');
  if ((action === 'create' || action === 'update') && !hasRole(actor, 'ADMIN')) {
    if (!sameCa(actor.ca, slip?.ca || '')) {
      return deny(403, 'Trưởng ca chỉ sửa thành phẩm trong ca của mình.');
    }
  }
  return action === 'create' || action === 'update' ? { ok: true } : deny(403, 'Không có quyền thành phẩm.');
}

export function normalizeScopes(value: unknown): SoTronResource[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const scopes: SoTronResource[] = [];
  for (const item of raw) {
    const text = String(item || '').trim();
    if ((text === 'vat_tu' || text === 'thanh_pham') && !scopes.includes(text)) scopes.push(text);
  }
  return scopes;
}

function emptyField(key: string, incoming: Record<string, unknown>) {
  const sample = incoming[key];
  return Array.isArray(sample) ? [] : 0;
}

/** Giữ phần phiếu người dùng không được ghi. Phiếu mới thì phần không được ghi để trống. */
export function applySoTronScopes(
  existing: Record<string, unknown> | null,
  incoming: Record<string, unknown>,
  scopes: SoTronResource[]
): Record<string, unknown> {
  const base: Record<string, unknown> = existing ? { ...existing } : { ...incoming };
  const allowVat = scopes.includes('vat_tu');
  const allowTp = scopes.includes('thanh_pham');

  if (!existing) {
    if (!allowVat) {
      for (const key of VAT_TU_FIELDS) base[key] = emptyField(key, incoming);
    }
    if (!allowTp) {
      for (const key of THANH_PHAM_FIELDS) base[key] = emptyField(key, incoming);
    }
  }

  if (allowVat) {
    for (const key of [...VAT_TU_FIELDS, ...HEADER_FIELDS]) {
      if (key in incoming) base[key] = incoming[key];
    }
  }
  if (allowTp) {
    for (const key of THANH_PHAM_FIELDS) {
      if (key in incoming) base[key] = incoming[key];
    }
    if (!allowVat) {
      if ('ghi_chu' in incoming) base.ghi_chu = incoming.ghi_chu;
      if ('chi_tieu_phan_tram' in incoming) base.chi_tieu_phan_tram = incoming.chi_tieu_phan_tram;
    }
  }

  delete base.id;
  delete base.created_at;
  delete base.updated_at;
  return base;
}
