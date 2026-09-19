import type { MachineRow } from '../danh-sach-may';
import type { ChiPhiDienRow } from './types';

export const LOAI_CHUA_PHAN_LOAI = 'Chưa phân loại';

export function parseNumLoose(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Đồng/Kg = tiền điện / thành phẩm, làm tròn đồng; SP = 0 → 0. */
export function calcDongKg(tienDien: number, thanhPham: number): number {
  const tien = Number(tienDien) || 0;
  const sp = Number(thanhPham) || 0;
  if (sp <= 0 || tien < 0) return 0;
  return Math.round(tien / sp);
}

export function fmtInt(value: number): string {
  return (Number(value) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

/** Map mã/tên máy → Loại/Nhóm (sổ trộn chỉ lưu theo máy nên phải map qua danh mục máy). */
export function buildMachineTypeIndex(machines: MachineRow[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const m of machines) {
    const type = (m.type || '').trim() || LOAI_CHUA_PHAN_LOAI;
    const code = (m.code || '').trim();
    const name = (m.name || '').trim();
    if (code && !index.has(code)) index.set(code, type);
    if (name && !index.has(name)) index.set(name, type);
  }
  return index;
}

/** Danh sách Loại/Nhóm máy sắp xếp tiếng Việt. */
export function collectLoaiMayOptions(machines: MachineRow[]): string[] {
  const set = new Set<string>();
  for (const m of machines) {
    const type = (m.type || '').trim();
    if (type && type !== LOAI_CHUA_PHAN_LOAI) set.add(type);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
}

function thanhPhamCuaPhieu(report: Record<string, unknown>): number {
  const lines = (report as { bang_san_pham?: unknown }).bang_san_pham;
  if (Array.isArray(lines) && lines.length > 0) {
    let sum = 0;
    for (const line of lines) {
      if (line && typeof line === 'object') {
        sum += parseNumLoose((line as Record<string, unknown>).trong_luong);
      }
    }
    if (sum > 0) return Math.round(sum * 100) / 100;
  }
  // Fallback: 2 cột tổng đã lưu cùng phiếu
  const coMang = parseNumLoose(report.tong_sp_co_mang);
  const khongMang = parseNumLoose(report.tong_sp_khong_mang);
  return Math.round((coMang + khongMang) * 100) / 100;
}

/** Cộng dồn thành phẩm (kg) từng phiếu sổ trộn theo Loại/Nhóm máy. */
export function sumThanhPhamByLoai(
  reports: Array<Record<string, unknown>>,
  machineTypeIndex: Map<string, string>
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const report of reports) {
    const maMay = String(report.ma_may ?? '').trim();
    const tenMay = String(report.ten_may ?? '').trim();
    const loai = machineTypeIndex.get(maMay) || machineTypeIndex.get(tenMay) || LOAI_CHUA_PHAN_LOAI;
    totals[loai] = (totals[loai] || 0) + thanhPhamCuaPhieu(report);
  }
  for (const key of Object.keys(totals)) {
    totals[key] = Math.round(totals[key] * 100) / 100;
  }
  return totals;
}

export function yearRangeOf(nam: number): { from: string; to: string } {
  return { from: `${nam}-01-01`, to: `${nam}-12-31` };
}

export function monthRangeOf(thang: number, nam: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(nam, thang, 0).getDate();
  return {
    from: `${nam}-${pad(thang)}-01`,
    to: `${nam}-${pad(thang)}-${pad(lastDay)}`
  };
}

export interface NoteLine {
  loai: string;
  dongKg: number;
  diff: number | null;
  /** Nhãn mốc so sánh đầy đủ, vd "năm 2025" (rỗng = không có số liệu so sánh). */
  prevLabel: string;
  ghiChu: string;
}

/**
 * Dựng các dòng đỏ dưới bảng:
 * "- SP Rỗng chi phí điện là 3.587đ/kg tăng 326đ so với năm 2025 (trong năm thay khuôn 2 lần)".
 */
export function buildNoteLines(
  rows: ChiPhiDienRow[],
  prevDongKg: Record<string, number>,
  prevLabel: string
): NoteLine[] {
  return rows.map(row => {
    const prev = prevDongKg[row.loai_may];
    const hasPrev = prevLabel !== '' && Number.isFinite(prev);
    return {
      loai: row.loai_may,
      dongKg: row.dong_kg,
      diff: hasPrev ? row.dong_kg - (Number(prev) || 0) : null,
      prevLabel,
      ghiChu: (row.ghi_chu || '').trim()
    };
  });
}

export interface YearComparisonPick {
  nam: number;
  dongKg: Record<string, number>;
}

interface ComparisonCandidate {
  id?: unknown;
  thang: unknown;
  nam: unknown;
  chi_tiet?: unknown;
}

/** true = bản ghi định giá theo năm (thang = 0 hoặc chi_tiet.ky = 'nam'). */
export function isYearlyRecord(item: ComparisonCandidate): boolean {
  if (Number(item.thang) === 0) return true;
  const detail = (item as { chi_tiet?: unknown }).chi_tiet;
  return (
    !!detail &&
    typeof detail === 'object' &&
    (detail as { ky?: unknown }).ky === 'nam'
  );
}

function dongKgMapOf(item: ComparisonCandidate): Record<string, number> {
  const map: Record<string, number> = {};
  const detail = (item as { chi_tiet?: unknown }).chi_tiet;
  const rows =
    detail && typeof detail === 'object' && Array.isArray((detail as { rows?: unknown }).rows)
      ? (detail as { rows: Array<Record<string, unknown>> }).rows
      : [];
  for (const row of rows) {
    const loai = String(row.loai_may || '').trim();
    if (loai) map[loai] = Number(row.dong_kg) || 0;
  }
  return map;
}

/** Mốc so sánh cho năm đang xét: bản ghi năm gần nhất trước đó (so với năm trước). */
export function pickYearComparison(
  items: ComparisonCandidate[],
  nam: number,
  excludeId?: string | null
): YearComparisonPick | null {
  let best: YearComparisonPick | null = null;
  for (const item of items) {
    if (excludeId && String(item.id ?? '') === String(excludeId)) continue;
    if (!isYearlyRecord(item)) continue;
    const n = Number(item.nam);
    if (!Number.isFinite(n) || n >= nam) continue;
    if (!best || n > best.nam) {
      best = { nam: n, dongKg: dongKgMapOf(item) };
    }
  }
  return best;
}
