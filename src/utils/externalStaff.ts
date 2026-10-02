/** Mã lưu trong `phan_cong_nhan_su_chi_tiet.ma_nhan_su` khi người làm không có trong danh sách nhân viên. */
export const EXTERNAL_STAFF_PREFIX = '__THUE_NGOAI__';

export function isExternalStaffCode(code: unknown): boolean {
  return String(code ?? '').trim().startsWith(EXTERNAL_STAFF_PREFIX);
}

export function externalStaffDisplayName(code: unknown): string {
  return String(code ?? '').trim().slice(EXTERNAL_STAFF_PREFIX.length).trim();
}

export function encodeExternalStaffCode(name: string): string {
  return EXTERNAL_STAFF_PREFIX + String(name || '').trim().replace(/\s+/g, ' ');
}

/** Tên hiển thị: thuê ngoài lấy phần tên đã nhập; nhân viên lấy tên đã tra, không có thì giữ mã. */
export function resolveScheduleStaffName(
  code: unknown,
  staffMap?: { get: (key: string) => string | undefined }
): string {
  const raw = String(code ?? '').trim();
  if (!raw) return '';
  if (isExternalStaffCode(raw)) return externalStaffDisplayName(raw) || 'Thuê ngoài';
  return staffMap?.get(raw) || raw;
}
