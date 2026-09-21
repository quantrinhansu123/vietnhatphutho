import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Save,
  RotateCcw,
  CheckSquare,
  Square,
  Cpu,
  Users,
  Clock,
  Coins,
  Calendar,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  Search,
  X
} from 'lucide-react';
import type {
  ChiPhiNhanCongRecord,
  MachineInfo,
  ChiPhiNhanCongCalculationResult,
  PersonMachineLabor
} from './types';
import { MonthYearPickerVi } from './MonthYearPickerVi';
import { calculateLaborCost } from './calculateLabor';

interface ChiPhiNhanCongFormProps {
  initialRecord?: ChiPhiNhanCongRecord | null;
  machines: MachineInfo[];
  staffList: Array<{ code: string; name: string; position?: string }>;
  shiftSettings: Array<{ code: string; name: string; startTime: string; endTime: string }>;
  currentUser?: any;
  onSave: (recordData: Partial<ChiPhiNhanCongRecord>) => Promise<void>;
  onCancel: () => void;
}

export function ChiPhiNhanCongForm({
  initialRecord,
  machines,
  staffList,
  shiftSettings,
  currentUser,
  onSave,
  onCancel
}: ChiPhiNhanCongFormProps) {
  const isEditing = Boolean(initialRecord?.id);

  // Month & Year state
  const [thang, setThang] = useState(() => initialRecord?.thang || new Date().getMonth() + 1);
  const [nam, setNam] = useState(() => initialRecord?.nam || new Date().getFullYear());

  // Machine selection state (multi-select)
  const [selectedMachineCodes, setSelectedMachineCodes] = useState<string[]>(() => {
    if (initialRecord?.ma_may_list && initialRecord.ma_may_list.length > 0) {
      return initialRecord.ma_may_list;
    }
    // Mặc định chọn tất cả máy
    return machines.map(m => m.code);
  });

  // Metadata
  const [tenBaoCao, setTenBaoCao] = useState(
    () => initialRecord?.ten_bao_cao || `Chi phí nhân công Tháng ${thang}/${nam}`
  );
  const [nguoiLap, setNguoiLap] = useState(
    () => initialRecord?.nguoi_lap || currentUser?.name || currentUser?.username || ''
  );
  const [ghiChu, setGhiChu] = useState(() => initialRecord?.ghi_chu || '');

  // Hourly rates map: personCode -> hourly rate
  const [hourlyRates, setHourlyRates] = useState<Record<string, number>>(() => {
    const rates: Record<string, number> = {};
    if (initialRecord?.chi_tiet?.personSummary) {
      for (const p of initialRecord.chi_tiet.personSummary) {
        if (p.hourlyRate) rates[p.personCode] = p.hourlyRate;
      }
    }
    return rates;
  });
  // Raw data fetched from backend for recalculation
  const [rawPhanCong, setRawPhanCong] = useState<any[]>([]);
  const [rawDieuDong, setRawDieuDong] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedMachine, setExpandedMachine] = useState<Record<string, boolean>>({});
  const [expandedDaysPerson, setExpandedDaysPerson] = useState<Record<string, boolean>>({});
  const [personNameSearch, setPersonNameSearch] = useState('');

  // Auto update title when month/year changes if title hasn't been heavily customized
  useEffect(() => {
    if (!isEditing) {
      setTenBaoCao(`Chi phí nhân công Tháng ${thang}/${nam}`);
    }
  }, [thang, nam, isEditing]);

  // Fetch phan_cong and dieu_dong for the selected month
  const fetchDataForMonth = useCallback(async (t: number, y: number) => {
    setLoadingData(true);
    setErrorMsg('');
    try {
      const fromDate = `${y}-${String(t).padStart(2, '0')}-01`;
      // determine last day of month
      const lastDay = new Date(y, t, 0).getDate();
      const toDate = `${y}-${String(t).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const [pcRes, ddRes] = await Promise.all([
        fetch(`/api/phan-cong-nhan-su?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`),
        fetch(`/api/dieu-dong-nhan-su?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`)
      ]);

      const [pcData, ddData] = await Promise.all([
        pcRes.json().catch(() => ({ items: [] })),
        ddRes.json().catch(() => ({ items: [] }))
      ]);

      setRawPhanCong(Array.isArray(pcData.items) ? pcData.items : []);
      setRawDieuDong(Array.isArray(ddData.items) ? ddData.items : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi khi tải dữ liệu phân công và điều động.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Initial load or on month/year change
  useEffect(() => {
    fetchDataForMonth(thang, nam);
  }, [thang, nam, fetchDataForMonth]);

  // If initialRecord has pre-saved calculation result and we haven't fetched raw data yet,
  // we can use the saved result initially.
  const [savedResult] = useState<ChiPhiNhanCongCalculationResult | null>(() => initialRecord?.chi_tiet || null);

  // Compute calculated result dynamically
  const calculatedResult: ChiPhiNhanCongCalculationResult = useMemo(() => {
    // If we have raw data, always calculate live!
    if (rawPhanCong.length > 0 || rawDieuDong.length > 0) {
      return calculateLaborCost({
        thang,
        nam,
        selectedMachineCodes,
        allMachines: machines,
        rawPhanCong,
        rawDieuDong,
        staffList,
        shiftSettings,
        hourlyRates
      });
    }

    // Fallback to saved result if editing and raw data not loaded yet
    if (savedResult) {
      return savedResult;
    }

    // Empty template
    return calculateLaborCost({
      thang,
      nam,
      selectedMachineCodes,
      allMachines: machines,
      rawPhanCong: [],
      rawDieuDong: [],
      staffList,
      shiftSettings,
      hourlyRates
    });
  }, [
    thang,
    nam,
    selectedMachineCodes,
    machines,
    rawPhanCong,
    rawDieuDong,
    staffList,
    shiftSettings,
    hourlyRates,
    savedResult
  ]);

  const filteredPersonSummary = useMemo(() => {
    const q = personNameSearch.trim().toLowerCase();
    if (!q) return calculatedResult.personSummary;
    return calculatedResult.personSummary.filter(p =>
      (p.personName || '').toLowerCase().includes(q)
    );
  }, [calculatedResult.personSummary, personNameSearch]);

  // Machine toggle helper
  const toggleMachine = (code: string) => {
    setSelectedMachineCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const selectAllMachines = () => {
    setSelectedMachineCodes(machines.map(m => m.code));
  };

  const deselectAllMachines = () => {
    setSelectedMachineCodes([]);
  };

  // Hourly rate change for a person
  const handleRateChange = (personCode: string, rate: number) => {
    setHourlyRates(prev => ({
      ...prev,
      [personCode]: rate
    }));
  };

  // Save handler
  const handleSave = async () => {
    if (selectedMachineCodes.length === 0) {
      alert('Vui lòng chọn ít nhất một máy để tính chi phí nhân công.');
      return;
    }

    setIsSaving(true);
    try {
      const selectedMachinesObj = machines.filter(m => selectedMachineCodes.includes(m.code));
      const tenMayList = selectedMachinesObj.map(m => m.name || m.code);

      await onSave({
        id: initialRecord?.id,
        thang,
        nam,
        ten_bao_cao: tenBaoCao.trim() || `Chi phí nhân công Tháng ${thang}/${nam}`,
        ma_may_list: selectedMachineCodes,
        ten_may_list: tenMayList,
        tong_so_nguoi: calculatedResult.grandTotal.totalPersonnel,
        tong_so_gio: calculatedResult.grandTotal.totalHours,
        tong_so_cong: calculatedResult.grandTotal.totalStandardDays,
        tong_chi_phi: calculatedResult.grandTotal.totalCost,
        chi_tiet: calculatedResult,
        ghi_chu: ghiChu.trim(),
        nguoi_lap: nguoiLap.trim()
      });
    } catch (err: any) {
      alert(err?.message || 'Có lỗi xảy ra khi lưu chi phí nhân công.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header action bar */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              {isEditing ? 'Chỉnh sửa chi phí nhân công' : 'Thêm mới chi phí nhân công'}
            </h1>
            <p className="text-[11px] text-slate-500">
              Tự động tổng hợp từ phân công nhân sự chi tiết và điều động nhân sự
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchDataForMonth(thang, nam)}
            disabled={loadingData}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            title="Tải lại phân công và điều động từ cơ sở dữ liệu"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            Lấy dữ liệu tự động
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || loadingData}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white shadow transition hover:bg-brand-700 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Lưu bảng chi phí
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Khối Cấu hình: Chọn tháng/năm, chọn máy, tiêu đề */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
          1. Thông tin kỳ tính và Chọn máy áp dụng
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Bộ chọn Tháng / Năm tiếng Việt */}
          <MonthYearPickerVi
            thang={thang}
            nam={nam}
            onChange={(t, y) => {
              setThang(t);
              setNam(y);
            }}
            label="Chọn Tháng & Năm (*)"
          />

          {/* Tên báo cáo */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Tên bảng chi phí
            </label>
            <input
              type="text"
              value={tenBaoCao}
              onChange={e => setTenBaoCao(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Người lập */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Người lập
            </label>
            <input
              type="text"
              value={nguoiLap}
              onChange={e => setNguoiLap(e.target.value)}
              placeholder="Họ tên người lập"
              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        {/* Khối Chọn nhiều máy */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-brand-600" />
              <span>Chọn các máy tính chi phí (Có thể chọn nhiều máy) (*):</span>
              <span className="text-brand-600 font-bold">
                ({selectedMachineCodes.length} / {machines.length} máy đã chọn)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllMachines}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
              >
                Chọn tất cả
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={deselectAllMachines}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline"
              >
                Bỏ chọn tất cả
              </button>
            </div>
          </div>

          {/* Machine checklist chips */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {machines.map(m => {
              const isSelected = selectedMachineCodes.includes(m.code);
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => toggleMachine(m.code)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/80 font-bold text-brand-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="h-4 w-4 shrink-0 text-brand-600" />
                  ) : (
                    <Square className="h-4 w-4 shrink-0 text-slate-300" />
                  )}
                  <span className="truncate" title={m.name || m.code}>
                    {m.name || m.code}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Thống kê tổng hợp toàn bộ các máy */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-blue-600">
            <Users className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Tổng nhân sự</span>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-950">
            {calculatedResult.grandTotal.totalPersonnel} <span className="text-xs font-normal text-blue-700">người</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Tổng giờ làm</span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-950">
            {calculatedResult.grandTotal.totalHours.toLocaleString('vi-VN')} <span className="text-xs font-normal text-amber-700">giờ</span>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Số công quy đổi</span>
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-950">
            {calculatedResult.grandTotal.totalStandardDays.toLocaleString('vi-VN')} <span className="text-xs font-normal text-indigo-700">công (8h)</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600">
            <Coins className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Tổng chi phí</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-950">
            {calculatedResult.grandTotal.totalCost.toLocaleString('vi-VN')} <span className="text-xs font-normal text-emerald-700">đ</span>
          </div>
        </div>
      </div>

      {/* 2. CÁC BẢNG THEO TỪNG MÁY ĐƯỢC CHỌN */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <span>2. Chi tiết nhân công theo từng máy</span>
            <span className="text-xs font-normal text-slate-500">
              (Đã bóc tách điều động đến/đi giữa các máy)
            </span>
          </h2>
        </div>

        {calculatedResult.machineDetails.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
            Chưa có máy nào được chọn hoặc không có dữ liệu phân công / điều động trong tháng {thang}/{nam}.
          </div>
        ) : (
          calculatedResult.machineDetails.map(mach => {
            const isCollapsed = expandedMachine[mach.machineCode] === false;
            return (
              <div
                key={mach.machineCode}
                className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Header của Máy */}
                <div
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-3 cursor-pointer select-none"
                  onClick={() =>
                    setExpandedMachine(prev => ({
                      ...prev,
                      // Mặc định mở (undefined/true); lần click đầu phải đóng ngay
                      [mach.machineCode]: prev[mach.machineCode] === false
                    }))
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-brand-100 p-1.5 text-brand-700 font-bold">
                      <Cpu className="h-4 w-4 pointer-events-none" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900">{mach.machineName}</span>
                      <span className="ml-2 text-xs font-mono text-slate-400">({mach.machineCode})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="text-slate-600">
                      Số người: <strong className="text-slate-900">{mach.totalPersonnel}</strong>
                    </span>
                    <span className="text-blue-700">
                      Tổng giờ: <strong>{mach.totalHours.toLocaleString('vi-VN')} h</strong>
                    </span>
                    <span className="text-emerald-700">
                      Thành tiền: <strong>{mach.totalCost.toLocaleString('vi-VN')} đ</strong>
                    </span>
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4 text-slate-400 pointer-events-none" />
                    ) : (
                      <ChevronUp className="h-4 w-4 text-slate-400 pointer-events-none" />
                    )}
                  </div>
                </div>

                {/* Bảng nhân sự của máy */}
                {!isCollapsed && (
                  <div className="max-h-[min(420px,55vh)] overflow-auto">
                    {mach.personnel.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        Không có nhân sự nào làm việc trên máy này trong tháng {thang}/{nam}.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          <tr>
                            <th className="px-3.5 py-2.5 text-center w-12">STT</th>
                            <th className="px-3.5 py-2.5">Mã NV</th>
                            <th className="px-3.5 py-2.5">Họ và tên</th>
                            <th className="px-3.5 py-2.5">Vị trí / Vai trò</th>
                            <th className="px-3.5 py-2.5 text-center">Số ngày làm</th>
                            <th className="px-3.5 py-2.5 text-right font-bold text-blue-700">
                              Tổng thời gian (giờ)
                            </th>
                            <th className="px-3.5 py-2.5 text-right">Đơn giá (đ/h)</th>
                            <th className="px-3.5 py-2.5 text-right font-bold text-emerald-700">
                              Thành tiền (đ)
                            </th>
                            <th className="px-3.5 py-2.5 text-center w-24">Chi tiết ngày</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {mach.personnel.map((p, pIdx) => {
                            const personKey = `${mach.machineCode}_${p.personCode}`;
                            const isDaysExpanded = Boolean(expandedDaysPerson[personKey]);
                            return (
                              <React.Fragment key={p.personCode}>
                                <tr className="hover:bg-slate-50/70 transition">
                                  <td className="px-3.5 py-2.5 text-center text-slate-400 font-medium">
                                    {pIdx + 1}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono font-medium text-slate-700">
                                    {p.personCode}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-bold text-slate-900">
                                    {p.personName}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-slate-600">
                                    {p.role || '—'}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-center font-semibold text-slate-800">
                                    {p.totalDays} ngày
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-extrabold text-blue-700 text-sm">
                                    {p.totalHours.toLocaleString('vi-VN')}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right">
                                    <input
                                      type="number"
                                      min={0}
                                      step={1000}
                                      value={hourlyRates[p.personCode] ?? p.hourlyRate ?? 0}
                                      onChange={e =>
                                        handleRateChange(p.personCode, Number(e.target.value) || 0)
                                      }
                                      className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-extrabold text-emerald-700 text-sm">
                                    {p.totalCost.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td className="px-3.5 py-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedDaysPerson(prev => ({
                                          ...prev,
                                          [personKey]: !prev[personKey]
                                        }))
                                      }
                                      className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"
                                    >
                                      {isDaysExpanded ? 'Ẩn' : 'Xem'} ({p.days.length})
                                    </button>
                                  </td>
                                </tr>

                                {/* Chi tiết ngày làm việc khi bấm xem */}
                                {isDaysExpanded && (
                                  <tr className="bg-slate-50/90">
                                    <td colSpan={9} className="p-3">
                                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-inner">
                                        <div className="mb-2 text-xs font-bold text-slate-700 flex items-center gap-2">
                                          <Info className="h-3.5 w-3.5 text-blue-500" />
                                          Lịch làm việc chi tiết của {p.personName} trên {mach.machineName}:
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 text-[11px]">
                                          {p.days.map((d, dIdx) => (
                                            <div
                                              key={dIdx}
                                              className={`rounded border p-1.5 ${
                                                d.isDispatchedTo
                                                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                                                  : d.isDispatchedAway
                                                  ? 'border-amber-200 bg-amber-50/70 text-amber-900'
                                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                                              }`}
                                            >
                                              <div className="font-bold flex justify-between">
                                                <span>Ngày {d.dayOfMonth}/{thang}</span>
                                                <span className="text-blue-700 font-extrabold">{d.hours}h</span>
                                              </div>
                                              <div className="text-[10px] text-slate-500 truncate">
                                                {d.shift || 'Ca làm'} {d.startTime ? `(${d.startTime}-${d.endTime})` : ''}
                                              </div>
                                              {d.dispatchNote && (
                                                <div className="mt-0.5 text-[9.5px] italic text-slate-600 line-clamp-1" title={d.dispatchNote}>
                                                  {d.dispatchNote}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-300 bg-slate-100/80 font-bold text-slate-900">
                          <tr>
                            <td colSpan={4} className="px-3.5 py-2.5 text-right uppercase">
                              Tổng cộng {mach.machineName}:
                            </td>
                            <td className="px-3.5 py-2.5 text-center">{mach.totalPersonnel} người</td>
                            <td className="px-3.5 py-2.5 text-right text-blue-800 text-sm">
                              {mach.totalHours.toLocaleString('vi-VN')} h
                            </td>
                            <td className="px-3.5 py-2.5 text-right">—</td>
                            <td className="px-3.5 py-2.5 text-right text-emerald-800 text-sm">
                              {mach.totalCost.toLocaleString('vi-VN')} đ
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. BẢNG Ở CUỐI: TÍNH TỔNG TOÀN BỘ NHÂN CÔNG THEO NGÀY, THÁNG (GỒM TẤT CẢ CÁC MÁY ĐƯỢC CHỌN) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <span>3. Bảng tổng hợp toàn bộ nhân công theo ngày & tháng (Tất cả máy được chọn)</span>
          </h2>
        </div>

        {/* BẢNG A: TỔNG HỢP THEO NGÀY TRONG THÁNG */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-brand-600" />
            <span>A. Nhân công theo ngày trong tháng {thang}/{nam}</span>
          </h3>
          <div className="max-h-[min(420px,55vh)] overflow-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-center w-12">Ngày</th>
                  <th className="px-3 py-2 text-center w-24">Thứ</th>
                  <th className="px-3 py-2 text-center w-24">Số người làm</th>
                  {calculatedResult.machineDetails.map(m => (
                    <th key={m.machineCode} className="px-3 py-2 text-right">
                      {m.machineName} (h)
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-extrabold text-blue-700 bg-blue-50/50">
                    Tổng giờ (h)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calculatedResult.dailySummary.map(d => {
                  const isWeekend = d.dayOfWeekVi === 'Chủ nhật';
                  return (
                    <tr
                      key={d.date}
                      className={`hover:bg-slate-50 transition ${
                        isWeekend ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-3 py-1.5 text-center font-bold text-slate-800">
                        {d.dayOfMonth}
                      </td>
                      <td className="px-3 py-1.5 text-center text-slate-500 font-medium">
                        {d.dayOfWeekVi}
                      </td>
                      <td className="px-3 py-1.5 text-center font-semibold text-slate-700">
                        {d.totalPersonnel > 0 ? d.totalPersonnel : '—'}
                      </td>
                      {calculatedResult.machineDetails.map(m => {
                        const h = d.machineHours[m.machineCode] || 0;
                        return (
                          <td key={m.machineCode} className="px-3 py-1.5 text-right font-medium text-slate-600">
                            {h > 0 ? h.toLocaleString('vi-VN') : '—'}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 text-right font-bold text-blue-700 bg-blue-50/30">
                        {d.totalHours > 0 ? `${d.totalHours.toLocaleString('vi-VN')} h` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                <tr>
                  <td colSpan={2} className="px-3 py-2.5 text-center uppercase">
                    Tổng cả tháng:
                  </td>
                  <td className="px-3 py-2.5 text-center font-extrabold text-slate-900">
                    {calculatedResult.grandTotal.totalPersonnel} người
                  </td>
                  {calculatedResult.machineDetails.map(m => (
                    <td key={m.machineCode} className="px-3 py-2.5 text-right font-extrabold text-slate-900">
                      {m.totalHours.toLocaleString('vi-VN')} h
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-extrabold text-blue-800 text-sm bg-blue-100/50">
                    {calculatedResult.grandTotal.totalHours.toLocaleString('vi-VN')} h
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* BẢNG B: TỔNG HỢP THEO NHÂN SỰ TOÀN BỘ CÁC MÁY */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-brand-600 pointer-events-none" />
              <span>B. Tổng hợp thời gian & Chi phí theo từng nhân sự qua các máy</span>
            </h3>
            <div className="relative w-full max-w-xs sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={personNameSearch}
                onChange={e => setPersonNameSearch(e.target.value)}
                placeholder="Tìm theo họ và tên..."
                className="h-8 w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-8 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {personNameSearch && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  onClick={() => setPersonNameSearch('')}
                  className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5 pointer-events-none" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[min(420px,55vh)] overflow-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-700">
                <tr>
                  <th className="px-3.5 py-2.5 text-center w-12">STT</th>
                  <th className="px-3.5 py-2.5">Mã NV</th>
                  <th className="px-3.5 py-2.5">Họ và tên</th>
                  <th className="px-3.5 py-2.5">Vị trí</th>
                  {calculatedResult.machineDetails.map(m => (
                    <th key={m.machineCode} className="px-3.5 py-2.5 text-right">
                      {m.machineName} (h)
                    </th>
                  ))}
                  <th className="px-3.5 py-2.5 text-right font-bold text-blue-700 bg-blue-50/50">
                    Tổng thời gian
                  </th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-indigo-700">
                    Số công (8h)
                  </th>
                  <th className="px-3.5 py-2.5 text-right">Đơn giá (đ/h)</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-emerald-700 bg-emerald-50/50">
                    Tổng thành tiền (đ)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPersonSummary.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7 + calculatedResult.machineDetails.length}
                      className="px-3.5 py-6 text-center text-slate-400"
                    >
                      {personNameSearch.trim()
                        ? `Không tìm thấy nhân sự khớp “${personNameSearch.trim()}”.`
                        : 'Chưa có dữ liệu nhân sự.'}
                    </td>
                  </tr>
                ) : (
                  filteredPersonSummary.map((p, idx) => (
                  <tr key={p.personCode} className="hover:bg-slate-50 transition">
                    <td className="px-3.5 py-2.5 text-center text-slate-400 font-medium">{idx + 1}</td>
                    <td className="px-3.5 py-2.5 font-mono font-medium text-slate-700">{p.personCode}</td>
                    <td className="px-3.5 py-2.5 font-bold text-slate-900">{p.personName}</td>
                    <td className="px-3.5 py-2.5 text-slate-600">{p.role || '—'}</td>
                    {calculatedResult.machineDetails.map(m => {
                      const h = p.machineHours[m.machineCode] || 0;
                      return (
                        <td key={m.machineCode} className="px-3.5 py-2.5 text-right font-medium text-slate-600">
                          {h > 0 ? h.toLocaleString('vi-VN') : '—'}
                        </td>
                      );
                    })}
                    <td className="px-3.5 py-2.5 text-right font-extrabold text-blue-700 bg-blue-50/30">
                      {p.totalHours.toLocaleString('vi-VN')} h
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-indigo-700">
                      {p.standardWorkDays.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={hourlyRates[p.personCode] ?? p.hourlyRate ?? 0}
                        onChange={e => handleRateChange(p.personCode, Number(e.target.value) || 0)}
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-extrabold text-emerald-700 bg-emerald-50/30">
                      {p.totalCost.toLocaleString('vi-VN')} đ
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
              <tfoot className="sticky bottom-0 border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                <tr>
                  <td colSpan={4} className="px-3.5 py-2.5 text-right uppercase">
                    Tổng cộng toàn bộ nhân sự:
                  </td>
                  {calculatedResult.machineDetails.map(m => (
                    <td key={m.machineCode} className="px-3.5 py-2.5 text-right font-extrabold text-slate-900">
                      {m.totalHours.toLocaleString('vi-VN')} h
                    </td>
                  ))}
                  <td className="px-3.5 py-2.5 text-right font-extrabold text-blue-800 text-sm bg-blue-100/50">
                    {calculatedResult.grandTotal.totalHours.toLocaleString('vi-VN')} h
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-extrabold text-indigo-800 text-sm">
                    {calculatedResult.grandTotal.totalStandardDays.toLocaleString('vi-VN')}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">—</td>
                  <td className="px-3.5 py-2.5 text-right font-extrabold text-emerald-800 text-sm bg-emerald-100/50">
                    {calculatedResult.grandTotal.totalCost.toLocaleString('vi-VN')} đ
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Ghi chú */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Ghi chú thêm về bảng chi phí
          </label>
          <textarea
            rows={2}
            value={ghiChu}
            onChange={e => setGhiChu(e.target.value)}
            placeholder="Nhập ghi chú hoặc lý do điều chỉnh nếu có..."
            className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      </div>
    </div>
  );
}
