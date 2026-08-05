import { buildPermissionKey } from './permissionKeys';

export type StaffAssignablePosition = {
  department: string;
  position: string;
  permissionKey: string;
};

export type StaffAssignmentSettingLike = {
  id: string;
  code: string;
  name: string;
  loaiCaiDat: string;
  group: string;
  note: string;
};

export type StaffRoleAssignment = {
  id: string;
  code: string;
  name: string;
  maNhanSu: string;
  tenHienThi: string;
  positions: StaffAssignablePosition[];
  note: string;
};

function looksLikeStaffAssignment(setting: StaffAssignmentSettingLike) {
  const groupText = `${setting.group || ''} ${setting.loaiCaiDat || ''}`.toLowerCase();
  return (
    setting.code.startsWith('STAFF_ASSIGN_') ||
    groupText.includes('gán quyền nhân sự') ||
    groupText.includes('gan quyen nhan su')
  );
}

export function buildStaffAssignmentCode(maNhanSu: string) {
  const slug = String(maNhanSu || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return `STAFF_ASSIGN_${slug || 'UNKNOWN'}`;
}

export function normalizeAssignablePositions(raw: unknown): StaffAssignablePosition[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: StaffAssignablePosition[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const department = String(row.department ?? row.phong_ban ?? '').trim();
    const position = String(row.position ?? row.vi_tri ?? row.cong_viec ?? '').trim();
    if (!department || !position) continue;
    const permissionKey =
      String(row.permissionKey ?? row.permission_key ?? '').trim() ||
      buildPermissionKey(department, position);
    if (seen.has(permissionKey)) continue;
    seen.add(permissionKey);
    result.push({ department, position, permissionKey });
  }

  return result.sort((a, b) =>
    `${a.department} ${a.position}`.localeCompare(`${b.department} ${b.position}`, 'vi')
  );
}

export function parseStaffRoleAssignments(
  settings: StaffAssignmentSettingLike[]
): StaffRoleAssignment[] {
  return settings
    .map((setting): StaffRoleAssignment | null => {
      if (!looksLikeStaffAssignment(setting)) return null;

      let parsedNote: Record<string, unknown> = {};
      try {
        parsedNote = setting.note ? (JSON.parse(setting.note) as Record<string, unknown>) : {};
      } catch {
        parsedNote = {};
      }

      const maNhanSu = String(parsedNote.maNhanSu ?? parsedNote.ma_nhan_su ?? '').trim();
      if (!maNhanSu) return null;

      return {
        id: setting.id,
        code: setting.code,
        name: setting.name,
        maNhanSu,
        tenHienThi: String(parsedNote.tenHienThi ?? parsedNote.ten_hien_thi ?? '').trim(),
        positions: normalizeAssignablePositions(parsedNote.positions ?? parsedNote.vi_tri),
        note: setting.note || ''
      };
    })
    .filter((item): item is StaffRoleAssignment => Boolean(item))
    .sort((a, b) => a.maNhanSu.localeCompare(b.maNhanSu, 'vi'));
}

export function isSpecialSettingsRow(setting: {
  group: string;
  loaiCaiDat: string;
  code?: string;
}) {
  const text = `${setting.group} ${setting.loaiCaiDat}`.toLowerCase();
  const code = String(setting.code || '');
  return (
    text.includes('phân quyền') ||
    text.includes('phan quyen') ||
    text.includes('gán quyền nhân sự') ||
    text.includes('gan quyen nhan su') ||
    code.startsWith('PERM_KEY_') ||
    code.startsWith('STAFF_ASSIGN_')
  );
}
