import type { StaffViewPermissions } from '../nhan-su/menuViews';
import { normalizeStaffViewPermissions } from '../nhan-su/menuViews';
import {
  normalizeAssignablePositions,
  type StaffAssignablePosition
} from '../cai-dat-thoi-gian/staffAssignments';

export interface HrMember {
  id: string;
  code?: string;
  name: string;
  role: string;
  position?: string;
  shift: string;
  status: string;
  username?: string;
  password?: string;
  signatureUrl?: string;
  viewPermissions: StaffViewPermissions;
  assignedPositions?: StaffAssignablePosition[];
}

export interface HrDepartment {
  id: string;
  name: string;
  lead: string;
  members: HrMember[];
}

export interface HrBranch {
  id: string;
  name: string;
  shortName: string;
  departments: HrDepartment[];
}

export function normalizeHrBranches(data: unknown): HrBranch[] {
  if (!data || typeof data !== 'object') return [];
  const branches = (data as { branches?: unknown }).branches;
  if (!Array.isArray(branches)) return [];

  return branches
    .map((branch): HrBranch | null => {
      if (!branch || typeof branch !== 'object') return null;
      const record = branch as Record<string, unknown>;
      const departments = Array.isArray(record.departments) ? record.departments : [];
      const normalizedDepartments = departments
        .map((department): HrDepartment | null => {
          if (!department || typeof department !== 'object') return null;
          const departmentRecord = department as Record<string, unknown>;
          const members = Array.isArray(departmentRecord.members) ? departmentRecord.members : [];

          return {
            id: String(departmentRecord.id ?? departmentRecord.name ?? ''),
            name: String(departmentRecord.name ?? 'Chưa phân phòng ban'),
            lead: String(departmentRecord.lead ?? 'Chưa phân công'),
            members: members
              .map((member): HrMember | null => {
                if (!member || typeof member !== 'object') return null;
                const memberRecord = member as Record<string, unknown>;
                const name = String(memberRecord.name ?? '').trim();
                if (!name) return null;

                return {
                  id: String(memberRecord.id ?? memberRecord.code ?? name),
                  code: String(memberRecord.code ?? '').trim() || undefined,
                  name,
                  role: String(memberRecord.role ?? 'Nhân sự'),
                  position: String(memberRecord.position ?? '').trim() || undefined,
                  shift: String(memberRecord.shift ?? 'Theo phân công'),
                  status: String(memberRecord.status ?? 'Đang làm'),
                  username: String(memberRecord.username ?? '').trim() || undefined,
                  password: String(memberRecord.password ?? '').trim() || undefined,
                  signatureUrl: String(
                    memberRecord.signatureUrl ??
                    memberRecord.link_chu_ky ??
                    memberRecord.chu_ky_url ??
                    ''
                  ).trim() || undefined,
                  viewPermissions: normalizeStaffViewPermissions(
                    memberRecord.viewPermissions ?? memberRecord.quyen_xem
                  ),
                  assignedPositions: normalizeAssignablePositions(
                    memberRecord.assignedPositions ?? memberRecord.vi_tri_gan
                  )
                };
              })
              .filter((member): member is HrMember => Boolean(member))
          };
        })
        .filter((department): department is HrDepartment => Boolean(department));

      return {
        id: String(record.id ?? record.name ?? ''),
        name: String(record.name ?? 'Chưa phân chi nhánh'),
        shortName: String(record.shortName ?? record.name ?? 'Chi nhánh'),
        departments: normalizedDepartments
      };
    })
    .filter((branch): branch is HrBranch => Boolean(branch));
}

