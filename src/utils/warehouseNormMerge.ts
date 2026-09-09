import type { MaterialOption } from '../features/san-pham/types.ts';
import {
  normalizeNhomVatTuPhuKey,
  resolveWorkshopType,
  isTapeOrStampMaterial,
  resolveAuxiliaryWeightPerUnit
} from './mixingNormAuxiliary.ts';

export type WarehouseMaterialClass = 'nvl_chinh' | 'nvl_phu' | 'chua_phan_loai';

export function normalizeWarehouseMaterialClass(value: unknown): WarehouseMaterialClass {
  const normalized = normalizeMaterialKey(value);
  if (normalized === 'nvl_phu' || normalized.includes('nguyen vat lieu phu') || normalized.includes('nvl phu')) {
    return 'nvl_phu';
  }
  if (normalized === 'nvl_chinh' || normalized.includes('nguyen vat lieu chinh') || normalized.includes('nvl chinh')) {
    return 'nvl_chinh';
  }
  return 'chua_phan_loai';
}

export type NormMaterialLine = {
  materialId: string;
  code: string;
  name: string;
  productionName: string;
  unit: string;
  documentQuantity: number;
  normWeightKg: number;
  normWeightPerUnitKg?: number;
  warehouseClass: WarehouseMaterialClass;
  machine: string;
  nhomVthh?: string;
  auxiliaryGroup?: string;
};

export type NormMaterialSource = {
  record: unknown;
  machine: string;
};

export function parseNormJson(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(item => item && typeof item === 'object') as Record<string, unknown>[];
  if (value && typeof value === 'object') return [value as Record<string, unknown>];
  if (typeof value === 'string') {
    try { return parseNormJson(JSON.parse(value)); } catch { return []; }
  }
  return [];
}

