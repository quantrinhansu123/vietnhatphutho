import React from 'react';
import { shiftNamesMatch } from '../../utils/shiftSettings';
import {
  normalizeMachineNvlReports,
  type MachineNvlSavedReport
} from '../../utils/machineNvlReports';
import {
  normalizeWeighingRecords,
  getWeighingDataRows,
  slipKey,
  type WeighingRecord
} from '../../utils/weighingRecords';
import {
  normalizeMixingReport,
  groupMixingReportsForPrint,
  buildMixingReportPrintContext
} from '../../lib/mixingReportModel';
import type { MixingReport } from '../../components/MixingReportForm';
import {
  normalizeMachineDowntimeSlips,
  type MachineDowntimeSlip
} from '../../components/MachineDowntimeReportPanel';
import {
  normalizeAcceptanceReports,
  type AcceptanceReport
} from '../../components/AcceptanceReportForm';
import { MachineNvlPrintSheet, savedReportToMachineNvlPrintReport } from '../../components/MachineNvlPrintSheet';
import { MixingReportPrintSheet } from '../../components/MixingReportPrintSheet';
import { WeighingSlipPrintSheet, type WeighingSlipPrintData } from '../../components/WeighingSlipPrintSheet';
import { MachineDowntimePrintSheet, buildMachineDowntimePrintSlip } from '../../components/MachineDowntimePrintSheet';
import { AcceptanceReportPrintSheet, buildAcceptancePrintSlips } from '../../components/AcceptanceReportPrintSheet';
import {
  WarehouseSlipPrintSheet,
  type WarehouseSlipPrintData
} from '../../components/WarehouseSlipPrintModal';
import {
  normalizeWarehouseMovements,
  type WarehouseMovementRow
} from '../phieu-xuat-nhap-kho';

export type ProductionPlanReportDiagnostic = {
  label: string;
  /** Số phiếu khớp Ngày + Ca (được in). */
  matched: number;
  /** Tổng số phiếu tìm được theo Ngày (trước khi lọc theo ca). */
  dayTotal: number;
};

export type ProductionPlanRelatedReports = {
  machineNvl: MachineNvlSavedReport[];
  mixing: MixingReport[];
  weighing: WeighingRecord[];
  downtime: MachineDowntimeSlip[];
  damaged: WeighingRecord[];
  acceptance: AcceptanceReport[];
  warehouseSlips: WarehouseSlipPrintData[];
  isEmpty: boolean;
  errors: string[];
  diagnostics: ProductionPlanReportDiagnostic[];
};

function matchShift(rowShift: string, shifts: string[]): boolean {
  if (shifts.length === 0) return true;
  const trimmed = (rowShift || '').trim();
  if (!trimmed) return true;
  return shifts.some(shift => shiftNamesMatch(shift, trimmed));
}

async function fetchJson(url: string): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: null };
  }
}

