/**
 * Logic thuần phiếu nhập / xuất NVL (không phụ thuộc React).
 * Quy ước:
 *  1) SL thực nhập tay; Tồn cuối = Tồn đầu + Nhập − SL thực.
 *  2) ten_nvl_sx snapshot vào phiếu (hiển thị cột Tên sản xuất).
 *  3) Phiếu nhập KHÔNG cần Máy (chỉ gợi ý khi Nhập lại VTSX / Tạo hạt).
 *  4) Phiếu xuất: 1 ngày + N ca, chỉ các ca cùng loai_ca (/cai-dat).
 *  5) Báo cáo Kho NVL: Tồn đầu hard 0, Tồn cuối = Nhập − Xuất.
 */
import { parsePercentInput } from '../../utils';
import { normalizeWarehouseMaterialClass } from '../../utils/warehouseNormMerge';
import {
  resolveLogicalPreviousShiftSlot,
  type ShiftOption,
  type ShiftSetting
} from '../../utils/shiftSettings';
import type { MaterialOption } from '../san-pham/types';

/** Loai nhap kho NVL — goi y 4 gia tri + cho nhap tu do (khong CHECK o DB). */
export const LOAI_NHAP_KHO_OPTIONS = [
  'NVL mua ngoài',
  'Phế mua ngoài',
  'Nhập kho tạo hạt',
  'Nhập lại vật tư sản xuất'
] as const;

/** Phieu nhap co goi y chon May (optional) — cac loai con lai an o May. */
export function isMachineSuggestedInboundKind(value?: string | null): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return (
    normalized === 'nhập kho tạo hạt'.toLowerCase() ||
    normalized === 'nhập lại vật tư sản xuất'.toLowerCase()
  );
}

export type WarehouseLineTonCuoiInput = {
  tonDauCaMay?: string;
  documentQuantity?: string;
  quantity: string;
};

/**
 * Ton cuoi = Ton dau + Nhap − SL thuc.
 * - Ton dau: tonDauCaMay (tu so tron ca truoc, sua tay duoc).
 * - Nhap: SL CT (documentQuantity) lam moc tham chieu; trong thi coi nhu 0.
 * - SL thuc (quantity): o nhap tay. Chua nhap SL thuc → tra null (khong hien).
 */
export function computeWarehouseLineTonCuoi(line: WarehouseLineTonCuoiInput): number | null {
  const slThuc = parsePercentInput(line.quantity);
  if (!Number.isFinite(slThuc) || slThuc <= 0) return null;
  const tonDauRaw = parsePercentInput(line.tonDauCaMay ?? '');
  const nhapRaw = parsePercentInput(line.documentQuantity ?? '');
  const tonDau = Number.isFinite(tonDauRaw) && tonDauRaw >= 0 ? tonDauRaw : 0;
  const nhap = Number.isFinite(nhapRaw) && nhapRaw > 0 ? nhapRaw : 0;
  return Math.round((tonDau + nhap - slThuc) * 1000) / 1000;
}

/** Tra loai_ca (/cai-dat) cua 1 ca theo ten hoac ma. */
export function resolveShiftLoaiCa(
  shiftValue: string,
  shiftSettings: Pick<ShiftSetting, 'code' | 'name' | 'loaiCa'>[]
): string {
  const target = String(shiftValue || '').trim().toLowerCase();
  if (!target) return '';
  const setting = shiftSettings.find(
    item =>
      String(item.name || '').trim().toLowerCase() === target ||
      String(item.code || '').trim().toLowerCase() === target
  );
  return String(setting?.loaiCa || '').trim();
}

/**
 * Validate multi-ca phieu xuat: chi cac ca cung loai_ca.
 * - 0/1 ca → hop le ('').
 * - Ca chua xep loai (loai_ca trong) → bo qua khi so sanh, khong chan.
 * - 2+ loai_ca khac nhau → tra thong bao loi.
 */
