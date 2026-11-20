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
  /** Đợt SX (phiếu liên quan sản xuất). */
  dot_san_xuat_id?: string | null;
  dot_so?: string | null;
  /**
   * Loại sản xuất (Đặc | Sóng | Rỗng) — cột DB vẫn `phan_xuong`.
   * Phiếu cũ «Xuất theo phân xưởng» cũng đọc từ đây.
   */
  phan_xuong?: string | null;
  /** Phiếu xuất gốc khi nhập lại giữa/cuối đợt. */
  phieu_xuat_goc_id?: string | null;
  phieu_xuat_goc_ma?: string | null;
};

let pendingEdit: TongHopHeader | null = null;
let pendingView: TongHopHeader | null = null;
let pendingProcess: { processId?: string; stepId?: string } | null = null;

export function queueTongHopProcess(opts: { processId?: string; stepId?: string }) {
  pendingProcess = opts;
}

export function takePendingTongHopProcess() {
  const row = pendingProcess;
  pendingProcess = null;
  return row;
}

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
export const LOAI_XUAT_MAY_PTDM = 'Xuất kho cho máy theo phiếu tỷ lệ trộn';
/** Xuất NVL trực tiếp đến máy, không bắt buộc chọn phiếu tỷ lệ trộn. */
export const LOAI_XUAT_MAY = 'Xuất theo máy';
/** Xuất NVL lên máy theo phân xưởng Đặc / Sóng / Rỗng (không bắt buộc PTĐM). */
export const LOAI_XUAT_PHAN_XUONG = 'Xuất theo phân xưởng';
export const LOAI_XUAT_TRA_NCC = 'Xuất cho trả lại Nhà cung cấp (hàng không đúng quy cách, chất lượng)';
export const LOAI_XUAT_PHE_BAM = 'Xuất phế băm cho máy tạo hạt';
export const LOAI_XUAT_PHE_CAI = 'Xuất phế cái cho máy băm';
export const LOAI_XUAT_KHAC = 'Xuất khác';

/** Loại xuất hiện trên form mới (ẩn «Xuất theo phân xưởng»). */
export const LOAI_XUAT_OPTIONS = [
  LOAI_XUAT_MAY_PTDM,
  LOAI_XUAT_MAY,
  LOAI_XUAT_TRA_NCC,
  LOAI_XUAT_PHE_BAM,
  LOAI_XUAT_PHE_CAI,
  LOAI_XUAT_KHAC
] as const;

/** Toàn bộ loại xuất (kể cả deprecated) — đọc phiếu cũ. */
export const LOAI_XUAT_OPTIONS_ALL = [
  ...LOAI_XUAT_OPTIONS,
  LOAI_XUAT_PHAN_XUONG
] as const;

function foldLoai(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nơi hàng xuất đến, suy từ loại xuất. `flex` = kho hoặc máy (Xuất khác / loại tự gõ). `phan-xuong` = Đặc/Sóng/Rỗng (không chọn máy). */
export function xuatDenKind(loaiXuat: string): 'may-ptdm' | 'ncc' | 'may' | 'phan-xuong' | 'flex' {
  const value = String(loaiXuat || '').trim();
  const folded = foldLoai(value);
  if (value === LOAI_XUAT_MAY_PTDM || folded.includes('phieu ty le tron')) return 'may-ptdm';
  if (value === LOAI_XUAT_MAY || folded === 'xuat theo may') return 'may';
  if (value === LOAI_XUAT_TRA_NCC || (folded.includes('tra lai') && folded.includes('nha cung cap'))) return 'ncc';
  if (value === LOAI_XUAT_PHAN_XUONG || folded.includes('theo phan xuong')) return 'phan-xuong';
  if (
    value === LOAI_XUAT_PHE_BAM ||
    value === LOAI_XUAT_PHE_CAI ||
    folded.includes('phe bam') ||
    folded.includes('phe cai')
  ) {
    return 'may';
  }
  return 'flex';
}

/** Giá trị Đặc/Sóng/Rỗng — UI gọi «Loại sản xuất», cột DB `phan_xuong`. */
export const PHAN_XUONG_OPTIONS = ['Đặc', 'Sóng', 'Rỗng'] as const;
export type PhanXuong = (typeof PHAN_XUONG_OPTIONS)[number];
export const LOAI_SAN_XUAT_OPTIONS = PHAN_XUONG_OPTIONS;
export type LoaiSanXuat = PhanXuong;
export const LOAI_SAN_XUAT_LABEL = 'Loại sản xuất';

/** Đợt sản xuất cố định trên phiếu SX: Đợt 1 … Đợt 10 (lưu `dot_so` = "1"…"10"). */
export const DOT_SAN_XUAT_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));

