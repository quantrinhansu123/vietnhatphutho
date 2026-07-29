import React from 'react';
import { formatMoney, formatNumber } from '../utils';
import { computeMaterialUsageKg } from '../utils/controlBoardShiftSummary';
import { normalizeProductCodeKey, type ProductRow } from '../features/san-pham/types';
import type { MaterialRow } from '../features/kho-nvl';
import type { AcceptanceReport } from './AcceptanceReportForm';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from './layout/constants';
import { parseProductionOrderFilterDate } from '../features/cai-dat-thoi-gian';
import { shiftNamesMatch } from '../utils/shiftSettings';
import {
  convertWarehouseQuantityToKg,
  isWarehouseKgUnit,
  mapMaterialToWeightCatalogItem
} from '../utils/warehouseWeight';
import {
  buildBbCuoiCaKgMapsFromGroup,
  buildBbMaterialKgMapsFromTabLines,
  isNnsTronMaterial,
  lookupBbMaterialKgByCodeOrName,
  lookupNnsTronTonDauKg,
  type BbCuoiCaGroup,
  type BbDamagedGoodsGroup,
  type BbDanhGiaHaoHutGroup,
  type BbDauCaGroup,
  type BbInboundReportRow,
  type BbMixingRatioGroup,
  type BbProductionOrderGroup,
  type BbWarehouseExportGroup
} from '../utils/controlBoardBbMachineReport';

type PrintProps = {
  orderGroups: BbProductionOrderGroup[];
  exportGroups: BbWarehouseExportGroup[];
  dauCaGroups: BbDauCaGroup[];
  cuoiCaGroups: BbCuoiCaGroup[];
  damagedGroups: BbDamagedGoodsGroup[];
  mixingGroups: BbMixingRatioGroup[];
  danhGiaGroups: BbDanhGiaHaoHutGroup[];
  inboundRows: BbInboundReportRow[];
  acceptanceReports: AcceptanceReport[];
  products: ProductRow[];
  materials: MaterialRow[];
  phanTichMap: Record<string, string>;
  noteByOrder?: Record<string, string>;
};

type MaterialPrintRow = {
  key: string;
  code: string;
  name: string;
  unit: string;
  normPercents: number[];
  actualPercent: number | null;
  actualMixedKg: number;
  openingKg: number;
  exportKg: number;
  finishedKg: number;
  damagedKg: number;
  closingKg: number;
};

function formatDate(value: string) {
  const iso = parseProductionOrderFilterDate(value) || value;
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value || '-';
}

function printNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return formatNumber(value, digits);
}

function printPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${formatNumber(value, 2)}%`;
}

function groupMatchesOrder(groupOrderCode: string, orderCode: string) {
  const target = orderCode.trim().toUpperCase();
  return groupOrderCode
    .split(',')
    .map(code => code.trim().toUpperCase())
    .some(code => code === target);
}

function findOrderGroup<T extends { orderCode: string }>(groups: T[], orderCode: string) {
  return groups.find(group => groupMatchesOrder(group.orderCode, orderCode));
}

function findProduct(products: ProductRow[], code: string) {
  const key = normalizeProductCodeKey(code);
  return products.find(product => normalizeProductCodeKey(product.code) === key) ?? null;
}

function acceptanceQuantityForProduct(
  order: BbProductionOrderGroup,
  productCode: string,
  productName: string,
  reports: AcceptanceReport[]
) {
  const codeKey = normalizeProductCodeKey(productCode);
  const nameKey = normalizeProductCodeKey(productName);
  return reports.reduce((sum, report) => {
    const reportDate = parseProductionOrderFilterDate(report.ngay) || report.ngay;
    if (reportDate !== order.ngay || !shiftNamesMatch(report.ca, order.shift)) return sum;
    const itemKey = normalizeProductCodeKey(report.mat_hang);
    const productMatched =
      (codeKey && (itemKey === codeKey || itemKey.includes(codeKey))) ||
      (nameKey && (itemKey === nameKey || itemKey.includes(nameKey)));
    if (!productMatched) return sum;
    return sum + (Number.isFinite(report.so_luong) ? Number(report.so_luong) : 0);
  }, 0);
}

function buildMaterialRows(
  order: BbProductionOrderGroup,
  props: PrintProps
) {
  const rows = new Map<string, MaterialPrintRow>();
  const ensure = (code: string, name: string, unit = 'kg') => {
    const key = normalizeProductCodeKey(code || name) || `${rows.size}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        code,
        name: name || code,
        unit: unit || 'kg',
        normPercents: [],
        actualPercent: null,
        actualMixedKg: 0,
        openingKg: 0,
        exportKg: 0,
        finishedKg: 0,
        damagedKg: 0,
        closingKg: 0
      };
      rows.set(key, row);
    }
    return row;
  };

  const materialsCatalog = props.materials.map(mapMaterialToWeightCatalogItem);
  for (const productLine of order.lines) {
    const product = findProduct(props.products, productLine.productCode);
    const actualProductQuantity = acceptanceQuantityForProduct(
      order,
      productLine.productCode,
      productLine.productName,
      props.acceptanceReports
    );
    for (const item of product?.nplItems || []) {
      const row = ensure(item.code, item.name, item.amountType === 'percent' ? 'kg' : item.unit);
      if (item.amountType === 'percent' && item.percent !== null) row.normPercents.push(item.percent);
      if (item.amountType === 'percent') {
        const unitNormKg = productLine.normKgPerUnit;
        if (unitNormKg !== null && unitNormKg > 0 && actualProductQuantity > 0) {
          row.finishedKg += unitNormKg * actualProductQuantity * (Math.max(0, item.percent ?? 0) / 100);
        }
      } else {
        const rawQuantity = Math.max(0, item.quantity ?? 0) * actualProductQuantity;
        const unit = String(item.unit || '').trim();
        if (rawQuantity > 0) {
          if (!unit || unit === '-' || isWarehouseKgUnit(unit)) {
            row.finishedKg += rawQuantity;
          } else {
            const converted = convertWarehouseQuantityToKg({
              quantity: rawQuantity,
              unit,
              itemCode: item.code,
              warehouseKind: 'nvl',
              materials: materialsCatalog
            });
            if (converted !== null && Number.isFinite(converted)) row.finishedKg += converted;
          }
        }
      }
    }
  }

  const exportGroup = findOrderGroup(props.exportGroups, order.orderCode);
  for (const line of exportGroup?.lines || []) {
    ensure(line.itemCode, line.itemName, line.unit).exportKg += line.weightKg || 0;
  }
  const openingGroup = findOrderGroup(props.dauCaGroups, order.orderCode);
  const tonDauMaps = buildBbMaterialKgMapsFromTabLines(openingGroup?.lines);
  const nnsTronTonDauKg = lookupNnsTronTonDauKg(tonDauMaps);
  for (const line of openingGroup?.lines || []) {
    ensure(line.itemCode, line.itemName, line.unit).openingKg += line.weightKg || 0;
  }
  const closingGroup = findOrderGroup(props.cuoiCaGroups, order.orderCode);
  const tonCuoiMaps = buildBbCuoiCaKgMapsFromGroup(closingGroup);
  const damagedGroup = findOrderGroup(props.damagedGroups, order.orderCode);
  for (const line of damagedGroup?.lines || []) {
    ensure(line.materialCode, line.materialName, line.unit || 'kg').damagedKg += line.weightKg || 0;
  }
  const mixingGroup = findOrderGroup(props.mixingGroups, order.orderCode);
  for (const line of mixingGroup?.lines || []) {
    const row = ensure(line.materialCode, line.materialName, 'kg');
    if (line.tiLeDinhMucPercent !== null) row.normPercents.push(line.tiLeDinhMucPercent);
    row.actualPercent = line.tiLeThucTeTbPercent;
    row.actualMixedKg += line.totalKlThucTe;
  }

  // TL cuối ca = cột Tổng (kg) tab «Dữ liệu trong báo cáo kiểm tồn cuối ca» (khớp mã hoặc tên NVL).
  for (const row of rows.values()) {
    row.closingKg = lookupBbMaterialKgByCodeOrName(tonCuoiMaps, row.code, row.name);
  }
  for (const line of closingGroup?.lines || []) {
    const row = ensure(line.itemCode, line.itemName, line.unit);
    row.closingKg = lookupBbMaterialKgByCodeOrName(tonCuoiMaps, line.itemCode, line.itemName);
  }

  return [...rows.values()]
    .filter(row => !(isNnsTronMaterial(row.code, row.name) && nnsTronTonDauKg > 0))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

