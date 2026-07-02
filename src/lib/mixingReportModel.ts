import { formatNumber } from '../utils';
import type { MixingPhoiTron, MixingReport, MixingReportLine, MixingRoundItem, MixingRoundPhoto } from '../components/MixingReportForm';

export const MIXING_ROUND_KEYS = ['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const;
export type MixingRoundKey = (typeof MIXING_ROUND_KEYS)[number];

function parseOptionalNumber(value: string) {
  if (!value || !String(value).trim()) return null;
  const normalized = String(value).replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}


function parseStoredNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  return parseOptionalNumber(String(value));
}

function isMeaningfulRoundItem(item: MixingRoundItem) {
  return Boolean(item.ma_nvl.trim() || item.ten_vat_tu.trim() || item.so_luong !== null);
}

function hasMaterialRoundItems(phoiTron: MixingPhoiTron) {
  return MIXING_ROUND_KEYS.some(key => getRoundItems(phoiTron, key).some(isMeaningfulRoundItem));
}

function backfillLegacyLinePhoiTron(
  line: Record<string, unknown>,
  lan_su_dung: MixingPhoiTron,
  ma_nvl: string,
  ten_vat_tu: string
): MixingPhoiTron {
  if (hasMaterialRoundItems(lan_su_dung)) return lan_su_dung;

  const don_vi = String(line.don_vi ?? line.unit ?? 'kg').trim() || 'kg';
  const tong_nhua_tron = parseStoredNumber(line.tong_nhua_tron);
  const ti_le_phan_tram = parseStoredNumber(line.ti_le_phan_tram ?? line.phan_tram);

  if (!ma_nvl && !ten_vat_tu && tong_nhua_tron === null) return lan_su_dung;

  return {
    ...lan_su_dung,
    lan_1: [
      {
        ma_nvl,
        ten_vat_tu,
        don_vi,
        so_luong: tong_nhua_tron,
        ti_le_phan_tram
      }
    ]
  };
}

function normalizeRoundItems(value: unknown): MixingRoundItem[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'number') {
    return [{ ma_nvl: '', ten_vat_tu: '', don_vi: 'kg', so_luong: value, ti_le_phan_tram: null }];
  }
  if (!Array.isArray(value)) {
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return [
        {
          ma_nvl: String(record.ma_npl ?? record.ma_nvl ?? record.code ?? '').trim(),
          ten_vat_tu: String(record.ten_vat_tu ?? record.ten_npl ?? '').trim(),
          don_vi: String(record.don_vi ?? record.unit ?? 'kg').trim() || 'kg',
          so_luong: parseStoredNumber(record.so_luong ?? record.so_luong_kg),
          ti_le_phan_tram: parseStoredNumber(record.ti_le_phan_tram ?? record.phan_tram)
        }
      ];
    }
    return [];
  }
  return value
    .map((item): MixingRoundItem | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      return {
        ma_nvl: String(record.ma_npl ?? record.ma_nvl ?? record.code ?? '').trim(),
        ten_vat_tu: String(record.ten_vat_tu ?? record.ten_npl ?? '').trim(),
        don_vi: String(record.don_vi ?? record.unit ?? 'kg').trim() || 'kg',
        so_luong: parseStoredNumber(record.so_luong ?? record.so_luong_kg),
        ti_le_phan_tram: parseStoredNumber(record.ti_le_phan_tram ?? record.phan_tram)
      };
    })
    .filter((item): item is MixingRoundItem => Boolean(item))
    .filter(isMeaningfulRoundItem);
}

export function normalizePhoiTron(source: unknown): MixingPhoiTron {
  const record = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  const phoiTron: MixingPhoiTron = {};
  MIXING_ROUND_KEYS.forEach(key => {
    const items = normalizeRoundItems(record[key]);
    if (items.length > 0) phoiTron[key] = items;
  });
  const rawBatch = record.khoi_luong_me;
  if (rawBatch && typeof rawBatch === 'object') {
    const khoi_luong_me: Partial<Record<MixingRoundKey, number | null>> = {};
    MIXING_ROUND_KEYS.forEach(key => {
      const val = parseStoredNumber((rawBatch as Record<string, unknown>)[key]);
      if (val !== null && val > 0) khoi_luong_me[key] = val;
    });
    if (Object.keys(khoi_luong_me).length > 0) phoiTron.khoi_luong_me = khoi_luong_me;
  }
  if (!phoiTron.lan_1) phoiTron.lan_1 = [];
  return phoiTron;
}

