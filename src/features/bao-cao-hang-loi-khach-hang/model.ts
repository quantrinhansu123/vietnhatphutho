/**
 * Báo cáo hàng lỗi hỏng phát sinh ở khách hàng.
 * Kinh doanh nhập từng phiếu, QC thống kê theo Nhóm VTHH.
 */

export interface HangLoiKhachHangRecord {
  id: string;
  ngay: string;
  nhom_vthh: string;
  noi_dung: string;
  khu_vuc: string;
  phan_loai_hang: string;
  /** Text tự do (có thể là số lượng hoặc ghi chú xử lý). */
  xu_ly_cong_ty: string;
  xu_ly_khac: string;
  ghi_chu: string;
  created_at?: string;
  updated_at?: string;
}

export interface HangLoiKhachHangForm {
  ngay: string;
  nhom_vthh: string;
  noi_dung: string;
  khu_vuc: string;
  phan_loai_hang: string;
  xu_ly_cong_ty: string;
  xu_ly_khac: string;
  ghi_chu: string;
}

/** 3 nhóm máy PX dùng cho báo cáo (lưu canonical trong DB). */
export const HANG_LOI_NHOM_OPTIONS = ['TP; PX Đặc', 'TP; PX Rỗng', 'TP; PX Sóng'] as const;

export const HANG_LOI_KHU_VUC_OPTIONS = ['Bắc', 'Trung', 'Nam'] as const;

/** Dùng chung dropdown Hàng phế với form sản phẩm (src/utils/productProductionName.ts). */
export { WASTE_GRADE_OPTIONS as HANG_LOI_PHAN_LOAI_OPTIONS } from '../../utils/productProductionName';

export function emptyHangLoiForm(today: string): HangLoiKhachHangForm {
  return {
    ngay: today,
    nhom_vthh: '',
    noi_dung: '',
    khu_vuc: 'Bắc',
    phan_loai_hang: '',
    xu_ly_cong_ty: '0',
    xu_ly_khac: '0',
    ghi_chu: ''
  };
}

export function todayLocalISO(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

/** Tên ngắn hiển thị cột SP: Đặc / Rỗng / Sóng. */
export function shortNhomVthh(nhom: string): string {
  const text = String(nhom || '');
  if (text.includes('Đặc')) return 'Đặc';
  if (text.includes('Rỗng')) return 'Rỗng';
  if (text.includes('Sóng')) return 'Sóng';
  return text || '—';
}

/** Bắc → MB, Trung/Nam → HCM&MT (quy ước báo cáo QC). */
export function khuVucSangCotBaoCao(khuVuc: string): 'MB' | 'HCM&MT' | null {
  const text = String(khuVuc || '').trim();
  if (text === 'Bắc') return 'MB';
  if (text === 'Trung' || text === 'Nam') return 'HCM&MT';
  return null;
}

/** Text xử lý: nếu là số nguyên ≥ 0 thì cộng dồn vào báo cáo, còn lại tính 0. */
function parseXuLyInt(value: unknown): number {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return 0;
  const num = Number(raw);
  return Number.isFinite(num) && num <= 1000000000 ? num : 0;
}

export function normalizeHangLoiRecords(data: unknown): HangLoiKhachHangRecord[] {
  if (!data || typeof data !== 'object') return [];
  const list = (data as { records?: unknown }).records;
  if (!Array.isArray(list)) return [];
  const out: HangLoiKhachHangRecord[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const id = String(r.id ?? '').trim();
    const ngay = String(r.ngay ?? '').slice(0, 10);
    const nhom = String(r.nhom_vthh ?? '').trim();
    if (!id || !ngay || !nhom) continue;
    out.push({
      id,
      ngay,
      nhom_vthh: nhom,
      noi_dung: String(r.noi_dung ?? ''),
      khu_vuc: String(r.khu_vuc ?? ''),
      phan_loai_hang: String(r.phan_loai_hang ?? 'Hàng tiêu chuẩn'),
      xu_ly_cong_ty: String(r.xu_ly_cong_ty ?? ''),
      xu_ly_khac: String(r.xu_ly_khac ?? ''),
      ghi_chu: String(r.ghi_chu ?? ''),
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? '')
    });
  }
  return out;
}

export interface HangLoiReportRow {
  key: string;
  nhom_vthh: string;
  sp: string;
  noi_dung: string;
  mb: number;
  hcmMt: number;
  congTy: number;
  khac: number;
}

export interface HangLoiReportNote {
  nhom_vthh: string;
  sp: string;
  total: number;
  /** Tổng hợp theo "nội dung + phân loại": "Nứt vỡ|Hàng tiêu chuẩn" → số phiếu. */
  byContent: { noi_dung: string; phan_loai_hang: string; count: number }[];
}

/**
 * Gom phiếu theo (nhóm VTHH + nội dung):
 * - MB/HCM&MT: đếm số phiếu theo khu vực.
 * - Công Ty/Khác: cộng số lượng xử lý đã nhập.
 */
export function buildHangLoiReport(
  records: HangLoiKhachHangRecord[],
  selectedNhom: string[]
): { rows: HangLoiReportRow[]; notes: HangLoiReportNote[] } {
  const groups = new Map<string, HangLoiReportRow>();
  const noteMap = new Map<string, Map<string, number>>();

  for (const rec of records) {
    const noiDung = rec.noi_dung.trim();
    const key = `${rec.nhom_vthh}|||${noiDung}`;
    let row = groups.get(key);
    if (!row) {
      row = {
        key,
        nhom_vthh: rec.nhom_vthh,
        sp: shortNhomVthh(rec.nhom_vthh),
        noi_dung: noiDung,
        mb: 0,
        hcmMt: 0,
        congTy: 0,
        khac: 0
      };
      groups.set(key, row);
    }
    const cot = khuVucSangCotBaoCao(rec.khu_vuc);
    if (cot === 'MB') row.mb += 1;
    else if (cot === 'HCM&MT') row.hcmMt += 1;
    row.congTy += parseXuLyInt(rec.xu_ly_cong_ty);
    row.khac += parseXuLyInt(rec.xu_ly_khac);

    let byContent = noteMap.get(rec.nhom_vthh);
    if (!byContent) {
      byContent = new Map<string, number>();
      noteMap.set(rec.nhom_vthh, byContent);
    }
    const contentKey = `${noiDung}|||${rec.phan_loai_hang || 'Hàng tiêu chuẩn'}`;
    byContent.set(contentKey, (byContent.get(contentKey) ?? 0) + 1);
  }

  const orderOf = (nhom: string) => {
    const idx = HANG_LOI_NHOM_OPTIONS.indexOf(nhom as (typeof HANG_LOI_NHOM_OPTIONS)[number]);
    return idx === -1 ? 99 : idx;
  };
  const rows = [...groups.values()].sort(
    (a, b) => orderOf(a.nhom_vthh) - orderOf(b.nhom_vthh) || a.noi_dung.localeCompare(b.noi_dung, 'vi')
  );

  const notes: HangLoiReportNote[] = selectedNhom.map(nhom => {
    const byContent = noteMap.get(nhom);
    const entries = byContent ? [...byContent.entries()] : [];
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    const detail = entries
      .map(([contentKey, count]) => {
        const [noi_dung, phan_loai_hang] = contentKey.split('|||');
        return { noi_dung, phan_loai_hang, count };
      })
      .sort((a, b) => b.count - a.count || a.noi_dung.localeCompare(b.noi_dung, 'vi'));
    return { nhom_vthh: nhom, sp: shortNhomVthh(nhom), total, byContent: detail };
  });

  return { rows, notes };
}
