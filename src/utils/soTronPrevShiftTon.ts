/**
 * Lấy map tồn cuối ca trước (sổ trộn `bang_ban_giao.ton_cuoi_ca`) theo ngày + ca + máy.
 * Cùng quy tắc với màn Sổ trộn → cột «Nhập Ca Trước».
 */
import {
  findShiftChainMeta,
  resolveLogicalPreviousShiftSlot,
  resolveShiftName,
  type ShiftOption,
  type ShiftSetting
} from './shiftSettings';

export type SoTronPrevTonSource = { ngay: string; ca: string };

export type SoTronPrevTonResult = {
  /** key = material_id hoặc ma_nvl (lowercase) → ton_cuoi_ca */
  tonByMaterialKey: Map<string, number>;
  source: SoTronPrevTonSource | null;
};

type SoTronBanGiaoLine = {
  material_id?: unknown;
  ma_nvl?: unknown;
  /** Alias lịch sử / stub — một số nguồn ghi mã NVL bằng `ma_npl`. */
  ma_npl?: unknown;
  ton_cuoi_ca?: unknown;
};

type SoTronReportLite = {
  id?: string;
  ngay: string;
  ca: string;
  ma_may?: string;
  ten_may?: string;
  bang_ban_giao?: SoTronBanGiaoLine[];
};

function str(value: unknown): string {
  return String(value ?? '').trim();
}

export function soTronMachineMatches(orderMachine: string, code: string, name: string): boolean {
  const ref = str(orderMachine).toLowerCase();
  if (!ref || ref === '-') return true;
  const keys = [code, name]
    .map(v => str(v).toLowerCase())
    .filter(Boolean);
  if (keys.length === 0) return true;
  if (keys.some(key => ref === key || ref.includes(key) || key.includes(ref))) return true;
  // Khớp token chữ/số (vd "Sóng 2" ↔ "Máy Sóng 2 (máy mới)")
  const splitTokens = (value: string) =>
    value
      .split(/[^a-z0-9]+/i)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length >= 1);
  const refTokens = splitTokens(ref).filter(t => t.length >= 2 || /^\d+$/.test(t));
  return keys.some(key => {
    const keyTokens = splitTokens(key).filter(t => t.length >= 2 || /^\d+$/.test(t));
    if (keyTokens.length === 0 || refTokens.length === 0) return false;
    const overlap = keyTokens.filter(t => refTokens.includes(t));
    return overlap.length >= Math.min(2, keyTokens.length, refTokens.length);
  });
}

/** Khớp máy sổ trộn theo cả ma_may và ten_may (tránh miss khi ma_may là mã ngắn). */
export function soTronReportMatchesMachine(
  report: { ma_may?: string | null; ten_may?: string | null },
  code: string,
  name?: string
): boolean {
  const maMay = str(report.ma_may);
  const tenMay = str(report.ten_may);
  const filterCode = str(code);
  const filterName = str(name || code);
  if (!filterCode && !filterName) return true;
  if (maMay && soTronMachineMatches(maMay, filterCode, filterName)) return true;
  if (tenMay && soTronMachineMatches(tenMay, filterCode, filterName)) return true;
  if ((maMay || tenMay) && soTronMachineMatches(`${maMay} ${tenMay}`.trim(), filterCode, filterName)) {
    return true;
  }
  return false;
}

function asBanGiao(value: unknown): SoTronBanGiaoLine[] {
  return Array.isArray(value) ? (value as SoTronBanGiaoLine[]) : [];
}

function normalizeSoTronList(data: unknown): SoTronReportLite[] {
  const raw = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : data && typeof data === 'object' && Array.isArray((data as { reports?: unknown }).reports)
        ? (data as { reports: unknown[] }).reports
        : [];
  return raw
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const r = item as Record<string, unknown>;
      return {
        id: str(r.id),
        ngay: str(r.ngay),
        ca: str(r.ca),
        ma_may: str(r.ma_may),
        ten_may: str(r.ten_may),
        bang_ban_giao: asBanGiao(r.bang_ban_giao)
      };
    })
    .filter(r => Boolean(r.ngay));
}