export function getRoundItems(phoiTron: MixingPhoiTron, key: MixingRoundKey) {
  return phoiTron[key] ?? [];
}

export function visibleRoundCount(phoiTron: MixingPhoiTron) {
  for (let index = MIXING_ROUND_KEYS.length - 1; index >= 0; index -= 1) {
    if (phoiTron[MIXING_ROUND_KEYS[index]] !== undefined) return index + 1;
  }
  return 1;
}

export function sumRoundQuantity(phoiTron: MixingPhoiTron, key: MixingRoundKey) {
  return Math.round(
    getRoundItems(phoiTron, key).reduce((sum, item) => sum + (item.so_luong ?? 0), 0) * 100
  ) / 100;
}

export function sumMixingRounds(phoiTron: MixingPhoiTron) {
  return Math.round(
    MIXING_ROUND_KEYS.reduce((sum, key) => sum + sumRoundQuantity(phoiTron, key), 0) * 100
  ) / 100;
}

function normalizeMaterialKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function materialItemKey(item: MixingRoundItem) {
  const code = item.ma_nvl.trim();
  return code ? normalizeMaterialKey(code) : normalizeMaterialKey(item.ten_vat_tu);
}

function deriveLineMaterial(phoiTron: MixingPhoiTron) {
  for (const key of MIXING_ROUND_KEYS) {
    for (const item of getRoundItems(phoiTron, key)) {
      if (item.ma_nvl.trim() || item.ten_vat_tu.trim()) {
        return { ma_nvl: item.ma_nvl, ten_vat_tu: item.ten_vat_tu };
      }
    }
  }
  return { ma_nvl: '', ten_vat_tu: '' };
}

export function deriveLineUnit(phoiTron: MixingPhoiTron) {
  for (const key of MIXING_ROUND_KEYS) {
    for (const item of getRoundItems(phoiTron, key)) {
      if (item.don_vi.trim()) return item.don_vi.trim();
    }
  }
  return 'kg';
}

export function mixingRoundColumnLabel(roundIndex: number) {
  return `Lần ${roundIndex + 1} (kg)`;
}

export function splitMixingLineByMaterial(line: MixingReportLine): MixingReportLine[] {
  const keys = new Set<string>();
  MIXING_ROUND_KEYS.forEach(key => {
    getRoundItems(line.lan_su_dung, key).forEach(item => {
      if (item.ma_nvl.trim() || item.ten_vat_tu.trim()) keys.add(materialItemKey(item));
    });
  });

  if (keys.size <= 1) {
    const { ma_nvl, ten_vat_tu } = deriveLineMaterial(line.lan_su_dung);
    return [
      {
        ...line,
        ma_nvl,
        ten_vat_tu,
        tong_nhua_tron: sumMixingRounds(line.lan_su_dung)
      }
    ];
  }

  return Array.from(keys).map(key => {
    const lan_su_dung: MixingPhoiTron = {};
    MIXING_ROUND_KEYS.forEach(roundKey => {
      const items = getRoundItems(line.lan_su_dung, roundKey).filter(
        item => (item.ma_nvl.trim() || item.ten_vat_tu.trim()) && materialItemKey(item) === key
      );
      if (items.length > 0) lan_su_dung[roundKey] = items;
    });
    const { ma_nvl, ten_vat_tu } = deriveLineMaterial(lan_su_dung);
    return {
      ...line,
      ma_nvl,
      ten_vat_tu,
      lan_su_dung,
      tong_nhua_tron: sumMixingRounds(lan_su_dung),
      hinh_anh: '',
      hinh_anh_public_id: ''
    };
  });
}

export function normalizeChiTietLines(lines: MixingReportLine[]): MixingReportLine[] {
  return lines
    .flatMap(splitMixingLineByMaterial)
    .map((line, index) => ({ ...line, stt: index + 1 }));
}