/** Tải toàn bộ phiếu liên quan tới NGÀY + CA của kế hoạch để in gộp. */
export async function loadProductionPlanRelatedReports(
  planDate: string,
  shiftList: string[]
): Promise<ProductionPlanRelatedReports> {
  if (!planDate) {
    throw new Error('Chưa có ngày kế hoạch để in các phiếu liên quan.');
  }

  const shifts = Array.from(new Set((shiftList ?? []).map(s => s.trim()).filter(Boolean)));
  const errors: string[] = [];
  const encodedDate = encodeURIComponent(planDate);

  const [nvlRes, mixingRes, weighingRes, downtimeRes, damagedRes, acceptanceRes, warehouseRes] = await Promise.all([
    fetchJson(`/api/bao-cao-may-nvl-ton?ngay=${encodedDate}`),
    fetchJson(`/api/bao-cao-phoi-tron?ngay=${encodedDate}`),
    fetchJson(`/api/phieu-can-dinh-ki?ngay=${encodedDate}`),
    fetchJson(`/api/phieu-bao-dung-may?ngay=${encodedDate}`),
    fetchJson(`/api/bao-cao-hang-hong?ngay=${encodedDate}`),
    fetchJson(`/api/bao-cao-nghiem-thu?ngay=${encodedDate}`),
    fetchJson(`/api/phieu-xuat-nhap-kho?loai=xuat&loai_kho=nvl&from=${encodedDate}&to=${encodedDate}`)
  ]);

  const machineNvlAll = nvlRes.ok ? normalizeMachineNvlReports(nvlRes.data) : [];
  const machineNvl = machineNvlAll.filter(report => matchShift(report.ca, shifts));
  if (!nvlRes.ok) errors.push('Báo cáo tồn NVL');

  const mixingReportsRaw = (mixingRes.data as { reports?: unknown })?.reports;
  const mixingAll =
    mixingRes.ok && Array.isArray(mixingReportsRaw)
      ? mixingReportsRaw.map((item: Record<string, unknown>) => normalizeMixingReport(item))
      : [];
  const mixing = mixingAll.filter(report => matchShift(report.ca, shifts));
  if (!mixingRes.ok) errors.push('Trộn nguyên vật liệu');

  const weighingAll = weighingRes.ok ? normalizeWeighingRecords(weighingRes.data) : [];
  const weighing = weighingAll.filter(record => matchShift(record.shiftName, shifts));
  if (!weighingRes.ok) errors.push('Phiếu cân');

  const downtimeAll = downtimeRes.ok ? normalizeMachineDowntimeSlips(downtimeRes.data) : [];
  const downtime = downtimeAll.filter(slip => matchShift(slip.shift, shifts));
  if (!downtimeRes.ok) errors.push('Phiếu báo dừng máy');

  const damagedAll = damagedRes.ok ? normalizeWeighingRecords(damagedRes.data) : [];
  const damaged = damagedAll.filter(record => matchShift(record.shiftName, shifts));
  if (!damagedRes.ok) errors.push('Báo cáo hàng hỏng');

  const acceptanceAll = acceptanceRes.ok ? normalizeAcceptanceReports(acceptanceRes.data) : [];
  const acceptance = acceptanceAll.filter(report => matchShift(report.ca, shifts));
  if (!acceptanceRes.ok) errors.push('Báo cáo sản lượng');

  const warehouseMovementsAll = warehouseRes.ok ? normalizeWarehouseMovements(warehouseRes.data) : [];
  const warehouseMovements = warehouseMovementsAll.filter(row => matchShift(row.shift, shifts));
  if (!warehouseRes.ok) errors.push('Phiếu xuất vật tư');
  const warehouseSlips = buildWarehouseExportSlips(warehouseMovements);

  const isEmpty =
    machineNvl.length === 0 &&
    mixing.length === 0 &&
    getWeighingDataRows(weighing).length === 0 &&
    downtime.length === 0 &&
    getWeighingDataRows(damaged).length === 0 &&
    acceptance.length === 0 &&
    warehouseSlips.length === 0;

  const diagnostics: ProductionPlanReportDiagnostic[] = [
    { label: 'Báo cáo tồn NVL', matched: machineNvl.length, dayTotal: machineNvlAll.length },
    { label: 'Trộn nguyên vật liệu', matched: mixing.length, dayTotal: mixingAll.length },
    { label: 'Phiếu cân', matched: getWeighingDataRows(weighing).length, dayTotal: getWeighingDataRows(weighingAll).length },
    { label: 'Phiếu báo dừng máy', matched: downtime.length, dayTotal: downtimeAll.length },
    { label: 'Báo cáo hàng hỏng', matched: getWeighingDataRows(damaged).length, dayTotal: getWeighingDataRows(damagedAll).length },
    { label: 'Báo cáo sản lượng', matched: acceptance.length, dayTotal: acceptanceAll.length },
    { label: 'Phiếu xuất vật tư', matched: warehouseMovements.length, dayTotal: warehouseMovementsAll.length }
  ];

  return { machineNvl, mixing, weighing, downtime, damaged, acceptance, warehouseSlips, isEmpty, errors, diagnostics };
}

