export type TongHopMode = 'nhap' | 'xuat';

export type TongHopHeader = {
  id: string;
  ma_phieu_chung: string;
  loai: TongHopMode;
  ngay: string;
  kho_dich: string;
  nguon_loai: string | null;
  nguon_id: string | null;
  dich_loai: string | null;
  dich_id: string | null;
  ca: string | null;
  loai_nhap: string | null;
  loai_xuat: string | null;
  chi_tiet: Array<Record<string, unknown>>;
  ma_phieu_nhap: string | null;
  ma_phieu_xuat: string | null;
  trang_thai: string;
  nguoi_lap: string | null;
  nguoi_giao: string | null;
  dia_diem: string | null;
  ly_do: string | null;
  ghi_chu: string | null;
};

let pendingEdit: TongHopHeader | null = null;
let pendingView: TongHopHeader | null = null;

export function queueTongHopEdit(row: TongHopHeader) {
  pendingEdit = row;
}

export function takePendingTongHopEdit() {
  const row = pendingEdit;
  pendingEdit = null;
  return row;
}

export function queueTongHopView(row: TongHopHeader) {
  pendingView = row;
}

export function takePendingTongHopView() {
  const row = pendingView;
  pendingView = null;
  return row;
}

export function formatTongHopDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function isNvlWarehouseName(name: string) {
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  return n.includes('nvl') || n.includes('nguyen vat lieu') || n.includes('vat tu');
}

const NHAP_CORE_KHO_KEYS = ['kho nvl chinh', 'kho nvl phu', 'kho pc'] as const;

function nhapKhoKey(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}

/** Phiếu nhập tổng hợp: chỉ Kho NVL Chính, Kho NVL Phụ, Kho PC. */
export function isNhapCoreWarehouse(name: string) {
  return (NHAP_CORE_KHO_KEYS as readonly string[]).includes(nhapKhoKey(name));
}

export function pickNhapCoreWarehouses<T extends { label: string }>(warehouses: T[]) {
  return NHAP_CORE_KHO_KEYS.map(key => warehouses.find(item => nhapKhoKey(item.label) === key)).filter((item): item is T => Boolean(item));
}

/** Danh sách loại xuất chuẩn cho phiếu xuất tổng hợp. */
export const LOAI_XUAT_OPTIONS = [
  'Xuất kho cho máy theo phiếu tỷ lệ trộn',
  'Xuất cho trả lại Nhà cung cấp (hàng không đúng quy cách, chất lượng)',
  'Xuất phế băm cho máy tạo hạt',
  'Xuất phế cái cho máy băm',
  'Xuất khác'
] as const;

export const LOAI_XUAT_MAY_PTDM = LOAI_XUAT_OPTIONS[0];
export const LOAI_XUAT_TRA_NCC = LOAI_XUAT_OPTIONS[1];
export const LOAI_XUAT_PHE_BAM = LOAI_XUAT_OPTIONS[2];
export const LOAI_XUAT_PHE_CAI = LOAI_XUAT_OPTIONS[3];

function foldLoai(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nơi hàng xuất đến, suy từ loại xuất. `flex` = kho hoặc máy (Xuất khác / loại tự gõ). */
export function xuatDenKind(loaiXuat: string): 'may-ptdm' | 'ncc' | 'may' | 'flex' {
  const value = String(loaiXuat || '').trim();
  const folded = foldLoai(value);
  if (value === LOAI_XUAT_MAY_PTDM || folded.includes('phieu ty le tron')) return 'may-ptdm';
  if (value === LOAI_XUAT_TRA_NCC || (folded.includes('tra lai') && folded.includes('nha cung cap'))) return 'ncc';
  if (value === LOAI_XUAT_PHE_BAM || value === LOAI_XUAT_PHE_CAI || folded.includes('phe bam') || folded.includes('phe cai')) return 'may';
  return 'flex';
}

/** Danh sách loại nhập chuẩn cho phiếu nhập tổng hợp (cho gõ tay thêm khi cần). */
export const LOAI_NHAP_OPTIONS = [
  'Nhập kho từ Nhà cung cấp',
  'Nhập lại từ máy giữa đợt',
  'Nhập lại từ máy cuối đợt',
  'Nhập phế của các máy sóng, rỗng, đặc, tạo hạt',
  'Nhập thành phẩm từ máy tạo hạt, máy băm',
  'Nhập lại phế băm xuất cho máy tạo hạt (khi chưa tạo hạt xong)',
  'Nhập thành phẩm từ máy băm',
  'Nhập lại phế cái xuất cho máy băm (khi chưa băm xong)',
  'Nhập khác'
];
