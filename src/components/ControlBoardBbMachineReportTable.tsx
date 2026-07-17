import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Printer } from 'lucide-react';
import { formatMoney, formatNumber } from '../utils';
import type { ProductRow } from '../features/san-pham/types';
import type { MachineRow } from '../features/danh-sach-may';
import type { MaterialRow } from '../features/kho-nvl';
import type { ProductionOrderRow, ProductionOrderLookupSetting } from '../features/ke-hoach-san-xuat';
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
  buildBbMixingRatioGroups,
  buildBbOrderCodeOptions,
  buildBbProductionOrderLineRows,
  buildBbThucDungLineRows,
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
  sumBbWarehouseExportWeightKg,
  type BbMaterialNormFormula,
  type BbMachineReportTabId
} from '../utils/controlBoardBbMachineReport';
import { computePercentRatio } from '../utils/controlBoardShiftSummary';

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
  const [selectedMaterialNorm, setSelectedMaterialNorm] = useState<BbMaterialNormFormula | null>(null);

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

  const toggleOrderCodeFilter = (code: string) => {
    setOrderCodeFilter(prev => (prev.includes(code) ? prev.filter(value => value !== code) : [...prev, code]));
  };

  const clearOrderCodeFilter = () => setOrderCodeFilter([]);
  const selectAllOrderCodes = () => setOrderCodeFilter(orderOptions.map(option => option.code));

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
      case 'tong':
        return tongGroups.map(group => group.groupKey);
      case 'ti_le_tron':
        return mixingGroups.map(group => group.groupKey);
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
    tongGroups,
    mixingGroups
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
    setShowPrintSheet(true);
    setPendingPrint(true);
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
            Gom theo lệnh SX — bấm nút sổ xuống để xem chi tiết từng dòng. Tab tỉ lệ trộn lấy trung bình thực
            tế giữa các mẻ trộn.
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

      <div className="border-b border-zinc-100 bg-white px-2.5 py-2">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-700">Lọc theo lệnh sản xuất</p>
            <p className="text-[10px] font-bold text-sky-700">Chọn một hoặc nhiều lệnh SX máy BB</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-500">
              {orderCodeFilter.length > 0
                ? `Đã chọn ${orderCodeFilter.length}/${orderOptions.length} lệnh`
                : `Tất cả ${orderOptions.length} lệnh`}
            </span>
            {orderOptions.length > 0 && orderCodeFilter.length < orderOptions.length ? (
              <button
                type="button"
                onClick={selectAllOrderCodes}
                className="h-8 rounded-lg border border-sky-300 bg-sky-50 px-3 text-xs font-black text-sky-800 transition hover:bg-sky-100"
              >
                Chọn tất cả
              </button>
            ) : null}
            {orderCodeFilter.length > 0 ? (
              <button
                type="button"
                onClick={clearOrderCodeFilter}
                className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
              >
                Bỏ chọn
              </button>
            ) : null}
          </div>
        </div>
        {orderOptions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-400">
            Chưa có lệnh SX máy BB theo bộ lọc ngày/ca/máy hiện tại.
          </p>
        ) : (
          <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-sky-200 bg-sky-50/40 p-2">
            {orderOptions.map(option => {
              const checked = orderCodeFilter.includes(option.code);
              return (
                <label
                  key={option.code}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-extrabold shadow-sm transition ${
                    checked
                      ? 'border-sky-500 bg-sky-100 text-sky-900 ring-1 ring-sky-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOrderCodeFilter(option.code)}
                    className="h-4 w-4 rounded border-slate-400 text-sky-700 focus:ring-sky-700/20"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        )}
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
            <thead className="bg-slate-200 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-2 py-2.5 font-black" />
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                <th className="px-3 py-2.5 font-black">Ca SX</th>
                <th className="px-3 py-2.5 font-black">Công nhân Thợ chính</th>
                <th className="px-3 py-2.5 font-black">Công nhân sx phụ máy</th>
                <th className="px-3 py-2.5 font-black">Công nhân Hỗ trợ, học việc</th>
                <th className="px-3 py-2.5 text-right font-black">Số dòng SP</th>
                <th className="px-3 py-2.5 text-right font-black">SL Đặt SX</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng TL đặt SX (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải báo cáo máy BB...
                  </td>
                </tr>
              ) : orderGroups.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có lệnh SX máy BB theo bộ lọc đã chọn.
                  </td>
                </tr>
              ) : (
                orderGroups.map(group => {
                  const expanded = isGroupExpanded('lenh_sx', group.groupKey);
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="border-y border-sky-200 bg-sky-100/80 font-bold hover:bg-sky-100">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup('lenh_sx', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-300 bg-white text-sky-800 shadow-sm transition hover:bg-sky-50"
                            title={expanded ? 'Đóng các dòng con' : 'Mở các dòng con'}
                            aria-expanded={expanded}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                          </button>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-zinc-700">{group.ngay || '—'}</td>
                        <td className="px-3 py-2 font-mono font-black text-sky-800">{group.orderCode || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-800">
                          {group.shiftLabel || group.shift || '—'}
                        </td>
                        <td className="px-3 py-2 text-zinc-700">{group.staffMain || '—'}</td>
                        <td className="px-3 py-2 text-zinc-700">{group.staffAssistant || '—'}</td>
                        <td className="px-3 py-2 text-zinc-700">{group.staffSupport || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-600">{group.lineCount}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-800">
                          {formatNumber(group.quantity, 2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                          {formatKg(group.totalNormKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-sky-100 bg-sky-50 text-xs font-black uppercase tracking-wider text-sky-900">
                            <td />
                            <td className="px-3 py-1.5 font-black">Mã hàng</td>
                            <td colSpan={2} className="px-3 py-1.5 font-black">
                              Tên hàng
                            </td>
                            <td className="px-3 py-1.5 font-black">ĐVT</td>
                            <td className="px-3 py-1.5 text-right font-black">
                              TL định mức kg/cuộn
                            </td>
                            <td className="px-3 py-1.5 text-right font-black">SL Đặt SX</td>
                            <td colSpan={2} className="px-3 py-1.5 text-right font-black">
                              Tổng TL đặt SX (kg)
                            </td>
                            <td />
                          </tr>
                          {group.lines.map(row => (
                            <tr key={row.key} className="bg-white font-semibold hover:bg-sky-50/60">
                              <td className="px-2 py-1.5" />
                              <td className="px-3 py-1.5 font-mono font-bold text-zinc-800">{row.productCode || '—'}</td>
                              <td colSpan={2} className="px-3 py-1.5 text-zinc-700">
                                {row.productName || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-zinc-600">{row.unit || '—'}</td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-indigo-700">
                                {formatKg(row.normKgPerUnit, 3)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-zinc-800">
                                {formatNumber(row.quantity, 2)}
                              </td>
                              <td colSpan={2} className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">
                                {formatKg(row.totalNormKg, 3)}
                              </td>
                              <td />
                            </tr>
                          ))}
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {!isLoading && orderGroups.length > 0 ? (
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={8} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng cộng ({orderGroups.length} lệnh)
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatNumber(orderTotals.quantity, 2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-700">
                    {formatKg(orderTotals.totalNormKg, 3)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'phieu_xuat_kho' ? (
          <table className="min-w-[1280px] w-full text-left text-sm font-semibold">
            <thead className="bg-slate-200 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-2 py-2.5 font-black" />
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                <th className="px-3 py-2.5 font-black">Máy</th>
                <th className="px-3 py-2.5 text-right font-black">Số dòng NVL</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng SL</th>
                <th className="px-3 py-2.5 text-right font-black">Khối lượng định mức (kg)</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng trọng lượng vật tư xuất kho (kg)</th>
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
                      <tr className="border-y border-amber-200 bg-amber-100/80 font-bold hover:bg-amber-100">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup('phieu_xuat_kho', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-300 bg-white text-amber-800 shadow-sm transition hover:bg-amber-50"
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
                        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-600">{group.lineCount}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-800">
                          {formatNumber(group.quantity, 3)}
                        </td>
                        <td
                          className="px-3 py-2 text-right font-mono font-black text-emerald-700"
                          title="Tổng số lượng sản phẩm × định mức kg/đơn vị trong bảng Sản phẩm"
                        >
                          {formatKg(group.totalNormWeightKg, 3)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-amber-800">
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
                                      {productGroup.orderQuantity > 0 ? (
                                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-zinc-600 ring-1 ring-sky-200">
                                          SL thực tế: {formatNumber(productGroup.orderQuantity, 2)} {productGroup.unit}
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
                                    {formatNumber(productGroup.quantity, 3)}
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
                                      <td className="px-3 py-1.5 text-right font-black">Số lượng</td>
                                      <td className="px-3 py-1.5 text-right font-black">KL định mức</td>
                                      <td className="px-3 py-1.5 text-right font-black">TL (kg)</td>
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
                                            {formatNumber(row.quantity, 3)}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">
                                            {row.normWeightKg === null || row.normWeightKg <= 0
                                              ? '—'
                                              : row.materialNorm
                                                ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => setSelectedMaterialNorm(row.materialNorm)}
                                                      className="rounded-md px-1.5 py-0.5 font-mono font-black text-emerald-700 underline decoration-dotted underline-offset-2 transition hover:bg-emerald-100 hover:text-emerald-900"
                                                      title="Bấm để xem công thức tính định mức"
                                                    >
                                                      {formatKg(row.normWeightKg, 3)}
                                                    </button>
                                                  )
                                                : formatKg(row.normWeightKg, 3)}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-700">
                                            {formatKg(row.weightKg, 3)}
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
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={7} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng cộng
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-700">
                    {formatKg(exportTotalNormKg, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-800">{formatKg(exportTotalKg, 3)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'ton_dau_ca' ? (
          <table className="min-w-[1100px] w-full text-left text-sm font-semibold">
            <thead className="bg-slate-200 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-2 py-2.5 font-black" />
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                <th className="px-3 py-2.5 font-black">Máy</th>
                <th className="px-3 py-2.5 text-right font-black">Số dòng NVL</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng trọng lượng tồn đầu ca (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
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
                      <tr className="border-y border-indigo-200 bg-indigo-100/80 font-bold hover:bg-indigo-100">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup('ton_dau_ca', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-300 bg-white text-indigo-800 shadow-sm transition hover:bg-indigo-50"
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
                        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-600">{group.lineCount}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-indigo-800">
                          {formatKg(group.totalWeightKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-indigo-100 bg-indigo-50 text-xs font-black uppercase tracking-wider text-indigo-900">
                            <td />
                            <td className="px-3 py-1.5 font-black">Mã NVL</td>
                            <td colSpan={2} className="px-3 py-1.5 font-black">
                              Tên NVL
                            </td>
                            <td className="px-3 py-1.5 font-black">ĐVT</td>
                            <td className="px-3 py-1.5 text-right font-black">SL tồn</td>
                            <td className="px-3 py-1.5 text-right font-black">Trọng lượng (kg)</td>
                          </tr>
                          {group.lines.map(row => (
                            <tr key={row.key} className="bg-white font-semibold hover:bg-indigo-50/60">
                              <td className="px-2 py-1.5" />
                              <td className="px-3 py-1.5 font-mono font-bold text-zinc-800">{row.itemCode || '—'}</td>
                              <td colSpan={2} className="px-3 py-1.5 text-zinc-700">
                                {row.itemName || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-zinc-600">{row.unit || '—'}</td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-zinc-800">
                                {formatNumber(row.quantity, 3)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-indigo-700">
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
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={6} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng trọng lượng tồn đầu ca (kg)
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-indigo-800">{formatKg(dauCaTotalKg, 3)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'bao_cao_loi_hong' ? (
          <table className="min-w-[1100px] w-full text-left text-sm font-semibold">
            <thead className="bg-slate-200 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-2 py-2.5 font-black" />
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                <th className="px-3 py-2.5 font-black">Máy</th>
                <th className="px-3 py-2.5 text-right font-black">Số dòng NVL</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng trọng lượng hàng lỗi hỏng (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
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
                      <tr className="border-y border-rose-200 bg-rose-100/80 font-bold hover:bg-rose-100">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup('bao_cao_loi_hong', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 bg-white text-rose-800 shadow-sm transition hover:bg-rose-50"
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
                        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-600">{group.lineCount}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-rose-800">
                          {formatKg(group.totalWeightKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-rose-100 bg-rose-50 text-xs font-black uppercase tracking-wider text-rose-900">
                            <td />
                            <td className="px-3 py-1.5 font-black">Số phiếu</td>
                            <td className="px-3 py-1.5 font-black">Mã NVL</td>
                            <td colSpan={2} className="px-3 py-1.5 font-black">
                              Tên NVL lỗi hỏng
                            </td>
                            <td className="px-3 py-1.5 font-black">ĐVT</td>
                            <td className="px-3 py-1.5 text-right font-black">Trọng lượng (kg)</td>
                          </tr>
                          {group.lines.map(row => (
                            <tr key={row.key} className="bg-white font-semibold hover:bg-rose-50/60">
                              <td className="px-2 py-1.5" />
                              <td className="px-3 py-1.5 font-mono text-zinc-700">{row.documentNo || '—'}</td>
                              <td className="px-3 py-1.5 font-mono font-bold text-zinc-800">
                                {row.materialCode || '—'}
                              </td>
                              <td colSpan={2} className="px-3 py-1.5 text-zinc-700">
                                {row.materialName || '—'}
                                {row.productCode ? (
                                  <span className="ml-2 text-[10px] font-semibold text-zinc-400">
                                    · SP {row.productCode}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-1.5 text-zinc-600">{row.unit || 'kg'}</td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-rose-700">
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
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={6} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng trọng lượng hàng lỗi hỏng (kg)
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-rose-800">{formatKg(damagedTotalKg, 3)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'kiem_ton_cuoi_ca' ? (
          <table className="min-w-[1100px] w-full text-left text-sm font-semibold">
            <thead className="bg-slate-200 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-2 py-2.5 font-black" />
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                <th className="px-3 py-2.5 font-black">Máy</th>
                <th className="px-3 py-2.5 text-right font-black">Số dòng NVL</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng trọng lượng tồn cuối ca (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
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
                      <tr className="border-y border-violet-200 bg-violet-100/80 font-bold hover:bg-violet-100">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup('kiem_ton_cuoi_ca', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet-300 bg-white text-violet-800 shadow-sm transition hover:bg-violet-50"
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
                        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-600">{group.lineCount}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-violet-800">
                          {formatKg(group.totalWeightKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-violet-100 bg-violet-50 text-xs font-black uppercase tracking-wider text-violet-900">
                            <td />
                            <td className="px-3 py-1.5 font-black">Mã NVL</td>
                            <td colSpan={2} className="px-3 py-1.5 font-black">
                              Tên NVL
                            </td>
                            <td className="px-3 py-1.5 font-black">ĐVT</td>
                            <td className="px-3 py-1.5 text-right font-black">SL tồn</td>
                            <td className="px-3 py-1.5 text-right font-black">Trọng lượng (kg)</td>
                          </tr>
                          {group.lines.map(row => (
                            <tr key={row.key} className="bg-white font-semibold hover:bg-violet-50/60">
                              <td className="px-2 py-1.5" />
                              <td className="px-3 py-1.5 font-mono font-bold text-zinc-800">{row.itemCode || '—'}</td>
                              <td colSpan={2} className="px-3 py-1.5 text-zinc-700">
                                {row.itemName || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-zinc-600">{row.unit || '—'}</td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-zinc-800">
                                {formatNumber(row.quantity, 3)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-violet-700">
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
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={6} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng trọng lượng tồn cuối ca (kg)
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-violet-800">{formatKg(cuoiCaTotalKg, 3)}</td>
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
          <table className="min-w-[1200px] w-full text-left text-sm font-semibold">
            <thead className="bg-slate-200 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-2 py-2.5 font-black" />
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                <th className="px-3 py-2.5 font-black">Máy</th>
                <th className="px-3 py-2.5 text-right font-black">Số dòng NVL</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng vật tư thực xuất dùng (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải vật tư thực dùng...
                  </td>
                </tr>
              ) : thucDungGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có dữ liệu vật tư thực dùng gắn ca/ngày lệnh máy BB.
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
                        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-600">{group.lineCount}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-teal-800">
                          {formatKg(group.totalWeightKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-teal-100 bg-teal-50 text-xs font-black uppercase tracking-wider text-teal-900">
                            <td />
                            <td className="px-3 py-1.5 font-black">Mã NVL</td>
                            <td colSpan={2} className="px-3 py-1.5 font-black">
                              Tên NVL
                            </td>
                            <td className="px-3 py-1.5 text-right font-black">Xuất (kg)</td>
                            <td className="px-3 py-1.5 text-right font-black">Tồn đầu − cuối</td>
                            <td className="px-3 py-1.5 text-right font-black">Thực dùng (kg)</td>
                          </tr>
                          {group.lines.map(row => (
                            <tr key={row.key} className="bg-white font-semibold hover:bg-teal-50/60">
                              <td className="px-2 py-1.5" />
                              <td className="px-3 py-1.5 font-mono font-bold text-zinc-800">
                                {row.materialCode || '—'}
                              </td>
                              <td colSpan={2} className="px-3 py-1.5 text-zinc-700">
                                {row.materialName || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-amber-700">
                                {formatKg(row.xuatKg, 3)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-zinc-600">
                                {formatKg(row.tonDauKg, 3)} − {formatKg(row.tonCuoiKg, 3)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-teal-700">
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
            {!isLoading && thucDungGroups.length > 0 ? (
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={6} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng vật tư thực xuất dùng (kg)
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-teal-800">{formatKg(thucDungTotalKg, 3)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'tong' ? (
          <table className="min-w-[1100px] w-full text-left text-sm font-semibold">
            <thead className="bg-slate-200 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-2 py-2.5 font-black" />
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                <th className="px-3 py-2.5 font-black">Máy</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng trọng lượng nhập kho</th>
                <th className="px-3 py-2.5 text-right font-black">
                  Chênh lệch Trọng lượng nhập kho − Trọng lượng Thực dùng
                </th>
                <th className="px-3 py-2.5 text-right font-black">Tỉ lệ chênh lệch trọng lượng</th>
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
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="border-y border-emerald-200 bg-emerald-100/80 font-bold hover:bg-emerald-100">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup('tong', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300 bg-white text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                            title={expanded ? 'Đóng các dòng con' : 'Mở các dòng con'}
                            aria-expanded={expanded}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                          </button>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-zinc-800">{group.ngay || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-700">{group.shiftLabel || group.shift || '—'}</td>
                        <td className="px-3 py-2 font-mono font-black text-sky-800">{group.orderCode || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-700">{group.machine || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                          {formatKg(group.tongTrongLuongNhapKho, 3)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono font-bold ${
                            group.chenhLechTrongLuongNhapXuat < 0 ? 'text-rose-700' : 'text-sky-800'
                          }`}
                        >
                          {formatKg(group.chenhLechTrongLuongNhapXuat, 3)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-800">
                          {formatPercent(group.tiLeChenhLechTrongLuong, 2)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-emerald-100 bg-emerald-50 text-xs font-black uppercase tracking-wider text-emerald-900">
                            <td className="px-2 py-1.5" />
                            <td colSpan={5} className="px-3 py-1.5 font-black">
                              Thành phần
                            </td>
                            <td className="px-3 py-1.5 text-right font-black">Giá trị (kg)</td>
                            <td className="px-3 py-1.5" />
                          </tr>
                          {group.lines.map(line => (
                            <tr key={line.key} className="bg-white font-semibold hover:bg-emerald-50/60">
                              <td className="px-2 py-1.5" />
                              <td colSpan={5} className="px-3 py-1.5 text-zinc-700">
                                {line.label}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-zinc-800">
                                {formatKg(line.valueKg, 3)}
                              </td>
                              <td className="px-3 py-1.5" />
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
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={5} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-800">
                    {formatKg(tongNhapKhoTotalKg, 3)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono ${
                      tongChenhLechTotalKg < 0 ? 'text-rose-700' : 'text-sky-800'
                    }`}
                  >
                    {formatKg(tongChenhLechTotalKg, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-800">
                    {formatPercent(tongTiLeChenhLech, 2)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'ti_le_tron' ? (
          <table className="min-w-[1100px] w-full text-left text-sm font-semibold">
            <thead className="bg-slate-200 text-xs uppercase tracking-wider text-slate-700">
              <tr>
                <th className="w-10 px-2 py-2.5 font-black" />
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                <th className="px-3 py-2.5 font-black">Máy</th>
                <th className="px-3 py-2.5 text-right font-black">Số NVL</th>
                <th className="px-3 py-2.5 text-right font-black">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải tỉ lệ trộn...
                  </td>
                </tr>
              ) : mixingGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có phiếu trộn nguyên liệu gắn ca/ngày lệnh máy BB.
                  </td>
                </tr>
              ) : (
                mixingGroups.map(group => {
                  const expanded = isGroupExpanded('ti_le_tron', group.groupKey);
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="border-y border-orange-200 bg-orange-100/80 font-bold hover:bg-orange-100">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup('ti_le_tron', group.groupKey)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-orange-300 bg-white text-orange-800 shadow-sm transition hover:bg-orange-50"
                            title={expanded ? 'Đóng các dòng con' : 'Mở các dòng con'}
                            aria-expanded={expanded}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                          </button>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-zinc-800">{group.ngay || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-700">{group.shiftLabel || group.shift || '—'}</td>
                        <td className="px-3 py-2 font-mono font-black text-sky-800">{group.orderCode || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-700">{group.machine || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-orange-800">
                          {formatNumber(group.lineCount, 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] font-semibold text-zinc-500">
                          TB thực tế giữa các mẻ
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="border-y border-orange-100 bg-orange-50 text-xs font-black uppercase tracking-wider text-orange-900">
                            <td className="px-2 py-1.5" />
                            <td className="px-3 py-1.5 font-black">Mã NVL</td>
                            <td colSpan={2} className="px-3 py-1.5 font-black">
                              Tên vật tư
                            </td>
                            <td className="px-3 py-1.5 text-right font-black">Tỉ lệ ĐM (%)</td>
                            <td className="px-3 py-1.5 text-right font-black">Tỉ lệ TB thực tế (%)</td>
                            <td className="px-3 py-1.5 text-right font-black">Số mẻ có KL TT</td>
                          </tr>
                          {group.lines.map(line => (
                            <tr key={line.key} className="bg-white font-semibold hover:bg-orange-50/60">
                              <td className="px-2 py-1.5" />
                              <td className="px-3 py-1.5 font-mono font-bold text-zinc-800">
                                {line.materialCode || '—'}
                              </td>
                              <td colSpan={2} className="px-3 py-1.5 text-zinc-700">
                                {line.materialName || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-zinc-600">
                                {formatPercent(line.tiLeDinhMucPercent, 2)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-orange-800">
                                {formatPercent(line.tiLeThucTeTbPercent, 2)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-zinc-700">
                                {formatNumber(line.batchCount, 0)}
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
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">SL sản phẩm</p>
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
                    <p>
                      Quy đổi theo Tổng TL trong kho NVL: {formatNumber(selectedMaterialNorm.rawExpectedQuantity, 3)} {selectedMaterialNorm.rawExpectedUnit}
                      {' = '}{formatKg(selectedMaterialNorm.totalNormKg, 3)} kg
                    </p>
                  ) : null}
                </div>
              )}
              {selectedMaterialNorm.allocationRatio < 0.999999 ? (
                <p className="mt-2 border-t border-emerald-200 pt-2 text-xs font-bold text-emerald-800">
                  Dòng phiếu này chiếm {formatNumber(selectedMaterialNorm.allocationRatio * 100, 2)}% tổng số lượng NVL:
                  {' '}{formatKg(selectedMaterialNorm.totalNormKg, 3)} × {formatNumber(selectedMaterialNorm.allocationRatio * 100, 2)}%
                  {' = '}{formatKg(selectedMaterialNorm.allocatedNormKg, 3)} kg.
                </p>
              ) : null}
            </div>

            <p className="text-xs font-semibold text-zinc-500">
              Nguồn: Số lượng sản phẩm trong lệnh SX + TL định mức và Thành phần NVL trong bảng Sản phẩm.
            </p>
          </div>
        </div>
      </div>
    ) : null}
    {showPrintSheet
      ? createPortal(
          <ControlBoardBbMachineReportPrintBatch
            orderGroups={orderGroups}
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
          />,
          document.body
        )
      : null}
    </>
  );
}