export function validateWarehouseShiftsSameLoaiCa(
  shifts: string[],
  shiftSettings: Pick<ShiftSetting, 'code' | 'name' | 'loaiCa'>[]
): string {
  const cleaned = shifts.map(item => String(item || '').trim()).filter(Boolean);
  if (cleaned.length <= 1) return '';
  const loaiSet = new Set<string>();
  for (const shift of cleaned) {
    const loaiCa = resolveShiftLoaiCa(shift, shiftSettings);
    if (loaiCa) loaiSet.add(loaiCa);
  }
  if (loaiSet.size > 1) {
    return `Chỉ được chọn các ca cùng Loại ca (/cai-dat). Đã chọn: ${cleaned.join(', ')} (thuộc ${[...loaiSet].join(' + ')}).`;
  }
  return '';
}

/** Ton cuoi ky bao cao Kho NVL: Ton dau hard 0 → Ton cuoi = Nhap − Xuat. */
export function computeNvlClosingStock(inbound: number, outbound: number): number {
  const nhap = Number.isFinite(inbound) && inbound > 0 ? inbound : 0;
  const xuat = Number.isFinite(outbound) && outbound > 0 ? outbound : 0;
  return Math.round((nhap - xuat) * 100) / 100;
}

export type WarehouseLineClassInput = {
  warehouseClass?: string;
};

/** Thu tu hien thi: NVL chinh (0) → NVL phu (1) → chua phan loai (2). */
export function warehouseLineClassRank(value: unknown): number {
  const materialClass = normalizeWarehouseMaterialClass(value);
  if (materialClass === 'nvl_chinh') return 0;
  if (materialClass === 'nvl_phu') return 1;
  return 2;
}

/**
 * Chen dong moi dung thu tu: NVL chinh o tren, NVL phu o duoi.
 * - Dong chinh: chen ngay sau dong chinh cuoi (chua co thi chen dau).
 * - Dong phu / chua phan loai: them cuoi.
 */
export function insertWarehouseLineByClass<T extends WarehouseLineClassInput>(
  current: T[],
  draft: T
): T[] {
  if (warehouseLineClassRank(draft.warehouseClass) !== 0) return [...current, draft];
  let insertAt = 0;
  current.forEach((line, index) => {
    if (warehouseLineClassRank(line.warehouseClass) === 0) insertAt = index + 1;
  });
  return [...current.slice(0, insertAt), draft, ...current.slice(insertAt)];
}

export type WarehouseLineProductionNameInput = {
  code?: string;
  productionName?: string;
};

/**
 * Ten san xuat NVL hien thi (read-only) tren dong phieu:
 * uu tien snapshot/productionName cua dong, fallback ten_nvl_sx trong kho_nvl theo ma.
 */
export function resolveWarehouseLineProductionName(
  line: WarehouseLineProductionNameInput,
  options: Pick<MaterialOption, 'code' | 'productionName'>[]
): string {
  const direct = String(line.productionName || '').trim();
  if (direct) return direct;
  const code = String(line.code || '').trim().toLowerCase();
  if (!code) return '';
  const option = options.find(opt => String(opt.code || '').trim().toLowerCase() === code);
  return String(option?.productionName || '').trim();
}

/**
 * Mac dinh cho o "Ngay" + "Ca truoc" cua Ton dau ca (phieu xuat NVL):
 * o ca truoc logic cua ca dang chon tren form theo vong loai_ca (/cai-dat).
 * Ca dau chuoi → ngay lui 1 ngay (ca dem tinh theo NGAY BAT DAU).
 */
export function resolveDefaultTonDauRef(
  ngayPhieu: string,
  formShift: string,
  shiftOptions: ShiftOption[],
  shiftSettings: ShiftSetting[]
): { ngay: string; ca: string } {
  const ngay = String(ngayPhieu || '').trim();
  const ca = String(formShift || '').trim();
  const slot = ngay && ca ? resolveLogicalPreviousShiftSlot(ngay, ca, shiftOptions, shiftSettings) : null;
  if (slot) return { ngay: slot.ngay, ca: slot.shift };
  return { ngay, ca: '' };
}