export function normalizeMixingReportLine(line: Record<string, unknown>, index: number): MixingReportLine {
  let lan_su_dung = normalizePhoiTron(line.lan_su_dung);
  const derived = deriveLineMaterial(lan_su_dung);
  const ma_nvl = String(line.ma_npl ?? line.ma_nvl ?? derived.ma_nvl).trim();
  const ten_vat_tu = String(line.ten_vat_tu ?? line.ten_npl ?? derived.ten_vat_tu).trim();
  lan_su_dung = backfillLegacyLinePhoiTron(line, lan_su_dung, ma_nvl, ten_vat_tu);
  const tongFromRounds = sumMixingRounds(lan_su_dung);
  const tong_nhua_tron = parseStoredNumber(line.tong_nhua_tron) ?? (tongFromRounds > 0 ? tongFromRounds : null);

  return {
    stt: Number(line.stt ?? index + 1) || index + 1,
    ma_nvl,
    ten_vat_tu,
    lan_su_dung,
    tong_nhua_tron,
    hinh_anh: String(line.hinh_anh ?? '').trim(),
    hinh_anh_public_id: String(line.hinh_anh_public_id ?? '').trim()
  };
}

export function normalizeMixingRoundPhotos(source: unknown): Partial<Record<MixingRoundKey, MixingRoundPhoto[]>> {
  if (!source || typeof source !== 'object') return {};
  const record = source as Record<string, unknown>;
  const result: Partial<Record<MixingRoundKey, MixingRoundPhoto[]>> = {};

  MIXING_ROUND_KEYS.forEach(key => {
    const raw = record[key];
    if (!Array.isArray(raw)) return;
    const photos = raw
      .map((item): MixingRoundPhoto | null => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const url = String(row.url ?? row.hinh_anh ?? row.imageUrl ?? '').trim();
        if (!url) return null;
        const public_id = String(row.public_id ?? row.hinh_anh_public_id ?? row.imagePublicId ?? '').trim();
        return { url, ...(public_id ? { public_id } : {}) };
      })
      .filter((item): item is MixingRoundPhoto => Boolean(item));
    if (photos.length > 0) result[key] = photos;
  });

  return result;
}

export function normalizeMixingReport(record: Record<string, unknown>): MixingReport {
  const chiTietRaw = record.chi_tiet;
  const chi_tiet = normalizeChiTietLines(
    Array.isArray(chiTietRaw)
      ? chiTietRaw.map((line, index) => normalizeMixingReportLine(line as Record<string, unknown>, index))
      : []
  );
  const so_lan_from_lines = chi_tiet.reduce(
    (max, line) => Math.max(max, visibleRoundCount(line.lan_su_dung)),
    1
  );

  return {
    id: String(record.id ?? ''),
    ca: String(record.ca ?? ''),
    ngay: String(record.ngay ?? '').slice(0, 10),
    gio: String(record.gio ?? '').slice(0, 5),
    chi_nhanh: String(record.chi_nhanh ?? ''),
    ma_may: String(record.ma_may ?? ''),
    ten_may: String(record.ten_may ?? ''),
    nhan_su: String(record.nhan_su ?? ''),
    so_phieu: String(record.so_phieu ?? ''),
    ky_hieu: String(record.ky_hieu ?? 'QT-16-BM02'),
    so_lan: Math.max(Number(record.so_lan) || 0, so_lan_from_lines, 1),
    thuc_te_su_dung:
      record.thuc_te_su_dung === null || record.thuc_te_su_dung === undefined
        ? null
        : Number(record.thuc_te_su_dung),
    ghi_chu: String(record.ghi_chu ?? ''),
    hinh_anh_theo_lan: normalizeMixingRoundPhotos(record.hinh_anh_theo_lan),
    chi_tiet,
    created_at: String(record.created_at ?? '')
  };
}

export function formatOptionalNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return formatNumber(value, 2);
}

export type MixingReportLineRow = {
  reportId: string;
  ngay: string;
  ca: string;
  gio: string;
  ma_may: string;
  ten_may: string;
  nhan_su: string;
  line: MixingReportLine;
};

