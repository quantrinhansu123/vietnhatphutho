import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Printer, X } from 'lucide-react';
import { formatMoney, formatNumber } from '../utils';
import type { ProductRow } from '../features/san-pham/types';
import type { MachineRow } from '../features/danh-sach-may';
import type { MaterialRow } from '../features/kho-nvl';
import type { ProductionOrderRow, ProductionOrderLookupSetting } from '../features/ke-hoach-san-xuat';
import { splitProductionOrderStaffNames } from '../features/cai-dat-thoi-gian';
import type { MixingReport } from './MixingReportForm';
import type { AcceptanceReport } from './AcceptanceReportForm';
import type { ShiftSetting } from '../utils/shiftSettings';
import type { ShiftSummaryWarehouseMovement } from '../utils/controlBoardShiftSummary';
import type { WeighingRecord } from '../utils/weighingRecords';
import type { MachineNvlSavedReport } from '../utils/machineNvlReports';
import { waitForPrintImagesReady } from '../utils/printReady';
import ControlBoardBbMachineReportPrintBatch from './ControlBoardBbMachineReportPrintSheet';
import {
  BB_MACHINE_REPORT_TABS,
  buildBbCuoiCaLineRows,
  buildBbDamagedGoodsLineRows,
  buildBbDanhGiaHaoHutGroups,
  buildBbDauCaLineRows,
  buildBbInboundReportRows,
  buildBbInboundMaterialNormGroups,
  buildBbMixingRatioGroups,
  buildBbOrderCodeOptions,
  buildBbProductionOrderLineRows,
  buildBbThucDungLineRows,
  buildBbThucDungMetricDetail,
  buildBbTongGroups,
  buildBbWarehouseExportLineRows,
  groupBbCuoiCaLines,
  groupBbDamagedGoodsLines,
  groupBbDauCaLines,
  groupBbProductionOrderLines,
  groupBbThucDungLines,
  groupBbWarehouseExportLines,
  sumBbCuoiCaWeightKg,
  sumBbDamagedGoodsWeightKg,
  sumBbDanhGiaMoney,
  sumBbDauCaWeightKg,
  sumBbInboundReportTotals,
  sumBbProductionOrderTotals,
  sumBbThucDungWeightKg,
  sumBbTongChenhLech,
  sumBbTongTrongLuongNhapKho,
  sumBbWarehouseExportSlipQuantity,
  sumBbWarehouseExportWeightKg,
  type BbMaterialNormFormula,
  type BbExportWeightFormula,
  type BbMachineReportTabId,
  type BbThucDungDetailMetric,
  type BbThucDungDetailBag,
  type BbThucDungLineRow
} from '../utils/controlBoardBbMachineReport';
import { computePercentRatio } from '../utils/controlBoardShiftSummary';
import { isWarehouseKgUnit } from '../utils/warehouseWeight';
import type { BbProductionOrderGroup } from '../utils/controlBoardBbMachineReport';

type BbPrintConfirmSelection = {
  staffMain: string;
  staffAssistant: string;
  staffSupport: string;
  ghiChu: string;
};

const BB_PHAN_TICH_STORAGE_KEY = 'control-board-bb-phan-tich-v1';

function loadBbPhanTichMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BB_PHAN_TICH_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistBbPhanTichMap(map: Record<string, string>) {
  try {
    localStorage.setItem(BB_PHAN_TICH_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function formatKg(value: number | null | undefined, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return formatNumber(value, digits);
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${formatNumber(value, digits)}%`;
}

function formatVnd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return '—';
  return `${formatMoney(value, 0)} đ`;
}

function formatThucDungDetailCell(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return formatNumber(value, Number.isInteger(value) ? 0 : 3);
  return String(value);
}

function ThucDungMetricButton({
  label,
  className,
  onOpen
}: {
  label: string;
  className: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`rounded-md px-1 py-0.5 underline decoration-dotted underline-offset-2 transition hover:bg-teal-100 ${className}`}
      title="Bấm để xem dữ liệu nguồn"
    >
      {label}
    </button>
  );
}

export default function ControlBoardBbMachineReportTable({
  productionOrders,
  products,
  materials,
  machines,
  warehouseMovements,
  damagedRecords = [],
  machineNvlReports = [],
  mixingReports = [],
  acceptanceReports = [],
  shiftSettings,
  isLoading,
  dateFrom,
  dateTo,
  shiftFilter = 'all',
  machineFilter = 'all',
  selectedMachine = null
}: {
  productionOrders: ProductionOrderRow[];
  products: ProductRow[];
  materials: MaterialRow[];
  machines: MachineRow[];
  warehouseMovements: ShiftSummaryWarehouseMovement[];
  damagedRecords?: WeighingRecord[];
  machineNvlReports?: MachineNvlSavedReport[];
  mixingReports?: MixingReport[];
  acceptanceReports?: AcceptanceReport[];
  shiftSettings: Array<ShiftSetting | ProductionOrderLookupSetting>;
  isLoading?: boolean;
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}) {
  const [activeTab, setActiveTab] = useState<BbMachineReportTabId>('lenh_sx');
  const [phanTichMap, setPhanTichMap] = useState<Record<string, string>>(() =>
    typeof window !== 'undefined' ? loadBbPhanTichMap() : {}
  );
  const [orderCodeFilter, setOrderCodeFilter] = useState<string[]>([]);
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(() => new Set());
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [printConfirmOpen, setPrintConfirmOpen] = useState(false);
  const [printStaffByOrder, setPrintStaffByOrder] = useState<Record<string, BbPrintConfirmSelection>>({});
  const [printOrderGroups, setPrintOrderGroups] = useState<BbProductionOrderGroup[]>([]);
  const [printNoteByOrder, setPrintNoteByOrder] = useState<Record<string, string>>({});
  const [hrStaffNames, setHrStaffNames] = useState<string[]>([]);
  const [selectedMaterialNorm, setSelectedMaterialNorm] = useState<BbMaterialNormFormula | null>(null);
  const [selectedExportWeight, setSelectedExportWeight] = useState<BbExportWeightFormula | null>(null);
  const [thucDungDetail, setThucDungDetail] = useState<{
    line: BbThucDungLineRow;
    metric: BbThucDungDetailMetric;
  } | null>(null);

  const scopedGroupKey = (tabId: BbMachineReportTabId, groupKey: string) => `${tabId}:${groupKey}`;
  const isGroupExpanded = (tabId: BbMachineReportTabId, groupKey: string) =>
    !collapsedGroupKeys.has(scopedGroupKey(tabId, groupKey));
  const toggleGroup = (tabId: BbMachineReportTabId, groupKey: string) => {
    const key = scopedGroupKey(tabId, groupKey);
    setCollapsedGroupKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const orderOptions = useMemo(
    () =>
      buildBbOrderCodeOptions({
        productionOrders,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [productionOrders, machines, shiftSettings, dateFrom, dateTo, shiftFilter, machineFilter, selectedMachine]
  );

  const orderOptionCodes = useMemo(() => new Set(orderOptions.map(option => option.code)), [orderOptions]);

  useEffect(() => {
    setOrderCodeFilter(prev => prev.filter(code => orderOptionCodes.has(code)));
  }, [orderOptionCodes]);

  const scopedProductionOrders = useMemo(
    () =>
      orderCodeFilter.length === 0
        ? productionOrders
        : productionOrders.filter(order => orderCodeFilter.includes(order.code)),
    [productionOrders, orderCodeFilter]
  );

  const orderRows = useMemo(
    () =>
      buildBbProductionOrderLineRows({
        productionOrders: scopedProductionOrders,
        products,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [
      scopedProductionOrders,
      products,
      machines,
      shiftSettings,
      dateFrom,
      dateTo,
      shiftFilter,
      machineFilter,
      selectedMachine
    ]
  );

  const exportRows = useMemo(
    () =>
      buildBbWarehouseExportLineRows({
        productionOrders: scopedProductionOrders,
        warehouseMovements,
        materials,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [
      scopedProductionOrders,
      warehouseMovements,
      materials,
      machines,
      shiftSettings,
      dateFrom,
      dateTo,
      shiftFilter,
      machineFilter,
      selectedMachine
    ]
  );

  const orderGroups = useMemo(() => groupBbProductionOrderLines(orderRows), [orderRows]);
  const exportGroups = useMemo(
    () => groupBbWarehouseExportLines(exportRows, scopedProductionOrders, products, materials),
    [exportRows, scopedProductionOrders, products, materials]
  );
  const inboundNormGroups = useMemo(
    () =>
      buildBbInboundMaterialNormGroups({
        productionOrders: scopedProductionOrders,
        warehouseMovements,
        products,
        materials,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [
      scopedProductionOrders,
      warehouseMovements,
      products,
      materials,
      machines,
      shiftSettings,
      dateFrom,
      dateTo,
      shiftFilter,
      machineFilter,
      selectedMachine
    ]
  );
  const damagedRows = useMemo(
    () =>
      buildBbDamagedGoodsLineRows({
        productionOrders: scopedProductionOrders,
        damagedRecords,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [
      scopedProductionOrders,
      damagedRecords,
      machines,
      shiftSettings,
      dateFrom,
      dateTo,
      shiftFilter,
      machineFilter,
      selectedMachine
    ]
  );
  const damagedGroups = useMemo(() => groupBbDamagedGoodsLines(damagedRows), [damagedRows]);
  const cuoiCaRows = useMemo(
    () =>
      buildBbCuoiCaLineRows({
        productionOrders: scopedProductionOrders,
        machineNvlReports,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [
      scopedProductionOrders,
      machineNvlReports,
      machines,
      shiftSettings,
      dateFrom,
      dateTo,
      shiftFilter,
      machineFilter,
      selectedMachine
    ]
  );
  const cuoiCaGroups = useMemo(() => groupBbCuoiCaLines(cuoiCaRows), [cuoiCaRows]);
  const dauCaRows = useMemo(
    () =>
      buildBbDauCaLineRows({
        productionOrders: scopedProductionOrders,
        machineNvlReports,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [
      scopedProductionOrders,
      machineNvlReports,
      machines,
      shiftSettings,
      dateFrom,
      dateTo,
      shiftFilter,
      machineFilter,
      selectedMachine
    ]
  );
  const dauCaGroups = useMemo(() => groupBbDauCaLines(dauCaRows), [dauCaRows]);
  const inboundRows = useMemo(
    () =>
      buildBbInboundReportRows({
        productionOrders: scopedProductionOrders,
        warehouseMovements,
        machineNvlReports,
        damagedRecords,
        acceptanceReports,
        mixingReports,
        materials,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [
      scopedProductionOrders,
      warehouseMovements,
      machineNvlReports,
      damagedRecords,
      acceptanceReports,
      mixingReports,
      materials,
      machines,
      shiftSettings,
      dateFrom,
      dateTo,
      shiftFilter,
      machineFilter,
      selectedMachine
    ]
  );
  const thucDungRows = useMemo(
    () =>
      buildBbThucDungLineRows({
        productionOrders: scopedProductionOrders,
        mixingReports,
        warehouseMovements,
        machineNvlReports,
        materials,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [
      scopedProductionOrders,
      mixingReports,
      warehouseMovements,
      machineNvlReports,
      materials,
      machines,
      shiftSettings,
      dateFrom,
      dateTo,
      shiftFilter,
      machineFilter,
      selectedMachine
    ]
  );
  const thucDungGroups = useMemo(() => groupBbThucDungLines(thucDungRows), [thucDungRows]);
  // Tab thực xuất dùng: dòng NVL lấy từ báo cáo trộn (đã gộp tỉ lệ).
  const thucDungDetailView = useMemo<BbThucDungDetailBag | null>(() => {
    if (!thucDungDetail) return null;
    return buildBbThucDungMetricDetail({
      line: thucDungDetail.line,
      metric: thucDungDetail.metric,
      mixingReports,
      machineNvlReports,
      shiftSettings
    });
  }, [thucDungDetail, mixingReports, machineNvlReports, shiftSettings]);
  const tongGroups = useMemo(
    () =>
      buildBbTongGroups({
        productionOrders: scopedProductionOrders,
        warehouseMovements,
        machineNvlReports,
        damagedRecords,
        materials,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [
      scopedProductionOrders,
      warehouseMovements,
      machineNvlReports,
      damagedRecords,
      materials,
      machines,
      shiftSettings,
      dateFrom,
      dateTo,
      shiftFilter,
      machineFilter,
      selectedMachine
    ]
  );
  const orderTotals = useMemo(() => sumBbProductionOrderTotals(orderRows), [orderRows]);
  const exportTotalKg = useMemo(() => sumBbWarehouseExportWeightKg(exportRows), [exportRows]);
  const exportTotalNormKg = useMemo(
    () => exportGroups.reduce((sum, group) => sum + group.totalNormWeightKg, 0),
    [exportGroups]
  );
  const inboundNormTotalKg = useMemo(
    () => inboundNormGroups.reduce((sum, group) => sum + group.totalNormWeightKg, 0),
    [inboundNormGroups]
  );
  const damagedTotalKg = useMemo(() => sumBbDamagedGoodsWeightKg(damagedRows), [damagedRows]);
  const cuoiCaTotalKg = useMemo(() => sumBbCuoiCaWeightKg(cuoiCaRows), [cuoiCaRows]);
  const dauCaTotalKg = useMemo(() => sumBbDauCaWeightKg(dauCaRows), [dauCaRows]);
  const inboundTotals = useMemo(() => sumBbInboundReportTotals(inboundRows), [inboundRows]);
  const thucDungTotalKg = useMemo(() => sumBbThucDungWeightKg(thucDungRows), [thucDungRows]);
  const tongNhapKhoTotalKg = useMemo(() => sumBbTongTrongLuongNhapKho(tongGroups), [tongGroups]);
  const tongChenhLechTotalKg = useMemo(() => sumBbTongChenhLech(tongGroups), [tongGroups]);
  const tongTiLeChenhLech = useMemo(
    () => computePercentRatio(tongChenhLechTotalKg, tongNhapKhoTotalKg),
    [tongChenhLechTotalKg, tongNhapKhoTotalKg]
  );
  const mixingGroups = useMemo(
    () =>
      buildBbMixingRatioGroups({
        productionOrders: scopedProductionOrders,
        mixingReports,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [
      scopedProductionOrders,
      mixingReports,
      machines,
      shiftSettings,
      dateFrom,
      dateTo,
      shiftFilter,
      machineFilter,
      selectedMachine
    ]
  );
  const danhGiaGroups = useMemo(
    () =>
      buildBbDanhGiaHaoHutGroups({
        productionOrders: scopedProductionOrders,
        products,
        warehouseMovements,
        machineNvlReports,
        damagedRecords,
        materials,
        machines,
        shiftSettings,
        dateFrom,
        dateTo,
        shiftFilter,
        machineFilter,
        selectedMachine
      }),
    [
      scopedProductionOrders,
      products,
      warehouseMovements,
      machineNvlReports,
      damagedRecords,
      materials,
      machines,
      shiftSettings,
      dateFrom,
      dateTo,
      shiftFilter,
      machineFilter,
      selectedMachine
    ]
  );
  const tongGiaTriHaoHutLoiHong = useMemo(
    () => sumBbDanhGiaMoney(danhGiaGroups, 'tongGiaTriHaoHutLoiHong'),
    [danhGiaGroups]
  );
  const unmatchedExportCount = useMemo(
    () => exportRows.filter(row => !row.matchedByOrder).length,
    [exportRows]
  );

  const activeGroupKeys = useMemo(() => {
    switch (activeTab) {
      case 'lenh_sx':
        return orderGroups.map(group => group.groupKey);
      case 'phieu_xuat_kho':
        return exportGroups.map(group => group.groupKey);
      case 'ton_dau_ca':
        return dauCaGroups.map(group => group.groupKey);
      case 'bao_cao_loi_hong':
        return damagedGroups.map(group => group.groupKey);
      case 'kiem_ton_cuoi_ca':
        return cuoiCaGroups.map(group => group.groupKey);
      case 'tong_vat_tu_thuc_dung':
        return thucDungGroups.map(group => group.groupKey);
      case 'tong_dinh_muc_nvl_nhap_kho':
        return inboundNormGroups.map(group => group.groupKey);
      case 'tong':
        return tongGroups.map(group => group.groupKey);
      default:
        return [];
    }
  }, [
    activeTab,
    orderGroups,
    exportGroups,
    dauCaGroups,
    damagedGroups,
    cuoiCaGroups,
    thucDungGroups,
    inboundNormGroups,
    tongGroups
  ]);

  const allActiveGroupsExpanded =
    activeGroupKeys.length > 0 && activeGroupKeys.every(groupKey => isGroupExpanded(activeTab, groupKey));
  const setAllActiveGroupsExpanded = (expanded: boolean) => {
    setCollapsedGroupKeys(prev => {
      const next = new Set(prev);
      activeGroupKeys.forEach(groupKey => {
        const key = scopedGroupKey(activeTab, groupKey);
        if (expanded) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  };

  const updatePhanTich = (rowKey: string, value: string) => {
    setPhanTichMap(prev => {
      const next = { ...prev, [rowKey]: value };
      persistBbPhanTichMap(next);
      return next;
    });
  };

  const handlePrint = () => {
    if (orderGroups.length === 0) return;
    const initialStaff: Record<string, BbPrintConfirmSelection> = {};
    orderGroups.forEach(group => {
      initialStaff[group.groupKey] = {
        staffMain: group.staffMain || '',
        staffAssistant: group.staffAssistant || '',
        staffSupport: group.staffSupport || '',
        ghiChu: printNoteByOrder[group.groupKey] || ''
      };
    });
    setPrintStaffByOrder(initialStaff);
    setPrintConfirmOpen(true);
    void (async () => {
      try {
        const res = await fetch('/api/nhan-su');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const rows = Array.isArray(data?.staff)
          ? data.staff
          : Array.isArray(data)
            ? data
            : [];
        const names = [
          ...new Set(
            rows
              .map((row: Record<string, unknown>) =>
                String(row.name ?? row.nhan_su ?? row.ho_ten ?? row.ten ?? '').trim()
              )
              .filter(Boolean)
          )
        ].sort((a, b) => a.localeCompare(b, 'vi'));
        setHrStaffNames(names);
      } catch {
        /* giữ danh sách từ lệnh SX */
      }
    })();
  };

  const printStaffOptions = useMemo(() => {
    const names = new Set<string>(hrStaffNames);
    productionOrders.forEach(order => {
      splitProductionOrderStaffNames(order.staff || '').forEach(name => {
        if (name.trim()) names.add(name.trim());
      });
    });
    orderGroups.forEach(group => {
      [group.staffMain, group.staffAssistant, group.staffSupport].forEach(name => {
        String(name || '')
          .split(',')
          .map(part => part.trim())
          .filter(Boolean)
          .forEach(part => names.add(part));
      });
    });
    Object.values(printStaffByOrder).forEach(selection => {
      [selection.staffMain, selection.staffAssistant, selection.staffSupport].forEach(name => {
        if (name.trim()) names.add(name.trim());
      });
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [hrStaffNames, productionOrders, orderGroups, printStaffByOrder]);

  const updatePrintStaff = (
    groupKey: string,
    field: keyof BbPrintConfirmSelection,
    value: string
  ) => {
    setPrintStaffByOrder(prev => ({
      ...prev,
      [groupKey]: {
        staffMain: prev[groupKey]?.staffMain || '',
        staffAssistant: prev[groupKey]?.staffAssistant || '',
        staffSupport: prev[groupKey]?.staffSupport || '',
        ghiChu: prev[groupKey]?.ghiChu || '',
        [field]: value
      }
    }));
  };

  const confirmPrint = () => {
    const nextGroups = orderGroups.map(group => {
      const selected = printStaffByOrder[group.groupKey];
      if (!selected) return group;
      return {
        ...group,
        staffMain: selected.staffMain.trim(),
        staffAssistant: selected.staffAssistant.trim(),
        staffSupport: selected.staffSupport.trim()
      };
    });
    const nextNotes: Record<string, string> = {};
    orderGroups.forEach(group => {
      const note = printStaffByOrder[group.groupKey]?.ghiChu?.trim() || '';
      if (note) nextNotes[group.groupKey] = note;
    });
    setPrintNoteByOrder(nextNotes);
    setPrintOrderGroups(nextGroups);
    setPrintConfirmOpen(false);
    setShowPrintSheet(true);
    setPendingPrint(true);
  };

  const closePrintConfirm = () => {
    if (pendingPrint) return;
    setPrintConfirmOpen(false);
  };

  useEffect(() => {
    if (!pendingPrint || !showPrintSheet) return;
    let cancelled = false;
    document.body.classList.add('shift-summary-print-active');
    document.body.classList.add('bb-machine-report-print-active');
    const timer = window.setTimeout(() => {
      waitForPrintImagesReady().then(() => {
        if (cancelled) return;
        window.print();
        setPendingPrint(false);
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.body.classList.remove('shift-summary-print-active');
      document.body.classList.remove('bb-machine-report-print-active');
    };
  }, [pendingPrint, showPrintSheet]);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('shift-summary-print-active');
      document.body.classList.remove('bb-machine-report-print-active');
      setPendingPrint(false);
      setShowPrintSheet(false);
      setPrintOrderGroups([]);
      setPrintNoteByOrder({});
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  return (
    <>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-950 to-sky-800 px-3 py-2 text-white">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-sky-200/90">Báo cáo máy BB</p>
          <h3 className="text-sm font-black sm:text-base">Báo cáo tổng hợp máy BB</h3>
          <p className="mt-0.5 hidden text-[11px] font-medium text-sky-100/80 md:block">
            Gom theo lệnh SX — bấm nút sổ xuống để xem chi tiết từng dòng. Tỉ lệ trộn lấy từ ca trước:
            12C2 ← 12C1 cùng ngày; 12C1 ← 12C2 ngày hôm trước.
          </p>
        </div>
        <button
          type="button"
          id="bb-machine-report-print-btn"
          onClick={handlePrint}
          disabled={isLoading || orderGroups.length === 0 || pendingPrint}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/80 bg-white px-3 text-xs font-black text-sky-950 shadow-sm transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="In báo cáo tổng hợp máy BB theo từng lệnh sản xuất"
        >
          {pendingPrint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          {pendingPrint ? 'Đang chuẩn bị...' : 'In báo cáo'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-zinc-100 bg-zinc-50/80 px-2 py-1.5">
        {BB_MACHINE_REPORT_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide transition ${
              activeTab === tab.id
                ? 'bg-sky-700 text-white shadow-sm'
                : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeGroupKeys.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-sm font-extrabold text-slate-700">
            Bấm mũi tên ở dòng cha để đóng/mở các dòng con
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setAllActiveGroupsExpanded(true)}
              disabled={allActiveGroupsExpanded}
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-black text-sky-800 shadow-sm transition hover:bg-sky-50 disabled:cursor-default disabled:opacity-40"
            >
              Mở tất cả
            </button>
            <button
              type="button"
              onClick={() => setAllActiveGroupsExpanded(false)}
              disabled={!allActiveGroupsExpanded && activeGroupKeys.every(groupKey => !isGroupExpanded(activeTab, groupKey))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-default disabled:opacity-40"
            >
              Đóng tất cả
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        {activeTab === 'lenh_sx' ? (
          <table className="min-w-[1280px] w-full text-left text-sm font-semibold">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-3 py-3.5 font-black" />
                <th className="px-4 py-3.5 font-black">Ngày</th>
                <th className="px-4 py-3.5 font-black">Lệnh SX</th>
                <th className="px-4 py-3.5 font-black">Ca</th>
                <th className="px-4 py-3.5 font-black">Thợ chính</th>
                <th className="px-4 py-3.5 font-black">Phụ máy</th>
                <th className="px-4 py-3.5 font-black">Hỗ trợ</th>
                <th className="px-4 py-3.5 text-right font-black">Dòng</th>
                <th className="px-4 py-3.5 text-right font-black">SL</th>
                <th className="px-4 py-3.5 text-right font-black">Tổng TL (kg)</th>
                <th className="px-4 py-3.5 text-right font-black">% KL nhựa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải báo cáo máy BB...
                  </td>
                </tr>
              ) : orderGroups.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có lệnh SX máy BB theo bộ lọc đã chọn.
                  </td>
                </tr>
              ) : (
                orderGroups.map(group => {
                  const expanded = isGroupExpanded('lenh_sx', group.groupKey);
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="border-y border-sky-200 bg-sky-50/60 font-bold hover:bg-sky-100/50 transition">
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleGroup('lenh_sx', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-sky-300 bg-white text-sky-800 shadow-sm transition hover:bg-sky-50"
                            title={expanded ? 'Đóng các dòng con' : 'Mở các dòng con'}
                            aria-expanded={expanded}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-zinc-700">{group.ngay || '—'}</td>
                        <td className="px-4 py-2.5 font-mono font-black text-sky-900">{group.orderCode || '—'}</td>
                        <td className="px-4 py-2.5 font-semibold text-zinc-800">
                          {group.shiftLabel || group.shift || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-700 text-sm">{group.staffMain || '—'}</td>
                        <td className="px-4 py-2.5 text-zinc-700 text-sm">{group.staffAssistant || '—'}</td>
                        <td className="px-4 py-2.5 text-zinc-700 text-sm">{group.staffSupport || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-600">{group.lineCount}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-800">
                          {formatNumber(group.quantity, 2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                          {formatKg(group.totalNormKg, 3)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-teal-700">
                          {group.totalNormKg > 0 ? '100%' : '—'}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-sky-100 bg-sky-100/40 text-xs font-black uppercase tracking-wider text-sky-900">
                            <td />
                            <td className="px-4 py-2 font-black">Mã hàng</td>
                            <td colSpan={2} className="px-4 py-2 font-black">
                              Tên hàng
                            </td>
                            <td className="px-4 py-2 font-black">ĐVT</td>
                            <td className="px-4 py-2 text-right font-black">
                              Định mức (kg)
                            </td>
                            <td className="px-4 py-2 text-right font-black">SL</td>
                            <td colSpan={2} className="px-4 py-2 text-right font-black">
                              Tổng (kg)
                            </td>
                            <td />
                            <td className="px-4 py-2 text-right font-black">% KL nhựa</td>
                          </tr>
                          {group.lines.map(row => {
                            const plasticPercent =
                              group.totalNormKg > 0 && row.totalNormKg && row.totalNormKg > 0
                                ? (row.totalNormKg / group.totalNormKg) * 100
                                : null;
                            return (
                            <tr key={row.key} className="bg-white font-semibold hover:bg-sky-50/40 border-b border-slate-50">
                              <td className="px-3 py-2" />
                              <td className="px-4 py-2 font-mono font-bold text-zinc-800">{row.productCode || '—'}</td>
                              <td colSpan={2} className="px-4 py-2 text-zinc-700">
                                {row.productName || '—'}
                              </td>
                              <td className="px-4 py-2 text-zinc-600">{row.unit || '—'}</td>
                              <td className="px-4 py-2 text-right font-mono font-bold text-indigo-700">
                                {formatKg(row.normKgPerUnit, 3)}
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-bold text-zinc-800">
                                {formatNumber(row.quantity, 2)}
                              </td>
                              <td colSpan={2} className="px-4 py-2 text-right font-mono font-bold text-emerald-700">
                                {formatKg(row.totalNormKg, 3)}
                              </td>
                              <td />
                              <td className="px-4 py-2 text-right font-mono font-bold text-teal-700">
                                {plasticPercent === null ? '—' : `${formatNumber(plasticPercent, 2)}%`}
                              </td>
                            </tr>
                            );
                          })}
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {!isLoading && orderGroups.length > 0 ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100 text-xs font-black text-slate-900">
                <tr>
                  <td colSpan={8} className="px-4 py-3.5 text-right uppercase tracking-wider">
                    Tổng cộng ({orderGroups.length} lệnh)
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono">{formatNumber(orderTotals.quantity, 2)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-emerald-700">
                    {formatKg(orderTotals.totalNormKg, 3)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-teal-700">
                    {orderTotals.totalNormKg > 0 ? '100%' : '—'}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'phieu_xuat_kho' ? (
          <table className="min-w-[1280px] w-full text-left text-sm font-semibold">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-3 py-3.5 font-black" />
                <th className="px-4 py-3.5 font-black">Ngày</th>
                <th className="px-4 py-3.5 font-black">Ca</th>
                <th className="px-4 py-3.5 font-black">Lệnh SX</th>
                <th className="px-4 py-3.5 font-black">Máy</th>
                <th className="px-4 py-3.5 text-right font-black">Dòng NVL</th>
                <th className="px-4 py-3.5 text-right font-black">SL thực xuất</th>
                <th className="px-4 py-3.5 text-right font-black">Định mức (kg)</th>
                <th className="px-4 py-3.5 text-right font-black">Tổng (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải phiếu xuất kho...
                  </td>
                </tr>
              ) : exportGroups.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có phiếu xuất kho NVL gắn ca/ngày lệnh máy BB.
                  </td>
                </tr>
              ) : (
                exportGroups.map(group => {
                  const expanded = isGroupExpanded('phieu_xuat_kho', group.groupKey);
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="border-y border-amber-200 bg-amber-50/60 font-bold hover:bg-amber-100/50 transition">
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleGroup('phieu_xuat_kho', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-300 bg-white text-amber-800 shadow-sm transition hover:bg-amber-50"
                            title={expanded ? 'Đóng các dòng con' : 'Mở các dòng con'}
                            aria-expanded={expanded}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-zinc-700">{group.ngay || '—'}</td>
                        <td className="px-4 py-2.5 font-semibold text-zinc-800">
                          {group.shiftLabel || group.shift || '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-black text-sky-900">{group.orderCode || '—'}</td>
                        <td className="px-4 py-2.5 font-semibold text-zinc-800">{group.machine || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-600">{group.lineCount}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-800">
                          {(() => {
                            const nonKgQty = (group.productGroups || [])
                              .flatMap(pg => pg.lines || [])
                              .filter(line => !isWarehouseKgUnit(line.unit))
                              .reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
                            return nonKgQty > 0 ? formatNumber(nonKgQty, 3) : '—';
                          })()}
                        </td>
                        <td
                          className="px-4 py-2.5 text-right font-mono font-black text-emerald-700"
                          title="Tổng số lượng sản phẩm × định mức kg/đơn vị trong bảng Sản phẩm"
                        >
                          {formatKg(group.totalNormWeightKg, 3)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-800">
                          {formatKg(group.totalWeightKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          {group.productGroups.map(productGroup => {
                            const productGroupKey = `${group.groupKey}|product:${productGroup.productKey}`;
                            const productExpanded = isGroupExpanded('phieu_xuat_kho', productGroupKey);
                            const allocationLabel =
                              productGroup.allocationMode === 'quota'
                                ? 'Phân bổ theo định mức'
                                : productGroup.allocationMode === 'unassigned'
                                  ? 'Chưa có dữ liệu đối chiếu'
                                  : 'Gán trực tiếp';
                            return (
                              <React.Fragment key={productGroupKey}>
                                <tr className="border-y border-sky-200 bg-sky-50 font-bold text-sky-950 hover:bg-sky-100/80">
                                  <td className="px-2 py-1.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => toggleGroup('phieu_xuat_kho', productGroupKey)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sky-300 bg-white text-sky-800 shadow-sm transition hover:bg-sky-50"
                                      title={productExpanded ? 'Đóng NVL của sản phẩm' : 'Mở NVL của sản phẩm'}
                                      aria-expanded={productExpanded}
                                    >
                                      <ChevronDown
                                        className={`h-4 w-4 transition-transform ${productExpanded ? '' : '-rotate-90'}`}
                                      />
                                    </button>
                                  </td>
                                  <td colSpan={4} className="px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-600">
                                        Sản phẩm
                                      </span>
                                      {productGroup.productCode ? (
                                        <span className="font-mono font-black text-sky-900">{productGroup.productCode}</span>
                                      ) : null}
                                      <span className="font-black text-zinc-900">{productGroup.productName || '—'}</span>
                                      {(() => {
                                        const nonKgQty = (productGroup.lines || [])
                                          .filter(line => !isWarehouseKgUnit(line.unit))
                                          .reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
                                        return nonKgQty > 0 ? (
                                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-zinc-600 ring-1 ring-sky-200">
                                            SL xuất kho: {formatNumber(nonKgQty, 3)}
                                          </span>
                                        ) : null;
                                      })()}
                                      {productGroup.orderQuantity > 0 ? (
                                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-zinc-500 ring-1 ring-zinc-200">
                                          SL lệnh: {formatNumber(productGroup.orderQuantity, 2)} {productGroup.unit}
                                        </span>
                                      ) : null}
                                      {productGroup.normKgPerUnit !== null ? (
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                                          Định mức: {formatKg(productGroup.normKgPerUnit, 3)} kg/{productGroup.unit || 'SP'}
                                        </span>
                                      ) : null}
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                                          productGroup.allocationMode === 'unassigned'
                                            ? 'bg-rose-100 text-rose-700'
                                            : productGroup.allocationMode === 'quota'
                                              ? 'bg-violet-100 text-violet-700'
                                              : 'bg-emerald-100 text-emerald-700'
                                        }`}
                                      >
                                        {allocationLabel}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-sky-800">
                                    {productGroup.lineCount} dòng
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-zinc-800">
                                    {(() => {
                                      const nonKgQty = (productGroup.lines || [])
                                        .filter(line => !isWarehouseKgUnit(line.unit))
                                        .reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
                                      return nonKgQty > 0 ? formatNumber(nonKgQty, 3) : '—';
                                    })()}
                                  </td>
                                  <td
                                    className="px-3 py-2 text-right font-mono font-black text-emerald-700"
                                    title={`${formatNumber(productGroup.orderQuantity, 3)} × ${formatKg(productGroup.normKgPerUnit, 3)}`}
                                  >
                                    {productGroup.normKgPerUnit === null ? '—' : formatKg(productGroup.normWeightKg, 3)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-black text-sky-800">
                                    {formatKg(productGroup.totalWeightKg, 3)}
                                  </td>
                                </tr>
                                {productExpanded ? (
                                  <>
                                    <tr className="border-y border-amber-100 bg-amber-50 text-xs font-black uppercase tracking-wider text-amber-900">
                                      <td />
                                      <td className="px-3 py-1.5 font-black">Ngày</td>
                                      <td className="px-3 py-1.5 font-black">Mã NPL</td>
                                      <td colSpan={2} className="px-3 py-1.5 font-black">
                                        Tên NPL
                                      </td>
                                      <td className="px-3 py-1.5 font-black">ĐVT</td>
                                      <td className="px-3 py-1.5 text-right font-black">SL thực xuất</td>
                                      <td className="px-3 py-1.5 text-right font-black">SL định mức</td>
                                      <td className="px-3 py-1.5 text-right font-black">Trọng lượng thực xuất</td>
                                    </tr>
                                    {productGroup.lines.length === 0 ? (
                                      <tr className="bg-white">
                                        <td />
                                        <td colSpan={8} className="px-3 py-3 text-center text-xs font-bold text-zinc-400">
                                          Chưa có NVL xuất kho khớp với thành phần của sản phẩm này.
                                        </td>
                                      </tr>
                                    ) : (
                                      productGroup.lines.map(row => (
                                        <tr key={row.key} className="bg-white font-semibold hover:bg-amber-50/60">
                                          <td className="px-2 py-1.5" />
                                          <td className="px-3 py-1.5 font-mono text-zinc-700">{row.ngay || '—'}</td>
                                          <td className="px-3 py-1.5 font-mono font-bold text-zinc-800">
                                            {row.itemCode || '—'}
                                          </td>
                                          <td colSpan={2} className="px-3 py-1.5 text-zinc-700">
                                            {row.itemName || '—'}
                                          </td>
                                          <td className="px-3 py-1.5 text-zinc-600">{row.unit || '—'}</td>
                                          <td className="px-3 py-1.5 text-right font-mono font-bold text-zinc-800">
                                            {isWarehouseKgUnit(row.unit) || row.quantity <= 0
                                              ? '—'
                                              : row.weightFormula
                                                ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        if (row.weightFormula) setSelectedExportWeight(row.weightFormula);
                                                      }}
                                                      className="rounded-md px-1.5 py-0.5 font-mono font-black text-zinc-800 underline decoration-dotted underline-offset-2 transition hover:bg-zinc-100 hover:text-zinc-950"
                                                      title="Bấm để xem công thức SL thực xuất"
                                                    >
                                                      {formatNumber(row.quantity, 3)}
                                                    </button>
                                                  )
                                                : formatNumber(row.quantity, 3)}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono font-bold text-violet-800">
                                            {isWarehouseKgUnit(row.unit) ||
                                            row.normQuantity === null ||
                                            row.normQuantity <= 0
                                              ? '—'
                                              : row.materialNorm
                                                ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => setSelectedMaterialNorm(row.materialNorm)}
                                                      className="rounded-md px-1.5 py-0.5 font-mono font-black text-violet-800 underline decoration-dotted underline-offset-2 transition hover:bg-violet-100 hover:text-violet-950"
                                                      title="Bấm để xem công thức tính định mức"
                                                    >
                                                      {formatNumber(row.normQuantity, 3)}
                                                    </button>
                                                  )
                                                : formatNumber(row.normQuantity, 3)}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-700">
                                            {row.weightKg === null || row.weightKg <= 0
                                              ? '—'
                                              : row.weightFormula
                                                ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        if (row.weightFormula) setSelectedExportWeight(row.weightFormula);
                                                      }}
                                                      className="rounded-md px-1.5 py-0.5 font-mono font-black text-amber-700 underline decoration-dotted underline-offset-2 transition hover:bg-amber-100 hover:text-amber-950"
                                                      title="Bấm để xem công thức KL thực xuất"
                                                    >
                                                      {formatKg(row.weightKg, 3)}
                                                    </button>
                                                  )
                                                : formatKg(row.weightKg, 3)}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </>
                                ) : null}
                              </React.Fragment>
                            );
                          })}
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {!isLoading && exportGroups.length > 0 ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100 text-xs font-black text-slate-900">
                <tr>
                  <td colSpan={7} className="px-4 py-3.5 text-right uppercase tracking-wider">
                    Tổng cộng
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-emerald-700">
                    {formatKg(exportTotalNormKg, 3)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-amber-800">{formatKg(exportTotalKg, 3)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'ton_dau_ca' ? (
          <table className="min-w-[1100px] w-full text-left text-sm font-semibold">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-3 py-3.5 font-black" />
                <th className="px-4 py-3.5 font-black">Ngày</th>
                <th className="px-4 py-3.5 font-black">Ca</th>
                <th className="px-4 py-3.5 font-black">Lệnh SX</th>
                <th className="px-4 py-3.5 font-black">Máy</th>
                <th className="px-4 py-3.5 text-right font-black">Dòng NVL</th>
                <th className="px-4 py-3.5 text-right font-black">Tồn đầu ca (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải báo cáo tồn đầu ca...
                  </td>
                </tr>
              ) : dauCaGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có báo cáo tồn đầu ca gắn ca/ngày lệnh máy BB.
                  </td>
                </tr>
              ) : (
                dauCaGroups.map(group => {
                  const expanded = isGroupExpanded('ton_dau_ca', group.groupKey);
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="border-y border-indigo-200 bg-indigo-50/60 font-bold hover:bg-indigo-100/50 transition">
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleGroup('ton_dau_ca', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-indigo-300 bg-white text-indigo-800 shadow-sm transition hover:bg-indigo-50"
                            title={expanded ? 'Đóng các dòng con' : 'Mở các dòng con'}
                            aria-expanded={expanded}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-zinc-700">{group.ngay || '—'}</td>
                        <td className="px-4 py-2.5 font-semibold text-zinc-800">
                          {group.shiftLabel || group.shift || '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-black text-sky-900">{group.orderCode || '—'}</td>
                        <td className="px-4 py-2.5 font-semibold text-zinc-800">{group.machine || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-600">{group.lineCount}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-800">
                          {formatKg(group.totalWeightKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-indigo-100 bg-indigo-100/40 text-xs font-black uppercase tracking-wider text-indigo-900">
                            <td />
                            <td className="px-4 py-2 font-black">Mã NVL</td>
                            <td colSpan={2} className="px-4 py-2 font-black">
                              Tên NVL
                            </td>
                            <td className="px-4 py-2 font-black">ĐVT</td>
                            <td className="px-4 py-2 text-right font-black">SL</td>
                            <td className="px-4 py-2 text-right font-black">Tổng (kg)</td>
                          </tr>
                          {group.lines.map(row => (
                            <tr key={row.key} className="bg-white font-semibold hover:bg-indigo-50/40 border-b border-slate-50">
                              <td className="px-3 py-2" />
                              <td className="px-4 py-2 font-mono font-bold text-zinc-800">{row.itemCode || '—'}</td>
                              <td colSpan={2} className="px-4 py-2 text-zinc-700">
                                {row.itemName || '—'}
                              </td>
                              <td className="px-4 py-2 text-zinc-600">{row.unit || '—'}</td>
                              <td className="px-4 py-2 text-right font-mono font-bold text-zinc-800">
                                {formatNumber(row.quantity, 3)}
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-bold text-indigo-700">
                                {formatKg(row.weightKg, 3)}
                              </td>
                            </tr>
                          ))}
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {!isLoading && dauCaGroups.length > 0 ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100 text-xs font-black text-slate-900">
                <tr>
                  <td colSpan={6} className="px-4 py-3.5 text-right uppercase tracking-wider">
                    Tổng tồn đầu ca
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-indigo-800">{formatKg(dauCaTotalKg, 3)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'bao_cao_loi_hong' ? (
          <>
            {damagedGroups.length > 0 ? (
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-sm font-extrabold text-slate-700">
                  Bấm mũi tên ở dòng cha để đóng/mở các dòng con
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setAllActiveGroupsExpanded(true)}
                    disabled={damagedGroups.every(g => isGroupExpanded('bao_cao_loi_hong', g.groupKey))}
                    className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-black text-rose-800 shadow-sm transition hover:bg-rose-50 disabled:cursor-default disabled:opacity-40"
                  >
                    Mở tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllActiveGroupsExpanded(false)}
                    disabled={damagedGroups.every(g => !isGroupExpanded('bao_cao_loi_hong', g.groupKey))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-default disabled:opacity-40"
                  >
                    Đóng tất cả
                  </button>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm font-semibold">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-3 py-3.5 font-black" />
                <th className="px-4 py-3.5 font-black">Ngày</th>
                <th className="px-4 py-3.5 font-black">Ca</th>
                <th className="px-4 py-3.5 font-black">Lệnh SX</th>
                <th className="px-4 py-3.5 font-black">Máy</th>
                <th className="px-4 py-3.5 text-right font-black">Dòng NVL</th>
                <th className="px-4 py-3.5 text-right font-black">Lỗi hỏng (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải báo cáo lỗi hỏng...
                  </td>
                </tr>
              ) : damagedGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có báo cáo lỗi hỏng gắn ca/ngày lệnh máy BB.
                  </td>
                </tr>
              ) : (
                damagedGroups.map(group => {
                  const expanded = isGroupExpanded('bao_cao_loi_hong', group.groupKey);
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="border-y border-rose-200 bg-rose-50/60 font-bold hover:bg-rose-100/50 transition">
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => toggleGroup('bao_cao_loi_hong', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300 bg-white text-rose-800 shadow-sm transition hover:bg-rose-50"
                            title={expanded ? 'Đóng các dòng con' : 'Mở các dòng con'}
                            aria-expanded={expanded}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-zinc-700">{group.ngay || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-zinc-800">
                          {group.shiftLabel || group.shift || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono font-black text-sky-900">{group.orderCode || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-zinc-800">{group.machine || '—'}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-zinc-600">{group.lineCount}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-rose-800">
                          {formatKg(group.totalWeightKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-rose-100 bg-rose-100/40 text-xs font-black uppercase tracking-wider text-rose-900">
                            <td />
                            <td className="px-4 py-2.5 font-black">Phiếu</td>
                            <td className="px-4 py-2.5 font-black">Mã NVL</td>
                            <td colSpan={2} className="px-4 py-2.5 font-black">
                              Tên NVL
                            </td>
                            <td className="px-4 py-2.5 font-black">ĐVT</td>
                            <td className="px-4 py-2.5 text-right font-black">Tổng (kg)</td>
                          </tr>
                          {group.lines.map(row => (
                            <tr key={row.key} className="bg-white font-semibold hover:bg-rose-50/40 border-b border-slate-50">
                              <td className="px-3 py-2.5" />
                              <td className="px-4 py-2.5 font-mono text-zinc-700">{row.documentNo || '—'}</td>
                              <td className="px-4 py-2.5 font-mono font-bold text-zinc-800">
                                {row.materialCode || '—'}
                              </td>
                              <td colSpan={2} className="px-4 py-2.5 text-zinc-700">
                                {row.materialName || '—'}
                                {row.productCode ? (
                                  <span className="ml-2 text-[10px] font-semibold text-zinc-400">
                                    · SP {row.productCode}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-4 py-2.5 text-zinc-600">{row.unit || 'kg'}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-700">
                                {formatKg(row.weightKg, 3)}
                              </td>
                            </tr>
                          ))}
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {!isLoading && damagedGroups.length > 0 ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100 text-xs font-black text-slate-900">
                <tr>
                  <td colSpan={6} className="px-4 py-3.5 text-right uppercase tracking-wider">
                    Tổng lỗi hỏng
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-rose-800">{formatKg(damagedTotalKg, 3)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
            </div>
          </>
        ) : activeTab === 'kiem_ton_cuoi_ca' ? (
          <table className="min-w-[1100px] w-full text-left text-sm font-semibold">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-3 py-3.5 font-black" />
                <th className="px-4 py-3.5 font-black">Ngày</th>
                <th className="px-4 py-3.5 font-black">Ca</th>
                <th className="px-4 py-3.5 font-black">Lệnh SX</th>
                <th className="px-4 py-3.5 font-black">Máy</th>
                <th className="px-4 py-3.5 text-right font-black">Dòng NVL</th>
                <th className="px-4 py-3.5 text-right font-black">Tồn cuối ca (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải kiểm tồn cuối ca...
                  </td>
                </tr>
              ) : cuoiCaGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có báo cáo kiểm tồn cuối ca gắn ca/ngày lệnh máy BB.
                  </td>
                </tr>
              ) : (
                cuoiCaGroups.map(group => {
                  const expanded = isGroupExpanded('kiem_ton_cuoi_ca', group.groupKey);
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="border-y border-violet-200 bg-violet-50/60 font-bold hover:bg-violet-100/50 transition">
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleGroup('kiem_ton_cuoi_ca', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-300 bg-white text-violet-800 shadow-sm transition hover:bg-violet-50"
                            title={expanded ? 'Đóng các dòng con' : 'Mở các dòng con'}
                            aria-expanded={expanded}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-zinc-700">{group.ngay || '—'}</td>
                        <td className="px-4 py-2.5 font-semibold text-zinc-800">
                          {group.shiftLabel || group.shift || '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-black text-sky-900">{group.orderCode || '—'}</td>
                        <td className="px-4 py-2.5 font-semibold text-zinc-800">{group.machine || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-600">{group.lineCount}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-violet-800">
                          {formatKg(group.totalWeightKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-violet-100 bg-violet-100/40 text-xs font-black uppercase tracking-wider text-violet-900">
                            <td />
                            <td className="px-4 py-2 font-black">Mã NVL</td>
                            <td colSpan={2} className="px-4 py-2 font-black">
                              Tên NVL
                            </td>
                            <td className="px-4 py-2 font-black">ĐVT</td>
                            <td className="px-4 py-2 text-right font-black">SL</td>
                            <td className="px-4 py-2 text-right font-black">Tổng (kg)</td>
                          </tr>
                          {group.lines.map(row => (
                            <tr key={row.key} className="bg-white font-semibold hover:bg-violet-50/40 border-b border-slate-50">
                              <td className="px-3 py-2" />
                              <td className="px-4 py-2 font-mono font-bold text-zinc-800">{row.itemCode || '—'}</td>
                              <td colSpan={2} className="px-4 py-2 text-zinc-700">
                                {row.itemName || '—'}
                              </td>
                              <td className="px-4 py-2 text-zinc-600">{row.unit || '—'}</td>
                              <td className="px-4 py-2 text-right font-mono font-bold text-zinc-800">
                                {formatNumber(row.quantity, 3)}
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-bold text-violet-700">
                                {formatKg(row.weightKg, 3)}
                              </td>
                            </tr>
                          ))}
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {!isLoading && cuoiCaGroups.length > 0 ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100 text-xs font-black text-slate-900">
                <tr>
                  <td colSpan={6} className="px-4 py-3.5 text-right uppercase tracking-wider">
                    Tổng tồn cuối ca
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-violet-800">{formatKg(cuoiCaTotalKg, 3)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'phieu_nhap_kho' ? (
          <table className="min-w-[1100px] w-full text-left text-sm font-semibold">
            <thead className="bg-slate-200 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                <th className="px-3 py-2.5 font-black">Máy</th>
                <th className="px-3 py-2.5 text-right font-black">Số Lượng Đạt thực tế (Cuộn)</th>
                <th className="px-3 py-2.5 text-right font-black">Trọng lượng nhựa đã trộn (Kg)</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng TP nhập kho (Kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải báo cáo phiếu nhập kho...
                  </td>
                </tr>
              ) : inboundRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có dữ liệu phiếu nhập kho gắn ca/ngày lệnh máy BB.
                  </td>
                </tr>
              ) : (
                inboundRows.map(row => (
                  <tr key={row.key} className="hover:bg-cyan-50/40">
                    <td className="px-3 py-2 font-mono font-bold text-zinc-800">{row.ngay || '—'}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-700">{row.shiftLabel || row.shift || '—'}</td>
                    <td className="px-3 py-2 font-mono font-black text-sky-800">{row.orderCode || '—'}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-700">{row.machine || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-sky-700">
                      {formatNumber(row.acceptedRolls, 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">
                      {formatKg(row.mixedPlasticKg, 3)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-emerald-800">
                      {formatKg(row.finishedGoodsInboundKg, 3)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isLoading && inboundRows.length > 0 ? (
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={4} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng cộng
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-sky-700">
                    {formatNumber(inboundTotals.acceptedRolls, 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-700">
                    {formatKg(inboundTotals.mixedPlasticKg, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-800">
                    {formatKg(inboundTotals.finishedGoodsInboundKg, 3)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'tong_vat_tu_thuc_dung' ? (
          <table className="min-w-[1700px] w-full whitespace-nowrap text-left text-sm font-semibold">
            <colgroup>
              <col className="w-14" />
              <col className="w-[130px]" />
              <col className="w-[320px]" />
              <col className="w-[150px]" />
              <col className="w-[180px]" />
              <col className="w-[210px]" />
              <col className="w-[170px]" />
              <col className="w-[170px]" />
              <col className="w-[260px]" />
            </colgroup>
            <thead className="bg-slate-200 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-2 py-2.5 font-black" />
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                <th className="px-3 py-2.5 font-black">Máy</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng xuất trong ca (kg)</th>
                <th className="px-3 py-2.5 text-right font-black">Tồn đầu ca (kg)</th>
                <th className="px-3 py-2.5 text-right font-black">Tồn cuối ca (kg)</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng vật tư thực xuất dùng (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải vật tư thực dùng &amp; tỉ lệ trộn...
                  </td>
                </tr>
              ) : thucDungGroups.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có dữ liệu thực xuất dùng / tỉ lệ trộn gắn ca/ngày lệnh máy BB.
                  </td>
                </tr>
              ) : (
                thucDungGroups.map(group => {
                  const expanded = isGroupExpanded('tong_vat_tu_thuc_dung', group.groupKey);
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="border-y border-teal-200 bg-teal-100/80 font-bold hover:bg-teal-100">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup('tong_vat_tu_thuc_dung', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-teal-300 bg-white text-teal-800 shadow-sm transition hover:bg-teal-50"
                            title={expanded ? 'Đóng các dòng con' : 'Mở các dòng con'}
                            aria-expanded={expanded}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                          </button>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-zinc-700">{group.ngay || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-800">
                          {group.shiftLabel || group.shift || '—'}
                        </td>
                        <td className="px-3 py-2 font-mono font-black text-sky-800">{group.orderCode || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-800">{group.machine || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">
                          {formatKg(group.xuatCaTotal, 3)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">
                          {formatKg(group.tonDauCaTotal, 3)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">
                          {formatKg(group.tonCuoiCaTotal, 3)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-teal-800">
                          {formatKg(group.totalWeightKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-teal-100 bg-teal-50 text-xs font-black uppercase tracking-wider text-teal-900">
                            <td />
                            <td className="px-3 py-1.5 font-black">Mã NVL</td>
                            <td className="px-3 py-1.5 font-black">Tên NVL</td>
                            <td className="px-3 py-1.5 text-right font-black">Tỉ lệ ĐM (%)</td>
                            <td className="px-3 py-1.5 text-right font-black">Tỉ lệ TB thực tế (%)</td>
                            <td
                              className="px-3 py-1.5 text-right font-black"
                              title="Tổng xuất trong ca × Tỉ lệ TB thực tế (%)"
                            >
                              Trọng lượng đã trộn
                            </td>
                            <td className="px-3 py-1.5 text-right font-black">Tồn đầu</td>
                            <td className="px-3 py-1.5 text-right font-black">Tồn cuối</td>
                            <td className="px-3 py-1.5 text-right font-black" title="Trọng lượng đã trộn + Tồn đầu − Tồn cuối">
                              Thực dùng (kg)
                            </td>
                            <td className="px-3 py-1.5 text-right font-black">Số mẻ có KL TT</td>
                          </tr>
                          {group.lines.length === 0 ? (
                            <tr className="bg-white">
                              <td />
                              <td colSpan={9} className="px-3 py-2 text-sm font-semibold text-zinc-400">
                                Chưa có dòng NVL từ báo cáo trộn.
                              </td>
                            </tr>
                          ) : (
                            group.lines.map(row => (
                              <tr key={row.key} className="bg-white font-semibold hover:bg-teal-50/60">
                                <td className="px-2 py-1.5" />
                                <td className="px-3 py-1.5 font-mono font-bold text-zinc-800">
                                  {row.materialCode || '—'}
                                </td>
                                <td className="px-3 py-1.5 text-zinc-700">{row.materialName || '—'}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-zinc-600">
                                  <ThucDungMetricButton
                                    label={formatPercent(row.tiLeDinhMucPercent, 2)}
                                    className="font-mono text-zinc-600"
                                    onOpen={() => setThucDungDetail({ line: row, metric: 'ti_le_dinh_muc' })}
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono font-bold text-orange-800">
                                  <ThucDungMetricButton
                                    label={formatPercent(row.tiLeThucTeTbPercent, 2)}
                                    className="font-mono font-bold text-orange-800"
                                    onOpen={() => setThucDungDetail({ line: row, metric: 'ti_le_thuc_te' })}
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-amber-700">
                                  <ThucDungMetricButton
                                    label={formatKg(row.trongLuongDaTronKg, 3)}
                                    className="font-mono text-amber-700"
                                    onOpen={() => setThucDungDetail({ line: row, metric: 'trong_luong_da_tron' })}
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-zinc-600">
                                  <ThucDungMetricButton
                                    label={formatKg(row.tonDauKg, 3)}
                                    className="font-mono text-zinc-600"
                                    onOpen={() => setThucDungDetail({ line: row, metric: 'ton_dau' })}
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-zinc-600">
                                  <ThucDungMetricButton
                                    label={formatKg(row.tonCuoiKg, 3)}
                                    className="font-mono text-zinc-600"
                                    onOpen={() => setThucDungDetail({ line: row, metric: 'ton_cuoi' })}
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono font-bold text-teal-700">
                                  <ThucDungMetricButton
                                    label={formatKg(row.weightKg, 3)}
                                    className="font-mono font-bold text-teal-700"
                                    onOpen={() => setThucDungDetail({ line: row, metric: 'thuc_dung' })}
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-zinc-700">
                                  <ThucDungMetricButton
                                    label={formatNumber(row.batchCount, 0)}
                                    className="font-mono text-zinc-700"
                                    onOpen={() => setThucDungDetail({ line: row, metric: 'so_me' })}
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {!isLoading && thucDungGroups.length > 0 ? (
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={5} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng cộng
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-700">
                    {formatKg(thucDungGroups.reduce((sum, g) => sum + (g.xuatCaTotal || 0), 0), 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-700">
                    {formatKg(thucDungGroups.reduce((sum, g) => sum + (g.tonDauCaTotal || 0), 0), 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-700">
                    {formatKg(thucDungGroups.reduce((sum, g) => sum + (g.tonCuoiCaTotal || 0), 0), 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-teal-800">{formatKg(thucDungTotalKg, 3)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'tong_dinh_muc_nvl_nhap_kho' ? (
          <>
            {inboundNormGroups.length > 0 ? (
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-sm font-extrabold text-slate-700">
                  Bấm mũi tên ở dòng cha để đóng/mở các dòng con
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setAllActiveGroupsExpanded(true)}
                    disabled={inboundNormGroups.every(g => isGroupExpanded('tong_dinh_muc_nvl_nhap_kho', g.groupKey))}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-black text-amber-800 shadow-sm transition hover:bg-amber-50 disabled:cursor-default disabled:opacity-40"
                  >
                    Mở tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllActiveGroupsExpanded(false)}
                    disabled={inboundNormGroups.every(g => !isGroupExpanded('tong_dinh_muc_nvl_nhap_kho', g.groupKey))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-default disabled:opacity-40"
                  >
                    Đóng tất cả
                  </button>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-left text-sm font-semibold">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-3 py-3.5 font-black" />
                <th className="px-4 py-3.5 font-black">Ngày</th>
                <th className="px-4 py-3.5 font-black">Ca</th>
                <th className="px-4 py-3.5 font-black">Lệnh SX</th>
                <th className="px-4 py-3.5 font-black">Máy</th>
                <th className="px-4 py-3.5 text-right font-black">Dòng SP</th>
                <th className="px-4 py-3.5 text-right font-black">Tổng định mức (kg)</th>
                <th className="px-4 py-3.5 text-right font-black">SL</th>
                <th className="px-4 py-3.5 text-right font-black">Tổng TL (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải định mức vật tư nhập kho...
                  </td>
                </tr>
              ) : inboundNormGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có phiếu nhập kho thành phẩm theo bộ lọc đã chọn.
                  </td>
                </tr>
              ) : (
                inboundNormGroups.map(group => {
                  const expanded = isGroupExpanded('tong_dinh_muc_nvl_nhap_kho', group.groupKey);
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="border-y border-amber-200 bg-amber-50/60 font-bold hover:bg-amber-100/50 transition">
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => toggleGroup('tong_dinh_muc_nvl_nhap_kho', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-300 bg-white text-amber-800 shadow-sm transition hover:bg-amber-50"
                            title={expanded ? 'Đóng các dòng con' : 'Mở các dòng con'}
                            aria-expanded={expanded}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-zinc-700">{group.ngay || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-zinc-800">
                          {group.shiftLabel || group.shift || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono font-black text-sky-900">{group.orderCode || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-zinc-800">{group.machine || '—'}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-zinc-600">{group.productGroups.length}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-800">
                          {formatKg(group.totalNormWeightKg, 3)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-zinc-600">
                          {formatNumber(group.quantity, 3)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">
                          {formatKg(group.totalWeightKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-amber-100 bg-amber-100/40 text-xs font-black uppercase tracking-wider text-amber-900">
                            <td />
                            <td className="px-4 py-2.5 font-black">Mã NVL</td>
                            <td colSpan={3} className="px-4 py-2.5 font-black">
                              Tên NVL
                            </td>
                            <td className="px-4 py-2.5 font-black">ĐVT</td>
                            <td className="px-4 py-2.5 text-right font-black">SL thực xuất</td>
                            <td className="px-4 py-2.5 text-right font-black">SL định mức</td>
                            <td className="px-4 py-2.5 text-right font-black">Trọng lượng thực xuất</td>
                          </tr>
                          {(() => {
                            const allLines = group.productGroups.flatMap(productGroup =>
                              (productGroup.lines || []).map(row => ({ ...row }))
                            );
                            const groupedByCode = new Map<
                              string,
                              {
                                itemCode: string;
                                itemName: string;
                                unit: string;
                                totalNormQty: number;
                                totalExportQty: number;
                                totalExportKg: number;
                              }
                            >();
                            allLines.forEach(row => {
                              const key = row.itemCode || '—';
                              if (!groupedByCode.has(key)) {
                                groupedByCode.set(key, {
                                  itemCode: row.itemCode,
                                  itemName: row.itemName,
                                  unit: row.unit,
                                  totalNormQty: 0,
                                  totalExportQty: 0,
                                  totalExportKg: 0
                                });
                              }
                              const existing = groupedByCode.get(key)!;
                              if (!isWarehouseKgUnit(row.unit)) {
                                existing.totalNormQty +=
                                  row.normQuantity && row.normQuantity > 0 ? row.normQuantity : 0;
                                existing.totalExportQty += row.quantity > 0 ? row.quantity : 0;
                              }
                              existing.totalExportKg += row.weightKg && row.weightKg > 0 ? row.weightKg : 0;
                            });
                            return Array.from(groupedByCode.values()).map((row, idx) => (
                              <tr key={`${group.groupKey}-nvl-${idx}`} className="bg-white font-semibold hover:bg-amber-50/40 border-b border-slate-50">
                                <td className="px-3 py-2.5" />
                                <td className="px-4 py-2.5 font-mono font-bold text-zinc-800">
                                  {row.itemCode || '—'}
                                </td>
                                <td colSpan={3} className="px-4 py-2.5 text-zinc-700">
                                  {row.itemName || '—'}
                                </td>
                                <td className="px-4 py-2.5 text-zinc-600">{row.unit || '—'}</td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-700">
                                  {isWarehouseKgUnit(row.unit) || row.totalExportQty <= 0
                                    ? '—'
                                    : formatNumber(row.totalExportQty, 3)}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold text-violet-800">
                                  {isWarehouseKgUnit(row.unit) || row.totalNormQty <= 0
                                    ? '—'
                                    : formatNumber(row.totalNormQty, 3)}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-700">
                                  {formatKg(row.totalExportKg, 3)}
                                </td>
                              </tr>
                            ));
                          })()}
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {!isLoading && inboundNormGroups.length > 0 ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100 text-xs font-black text-slate-900">
                <tr>
                  <td colSpan={6} className="px-4 py-3.5 text-right uppercase tracking-wider">
                    Tổng định mức
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-amber-800">
                    {formatKg(inboundNormTotalKg, 3)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-zinc-700">
                    {formatNumber(inboundNormGroups.reduce((sum, g) => sum + (g.quantity || 0), 0), 3)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-amber-800">
                    {formatKg(inboundNormGroups.reduce((sum, g) => sum + (g.totalWeightKg || 0), 0), 3)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
            </div>
          </>
        ) : activeTab === 'tong' ? (
          <table className="min-w-[1400px] w-full text-left text-sm font-semibold">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-3 py-3.5 font-black" />
                <th className="px-4 py-3.5 font-black">Ngày</th>
                <th className="px-4 py-3.5 font-black">Ca</th>
                <th className="px-4 py-3.5 font-black">Lệnh SX</th>
                <th className="px-4 py-3.5 font-black">Máy</th>
                <th className="px-4 py-3.5 text-right font-black">Tồn đầu ca (kg)</th>
                <th className="px-4 py-3.5 text-right font-black">Xuất trong ca (kg)</th>
                <th className="px-4 py-3.5 text-right font-black">Tồn cuối ca (kg)</th>
                <th className="px-4 py-3.5 text-right font-black">Thực dùng (kg)</th>
                <th className="px-4 py-3.5 text-right font-black">Nhập kho (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải tổng hợp...
                  </td>
                </tr>
              ) : tongGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có dữ liệu tổng hợp gắn ca/ngày lệnh máy BB.
                  </td>
                </tr>
              ) : (
                tongGroups.map(group => {
                  const expanded = isGroupExpanded('tong', group.groupKey);
                  // Lấy dữ liệu tồn từ các group khác dựa trên groupKey
                  const dauCaGroup = dauCaGroups.find(g => g.groupKey === group.groupKey);
                  const cuoiCaGroup = cuoiCaGroups.find(g => g.groupKey === group.groupKey);
                  const thucDungGroup = thucDungGroups.find(g => g.groupKey === group.groupKey);
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="border-y border-emerald-200 bg-emerald-50/60 font-bold hover:bg-emerald-100/50 transition">
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleGroup('tong', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-300 bg-white text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                            title={expanded ? 'Đóng các dòng con' : 'Mở các dòng con'}
                            aria-expanded={expanded}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-zinc-800">{group.ngay || '—'}</td>
                        <td className="px-4 py-2.5 font-semibold text-zinc-700">{group.shiftLabel || group.shift || '—'}</td>
                        <td className="px-4 py-2.5 font-mono font-black text-sky-900">{group.orderCode || '—'}</td>
                        <td className="px-4 py-2.5 font-semibold text-zinc-700">{group.machine || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-700">
                          {formatKg(dauCaGroup?.totalWeightKg || 0, 3)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-700">
                          {formatKg(group.tongTrongLuongXuatRa, 3)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-violet-700">
                          {formatKg(cuoiCaGroup?.totalWeightKg || 0, 3)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-cyan-700">
                          {formatKg(thucDungGroup?.totalWeightKg || 0, 3)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                          {formatKg(group.tongTrongLuongNhapKho, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-emerald-100 bg-emerald-100/40 text-xs font-black uppercase tracking-wider text-emerald-900">
                            <td className="px-3 py-2" />
                            <td colSpan={5} className="px-4 py-2 font-black">
                              Thành phần
                            </td>
                            <td colSpan={4} className="px-4 py-2 text-right font-black">Giá trị (kg)</td>
                          </tr>
                          {group.lines.map(line => (
                            <tr key={line.key} className="bg-white font-semibold hover:bg-emerald-50/40 border-b border-slate-50">
                              <td className="px-3 py-2" />
                              <td colSpan={5} className="px-4 py-2 text-zinc-700">
                                {line.label}
                              </td>
                              <td colSpan={4} className="px-4 py-2 text-right font-mono font-bold text-zinc-800">
                                {formatKg(line.valueKg, 3)}
                              </td>
                            </tr>
                          ))}
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {!isLoading && tongGroups.length > 0 ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-100 text-xs font-black text-slate-900">
                <tr>
                  <td colSpan={5} className="px-4 py-3.5 text-right uppercase tracking-wider">
                    Tổng cộng
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-indigo-700">
                    {formatKg(dauCaTotalKg, 3)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-amber-700">
                    {formatKg(exportTotalKg, 3)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-violet-700">
                    {formatKg(cuoiCaTotalKg, 3)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-cyan-700">
                    {formatKg(thucDungTotalKg, 3)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-emerald-700">
                    {formatKg(tongNhapKhoTotalKg, 3)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[2200px] w-full text-left text-sm font-semibold">
              <thead className="bg-slate-200 text-xs uppercase tracking-wider text-slate-700">
                <tr>
                  <th className="px-3 py-2.5 font-black">Ngày</th>
                  <th className="px-3 py-2.5 font-black">Ca</th>
                  <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                  <th className="px-3 py-2.5 font-black">Máy</th>
                  <th className="px-3 py-2.5 text-right font-black">Tổng nhựa thực xuất / Tổng ĐM</th>
                  <th className="px-3 py-2.5 text-right font-black">Giá trị hao hụt nhựa</th>
                  <th className="px-3 py-2.5 text-right font-black">Tổng màng thực xuất / Tổng màng ĐM</th>
                  <th className="px-3 py-2.5 text-right font-black">Giá trị hao hụt màng</th>
                  <th className="px-3 py-2.5 text-right font-black">Tỉ lệ lỗi hỏng</th>
                  <th className="px-3 py-2.5 text-right font-black">Tỉ lệ lỗi hỏng định mức</th>
                  <th className="px-3 py-2.5 text-right font-black">Lệch lỗi hỏng so với ĐM</th>
                  <th className="px-3 py-2.5 text-right font-black">SL nhựa lỗi hỏng</th>
                  <th className="px-3 py-2.5 text-right font-black">GT nhựa lỗi hỏng</th>
                  <th className="px-3 py-2.5 text-right font-black">SL màng lỗi hỏng</th>
                  <th className="px-3 py-2.5 text-right font-black">GT màng lỗi hỏng</th>
                  <th className="px-3 py-2.5 text-right font-black">SL lõi lỗi hỏng/hao hụt</th>
                  <th className="px-3 py-2.5 text-right font-black">GT lõi lỗi hỏng/hao hụt</th>
                  <th className="px-3 py-2.5 text-right font-black">Tổng GT hao hụt + lỗi hỏng</th>
                  <th className="px-3 py-2.5 font-black">Phân tích đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={19} className="px-3 py-10 text-center font-bold text-zinc-400">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Đang tải đánh giá hiệu quả...
                    </td>
                  </tr>
                ) : danhGiaGroups.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="px-3 py-10 text-center font-bold text-zinc-400">
                      Chưa có dữ liệu đánh giá hao hụt/lỗi hỏng gắn lệnh máy BB.
                    </td>
                  </tr>
                ) : (
                  danhGiaGroups.map(group => (
                    <tr key={group.groupKey} className="hover:bg-rose-50/30">
                      <td className="px-3 py-2 font-mono font-bold text-zinc-800">{group.ngay || '—'}</td>
                      <td className="px-3 py-2 font-semibold text-zinc-700">
                        {group.shiftLabel || group.shift || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono font-black text-sky-800">{group.orderCode || '—'}</td>
                      <td className="px-3 py-2 font-semibold text-zinc-700">{group.machine || '—'}</td>
                      <td
                        className="px-3 py-2 text-right font-mono font-bold text-amber-800"
                        title={`${formatKg(group.tongNhuaThucXuat, 3)} / ${formatKg(group.tongNhuaDinhMuc, 3)} kg`}
                      >
                        {formatPercent(group.tiLeNhuaThucXuatVsDinhMuc, 2)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-bold ${
                          group.giaTriHaoHutNhua < 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                        title={`${formatKg(group.giaTriHaoHutNhuaKg, 3)} kg`}
                      >
                        {formatVnd(group.giaTriHaoHutNhua)}
                      </td>
                      <td
                        className="px-3 py-2 text-right font-mono font-bold text-fuchsia-800"
                        title={`${formatKg(group.tongMangThucXuat, 3)} / ${formatKg(group.tongMangDinhMuc, 3)} kg`}
                      >
                        {formatPercent(group.tiLeMangThucXuatVsDinhMuc, 2)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-bold ${
                          group.giaTriHaoHutMang < 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                        title={`${formatKg(group.giaTriHaoHutMangKg, 3)} kg`}
                      >
                        {formatVnd(group.giaTriHaoHutMang)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-rose-700">
                        {formatPercent(group.tiLeLoiHong, 2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-zinc-700">
                        {formatPercent(group.tiLeLoiHongDinhMuc, 2)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono font-bold ${
                          group.lechLoiHongVsDinhMuc > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatPercent(group.lechLoiHongVsDinhMuc, 2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-amber-800">
                        {formatKg(group.soLuongNhuaLoiHong, 3)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-amber-800">
                        {formatVnd(group.giaTriNhuaLoiHong)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-fuchsia-800">
                        {formatKg(group.soLuongMangLoiHong, 3)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-fuchsia-800">
                        {formatVnd(group.giaTriMangLoiHong)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-stone-700">
                        {formatKg(group.soLuongLoiLoiHong, 3)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-stone-800">
                        {formatVnd(group.giaTriLoiLoiHong)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-black text-rose-800">
                        {formatVnd(group.tongGiaTriHaoHutLoiHong)}
                      </td>
                      <td className="px-3 py-2 min-w-[180px]">
                        <textarea
                          value={phanTichMap[group.groupKey] || ''}
                          onChange={event => updatePhanTich(group.groupKey, event.target.value)}
                          rows={2}
                          placeholder="Gõ tay phân tích đánh giá..."
                          className="w-full min-w-[160px] resize-y rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d]"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!isLoading && danhGiaGroups.length > 0 ? (
                <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                  <tr>
                    <td colSpan={17} className="px-3 py-2.5 text-right uppercase tracking-wider">
                      Tổng giá trị hao hụt + lỗi hỏng
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-800">
                      {formatVnd(tongGiaTriHaoHutLoiHong)}
                    </td>
                    <td className="px-3 py-2.5" />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
      </div>

      {activeTab === 'phieu_xuat_kho' && unmatchedExportCount > 0 ? (
        <p className="border-t border-amber-100 bg-amber-50/70 px-4 py-2 text-[11px] font-semibold text-amber-800">
          {unmatchedExportCount} dòng xuất kho được gắn theo ngày + ca của lệnh BB (phiếu chưa lưu rõ mã lệnh SX).
        </p>
      ) : null}
    </section>
    {selectedMaterialNorm ? (
      <div
        className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết công thức khối lượng định mức"
        onMouseDown={event => {
          if (event.target === event.currentTarget) setSelectedMaterialNorm(null);
        }}
      >
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-emerald-800 to-emerald-600 px-5 py-4 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">Công thức định mức NVL</p>
              <h4 className="mt-1 text-base font-black">
                {selectedMaterialNorm.materialCode} · {selectedMaterialNorm.materialName}
              </h4>
              <p className="mt-1 text-xs font-semibold text-emerald-50">
                Sản phẩm: {selectedMaterialNorm.productCode} · {selectedMaterialNorm.productName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMaterialNorm(null)}
              className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-black hover:bg-white/20"
            >
              Đóng
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">SL lệnh SX</p>
                <p className="mt-1 font-mono text-lg font-black text-zinc-900">
                  {formatNumber(selectedMaterialNorm.productQuantity, 3)}
                </p>
                <p className="text-xs font-bold text-zinc-500">{selectedMaterialNorm.productUnit}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  {selectedMaterialNorm.amountType === 'percent' ? 'TL định mức/SP' : 'Định mức NVL/SP'}
                </p>
                <p className="mt-1 font-mono text-lg font-black text-zinc-900">
                  {selectedMaterialNorm.amountType === 'percent'
                    ? formatKg(selectedMaterialNorm.productNormKgPerUnit, 3)
                    : formatNumber(selectedMaterialNorm.rate, 3)}
                </p>
                <p className="text-xs font-bold text-zinc-500">
                  {selectedMaterialNorm.amountType === 'percent'
                    ? `kg/${selectedMaterialNorm.productUnit}`
                    : `${selectedMaterialNorm.rateUnit}/${selectedMaterialNorm.productUnit}`}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  {selectedMaterialNorm.amountType === 'percent' ? 'Tỷ lệ NVL' : 'SL NVL tính được'}
                </p>
                <p className="mt-1 font-mono text-lg font-black text-zinc-900">
                  {selectedMaterialNorm.amountType === 'percent'
                    ? `${formatNumber(selectedMaterialNorm.rate, 3)}%`
                    : formatNumber(selectedMaterialNorm.rawExpectedQuantity, 3)}
                </p>
                <p className="text-xs font-bold text-zinc-500">
                  {selectedMaterialNorm.amountType === 'percent' ? 'Thành phần sản phẩm' : selectedMaterialNorm.rawExpectedUnit}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">KL định mức</p>
                <p className="mt-1 font-mono text-lg font-black text-emerald-800">
                  {formatKg(selectedMaterialNorm.allocatedNormKg, 3)}
                </p>
                <p className="text-xs font-bold text-emerald-600">kg</p>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">Phép tính cụ thể</p>
              {selectedMaterialNorm.amountType === 'percent' ? (
                <p className="mt-2 font-mono text-sm font-black leading-7 text-zinc-900 sm:text-base">
                  {formatNumber(selectedMaterialNorm.productQuantity, 3)} {selectedMaterialNorm.productUnit}
                  {' × '}{formatKg(selectedMaterialNorm.productNormKgPerUnit, 3)} kg/{selectedMaterialNorm.productUnit}
                  {' × '}{formatNumber(selectedMaterialNorm.rate, 3)}%
                  {' = '}{formatKg(selectedMaterialNorm.totalNormKg, 3)} kg
                </p>
              ) : (
                <div className="mt-2 space-y-1 font-mono text-sm font-black leading-7 text-zinc-900 sm:text-base">
                  <p>
                    {formatNumber(selectedMaterialNorm.productQuantity, 3)} {selectedMaterialNorm.productUnit}
                    {' × '}{formatNumber(selectedMaterialNorm.rate, 3)} {selectedMaterialNorm.rateUnit}/{selectedMaterialNorm.productUnit}
                    {' = '}{formatNumber(selectedMaterialNorm.rawExpectedQuantity, 3)} {selectedMaterialNorm.rawExpectedUnit}
                  </p>
                  {selectedMaterialNorm.rawExpectedUnit.toLowerCase() !== 'kg' ? (
                    selectedMaterialNorm.catalogKgPerUnit !== null && selectedMaterialNorm.catalogKgPerUnit > 0 ? (
                      <p>
                        Quy đổi theo cột Tổng kg kho NVL ({formatNumber(selectedMaterialNorm.catalogKgPerUnit, 6)} kg/
                        {selectedMaterialNorm.rawExpectedUnit}):{' '}
                        {formatNumber(selectedMaterialNorm.rawExpectedQuantity, 3)} {selectedMaterialNorm.rawExpectedUnit}
                        {' × '}{formatNumber(selectedMaterialNorm.catalogKgPerUnit, 6)}
                        {' = '}{formatKg(selectedMaterialNorm.totalNormKg, 3)} kg
                      </p>
                    ) : (
                      <p className="text-rose-700">
                        Chưa có cột Tổng kg trong kho NVL cho mã {selectedMaterialNorm.materialCode || '—'} — không quy đổi được sang kg.
                      </p>
                    )
                  ) : null}
                </div>
              )}
              {selectedMaterialNorm.allocationRatio < 0.999999 ? (
                <p className="mt-2 border-t border-emerald-200 pt-2 text-xs font-bold text-emerald-800">
                  Phân bổ theo tỉ lệ SL sản phẩm trên phiếu xuất: dòng này nhận{' '}
                  {formatNumber(selectedMaterialNorm.allocationRatio * 100, 2)}% tổng NVL xuất
                  {' '}→ KL định mức phân bổ = {formatKg(selectedMaterialNorm.totalNormKg, 3)} ×{' '}
                  {formatNumber(selectedMaterialNorm.allocationRatio * 100, 2)}% ={' '}
                  {formatKg(selectedMaterialNorm.allocatedNormKg, 3)} kg.
                </p>
              ) : null}
            </div>

            <p className="text-xs font-semibold text-zinc-500">
              ĐVT kg: SL thực xuất = % × SL phiếu. ĐVT ≠ kg: SL thực xuất = SL định mức (để nguyên).
            </p>
          </div>
        </div>
      </div>
    ) : null}
    {selectedExportWeight ? (
      <div
        className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết công thức SL/KL thực xuất"
        onMouseDown={event => {
          if (event.target === event.currentTarget) setSelectedExportWeight(null);
        }}
      >
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-amber-800 to-amber-600 px-5 py-4 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
                Công thức SL / KL thực xuất
              </p>
              <h4 className="mt-1 text-base font-black">
                {selectedExportWeight.itemCode} · {selectedExportWeight.itemName}
              </h4>
              <p className="mt-1 text-xs font-semibold text-amber-50">
                ĐVT phiếu: {selectedExportWeight.unit || '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedExportWeight(null)}
              className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-black hover:bg-white/20"
            >
              Đóng
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">SL phiếu xuất</p>
                <p className="mt-1 font-mono text-lg font-black text-zinc-900">
                  {formatNumber(selectedExportWeight.sourceQuantity, 3)}
                </p>
                <p className="text-xs font-bold text-zinc-500">{selectedExportWeight.unit || '—'}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">SL định mức (Thành phần)</p>
                <p className="mt-1 font-mono text-lg font-black text-zinc-900">
                  {selectedExportWeight.demandQuantity !== null
                    ? formatNumber(selectedExportWeight.demandQuantity, 3)
                    : '—'}
                </p>
                <p className="text-xs font-bold text-zinc-500">
                  {selectedExportWeight.bomAmountType === 'percent'
                    ? 'Nhu cầu (kg ĐM)'
                    : selectedExportWeight.bomAmountType === 'quantity'
                      ? selectedExportWeight.bomRateUnit || selectedExportWeight.unit || 'NVL'
                      : 'Đối chiếu định mức'}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">SL thực xuất</p>
                <p className="mt-1 font-mono text-lg font-black text-zinc-900">
                  {formatNumber(selectedExportWeight.quantity, 3)}
                </p>
                <p className="text-xs font-bold text-zinc-500">{selectedExportWeight.unit || '—'}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Trọng lượng thực xuất</p>
                <p className="mt-1 font-mono text-lg font-black text-amber-800">
                  {formatKg(selectedExportWeight.weightKg, 3)}
                </p>
                <p className="text-xs font-bold text-amber-600">kg</p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">Phép tính cụ thể</p>
              <div className="mt-2 space-y-1 font-mono text-sm font-black leading-7 text-zinc-900 sm:text-base">
                {selectedExportWeight.productQuantity !== null &&
                selectedExportWeight.bomRate !== null &&
                selectedExportWeight.bomAmountType === 'quantity' ? (
                  <p>
                    Nhu cầu SP = {formatNumber(selectedExportWeight.productQuantity, 3)}{' '}
                    {selectedExportWeight.productUnit || 'SP'}
                    {' × '}
                    {formatNumber(selectedExportWeight.bomRate, 3)} {selectedExportWeight.bomRateUnit || ''}
                    {' (Số lượng Thành phần) = '}
                    {formatNumber(selectedExportWeight.demandQuantity, 3)}{' '}
                    {selectedExportWeight.bomRateUnit || selectedExportWeight.unit || ''}
                  </p>
                ) : selectedExportWeight.productQuantity !== null &&
                  selectedExportWeight.bomRate !== null &&
                  selectedExportWeight.bomAmountType === 'percent' ? (
                  <p>
                    Nhu cầu SP = KL ĐM từ Thành phần {formatNumber(selectedExportWeight.bomRate, 3)}%
                    {' (SL SP '}
                    {formatNumber(selectedExportWeight.productQuantity, 3)}{' '}
                    {selectedExportWeight.productUnit || 'SP'}
                    {') = '}
                    {formatNumber(selectedExportWeight.demandQuantity, 3)} kg
                  </p>
                ) : null}
                {selectedExportWeight.convertMode === 'kg_as_is' ? (
                  <p>
                    ĐVT kg → KL phiếu = SL phiếu = {formatNumber(selectedExportWeight.sourceQuantity, 3)}{' '}
                    {selectedExportWeight.unit || 'kg'} ={' '}
                    {formatKg(selectedExportWeight.sourceWeightKg, 3)} kg
                  </p>
                ) : selectedExportWeight.convertMode === 'ton_to_kg' ? (
                  <p>
                    {formatNumber(selectedExportWeight.sourceQuantity, 3)} {selectedExportWeight.unit || 't'}
                    {' × '}1000 = {formatKg(selectedExportWeight.sourceWeightKg, 3)} kg
                  </p>
                ) : selectedExportWeight.convertMode === 'gram_to_kg' ? (
                  <p>
                    {formatNumber(selectedExportWeight.sourceQuantity, 3)} {selectedExportWeight.unit || 'g'}
                    {' ÷ '}1000 = {formatKg(selectedExportWeight.sourceWeightKg, 3)} kg
                  </p>
                ) : selectedExportWeight.convertMode === 'multiply_tong_kg' &&
                  selectedExportWeight.catalogKgPerUnit !== null ? (
                  <p>
                    {formatNumber(selectedExportWeight.sourceQuantity, 3)} {selectedExportWeight.unit || 'đvt'}
                    {' × '}
                    {formatNumber(selectedExportWeight.catalogKgPerUnit, 6)} kg/{selectedExportWeight.unit || 'đvt'}
                    {' (cột Tổng kg kho NVL) = '}
                    {formatKg(selectedExportWeight.sourceWeightKg, 3)} kg
                  </p>
                ) : selectedExportWeight.weightKg === null ? null : (
                  <p className="text-rose-700">
                    Chưa quy đổi được KL phiếu xuất cho mã {selectedExportWeight.itemCode || '—'}.
                  </p>
                )}
              </div>
              {(!isWarehouseKgUnit(selectedExportWeight.unit) &&
                selectedExportWeight.bomAmountType === 'quantity' &&
                selectedExportWeight.bomRate !== null &&
                selectedExportWeight.productQuantity !== null) ||
              selectedExportWeight.allocationRatio < 0.999999 ||
              Math.abs(selectedExportWeight.quantity - selectedExportWeight.sourceQuantity) > 1e-9 ||
              (selectedExportWeight.sourceWeightKg !== null &&
                selectedExportWeight.weightKg !== null &&
                Math.abs(selectedExportWeight.weightKg - selectedExportWeight.sourceWeightKg) > 1e-9) ? (
                !isWarehouseKgUnit(selectedExportWeight.unit) &&
                selectedExportWeight.bomAmountType === 'quantity' &&
                selectedExportWeight.bomRate !== null &&
                selectedExportWeight.productQuantity !== null ? (
                  <p className="mt-2 border-t border-amber-200 pt-2 text-xs font-bold text-amber-900">
                    ĐVT ≠ kg → SL thực xuất = SL định mức (SL đặt × Định mức Thành phần) ={' '}
                    {formatNumber(selectedExportWeight.productQuantity, 3)}
                    {' × '}
                    {formatNumber(selectedExportWeight.bomRate, 3)}
                    {' = '}
                    {formatNumber(selectedExportWeight.quantity, 3)} {selectedExportWeight.unit || ''}
                    {selectedExportWeight.weightKg !== null ? (
                      <>
                        {'; KL = '}
                        {formatKg(selectedExportWeight.weightKg, 3)} kg
                      </>
                    ) : null}
                    . Không chia % phiếu xuất.
                  </p>
                ) : (
                  <p className="mt-2 border-t border-amber-200 pt-2 text-xs font-bold text-amber-900">
                    {selectedExportWeight.allocWeightTotal !== null &&
                    selectedExportWeight.allocWeightBase !== null ? (
                      <>
                        ĐVT kg → % phân bổ = KL định mức SP (
                        {formatKg(selectedExportWeight.allocWeightBase, 3)} kg){' ÷ tổng KL định mức các SP cùng NVL ('}
                        {formatKg(selectedExportWeight.allocWeightTotal, 3)} kg) ={' '}
                        {formatNumber(selectedExportWeight.allocationRatio * 100, 2)}%
                      </>
                    ) : (
                      <>
                        ĐVT kg → % phân bổ = SL SP
                        {selectedExportWeight.productQuantity !== null
                          ? ` (${formatNumber(selectedExportWeight.productQuantity, 3)} ${selectedExportWeight.productUnit || ''})`
                          : ''}
                        {' ÷ tổng SL các SP cùng NVL = '}
                        {formatNumber(selectedExportWeight.allocationRatio * 100, 2)}%
                      </>
                    )}
                    {' → '}SL thực xuất = {formatNumber(selectedExportWeight.sourceQuantity, 3)} ×{' '}
                    {formatNumber(selectedExportWeight.allocationRatio * 100, 2)}% ={' '}
                    {formatNumber(selectedExportWeight.quantity, 3)} {selectedExportWeight.unit || ''}
                    {selectedExportWeight.weightKg !== null ? (
                      <>
                        {'; KL thực xuất = '}
                        {formatKg(selectedExportWeight.weightKg, 3)} kg
                      </>
                    ) : null}
                    {' '}(phần cuối nhận dư làm tròn).
                  </p>
                )
              ) : (
                <p className="mt-2 border-t border-amber-200 pt-2 text-xs font-bold text-amber-900">
                  {isWarehouseKgUnit(selectedExportWeight.unit) ? (
                    <>
                      Một SP (hoặc không chia) → SL thực xuất = SL phiếu ={' '}
                      {formatNumber(selectedExportWeight.quantity, 3)} {selectedExportWeight.unit || ''}
                    </>
                  ) : (
                    <>
                      ĐVT ≠ kg → SL thực xuất = SL định mức ={' '}
                      {formatNumber(selectedExportWeight.quantity, 3)} {selectedExportWeight.unit || ''}
                      . Không chia % phiếu xuất.
                    </>
                  )}
                  {selectedExportWeight.weightKg !== null ? (
                    <>
                      {'; KL thực xuất = '}
                      {formatKg(selectedExportWeight.weightKg, 3)} kg
                    </>
                  ) : null}
                  .
                </p>
              )}
            </div>

            <p className="text-xs font-semibold text-zinc-500">
              ĐVT kg: SL thực xuất = % (KL định mức SP ÷ tổng KL định mức) × SL phiếu. ĐVT ≠ kg: SL thực xuất = SL định mức (để nguyên, không chia %).
            </p>
          </div>
        </div>
      </div>
    ) : null}
    {thucDungDetailView ? (
      <div
        className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết dữ liệu thực xuất dùng"
        onMouseDown={event => {
          if (event.target === event.currentTarget) setThucDungDetail(null);
        }}
      >
        <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-teal-800 to-teal-600 px-5 py-4 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-100">
                {thucDungDetailView.valueLabel}
              </p>
              <h4 className="mt-1 text-base font-black">{thucDungDetailView.title}</h4>
              <p className="mt-1 text-xs font-semibold text-teal-50">{thucDungDetailView.subtitle}</p>
              <p className="mt-2 font-mono text-lg font-black text-white">{thucDungDetailView.valueText}</p>
            </div>
            <button
              type="button"
              onClick={() => setThucDungDetail(null)}
              className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-black hover:bg-white/20"
            >
              Đóng
            </button>
          </div>

          <div className="space-y-3 overflow-auto p-5">
            {thucDungDetailView.formula ? (
              <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-900">
                {thucDungDetailView.formula}
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-100 text-[11px] uppercase tracking-wider text-zinc-600">
                  <tr>
                    {thucDungDetailView.columns.map(column => (
                      <th
                        key={column.key}
                        className={`px-3 py-2.5 font-black ${column.align === 'right' ? 'text-right' : ''}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {thucDungDetailView.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={thucDungDetailView.columns.length}
                        className="px-3 py-8 text-center font-bold text-zinc-400"
                      >
                        Không tìm thấy dòng nguồn tương ứng.
                      </td>
                    </tr>
                  ) : (
                    thucDungDetailView.rows.map((row, index) => (
                      <tr key={`${String(row.reportId || row.lan || row.ngay || 'row')}-${index}`} className="hover:bg-teal-50/50">
                        {thucDungDetailView.columns.map(column => (
                          <td
                            key={column.key}
                            className={`px-3 py-2 font-semibold text-zinc-800 ${
                              column.align === 'right' ? 'text-right font-mono' : ''
                            }`}
                          >
                            {formatThucDungDetailCell(row[column.key])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs font-semibold text-zinc-500">
              Nguồn: Báo cáo phối trộn và/hoặc báo cáo tồn đầu/cuối ca theo đúng mã NVL của dòng đang xem.
            </p>
          </div>
        </div>
      </div>
    ) : null}
    {printConfirmOpen ? (
      <div
        className="fixed inset-0 z-[10040] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Xác nhận in báo cáo máy BB"
        onMouseDown={event => {
          if (event.target === event.currentTarget) closePrintConfirm();
        }}
      >
        <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-sky-900 to-sky-700 px-5 py-4 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-100">Xác nhận trước khi in</p>
              <h4 className="mt-1 text-base font-black">Báo cáo tổng hợp máy BB</h4>
              <p className="mt-1 text-xs font-semibold text-sky-50">
                Kiểm tra thông tin lệnh SX. Chỉ nhân sự được chọn lại trước khi in.
              </p>
            </div>
            <button
              type="button"
              onClick={closePrintConfirm}
              className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-black hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
            {orderGroups.map(group => {
              const selection = printStaffByOrder[group.groupKey] || {
                staffMain: group.staffMain || '',
                staffAssistant: group.staffAssistant || '',
                staffSupport: group.staffSupport || '',
                ghiChu: ''
              };
              const staffSelectClass =
                'h-10 w-full rounded-lg border border-sky-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15';
              const ensureOption = (value: string) => {
                const trimmed = value.trim();
                if (!trimmed) return printStaffOptions;
                return printStaffOptions.includes(trimmed)
                  ? printStaffOptions
                  : [trimmed, ...printStaffOptions];
              };
              return (
                <div
                  key={group.groupKey}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm"
                >
                  <div className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Số lệnh</span>
                      <span className="mt-0.5 block font-mono font-black text-sky-900">{group.orderCode || '—'}</span>
                    </p>
                    <p>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Ngày</span>
                      <span className="mt-0.5 block font-semibold text-zinc-800">{group.ngay || '—'}</span>
                    </p>
                    <p>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Ca</span>
                      <span className="mt-0.5 block font-semibold text-zinc-800">
                        {group.shiftLabel || group.shift || '—'}
                      </span>
                    </p>
                    <p>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Máy</span>
                      <span className="mt-0.5 block font-semibold text-zinc-800">{group.machine || '—'}</span>
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-700">
                        CN chính máy *
                      </span>
                      <select
                        value={selection.staffMain}
                        onChange={event => updatePrintStaff(group.groupKey, 'staffMain', event.target.value)}
                        className={staffSelectClass}
                      >
                        <option value="">Chọn nhân sự...</option>
                        {ensureOption(selection.staffMain).map(name => (
                          <option key={`main-${group.groupKey}-${name}`} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-700">
                        CN phụ máy
                      </span>
                      <select
                        value={selection.staffAssistant}
                        onChange={event => updatePrintStaff(group.groupKey, 'staffAssistant', event.target.value)}
                        className={staffSelectClass}
                      >
                        <option value="">Chọn nhân sự...</option>
                        {ensureOption(selection.staffAssistant).map(name => (
                          <option key={`assistant-${group.groupKey}-${name}`} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-700">
                        CN hỗ trợ việc
                      </span>
                      <select
                        value={selection.staffSupport}
                        onChange={event => updatePrintStaff(group.groupKey, 'staffSupport', event.target.value)}
                        className={staffSelectClass}
                      >
                        <option value="">Chọn nhân sự...</option>
                        {ensureOption(selection.staffSupport).map(name => (
                          <option key={`support-${group.groupKey}-${name}`} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-3 block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-sky-700">
                      Ghi chú
                    </span>
                    <textarea
                      value={selection.ghiChu}
                      onChange={event => updatePrintStaff(group.groupKey, 'ghiChu', event.target.value)}
                      rows={3}
                      placeholder="Nhập ghi chú hiển thị trên phiếu in..."
                      className="min-h-[72px] w-full resize-y rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <button
              type="button"
              onClick={closePrintConfirm}
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-xs font-black text-slate-700"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={confirmPrint}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-sky-700 px-4 text-xs font-extrabold text-white hover:bg-sky-800"
            >
              <Printer className="h-4 w-4" />
              Xác nhận &amp; In
            </button>
          </div>
        </div>
      </div>
    ) : null}
    {showPrintSheet
      ? createPortal(
          <ControlBoardBbMachineReportPrintBatch
            orderGroups={printOrderGroups.length > 0 ? printOrderGroups : orderGroups}
            exportGroups={exportGroups}
            dauCaGroups={dauCaGroups}
            cuoiCaGroups={cuoiCaGroups}
            damagedGroups={damagedGroups}
            mixingGroups={mixingGroups}
            danhGiaGroups={danhGiaGroups}
            inboundRows={inboundRows}
            acceptanceReports={acceptanceReports}
            products={products}
            materials={materials}
            phanTichMap={phanTichMap}
            noteByOrder={printNoteByOrder}
          />,
          document.body
        )
      : null}
    </>
  );
}
