import type { AppTab } from '../routes';
import { useAccessControl } from './accessControl';

/** Quyền Xem / Thêm / Sửa / Xóa theo tab trong ma trận Phân quyền. */
export function useTabAccess(tab: AppTab | string) {
  const access = useAccessControl();
  return {
    isAdmin: access.isAdmin,
    canView: access.canView(tab),
    canCreate: access.canCreate(tab),
    canEdit: access.canEdit(tab),
    canDelete: access.canDelete(tab)
  };
}
