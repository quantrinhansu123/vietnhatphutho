import {
  defaultStaffViewPermissions,
  hasFullMenuAccess,
  type StaffViewPermissions
} from '../features/nhan-su/menuViews';

export type AuthUser = {
  id: string;
  name: string;
  username: string;
  role: string;
  /** Mã máy được phân công. Trống/không có = không giới hạn, chọn máy bình thường. */
  machineCodes?: string[];
  viewPermissions?: StaffViewPermissions;
  editPermissions?: StaffViewPermissions;
  deletePermissions?: StaffViewPermissions;
  fullAccess?: boolean;
};

export function grantResolvedAccess(user: AuthUser): AuthUser {
  if (!hasFullMenuAccess(user.role, user.username)) return user;
  const allPermissions = defaultStaffViewPermissions();
  return {
    ...user,
    fullAccess: true,
    machineCodes: user.machineCodes ?? [],
    viewPermissions: allPermissions,
    editPermissions: allPermissions,
    deletePermissions: allPermissions
  };
}
