import React, { useMemo, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
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
import {
  BB_MACHINE_REPORT_TABS,
  buildBbCuoiCaLineRows,
  buildBbDamagedGoodsLineRows,
  buildBbDanhGiaHaoHutGroups,
  buildBbDauCaLineRows,
  buildBbInboundReportRows,
  buildBbMixingRatioGroups,
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

  const orderRows = useMemo(
    () =>
      buildBbProductionOrderLineRows({
        productionOrders,
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
      productionOrders,
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
        productionOrders,
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
      productionOrders,
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
  const exportGroups = useMemo(() => groupBbWarehouseExportLines(exportRows), [exportRows]);
  const damagedRows = useMemo(
    () =>
      buildBbDamagedGoodsLineRows({
        productionOrders,
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
      productionOrders,
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
        productionOrders,
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
      productionOrders,
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
        productionOrders,
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
      productionOrders,
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
        productionOrders,
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
      productionOrders,
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
        productionOrders,
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
      productionOrders,
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
        productionOrders,
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
      productionOrders,
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
        productionOrders,
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
      productionOrders,
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
        productionOrders,
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
      productionOrders,
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

  const updatePhanTich = (rowKey: string, value: string) => {
    setPhanTichMap(prev => {
      const next = { ...prev, [rowKey]: value };
      persistBbPhanTichMap(next);
      return next;
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-sky-950 to-sky-800 px-4 py-3 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-200/90">Báo cáo máy BB</p>
        <h3 className="mt-0.5 text-base font-black">Báo cáo tổng hợp máy BB</h3>
        <p className="mt-1 text-xs font-medium text-sky-100/90">
          Gom theo lệnh SX — bấm nút sổ xuống để xem chi tiết từng dòng. Tab tỉ lệ trộn lấy trung bình thực
          tế giữa các mẻ trộn.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
        {BB_MACHINE_REPORT_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition ${
              activeTab === tab.id
                ? 'bg-sky-700 text-white shadow-sm'
                : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        {activeTab === 'lenh_sx' ? (
          <table className="min-w-[1280px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
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
                  const expanded = true;
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="bg-sky-50/40 hover:bg-sky-50/80">
                        <td className="px-2 py-2">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sky-200 bg-white text-sky-800"
                            title="Chi tiết hiển thị bên dưới"
                            aria-expanded={expanded}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
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
                          <tr className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
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
                            <tr key={row.key} className="bg-white hover:bg-zinc-50/80">
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
          <table className="min-w-[1100px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="w-10 px-2 py-2.5 font-black" />
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 font-black">Số lệnh SX</th>
                <th className="px-3 py-2.5 font-black">Máy</th>
                <th className="px-3 py-2.5 text-right font-black">Số dòng NVL</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng SL</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng trọng lượng vật tư xuất kho (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải phiếu xuất kho...
                  </td>
                </tr>
              ) : exportGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có phiếu xuất kho NVL gắn ca/ngày lệnh máy BB.
                  </td>
                </tr>
              ) : (
                exportGroups.map(group => {
                  const expanded = true;
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="bg-amber-50/40 hover:bg-amber-50/80">
                        <td className="px-2 py-2">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-white text-amber-800"
                            title="Chi tiết hiển thị bên dưới"
                            aria-expanded={expanded}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
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
                        <td className="px-3 py-2 text-right font-mono font-bold text-amber-800">
                          {formatKg(group.totalWeightKg, 3)}
                        </td>
                      </tr>
                      {expanded ? (
                        <>
                          <tr className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
                            <td />
                            <td className="px-3 py-1.5 font-black">Mã phiếu</td>
                            <td className="px-3 py-1.5 font-black">Mã NPL</td>
                            <td colSpan={2} className="px-3 py-1.5 font-black">
                              Tên NPL
                            </td>
                            <td className="px-3 py-1.5 font-black">ĐVT</td>
                            <td className="px-3 py-1.5 text-right font-black">Số lượng</td>
                            <td className="px-3 py-1.5 text-right font-black">TL (kg)</td>
                          </tr>
                          {group.lines.map(row => (
                            <tr key={row.key} className="bg-white hover:bg-zinc-50/80">
                              <td className="px-2 py-1.5" />
                              <td className="px-3 py-1.5 font-mono text-zinc-700">{row.slipCode || '—'}</td>
                              <td className="px-3 py-1.5 font-mono font-bold text-zinc-800">{row.itemCode || '—'}</td>
                              <td colSpan={2} className="px-3 py-1.5 text-zinc-700">
                                {row.itemName || '—'}
                              </td>
                              <td className="px-3 py-1.5 text-zinc-600">{row.unit || '—'}</td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-zinc-800">
                                {formatNumber(row.quantity, 3)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-700">
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
            {!isLoading && exportGroups.length > 0 ? (
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={7} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng trọng lượng vật tư xuất kho (kg)
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-800">{formatKg(exportTotalKg, 3)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        ) : activeTab === 'ton_dau_ca' ? (
          <table className="min-w-[1100px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
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
                  const expanded = true;
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="bg-indigo-50/40 hover:bg-indigo-50/80">
                        <td className="px-2 py-2">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-indigo-200 bg-white text-indigo-800"
                            title="Chi tiết hiển thị bên dưới"
                            aria-expanded={expanded}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
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
                          <tr className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
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
                            <tr key={row.key} className="bg-white hover:bg-zinc-50/80">
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
          <table className="min-w-[1100px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
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
                  const expanded = true;
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="bg-rose-50/40 hover:bg-rose-50/80">
                        <td className="px-2 py-2">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-800"
                            title="Chi tiết hiển thị bên dưới"
                            aria-expanded={expanded}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
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
                          <tr className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
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
                            <tr key={row.key} className="bg-white hover:bg-zinc-50/80">
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
          <table className="min-w-[1100px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
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
                  const expanded = true;
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="bg-violet-50/40 hover:bg-violet-50/80">
                        <td className="px-2 py-2">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-violet-200 bg-white text-violet-800"
                            title="Chi tiết hiển thị bên dưới"
                            aria-expanded={expanded}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
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
                          <tr className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
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
                            <tr key={row.key} className="bg-white hover:bg-zinc-50/80">
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
          <table className="min-w-[1100px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
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
          <table className="min-w-[1200px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
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
                  const expanded = true;
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="bg-teal-50/40 hover:bg-teal-50/80">
                        <td className="px-2 py-2">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-teal-200 bg-white text-teal-800"
                            title="Chi tiết hiển thị bên dưới"
                            aria-expanded={expanded}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
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
                          <tr className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
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
                            <tr key={row.key} className="bg-white hover:bg-zinc-50/80">
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
          <table className="min-w-[1100px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
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
                  const expanded = true;
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="bg-emerald-50/40 hover:bg-emerald-50/80">
                        <td className="px-2 py-2">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-white text-emerald-800"
                            title="Chi tiết hiển thị bên dưới"
                            aria-expanded={expanded}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
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
                          <tr className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
                            <td className="px-2 py-1.5" />
                            <td colSpan={5} className="px-3 py-1.5 font-black">
                              Thành phần
                            </td>
                            <td className="px-3 py-1.5 text-right font-black">Giá trị (kg)</td>
                            <td className="px-3 py-1.5" />
                          </tr>
                          {group.lines.map(line => (
                            <tr key={line.key} className="bg-white hover:bg-zinc-50/80">
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
          <table className="min-w-[1100px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
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
                  const expanded = true;
                  return (
                    <React.Fragment key={group.groupKey}>
                      <tr className="bg-orange-50/40 hover:bg-orange-50/80">
                        <td className="px-2 py-2">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-orange-200 bg-white text-orange-800"
                            title="Chi tiết hiển thị bên dưới"
                            aria-expanded={expanded}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
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
                          <tr className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
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
                            <tr key={line.key} className="bg-white hover:bg-zinc-50/80">
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
            <table className="min-w-[2200px] w-full text-left text-xs">
              <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
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
  );
}
