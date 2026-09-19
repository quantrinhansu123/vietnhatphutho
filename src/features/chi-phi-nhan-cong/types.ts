export interface MachineInfo {
  code: string;
  name: string;
}

export interface PersonLaborDayDetail {
  date: string; // YYYY-MM-DD
  dayOfMonth: number; // 1..31
  shift: string;
  role: string;
  startTime: string;
  endTime: string;
  hours: number;
  isDispatchedTo?: boolean; // Được điều động đến máy này
  isDispatchedAway?: boolean; // Bị điều động đi máy khác
  dispatchNote?: string;
}

export interface PersonMachineLabor {
  personCode: string;
  personName: string;
  role: string;
  totalDays: number;
  totalHours: number;
  hourlyRate: number; // Đơn giá VNĐ / giờ
  totalCost: number;  // Thành tiền = totalHours * hourlyRate
  days: PersonLaborDayDetail[];
}

export interface MachineLaborDetail {
  machineCode: string;
  machineName: string;
  totalPersonnel: number;
  totalHours: number;
  totalCost: number;
  personnel: PersonMachineLabor[];
}

export interface DailyLaborItem {
  date: string; // YYYY-MM-DD
  dayOfMonth: number; // 1..31
  dayOfWeekVi: string; // Thứ 2, Thứ 3, ... Chủ nhật
  totalPersonnel: number;
  machineHours: Record<string, number>; // machineCode -> hours
  totalHours: number;
}

export interface PersonAllMachinesSummary {
  personCode: string;
  personName: string;
  role: string;
  machineHours: Record<string, number>; // machineCode -> hours
  totalHours: number;
  standardWorkDays: number; // totalHours / 8
  hourlyRate: number;
  totalCost: number;
}

export interface GrandLaborSummary {
  totalPersonnel: number;
  totalHours: number;
  totalStandardDays: number;
  totalCost: number;
}

export interface ChiPhiNhanCongCalculationResult {
  thang: number;
  nam: number;
  selectedMachines: string[]; // machine codes
  machineDetails: MachineLaborDetail[];
  dailySummary: DailyLaborItem[];
  personSummary: PersonAllMachinesSummary[];
  grandTotal: GrandLaborSummary;
}

export interface DinhGiaNhanCongSavedRow {
  code: string;
  name: string;
  costCur: number;
  costPrev: number;
  qtyCur: number;
  qtyPrev: number;
  donGiaCur: number;
  donGiaPrev: number;
  diff: number;
  impact: number;
}

export interface DinhGiaNhanCongReport {
  id: string;
  loai: 'thang' | 'nam';
  thang: number | null;
  nam: number;
  thang_so_sanh: number | null;
  nam_so_sanh: number | null;
  che_do_nam: 'cung-thang' | 'cong-don' | null;
  tu_thang: number | null;
  den_thang: number | null;
  ten_bao_cao: string;
  ma_may_list: string[];
  ten_may_list: string[];
  chi_tiet: { rows?: DinhGiaNhanCongSavedRow[] };
  ghi_chu: string;
  nguoi_lap: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChiPhiNhanCongRecord {
  id: string;
  thang: number;
  nam: number;
  ten_bao_cao: string;
  ma_may_list: string[];
  ten_may_list: string[];
  tong_so_nguoi: number;
  tong_so_gio: number;
  tong_so_cong: number;
  tong_chi_phi: number;
  chi_tiet: ChiPhiNhanCongCalculationResult;
  ghi_chu: string;
  nguoi_lap: string;
  created_at?: string;
  updated_at?: string;
}
