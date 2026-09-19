import type {
  MachineInfo,
  PersonLaborDayDetail,
  PersonMachineLabor,
  MachineLaborDetail,
  DailyLaborItem,
  PersonAllMachinesSummary,
  GrandLaborSummary,
  ChiPhiNhanCongCalculationResult
} from './types';

export function daysInMonth(thang: number, nam: number): number {
  if (thang === 2) {
    const leap = (nam % 4 === 0 && nam % 100 !== 0) || nam % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(thang) ? 30 : 31;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function timeToMinutes(val: unknown): number {
  if (!val) return 0;
  const s = String(val).trim();
  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function calcDurationHours(start: unknown, end: unknown, fallbackHours = 8): number {
  const s = String(start || '').trim();
  const e = String(end || '').trim();
  if (!s || !e) return fallbackHours;
  const startMin = timeToMinutes(s);
  let endMin = timeToMinutes(e);
  if (endMin <= startMin) {
    endMin += 1440; // Ca qua đêm
  }
  const diff = endMin - startMin;
  const hours = Math.round((diff / 60) * 100) / 100;
  return hours > 0 ? hours : fallbackHours;
}

const VI_DAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export function getDayOfWeekVi(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  const date = new Date(y, m - 1, d);
  return VI_DAYS[date.getDay()] || '';
}

export interface CalculateLaborInput {
  thang: number;
  nam: number;
  selectedMachineCodes: string[];
  allMachines: MachineInfo[];
  rawPhanCong: Array<Record<string, any>>;
  rawDieuDong: Array<Record<string, any>>;
  staffList: Array<{ code: string; name: string; position?: string }>;
  shiftSettings: Array<{ code: string; name: string; startTime: string; endTime: string }>;
  hourlyRates?: Record<string, number>; // personCode -> rate
  defaultHourlyRate?: number;
}

interface WorkingBlock {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  personCode: string;
  machineCode: string;
  shift: string;
  role: string;
  startTime: string;
  endTime: string;
  hours: number;
  isDispatchedTo?: boolean;
  isDispatchedAway?: boolean;
  dispatchNote?: string;
}

export function calculateLaborCost({
  thang,
  nam,
  selectedMachineCodes,
  allMachines,
  rawPhanCong,
  rawDieuDong,
  staffList,
  shiftSettings,
  hourlyRates = {},
  defaultHourlyRate = 0
}: CalculateLaborInput): ChiPhiNhanCongCalculationResult {
  const totalDays = daysInMonth(thang, nam);

  // 1. Map machine lookups
  const machineByCode = new Map<string, MachineInfo>();
  const machineLookup = new Map<string, MachineInfo>();

  for (const m of allMachines) {
    if (m.code) {
      machineByCode.set(m.code, m);
      machineLookup.set(m.code.toLowerCase(), m);
    }
    if (m.name) {
      machineLookup.set(m.name.toLowerCase(), m);
    }
  }

  const resolveMachine = (rawMachine: unknown): MachineInfo | null => {
    const key = String(rawMachine || '').trim().toLowerCase();
    if (!key) return null;
    return machineLookup.get(key) || null;
  };

  // 2. Staff lookup
  const staffMap = new Map<string, { code: string; name: string; position: string }>();
  for (const s of staffList) {
    const code = String(s.code || '').trim();
    if (code) {
      staffMap.set(code, {
        code,
        name: String(s.name || code).trim(),
        position: String(s.position || '').trim()
      });
    }
  }

  const resolveStaff = (code: string) => {
    const found = staffMap.get(code);
    return {
      code,
      name: found?.name || code,
      position: found?.position || ''
    };
  };

  // 3. Shift duration lookup
  const shiftMap = new Map<string, number>();
  for (const sh of shiftSettings) {
    const hours = calcDurationHours(sh.startTime, sh.endTime, 8);
    if (sh.name) shiftMap.set(sh.name.toLowerCase(), hours);
    if (sh.code) shiftMap.set(sh.code.toLowerCase(), hours);
  }

  const getShiftDefaultHours = (ca: string): number => {
    const key = String(ca || '').trim().toLowerCase();
    return shiftMap.get(key) || 8;
  };

  // 4. Bóc tách phân công nhân sự gốc (baseline)
  // Key: date + personCode + machineCode + shift
  const workingBlocks: WorkingBlock[] = [];

  for (const pc of rawPhanCong) {
    const dateStr = String(pc.ngay_lam_viec || '').slice(0, 10);
    if (!dateStr) continue;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y !== nam || m !== thang) continue;

    const personCode = String(pc.ma_nhan_su || '').trim();
    if (!personCode || personCode.startsWith('__')) continue;

    const machineObj = resolveMachine(pc.ma_may || pc.may);
    const machineCode = machineObj ? machineObj.code : String(pc.ma_may || pc.may || '').trim();
    if (!machineCode) continue;

    const ca = String(pc.ca_lam_viec || pc.ca || '').trim();
    const role = String(pc.vai_tro || '').trim();
    const start = String(pc.thoi_gian_bat_dau || '').trim().slice(0, 5);
    const end = String(pc.thoi_gian_ket_thuc || '').trim().slice(0, 5);
    const defaultHours = getShiftDefaultHours(ca);
    const hours = calcDurationHours(start, end, defaultHours);

    workingBlocks.push({
      date: dateStr,
      dayOfMonth: d,
      personCode,
      machineCode,
      shift: ca,
      role,
      startTime: start,
      endTime: end,
      hours
    });
  }

  // 5. Xử lý điều động nhân sự (dieu_dong_nhan_su)
  for (const dd of rawDieuDong) {
    const dateStr = String(dd.ngay_lam_viec || '').slice(0, 10);
    if (!dateStr) continue;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y !== nam || m !== thang) continue;

    const personCode = String(dd.ma_nhan_su || '').trim();
    if (!personCode) continue;

    const mayGocObj = resolveMachine(dd.may_goc);
    const mayDieuDongObj = resolveMachine(dd.may_dieu_dong);

    const mayGocCode = mayGocObj ? mayGocObj.code : String(dd.may_goc || '').trim();
    const mayDieuDongCode = mayDieuDongObj ? mayDieuDongObj.code : String(dd.may_dieu_dong || '').trim();

    const ddStart = String(dd.thoi_gian_bat_dau || '').trim().slice(0, 5);
    const ddEnd = String(dd.thoi_gian_ket_thuc || '').trim().slice(0, 5);
    const ddHours = calcDurationHours(ddStart, ddEnd, 8);
    const note = String(dd.ghi_chu || '').trim();
    const role = String(dd.vai_tro || '').trim();

    if (mayGocCode && mayDieuDongCode && mayGocCode.toLowerCase() === mayDieuDongCode.toLowerCase()) {
      // Làm thêm / tăng ca trên cùng máy
      workingBlocks.push({
        date: dateStr,
        dayOfMonth: d,
        personCode,
        machineCode: mayGocCode,
        shift: String(dd.ca_dieu_dong || dd.ca || 'Tăng cường'),
        role,
        startTime: ddStart,
        endTime: ddEnd,
        hours: ddHours,
        isDispatchedTo: true,
        dispatchNote: note ? `Tăng cường: ${note}` : 'Tăng cường cùng máy'
      });
    } else {
      // Điều động từ máy gốc sang máy điều động
      // 1. Trừ giờ trên máy gốc nếu có lịch
      if (mayGocCode) {
        const scheduledOnGoc = workingBlocks.find(
          b => b.date === dateStr && b.personCode === personCode && b.machineCode.toLowerCase() === mayGocCode.toLowerCase()
        );
        if (scheduledOnGoc) {
          scheduledOnGoc.hours = Math.max(0, Math.round((scheduledOnGoc.hours - ddHours) * 100) / 100);
          scheduledOnGoc.isDispatchedAway = true;
          const destName = mayDieuDongObj?.name || mayDieuDongCode;
          scheduledOnGoc.dispatchNote = `Điều động sang ${destName}${note ? ` (${note})` : ''}`;
        }
      }

      // 2. Cộng giờ vào máy điều động (nếu máy điều động không phải Việc khác)
      if (mayDieuDongCode && mayDieuDongCode.toLowerCase() !== 'việc khác' && mayDieuDongCode.toLowerCase() !== 'cong_viec_khac') {
        workingBlocks.push({
          date: dateStr,
          dayOfMonth: d,
          personCode,
          machineCode: mayDieuDongCode,
          shift: String(dd.ca_dieu_dong || dd.ca || 'Điều động'),
          role,
          startTime: ddStart,
          endTime: ddEnd,
          hours: ddHours,
          isDispatchedTo: true,
          dispatchNote: `Điều động từ ${mayGocObj?.name || mayGocCode}${note ? ` (${note})` : ''}`
        });
      }
    }
  }

  // 6. Lọc theo danh sách máy được chọn
  // Nếu selectedMachineCodes rỗng thì chọn toàn bộ các máy có dữ liệu
  const effectiveMachineCodes = selectedMachineCodes.length > 0
    ? selectedMachineCodes
    : allMachines.map(m => m.code);

  const selectedSet = new Set(effectiveMachineCodes.map(c => c.toLowerCase()));

  // 7. Tổng hợp chi tiết theo từng máy
  const machineDetails: MachineLaborDetail[] = [];

  for (const mCode of effectiveMachineCodes) {
    const machObj = machineByCode.get(mCode) || { code: mCode, name: mCode };
    const machBlocks = workingBlocks.filter(b => b.machineCode.toLowerCase() === mCode.toLowerCase() && b.hours > 0);

    // Gom theo nhân sự trên máy này
    const personMap = new Map<string, PersonMachineLabor>();

    for (const block of machBlocks) {
      let pItem = personMap.get(block.personCode);
      if (!pItem) {
        const staff = resolveStaff(block.personCode);
        const rate = hourlyRates[block.personCode] ?? defaultHourlyRate ?? 0;
        pItem = {
          personCode: block.personCode,
          personName: staff.name,
          role: block.role || staff.position,
          totalDays: 0,
          totalHours: 0,
          hourlyRate: rate,
          totalCost: 0,
          days: []
        };
        personMap.set(block.personCode, pItem);
      }

      pItem.days.push({
        date: block.date,
        dayOfMonth: block.dayOfMonth,
        shift: block.shift,
        role: block.role,
        startTime: block.startTime,
        endTime: block.endTime,
        hours: block.hours,
        isDispatchedTo: block.isDispatchedTo,
        isDispatchedAway: block.isDispatchedAway,
        dispatchNote: block.dispatchNote
      });
      pItem.totalHours = Math.round((pItem.totalHours + block.hours) * 100) / 100;
    }

    const personnelList = [...personMap.values()].map(p => {
      const distinctDays = new Set(p.days.map(d => d.date)).size;
      const totalCost = Math.round(p.totalHours * p.hourlyRate);
      return {
        ...p,
        totalDays: distinctDays,
        totalCost
      };
    }).sort((a, b) => a.personName.localeCompare(b.personName, 'vi'));

    const machTotalHours = personnelList.reduce((acc, p) => acc + p.totalHours, 0);
    const machTotalCost = personnelList.reduce((acc, p) => acc + p.totalCost, 0);

    machineDetails.push({
      machineCode: machObj.code,
      machineName: machObj.name,
      totalPersonnel: personnelList.length,
      totalHours: Math.round(machTotalHours * 100) / 100,
      totalCost: machTotalCost,
      personnel: personnelList
    });
  }

  // 8. Bảng ở cuối: Tổng hợp theo ngày trong tháng (cho tất cả các máy được chọn)
  const dailySummary: DailyLaborItem[] = [];

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${nam}-${pad2(thang)}-${pad2(day)}`;
    const dayOfWeek = getDayOfWeekVi(dateStr);

    const dayBlocks = workingBlocks.filter(
      b => b.dayOfMonth === day && selectedSet.has(b.machineCode.toLowerCase()) && b.hours > 0
    );

    const distinctPeople = new Set(dayBlocks.map(b => b.personCode));
    const machineHours: Record<string, number> = {};
    let dayTotalHours = 0;

    for (const mCode of effectiveMachineCodes) {
      const hours = dayBlocks
        .filter(b => b.machineCode.toLowerCase() === mCode.toLowerCase())
        .reduce((sum, b) => sum + b.hours, 0);
      machineHours[mCode] = Math.round(hours * 100) / 100;
      dayTotalHours += hours;
    }

    dailySummary.push({
      date: dateStr,
      dayOfMonth: day,
      dayOfWeekVi: dayOfWeek,
      totalPersonnel: distinctPeople.size,
      machineHours,
      totalHours: Math.round(dayTotalHours * 100) / 100
    });
  }

  // 9. Bảng ở cuối: Tổng hợp theo nhân sự toàn bộ các máy được chọn
  const allPersonMap = new Map<string, PersonAllMachinesSummary>();

  for (const mach of machineDetails) {
    for (const p of mach.personnel) {
      let ap = allPersonMap.get(p.personCode);
      if (!ap) {
        const staff = resolveStaff(p.personCode);
        const rate = hourlyRates[p.personCode] ?? defaultHourlyRate ?? 0;
        ap = {
          personCode: p.personCode,
          personName: staff.name,
          role: p.role || staff.position,
          machineHours: {},
          totalHours: 0,
          standardWorkDays: 0,
          hourlyRate: rate,
          totalCost: 0
        };
        allPersonMap.set(p.personCode, ap);
      }
      ap.machineHours[mach.machineCode] = (ap.machineHours[mach.machineCode] || 0) + p.totalHours;
      ap.totalHours = Math.round((ap.totalHours + p.totalHours) * 100) / 100;
    }
  }

  const personSummary = [...allPersonMap.values()].map(ap => {
    const standardWorkDays = Math.round((ap.totalHours / 8) * 100) / 100;
    const totalCost = Math.round(ap.totalHours * ap.hourlyRate);
    return {
      ...ap,
      standardWorkDays,
      totalCost
    };
  }).sort((a, b) => a.personName.localeCompare(b.personName, 'vi'));

  // 10. Grand total
  const grandTotalHours = personSummary.reduce((acc, p) => acc + p.totalHours, 0);
  const grandTotalCost = personSummary.reduce((acc, p) => acc + p.totalCost, 0);
  const grandStandardDays = Math.round((grandTotalHours / 8) * 100) / 100;

  const grandTotal: GrandLaborSummary = {
    totalPersonnel: personSummary.length,
    totalHours: Math.round(grandTotalHours * 100) / 100,
    totalStandardDays: grandStandardDays,
    totalCost: grandTotalCost
  };

  return {
    thang,
    nam,
    selectedMachines: effectiveMachineCodes,
    machineDetails,
    dailySummary,
    personSummary,
    grandTotal
  };
}
