/** Tổng hợp sổ trộn: Tổng NVL / SP có màng / SP không màng / lỗi hỏng / chỉ tiêu %.
 * Dùng chung cho form nhập (`index.tsx`) và modal phiếu giao ca (`PhieuGiaoCaModal.tsx`)
 * để 2 đường lưu cho ra cùng 1 bộ số.
 */

/** Chỉ tiêu sản lượng ngày (kg) — đổi 1 chỗ này nếu nhà máy đổi chỉ tiêu. */
export const SO_TRON_CHI_TIEU_MAU = 3100;

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function num(value: unknown) {
  const parsed = Number(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Chuẩn hóa mã màng: rỗng / '-' = không màng. */
export function normalizeMang(value: unknown): string {
  const s = String(value ?? '').trim();
  return s === '-' ? '' : s;
}

/** true = SP có màng (màng khác rỗng). */
export function hasMang(mang: unknown): boolean {
  return normalizeMang(mang) !== '';
}

export interface SoTronSummaryInput {
  /** Các dòng SP: trọng lượng (kg) + màng của từng dòng. */
  spLines: { trong_luong: unknown; mang?: unknown }[];
  /** Tổng NVL sử dụng (kg) — form tính từ bảng 1, modal tính từ bảng vật tư. */
  tongNvl: number;
  /** Tổng lỗi hỏng (kg) — form/modal tính từ bảng hàng lỗi. */
  tongLoi: number;
}

export interface SoTronSummary {
  tong_nvl: number;
  tong_sp_co_mang: number;
  tong_sp_khong_mang: number;
  tong_loi_hong: number;
  chi_tieu_phan_tram: number;
}

export function computeSoTronSummary(input: SoTronSummaryInput): SoTronSummary {
  let coMang = 0;
  let khongMang = 0;
  for (const line of input.spLines || []) {
    const tl = num(line.trong_luong);
    if (hasMang(line.mang)) coMang += tl;
    else khongMang += tl;
  }
  coMang = round2(coMang);
  khongMang = round2(khongMang);
  const tongSp = round2(coMang + khongMang);
  return {
    tong_nvl: round2(num(input.tongNvl)),
    tong_sp_co_mang: coMang,
    tong_sp_khong_mang: khongMang,
    tong_loi_hong: round2(num(input.tongLoi)),
    chi_tieu_phan_tram: round2((tongSp / SO_TRON_CHI_TIEU_MAU) * 100)
  };
}

/** Tổng SP (có màng + không màng) — tử số của chỉ tiêu. */
export function tongSanPham(summary: SoTronSummary): number {
  return round2(summary.tong_sp_co_mang + summary.tong_sp_khong_mang);
}
