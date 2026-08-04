import React, { useEffect, useRef } from 'react';
import {
  STAFF_MENU_VIEW_TREE,
  clearStaffViewPermissions,
  defaultStaffViewPermissions,
  isStaffChildViewSelected,
  isStaffParentViewIndeterminate,
  isStaffParentViewSelected,
  toggleStaffChildView,
  toggleStaffParentView,
  type StaffViewChild,
  type StaffViewGroup,
  type StaffViewPermissions
} from '../nhan-su/menuViews';

export type RolePermissionBundle = {
  viewPermissions: StaffViewPermissions;
  editPermissions: StaffViewPermissions;
  deletePermissions: StaffViewPermissions;
};

type PermissionColumn = 'view' | 'edit' | 'delete';

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  'aria-label': ariaLabel
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
  'aria-label': string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [checked, indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={ariaLabel}
      onChange={event => onChange(event.target.checked)}
      className="h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
    />
  );
}

function getColumnPermissions(bundle: RolePermissionBundle, column: PermissionColumn) {
  if (column === 'view') return bundle.viewPermissions;
  if (column === 'edit') return bundle.editPermissions;
  return bundle.deletePermissions;
}

function setColumnPermissions(
  bundle: RolePermissionBundle,
  column: PermissionColumn,
  next: StaffViewPermissions
): RolePermissionBundle {
  if (column === 'view') return { ...bundle, viewPermissions: next };
  if (column === 'edit') return { ...bundle, editPermissions: next };
  return { ...bundle, deletePermissions: next };
}

/** Khi bật sửa/xóa thì tự bật quyền xem cùng menu (để vào được view). */
function ensureViewCovers(bundle: RolePermissionBundle, source: StaffViewPermissions): RolePermissionBundle {
  let view = bundle.viewPermissions;
  source.forEach(group => {
    group.children.forEach(child => {
      if (!isStaffChildViewSelected(view, group.menu, child.tab)) {
        view = toggleStaffChildView(view, group.menu, group.label, child, true);
      }
    });
  });
  return { ...bundle, viewPermissions: view };
}

export function RolePermissionsMatrix({
  value,
  onChange
}: {
  value: RolePermissionBundle;
  onChange: (next: RolePermissionBundle) => void;
}) {
  const setAll = (column: PermissionColumn, checked: boolean) => {
    const nextPerms = checked ? defaultStaffViewPermissions() : clearStaffViewPermissions();
    let next = setColumnPermissions(value, column, nextPerms);
    if (checked && column !== 'view') {
      next = ensureViewCovers(next, nextPerms);
    }
    onChange(next);
  };

  const toggleParent = (group: StaffViewGroup, column: PermissionColumn, checked: boolean) => {
    const current = getColumnPermissions(value, column);
    const nextPerms = toggleStaffParentView(current, group, checked);
    let next = setColumnPermissions(value, column, nextPerms);
    if (checked && column !== 'view') {
      next = ensureViewCovers(next, nextPerms);
    }
    onChange(next);
  };

  const toggleChild = (
    group: StaffViewGroup,
    child: StaffViewChild,
    column: PermissionColumn,
    checked: boolean
  ) => {
    const current = getColumnPermissions(value, column);
    const nextPerms = toggleStaffChildView(current, group.menu, group.label, child, checked);
    let next = setColumnPermissions(value, column, nextPerms);
    if (checked && column !== 'view') {
      next = ensureViewCovers(next, [{ menu: group.menu, label: group.label, children: [child] }]);
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Ma trận quyền theo menu</h3>
          <p className="mt-1 text-xs font-semibold text-zinc-500">
            Xem = vào menu. Sửa / Xóa = thao tác trên dòng dữ liệu trong view đó. Tick menu cha sẽ chọn hết menu con.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
          {([
            ['view', 'Xem'],
            ['edit', 'Sửa'],
            ['delete', 'Xóa']
          ] as const).map(([column, label]) => (
            <div key={column} className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1">
              <span className="text-zinc-500">{label}</span>
              <button type="button" onClick={() => setAll(column, true)} className="text-[#ef1b2d] hover:underline">
                All
              </button>
              <span className="text-zinc-300">|</span>
              <button type="button" onClick={() => setAll(column, false)} className="text-zinc-500 hover:underline">
                Clear
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Hạng mục menu</th>
                <th className="w-28 px-3 py-3 text-center font-black">Quyền xem</th>
                <th className="w-28 px-3 py-3 text-center font-black">Quyền sửa</th>
                <th className="w-28 px-3 py-3 text-center font-black">Quyền xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {STAFF_MENU_VIEW_TREE.map(group => {
                const parentView = isStaffParentViewSelected(value.viewPermissions, group);
                const parentEdit = isStaffParentViewSelected(value.editPermissions, group);
                const parentDelete = isStaffParentViewSelected(value.deletePermissions, group);
                return (
                  <React.Fragment key={group.menu}>
                    <tr className="bg-zinc-50/80">
                      <td className="px-4 py-2.5 font-black text-zinc-950">{group.label}</td>
                      <td className="px-3 py-2.5 text-center">
                        <IndeterminateCheckbox
                          checked={parentView}
                          indeterminate={isStaffParentViewIndeterminate(value.viewPermissions, group)}
                          aria-label={`Xem ${group.label}`}
                          onChange={checked => toggleParent(group, 'view', checked)}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <IndeterminateCheckbox
                          checked={parentEdit}
                          indeterminate={isStaffParentViewIndeterminate(value.editPermissions, group)}
                          aria-label={`Sửa ${group.label}`}
                          onChange={checked => toggleParent(group, 'edit', checked)}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <IndeterminateCheckbox
                          checked={parentDelete}
                          indeterminate={isStaffParentViewIndeterminate(value.deletePermissions, group)}
                          aria-label={`Xóa ${group.label}`}
                          onChange={checked => toggleParent(group, 'delete', checked)}
                        />
                      </td>
                    </tr>
                    {group.children.map(child => (
                      <tr key={`${group.menu}-${child.tab}-${child.label}`} className="hover:bg-red-50/30">
                        <td className="px-4 py-2.5 pl-10 font-semibold text-zinc-700">{child.label}</td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isStaffChildViewSelected(value.viewPermissions, group.menu, child.tab)}
                            aria-label={`Xem ${child.label}`}
                            onChange={event => toggleChild(group, child, 'view', event.target.checked)}
                            className="h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isStaffChildViewSelected(value.editPermissions, group.menu, child.tab)}
                            aria-label={`Sửa ${child.label}`}
                            onChange={event => toggleChild(group, child, 'edit', event.target.checked)}
                            className="h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isStaffChildViewSelected(value.deletePermissions, group.menu, child.tab)}
                            aria-label={`Xóa ${child.label}`}
                            onChange={event => toggleChild(group, child, 'delete', event.target.checked)}
                            className="h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                          />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