export function flattenMixingReportLines(reports: MixingReport[]): MixingReportLineRow[] {
  return reports.flatMap(report =>
    report.chi_tiet.map(line => ({
      reportId: report.id,
      ngay: report.ngay,
      ca: report.ca,
      gio: report.gio,
      ma_may: report.ma_may,
      ten_may: report.ten_may,
      nhan_su: report.nhan_su,
      line
    }))
  );
}

export function maxRoundCountFromReports(reports: MixingReport[]) {
  return reports.reduce((max, report) => {
    const reportMax = report.chi_tiet.reduce(
      (inner, line) => Math.max(inner, visibleRoundCount(line.lan_su_dung)),
      1
    );
    return Math.max(max, report.so_lan || 0, reportMax);
  }, 1);
}

export function parseBatchWeightInput(value: string) {
  if (!value || !String(value).trim()) return null;
  const normalized = String(value).replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

function calcNormQuantityFromPercent(batchWeight: number | null, percent: number | null) {
  if (!batchWeight || batchWeight <= 0 || !percent || percent <= 0) return null;
  return Math.round(((batchWeight * percent) / 100) * 100) / 100;
}

function applyPercentToRoundItem(item: MixingRoundItem, batchWeight: number | null): MixingRoundItem {
  const kg = calcNormQuantityFromPercent(batchWeight, item.ti_le_phan_tram);
  return kg !== null ? { ...item, so_luong: kg } : item;
}

function recalcRoundItems(phoiTron: MixingPhoiTron, key: MixingRoundKey): MixingPhoiTron {
  const batchWeight = phoiTron.khoi_luong_me?.[key] ?? null;
  if (!batchWeight) return phoiTron;
  return {
    ...phoiTron,
    [key]: getRoundItems(phoiTron, key).map(item => applyPercentToRoundItem(item, batchWeight))
  };
}

export function getRoundBatchWeightFromLines(chi_tiet: MixingReportLine[], roundKey: MixingRoundKey) {
  for (const line of chi_tiet) {
    const weight = line.lan_su_dung.khoi_luong_me?.[roundKey];
    if (weight !== null && weight !== undefined && weight > 0) return weight;
  }
  return null;
}

export function setRoundBatchWeightOnLines(
  chi_tiet: MixingReportLine[],
  roundKey: MixingRoundKey,
  value: string
): MixingReportLine[] {
  const parsed = parseBatchWeightInput(value);
  if (chi_tiet.length === 0) return chi_tiet;

  return chi_tiet.map(line => {
    const lan_su_dung: MixingPhoiTron = {
      ...line.lan_su_dung,
      khoi_luong_me: { ...line.lan_su_dung.khoi_luong_me, [roundKey]: parsed }
    };
    const updated = recalcRoundItems(lan_su_dung, roundKey);
    return {
      ...line,
      lan_su_dung: updated,
      tong_nhua_tron: sumMixingRounds(updated)
    };
  });
}

export type MixingRoundMaterialEntry = {
  lineIndex: number;
  itemIndex: number;
  item: MixingRoundItem;
};

export function listRoundMaterialEntries(
  chi_tiet: MixingReportLine[],
  roundKey: MixingRoundKey
): MixingRoundMaterialEntry[] {
  const entries: MixingRoundMaterialEntry[] = [];
  chi_tiet.forEach((line, lineIndex) => {
    getRoundItems(line.lan_su_dung, roundKey).forEach((item, itemIndex) => {
      if (item.ma_nvl.trim() || item.ten_vat_tu.trim()) {
        entries.push({ lineIndex, itemIndex, item });
      }
    });
  });
  return entries;
}

function updateLineRoundItems(
  line: MixingReportLine,
  roundKey: MixingRoundKey,
  items: MixingRoundItem[]
): MixingReportLine {
  const lan_su_dung: MixingPhoiTron = { ...line.lan_su_dung, [roundKey]: items };
  const batchWeight = lan_su_dung.khoi_luong_me?.[roundKey] ?? null;
  const recalculated = batchWeight ? recalcRoundItems(lan_su_dung, roundKey) : lan_su_dung;
  return {
    ...line,
    lan_su_dung: recalculated,
    tong_nhua_tron: sumMixingRounds(recalculated)
  };
}

export function upsertMaterialInRound(
  chi_tiet: MixingReportLine[],
  roundKey: MixingRoundKey,
  item: MixingRoundItem,
  edit?: { lineIndex: number; itemIndex: number },
  batchWeightFallback?: number | null
): MixingReportLine[] {
  const batchWeight = getRoundBatchWeightFromLines(chi_tiet, roundKey) ?? batchWeightFallback ?? null;
  const savedItem = applyPercentToRoundItem(item, batchWeight);
  let lines = [...chi_tiet];

  if (edit) {
    const line = lines[edit.lineIndex];
    if (!line) return normalizeChiTietLines(lines);
    const items = [...getRoundItems(line.lan_su_dung, roundKey)];
    items[edit.itemIndex] = savedItem;
    lines[edit.lineIndex] = {
      ...updateLineRoundItems(line, roundKey, items),
      ma_nvl: savedItem.ma_nvl || line.ma_nvl,
      ten_vat_tu: savedItem.ten_vat_tu || line.ten_vat_tu
    };
    return normalizeChiTietLines(lines);
  }

  const codeKey = normalizeMaterialKey(savedItem.ma_nvl || savedItem.ten_vat_tu);
  const existingIndex = lines.findIndex(line => normalizeMaterialKey(line.ma_nvl || line.ten_vat_tu) === codeKey);

  if (existingIndex >= 0) {
    const line = lines[existingIndex];
    const items = [...getRoundItems(line.lan_su_dung, roundKey)];
    const itemKey = normalizeMaterialKey(savedItem.ma_nvl || savedItem.ten_vat_tu);
    const existingItemIndex = items.findIndex(
      item => normalizeMaterialKey(item.ma_nvl || item.ten_vat_tu) === itemKey
    );
    if (existingItemIndex >= 0) {
      items[existingItemIndex] = savedItem;
    } else {
      items.push(savedItem);
    }
    lines[existingIndex] = updateLineRoundItems(line, roundKey, items);
  } else {
    const lan_su_dung: MixingPhoiTron = { lan_1: [], [roundKey]: [savedItem] };
    if (batchWeight) {
      lan_su_dung.khoi_luong_me = { [roundKey]: batchWeight };
    }
    lines.push({
      stt: lines.length + 1,
      ma_nvl: savedItem.ma_nvl,
      ten_vat_tu: savedItem.ten_vat_tu,
      lan_su_dung,
      tong_nhua_tron: sumMixingRounds(lan_su_dung),
      hinh_anh: '',
      hinh_anh_public_id: ''
    });
  }

  return normalizeChiTietLines(lines);
}

export function removeMaterialFromRound(
  chi_tiet: MixingReportLine[],
  roundKey: MixingRoundKey,
  lineIndex: number,
  itemIndex: number
): MixingReportLine[] {
  const line = chi_tiet[lineIndex];
  if (!line) return chi_tiet;

  const items = getRoundItems(line.lan_su_dung, roundKey).filter((_, index) => index !== itemIndex);
  let lines = [...chi_tiet];
  lines[lineIndex] = updateLineRoundItems(line, roundKey, items);

  const hasAnyRoundData = MIXING_ROUND_KEYS.some(key =>
    getRoundItems(lines[lineIndex].lan_su_dung, key).some(isMeaningfulRoundItem)
  );
  if (!hasAnyRoundData) {
    lines = lines.filter((_, index) => index !== lineIndex);
  }

  return normalizeChiTietLines(lines.map((row, index) => ({ ...row, stt: index + 1 })));
}

export function applyMixingRoundAutofill(
  chi_tiet: MixingReportLine[],
  roundKey: MixingRoundKey,
  items: MixingRoundItem[],
  batchWeightFallback?: number | null
): MixingReportLine[] {
  return items.reduce(
    (lines, item) => upsertMaterialInRound(lines, roundKey, item, undefined, batchWeightFallback),
    [...chi_tiet]
  );
}