export function normalizeMaterialKey(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

export function normalizeWarehouseVthh(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const workshop = resolveWorkshopType(raw);
  if (workshop === 'rong') return 'TP; PX Rỗng';
  if (workshop === 'dac') return 'TP; PX Đặc';
  if (workshop === 'song') return 'TP; PX Sóng';
  return raw;
}

export function mergeNormMaterialLines(sources: NormMaterialSource[], materials: MaterialOption[]): NormMaterialLine[] {
  const byCode = new Map<string, MaterialOption>();
  const byName = new Map<string, MaterialOption>();
  const byId = new Map<string, MaterialOption>();
  materials.forEach(item => {
    if (item.id) byId.set(String(item.id).trim(), item);
    if (item.code) byCode.set(normalizeMaterialKey(item.code), item);
    if (item.name) byName.set(normalizeMaterialKey(item.name), item);
  });
  const merged = new Map<string, NormMaterialLine>();
  const add = (
    raw: Record<string, unknown>,
    machine: string,
    warehouseClass: WarehouseMaterialClass
  ) => {
    const rawMaterialId = String(
      raw.material_id ?? raw.materialId ?? raw.kho_nvl_id ?? raw.khoNvlId ?? ''
    ).trim();
    const code = String(raw.ma_nvl ?? raw.maNvl ?? '').trim();
    const name = String(raw.ten_nvl ?? raw.tenNvl ?? '').trim();
    const catalog =
      byId.get(rawMaterialId) ||
      byCode.get(normalizeMaterialKey(code)) ||
      byName.get(normalizeMaterialKey(name));
    const materialId = rawMaterialId || String(catalog?.id ?? '').trim();
    const effectiveCode = (code || catalog?.code || '').trim();
    const effectiveName = (name || catalog?.name || '').trim();
    const productionName = String(
      raw.ten_nvl_san_xuat ?? raw.ten_nvl_sx ?? raw.tenNvlSanXuat ?? raw.productionName ?? ''
    ).trim() || catalog?.productionName || '';
    const rawVthh = String(raw.nhom_vthh ?? raw.nhomVthh ?? '').trim();
    const normWeightKg = Number(raw.tong_khoi_luong ?? raw.tongKhoiLuong ?? raw.khoi_luong ?? raw.khoiLuong ?? 0);
    const sourceQuantity = warehouseClass === 'nvl_phu'
      ? Number(raw.gia_tri ?? raw.giaTri ?? normWeightKg)
      : normWeightKg;
    if (
      (!effectiveCode && !effectiveName) ||
      !Number.isFinite(sourceQuantity) ||
      sourceQuantity <= 0
    ) return;

    const safeNormWeightKg = Number.isFinite(normWeightKg) && normWeightKg > 0 ? normWeightKg : 0;
    const normalizedMachine = String(machine || '').trim();

    // Nhận diện nhóm NVL phụ (Băng Dính, Tem, Màng, Bạt Bọc...)
    const groupKey = normalizeNhomVatTuPhuKey(
      catalog?.nhomVatTuPhu || productionName || effectiveName || effectiveCode
    );
    const isTapeOrStamp = warehouseClass === 'nvl_phu' && isTapeOrStampMaterial(groupKey);

    // Chuẩn hóa nhóm VTHH cho Băng Dính / Tem
    const canonicalVthh = normalizeWarehouseVthh(rawVthh);

    // ĐỐI VỚI BĂNG DÍNH VÀ TEM: nếu giống về VTHH thì mới gộp (phân tách theo canonicalVthh)
    // ĐỐI VỚI NVL KHÁC (NVL chính hoặc NVL phụ thông thường): gộp chung theo vật tư, không phân biệt VTHH
    const vthhKey = isTapeOrStamp ? (normalizeMaterialKey(canonicalVthh) || '__chua_chon_vthh__') : '';
    const materialKey = materialId
      ? `id:${materialId}`
      : `legacy:${normalizeMaterialKey(effectiveCode || effectiveName)}`;
    const key = `${normalizeMaterialKey(normalizedMachine) || 'chua-xac-dinh'}::${warehouseClass}::${materialKey}::${vthhKey}`;

    const current = merged.get(key);
    merged.set(key, {
      materialId,
      code: effectiveCode,
      name: effectiveName,
      productionName: current?.productionName || productionName,
      unit: catalog?.unit || String(raw.don_vi ?? raw.donVi ?? '').trim() || 'kg',
      // NVL phụ: gia_tri là SL theo ĐVT gốc; tong_khoi_luong là kg đã quy đổi.
      documentQuantity: (current?.documentQuantity || 0) + sourceQuantity,
      normWeightKg: (current?.normWeightKg || 0) + safeNormWeightKg,
      warehouseClass,
      machine: normalizedMachine,
      nhomVthh: isTapeOrStamp ? (canonicalVthh || current?.nhomVthh || '') : '',
      auxiliaryGroup: groupKey
    });
  };
  sources.forEach(source => {
    parseNormJson(source.record).forEach(product => {
      // API trả về record.chi_tiet[].nvl[], còn một số phiên bản cũ trả
      // trực tiếp product.nvl[]. Chuẩn hoá cả hai dạng trước khi cộng dồn.
      const details = parseNormJson(product.chi_tiet);
      const products = details.length > 0 ? details : [product];
      products.forEach(detail => {
        const directLines = parseNormJson(detail.nvl);
        const secondaryLines = parseNormJson(detail.nvl_phu ?? detail.nvlPhu);
        const declaredClass = normalizeWarehouseMaterialClass(
          detail.loai ?? detail.phan_loai_nvl ?? detail.materialClass
        );
        const directClass: WarehouseMaterialClass =
          declaredClass === 'nvl_phu' ? 'nvl_phu' : 'nvl_chinh';
        if (directLines.length > 0) {
          // Phiếu cũ có thể lưu block `loai: nvl_phu` trong mảng `nvl` thay vì `nvl_phu`.
          directLines.forEach(line => add(line, source.machine, directClass));
          secondaryLines.forEach(line => add(line, source.machine, 'nvl_phu'));
          return;
        }
        secondaryLines.forEach(line => add(line, source.machine, 'nvl_phu'));
        parseNormJson(detail.lan_tron).forEach(round =>
          parseNormJson(round.nvl).forEach(line => add(line, source.machine, 'nvl_chinh'))
        );
      });
    });
  });
  return [...merged.values()].map(line => {
    let normWeightPerUnitKg: number | undefined;
    if (line.warehouseClass === 'nvl_phu') {
      const catalog = byCode.get(normalizeMaterialKey(line.code)) || byName.get(normalizeMaterialKey(line.name));
      const groupKey = normalizeNhomVatTuPhuKey(
        catalog?.nhomVatTuPhu || line.productionName || line.name || line.code
      );
      const isTapeOrStamp = isTapeOrStampMaterial(groupKey);
      const unit = (catalog?.unit || line.unit || '').trim().toLowerCase();
      if (unit === 'kg') {
        normWeightPerUnitKg = 1.0;
      } else if (isTapeOrStamp && line.nhomVthh) {
        const vthhWorkshop = resolveWorkshopType(line.nhomVthh);
        if (vthhWorkshop === 'rong') {
          if (groupKey === 'Băng Dính') normWeightPerUnitKg = 0.5;
          else if (groupKey === 'Tem') normWeightPerUnitKg = 0.0023;
        } else if (vthhWorkshop === 'dac' || vthhWorkshop === 'song') {
          if (groupKey === 'Băng Dính') normWeightPerUnitKg = 0.4;
          else if (groupKey === 'Tem') normWeightPerUnitKg = 0.0013;
        }
      }
      if (normWeightPerUnitKg === undefined && line.documentQuantity > 0 && line.normWeightKg > 0) {
        normWeightPerUnitKg = line.normWeightKg / line.documentQuantity;
      }
    }
    return {
      ...line,
      normWeightPerUnitKg
    };
  }).sort((a, b) => {
    const rank = (value: WarehouseMaterialClass) => value === 'nvl_chinh' ? 0 : value === 'nvl_phu' ? 1 : 2;
    return (
      rank(a.warehouseClass) - rank(b.warehouseClass) ||
      (a.machine || '~~~').localeCompare(b.machine || '~~~', 'vi', { numeric: true }) ||
      a.code.localeCompare(b.code, 'vi', { numeric: true }) ||
      (a.nhomVthh || '').localeCompare(b.nhomVthh || '', 'vi')
    );
  });
}

export type AuxiliaryWarehouseLine = {
  materialId?: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  documentQuantity?: number | null;
  quotaQuantity?: number | null;
  suggestedQuantity?: number | null;
  unitPrice: number;
  lineAmount?: number;
  materialClass?: WarehouseMaterialClass;
  machine?: string;
  weightKg?: number | null;
  nhomVthh?: string;
  auxiliaryGroup?: string;
  lineNote?: string;
};

function sumOptionalWarehouseNumber(left: unknown, right: unknown): number | undefined {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const hasLeft = Number.isFinite(leftNumber);
  const hasRight = Number.isFinite(rightNumber);
  if (!hasLeft && !hasRight) return undefined;
  return Math.round(((hasLeft ? leftNumber : 0) + (hasRight ? rightNumber : 0)) * 1_000_000) / 1_000_000;
}

/**
 * Gộp NVL phụ theo ID trong cùng máy. Riêng Băng dính/Tem chỉ gộp khi Nhóm VTHH cũng giống nhau.
 * Nếu các NVL thêm mới không thuộc máy, lệnh nào (machine rỗng) thì giữ in riêng KHÔNG GỘP.
 */
export function mergeAuxiliaryWarehouseLines<T extends AuxiliaryWarehouseLine>(lines: T[]): T[] {
  const result: T[] = [];
  const indexByKey = new Map<string, number>();

  for (const source of lines) {
    if (normalizeWarehouseMaterialClass(source.materialClass) !== 'nvl_phu') {
      result.push(source);
      continue;
    }

    const machineName = String(source.machine || '').trim();
    // Nếu dòng không thuộc máy nào (thêm mới ngoài định mức): KHÔNG GỘP
    if (!machineName) {
      const groupKey = normalizeNhomVatTuPhuKey(source.auxiliaryGroup || source.name || source.code);
      const tapeOrStamp = isTapeOrStampMaterial(groupKey);
      const vthh = tapeOrStamp ? normalizeWarehouseVthh(source.nhomVthh) : '';
      const perUnit = resolveAuxiliaryWeightPerUnit(groupKey, vthh, source.unit);
      let weightKg = Number.isFinite(Number(source.weightKg)) && Number(source.weightKg) > 0
        ? Number(source.weightKg)
        : undefined;
      if (weightKg === undefined && perUnit !== undefined && Number(source.quantity) > 0) {
        weightKg = Math.round(Number(source.quantity) * perUnit * 1000) / 1000;
      }
      result.push({
        ...source,
        weightKg: weightKg ?? source.weightKg,
        nhomVthh: tapeOrStamp ? vthh : undefined,
        auxiliaryGroup: groupKey
      });
      continue;
    }

    const materialIdentity = String(source.materialId || '').trim() || normalizeMaterialKey(source.code || source.name);
    const groupKey = normalizeNhomVatTuPhuKey(
      source.auxiliaryGroup || source.name || source.code
    );
    const tapeOrStamp = isTapeOrStampMaterial(groupKey);
    const vthh = tapeOrStamp ? normalizeWarehouseVthh(source.nhomVthh) : '';
    const key = [
      normalizeMaterialKey(machineName),
      materialIdentity,
      tapeOrStamp ? normalizeMaterialKey(vthh) || '__chua_vthh__' : ''
    ].join('::');
    const existingIndex = indexByKey.get(key);

    const perUnit = resolveAuxiliaryWeightPerUnit(groupKey, vthh, source.unit);
    let lineWeightKg = Number.isFinite(Number(source.weightKg)) && Number(source.weightKg) > 0
      ? Number(source.weightKg)
      : undefined;
    if (lineWeightKg === undefined && perUnit !== undefined && Number(source.quantity) > 0) {
      lineWeightKg = Math.round(Number(source.quantity) * perUnit * 1000) / 1000;
    }

    if (existingIndex === undefined) {
      indexByKey.set(key, result.length);
      result.push({
        ...source,
        weightKg: lineWeightKg ?? source.weightKg,
        nhomVthh: tapeOrStamp ? vthh : undefined,
        auxiliaryGroup: groupKey
      });
      continue;
    }

    const current = result[existingIndex];
    const quantity = sumOptionalWarehouseNumber(current.quantity, source.quantity) ?? 0;
    const currentAmount = Number.isFinite(Number(current.lineAmount))
      ? Number(current.lineAmount)
      : Number(current.quantity) * Number(current.unitPrice);
    const sourceAmount = Number.isFinite(Number(source.lineAmount))
      ? Number(source.lineAmount)
      : Number(source.quantity) * Number(source.unitPrice);
    const lineAmount = sumOptionalWarehouseNumber(currentAmount, sourceAmount) ?? 0;
    const notes = [...new Set([current.lineNote, source.lineNote].map(value => String(value || '').trim()).filter(Boolean))];

    let combinedWeight = sumOptionalWarehouseNumber(current.weightKg, lineWeightKg);
    if (combinedWeight === undefined && perUnit !== undefined && quantity > 0) {
      combinedWeight = Math.round(quantity * perUnit * 1000) / 1000;
    }

    result[existingIndex] = {
      ...current,
      quantity,
      documentQuantity: sumOptionalWarehouseNumber(current.documentQuantity, source.documentQuantity),
      quotaQuantity: sumOptionalWarehouseNumber(current.quotaQuantity, source.quotaQuantity),
      suggestedQuantity: sumOptionalWarehouseNumber(current.suggestedQuantity, source.suggestedQuantity),
      weightKg: combinedWeight ?? current.weightKg,
      lineAmount,
      unitPrice: quantity > 0 ? lineAmount / quantity : current.unitPrice,
      lineNote: notes.join('; '),
      nhomVthh: tapeOrStamp ? vthh : undefined,
      auxiliaryGroup: groupKey
    } as T;
  }

  return result;
}

/**
 * Gộp các dòng NVL phụ trên bảng chỉnh sửa phiếu xuất kho:
 * - Cùng ID (hoặc cùng mã vật tư) và cùng máy.
 * - Riêng Băng Dính hoặc Tem: chỉ gộp khi có Nhóm VTHH giống nhau.
 * - Tính tổng SL CT (documentQuantity), SL Thực (quantity) và tính lại normWeightPerUnitKg.
 */
export function consolidateWarehouseLines<T extends {
  key?: string;
  materialId?: string;
  code: string;
  name: string;
  productionName?: string;
  unit: string;
  quantity: string | number;
  documentQuantity?: string | number | null;
  unitPrice?: string | number;
  warehouseClass?: WarehouseMaterialClass | string;
  machine?: string;
  normWeightPerUnitKg?: number;
  nhomVthh?: string;
  auxiliaryGroup?: string;
  lineNote?: string;
  weightKg?: number | null;
}>(lines: T[], catalog?: MaterialOption[]): T[] {
  const result: T[] = [];
  const indexByKey = new Map<string, number>();

  for (const line of lines) {
    const materialClass = normalizeWarehouseMaterialClass(line.warehouseClass);
    if (materialClass !== 'nvl_phu') {
      result.push(line);
      continue;
    }

    const effectiveCode = (line.code || '').trim();
    const effectiveName = (line.name || '').trim();
    if (!effectiveCode && !effectiveName) {
      result.push(line);
      continue;
    }

    const catalogItem = catalog?.find(c =>
      (line.materialId && c.id === line.materialId) ||
      (effectiveCode && normalizeMaterialKey(c.code) === normalizeMaterialKey(effectiveCode)) ||
      (effectiveName && normalizeMaterialKey(c.name) === normalizeMaterialKey(effectiveName))
    );
    const materialIdentity = line.materialId || catalogItem?.id || normalizeMaterialKey(effectiveCode || effectiveName);
    const groupKey = normalizeNhomVatTuPhuKey(
      line.auxiliaryGroup || catalogItem?.nhomVatTuPhu || line.productionName || effectiveName || effectiveCode
    );
    const tapeOrStamp = isTapeOrStampMaterial(groupKey);
    const vthh = tapeOrStamp ? normalizeWarehouseVthh(line.nhomVthh) : '';
    const machineKey = normalizeMaterialKey(line.machine) || '__no_machine__';
    const key = [
      machineKey,
      materialIdentity,
      tapeOrStamp ? normalizeMaterialKey(vthh) || '__chua_vthh__' : ''
    ].join('::');

    const perUnit = resolveAuxiliaryWeightPerUnit(groupKey, vthh, line.unit);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, result.length);
      result.push({
        ...line,
        nhomVthh: tapeOrStamp ? vthh : undefined,
        auxiliaryGroup: groupKey,
        normWeightPerUnitKg: perUnit ?? line.normWeightPerUnitKg
      });
      continue;
    }

    const current = result[existingIndex];
    const currentQty = Number(String(current.quantity || '').replace(',', '.'));
    const lineQty = Number(String(line.quantity || '').replace(',', '.'));
    const totalQty = (Number.isFinite(currentQty) ? currentQty : 0) + (Number.isFinite(lineQty) ? lineQty : 0);

    const currentDocQty = Number(String(current.documentQuantity || '').replace(',', '.'));
    const lineDocQty = Number(String(line.documentQuantity || '').replace(',', '.'));
    const totalDocQty = (Number.isFinite(currentDocQty) ? currentDocQty : 0) + (Number.isFinite(lineDocQty) ? lineDocQty : 0);

    const notes = [...new Set([current.lineNote, line.lineNote].map(v => String(v || '').trim()).filter(Boolean))];

    result[existingIndex] = {
      ...current,
      quantity: totalQty > 0 ? (Number.isInteger(totalQty) ? String(totalQty) : String(Math.round(totalQty * 100) / 100)) : (current.quantity || line.quantity || ''),
      documentQuantity: totalDocQty > 0 ? (Number.isInteger(totalDocQty) ? String(totalDocQty) : String(Math.round(totalDocQty * 100) / 100)) : (current.documentQuantity || line.documentQuantity || ''),
      unitPrice: current.unitPrice || line.unitPrice || '',
      lineNote: notes.join('; ') || undefined,
      normWeightPerUnitKg: perUnit ?? current.normWeightPerUnitKg,
      nhomVthh: tapeOrStamp ? vthh : undefined,
      auxiliaryGroup: groupKey
    };
  }

  return result;
}

