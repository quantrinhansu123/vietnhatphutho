import type { OrderProductLine } from '../features/_shared/productionProductHelpers';
import { seedProductionSpecs } from '../utils/productProductionName';

function displayCell(value: string | null | undefined) {
  const trimmed = String(value || '').trim();
  return trimmed && trimmed !== '-' ? trimmed : '';
}

function meterNumber(value: string | number | null | undefined): number | null {
  const raw = String(value ?? '').trim().replace(/m\s*$/iu, '').replace(',', '.');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null;
}

function formatMeter(value: string | number | null | undefined): string {
  const n = meterNumber(value);
  return n === null ? '' : String(n);
}

function sameMeter(a: string | number | null | undefined, b: string | number | null | undefined) {
  const left = meterNumber(a);
  const right = meterNumber(b);
  if (left === null || right === null) return false;
  return Math.abs(left - right) < 1e-9;
}

/**
 * Khổ / Dài in trên đơn cắt lẻ.
 * Khổ: ô Khổ rộng / Hạ khổ rộng khi có; không nhập thì lấy từ tên sản xuất gốc.
 * Dài (m): ô form khác mét dài danh mục thì in số mới, không đổi thì giữ số gốc.
 */
export function cutOrderPrintSize(line: Pick<OrderProductLine, 'productionName' | 'productCode' | 'maAmisCu' | 'daiM' | 'quyCachMDai' | 'kho'>) {
  const specs = seedProductionSpecs({
    tenSanXuat: line.productionName || '',
    maAmis: line.maAmisCu || line.productCode || '',
    nhomVthh: ''
  });
  const catalogDai = formatMeter(specs.doDaiM);
  const enteredDai = formatMeter(line.daiM || line.quyCachMDai || '');
  const dai = enteredDai && !sameMeter(enteredDai, catalogDai) ? enteredDai : catalogDai || enteredDai;
  return {
    kho: formatMeter(line.kho) || formatMeter(specs.doDayM),
    dai
  };
}

/** Tên hàng trên phiếu cắt lẻ = mã AMIS mới; chưa sinh biến thể thì giữ mã gốc. */
export function cutOrderPrintTenHang(line: Pick<OrderProductLine, 'maAmis' | 'productCode'>) {
  return displayCell(line.maAmis) || displayCell(line.productCode);
}

export function formatPhuThoDate(value: string) {
  const trimmed = String(value || '').trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `Phú Thọ, Ngày ${Number(iso[3])} tháng ${Number(iso[2])} năm ${iso[1]}`;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return 'Phú Thọ';
  return `Phú Thọ, Ngày ${parsed.getDate()} tháng ${parsed.getMonth() + 1} năm ${parsed.getFullYear()}`;
}
