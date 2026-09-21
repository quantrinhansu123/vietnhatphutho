import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Printer, Loader2, Scale, RotateCcw, CheckSquare, Square,
  Save, FolderOpen, Trash2, CalendarDays, CalendarRange
} from 'lucide-react';
import type { MachineInfo, DinhGiaNhanCongReport, DinhGiaNhanCongSavedRow } from './types';
import { MonthYearPickerVi } from './MonthYearPickerVi';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from '../../components/layout/constants';
import { waitForPrintImagesReady } from '../../utils/printReady';

export interface DinhGiaMachineRow {
  code: string;
  name: string;
  costCur: number;
  costPrev: number;
  qtyCur: number;
  donGiaCur: number;
  donGiaPrev: number;
  diff: number;
  impact: number;
}

type TabId = 'thang' | 'nam';
type YearMode = 'cung-thang' | 'cong-don';

function toNum(v: unknown): number {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function prevMonthOf(thang: number, nam: number): { thang: number; nam: number } {
  if (thang <= 1) return { thang: 12, nam: nam - 1 };
  return { thang: thang - 1, nam };
}

function tlThucTeOfDot(d: Record<string, any>): number {
  const override = toNum(d.tl_chinh_thuc_te_override ?? d.tl_chinh_thuc_te);
  if (override > 0) return override;
  const chinh = toNum(d.tong_tl_nvl_chinh);
  const thu = toNum(d.thu_hoi_phe_tl);
  const hao = toNum(d.hao_hut_kg);
  return Math.max(0, chinh - thu - hao);
}

function tlThucTeOfBaoCaoThang(r: Record<string, any>): number {
  const tl = toNum(r.tl_chinh_thuc_te);
  if (tl > 0) return tl;
  return Math.max(0, toNum(r.tong_tl_nvl_chinh) - toNum(r.thu_hoi_phe_tl) - toNum(r.hao_hut_kg));
}

function mayMatches(dMayCodes: Array<unknown>, code: string, name: string): boolean {
  const c = code.trim().toLowerCase();
  const n = name.trim().toLowerCase();
  for (const raw of dMayCodes) {
    const v = String(raw || '').trim().toLowerCase();
    if (!v) continue;
    if (v === c || v === n) return true;
  }
  return false;
}

/** Gom tổng chi phí nhân công theo từng mã máy từ các bản ghi chi_phi_nhan_cong. */
function aggregateCostByMachine(items: any[]): Map<string, number> {
  const map = new Map<string, number>();
  const add = (code: string, cost: number) => {
    const key = String(code || '').trim().toLowerCase();
    if (!key || !Number.isFinite(cost)) return;
    map.set(key, (map.get(key) || 0) + cost);
  };
  for (const it of items || []) {
    const details = it?.chi_tiet?.machineDetails;
    if (Array.isArray(details) && details.length > 0) {
      for (const m of details) {
        add(String(m.machineCode || ''), toNum(m.totalCost));
      }
      continue;
    }
    // Fallback khi bản ghi cũ không có chi_tiet: chỉ gán khi ghi đúng 1 máy
    const codes: string[] = Array.isArray(it?.ma_may_list) ? it.ma_may_list.map((x: any) => String(x)) : [];
    const total = toNum(it?.tong_chi_phi);
    if (codes.length === 1 && codes[0].trim()) {
      add(codes[0], total);
    }
  }
  return map;
}

/** Gom sản lượng (kg thực tế) theo từng mã máy của 1 tháng: ưu tiên báo cáo tháng đã lưu, thiếu thì cộng từ đợt SX. */
async function fetchQtyByMachine(
  thang: number,
  nam: number,
  machines: MachineInfo[]
): Promise<{ qty: Map<string, number>; source: Map<string, string> }> {
  const qty = new Map<string, number>();
  const source = new Map<string, string>();
  const keyOf = (code: string) => code.trim().toLowerCase();

  // 1. Báo cáo tháng đã lưu
  try {
    const res = await fetch(`/api/bao-cao-thang?thang=${thang}&nam=${nam}&limit=200`);
    const data = await res.json().catch(() => ({}));
    const reports: any[] = Array.isArray(data.reports) ? data.reports : [];
    for (const m of machines) {
      const found = reports.find(r =>
        mayMatches([r.ma_may, r.ten_may], m.code, m.name)
      );
      if (found) {
        const finalQty = tlThucTeOfBaoCaoThang(found);
        if (finalQty > 0) {
          qty.set(keyOf(m.code), finalQty);
          source.set(keyOf(m.code), 'Báo cáo tháng');
        }
      }
    }
  } catch {
    /* bỏ qua, dùng đợt SX */
  }

  // 2. Đợt sản xuất cho các máy còn thiếu sản lượng
  const missing = machines.filter(m => !(qty.get(keyOf(m.code)) || 0));
  if (missing.length > 0) {
    try {
      const res = await fetch(`/api/dot-san-xuat?thang=${thang}&nam=${nam}&limit=500`);
      const data = await res.json().catch(() => ({}));
      const dots: any[] = Array.isArray(data.dots) ? data.dots : [];
      for (const m of missing) {
        let sum = 0;
        for (const d of dots) {
          if (mayMatches([d.ma_may, d.ten_may], m.code, m.name)) {
            sum += tlThucTeOfDot(d);
          }
        }
        if (sum > 0) {
          qty.set(keyOf(m.code), Math.round(sum * 1000) / 1000);
          source.set(keyOf(m.code), 'Đợt sản xuất');
        }
      }
    } catch {
      /* giữ 0 để người dùng nhập tay */
    }
  }
  return { qty, source };
}

/**
 * Tổng hợp 1 năm (phạm vi tháng tu-den) theo từng máy:
 * - Chi phí: 1 gọi /api/chi-phi-nhan-cong?nam, lọc tháng ở client.
 * - Sản lượng: gọi /api/bao-cao-thang từng tháng (song song) + 1 gọi đợt SX cả năm làm dự phòng.
 */
async function fetchYearMachineData(
  nam: number,
  tu: number,
  den: number,
  machines: MachineInfo[]
): Promise<{ cost: Map<string, number>; qty: Map<string, number>; source: Map<string, string> }> {
  const keyOf = (code: string) => code.trim().toLowerCase();
  const months: number[] = [];
  for (let m = Math.max(1, tu); m <= Math.min(12, den); m++) months.push(m);

  const [costRes, dotRes, ...reportResults] = await Promise.all([
    fetch(`/api/chi-phi-nhan-cong?nam=${nam}`).then(r => r.json().catch(() => ({ items: [] }))),
    fetch(`/api/dot-san-xuat?nam=${nam}&limit=500`).then(r => r.json().catch(() => ({ dots: [] }))),
    ...months.map(m =>
      fetch(`/api/bao-cao-thang?thang=${m}&nam=${nam}&limit=200`).then(r => r.json().catch(() => ({ reports: [] })))
    )
  ]);

  const costItems = (Array.isArray(costRes.items) ? costRes.items : []).filter((it: any) => {
    const t = Number(it.thang);
    return t >= Math.max(1, tu) && t <= Math.min(12, den);
  });
  const cost = aggregateCostByMachine(costItems);
  const dots: any[] = Array.isArray(dotRes.dots) ? dotRes.dots : [];

  const qty = new Map<string, number>();
  const source = new Map<string, string>();
  for (const m of machines) {
    const k = keyOf(m.code);
    let sum = 0;
    let reportMonths = 0;
    let dotMonths = 0;
    months.forEach((month, idx) => {
      const data = reportResults[idx] || {};
      const reports: any[] = Array.isArray(data.reports) ? data.reports : [];
      const found = reports.find(r => mayMatches([r.ma_may, r.ten_may], m.code, m.name));
      const reportQty = found ? tlThucTeOfBaoCaoThang(found) : 0;
      if (reportQty > 0) {
        sum += reportQty;
        reportMonths++;
      } else {
        let dotSum = 0;
        for (const d of dots) {
          if (Number(d.thang) === month && mayMatches([d.ma_may, d.ten_may], m.code, m.name)) {
            dotSum += tlThucTeOfDot(d);
          }
        }
        if (dotSum > 0) {
          sum += dotSum;
          dotMonths++;
        }
      }
    });
    if (sum > 0) {
      qty.set(k, Math.round(sum * 1000) / 1000);
      const parts: string[] = [];
      if (reportMonths > 0) parts.push(`Báo cáo tháng (${reportMonths} th)`);
      if (dotMonths > 0) parts.push(`Đợt SX (${dotMonths} th)`);
      source.set(k, parts.join(' + '));
    }
  }
  return { cost, qty, source };
}

function YearPicker({
  value,
  onChange,
  label
}: {
  value: number;
  onChange: (y: number) => void;
  label: string;
}) {
  const clamp = (y: number) => Math.min(2999, Math.max(1, Number.isFinite(y) ? Math.floor(y) : 1));
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-slate-700">{label}</span>
      <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          className="rounded px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100"
          aria-label="Năm trước"
        >
          ‹
        </button>
        <input
          type="number"
          min={1}
          max={2999}
          value={value}
          onChange={e => onChange(clamp(Number(e.target.value) || 1))}
          className="w-16 bg-transparent text-center text-xs font-bold text-slate-800 outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          className="rounded px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100"
          aria-label="Năm sau"
        >
          ›
        </button>
      </div>
    </div>
  );
}