function buildTonMap(prev: SoTronReportLite | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!prev) return map;
  for (const line of prev.bang_ban_giao || []) {
    const value = Number(line.ton_cuoi_ca) || 0;
    const materialId = str(line.material_id).toLowerCase();
    const maNvl = str(line.ma_nvl || line.ma_npl).toLowerCase();
    if (materialId) map.set(materialId, value);
    if (maNvl) map.set(maNvl, value);
  }
  return map;
}

/**
 * Tìm phiếu sổ trộn ca trước logic (và lùi tiếp nếu thiếu), trả map tồn cuối theo NVL.
 */
export function resolveSoTronPrevTonFromReports(options: {
  ngay: string;
  ca: string;
  maMay: string;
  tenMay?: string;
  reports: SoTronReportLite[];
  shiftOptions: ShiftOption[];
  shiftSettings: ShiftSetting[];
}): SoTronPrevTonResult {
  const ngay = str(options.ngay);
  const caVal = str(options.ca);
  const maMay = str(options.maMay);
  const tenMay = str(options.tenMay || options.maMay);
  const empty: SoTronPrevTonResult = { tonByMaterialKey: new Map(), source: null };
  if (!ngay || !caVal || !maMay) return empty;

  const { shiftOptions, shiftSettings, reports } = options;

  const canonShift = (value: string) => {
    if (!value) return '';
    if (shiftOptions.length > 0) {
      try {
        return resolveShiftName(value, shiftOptions);
      } catch {
        return value.trim();
      }
    }
    return value.trim();
  };
  const slotKey = (ngayVal: string, caRaw: string) =>
    `${ngayVal}||${canonShift(caRaw).trim().toLowerCase()}`;

  const bySlot = new Map<string, SoTronReportLite>();
  for (const r of reports) {
    if (!soTronReportMatchesMachine(r, maMay, tenMay)) continue;
    if (r.ngay > ngay) continue;
    const key = slotKey(r.ngay, r.ca || '');
    if (!bySlot.has(key)) bySlot.set(key, r);
  }

  let prev: SoTronReportLite | undefined;
  const inChain = caVal && ngay ? findShiftChainMeta(caVal, shiftOptions, shiftSettings) : null;
  if (inChain) {
    let slot = resolveLogicalPreviousShiftSlot(ngay, caVal, shiftOptions, shiftSettings);
    for (let step = 0; step < 120 && slot; step += 1) {
      const hit = bySlot.get(slotKey(slot.ngay, slot.shift));
      if (hit) {
        prev = hit;
        break;
      }
      slot = resolveLogicalPreviousShiftSlot(slot.ngay, slot.shift, shiftOptions, shiftSettings);
    }
  }

  if (!prev && !inChain) {
    const getShiftIndex = (shiftName: string) => {
      if (!shiftName) return -1;
      const s = shiftName.trim().toLowerCase();
      const idx = shiftOptions.findIndex(
        o => o.value.trim().toLowerCase() === s || o.label.trim().toLowerCase() === s
      );
      if (idx >= 0) return idx;
      const m = s.match(/\d+/);
      return m ? parseInt(m[0], 10) : -1;
    };
    const targetShiftIdx = getShiftIndex(caVal);
    const candidates = reports.filter(r => {
      if (!soTronReportMatchesMachine(r, maMay, tenMay)) return false;
      if (r.ngay === ngay && r.ca === caVal) return false;
      if (r.ngay > ngay) return false;
      if (r.ngay === ngay) {
        if (targetShiftIdx >= 0) {
          const rShiftIdx = getShiftIndex(r.ca);
          if (rShiftIdx >= 0) return rShiftIdx < targetShiftIdx;
        }
        return r.ca !== caVal;
      }
      return true;
    });
    candidates.sort((a, b) => {
      const dateCmp = b.ngay.localeCompare(a.ngay);
      if (dateCmp !== 0) return dateCmp;
      const aShiftIdx = getShiftIndex(a.ca);
      const bShiftIdx = getShiftIndex(b.ca);
      if (aShiftIdx >= 0 && bShiftIdx >= 0 && aShiftIdx !== bShiftIdx) {
        return bShiftIdx - aShiftIdx;
      }
      return (b.id || '').localeCompare(a.id || '');
    });
    prev = candidates[0];
  }

  return {
    tonByMaterialKey: buildTonMap(prev),
    source: prev ? { ngay: prev.ngay, ca: prev.ca } : null
  };
}

