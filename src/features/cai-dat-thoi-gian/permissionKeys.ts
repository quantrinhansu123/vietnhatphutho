import {
  mergeStaffViewPermissions,
  normalizeStaffViewPermissions,
  type StaffViewPermissions
} from '../nhan-su/menuViews';
import type { StaffAssignablePosition } from './staffAssignments';

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
  editPermissions: StaffViewPermissions;
  deletePermissions: StaffViewPermissions;
  note: string;
};

function slugKeyPart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
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
        editPermissions: normalizeStaffViewPermissions(
          parsedNote.editPermissions ?? parsedNote.quyen_sua
        ),
        deletePermissions: normalizeStaffViewPermissions(
          parsedNote.deletePermissions ?? parsedNote.quyen_xoa
        ),
        note: setting.note || ''
      };
    })
    .filter((item): item is PermissionKeySetting => Boolean(item));
}

function findPermissionSettingByKey(
  settings: PermissionKeySetting[],
  permissionKey: string
): PermissionKeySetting | undefined {
  const key = permissionKey.trim().toUpperCase();
  if (!key) return undefined;
  return settings.find(item => item.permissionKey.trim().toUpperCase() === key);
}

/**
 * Quyền hiệu lực khi đăng nhập:
 * 1) Ưu tiên các vị trí trong `nhan_su.vi_tri_gan`
 * 2) Không có → phòng ban + chức vụ HR
 * 3) Không khớp ma trận Phân quyền → `quyen_xem` trên hồ sơ (chỉ cột Xem)
 */
export function resolveLoginPermissions(input: {
  permissionSettings: PermissionKeySetting[];
  assignedPositions?: StaffAssignablePosition[];
  departmentName: string;
  hrRoleOrPosition: string;
  memberViewPermissions?: StaffViewPermissions;
}): {
  viewPermissions: StaffViewPermissions;
  editPermissions: StaffViewPermissions;
  deletePermissions: StaffViewPermissions;
} {
  const {
    permissionSettings,
    assignedPositions = [],
    departmentName,
    hrRoleOrPosition,
    memberViewPermissions = []
  } = input;

  const keys: string[] = [];
  for (const position of assignedPositions) {
    const key = String(position.permissionKey || '').trim();
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) {
    keys.push(buildPermissionKey(departmentName, hrRoleOrPosition));
  }

  const matched = keys
    .map(key => findPermissionSettingByKey(permissionSettings, key))
    .filter((item): item is PermissionKeySetting => Boolean(item));

  if (matched.length === 0) {
    return {
      viewPermissions: memberViewPermissions,
      editPermissions: [],
      deletePermissions: []
    };
  }

  return {
    viewPermissions: mergeStaffViewPermissions(...matched.map(item => item.viewPermissions)),
    editPermissions: mergeStaffViewPermissions(...matched.map(item => item.editPermissions)),
    deletePermissions: mergeStaffViewPermissions(...matched.map(item => item.deletePermissions))
  };
}