function MonthSelect({
  value,
  onChange,
  label
}: {
  value: number;
  onChange: (m: number) => void;
  label: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value) || 1)}
        className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm outline-none focus:border-brand-500"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            Tháng {i + 1}
          </option>
        ))}
      </select>
    </div>
  );
}

interface DinhGiaNhanCongModalProps {
  open: boolean;
  onClose: () => void;
  machines: MachineInfo[];
  defaultThang: number;
  defaultNam: number;
  defaultTab?: TabId;
  currentUser?: any;
}

export function DinhGiaNhanCongModal({
  open,
  onClose,
  machines,
  defaultThang,
  defaultNam,
  defaultTab,
  currentUser
}: DinhGiaNhanCongModalProps) {
  const [tab, setTab] = useState<TabId>('thang');

  // ---- Tab tháng ----
  const [thang, setThang] = useState(defaultThang);
  const [nam, setNam] = useState(defaultNam);
  const autoPrev = useMemo(() => prevMonthOf(thang, nam), [thang, nam]);
  const [prevThang, setPrevThang] = useState(autoPrev.thang);
  const [prevNam, setPrevNam] = useState(autoPrev.nam);
  const [prevTouched, setPrevTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [costCurMap, setCostCurMap] = useState<Record<string, number>>({});
  const [costPrevMap, setCostPrevMap] = useState<Record<string, number>>({});
  const [qtyCurMap, setQtyCurMap] = useState<Record<string, number>>({});
  const [qtySource, setQtySource] = useState<Record<string, string>>({});
  const [prevQtyAutoMap, setPrevQtyAutoMap] = useState<Record<string, number>>({});
  const [donGiaPrevOverride, setDonGiaPrevOverride] = useState<Record<string, number>>({});

  // ---- Tab năm ----
  const [yearMode, setYearMode] = useState<YearMode>('cung-thang');
  const [refThang, setRefThang] = useState(defaultThang);
  const [yearCur, setYearCur] = useState(defaultNam);
  const [yearPrev, setYearPrev] = useState(defaultNam - 1);
  const [tuThang, setTuThang] = useState(1);
  const [denThang, setDenThang] = useState(12);
  const [yLoading, setYLoading] = useState(false);
  const [yCostCur, setYCostCur] = useState<Record<string, number>>({});
  const [yCostPrev, setYCostPrev] = useState<Record<string, number>>({});
  const [yQtyCur, setYQtyCur] = useState<Record<string, number>>({});
  const [yPrevQtyAuto, setYPrevQtyAuto] = useState<Record<string, number>>({});
  const [yQtySource, setYQtySource] = useState<Record<string, string>>({});
  const [yOverride, setYOverride] = useState<Record<string, number>>({});

  // ---- Dùng chung ----
  const [selectedCodes, setSelectedCodes] = useState<string[]>(() => machines.map(m => m.code));
  const [pendingPrint, setPendingPrint] = useState(false);
  const suspendAutoRef = useRef(false);

  // ---- Lưu / tải báo cáo ----
  const [tenBaoCao, setTenBaoCao] = useState('');
  const [nguoiLap, setNguoiLap] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [savedList, setSavedList] = useState<DinhGiaNhanCongReport[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Đồng bộ mặc định khi mở modal
  useEffect(() => {
    if (open) {
      setTab(defaultTab ?? 'thang');
      setThang(defaultThang);
      setNam(defaultNam);
      const p = prevMonthOf(defaultThang, defaultNam);
      setPrevThang(p.thang);
      setPrevNam(p.nam);
      setPrevTouched(false);
      setYearMode('cung-thang');
      setRefThang(defaultThang);
      setYearCur(defaultNam);
      setYearPrev(defaultNam - 1);
      setTuThang(1);
      setDenThang(12);
      setSelectedCodes(machines.map(m => m.code));
      setPendingPrint(false);
      setTenBaoCao('');
      setLoadedId(null);
      setSaveMsg('');
      setNguoiLap(currentUser?.name || currentUser?.username || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tháng so sánh tự bám theo tháng đánh giá nếu người dùng chưa sửa tay
  useEffect(() => {
    if (!prevTouched) {
      setPrevThang(autoPrev.thang);
      setPrevNam(autoPrev.nam);
    }
  }, [autoPrev, prevTouched]);

  useEffect(() => {
    if (!open) setPendingPrint(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ===== TAB THÁNG: tải số liệu =====
  const loadData = async () => {
    if (machines.length === 0) return;
    setLoading(true);
    try {
      const [curRes, prevRes] = await Promise.all([
        fetch(`/api/chi-phi-nhan-cong?thang=${thang}&nam=${nam}`).then(r => r.json().catch(() => ({ items: [] }))),
        fetch(`/api/chi-phi-nhan-cong?thang=${prevThang}&nam=${prevNam}`).then(r => r.json().catch(() => ({ items: [] })))
      ]);
      const curMap = aggregateCostByMachine(Array.isArray(curRes.items) ? curRes.items : []);
      const prevMap = aggregateCostByMachine(Array.isArray(prevRes.items) ? prevRes.items : []);
      const { qty, source } = await fetchQtyByMachine(thang, nam, machines);

      const cCur: Record<string, number> = {};
      const cPrev: Record<string, number> = {};
      const qCur: Record<string, number> = {};
      const qSrc: Record<string, string> = {};
      for (const m of machines) {
        const k = m.code.trim().toLowerCase();
        cCur[m.code] = Math.round(curMap.get(k) || 0);
        cPrev[m.code] = Math.round(prevMap.get(k) || 0);
        const autoQty = qty.get(k) || 0;
        qCur[m.code] = autoQty > 0 ? autoQty : 0;
        if (source.get(k)) qSrc[m.code] = source.get(k)!;
      }
      setCostCurMap(cCur);
      setCostPrevMap(cPrev);
      setQtyCurMap(prevQty => {
        const next = { ...qCur };
        for (const [code, val] of Object.entries(prevQty)) {
          if (val > 0 && !(next[code] > 0)) next[code] = val;
        }
        return next;
      });
      setQtySource(qSrc);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || tab !== 'thang' || machines.length === 0) return;
    if (suspendAutoRef.current) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, thang, nam, prevThang, prevNam]);

  useEffect(() => {
    if (!open || tab !== 'thang' || machines.length === 0) return;
    if (suspendAutoRef.current) return;
    let alive = true;
    (async () => {
      try {
        const { qty } = await fetchQtyByMachine(prevThang, prevNam, machines);
        if (!alive) return;
        const next: Record<string, number> = {};
        for (const m of machines) {
          next[m.code] = qty.get(m.code.trim().toLowerCase()) || 0;
        }
        setPrevQtyAutoMap(next);
      } catch {
        if (alive) setPrevQtyAutoMap({});
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, prevThang, prevNam, machines.length]);

  // Đổi kỳ so sánh thì xóa ghi đè tay để số tự tính lại đúng kỳ mới
  useEffect(() => {
    if (open && !suspendAutoRef.current) setDonGiaPrevOverride({});
  }, [open, prevThang, prevNam]);

  // ===== TAB NĂM: tải số liệu (tổng hợp từ định giá theo tháng) =====
  const loadYearData = async () => {
    if (machines.length === 0) return;
    setYLoading(true);
    try {
      if (yearMode === 'cung-thang') {
        // Cùng 1 tháng ở 2 năm (VD T8/2026 vs T8/2025)
        const [curRes, prevRes] = await Promise.all([
          fetch(`/api/chi-phi-nhan-cong?thang=${refThang}&nam=${yearCur}`).then(r => r.json().catch(() => ({ items: [] }))),
          fetch(`/api/chi-phi-nhan-cong?thang=${refThang}&nam=${yearPrev}`).then(r => r.json().catch(() => ({ items: [] })))
        ]);
        const curMap = aggregateCostByMachine(Array.isArray(curRes.items) ? curRes.items : []);
        const prevMap = aggregateCostByMachine(Array.isArray(prevRes.items) ? prevRes.items : []);
        const [{ qty: qtyCur, source: srcCur }, { qty: qtyPrev }] = await Promise.all([
          fetchQtyByMachine(refThang, yearCur, machines),
          fetchQtyByMachine(refThang, yearPrev, machines)
        ]);
        const cCur: Record<string, number> = {};
        const cPrev: Record<string, number> = {};
        const qCur: Record<string, number> = {};
        const qPrev: Record<string, number> = {};
        const qSrc: Record<string, string> = {};
        for (const m of machines) {
          const k = m.code.trim().toLowerCase();
          cCur[m.code] = Math.round(curMap.get(k) || 0);
          cPrev[m.code] = Math.round(prevMap.get(k) || 0);
          qCur[m.code] = qtyCur.get(k) || 0;
          qPrev[m.code] = qtyPrev.get(k) || 0;
          if (srcCur.get(k)) qSrc[m.code] = srcCur.get(k)!;
        }
        setYCostCur(cCur);
        setYCostPrev(cPrev);
        setYQtyCur(prevQty => {
          const next = { ...qCur };
          for (const [code, val] of Object.entries(prevQty)) {
            if (val > 0 && !(next[code] > 0)) next[code] = val;
          }
          return next;
        });
        setYPrevQtyAuto(qPrev);
        setYQtySource(qSrc);
      } else {
        // Cộng dồn chi phí & sản lượng theo phạm vi tháng
        const tu = Math.min(tuThang, denThang);
        const den = Math.max(tuThang, denThang);
        const [cur, prev] = await Promise.all([
          fetchYearMachineData(yearCur, tu, den, machines),
          fetchYearMachineData(yearPrev, tu, den, machines)
        ]);
        const cCur: Record<string, number> = {};
        const cPrev: Record<string, number> = {};
        const qCur: Record<string, number> = {};
        const qPrev: Record<string, number> = {};
        const qSrc: Record<string, string> = {};
        for (const m of machines) {
          const k = m.code.trim().toLowerCase();
          cCur[m.code] = Math.round(cur.cost.get(k) || 0);
          cPrev[m.code] = Math.round(prev.cost.get(k) || 0);
          qCur[m.code] = cur.qty.get(k) || 0;
          qPrev[m.code] = prev.qty.get(k) || 0;
          if (cur.source.get(k)) qSrc[m.code] = cur.source.get(k)!;
        }
        setYCostCur(cCur);
        setYCostPrev(cPrev);
        setYQtyCur(prevQty => {
          const next = { ...qCur };
          for (const [code, val] of Object.entries(prevQty)) {
            if (val > 0 && !(next[code] > 0)) next[code] = val;
          }
          return next;
        });
        setYPrevQtyAuto(qPrev);
        setYQtySource(qSrc);
      }
    } finally {
      setYLoading(false);
    }
  };

  useEffect(() => {
    if (!open || tab !== 'nam' || machines.length === 0) return;
    if (suspendAutoRef.current) return;
    loadYearData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, yearMode, refThang, yearCur, yearPrev, tuThang, denThang]);

  useEffect(() => {
    if (open && !suspendAutoRef.current) setYOverride({});
  }, [open, yearMode, refThang, yearCur, yearPrev, tuThang, denThang]);

  // ===== Tính toán dòng =====
  const toggleMachine = (code: string) => {
    setSelectedCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  function buildRows(
    costCur: Record<string, number>,
    costPrev: Record<string, number>,
    qtyCur: Record<string, number>,
    qtyPrevAuto: Record<string, number>,
    override: Record<string, number>
  ): DinhGiaMachineRow[] {
    return selectedCodes
      .map(code => machines.find(m => m.code === code))
      .filter((m): m is MachineInfo => Boolean(m))
      .map(m => {
        const cCur = toNum(costCur[m.code]);
        const cPrev = toNum(costPrev[m.code]);
        const qCur = toNum(qtyCur[m.code]);
        const donGiaCur = qCur > 0 ? Math.round(cCur / qCur) : 0;
        const autoPrev = toNum(qtyPrevAuto[m.code]) > 0
          ? Math.round(cPrev / toNum(qtyPrevAuto[m.code]))
          : 0;
        const hasOverride = Object.prototype.hasOwnProperty.call(override, m.code);
        const donGiaPrev = hasOverride ? toNum(override[m.code]) : autoPrev;
        const diff = donGiaCur - donGiaPrev;
        return {
          code: m.code,
          name: m.name || m.code,
          costCur: cCur,
          costPrev: cPrev,
          qtyCur: qCur,
          donGiaCur,
          donGiaPrev,
          diff,
          impact: Math.round(diff * qCur)
        };
      });
  }

  const monthRows = useMemo(
    () => buildRows(costCurMap, costPrevMap, qtyCurMap, prevQtyAutoMap, donGiaPrevOverride),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCodes, machines, costCurMap, costPrevMap, qtyCurMap, prevQtyAutoMap, donGiaPrevOverride]
  );

  const yearRows = useMemo(
    () => buildRows(yCostCur, yCostPrev, yQtyCur, yPrevQtyAuto, yOverride),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCodes, machines, yCostCur, yCostPrev, yQtyCur, yPrevQtyAuto, yOverride]
  );

  const activeRows = tab === 'thang' ? monthRows : yearRows;

  // ===== Nhãn hiển thị theo tab =====
  const rangeSuffix =
    yearMode === 'cong-don' && (Math.min(tuThang, denThang) !== 1 || Math.max(tuThang, denThang) !== 12)
      ? ` (T${Math.min(tuThang, denThang)}–T${Math.max(tuThang, denThang)})`
      : '';

  const labels = useMemo(() => {
    if (tab === 'thang') {
      return {
        title: `Đánh giá định mức nhân công T${thang}/${nam} so với T${prevThang}/${prevNam}`,
        colCur: `T${thang}/${nam}`,
        colPrev: `T${prevThang}/${prevNam}`,
        scopeCur: `trong tháng ${thang}/${nam}`,
        scopePrev: `T${prevThang}/${prevNam}`,
        project: `Định mức nhân công · Tháng ${thang}/${nam} so với Tháng ${prevThang}/${prevNam}`,
        meta: [
          { label: 'Tháng đánh giá', value: `Tháng ${thang}/${nam}` },
          { label: 'Tháng so sánh', value: `Tháng ${prevThang}/${prevNam}` }
        ] as Array<{ label: string; value: string }>
      };
    }
    if (yearMode === 'cung-thang') {
      return {
        title: `Đánh giá định mức nhân công ${yearCur} so với năm ${yearPrev}`,
        colCur: `${yearCur}`,
        colPrev: `${yearPrev}`,
        scopeCur: `trong tháng ${refThang}/${yearCur}`,
        scopePrev: `T${refThang}/${yearPrev}`,
        project: `Định mức nhân công · Tháng ${refThang}/${yearCur} so với Tháng ${refThang}/${yearPrev}`,
        meta: [
          { label: 'Năm đánh giá', value: `${yearCur} (tháng ${refThang})` },
          { label: 'Năm so sánh', value: `${yearPrev} (tháng ${refThang})` }
        ] as Array<{ label: string; value: string }>
      };
    }
    return {
      title: `Đánh giá định mức nhân công ${yearCur} so với năm ${yearPrev}`,
      colCur: `${yearCur}`,
      colPrev: `${yearPrev}`,
      scopeCur: `năm ${yearCur}${rangeSuffix}`,
      scopePrev: `năm ${yearPrev}${rangeSuffix}`,
      project: `Định mức nhân công · Năm ${yearCur}${rangeSuffix} so với Năm ${yearPrev}${rangeSuffix}`,
      meta: [
        { label: 'Năm đánh giá', value: `${yearCur}${rangeSuffix}` },
        { label: 'Năm so sánh', value: `${yearPrev}${rangeSuffix}` }
      ] as Array<{ label: string; value: string }>
    };
  }, [tab, thang, nam, prevThang, prevNam, yearMode, refThang, yearCur, yearPrev, rangeSuffix]);

  // ===== Lưu / tải báo cáo đã lưu =====
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoadingSaved(true);
    fetch(`/api/dinh-gia-nhan-cong?loai=${tab}&limit=100`)
      .then(r => r.json().catch(() => ({ items: [] })))
      .then(data => {
        if (!alive) return;
        setSavedList(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (alive) setSavedList([]);
      })
      .finally(() => {
        if (alive) setLoadingSaved(false);
      });
    return () => {
      alive = false;
    };
  }, [open, tab]);

  const reloadSavedList = async () => {
    try {
      const res = await fetch(`/api/dinh-gia-nhan-cong?loai=${tab}&limit=100`);
      const data = await res.json().catch(() => ({ items: [] }));
      setSavedList(Array.isArray(data.items) ? data.items : []);
    } catch {
      /* giữ danh sách cũ */
    }
  };

  function rowsToSave(rows: DinhGiaMachineRow[], qtyPrevMap: Record<string, number>): DinhGiaNhanCongSavedRow[] {
    return rows.map(r => ({
      code: r.code,
      name: r.name,
      costCur: r.costCur,
      costPrev: r.costPrev,
      qtyCur: r.qtyCur,
      qtyPrev: toNum(qtyPrevMap[r.code]),
      donGiaCur: r.donGiaCur,
      donGiaPrev: r.donGiaPrev,
      diff: r.diff,
      impact: r.impact
    }));
  }

  const handleSave = async () => {
    if (activeRows.length === 0) {
      setSaveMsg('Chưa có số liệu để lưu.');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      const machineNames = activeRows.map(r => r.name);
      const payload =
        tab === 'thang'
          ? {
              loai: 'thang',
              thang,
              nam,
              thang_so_sanh: prevThang,
              nam_so_sanh: prevNam,
              che_do_nam: null,
              tu_thang: null,
              den_thang: null,
              ten_bao_cao: tenBaoCao.trim() || labels.title,
              ma_may_list: activeRows.map(r => r.code),
              ten_may_list: machineNames,
              chi_tiet: { rows: rowsToSave(activeRows, prevQtyAutoMap) },
              ghi_chu: '',
              nguoi_lap: nguoiLap.trim()
            }
          : {
              loai: 'nam',
              thang: yearMode === 'cung-thang' ? refThang : null,
              nam: yearCur,
              thang_so_sanh: yearMode === 'cung-thang' ? refThang : null,
              nam_so_sanh: yearPrev,
              che_do_nam: yearMode,
              tu_thang: yearMode === 'cong-don' ? Math.min(tuThang, denThang) : null,
              den_thang: yearMode === 'cong-don' ? Math.max(tuThang, denThang) : null,
              ten_bao_cao: tenBaoCao.trim() || labels.title,
              ma_may_list: activeRows.map(r => r.code),
              ten_may_list: machineNames,
              chi_tiet: { rows: rowsToSave(activeRows, yPrevQtyAuto) },
              ghi_chu: '',
              nguoi_lap: nguoiLap.trim()
            };
      const url = loadedId ? `/api/dinh-gia-nhan-cong/${encodeURIComponent(loadedId)}` : '/api/dinh-gia-nhan-cong';
      const res = await fetch(url, {
        method: loadedId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu báo cáo định giá.');
      if (data.item?.id) setLoadedId(data.item.id);
      setSaveMsg(loadedId ? 'Đã cập nhật báo cáo định giá.' : 'Đã lưu báo cáo định giá.');
      reloadSavedList();
    } catch (err: any) {
      setSaveMsg(err?.message || 'Lỗi khi lưu báo cáo định giá.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSaved = (item: DinhGiaNhanCongReport) => {
    const rows = Array.isArray(item.chi_tiet?.rows) ? item.chi_tiet!.rows! : [];
    if (rows.length === 0) {
      setSaveMsg('Báo cáo này không có chi tiết dòng máy.');
      return;
    }
    suspendAutoRef.current = true;
    try {
      setLoadedId(item.id);
      setTenBaoCao(item.ten_bao_cao || '');
      setNguoiLap(item.nguoi_lap || '');
      setSaveMsg(`Đã tải "${item.ten_bao_cao}". Số liệu đã khóa theo bản lưu (đổi kỳ sẽ tải lại tự động).`);

      const knownCodes = new Set(machines.map(m => m.code));
      const codes = (Array.isArray(item.ma_may_list) && item.ma_may_list.length > 0
        ? item.ma_may_list
        : rows.map(r => r.code)
      ).filter(c => knownCodes.has(c));
      if (codes.length > 0) setSelectedCodes(codes);

      const pick = (fn: (r: DinhGiaNhanCongSavedRow) => number) => {
        const o: Record<string, number> = {};
        for (const r of rows) o[r.code] = toNum(fn(r));
        return o;
      };
      const costCur = pick(r => r.costCur);
      const costPrev = pick(r => r.costPrev);
      const qtyCur = pick(r => r.qtyCur);
      const qtyPrev = pick(r => r.qtyPrev);
      const dgPrev = pick(r => r.donGiaPrev);

      if (item.loai === 'nam') {
        setTab('nam');
        setYearMode(item.che_do_nam === 'cong-don' ? 'cong-don' : 'cung-thang');
        if (item.thang) setRefThang(item.thang);
        setYearCur(item.nam);
        if (item.nam_so_sanh) setYearPrev(item.nam_so_sanh);
        if (item.tu_thang) setTuThang(item.tu_thang);
        if (item.den_thang) setDenThang(item.den_thang);
        setYCostCur(costCur);
        setYCostPrev(costPrev);
        setYQtyCur(qtyCur);
        setYPrevQtyAuto(qtyPrev);
        setYOverride(dgPrev);
      } else {
        setTab('thang');
        if (item.thang) setThang(item.thang);
        setNam(item.nam);
        if (item.thang_so_sanh) setPrevThang(item.thang_so_sanh);
        if (item.nam_so_sanh) setPrevNam(item.nam_so_sanh);
        setPrevTouched(true);
        setCostCurMap(costCur);
        setCostPrevMap(costPrev);
        setQtyCurMap(qtyCur);
        setPrevQtyAutoMap(qtyPrev);
        setDonGiaPrevOverride(dgPrev);
      }
    } finally {
      setTimeout(() => {
        suspendAutoRef.current = false;
      }, 0);
    }
  };

  const handleDeleteSaved = async (id: string, ten: string) => {
    if (!window.confirm(`Xóa báo cáo định giá "${ten}"?`)) return;
    try {
      const res = await fetch(`/api/dinh-gia-nhan-cong/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Không thể xóa báo cáo.');
      }
      if (loadedId === id) {
        setLoadedId(null);
        setSaveMsg('Đã xóa báo cáo đang xem.');
      }
      reloadSavedList();
    } catch (err: any) {
      setSaveMsg(err?.message || 'Lỗi khi xóa báo cáo.');
    }
  };

  const handleNewReport = () => {
    setLoadedId(null);
    setTenBaoCao('');
    setSaveMsg('Đã tạo khung báo cáo mới. Nhấn "Tải lại số liệu" để lấy số tự động.');
    if (tab === 'thang') {
      setDonGiaPrevOverride({});
      loadData();
    } else {
      setYOverride({});
      loadYearData();
    }
  };

  // ===== In: dùng chung class in dot-san-xuat để tái sử dụng CSS @media print sẵn có =====
  useEffect(() => {
    if (!pendingPrint) return;
    document.body.classList.add('dot-san-xuat-print-active');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      waitForPrintImagesReady().then(() => {
        if (cancelled) return;
        window.print();
        setPendingPrint(false);
        document.body.classList.remove('dot-san-xuat-print-active');
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.body.classList.remove('dot-san-xuat-print-active');
    };
  }, [pendingPrint]);

  const printSheet = (
    <DinhGiaNhanCongPrintSheet
      title={labels.title}
      rows={activeRows}
      colCur={labels.colCur}
      colPrev={labels.colPrev}
      scopeCur={labels.scopeCur}
      scopePrev={labels.scopePrev}
      projectLine={labels.project}
      meta={labels.meta}
    />
  );

  if (!open) {
    return pendingPrint
      ? createPortal(<div className="dot-san-xuat-print-batch">{printSheet}</div>, document.body)
      : null;
  }

  const machineChips = (
    <div className="mt-3 flex flex-wrap gap-2">
      {machines.map(m => {
        const selected = selectedCodes.includes(m.code);
        return (
          <button
            key={m.code}
            type="button"
            onClick={() => toggleMachine(m.code)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
              selected
                ? 'border-brand-500 bg-brand-50 text-brand-900'
                : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'
            }`}
          >
            {selected ? <CheckSquare className="h-3.5 w-3.5 text-brand-600" /> : <Square className="h-3.5 w-3.5 text-zinc-300" />}
            {m.name || m.code}
          </button>
        );
      })}
    </div>
  );

  function renderInputTable(
    rows: DinhGiaMachineRow[],
    opts: {
      costMap: Record<string, number>;
      setCost: (code: string, v: number) => void;
      qtyMap: Record<string, number>;
      setQty: (code: string, v: number) => void;
      setDgPrev: (code: string, v: number) => void;
      qtySrc: Record<string, string>;
      colCur: string;
      colPrev: string;
    }
  ) {
    return (
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs text-zinc-600">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase text-zinc-700">
            <tr>
              <th className="px-3 py-2.5">Máy</th>
              <th className="px-3 py-2.5 text-right">Chi phí NC {opts.colCur} (đ)</th>
              <th className="px-3 py-2.5 text-right">Sản lượng {opts.colCur} (kg)</th>
              <th className="px-3 py-2.5 text-right">Đơn giá {opts.colCur} (đ/kg)</th>
              <th className="px-3 py-2.5 text-right">Đơn giá {opts.colPrev} (đ/kg)</th>
              <th className="px-3 py-2.5 text-right">Chênh lệch (đ/kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map(r => (
              <tr key={r.code} className="hover:bg-zinc-50/70">
                <td className="px-3 py-2 font-bold text-zinc-900">{r.name}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    value={opts.costMap[r.code] ?? 0}
                    onChange={e => opts.setCost(r.code, Number(e.target.value) || 0)}
                    className="h-8 w-36 rounded border border-zinc-300 px-2 text-right text-xs font-semibold"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    value={opts.qtyMap[r.code] ?? 0}
                    onChange={e => opts.setQty(r.code, Number(e.target.value) || 0)}
                    className="h-8 w-32 rounded border border-zinc-300 px-2 text-right text-xs font-semibold"
                  />
                  {opts.qtySrc[r.code] && (
                    <div className="mt-0.5 text-[10px] italic text-zinc-400">Tự động: {opts.qtySrc[r.code]}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-extrabold text-zinc-900">
                  {r.donGiaCur.toLocaleString('vi-VN')}
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    value={r.donGiaPrev}
                    onChange={e => opts.setDgPrev(r.code, Number(e.target.value) || 0)}
                    className="h-8 w-28 rounded border border-zinc-300 px-2 text-right text-xs font-semibold"
                  />
                </td>
                <td className={`px-3 py-2 text-right font-extrabold ${r.diff > 0 ? 'text-red-600' : r.diff < 0 ? 'text-blue-600' : 'text-zinc-500'}`}>
                  {r.diff > 0 ? `+${r.diff.toLocaleString('vi-VN')}` : r.diff.toLocaleString('vi-VN')}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
                  Chưa chọn máy nào để định giá.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderImageTable(rows: DinhGiaMachineRow[]) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-center text-sm font-black uppercase text-zinc-950">{labels.title}</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs" style={{ border: '1px solid #111' }}>
            <thead>
              <tr>
                <th rowSpan={2} className="border border-zinc-900 bg-zinc-100 px-2 py-2 font-black uppercase" style={{ minWidth: 110 }}>Máy</th>
                {rows.map(r => (
                  <th key={r.code} colSpan={2} className="border border-zinc-900 bg-zinc-100 px-2 py-1.5 font-black uppercase">
                    {r.name}
                  </th>
                ))}
              </tr>
              <tr>
                {rows.map(r => (
                  <React.Fragment key={r.code}>
                    <th className="border border-zinc-900 bg-white px-2 py-1 font-bold">{labels.colCur}</th>
                    <th className="border border-zinc-900 bg-white px-2 py-1 font-bold">{labels.colPrev}</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-zinc-900 bg-zinc-50 px-2 py-2 font-black uppercase leading-tight">
                  Nhân<br />công<br /><span className="normal-case">(đồng/kg)</span>
                </td>
                {rows.map(r => (
                  <React.Fragment key={r.code}>
                    <td className="border border-zinc-900 px-2 py-2 font-bold">{r.donGiaCur.toLocaleString('vi-VN')}</td>
                    <td className="border border-zinc-900 px-2 py-2 font-bold">{r.donGiaPrev.toLocaleString('vi-VN')}</td>
                  </React.Fragment>
                ))}
              </tr>
              <tr>
                <td className="border border-zinc-900 px-2 py-2 font-black text-red-600">Chênh Lệch</td>
                {rows.map(r => (
                  <td
                    key={r.code}
                    colSpan={2}
                    className={`border border-zinc-900 px-2 py-2 font-black ${r.diff !== 0 ? 'text-red-600' : 'text-zinc-500'}`}
                  >
                    {r.diff > 0 ? r.diff.toLocaleString('vi-VN') : r.diff < 0 ? `(${Math.abs(r.diff).toLocaleString('vi-VN')})` : '0'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tổng hợp câu chữ như ảnh */}
        <div className="mt-3 space-y-1.5 text-[13px] font-medium leading-relaxed">
          {rows.map(r => {
            const higher = r.diff > 0;
            const lower = r.diff < 0;
            const absDiff = Math.abs(r.diff).toLocaleString('vi-VN');
            const impactText = `${r.impact.toLocaleString('vi-VN')}đ`;
            return (
              <p key={r.code} className={higher ? 'text-red-600' : lower ? 'text-blue-700' : 'text-zinc-600'}>
                - Định mức nhân công Máy {r.name} {labels.scopeCur}{' '}
                {higher ? (
                  <>cao hơn <strong>{absDiff}đ</strong> so với {labels.scopePrev} =&gt; <strong>{impactText}</strong></>
                ) : lower ? (
                  <>thấp hơn <strong>{absDiff} đồng</strong> so với {labels.scopePrev} =&gt; <strong>{impactText}</strong></>
                ) : (
                  <>bằng so với {labels.scopePrev} =&gt; <strong>0đ</strong></>
                )}
              </p>
            );
          })}
        </div>
      </div>
    );
  }

  const periodLabel = (item: DinhGiaNhanCongReport): string => {
    if (item.loai === 'nam') {
      if (item.che_do_nam === 'cong-don' && item.tu_thang && item.den_thang) {
        return `Năm ${item.nam} (T${item.tu_thang}–T${item.den_thang}) vs ${item.nam_so_sanh}`;
      }
      if (item.thang) return `T${item.thang}/${item.nam} vs T${item.thang}/${item.nam_so_sanh}`;
      return `Năm ${item.nam} vs ${item.nam_so_sanh}`;
    }
    return `T${item.thang}/${item.nam} vs T${item.thang_so_sanh}/${item.nam_so_sanh}`;
  };

  return (
    <>
      {pendingPrint && createPortal(<div className="dot-san-xuat-print-batch">{printSheet}</div>, document.body)}

      <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-brand-100 p-2 text-brand-700">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-950">{labels.title}</h3>
                <p className="mt-0.5 text-xs font-medium text-zinc-500">
                  Đơn giá (đồng/kg) = Tổng chi phí nhân công / Sản lượng kg · Chênh lệch × Sản lượng kỳ này = Tác động tiền
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingPrint(true)}
                disabled={pendingPrint || activeRows.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white shadow transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                {pendingPrint ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                In
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                aria-label="Đóng định giá"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-zinc-200 bg-zinc-50 px-4 pt-2 sm:px-5">
            <button
              type="button"
              onClick={() => setTab('thang')}
              className={`inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs font-bold transition ${
                tab === 'thang'
                  ? 'border border-b-0 border-zinc-200 bg-white text-brand-700'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Theo tháng
            </button>
            <button
              type="button"
              onClick={() => setTab('nam')}
              className={`inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs font-bold transition ${
                tab === 'nam'
                  ? 'border border-b-0 border-zinc-200 bg-white text-brand-700'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Theo năm
            </button>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-zinc-50 px-4 py-4 sm:px-5">
            {tab === 'thang' ? (
              <>
                <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-end gap-3">
                    <MonthYearPickerVi
                      thang={thang}
                      nam={nam}
                      onChange={(t, y) => {
                        setThang(t);
                        setNam(y);
                      }}
                      label="Tháng đánh giá"
                    />
                    <MonthYearPickerVi
                      thang={prevThang}
                      nam={prevNam}
                      onChange={(t, y) => {
                        setPrevThang(t);
                        setPrevNam(y);
                        setPrevTouched(true);
                      }}
                      label="Tháng so sánh"
                    />
                    <button
                      type="button"
                      onClick={loadData}
                      disabled={loading}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? 'Đang tải...' : 'Tải lại số liệu'}
                    </button>
                    <span className="text-[11px] italic text-zinc-400">
                      Chi phí tự lấy từ Chi phí nhân công · Sản lượng tự lấy từ Báo cáo tháng / Đợt SX (sửa tay được).
                    </span>
                  </div>
                  {machineChips}
                </div>

                {renderInputTable(monthRows, {
                  costMap: costCurMap,
                  setCost: (code, v) => setCostCurMap(prev => ({ ...prev, [code]: v })),
                  qtyMap: qtyCurMap,
                  setQty: (code, v) => setQtyCurMap(prev => ({ ...prev, [code]: v })),
                  setDgPrev: (code, v) => setDonGiaPrevOverride(prev => ({ ...prev, [code]: v })),
                  qtySrc: qtySource,
                  colCur: labels.colCur,
                  colPrev: labels.colPrev
                })}
                {renderImageTable(monthRows)}
              </>
            ) : (
              <>
                <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setYearMode('cung-thang')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        yearMode === 'cung-thang'
                          ? 'bg-brand-600 text-white shadow'
                          : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      Cùng tháng, khác năm (VD T8/2026 vs T8/2025)
                    </button>
                    <button
                      type="button"
                      onClick={() => setYearMode('cong-don')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        yearMode === 'cong-don'
                          ? 'bg-brand-600 text-white shadow'
                          : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      Cộng dồn theo phạm vi tháng
                    </button>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    {yearMode === 'cung-thang' ? (
                      <MonthSelect value={refThang} onChange={setRefThang} label="Tháng tham chiếu" />
                    ) : (
                      <>
                        <MonthSelect
                          value={Math.min(tuThang, denThang)}
                          onChange={v => setTuThang(v)}
                          label="Từ tháng"
                        />
                        <MonthSelect
                          value={Math.max(tuThang, denThang)}
                          onChange={v => setDenThang(v)}
                          label="Đến tháng"
                        />
                      </>
                    )}
                    <YearPicker value={yearCur} onChange={setYearCur} label="Năm đánh giá" />
                    <YearPicker value={yearPrev} onChange={setYearPrev} label="Năm so sánh" />
                    <button
                      type="button"
                      onClick={loadYearData}
                      disabled={yLoading}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${yLoading ? 'animate-spin' : ''}`} />
                      {yLoading ? 'Đang tải...' : 'Tải lại số liệu'}
                    </button>
                    <span className="text-[11px] italic text-zinc-400">
                      Tổng hợp từ định giá theo tháng: cộng chi phí nhân công & sản lượng các tháng trong phạm vi.
                    </span>
                  </div>
                  {machineChips}
                </div>

                {renderInputTable(yearRows, {
                  costMap: yCostCur,
                  setCost: (code, v) => setYCostCur(prev => ({ ...prev, [code]: v })),
                  qtyMap: yQtyCur,
                  setQty: (code, v) => setYQtyCur(prev => ({ ...prev, [code]: v })),
                  setDgPrev: (code, v) => setYOverride(prev => ({ ...prev, [code]: v })),
                  qtySrc: yQtySource,
                  colCur: labels.colCur,
                  colPrev: labels.colPrev
                })}
                {renderImageTable(yearRows)}
              </>
            )}

            {/* Lưu báo cáo vào DB */}
            <div className="rounded-xl border border-brand-200 bg-white p-3 shadow-sm">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Save className="h-3.5 w-3.5 text-brand-600" />
                Lưu báo cáo định giá {tab === 'thang' ? 'theo tháng' : 'theo năm'} vào cơ sở dữ liệu
                {loadedId && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Đang xem bản đã lưu</span>}
              </h4>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-52 flex-1">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Tên báo cáo</label>
                  <input
                    type="text"
                    value={tenBaoCao}
                    onChange={e => setTenBaoCao(e.target.value)}
                    placeholder={labels.title}
                    className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-800 outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Người lập</label>
                  <input
                    type="text"
                    value={nguoiLap}
                    onChange={e => setNguoiLap(e.target.value)}
                    placeholder="Họ tên người lập"
                    className="h-9 w-44 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-800 outline-none focus:border-brand-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || activeRows.length === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-xs font-bold text-white shadow transition hover:bg-brand-700 active:scale-95 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {loadedId ? 'Cập nhật bản đã lưu' : 'Lưu báo cáo'}
                </button>
                {loadedId && (
                  <button
                    type="button"
                    onClick={handleNewReport}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    Báo cáo mới
                  </button>
                )}
              </div>
              {saveMsg && (
                <p className={`mt-2 text-xs font-semibold ${saveMsg.startsWith('Đã') ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {saveMsg}
                </p>
              )}

              {/* Danh sách báo cáo đã lưu */}
              <div className="mt-3 border-t border-slate-100 pt-2">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-500">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Báo cáo đã lưu ({tab === 'thang' ? 'theo tháng' : 'theo năm'})
                </p>
                {loadingSaved ? (
                  <p className="flex items-center gap-1.5 py-2 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...
                  </p>
                ) : savedList.length === 0 ? (
                  <p className="py-2 text-xs italic text-slate-400">Chưa có báo cáo nào được lưu.</p>
                ) : (
                  <div className="max-h-44 space-y-1.5 overflow-y-auto">
                    {savedList.map(item => (
                      <div
                        key={item.id}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                          loadedId === item.id ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 bg-slate-50/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800">{item.ten_bao_cao}</span>
                          <span className="ml-2 text-[11px] text-slate-500">{periodLabel(item)}</span>
                          <span className="ml-2 text-[10.5px] text-slate-400">
                            {item.nguoi_lap || '—'}
                            {item.created_at ? ` · ${new Date(item.created_at).toLocaleDateString('vi-VN')}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadSaved(item)}
                            className="rounded bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700 shadow-sm ring-1 ring-brand-200 transition hover:bg-brand-50"
                          >
                            Tải
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSaved(item.id, item.ten_bao_cao)}
                            title="Xóa báo cáo"
                            className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || activeRows.length === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-4 text-sm font-bold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {loadedId ? 'Cập nhật' : 'Lưu báo cáo'}
            </button>
            <button
              type="button"
              onClick={() => setPendingPrint(true)}
              disabled={pendingPrint || activeRows.length === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {pendingPrint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              In bảng định giá
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function DinhGiaNhanCongPrintSheet({
  title,
  rows,
  colCur,
  colPrev,
  scopeCur,
  scopePrev,
  projectLine,
  meta
}: {
  title: string;
  rows: DinhGiaMachineRow[];
  colCur: string;
  colPrev: string;
  scopeCur: string;
  scopePrev: string;
  projectLine: string;
  meta: Array<{ label: string; value: string }>;
}) {
  const printDate = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <div className="dot-san-xuat-print-sheet">
      <div className="dot-san-xuat-print-doc">
        <div className="dot-san-xuat-print-header">
          <div className="dot-san-xuat-print-brand">
            <img src={vietNhatLogoUrl} alt="Việt Nhật" className="dot-san-xuat-print-logo" />
            <div>
              <p className="dot-san-xuat-print-company-name">{PRINT_COMPANY_NAME}</p>
              <p className="dot-san-xuat-print-project-name">{projectLine}</p>
            </div>
          </div>
          <h1 className="dot-san-xuat-print-title">{title}</h1>
          <div className="dot-san-xuat-print-meta">
            {meta.map(m => (
              <p key={m.label}><strong>{m.label}:</strong> {m.value}</p>
            ))}
            <p><strong>Số máy:</strong> {rows.length} máy</p>
            <p><strong>Ngày in:</strong> {printDate}</p>
          </div>
        </div>

        <table className="dot-san-xuat-print-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '14%' }}>Máy</th>
              {rows.map(r => (
                <th key={r.code} colSpan={2}>{r.name}</th>
              ))}
            </tr>
            <tr>
              {rows.map(r => (
                <React.Fragment key={r.code}>
                  <th>{colCur}</th>
                  <th>{colPrev}</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="dot-san-xuat-print-center"><strong>Nhân công (đồng/kg)</strong></td>
              {rows.map(r => (
                <React.Fragment key={r.code}>
                  <td className="dot-san-xuat-print-right"><strong>{r.donGiaCur.toLocaleString('vi-VN')}</strong></td>
                  <td className="dot-san-xuat-print-right"><strong>{r.donGiaPrev.toLocaleString('vi-VN')}</strong></td>
                </React.Fragment>
              ))}
            </tr>
            <tr>
              <td className="dot-san-xuat-print-center"><strong>Chênh lệch</strong></td>
              {rows.map(r => (
                <td key={r.code} colSpan={2} className="dot-san-xuat-print-center">
                  <strong>{r.diff > 0 ? r.diff.toLocaleString('vi-VN') : r.diff < 0 ? `(${Math.abs(r.diff).toLocaleString('vi-VN')})` : '0'}</strong>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: '10.5pt', lineHeight: 1.5 }}>
          {rows.map(r => {
            const higher = r.diff > 0;
            const lower = r.diff < 0;
            return (
              <p key={r.code} style={{ margin: '0 0 2mm' }}>
                - Định mức nhân công Máy {r.name} {scopeCur}{' '}
                {higher
                  ? <>cao hơn {Math.abs(r.diff).toLocaleString('vi-VN')}đ so với {scopePrev} =&gt; {r.impact.toLocaleString('vi-VN')}đ</>
                  : lower
                    ? <>thấp hơn {Math.abs(r.diff).toLocaleString('vi-VN')} đồng so với {scopePrev} =&gt; {r.impact.toLocaleString('vi-VN')}đ</>
                    : <>bằng so với {scopePrev} =&gt; 0đ</>}
              </p>
            );
          })}
        </div>

        <div className="dot-san-xuat-print-signatures">
          <div>
            <p>Người lập</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Quản đốc</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Kế toán</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Giám đốc</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DinhGiaNhanCongModal;
