import { formatNvlPriceValue } from './model';

/** Một lần nhập giá — tách theo ngày, giá và diễn giải (không gom «n lần»). */
export type NvlPriceLot = {
  id: string;
  donGia: number;
  ngayPhieu: string;
  lyDo: string;
  ghiChu: string;
  maPhieu: string;
  soLuong: number;
};

export type NvlPriceHistoryOption = {
  id: string;
  label: string;
  donGia: number;
  ngayPhieu: string;
  dienGiai: string;
};

function str(value: unknown) {
  return String(value ?? '').trim();
}

function formatDateVN(iso: string) {
  const [y, m, d] = str(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : str(iso).slice(0, 10);
}

function priceKey(value: number) {
  return String(Math.round(value * 10000) / 10000);
}

/** Diễn giải ưu tiên lý do, rồi ghi chú phiếu nhập. */
export function lotDienGiai(lyDo: unknown, ghiChu: unknown) {
  return str(lyDo) || str(ghiChu);
}

/**
 * Gom từng dòng nhập thành lựa chọn giá riêng theo (ngày, giá, diễn giải, mã phiếu).
 * Cùng mã NVL khác giá / khác ngày / khác diễn giải → các option khác nhau;
 * chọn option chỉ điền đơn giá (xuất vẫn gắn lô qua id_dong_nhap_nguon khi chọn lô).
 */
export function buildNvlPriceHistoryOptions(
  rows: Array<{
    don_gia?: unknown;
    ngay_phieu?: unknown;
    ly_do?: unknown;
    ghi_chu?: unknown;
    ma_phieu?: unknown;
    so_luong?: unknown;
    id?: unknown;
  }>
): NvlPriceHistoryOption[] {
  const seen = new Set<string>();
  const options: NvlPriceHistoryOption[] = [];
  for (const row of rows) {
    const donGia = Number(row.don_gia);
    if (!Number.isFinite(donGia) || donGia < 0) continue;
    const ngayPhieu = str(row.ngay_phieu).slice(0, 10);
    const dienGiai = lotDienGiai(row.ly_do, row.ghi_chu);
    const maPhieu = str(row.ma_phieu);
    const id =
      str(row.id) ||
      [priceKey(donGia), ngayPhieu, dienGiai.toLocaleLowerCase('vi'), maPhieu].join('|');
    if (seen.has(id)) continue;
    seen.add(id);
    const parts = [formatNvlPriceValue(donGia)];
    if (ngayPhieu) parts.push(formatDateVN(ngayPhieu));
    if (dienGiai) parts.push(dienGiai);
    else if (maPhieu) parts.push(maPhieu);
    options.push({
      id,
      label: parts.join(' · '),
      donGia,
      ngayPhieu,
      dienGiai
    });
  }
  return options.sort((a, b) => {
    if (a.ngayPhieu !== b.ngayPhieu) return b.ngayPhieu.localeCompare(a.ngayPhieu);
    if (a.donGia !== b.donGia) return b.donGia - a.donGia;
    return a.label.localeCompare(b.label, 'vi');
  });
}

/** Kiểm tra cùng mã có thể xuất nhiều giá (lịch sử không bị gom mất lớp giá). */
export function distinctPrices(options: Array<{ donGia: number }>): number[] {
  const map = new Map<string, number>();
  for (const option of options) {
    if (!Number.isFinite(option.donGia) || option.donGia < 0) continue;
    map.set(priceKey(option.donGia), option.donGia);
  }
  return [...map.values()].sort((a, b) => b - a);
}
