import {
  mergeSoTronProductsByMaTen,
  recalcThanhPhamLineMetrics,
  type ProductConversionHint,
  type SoTronProductLineInput
} from './thanhPham';

export type SoTronOptionForTp = {
  id: string;
  label: string;
  ngay: string;
  ca: string;
  ma_may: string;
  ten_may: string;
  bang_san_pham: SoTronProductLineInput[];
};

export function formatSoTronOptionLabel(row: {
  id?: string;
  ngay?: string;
  ca?: string;
  ma_may?: string;
  ten_may?: string;
}): string {
  const ngay = String(row.ngay || '').slice(0, 10);
  const [y, m, d] = ngay.split('-');
  const ngayVn = y && m && d ? `${d}/${m}/${y}` : ngay;
  const may = String(row.ten_may || row.ma_may || '').trim() || '—';
  const ca = String(row.ca || '').trim() || '—';
  return `${ngayVn} · ${may} · ${ca}`;
}

export function mapSoTronApiRecords(records: unknown[]): SoTronOptionForTp[] {
  return (Array.isArray(records) ? records : [])
    .map((raw): SoTronOptionForTp | null => {
      if (!raw || typeof raw !== 'object') return null;
      const row = raw as Record<string, unknown>;
      const id = String(row.id ?? '').trim();
      if (!id) return null;
      const bang = Array.isArray(row.bang_san_pham) ? row.bang_san_pham : [];
      const products: SoTronProductLineInput[] = bang.map(item => {
        const line = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return {
          soTronId: id,
          ma_sp: String(line.ma_sp ?? '').trim(),
          ten_sp: String(line.ten_sp ?? '').trim(),
          so_luong: line.so_luong as string | number | null,
          trong_luong: line.trong_luong as string | number | null,
          tong_m2: (line.tong_m2 ?? line.so_m2) as string | number | null,
          tong_m_dai: (line.tong_m_dai ?? line.so_m_dai) as string | number | null,
          trong_luong_kg_tam: line.trong_luong_kg_tam as string | number | null,
          trong_luong_kg_cuon: line.trong_luong_kg_cuon as string | number | null,
          dvt: String(line.dvt ?? line.don_vi ?? '').trim(),
          nhom_vthh: String(line.nhom_vthh ?? '').trim()
        };
      });
      return {
        id,
        label: formatSoTronOptionLabel(row),
        ngay: String(row.ngay ?? '').slice(0, 10),
        ca: String(row.ca ?? '').trim(),
        ma_may: String(row.ma_may ?? '').trim(),
        ten_may: String(row.ten_may ?? '').trim(),
        bang_san_pham: products
      };
    })
    .filter((row): row is SoTronOptionForTp => Boolean(row));
}

export function filterSoTronByShifts(
  options: SoTronOptionForTp[],
  ngay: string,
  shifts: string[]
): SoTronOptionForTp[] {
  const date = String(ngay || '').slice(0, 10);
  const shiftSet = new Set(shifts.map(s => String(s || '').trim().toLowerCase()).filter(Boolean));
  return options.filter(opt => {
    if (date && opt.ngay !== date) return false;
    if (shiftSet.size === 0) return true;
    return shiftSet.has(opt.ca.toLowerCase());
  });
}

export function buildTpLinesFromSelectedSoTron(
  options: SoTronOptionForTp[],
  selectedIds: string[],
  catalogHints: ProductConversionHint[] = []
) {
  const selected = new Set(selectedIds);
  const lines = options
    .filter(opt => selected.has(opt.id))
    .flatMap(opt => opt.bang_san_pham);
  return mergeSoTronProductsByMaTen(lines, catalogHints);
}

export function tpLineMetricsFromQuantity(
  quantityText: string,
  kgPerUnit: number,
  m2PerUnit: number,
  mDaiPerUnit: number
) {
  const quantity = Number(String(quantityText || '').replace(',', '.'));
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const metrics = recalcThanhPhamLineMetrics({
    quantity: qty,
    kgPerUnit,
    m2PerUnit,
    mDaiPerUnit
  });
  return {
    quantity: qty > 0 ? String(qty) : quantityText,
    weightKg: metrics.weightKg > 0 ? String(metrics.weightKg) : '',
    areaM2: metrics.m2 > 0 ? String(metrics.m2) : '',
    lengthM: metrics.mDai > 0 ? String(metrics.mDai) : ''
  };
}

