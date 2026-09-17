export interface DongTieuChuan {
  noi_dung?: string;
  toc_do_bom: string;
  toc_do_lo: string;
  do_day: string;
  chieu_rong: string;
  chieu_dai: string;
  thay_mang: Record<string, string>; // Cột 9..17
  khu_khuon: Record<string, string>; // Cột 18..32
  lo_ep_quang: {
    tren: string;
    giua: string;
    duoi: string;
  };
  ghi_chu: string; 
}

export interface DongCheDoChayRow {
  key: string;
  stt: number;
  thoi_gian_kiem_tra: string;
  toc_do_bom: string;
  toc_do_lo: string;
  do_day: string;
  chieu_rong: string;
  chieu_dai: string;
  thay_mang_note: string; // Trong ảnh: 3L x 2,1 x 30m hoặc các cột 9..17
  thay_mang: Record<string, string>;
  khu_khuon: Record<string, string>; // Cột 18..32
  lo_ep_quang: {
    tren: string;
    giua: string;
    duoi: string;
  };
  ghi_chu?: string;
}

export interface DongSanPhamRow {
  key: string;
  stt: number;
  gio_kiem_tra: string;
  mau_sac: string;
  do_day: string;
  chieu_rong: string;
  chieu_dai: string;
  trong_luong: string;
  so_seri: string;
  ket_qua: string;
}

export interface SoGiaoCaMmtbRecord {
  id: string;
  chi_nhanh: string;
  ngay: string; // YYYY-MM-DD
  ma_may: string;
  ten_may: string;
  ca: string;
  ma_lenh_sx: string;
  ten_san_pham: string;
  quy_cach: string;
  truong_ca: string;
  nguoi_kiem_tra: string;
  dong_tieu_chuan: DongTieuChuan;
  bang_che_do_chay: DongCheDoChayRow[];
  bang_san_pham: DongSanPhamRow[];
  ghi_chu_tieu_chuan_sp: string;
  chu_ky: {
    truong_ca: string;
    nguoi_kiem_tra: string;
  };
  created_at?: string;
  updated_at?: string;
}

export const COT_THAY_MANG = ['9', '10', '11', '12', '13', '14', '15', '16', '17'] as const;

export const COT_KHU_KHUON = [
  '18', '19', '20', '21', '22', '23', '24', '25',
  '26', '27', '28', '29', '30', '31', '32'
] as const;

export function defaultDongTieuChuan(): DongTieuChuan {
  const thay_mang: Record<string, string> = {};
  COT_THAY_MANG.forEach(c => { thay_mang[c] = ''; });
  const khu_khuon: Record<string, string> = {};
  COT_KHU_KHUON.forEach(c => { khu_khuon[c] = ''; });

  return {
    noi_dung: '',
    toc_do_bom: '',
    toc_do_lo: '',
    do_day: '',
    chieu_rong: '',
    chieu_dai: '',
    thay_mang,
    khu_khuon,
    lo_ep_quang: { tren: '', giua: '', duoi: '' },
    ghi_chu: ''
  };
}

export function getTieuChuanContent(tc: DongTieuChuan): string {
  if (tc.noi_dung !== undefined) return tc.noi_dung;
  return [tc.toc_do_bom, tc.toc_do_lo, tc.do_day, tc.chieu_rong, tc.chieu_dai,
    ...COT_THAY_MANG.map(c => tc.thay_mang?.[c]),
    ...COT_KHU_KHUON.map(c => tc.khu_khuon?.[c]),
    tc.lo_ep_quang?.tren, tc.lo_ep_quang?.giua, tc.lo_ep_quang?.duoi
  ].filter(Boolean).join(' · ');
}

export const DEFAULT_TIEU_CHUAN_SP_NOTE = `1: Màu sắc: theo mẫu đã được duyệt\n2: Độ dày: (dùng pan me):\n3: Chiều rộng (thước mét):\n4: Chiều dài (thước mét):\n5: Trọng lượng: (± 5%):`;