/** Fetch sổ trộn rồi resolve tồn cuối ca trước (lọc máy phía client — khớp lỏng như sổ trộn). */
export async function fetchSoTronPrevShiftTon(options: {
  ngay: string;
  ca: string;
  maMay: string;
  tenMay?: string;
  shiftOptions: ShiftOption[];
  shiftSettings: ShiftSetting[];
  signal?: AbortSignal;
}): Promise<SoTronPrevTonResult> {
  const maMay = str(options.maMay);
  const tenMay = str(options.tenMay || options.maMay);
  if (!maMay || !str(options.ngay) || !str(options.ca)) {
    return { tonByMaterialKey: new Map(), source: null };
  }

  // Không lọc ma_may trên API (eq tuyệt đối dễ miss khi PTĐM gửi tên máy,
  // sổ trộn lưu mã/tên khác). Lấy gần đây rồi lọc lỏng phía client.
  const res = await fetch('/api/so-tron?limit=300', { signal: options.signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && typeof data === 'object' && 'error' in data && String((data as { error?: unknown }).error)) ||
        'Không tải được sổ trộn.'
    );
  }

  const reports = normalizeSoTronList(data).filter(r =>
    soTronReportMatchesMachine(r, maMay, tenMay)
  );

  return resolveSoTronPrevTonFromReports({
    ngay: options.ngay,
    ca: options.ca,
    maMay,
    tenMay,
    reports,
    shiftOptions: options.shiftOptions,
    shiftSettings: options.shiftSettings
  });
}

/** Tra tồn trong map theo material_id hoặc mã NVL. */
export function lookupSoTronPrevTon(
  tonByMaterialKey: Map<string, number>,
  materialId?: string | null,
  materialCode?: string | null
): number | undefined {
  const id = str(materialId).toLowerCase();
  const code = str(materialCode).toLowerCase();
  if (id && tonByMaterialKey.has(id)) return tonByMaterialKey.get(id);
  if (code && tonByMaterialKey.has(code)) return tonByMaterialKey.get(code);
  return undefined;
}

/**
 * Lay ton cuoi ca cua DUNG o (ngay, ca, may) trong so tron — khong lui ca.
 * Dung cho o Ngay + Ca truoc cua phieu xuat NVL: ton dau ca phieu xuat
 * chinh la ton cuoi ca cua o ngay/ca da chon (theo may o tren).
 */
export async function fetchSoTronTonCuoiCaSlot(options: {
  ngay: string;
  ca: string;
  maMay: string;
  tenMay?: string;
  shiftOptions: ShiftOption[];
  signal?: AbortSignal;
}): Promise<SoTronPrevTonResult> {
  const maMay = str(options.maMay);
  const tenMay = str(options.tenMay || options.maMay);
  const ngay = str(options.ngay);
  const ca = str(options.ca);
  if (!maMay || !ngay || !ca) {
    return { tonByMaterialKey: new Map(), source: null };
  }

  const canon = (value: string) => {
    if (!value) return '';
    if (options.shiftOptions.length > 0) {
      try {
        return resolveShiftName(value, options.shiftOptions);
      } catch {
        return value.trim();
      }
    }
    return value.trim();
  };
  const targetCa = canon(ca).trim().toLowerCase();

  const res = await fetch('/api/so-tron?limit=300', { signal: options.signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && typeof data === 'object' && 'error' in data && String((data as { error?: unknown }).error)) ||
        'Không tải được sổ trộn.'
    );
  }

  const hit = normalizeSoTronList(data).find(
    r =>
      r.ngay === ngay &&
      canon(r.ca || '').trim().toLowerCase() === targetCa &&
      soTronReportMatchesMachine(r, maMay, tenMay)
  );

  return {
    tonByMaterialKey: buildTonMap(hit),
    source: hit ? { ngay: hit.ngay, ca: hit.ca } : null
  };
}
