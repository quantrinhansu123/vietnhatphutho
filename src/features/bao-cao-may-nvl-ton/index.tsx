import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { ClipboardList, Loader2, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage } from '../_shared/recordHelpers';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import {
  MachineNvlPrintBatch,
  buildMachineNvlPrintReportFromForm,
  type MachineNvlPrintReport
} from '../../components/MachineNvlPrintSheet';
import {
  normalizeMachineNvlReports,
  type MachineNvlReportKind,
  type MachineNvlSavedLine,
  type MachineNvlSavedReport
} from '../../utils/machineNvlReports';
import { STANDARD_SHIFTS } from '../../types';
import { orderFieldClass } from '../_shared/orderHelpers';
import { normalizeProductCodeKey } from '../san-pham/types';
import {
  findMachineByRef,
  machineSelectValue,
  normalizeMachines,
  renderMachineSelect,
  type MachineRow
} from '../danh-sach-may';
import { normalizeMaterialsInventory, type MaterialRow } from '../kho-nvl';
import {
  formatProductionOrderShiftLabel,
  mapProductionOrderSettings,
  normalizeProductionOrders,
  resolveProductionOrderMachine,
  type ProductionOrderLookupSetting,
  type ProductionOrderRow
} from '../ke-hoach-san-xuat';
import { parseProductionOrderFilterDate, splitProductionOrderStaffNames } from '../cai-dat-thoi-gian';

export const MACHINE_NVL_REPORT_TABS: { id: MachineNvlReportKind; label: string; hint: string }[] = [
  { id: 'dau_ca', label: 'Báo cáo đầu ca', hint: 'Kiểm kê NVL tồn khi bắt đầu ca' },
  { id: 'cuoi_ca', label: 'Báo cáo cuối ca', hint: 'Kiểm kê NVL tồn khi kết thúc ca' }
];

export type MachineNvlReportLine = {
  key: string;
  code: string;
  name: string;
  unit: string;
  previousQuantity: string;
  inMachineQuantity: string;
  inMixerQuantity: string;
  unblendedQuantity: string;
  standardQuantity: string;
  quantity: string;
  note: string;
};

const machineNvlToday = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const emptyMachineNvlLine = (): MachineNvlReportLine => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  code: '',
  name: '',
  unit: 'kg',
  previousQuantity: '',
  inMachineQuantity: '',
  inMixerQuantity: '',
  unblendedQuantity: '',
  standardQuantity: '',
  quantity: '',
  note: ''
});

export function machineNvlReportMatchesMachine(
  report: Pick<MachineNvlSavedReport, 'maMay' | 'tenMay'>,
  machineCode: string,
  machineName: string,
  machineRef: string
) {
  const ref = machineRef.trim().toLowerCase();
  const code = machineCode.trim().toLowerCase();
  const name = machineName.trim().toLowerCase();
  const reportCode = report.maMay.trim().toLowerCase();
  const reportName = report.tenMay.trim().toLowerCase();
  if (!ref && !code && !name) return false;
  if (ref && (ref === reportCode || ref === reportName || reportCode.includes(ref) || reportName.includes(ref))) {
    return true;
  }
  if (code && (code === reportCode || reportCode.includes(code) || code.includes(reportCode))) return true;
  if (name && (name === reportName || reportName.includes(name) || name.includes(reportName))) return true;
  return false;
}

export function findLatestPreviousCuoiCaReport(
  reports: MachineNvlSavedReport[],
  machineCode: string,
  machineName: string,
  machineRef: string,
  ngay: string,
  ca: string
) {
  const shiftKey = ca.trim().toLowerCase();
  return (
    reports
      .filter(report => report.reportKind === 'cuoi_ca')
      .filter(report => machineNvlReportMatchesMachine(report, machineCode, machineName, machineRef))
      .filter(report => !(report.ngay === ngay && report.ca.trim().toLowerCase() === shiftKey))
      .sort((a, b) => {
        const dateCompare = b.ngay.localeCompare(a.ngay);
        if (dateCompare !== 0) return dateCompare;
        return b.createdAt.localeCompare(a.createdAt);
      })[0] ?? null
  );
}

export function buildPreviousShiftQuantityMap(report: MachineNvlSavedReport | null) {
  const map = new Map<string, number>();
  if (!report) return map;
  report.lines.forEach(line => {
    const codeKey = normalizeProductCodeKey(line.maNvl);
    if (!codeKey) return;
    map.set(codeKey, line.soLuongTon);
  });
  return map;
}

export function machineNvlTextKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function machineNvlShiftKey(value: string) {
  return machineNvlTextKey(value.replace(/\([^)]*\)/g, '').replace(/^ca\s*/i, 'ca'));
}

export function machineNvlShiftMatches(orderShift: string, selectedShift: string) {
  const orderKey = machineNvlShiftKey(orderShift);
  const selectedKey = machineNvlShiftKey(selectedShift);
  if (!orderKey || !selectedKey || orderKey === '-') return false;
  return orderKey === selectedKey || orderKey.includes(selectedKey) || selectedKey.includes(orderKey);
}