function normalizeMachineKey(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

/** Khớp máy lệnh SX với máy đã chọn (mã / tên / "mã · tên"). */
export function tpInboundMachineMatches(
  orderMachine: string,
  selectedMachine: string,
  machines: Array<{ code: string; name: string }> = []
): boolean {
  const ref = String(orderMachine || '').trim();
  const selected = String(selectedMachine || '').trim();
  if (!ref || ref === '-' || !selected) return false;

  const selectedKey = normalizeMachineKey(selected);
  const candidates = new Set<string>([selectedKey]);

  // Chỉ bung mã/tên của máy ĐÃ CHỌN (không thêm cả danh mục).
  for (const machine of machines) {
    const code = String(machine.code || '').trim();
    const name = String(machine.name || '').trim();
    const labels = [
      code && name ? `${code} · ${name}` : '',
      code && name ? `${code} - ${name}` : ''
    ].filter(Boolean);
    const keys = [code, name, ...labels].map(normalizeMachineKey).filter(Boolean);
    const isSelectedMachine = keys.some(key => key === selectedKey);
    if (!isSelectedMachine) continue;
    keys.forEach(key => candidates.add(key));
  }

  const orderKey = normalizeMachineKey(ref);
  return [...candidates].some(key => key === orderKey);
}

export type TpInboundLenhSxOption = {
  orderCode: string;
  machine: string;
  status?: string;
  startDate: string;
  endDate?: string;
  lines: Array<{
    code: string;
    name: string;
    productionName?: string;
    unit: string;
    quantity: number | null;
    weightKg?: number | null;
    areaM2?: number | null;
    lengthM?: number | null;
    kgPerUnit?: number | null;
    m2PerUnit?: number | null;
    mDaiPerUnit?: number | null;
  }>;
};

/** Lọc lệnh SX theo ngày lọc + danh sách máy (ngày nằm trong [bắt đầu, kết thúc]). */
export function filterLenhSxForTpInbound(
  orders: TpInboundLenhSxOption[],
  dateIso: string,
  selectedMachines: string | string[],
  machines: Array<{ code: string; name: string }> = []
): TpInboundLenhSxOption[] {
  const ngay = String(dateIso || '').trim().slice(0, 10);
  const machineList = (Array.isArray(selectedMachines) ? selectedMachines : [selectedMachines])
    .map(item => String(item || '').trim())
    .filter(Boolean);
  if (!ngay || machineList.length === 0) return [];

  return orders.filter(order => {
    const start = String(order.startDate || '').slice(0, 10);
    const end = String(order.endDate || order.startDate || '').slice(0, 10);
    if (start && ngay < start) return false;
    if (end && ngay > end) return false;
    if (!start && !end) return false;
    const matchedMachine = machineList.some(machine =>
      tpInboundMachineMatches(order.machine, machine, machines)
    );
    if (!matchedMachine) return false;
    return order.lines.some(line => String(line.code || '').trim() || String(line.name || '').trim());
  });
}

/** Gộp SP từ các lệnh SX đã chọn (khóa theo mã). Tên hiển thị ưu tiên tên ghép. */
export function mergeProductsFromLenhSx(
  orders: TpInboundLenhSxOption[]
): Array<{
  code: string;
  name: string;
  productionName: string;
  unit: string;
  quantity: number;
  weightKg: number;
  areaM2: number;
  lengthM: number;
  kgPerUnit: number;
  m2PerUnit: number;
  mDaiPerUnit: number;
}> {
  const merged = new Map<
    string,
    {
      code: string;
      name: string;
      productionName: string;
      unit: string;
      quantity: number;
      weightKg: number;
      areaM2: number;
      lengthM: number;
      kgPerUnit: number;
      m2PerUnit: number;
      mDaiPerUnit: number;
    }
  >();
  for (const order of orders) {
    for (const line of order.lines) {
      const code = String(line.code || '').trim();
      if (!code) continue;
      const key = code.toLowerCase();
      const qty = Number(line.quantity);
      const productionName =
        String(line.productionName || '').trim() || String(line.name || '').trim() || code;
      const name = String(line.name || '').trim() || productionName;
      const weightKg = Number(line.weightKg) > 0 ? Number(line.weightKg) : 0;
      const areaM2 = Number(line.areaM2) > 0 ? Number(line.areaM2) : 0;
      const lengthM = Number(line.lengthM) > 0 ? Number(line.lengthM) : 0;
      const kgPerUnit = Number(line.kgPerUnit) > 0 ? Number(line.kgPerUnit) : 0;
      const m2PerUnit = Number(line.m2PerUnit) > 0 ? Number(line.m2PerUnit) : 0;
      const mDaiPerUnit = Number(line.mDaiPerUnit) > 0 ? Number(line.mDaiPerUnit) : 0;
      const existing = merged.get(key);
      if (existing) {
        if (Number.isFinite(qty) && qty > 0) existing.quantity += qty;
        existing.weightKg += weightKg;
        existing.areaM2 += areaM2;
        existing.lengthM += lengthM;
        if (!existing.productionName && productionName) existing.productionName = productionName;
        if (!existing.name && name) existing.name = name;
        if (!existing.unit && line.unit) existing.unit = String(line.unit).trim();
        if (!existing.kgPerUnit && kgPerUnit) existing.kgPerUnit = kgPerUnit;
        if (!existing.m2PerUnit && m2PerUnit) existing.m2PerUnit = m2PerUnit;
        if (!existing.mDaiPerUnit && mDaiPerUnit) existing.mDaiPerUnit = mDaiPerUnit;
      } else {
        merged.set(key, {
          code,
          name,
          productionName,
          unit: String(line.unit || '').trim(),
          quantity: Number.isFinite(qty) && qty > 0 ? qty : 0,
          weightKg,
          areaM2,
          lengthM,
          kgPerUnit,
          m2PerUnit,
          mDaiPerUnit
        });
      }
    }
  }

  return [...merged.values()]
    .map(row => {
      const qty = row.quantity > 0 ? row.quantity : 0;
      const kgPerUnit =
        row.kgPerUnit > 0 ? row.kgPerUnit : qty > 0 && row.weightKg > 0 ? row.weightKg / qty : 0;
      const m2PerUnit =
        row.m2PerUnit > 0 ? row.m2PerUnit : qty > 0 && row.areaM2 > 0 ? row.areaM2 / qty : 0;
      const mDaiPerUnit =
        row.mDaiPerUnit > 0 ? row.mDaiPerUnit : qty > 0 && row.lengthM > 0 ? row.lengthM / qty : 0;
      return {
        ...row,
        kgPerUnit,
        m2PerUnit,
        mDaiPerUnit
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, 'vi'));
}