function buildWarehouseExportSlips(rows: WarehouseMovementRow[]): WarehouseSlipPrintData[] {
  const map = new Map<string, WarehouseMovementRow[]>();
  const order: string[] = [];

  rows.forEach(row => {
    const key = row.slipCode || row.id;
    if (!key) return;
    let group = map.get(key);
    if (!group) {
      group = [];
      map.set(key, group);
      order.push(key);
    }
    group.push(row);
  });

  return order
    .map(key => map.get(key)!)
    .filter(group => group.length > 0)
    .map(group => {
      const header = group[0];
      return {
        slipCode: header.slipCode,
        slipType: header.slipType,
        warehouseKind: header.warehouseKind,
        slipDate: header.slipDate,
        reason: header.reason,
        note: header.note,
        createdBy: header.createdBy,
        shift: header.shift,
        totalAmount: group.reduce((sum, row) => sum + row.lineAmount, 0),
        lines: group.map(row => ({
          code: row.itemCode,
          name: row.itemName,
          unit: row.unit,
          quantity: row.quantity,
          documentQuantity: row.documentQuantity ?? null,
          unitPrice: row.unitPrice,
          lineAmount: row.lineAmount
        }))
      };
    });
}

function buildWeighingSlips(records: WeighingRecord[]): WeighingSlipPrintData[] {
  const dataRows = getWeighingDataRows(records);
  const map = new Map<string, WeighingSlipPrintData>();
  const order: string[] = [];

  dataRows.forEach(record => {
    const key = slipKey(record);
    let slip = map.get(key);
    if (!slip) {
      slip = {
        documentNo: record.documentNo,
        reportDate: record.reportDate,
        productionDate: record.productionDate,
        shiftName: record.shiftName,
        worker1: record.worker1,
        worker2: record.worker2,
        machineName: record.machineName,
        rows: []
      };
      map.set(key, slip);
      order.push(key);
    }
    slip.rows.push(record);
  });

  return order.map(key => map.get(key)!);
}

/**
 * Nội dung các phiếu liên quan (không bọc batch — parent gom chung với Lệnh SX).
 */
export function ProductionPlanRelatedPrintContent({ data }: { data: ProductionPlanRelatedReports }) {

  const nvlReports = data.machineNvl.map(savedReportToMachineNvlPrintReport);
  const mixingGroups = groupMixingReportsForPrint(data.mixing);
  const weighingSlips = buildWeighingSlips(data.weighing);
  const damagedSlips = buildWeighingSlips(data.damaged);
  const downtimeSlips = data.downtime.map(slip =>
    buildMachineDowntimePrintSlip({
      slipCode: slip.slipCode,
      date: slip.date,
      shift: slip.shift,
      machineCode: slip.machineCode,
      machineName: slip.machineName,
      preparedBy: slip.preparedBy,
      productionOrder: slip.productionOrder,
      note: slip.note,
      lines: slip.lines.map(line => ({
        startTime: line.startTime,
        restartTime: line.restartTime,
        reason: line.reason,
        rollsAffected: line.rollsAffected,
        confirmedBy: line.confirmedBy,
        note: line.note
      }))
    })
  );
  const acceptanceSlips = buildAcceptancePrintSlips(data.acceptance);

  return (
    <>
      {nvlReports.map((report, index) => (
        <div key={`nvl-${index}`} className="production-order-print-page">
          <MachineNvlPrintSheet report={report} />
        </div>
      ))}
      {mixingGroups.map((group, index) => (
        <div key={`mixing-${index}`} className="production-order-print-page">
          <MixingReportPrintSheet reports={group} context={buildMixingReportPrintContext(group)} />
        </div>
      ))}
      {weighingSlips.map((slip, index) => (
        <div key={`weighing-${index}`} className="production-order-print-page">
          <WeighingSlipPrintSheet slip={slip} title="PHIẾU CÂN CA" />
        </div>
      ))}
      {damagedSlips.map((slip, index) => (
        <div key={`damaged-${index}`} className="production-order-print-page">
          <WeighingSlipPrintSheet slip={slip} title="BÁO CÁO HÀNG HỎNG" />
        </div>
      ))}
      {downtimeSlips.map((slip, index) => (
        <div key={`downtime-${index}`} className="production-order-print-page">
          <MachineDowntimePrintSheet slip={slip} />
        </div>
      ))}
      {acceptanceSlips.map((slip, index) => (
        <div key={`acceptance-${index}`} className="production-order-print-page">
          <AcceptanceReportPrintSheet slip={slip} />
        </div>
      ))}
      {data.warehouseSlips.map((slip, index) => (
        <div key={`warehouse-${slip.slipCode || index}`} className="production-order-print-page">
          <WarehouseSlipPrintSheet data={slip} />
        </div>
      ))}
    </>
  );
}
