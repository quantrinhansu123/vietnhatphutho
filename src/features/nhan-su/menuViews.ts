import type { AppTab } from '../../routes';

export type StaffViewChild = {
  tab: AppTab | string;
  label: string;
};

export type StaffViewGroup = {
  menu: AppTab | string;
  label: string;
  children: StaffViewChild[];
};

export type StaffViewPermissions = StaffViewGroup[];

/** Cây menu cha / con dùng cấp quyền nhân sự */
export const STAFF_MENU_VIEW_TREE: StaffViewGroup[] = [
  {
    menu: 'hcns',
    label: 'HCNS',
    children: [{ tab: 'hr', label: 'Nhân sự' }]
  },
  {
    menu: 'settings',
    label: 'Cài đặt',
    children: [{ tab: 'settings', label: 'Phân quyền & tham số' }]
  },
  {
    menu: 'business',
    label: 'Kinh doanh',
    children: [
      { tab: 'orders', label: 'Đơn hàng' },
      { tab: 'customers', label: 'Khách hàng' },
      { tab: 'shipping-orders', label: 'Lệnh xuất hàng' }
    ]
  },
  {
    menu: 'factory',
    label: 'Nhà máy',
    children: [
      { tab: 'factory-quan-doc', label: 'Quản Đốc' },
      { tab: 'factory-qc', label: 'QC' },
      { tab: 'factory-cong-nhan', label: 'Công nhân' },
      { tab: 'factory-kho', label: 'Kho' }
    ]
  },
  {
    menu: 'dashboard',
    label: 'Phân tích',
    children: [{ tab: 'dashboard', label: 'Dashboard' }]
  }
];

export function defaultStaffViewPermissions(): StaffViewPermissions {
  return STAFF_MENU_VIEW_TREE.map(group => ({
    menu: group.menu,
    label: group.label,
    children: group.children.map(child => ({ ...child }))
  }));
}

export function clearStaffViewPermissions(): StaffViewPermissions {
  return [];
}

export function normalizeStaffViewPermissions(raw: unknown): StaffViewPermissions {
  if (raw === null || raw === undefined) return [];

  let value: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) return [];

  return value
    .map((item): StaffViewGroup | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const menu = String(record.menu ?? record.tab ?? '').trim();
      const label = String(record.label ?? record.title ?? menu).trim();
      if (!menu) return null;

      const childrenRaw = Array.isArray(record.children) ? record.children : [];
      const children = childrenRaw
        .map((child): StaffViewChild | null => {
          if (!child || typeof child !== 'object') return null;
          const childRecord = child as Record<string, unknown>;
          const tab = String(childRecord.tab ?? childRecord.menu ?? '').trim();
          const childLabel = String(childRecord.label ?? childRecord.title ?? tab).trim();
          if (!tab) return null;
          return { tab, label: childLabel };
        })
        .filter((child): child is StaffViewChild => Boolean(child));

      return { menu, label: label || menu, children };
    })
    .filter((group): group is StaffViewGroup => Boolean(group));
}

/** Tập hợp tab (menu cha + con) mà nhân sự được xem */
export function buildAllowedTabSet(permissions: StaffViewPermissions): Set<string> {
  const tabs = new Set<string>();
  permissions.forEach(group => {
    if (group.menu) tabs.add(String(group.menu));
    group.children.forEach(child => {
      if (child.tab) tabs.add(String(child.tab));
    });
  });
  return tabs;
}

/** Chỉ tài khoản quản trị mới được xem toàn bộ menu */
export function hasFullMenuAccess(role: string | null | undefined): boolean {
  const normalized = (role ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase();
  return normalized === 'quản trị' || normalized === 'admin' || normalized === 'quản trị viên';
}

export function summarizeStaffViewPermissions(permissions: StaffViewPermissions): string {
  if (permissions.length === 0) return 'Chưa cấu hình';
  return permissions
    .map(group => {
      const childCount = group.children.length;
      return childCount > 0 ? `${group.label} (${childCount})` : group.label;
    })
    .join(' · ');
}

export function formatStaffViewPermissionsJson(permissions: StaffViewPermissions): string {
  return JSON.stringify(permissions, null, 2);
}

export function isStaffChildViewSelected(
  permissions: StaffViewPermissions,
  parentMenu: string,
  childTab: string
): boolean {
  const group = permissions.find(item => item.menu === parentMenu);
  if (!group) return false;
  return group.children.some(child => child.tab === childTab);
}

export function toggleStaffChildView(
  permissions: StaffViewPermissions,
  parentMenu: string,
  parentLabel: string,
  child: StaffViewChild,
  checked: boolean
): StaffViewPermissions {
  const next = permissions.map(group => ({
    ...group,
    children: group.children.map(childItem => ({ ...childItem }))
  }));

  let group = next.find(item => item.menu === parentMenu);
  if (!group) {
    group = { menu: parentMenu, label: parentLabel, children: [] };
    next.push(group);
  }

  const exists = group.children.some(item => item.tab === child.tab);
  if (checked && !exists) {
    group.children.push({ ...child });
  }
  if (!checked) {
    group.children = group.children.filter(item => item.tab !== child.tab);
  }

  return next
    .map(item => ({
      ...item,
      children: item.children.filter(childItem => childItem.tab)
    }))
    .filter(item => item.children.length > 0);
}
