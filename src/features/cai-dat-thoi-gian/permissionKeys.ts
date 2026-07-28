import {
  normalizeStaffViewPermissions,
  type StaffViewPermissions
} from '../nhan-su/menuViews';

export type PermissionSettingLike = {
  id: string;
  code: string;
  name: string;
  loaiCaiDat: string;
  group: string;
  note: string;
};

export type PermissionKeySetting = {
  id: string;
  code: string;
  name: string;
  department: string;
  position: string;
  permissionKey: string;
  viewPermissions: StaffViewPermissions;
  note: string;
};

function slugKeyPart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildPermissionKey(department: string, position: string) {
  const dept = slugKeyPart(department || 'khong_phong_ban');
  const pos = slugKeyPart(position || 'khong_vi_tri');
  return `${dept}__${pos}`.toUpperCase();
}

export function parsePermissionSettings(settings: PermissionSettingLike[]): PermissionKeySetting[] {
  return settings
    .map((setting): PermissionKeySetting | null => {
      const groupText = `${setting.group || ''} ${setting.loaiCaiDat || ''}`.toLowerCase();
      const looksLikePermission =
        groupText.includes('phân quyền') ||
        groupText.includes('phan quyen') ||
        setting.code.startsWith('PERM_KEY_');
      if (!looksLikePermission) return null;

      let parsedNote: Record<string, unknown> = {};
      try {
        parsedNote = setting.note ? (JSON.parse(setting.note) as Record<string, unknown>) : {};
      } catch {
        parsedNote = {};
      }

      const department = String(parsedNote.department ?? '').trim();
      const position = String(parsedNote.position ?? '').trim();
      const permissionKey =
        String(parsedNote.permissionKey ?? '').trim() || buildPermissionKey(department, position);
      if (!department || !position) return null;

      return {
        id: setting.id,
        code: setting.code,
        name: setting.name,
        department,
        position,
        permissionKey,
        viewPermissions: normalizeStaffViewPermissions(parsedNote.viewPermissions),
        note: setting.note || ''
      };
    })
    .filter((item): item is PermissionKeySetting => Boolean(item));
}
