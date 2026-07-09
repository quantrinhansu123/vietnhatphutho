import { formatNumber } from '../utils';

export type WarehouseWeightKind = 'nvl' | 'san_pham';

export type WarehouseWeightCatalogItem = {
  code: string;
  name?: string;
  unit?: string;
  totalWeight?: string;
  coreWeight?: string;
  bagWeight?: string;
  plasticWeight?: string;
};

function normalizeWarehouseText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeWarehouseUnit(unit: string) {
  return normalizeWarehouseText(unit);
}

export function isWarehouseKgUnit(unit: string) {
  const normalized = normalizeWarehouseUnit(unit);
  return (
    normalized === 'kg' ||
    normalized === 'kgs' ||
    normalized === 'kilogram' ||
    normalized === 'kilograms' ||
    normalized === 'kilogam' ||
    normalized === 'kilogramo'
  );
}

function parseWeightNumber(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '-') return null;

  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed.replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/** Suy luận kg/đơn vị từ tên hoặc mã NVL (vd. "1kg = 7.5 cái", "Lõi 1.5m - 1kg"). */
export function inferWarehouseWeightPerUnitFromLabel(name: string, code = ''): number | null {
  const hay = normalizeWarehouseText(`${name} ${code}`);

  const kgPerCount = hay.match(/(\d+(?:[.,]\d+)?)\s*kg\s*=\s*(\d+(?:[.,]\d+)?)\s*cai/);
  if (kgPerCount) {
    const kg = parseWeightNumber(kgPerCount[1]);
    const count = parseWeightNumber(kgPerCount[2]);
    if (kg !== null && count !== null) return kg / count;
  }

  const countPerKg = hay.match(/(\d+(?:[.,]\d+)?)\s*cai\s*=\s*(\d+(?:[.,]\d+)?)\s*kg/);
  if (countPerKg) {
    const count = parseWeightNumber(countPerKg[1]);
    const kg = parseWeightNumber(countPerKg[2]);
    if (kg !== null && count !== null) return kg / count;
  }

  const codeKg = hay.match(/-(\d+(?:[.,]\d+)?)kg\b/);
  if (codeKg) {
    const fromCode = parseWeightNumber(codeKg[1]);
    if (fromCode !== null) return fromCode;
  }

  const loiKg = hay.match(/\bloi\b[^0-9]{0,24}(\d+(?:[.,]\d+)?)\s*kg\b/);
  if (loiKg) {
    const fromLoi = parseWeightNumber(loiKg[1]);
    if (fromLoi !== null) return fromLoi;
  }

  const trailingKg = hay.match(/\b(\d+(?:[.,]\d+)?)\s*kg\s*$/);
  if (trailingKg) {
    const fromTrailing = parseWeightNumber(trailingKg[1]);
    if (fromTrailing !== null) return fromTrailing;
  }

  return null;
}

function resolveCatalogWeightPerUnit(item: WarehouseWeightCatalogItem | null | undefined): number | null {
  if (!item) return null;

  const fromTotal = parseWeightNumber(item.totalWeight);
  if (fromTotal !== null) return fromTotal;

  const hay = normalizeWarehouseText(`${item.name ?? ''} ${item.code ?? ''}`);

  if (hay.includes('loi')) {
    const fromCore = parseWeightNumber(item.coreWeight);
    if (fromCore !== null) return fromCore;
  }

  if (hay.includes('tui') || hay.includes('tai nilon') || hay.includes('bao bi')) {
    const fromBag = parseWeightNumber(item.bagWeight);
    if (fromBag !== null) return fromBag;
  }

  const fromCore = parseWeightNumber(item.coreWeight);
  if (fromCore !== null) return fromCore;

  const fromBag = parseWeightNumber(item.bagWeight);
  if (fromBag !== null) return fromBag;

  const fromPlastic = parseWeightNumber(item.plasticWeight);
  if (fromPlastic !== null) return fromPlastic;

  return inferWarehouseWeightPerUnitFromLabel(item.name ?? '', item.code ?? '');
}

function findCatalogItem(
  itemCode: string,
  materials: WarehouseWeightCatalogItem[],
  products: WarehouseWeightCatalogItem[]
) {
  const codeKey = itemCode.trim().toLowerCase();
  if (!codeKey) return null;

  return (
    materials.find(item => item.code.trim().toLowerCase() === codeKey) ??
    products.find(item => item.code.trim().toLowerCase() === codeKey) ??
    null
  );
}

function findCatalogWeightPerUnit(
  itemCode: string,
  warehouseKind: WarehouseWeightKind | undefined,
  materials: WarehouseWeightCatalogItem[],
  products: WarehouseWeightCatalogItem[]
): number | null {
  const codeKey = itemCode.trim().toLowerCase();
  if (!codeKey) return null;

  if (warehouseKind === 'san_pham') {
    const product = products.find(item => item.code.trim().toLowerCase() === codeKey);
    const fromProduct = resolveCatalogWeightPerUnit(product);
    if (fromProduct !== null) return fromProduct;
  } else if (warehouseKind === 'nvl') {
    const material = materials.find(item => item.code.trim().toLowerCase() === codeKey);
    const fromMaterial = resolveCatalogWeightPerUnit(material);
    if (fromMaterial !== null) return fromMaterial;
  }

  return resolveCatalogWeightPerUnit(findCatalogItem(itemCode, materials, products));
}

/** Quy đổi SL + ĐVT về kg: kg giữ nguyên; tấn/g; đơn vị khác = SL × Tổng kg (danh mục NVL/SP). */
export function convertWarehouseQuantityToKg(input: {
  quantity: number;
  unit: string;
  itemCode?: string;
  warehouseKind?: WarehouseWeightKind;
  materials?: WarehouseWeightCatalogItem[];
  products?: WarehouseWeightCatalogItem[];
}): number | null {
  const quantity = input.quantity;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const unit = normalizeWarehouseUnit(input.unit);
  if (!unit || unit === '-') return null;

  if (isWarehouseKgUnit(input.unit)) return quantity;

  if (unit === 't' || unit === 'tan' || unit === 'ton' || unit === 'tonne' || unit === 'mt') {
    return quantity * 1000;
  }

  if (unit === 'g' || unit === 'gr' || unit === 'gram' || unit === 'gam') {
    return quantity / 1000;
  }

  const perUnit = findCatalogWeightPerUnit(
    input.itemCode ?? '',
    input.warehouseKind,
    input.materials ?? [],
    input.products ?? []
  );
  if (perUnit === null) return null;

  return quantity * perUnit;
}

export function formatWarehouseWeightKg(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${formatNumber(value, 3)} kg`;
}

export function mapMaterialToWeightCatalogItem(material: {
  code: string;
  name?: string;
  unit?: string;
  totalWeight?: string;
  coreWeight?: string;
  bagWeight?: string;
  plasticWeight?: string;
}): WarehouseWeightCatalogItem {
  return {
    code: material.code,
    name: material.name,
    unit: material.unit,
    totalWeight: material.totalWeight,
    coreWeight: material.coreWeight,
    bagWeight: material.bagWeight,
    plasticWeight: material.plasticWeight
  };
}

export function mapProductToWeightCatalogItem(product: {
  code: string;
  name?: string;
  unit?: string;
  totalWeight?: string;
  coreWeight?: string;
  bagWeight?: string;
  plasticWeight?: string;
}): WarehouseWeightCatalogItem {
  return mapMaterialToWeightCatalogItem(product);
}