export function machineNvlOrderMatchesMachine(orderMachine: string, selectedMachine: MachineRow | null, machineRef: string) {
  const raw = String(orderMachine || '').trim();
  if (!raw || raw === '-') return false;

  const refKey = machineNvlTextKey(machineRef);
  const orderKey = machineNvlTextKey(raw);
  const candidateKeys = [
    selectedMachine?.code || '',
    selectedMachine?.name || '',
    selectedMachine ? `${selectedMachine.code} · ${selectedMachine.name}` : '',
    machineRef
  ]
    .map(machineNvlTextKey)
    .filter(Boolean);

  return candidateKeys.some(key => key === orderKey || key.includes(orderKey) || orderKey.includes(key) || key === refKey);
}

export function formatMachineNvlQuantityValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(value);
}

export const MACHINE_NVL_DAU_CA_GRID =
  'grid-cols-[52px_minmax(130px,1.1fr)_minmax(160px,2fr)_64px_96px_96px_96px_104px_96px_minmax(96px,1fr)_40px]';
export const MACHINE_NVL_CUOI_CA_GRID =
  'grid-cols-[52px_minmax(130px,1.1fr)_minmax(160px,2fr)_64px_112px_112px_minmax(96px,1fr)_40px]';

export function findMaterialByCode(materials: MaterialRow[], code: string) {
  const normalized = code.trim();
  if (!normalized) return null;
  return materials.find(material => material.code === normalized) ?? null;
}

export function savedMachineNvlLineToFormLine(line: MachineNvlSavedLine): MachineNvlReportLine {
  return {
    key: `${Date.now()}-${line.stt}-${Math.random().toString(36).slice(2)}`,
    code: line.maNvl,
    name: line.tenNvl,
    unit: line.donVi || 'kg',
    previousQuantity: formatMachineNvlQuantityValue(line.soLuongTonCaTruoc),
    inMachineQuantity: formatMachineNvlQuantityValue(line.soLuongTrongMay),
    inMixerQuantity: formatMachineNvlQuantityValue(line.soLuongTrongBonTron),
    unblendedQuantity: formatMachineNvlQuantityValue(line.soLuongNlChuaTron),
    standardQuantity: formatMachineNvlQuantityValue(line.soLuongTonDinhMuc),
    quantity: formatMachineNvlQuantityValue(line.soLuongTon),
    note: line.ghiChu
  };
}