/** Chuẩn hóa snapshot đợt về "1"…"10" (chấp nhận "Đợt 3", "3", …). */
export function normalizeDotSo(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/(\d{1,2})/);
  if (!match) return '';
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 1 || n > 10) return '';
  return String(n);
}

export function formatDotSoLabel(dotSo: string) {
  const n = normalizeDotSo(dotSo);
  return n ? `Đợt ${n}` : '';
}

/** Lọc máy theo phân xưởng (Đặc / Sóng / Rỗng) dựa trên mã/tên máy. */
export function machineMatchesPhanXuong(machineLabel: string, phanXuong: string) {
  const px = String(phanXuong || '').trim();
  if (!px) return true;
  const folded = machineLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  if (px === 'Đặc') return folded.includes('dac') || /\bst\b|std0|dac/.test(folded);
  if (px === 'Sóng') return folded.includes('song') || folded.includes('sts');
  if (px === 'Rỗng') return folded.includes('rong') || folded.includes('ecr');
  return true;
}

export function isSxRelatedLoaiNhap(loaiNhap: string) {
  const folded = foldLoai(loaiNhap);
  return (
    folded.includes('nhap lai') ||
    folded.includes('phe') ||
    folded.includes('tao hat') ||
    folded.includes('may bam') ||
    folded.includes('giua dot') ||
    folded.includes('cuoi dot')
  );
}

export function isNhapLaiTheoPhanXuong(loaiNhap: string) {
  return foldLoai(loaiNhap).includes('nhap lai theo phan xuong');
}

export function getMachinesForInboundWorkshop(phanXuong: string) {
  if (phanXuong === 'Đặc') return ['Máy Đặc 1', 'Máy Sóng 1'];
  if (phanXuong === 'Sóng') return ['Máy Sóng 2', 'Máy Sóng 1'];
  if (phanXuong === 'Rỗng') return ['Máy Rỗng'];
  return [];
}

export function isSxRelatedLoaiXuat(loaiXuat: string) {
  const kind = xuatDenKind(loaiXuat);
  return kind === 'may' || kind === 'may-ptdm' || kind === 'phan-xuong';
}

/** Chỉ loại xuất này mới hiện / bắt buộc ô Phân xưởng. */
export function isXuatTheoPhanXuong(loaiXuat: string) {
  const value = String(loaiXuat || '').trim();
  if (value === LOAI_XUAT_PHAN_XUONG) return true;
  return foldLoai(value).includes('theo phan xuong');
}

/** Loại nhập hiện trên form mới (ẩn «Nhập lại theo phân xưởng»). */
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

export const LOAI_NHAP_THEO_PHAN_XUONG_DEPRECATED = 'Nhập lại theo phân xưởng';

/** Phiếu cần chọn Loại sản xuất (Đặc/Sóng/Rỗng) khi có máy. */
export function needsLoaiSanXuat(mode: TongHopMode, loaiNhap: string, loaiXuat: string) {
  if (mode === 'xuat') return isSxRelatedLoaiXuat(loaiXuat);
  return isSxRelatedLoaiNhap(loaiNhap) || isNhapLaiTheoPhanXuong(loaiNhap);
}
