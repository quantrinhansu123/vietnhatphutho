import { formatNumber } from '../utils';
import type { MixingPhoiTron, MixingReport, MixingReportLine, MixingRoundItem } from '../components/MixingReportForm';

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

export function normalizeMixingReport(record: Record<string, unknown>): MixingReport {
  const chiTietRaw = record.chi_tiet;
  const chi_tiet = Array.isArray(chiTietRaw)
    ? chiTietRaw.map((line, index) => normalizeMixingReportLine(line as Record<string, unknown>, index))
    : [];
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
    so_lan: Number(record.so_lan) || so_lan_from_lines,
    thuc_te_su_dung:
      record.thuc_te_su_dung === null || record.thuc_te_su_dung === undefined
        ? null
        : Number(record.thuc_te_su_dung),
    ghi_chu: String(record.ghi_chu ?? ''),
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