export function MachineNvlReportPanel({
  onBack,
  onOpenList,
  initialMachine,
  onInitialMachineConsumed,
  editReport,
  onEditConsumed
}: {
  onBack: () => void;
  onOpenList?: () => void;
  initialMachine?: { code: string; name: string } | null;
  onInitialMachineConsumed?: () => void;
  editReport?: MachineNvlSavedReport | null;
  onEditConsumed?: () => void;
}) {
  const [activeKind, setActiveKind] = useState<MachineNvlReportKind>('dau_ca');
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [shiftSettings, setShiftSettings] = useState<ProductionOrderLookupSetting[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrderRow[]>([]);
  const [reports, setReports] = useState<MachineNvlSavedReport[]>([]);
  const [cuoiCaReports, setCuoiCaReports] = useState<MachineNvlSavedReport[]>([]);
  const [date, setDate] = useState(machineNvlToday());
  const [shift, setShift] = useState('');
  const [machineRef, setMachineRef] = useState('');
  const [selectedStaffNames, setSelectedStaffNames] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<MachineNvlReportLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [printReport, setPrintReport] = useState<MachineNvlPrintReport | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);

  const loadReports = async (kind: MachineNvlReportKind = activeKind) => {
    const res = await fetch(`/api/bao-cao-may-nvl-ton?limit=50&loai_bao_cao=${encodeURIComponent(kind)}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setReports(normalizeMachineNvlReports(data));
  };

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const [machineRes, materialRes, settingsRes, productionRes, reportRes, cuoiCaRes] = await Promise.all([
          fetch('/api/danh-sach-may'),
          fetch('/api/kho-nvl'),
          fetch('/api/cai-dat'),
          fetch('/api/lenh-sx'),
          fetch(`/api/bao-cao-may-nvl-ton?limit=50&loai_bao_cao=${encodeURIComponent(activeKind)}`),
          fetch('/api/bao-cao-may-nvl-ton?limit=50&loai_bao_cao=cuoi_ca')
        ]);
        const [machineData, materialData, settingsData, productionData, reportData, cuoiCaData] = await Promise.all([
          machineRes.json().catch(() => ({})),
          materialRes.json().catch(() => ({})),
          settingsRes.json().catch(() => ({})),
          productionRes.json().catch(() => ({})),
          reportRes.json().catch(() => ({})),
          cuoiCaRes.json().catch(() => ({}))
        ]);

        if (!alive) return;
        if (machineRes.ok) setMachines(normalizeMachines(machineData));
        if (materialRes.ok) setMaterials(normalizeMaterialsInventory(materialData));
        if (settingsRes.ok) setShiftSettings(mapProductionOrderSettings(settingsData));
        if (productionRes.ok) setProductionOrders(normalizeProductionOrders(productionData));
        if (reportRes.ok) setReports(normalizeMachineNvlReports(reportData));
        if (cuoiCaRes.ok) setCuoiCaReports(normalizeMachineNvlReports(cuoiCaData));
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [activeKind]);

  useEffect(() => {
    if (!initialMachine || machines.length === 0) return;
    const found =
      findMachineByRef(machines, initialMachine.code) ?? findMachineByRef(machines, initialMachine.name);
    setMachineRef(found ? machineSelectValue(found) : initialMachine.name || initialMachine.code);
    onInitialMachineConsumed?.();
  }, [initialMachine, machines, onInitialMachineConsumed]);

  const applyEditReport = (report: MachineNvlSavedReport) => {
    const found =
      findMachineByRef(machines, report.maMay) ?? findMachineByRef(machines, report.tenMay);
    setActiveKind(report.reportKind);
    setEditingReportId(report.id);
    setDate(report.ngay || machineNvlToday());
    setShift(report.ca);
    setMachineRef(found ? machineSelectValue(found) : report.tenMay || report.maMay);
    setSelectedStaffNames(splitProductionOrderStaffNames(report.nhanSu));
    setNote(report.note);
    setLines(
      report.lines.length > 0 ? report.lines.map(savedMachineNvlLineToFormLine) : [emptyMachineNvlLine()]
    );
    setMessage('');
  };

  useEffect(() => {
    if (!editReport || machines.length === 0) return;
    applyEditReport(editReport);
    onEditConsumed?.();
  }, [editReport, machines, onEditConsumed]);

  const switchReportKind = (kind: MachineNvlReportKind) => {
    if (kind === activeKind) return;
    setActiveKind(kind);
    setEditingReportId(null);
    setLines([]);
    setSelectedStaffNames([]);
    setNote('');
    setMessage('');
  };

  const activeTabMeta = MACHINE_NVL_REPORT_TABS.find(tab => tab.id === activeKind) ?? MACHINE_NVL_REPORT_TABS[0];
  const isDauCaTab = activeKind === 'dau_ca';

  const selectedMachine = findMachineByRef(machines, machineRef);
  const shiftOptions = useMemo(() => {
    const fromSettings = shiftSettings
      .filter(
        setting =>
          setting.loaiCaiDat === 'Thời gian' ||
          setting.loaiCaiDat === 'Ca máy' ||
          setting.loaiCaiDat === 'Sản xuất' ||
          /ca/i.test(setting.name) ||
          /ca/i.test(setting.code)
      )
      .map(setting => setting.name || setting.code)
      .filter((name, index, arr) => name && arr.indexOf(name) === index);

    return fromSettings.length > 0 ? fromSettings : [...STANDARD_SHIFTS];
  }, [shiftSettings]);
  const staffOptions = useMemo(() => {
    if (!date || !shift || !machineRef.trim()) return [];

    const matchedOrders = productionOrders.filter(order => {
      const orderDate = parseProductionOrderFilterDate(order.startDate);
      if (orderDate && orderDate !== date) return false;
      if (!machineNvlShiftMatches(order.shift, shift)) return false;
      return machineNvlOrderMatchesMachine(resolveProductionOrderMachine(order, machines), selectedMachine, machineRef);
    });

    return Array.from(new Set<string>(matchedOrders.flatMap(order => splitProductionOrderStaffNames(order.staff)))).sort((a, b) =>
      a.localeCompare(b, 'vi')
    );
  }, [date, machines, machineRef, productionOrders, selectedMachine, shift]);

  useEffect(() => {
    if (!date || !shift || !machineRef.trim()) {
      if (selectedStaffNames.length > 0) setSelectedStaffNames([]);
      return;
    }

    if (staffOptions.length === 1) {
      setSelectedStaffNames(prev =>
        prev.length === 1 && prev[0] === staffOptions[0] ? prev : [staffOptions[0]]
      );
      return;
    }

    setSelectedStaffNames(prev => {
      const next = prev.filter(name => staffOptions.includes(name));
      return next.length === prev.length ? prev : next;
    });
  }, [date, machineRef, shift, staffOptions]);

  const toggleStaffName = (name: string) => {
    setSelectedStaffNames(prev =>
      prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
    );
  };

  const machineNvlStaffText = selectedStaffNames.join(', ');
  const previousCuoiCaReport = useMemo(
    () =>
      isDauCaTab
        ? findLatestPreviousCuoiCaReport(
            cuoiCaReports,
            selectedMachine?.code || machineRef.trim(),
            selectedMachine?.name || machineRef.trim(),
            machineRef,
            date,
            shift
          )
        : null,
    [isDauCaTab, cuoiCaReports, selectedMachine, machineRef, date, shift]
  );
  const previousShiftQtyMap = useMemo(
    () => buildPreviousShiftQuantityMap(previousCuoiCaReport),
    [previousCuoiCaReport]
  );

  useEffect(() => {
    if (!isDauCaTab || previousShiftQtyMap.size === 0) return;
    setLines(prev =>
      prev.map(line => {
        const codeKey = normalizeProductCodeKey(line.code);
        if (!codeKey || !previousShiftQtyMap.has(codeKey)) return line;
        const prevQty = previousShiftQtyMap.get(codeKey);
        return {
          ...line,
          previousQuantity: formatMachineNvlQuantityValue(prevQty)
        };
      })
    );
  }, [isDauCaTab, previousShiftQtyMap]);

  useEffect(() => {
    if (materials.length === 0) return;
    setLines(prev => {
      let changed = false;
      const next = prev.map(line => {
        const code = line.code.trim();
        if (!code || line.name.trim()) return line;
        const material = findMaterialByCode(materials, code);
        if (!material) return line;
        changed = true;
        return {
          ...line,
          name: material.name,
          unit: material.unit === '-' ? 'kg' : material.unit
        };
      });
      return changed ? next : prev;
    });
  }, [materials]);

  const totalQuantity = lines.reduce((sum, line) => {
    const value = isDauCaTab
      ? (Number(line.inMachineQuantity.replace(',', '.')) || 0) +
        (Number(line.inMixerQuantity.replace(',', '.')) || 0) +
        (Number(line.unblendedQuantity.replace(',', '.')) || 0)
      : Number(line.quantity.replace(',', '.'));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  const updateLine = (key: string, updates: Partial<MachineNvlReportLine>) => {
    setLines(prev => prev.map(line => (line.key === key ? { ...line, ...updates } : line)));
  };

  const selectMaterial = (key: string, material: MaterialRow | null) => {
    if (!material) {
      updateLine(key, { code: '', name: '', unit: '' });
      return;
    }
    const codeKey = normalizeProductCodeKey(material.code);
    const prevQty = isDauCaTab && codeKey ? previousShiftQtyMap.get(codeKey) : undefined;
    updateLine(key, {
      code: material.code,
      name: material.name,
      unit: material.unit === '-' ? 'kg' : material.unit,
      previousQuantity:
        isDauCaTab && prevQty !== undefined ? formatMachineNvlQuantityValue(prevQty) : ''
    });
  };

  const saveReport = async () => {
    setMessage('');
    const materialLines = lines
      .map((line, index) => {
        const row: Record<string, unknown> = {
          stt: index + 1,
          ma_nvl: line.code.trim(),
          ten_nvl: line.name.trim(),
          don_vi: line.unit.trim() || 'kg',
          ghi_chu: line.note.trim()
        };
        if (isDauCaTab) {
          const prevQty = Number(line.previousQuantity.replace(',', '.'));
          const inMachineQty = Number(line.inMachineQuantity.replace(',', '.'));
          const inMixerQty = Number(line.inMixerQuantity.replace(',', '.'));
          const unblendedQty = Number(line.unblendedQuantity.replace(',', '.'));
          if (Number.isFinite(prevQty) && prevQty >= 0) {
            row.so_luong_ton_ca_truoc = prevQty;
          }
          if (Number.isFinite(inMachineQty) && inMachineQty >= 0) {
            row.so_luong_trong_may = inMachineQty;
          }
          if (Number.isFinite(inMixerQty) && inMixerQty >= 0) {
            row.so_luong_trong_bon_tron = inMixerQty;
          }
          if (Number.isFinite(unblendedQty) && unblendedQty >= 0) {
            row.so_luong_nl_chua_tron = unblendedQty;
          }
          row.so_luong_ton =
            (Number.isFinite(inMachineQty) ? inMachineQty : 0) +
            (Number.isFinite(inMixerQty) ? inMixerQty : 0) +
            (Number.isFinite(unblendedQty) ? unblendedQty : 0);
        } else {
          const standardQty = Number(line.standardQuantity.replace(',', '.'));
          row.so_luong_ton = Number(line.quantity.replace(',', '.')) || 0;
          if (Number.isFinite(standardQty) && standardQty >= 0) {
            row.so_luong_ton_dinh_muc = standardQty;
          }
        }
        return row;
      })
      .filter(
        line =>
          line.ma_nvl ||
          line.ten_nvl ||
          Number(line.so_luong_trong_may) > 0 ||
          Number(line.so_luong_trong_bon_tron) > 0 ||
          Number(line.so_luong_nl_chua_tron) > 0 ||
          Number(line.so_luong_ton_dinh_muc) > 0 ||
          Number(line.so_luong_ton) > 0
      );

    if (!date || !shift || !machineRef.trim() || materialLines.length === 0) {
      setMessage('Vui lòng chọn ngày, ca, máy và nhập ít nhất một dòng NVL tồn.');
      return;
    }

    setIsSaving(true);
    try {
      const isEdit = Boolean(editingReportId);
      const res = await fetch(
        isEdit ? `/api/bao-cao-may-nvl-ton/${encodeURIComponent(editingReportId!)}` : '/api/bao-cao-may-nvl-ton',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ngay: date,
            ca: shift,
            gio: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            ma_may: selectedMachine?.code || machineRef.trim(),
            ten_may: selectedMachine?.name || machineRef.trim(),
            nhan_su: machineNvlStaffText,
            ghi_chu: note.trim(),
            loai_bao_cao: activeKind,
            chi_tiet: materialLines
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Không thể ${isEdit ? 'cập nhật' : 'lưu'} báo cáo NVL tồn theo máy.`);
      }

      setMessage(isEdit ? `Đã cập nhật ${activeTabMeta.label.toLowerCase()}.` : `Đã lưu ${activeTabMeta.label.toLowerCase()}.`);
      setEditingReportId(null);
      if (isEdit) {
        setLines([]);
      }
      setNote('');
      await loadReports(activeKind);
    } catch (error: any) {
      setMessage(error.message || 'Không thể lưu báo cáo.');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditReport = () => {
    setEditingReportId(null);
    setLines([]);
    setSelectedStaffNames([]);
    setNote('');
    setMessage('');
  };

  const printReportPayload = (report: MachineNvlPrintReport) => {
    setPrintReport(report);
    setPendingPrint(true);
  };

  const buildCurrentPrintReport = (): MachineNvlPrintReport =>
    buildMachineNvlPrintReportFromForm({
      reportKind: activeKind,
      date,
      shift,
      machineCode: selectedMachine?.code || machineRef.trim(),
      machineName: selectedMachine?.name || machineRef.trim(),
      staff: machineNvlStaffText,
      note: note.trim(),
      lines
    });

  const canPrintCurrentReport = lines.some(line => {
    if (line.code.trim() || line.name.trim()) return true;
    if (isDauCaTab) {
      return (
        line.inMachineQuantity.trim() ||
        line.inMixerQuantity.trim() ||
        line.unblendedQuantity.trim()
      );
    }
    return line.standardQuantity.trim() || line.quantity.trim();
  });

  useEffect(() => {
    if (!pendingPrint || !printReport) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPendingPrint(false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [pendingPrint, printReport]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintReport(null);
      setPendingPrint(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white px-2 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-black text-zinc-900">Báo cáo NVL tồn theo máy</h1>
              <p className="text-sm font-semibold text-zinc-500">{activeTabMeta.hint}</p>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-right">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Tổng tồn</p>
            <p className="text-lg font-black text-emerald-900">{formatNumber(totalQuantity)} kg</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {MACHINE_NVL_REPORT_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchReportKind(tab.id)}
                className={`inline-flex h-10 items-center rounded-xl px-4 text-sm font-black transition ${
                  activeKind === tab.id
                    ? 'bg-[#ef1b2d] text-white shadow-sm'
                    : 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-[#ef1b2d]/40 hover:text-[#ef1b2d]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {onOpenList ? (
            <button
              type="button"
              onClick={onOpenList}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
            >
              <ClipboardList className="h-4 w-4" />
              Danh sách
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="xl:p-4">
          <section className="w-full min-w-0 max-w-full overflow-hidden border-b border-zinc-200 bg-white px-1.5 py-2 sm:px-2 sm:py-3 xl:rounded-2xl xl:border xl:p-4 xl:shadow-sm">
            <div className="mb-3 border-b border-zinc-100 pb-3">
              <p className="text-sm font-black text-zinc-900">
                {editingReportId ? `Đang sửa ${activeTabMeta.label.toLowerCase()}` : activeTabMeta.label}
              </p>
              {editingReportId ? (
                <p className="mt-1 text-xs font-semibold text-[#ef1b2d]">
                  Chỉnh sửa phiếu đã lưu · bấm Cập nhật để lưu thay đổi
                </p>
              ) : null}
            </div>
            <div className="machine-nvl-form-grid flex w-full flex-wrap gap-2 lg:grid lg:grid-cols-4 lg:gap-3">
              <label
                className="machine-nvl-form-field w-[calc(50%-0.25rem)] text-xs font-black uppercase tracking-wider text-zinc-500 lg:w-auto"
                style={{ width: 'calc(50% - 0.25rem)' }}
              >
                Ngày
                <input type="date" value={date} onChange={event => setDate(event.target.value)} className={`${orderFieldClass} mt-1`} />
              </label>
              <label
                className="machine-nvl-form-field w-[calc(50%-0.25rem)] text-xs font-black uppercase tracking-wider text-zinc-500 lg:w-auto"
                style={{ width: 'calc(50% - 0.25rem)' }}
              >
                Ca
                <select value={shift} onChange={event => setShift(event.target.value)} className={`${orderFieldClass} mt-1`}>
                  <option value="">Chọn ca</option>
                  {shiftOptions.map(option => (
                    <option key={option} value={option}>
                      {formatProductionOrderShiftLabel(option, shiftSettings)}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="machine-nvl-form-field machine-nvl-form-span-2-lg w-[calc(50%-0.25rem)] text-xs font-black uppercase tracking-wider text-zinc-500 lg:col-span-2 lg:w-auto"
                style={{ width: 'calc(50% - 0.25rem)' }}
              >
                Máy
                <div className="mt-1 min-w-0">
                  {renderMachineSelect(machineRef, setMachineRef, machines, {
                    placeholder: 'Chọn máy',
                    isLoading
                  })}
                </div>
              </label>
              <div
                className="machine-nvl-form-field machine-nvl-form-span-2-lg w-[calc(50%-0.25rem)] text-xs font-black uppercase tracking-wider text-zinc-500 lg:col-span-2 lg:w-auto"
                style={{ width: 'calc(50% - 0.25rem)' }}
              >
                Nhân sự (chọn nhiều)
                <div className="mt-1 max-h-40 min-w-0 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                  {!date || !shift || !machineRef.trim() ? (
                    <p className="px-2 py-3 text-xs font-semibold text-zinc-400">Chọn ngày, ca và máy trước.</p>
                  ) : staffOptions.length === 0 ? (
                    <p className="px-2 py-3 text-xs font-semibold text-zinc-400">
                      Không có nhân sự theo máy/ca/ngày.
                    </p>
                  ) : (
                    staffOptions.map(option => {
                      const checked = selectedStaffNames.includes(option);
                      return (
                        <label
                          key={option}
                          className={`mb-1 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition last:mb-0 ${
                            checked
                              ? 'border-[#ef1b2d]/30 bg-red-50 text-[#b30d1c]'
                              : 'border-zinc-200 bg-white text-zinc-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStaffName(option)}
                            className="h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                          />
                          <span className="font-black">{option}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              <label
                className="machine-nvl-form-field machine-nvl-form-span-2 w-full text-xs font-black uppercase tracking-wider text-zinc-500 lg:col-span-2"
                style={{ width: '100%' }}
              >
                Ghi chú
                <input value={note} onChange={event => setNote(event.target.value)} placeholder="Ghi chú chung" className={`${orderFieldClass} mt-1`} />
              </label>
            </div>

            <div className="mt-3 min-w-0 max-w-full overflow-hidden rounded-lg border border-zinc-200 md:mt-4 md:rounded-xl">
              <div
                className={`hidden md:grid gap-2 ${isDauCaTab ? MACHINE_NVL_DAU_CA_GRID : MACHINE_NVL_CUOI_CA_GRID} bg-zinc-950 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white ${isDauCaTab ? 'md:min-w-[1120px]' : 'md:min-w-[980px]'}`}
              >
                <span>STT</span>
                <span>Mã NVL</span>
                <span>Tên NVL</span>
                <span>ĐVT</span>
                {isDauCaTab ? <span>Tồn trong máy</span> : null}
                {isDauCaTab ? <span>Tồn trong bồn trộn</span> : null}
                {isDauCaTab ? <span>NL chưa trộn</span> : null}
                {isDauCaTab ? <span>Tổng tồn đầu ca</span> : null}
                {!isDauCaTab ? <span>SL tồn định mức</span> : null}
                <span>SL tồn thực tế</span>
                <span>Ghi chú</span>
                <span></span>
              </div>
              {lines.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-3 py-10 text-center">
                  <p className="text-sm font-bold text-zinc-500">Chưa có dòng NVL nào.</p>
                  <button
                    type="button"
                    onClick={() => setLines(prev => [...prev, emptyMachineNvlLine()])}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-extrabold text-zinc-700 transition hover:border-[#ef1b2d] hover:text-[#ef1b2d]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm dòng NVL
                  </button>
                </div>
              ) : null}
              <div className="divide-y divide-zinc-100">
                {lines.map((line, index) => (
                  <div
                    key={line.key}
                    className={`min-w-0 max-w-full px-1 py-1.5 md:px-3 md:py-2 ${isDauCaTab ? 'md:min-w-[1120px]' : 'md:min-w-[980px]'}`}
                  >
                    <div className="mb-1.5 flex min-w-0 items-center gap-1.5 md:hidden">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-500 text-[10px] font-black text-white">
                        {index + 1}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-[11px] font-bold leading-tight text-zinc-800" title={line.name || line.code || undefined}>
                        {line.name || (line.code ? line.code : 'Chọn mã NVL')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setLines(prev => prev.length > 1 ? prev.filter(item => item.key !== line.key) : prev)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rose-200 text-rose-600 transition hover:bg-rose-50"
                        title="Xóa dòng"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="machine-nvl-line-mobile-grid grid grid-cols-4 gap-0.5 md:hidden">
                      <label className="col-span-3 block min-w-0 space-y-0.5">
                        <span className="machine-nvl-line-mobile-label">Mã NVL</span>
                        <div className="min-w-0 max-w-full">
                        <SearchableSelect
                          value={line.code}
                          onChange={value => {
                            const material = findMaterialByCode(materials, value);
                            if (material) {
                              selectMaterial(line.key, material);
                              return;
                            }
                            updateLine(line.key, { code: value, name: '', unit: '' });
                          }}
                          options={materials}
                          placeholder="Mã"
                          isLoading={isLoading}
                          displaySelectedAsValue
                          inputClassName="machine-nvl-line-mobile-input h-8 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-1.5 text-[10px] font-bold outline-none focus:border-[#ef1b2d]"
                          getLabel={item => (item as MaterialRow).code}
                          getSearchText={item => {
                            const material = item as MaterialRow;
                            return `${material.code} ${material.name}`;
                          }}
                          getOptionLabel={item => {
                            const material = item as MaterialRow;
                            return `${material.code} — ${material.name}`;
                          }}
                          getValue={item => (item as MaterialRow).code}
                          onSelectOption={item => selectMaterial(line.key, item as MaterialRow | null)}
                        />
                        </div>
                      </label>
                      <label className="col-span-1 block min-w-0 space-y-0.5">
                        <span className="machine-nvl-line-mobile-label">ĐVT</span>
                        <input value={line.unit} readOnly className="machine-nvl-line-mobile-input h-8 w-full min-w-0 rounded-md border border-zinc-200 bg-zinc-50 px-0.5 text-center text-[10px] font-semibold text-zinc-700 outline-none" />
                      </label>
                      {isDauCaTab ? (
                        <>
                          <label className="block min-w-0 space-y-0.5">
                            <span className="machine-nvl-line-mobile-label">Máy</span>
                            <input type="number" min="0" step="0.01" value={line.inMachineQuantity} onChange={event => updateLine(line.key, { inMachineQuantity: event.target.value })} className="machine-nvl-line-mobile-input h-8 w-full min-w-0 rounded-md border border-zinc-200 px-0.5 text-[10px] font-black outline-none focus:border-[#ef1b2d]" />
                          </label>
                          <label className="block min-w-0 space-y-0.5">
                            <span className="machine-nvl-line-mobile-label">Bồn</span>
                            <input type="number" min="0" step="0.01" value={line.inMixerQuantity} onChange={event => updateLine(line.key, { inMixerQuantity: event.target.value })} className="machine-nvl-line-mobile-input h-8 w-full min-w-0 rounded-md border border-zinc-200 px-0.5 text-[10px] font-black outline-none focus:border-[#ef1b2d]" />
                          </label>
                          <label className="block min-w-0 space-y-0.5">
                            <span className="machine-nvl-line-mobile-label">C.trộn</span>
                            <input type="number" min="0" step="0.01" value={line.unblendedQuantity} onChange={event => updateLine(line.key, { unblendedQuantity: event.target.value })} className="machine-nvl-line-mobile-input h-8 w-full min-w-0 rounded-md border border-zinc-200 px-0.5 text-[10px] font-black outline-none focus:border-[#ef1b2d]" />
                          </label>
                          <label className="block min-w-0 space-y-0.5">
                            <span className="machine-nvl-line-mobile-label">Tổng</span>
                            <input
                              value={formatMachineNvlQuantityValue(
                                (Number(line.inMachineQuantity.replace(',', '.')) || 0) +
                                  (Number(line.inMixerQuantity.replace(',', '.')) || 0) +
                                  (Number(line.unblendedQuantity.replace(',', '.')) || 0)
                              )}
                              readOnly
                              className="machine-nvl-line-mobile-input h-8 w-full min-w-0 rounded-md border border-zinc-200 bg-zinc-50 px-0.5 text-[10px] font-black text-zinc-600 outline-none"
                            />
                          </label>
                        </>
                      ) : (
                        <>
                          <label className="block min-w-0 space-y-0.5">
                            <span className="machine-nvl-line-mobile-label">SL ĐM</span>
                            <input type="number" min="0" step="0.01" value={line.standardQuantity} onChange={event => updateLine(line.key, { standardQuantity: event.target.value })} className="machine-nvl-line-mobile-input h-8 w-full min-w-0 rounded-md border border-zinc-200 px-0.5 text-[10px] font-black outline-none focus:border-[#ef1b2d]" />
                          </label>
                          <label className="block min-w-0 space-y-0.5">
                            <span className="machine-nvl-line-mobile-label">SL TT</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.quantity}
                              onChange={event => updateLine(line.key, { quantity: event.target.value })}
                              className="machine-nvl-line-mobile-input h-8 w-full min-w-0 rounded-md border border-zinc-200 px-0.5 text-[10px] font-black outline-none focus:border-[#ef1b2d]"
                            />
                          </label>
                          <label className="col-span-2 block min-w-0 space-y-0.5">
                            <span className="machine-nvl-line-mobile-label">Ghi chú</span>
                            <input value={line.note} onChange={event => updateLine(line.key, { note: event.target.value })} className="machine-nvl-line-mobile-input h-8 w-full min-w-0 rounded-md border border-zinc-200 px-1 text-[10px] font-semibold outline-none focus:border-[#ef1b2d]" />
                          </label>
                        </>
                      )}
                      {isDauCaTab ? (
                        <label className="col-span-4 block min-w-0 space-y-0.5">
                          <span className="machine-nvl-line-mobile-label">Ghi chú</span>
                          <input value={line.note} onChange={event => updateLine(line.key, { note: event.target.value })} className="machine-nvl-line-mobile-input h-8 w-full min-w-0 rounded-md border border-zinc-200 px-1 text-[10px] font-semibold outline-none focus:border-[#ef1b2d]" />
                        </label>
                      ) : null}
                    </div>
                    <div
                      className={`hidden md:grid gap-2 ${isDauCaTab ? MACHINE_NVL_DAU_CA_GRID : MACHINE_NVL_CUOI_CA_GRID} items-center ${isDauCaTab ? 'md:min-w-[1120px]' : 'md:min-w-[980px]'}`}
                    >
                    <span className="min-w-0 font-mono text-sm font-black text-[#ef1b2d]">{index + 1}</span>
                    <div className="min-w-0">
                    <SearchableSelect
                      value={line.code}
                      onChange={value => {
                        const material = findMaterialByCode(materials, value);
                        if (material) {
                          selectMaterial(line.key, material);
                          return;
                        }
                        updateLine(line.key, { code: value, name: '', unit: '' });
                      }}
                      options={materials}
                      placeholder="Mã NVL"
                      isLoading={isLoading}
                      displaySelectedAsValue
                      inputClassName="h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-bold outline-none focus:border-[#ef1b2d]"
                      getLabel={item => (item as MaterialRow).code}
                      getSearchText={item => {
                        const material = item as MaterialRow;
                        return `${material.code} ${material.name}`;
                      }}
                      getOptionLabel={item => {
                        const material = item as MaterialRow;
                        return `${material.code} — ${material.name}`;
                      }}
                      getValue={item => (item as MaterialRow).code}
                      onSelectOption={item => selectMaterial(line.key, item as MaterialRow | null)}
                    />
                    </div>
                    <input value={line.name} readOnly className="min-w-0 h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-700 outline-none" />
                    <input value={line.unit} onChange={event => updateLine(line.key, { unit: event.target.value })} className="min-w-0 h-10 rounded-lg border border-zinc-200 px-3 text-sm font-semibold outline-none focus:border-[#ef1b2d]" />
                    {isDauCaTab ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.inMachineQuantity}
                        onChange={event => updateLine(line.key, { inMachineQuantity: event.target.value })}
                        className="min-w-0 h-10 rounded-lg border border-zinc-200 px-2 text-sm font-black outline-none focus:border-[#ef1b2d]"
                      />
                    ) : null}
                    {isDauCaTab ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.inMixerQuantity}
                        onChange={event => updateLine(line.key, { inMixerQuantity: event.target.value })}
                        className="min-w-0 h-10 rounded-lg border border-zinc-200 px-2 text-sm font-black outline-none focus:border-[#ef1b2d]"
                      />
                    ) : null}
                    {isDauCaTab ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unblendedQuantity}
                        onChange={event => updateLine(line.key, { unblendedQuantity: event.target.value })}
                        className="min-w-0 h-10 rounded-lg border border-zinc-200 px-2 text-sm font-black outline-none focus:border-[#ef1b2d]"
                      />
                    ) : null}
                    {isDauCaTab ? (
                      <input
                        value={formatMachineNvlQuantityValue(
                          (Number(line.inMachineQuantity.replace(',', '.')) || 0) +
                            (Number(line.inMixerQuantity.replace(',', '.')) || 0) +
                            (Number(line.unblendedQuantity.replace(',', '.')) || 0)
                        )}
                        readOnly
                        className="min-w-0 h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-sm font-black text-zinc-600 outline-none"
                      />
                    ) : null}
                    {!isDauCaTab ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.standardQuantity}
                        onChange={event => updateLine(line.key, { standardQuantity: event.target.value })}
                        className="min-w-0 h-10 rounded-lg border border-zinc-200 px-3 text-sm font-black outline-none focus:border-[#ef1b2d]"
                      />
                    ) : null}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        isDauCaTab
                          ? formatMachineNvlQuantityValue(
                              (Number(line.inMachineQuantity.replace(',', '.')) || 0) +
                                (Number(line.inMixerQuantity.replace(',', '.')) || 0) +
                                (Number(line.unblendedQuantity.replace(',', '.')) || 0)
                            )
                          : line.quantity
                      }
                      onChange={event => updateLine(line.key, { quantity: event.target.value })}
                      readOnly={isDauCaTab}
                      className={`min-w-0 h-10 rounded-lg border border-zinc-200 px-3 text-sm font-black outline-none ${
                        isDauCaTab ? 'bg-zinc-50 text-zinc-600' : 'focus:border-[#ef1b2d]'
                      }`}
                    />
                    <input value={line.note} onChange={event => updateLine(line.key, { note: event.target.value })} className="min-w-0 h-10 rounded-lg border border-zinc-200 px-3 text-sm font-semibold outline-none focus:border-[#ef1b2d]" />
                    <button type="button" onClick={() => setLines(prev => prev.length > 1 ? prev.filter(item => item.key !== line.key) : prev)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] hover:bg-red-50" title="Xóa dòng">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    </div>
                  </div>
                ))}
              </div>
              {isDauCaTab && previousCuoiCaReport ? (
                <p className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] font-semibold text-zinc-500">
                  Tham chiếu cuối ca gần nhất: {previousCuoiCaReport.ngay} · {previousCuoiCaReport.ca} ·{' '}
                  {previousCuoiCaReport.tenMay || previousCuoiCaReport.maMay}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setLines(prev => [...prev, emptyMachineNvlLine()])} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-800 hover:border-[#ef1b2d] hover:text-[#ef1b2d]">
                <Plus className="h-4 w-4" />
                Thêm dòng NVL
              </button>
              <div className="flex items-center gap-3">
                {message && <span className="text-sm font-bold text-zinc-600">{message}</span>}
                {editingReportId ? (
                  <button
                    type="button"
                    onClick={cancelEditReport}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-zinc-700 transition hover:border-zinc-400"
                  >
                    Hủy sửa
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => printReportPayload(buildCurrentPrintReport())}
                  disabled={!canPrintCurrentReport}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-zinc-700 transition hover:border-zinc-400 disabled:opacity-60"
                >
                  <Printer className="h-4 w-4" />
                  In phiếu
                </button>
                <button type="button" onClick={saveReport} disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-[#ef1b2d] px-5 py-2.5 text-sm font-black text-white shadow-sm disabled:opacity-60">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingReportId ? 'Cập nhật báo cáo' : 'Lưu báo cáo'}
                </button>
              </div>
            </div>
          </section>
        </div>
        {printReport && <MachineNvlPrintBatch reports={[printReport]} />}
      </div>
    </div>
  );
}