function BbMachineOrderPrintSheet({ order, props }: { order: BbProductionOrderGroup; props: PrintProps }) {
  const inbound = findOrderGroup(props.inboundRows, order.orderCode);
  const evaluation = findOrderGroup(props.danhGiaGroups, order.orderCode);
  const analysisNote = props.phanTichMap[order.groupKey] || '';
  const ghiChu = (props.noteByOrder?.[order.groupKey] || '').trim();
  const materialRows = buildMaterialRows(order, props);
  const productRows = order.lines.map(line => {
    const actualQuantity = acceptanceQuantityForProduct(
      order,
      line.productCode,
      line.productName,
      props.acceptanceReports
    );
    const actualWeight = line.normKgPerUnit !== null ? actualQuantity * line.normKgPerUnit : null;
    const requiredWeight = line.totalNormKg;
    return { ...line, actualQuantity, actualWeight, requiredWeight };
  });
  const requiredQtyTotal = productRows.reduce((sum, row) => sum + row.quantity, 0);
  const requiredWeightTotal = productRows.reduce((sum, row) => sum + (row.requiredWeight || 0), 0);
  const actualQtyTotal = productRows.reduce((sum, row) => sum + row.actualQuantity, 0) || inbound?.acceptedRolls || 0;
  const actualWeightTotal = productRows.reduce((sum, row) => sum + (row.actualWeight || 0), 0);
  const damagedQuantity = evaluation
    ? evaluation.soLuongNhuaLoiHong + evaluation.soLuongMangLoiHong + evaluation.soLuongLoiLoiHong
    : 0;
  const damagedMoney = evaluation
    ? evaluation.giaTriNhuaLoiHong + evaluation.giaTriMangLoiHong + evaluation.giaTriLoiLoiHong
    : 0;
  const unitPrice = (money: number | undefined, quantity: number | undefined) =>
    money !== undefined && quantity !== undefined && quantity !== 0
      ? Math.abs(money / quantity)
      : null;

  return (
    <div className="production-order-print-sheet shift-summary-print-sheet bb-machine-report-print-sheet">
      <div className="production-order-print-doc shift-summary-print-doc bb-machine-report-print-doc">
        <header className="production-order-print-letterhead">
          <img src={vietNhatLogoUrl} alt={PRINT_COMPANY_NAME} className="production-order-print-logo" />
          <div className="production-order-print-company">
            <p className="production-order-print-company-name">{PRINT_COMPANY_NAME}</p>
          </div>
          <span className="bb-machine-report-print-header-spacer" aria-hidden="true" />
        </header>

        <h1 className="production-order-print-title">BÁO CÁO KẾT QUẢ THEO TỪNG LỆNH SẢN XUẤT</h1>
        <p className="bb-machine-report-print-subtitle">(Báo cáo tổng hợp máy BB)</p>

        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">1. THÔNG TIN CHUNG</h2>
          <table className="shift-summary-print-table bb-machine-report-print-info">
            <tbody>
              <tr>
                <th>Số lệnh</th><td>{order.orderCode || '-'}</td>
                <th>Ngày làm việc</th><td>{formatDate(order.ngay)}</td>
                <th>Máy sản xuất</th><td>{order.machine || '-'}</td>
              </tr>
              <tr>
                <th>Ca</th><td>{order.shiftLabel || order.shift || '-'}</td>
                <th>CN chính máy</th><td>{order.staffMain || '-'}</td>
                <th>CN phụ máy</th><td>{order.staffAssistant || '-'}</td>
              </tr>
              <tr>
                <th>CN hỗ trợ việc</th><td colSpan={5}>{order.staffSupport || '-'}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">2. BÁO CÁO THÀNH PHẨM ĐẠT NHẬP KHO</h2>
          <table className="shift-summary-print-table shift-summary-print-table-wide bb-machine-report-print-product-table">
            <thead><tr>
              <th>Mã sản phẩm</th><th>Tên sản phẩm</th><th>ĐVT</th><th>SL yêu cầu</th>
              <th>TL yêu cầu</th><th>SL đạt</th><th>TL đạt</th><th>Tỉ lệ đạt</th><th>Máy SX</th><th>Lý do phát sinh</th>
            </tr></thead>
            <tbody>
              {productRows.map(row => (
                <tr key={row.key}>
                  <td>{row.productCode || '-'}</td><td>{row.productName || '-'}</td>
                  <td className="shift-summary-print-center">{row.unit || '-'}</td>
                  <td className="shift-summary-print-num">{printNumber(row.quantity, 2)}</td>
                  <td className="shift-summary-print-num">{printNumber(row.requiredWeight, 2)}</td>
                  <td className="shift-summary-print-num">{printNumber(row.actualQuantity, 2)}</td>
                  <td className="shift-summary-print-num">{printNumber(row.actualWeight, 2)}</td>
                  <td className="shift-summary-print-num">{printPercent(row.quantity > 0 ? (row.actualQuantity / row.quantity) * 100 : null)}</td>
                  <td>{row.machine || order.machine || '-'}</td><td>{analysisNote || '-'}</td>
                </tr>
              ))}
              <tr className="shift-summary-print-total-row">
                <td colSpan={3} className="shift-summary-print-total-label">Tổng cộng</td>
                <td className="shift-summary-print-num">{printNumber(requiredQtyTotal, 2)}</td>
                <td className="shift-summary-print-num">{printNumber(requiredWeightTotal, 2)}</td>
                <td className="shift-summary-print-num">{printNumber(actualQtyTotal, 2)}</td>
                <td className="shift-summary-print-num">{printNumber(actualWeightTotal || inbound?.finishedGoodsInboundKg, 2)}</td>
                <td className="shift-summary-print-num">{printPercent(requiredQtyTotal > 0 ? (actualQtyTotal / requiredQtyTotal) * 100 : null)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </section>

        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">3. BÁO CÁO TIÊU HAO NGUYÊN VẬT LIỆU</h2>
          <table className="shift-summary-print-table shift-summary-print-table-wide bb-machine-report-print-material-table">
            <thead><tr>
              <th>Mã NVL</th>
              <th>Tên NVL</th>
              <th>ĐVT</th>
              <th>Tỉ lệ trộn<br />Định mức</th>
              <th>Tỉ lệ trộn<br />Thực tế</th>
              <th>Trọng lượng<br />tồn đầu ca</th>
              <th>Trọng lượng<br />vật tư xuất kho</th>
              <th>Trọng lượng<br />vật tư nhập<br />thành phẩm</th>
              <th>Trọng lượng<br />vật tư lỗi hỏng</th>
              <th>Trọng lượng<br />vật tư tồn<br />cuối ca</th>
              <th>Trọng lượng<br />Vật tư xuất<br />thực dùng</th>
              <th>Trọng lượng<br />thành phẩm +<br />Lỗi Hỏng<br />thực tế</th>
              <th>Chênh lệch<br />(Xuất − Nhập)<br />(Kg)</th>
            </tr></thead>
            <tbody>
              {materialRows.length === 0 ? (
                <tr><td colSpan={13} className="shift-summary-print-center">Không có dữ liệu NVL.</td></tr>
              ) : materialRows.map(row => {
                const norm = row.normPercents.length > 0
                  ? row.normPercents.reduce((sum, value) => sum + value, 0) / row.normPercents.length
                  : null;
                const actualUsedKg = computeMaterialUsageKg(row.exportKg, row.openingKg, row.closingKg);
                const finishedAndDamagedKg = row.finishedKg + row.damagedKg;
                const varianceKg = actualUsedKg - finishedAndDamagedKg;
                return <tr key={row.key}>
                  <td>{row.code || '-'}</td>
                  <td>{row.name || '-'}</td>
                  <td className="shift-summary-print-center">{row.unit || 'kg'}</td>
                  <td className="shift-summary-print-num">{printPercent(norm)}</td>
                  <td className="shift-summary-print-num">{printPercent(row.actualPercent)}</td>
                  <td className="shift-summary-print-num">{printNumber(row.openingKg, 2)}</td>
                  <td className="shift-summary-print-num">{printNumber(row.exportKg, 2)}</td>
                  <td className="shift-summary-print-num">{printNumber(row.finishedKg, 2)}</td>
                  <td className="shift-summary-print-num">{printNumber(row.damagedKg, 2)}</td>
                  <td className="shift-summary-print-num">{printNumber(row.closingKg, 2)}</td>
                  <td className="shift-summary-print-num">{printNumber(actualUsedKg, 2)}</td>
                  <td className="shift-summary-print-num">{printNumber(finishedAndDamagedKg, 2)}</td>
                  <td className="shift-summary-print-num">{printNumber(varianceKg, 2)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </section>

        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">4. ĐÁNH GIÁ HIỆU QUẢ CA SẢN XUẤT</h2>
          <table className="shift-summary-print-table bb-machine-report-print-evaluation-table">
            <thead><tr><th>STT</th><th>Giá trị phân tích</th><th>Tỉ lệ ĐM</th><th>Tỉ lệ TT</th><th>SL thực tế</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
            <tbody>
              <tr><td className="shift-summary-print-center">1</td><td>Tỉ lệ hàng lỗi / thành phẩm</td>
                <td className="shift-summary-print-num">{printPercent(evaluation?.tiLeLoiHongDinhMuc)}</td>
                <td className="shift-summary-print-num">{printPercent(evaluation?.tiLeLoiHong)}</td>
                <td className="shift-summary-print-num">{printNumber(damagedQuantity, 2)} kg</td>
                <td className="shift-summary-print-num">{printNumber(unitPrice(damagedMoney, damagedQuantity), 0)} đ/kg</td>
                <td className="shift-summary-print-num">{evaluation ? `${formatMoney(damagedMoney, 0)} đ` : '-'}</td></tr>
              <tr><td className="shift-summary-print-center">2</td><td>Hao hụt nhựa</td>
                <td className="shift-summary-print-num">100%</td>
                <td className="shift-summary-print-num">{printPercent(evaluation?.tiLeNhuaThucXuatVsDinhMuc)}</td>
                <td className="shift-summary-print-num">{printNumber(evaluation?.giaTriHaoHutNhuaKg, 2)} kg</td>
                <td className="shift-summary-print-num">{printNumber(unitPrice(evaluation?.giaTriHaoHutNhua, evaluation?.giaTriHaoHutNhuaKg), 0)} đ/kg</td>
                <td className="shift-summary-print-num">{evaluation ? `${formatMoney(evaluation.giaTriHaoHutNhua, 0)} đ` : '-'}</td></tr>
              <tr><td className="shift-summary-print-center">3</td><td>Hao hụt màng</td>
                <td className="shift-summary-print-num">100%</td>
                <td className="shift-summary-print-num">{printPercent(evaluation?.tiLeMangThucXuatVsDinhMuc)}</td>
                <td className="shift-summary-print-num">{printNumber(evaluation?.giaTriHaoHutMangKg, 2)} kg</td>
                <td className="shift-summary-print-num">{printNumber(unitPrice(evaluation?.giaTriHaoHutMang, evaluation?.giaTriHaoHutMangKg), 0)} đ/kg</td>
                <td className="shift-summary-print-num">{evaluation ? `${formatMoney(evaluation.giaTriHaoHutMang, 0)} đ` : '-'}</td></tr>
              <tr className="shift-summary-print-total-row"><td colSpan={6} className="shift-summary-print-total-label">Tổng giá trị hao hụt &amp; lỗi hỏng</td>
                <td className="shift-summary-print-num">{evaluation ? `${formatMoney(evaluation.tongGiaTriHaoHutLoiHong, 0)} đ` : '-'}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">5. GHI CHÚ</h2>
          <div className="bb-machine-report-print-note">
            {ghiChu || '—'}
          </div>
        </section>

        <div className="bb-machine-report-print-signatures">
          <div><p>Quản đốc sản xuất</p><span>(Ký và ghi rõ họ tên)</span></div>
          <div><p>Công nhân phụ máy</p><span>(Ký và ghi rõ họ tên)</span></div>
          <div><p>Công nhân chính máy</p><span>(Ký và ghi rõ họ tên)</span></div>
        </div>
      </div>
    </div>
  );
}

export default function ControlBoardBbMachineReportPrintBatch(props: PrintProps) {
  return (
    <div className="production-order-print-batch shift-summary-print-batch bb-machine-report-print-batch">
      {props.orderGroups.map(order => (
        <div key={order.groupKey} className="bb-machine-report-print-page">
          <BbMachineOrderPrintSheet order={order} props={props} />
        </div>
      ))}
    </div>
  );
}
