/**
 * Phiếu nhập / xuất tổng hợp.
 * Header không có tên kho chung. Kho hoặc máy nằm trên từng dòng / đích.
 * Ghi vế vào phieu_nhap_kho / phieu_xuat_kho. ten_kho không bao giờ là tên máy.
 */
import type { Express } from 'express';

type ChiPhiKemTheo = { ten: string; don_gia: number; thanh_tien: number };

type SlipLine = {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  chi_phi_kem_theo?: ChiPhiKemTheo[];
  materialClass: 'nvl_chinh' | 'nvl_phu' | 'chua_phan_loai';
  documentQuantity?: number;
  weightKg?: number;
  machine?: string;
  productionName?: string;
  nhomVthh?: string;
  tonDauCaMay?: number;
  actualWeightImageUrl?: string;
  actualWeightImagePublicId?: string;
  sourceInboundLineId?: string;
  sourceInboundSlipCode?: string;
};

type DetailLine = {
  ma_hang: string;
  ten_hang: string;
  don_vi: string;
  so_luong: number;
  don_gia: number;
  thanh_tien: number;
  /** Chi phí kèm theo, độc lập với don_gia/thanh_tien của dòng. */
  chi_phi_kem_theo: ChiPhiKemTheo[];
  quy_doi_kg: number | null;
  /** Tên NVL sản xuất (snapshot từng dòng, tra kho_nvl theo mã khi thiếu). */
  ten_nvl_sx: string;
  /** Nhập: kho hoặc nhà cung cấp lấy hàng (header). Xuất: nguồn riêng từng dòng (mới)
   *  hoặc kho lấy hàng ra (cũ, phiếu trước bản nguồn-dòng). */
  nguon_dong_loai: '' | 'kho' | 'may' | 'ncc';
  nguon_dong_id: string;
  nguon_dong_ten: string;
  /** Xuất kiểu mới: nguồn riêng từng dòng (ghi đè nguon_dong_* sau resolve). */
  src_loai?: string;
  src_id?: string;
  src_ten?: string;
  /** Ngày / ca riêng từng dòng (trống = theo ngày-ca header). */
  ngay_dong?: string;
  ca_dong?: string;
  /** Tồn đầu ca từng dòng (tham chiếu sổ trộn, sửa tay được). */
  ton_dau_ca?: number | null;
  /** Kho nhận hàng (nhập: kho đích trên header, copy xuống dòng). */
  kho_dong_id: string;
  kho_dong_ten: string;
  kho_dong_ma: string | null;
  kho_dong_vat_tu: boolean;
  /** Xuất: nơi xuất đến (giữ nguyên từ payload để không lẫn với hack cũ). */
  dich_dong_loai?: string;
  dich_dong_id?: string;
  /** Phân loại NVL trên lưới xuất (nvl_chinh / nvl_phu / chua_phan_loai). */
  phan_loai_nvl?: string;
  /** SL chứng từ (định mức), khác SL thực ở so_luong. */
  so_luong_ct?: number | null;
  nhom_vthh?: string;
  norm_kg_per_unit?: number | null;
  link_anh_can_thuc_te?: string;
  link_anh_can_thuc_te_public_id?: string;
};

/** Nguồn từng dòng của phiếu xuất: ưu tiên src_* (kiểu mới), null = dùng nguồn header (kiểu cũ). */
function xuatLineSrcOf(line: DetailLine): { loai: 'kho' | 'may'; id: string } | null {
  const kind = text(line.src_loai).toLowerCase();
  const id = text(line.src_id || line.src_ten);
  if ((kind === 'kho' || kind === 'may') && id) return { loai: kind, id };
  return null;
}

/** Đích từng dòng của phiếu xuất: ưu tiên dich_* (kiểu mới), fallback hack cũ + kho_dong. */
function xuatLineDestOf(line: DetailLine): { loai: 'kho' | 'may' | 'ncc'; id: string } {
  const kind = text(line.dich_dong_loai).toLowerCase();
  const id = text(line.dich_dong_id);
  if ((kind === 'kho' || kind === 'may' || kind === 'ncc') && id) return { loai: kind, id };
  if (line.nguon_dong_loai === 'may' && line.nguon_dong_id) {
    return { loai: 'may', id: line.nguon_dong_id };
  }
  return { loai: 'kho', id: line.kho_dong_id };
}

function materialClassOf(value: unknown): 'nvl_chinh' | 'nvl_phu' | 'chua_phan_loai' {
  const raw = text(value).toLowerCase();
  if (raw === 'nvl_chinh' || raw === 'nvl_phu') return raw;
  return 'chua_phan_loai';
}

/** Map mã/loại NVL (kể cả nhãn tiếng Việt) về phan_loai kho_nvl. Không phân loại được = null. */
function nvlCatalogPhanLoaiLabel(value: unknown): string | null {
  const normalized = text(value)
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[\s-]+/g, '_');
  if (normalized === 'nvl_phu' || normalized.includes('nguyen_vat_lieu_phu')) return 'Nguyên vật liệu phụ';
  if (normalized === 'nvl_chinh' || normalized.includes('nguyen_vat_lieu_chinh')) return 'Nguyên vật liệu chính';
  return null;
}

type Party = { loai: 'kho' | 'may' | 'ncc'; id: string; ten: string; maKho: string | null; vatTu: boolean };

type ParsedHeader = {
  loai: 'nhap' | 'xuat';
  ngay: string;
  ca: string | null;
  caList: string[];
  nguon: Party | null;
  dich: Party;
  loaiNhap: string | null;
  loaiXuat: string | null;
  nguoiLap: string | null;
  nguoiGiao: string | null;
  diaDiem: string | null;
  lyDo: string | null;
  ghiChu: string | null;
  lines: DetailLine[];
  catalog: 'nvl' | 'san_pham';
  /** Hủy: chỉ ghi vế xuất, không nhập lại nơi đến. */
  skipInbound?: boolean;
};

export type TongHopRouteDeps = {
  supabase: { from: (table: string) => any } | null;
  tables: {
    header: string;
    warehouses: string;
    suppliers: string;
    machines: string;
    materials: string;
    nhapKho: string;
    history: string;
  };
  parseDate: (value: unknown) => string | null;
  isVatTuKho: (name: unknown) => boolean;
  resolveMaKho: (tenKho: unknown, fallback?: string) => Promise<string>;
  buildSlipRecords: (parsed: any, maPhieu: string) => Array<Record<string, unknown>>;
  insertSlipRecords: (
    table: string,
    records: Array<Record<string, unknown>>
  ) => Promise<{ data: any[] | null; error: { message?: string } | null }>;
  deleteSlip: (maPhieu: string) => Promise<{ error: { message?: string } | null }>;
  writeTable: (loai: 'nhap' | 'xuat') => Promise<string>;
  readTables: (loai: 'nhap' | 'xuat' | null) => Promise<string[]>;
  insertHistory: (entry: {
    maPhieu: string;
    loaiPhieu: string;
    loaiKho: string;
    ngayPhieu: string | null;
    ca: string | null;
    nguoiSua: string | null;
    snapshotCu: unknown[];
    snapshotMoi: unknown[];
  }) => Promise<void>;
  insertNhapKho: (rows: Array<Record<string, unknown>>) => Promise<{ saved: boolean; error?: string }>;
  /** Đã có bộ mã + tên + tên sản xuất + kho thì bỏ qua; thiếu thì thêm dòng kho_nvl. */
  ensureKhoNvlCatalog: (
    lines: Array<{ code: string; name: string; productionName?: string; unit: string; materialClass?: string; phanLoai?: string }>,
    tenKho: string
  ) => Promise<{ ensured: number; skipped: number; error?: string }>;
  attachLiveKhoNvlIds: <T extends Record<string, unknown>>(
    records: T[],
    lines: Array<{ code: string; name: string; productionName?: string; unit: string; materialClass?: string; phanLoai?: string }>,
    tenKho: string
  ) => Promise<{ records: T[]; ensured: number; skipped: number; error?: string }>;
  liveKhoNvlIds: (code: string, tenKho: string) => Promise<Set<string>>;
  slipsHaveCatalogStamp: () => Promise<boolean>;
  isMissingTable: (error: { message?: string; code?: string } | null) => boolean;
  isMissingColumn: (error: { message?: string; code?: string } | null) => boolean;
  newSlipCode: (loai: 'nhap' | 'xuat') => string;
  normalizeKho: (name: unknown) => string;
};

const SELECT =
  'id, ma_phieu_chung, loai, ngay, kho_dich, nguon_loai, nguon_id, dich_loai, dich_id, ca, loai_nhap, loai_xuat, chi_tiet, ma_phieu_nhap, ma_phieu_xuat, ma_phieu_nhap_huy, ma_phieu_xuat_huy, trang_thai, nguoi_lap, nguoi_giao, dia_diem, ly_do, ghi_chu, created_at, updated_at';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

/** Đọc số theo chuẩn mới `1,250,000.5`, vẫn chịu được số cũ `1.250.000,5`. */
function parseLocalizedNumber(value: unknown): number {
  const text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return NaN;
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let normalized = text;
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      const parts = text.replace(/\./g, '').split(',');
      const dec = parts.pop() as string;
      normalized = `${parts.join('')}.${dec}`;
    } else {
      const parts = text.replace(/,/g, '').split('.');
      const dec = parts.pop() as string;
      normalized = parts.length ? `${parts.join('')}.${dec}` : `0.${dec}`;
    }
  } else if (lastComma >= 0) {
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, '') : text.replace(/,/g, '.');
  } else if ((text.match(/\./g) || []).length > 1) {
    normalized = text.replace(/\./g, '');
  }
  return Number(normalized);
}

/** Thành tiền kèm theo do user nhập, không suy từ đơn giá. Thiếu mảng = []. */
function parseChiPhiKemTheo(
  raw: unknown,
  lineNo: number,
  ma: string
): { error: string } | { items: ChiPhiKemTheo[] } {
  if (raw == null || raw === '') return { items: [] };
  const list = Array.isArray(raw) ? raw : null;
  if (!list) return { error: `Dòng ${lineNo} (${ma}): chi phí kèm theo không hợp lệ.` };
  if (list.length > 50) return { error: `Dòng ${lineNo} (${ma}): tối đa 50 khoản chi phí kèm theo.` };
  const items: ChiPhiKemTheo[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const row = (list[index] && typeof list[index] === 'object' ? list[index] : {}) as Record<string, unknown>;
    const ten = text(row.ten ?? row.name).slice(0, 120);
    const donRaw = row.don_gia ?? row.donGia ?? row.unitPrice;
    const tienRaw = row.thanh_tien ?? row.thanhTien ?? row.lineAmount;
    const blank =
      !ten &&
      String(donRaw ?? '').trim() === '' &&
      String(tienRaw ?? '').trim() === '';
    if (blank) continue;
    if (!ten) return { error: `Dòng ${lineNo} (${ma}), khoản ${index + 1}: thiếu tên chi phí.` };
    const donGia = parseLocalizedNumber(donRaw ?? 0);
    const thanhTien = parseLocalizedNumber(tienRaw ?? 0);
    if (!Number.isFinite(donGia) || donGia < 0) {
      return { error: `Dòng ${lineNo} (${ma}), khoản ${index + 1}: đơn giá phải lớn hơn hoặc bằng 0.` };
    }
    if (!Number.isFinite(thanhTien) || thanhTien < 0) {
      return { error: `Dòng ${lineNo} (${ma}), khoản ${index + 1}: thành tiền phải lớn hơn hoặc bằng 0.` };
    }
    items.push({ ten, don_gia: round3(donGia), thanh_tien: round3(thanhTien) });
  }
  return { items };
}

function slipItems(lines: DetailLine[], machine?: string): SlipLine[] {
  return lines.map(line => ({
    code: line.ma_hang,
    name: line.ten_hang,
    unit: line.don_vi || '',
    quantity: line.so_luong,
    unitPrice: line.don_gia,
    lineAmount: line.thanh_tien,
    chi_phi_kem_theo: line.chi_phi_kem_theo || [],
    materialClass: materialClassOf(line.phan_loai_nvl),
    ...(Number.isFinite(Number(line.so_luong_ct)) && Number(line.so_luong_ct) > 0
      ? { documentQuantity: Number(line.so_luong_ct) }
      : {}),
    ...(line.quy_doi_kg && line.quy_doi_kg > 0 ? { weightKg: line.quy_doi_kg } : {}),
    ...(machine ? { machine } : {}),
    ...(text(line.nhom_vthh) ? { nhomVthh: text(line.nhom_vthh) } : {}),
    // Snapshot tên SX + tồn đầu ca xuống vế phiếu (server ghi resilient, thiếu cột thì bỏ qua).
    ...(text(line.ten_nvl_sx) ? { productionName: text(line.ten_nvl_sx) } : {}),
    ...(Number.isFinite(Number(line.ton_dau_ca)) ? { tonDauCaMay: Number(line.ton_dau_ca) } : {}),
    ...(text(line.link_anh_can_thuc_te) ? { actualWeightImageUrl: text(line.link_anh_can_thuc_te) } : {}),
    ...(text(line.link_anh_can_thuc_te_public_id)
      ? { actualWeightImagePublicId: text(line.link_anh_can_thuc_te_public_id) }
      : {})
  }));
}

export function registerXuatNhapTongHopRoutes(app: Express, deps: TongHopRouteDeps) {
  const tableMissing = (error: { message?: string } | null | undefined) =>
    `Bảng phieu_nhap_xuat_tong_hop chưa sẵn sàng. Hãy chạy supabase-phieu-nhap-xuat-tong-hop.sql. ${error?.message || ''}`.trim();

  async function loadParty(loai: string, id: string): Promise<Party | { error: string }> {
    const kind = text(loai).toLowerCase();
    const key = text(id);
    if (!deps.supabase) return { error: 'Supabase chưa được cấu hình.' };
    if (kind === 'kho') {
      if (!key) return { error: 'Thiếu kho.' };
      const { data, error } = await deps.supabase
        .from(deps.tables.warehouses)
        .select('ten_kho, ma_kho')
        .limit(5000);
      if (error) return { error: error.message || 'Không tải được danh mục kho.' };
      const row = ((data || []) as Array<Record<string, unknown>>).find(item => {
        const name = text(item.ten_kho);
        return name === key || deps.normalizeKho(name) === deps.normalizeKho(key);
      });
      if (!row) return { error: `Kho "${key}" không có trong quản lý kho.` };
      const ten = text(row.ten_kho);
      return {
        loai: 'kho',
        id: ten,
        ten,
        maKho: text(row.ma_kho) || (await deps.resolveMaKho(ten, deps.isVatTuKho(ten) ? 'kho_nvl' : 'kho_thanh_pham')),
        vatTu: deps.isVatTuKho(ten)
      };
    }
    if (kind === 'may') {
      if (!key) return { error: 'Thiếu máy.' };
      const { data, error } = await deps.supabase
        .from(deps.tables.machines)
        .select('ma_may, ten_may')
        .limit(5000);
      if (error) return { error: error.message || 'Không tải được danh sách máy.' };
      const row = ((data || []) as Array<Record<string, unknown>>).find(item => {
        const code = text(item.ma_may);
        const name = text(item.ten_may);
        return code === key || name === key;
      });
      if (!row) return { error: `Máy "${key}" không có trong danh sách máy.` };
      return { loai: 'may', id: text(row.ma_may), ten: text(row.ten_may) || text(row.ma_may), maKho: null, vatTu: true };
    }
    if (kind === 'ncc') {
      if (!key) return { error: 'Thiếu nhà cung cấp.' };
      const { data, error } = await deps.supabase
        .from(deps.tables.suppliers)
        .select('id, ma_nha_cung_cap, ten_nha_cung_cap')
        .limit(20000);
      if (error) return { error: error.message || 'Không tải được nhà cung cấp.' };
      const row = ((data || []) as Array<Record<string, unknown>>).find(item => {
        return text(item.id) === key || text(item.ma_nha_cung_cap) === key || text(item.ten_nha_cung_cap) === key;
      });
      if (!row) return { error: `Nhà cung cấp "${key}" không tồn tại.` };
      const idValue = text(row.ma_nha_cung_cap) || text(row.id);
      return { loai: 'ncc', id: idValue, ten: text(row.ten_nha_cung_cap) || idValue, maKho: null, vatTu: true };
    }
    if (!kind) return { error: 'Chưa chọn nguồn. Hãy chọn kho, máy hoặc nhà cung cấp.' };
    return { error: `Loại nguồn "${kind}" không hợp lệ. Chỉ nhận kho, máy hoặc nhà cung cấp.` };
  }

  function parseLines(raw: unknown, loai: 'nhap' | 'xuat'): { error: string } | { lines: DetailLine[] } {
    if (!Array.isArray(raw) || raw.length === 0) return { error: 'Phiếu phải có ít nhất 1 dòng.' };
    const lines: DetailLine[] = [];
    for (let index = 0; index < raw.length; index += 1) {
      const item = (raw[index] && typeof raw[index] === 'object' ? raw[index] : {}) as Record<string, unknown>;
      const ma = text(item.ma_hang ?? item.maHang ?? item.code);
      if (!ma) return { error: `Dòng ${index + 1}: thiếu mã.` };
      const qty = parseLocalizedNumber(item.so_luong ?? item.soLuong ?? item.quantity ?? '');
      if (!Number.isFinite(qty) || qty <= 0) return { error: `Dòng ${index + 1} (${ma}): số lượng phải lớn hơn 0.` };
      const price = parseLocalizedNumber(item.don_gia ?? item.donGia ?? item.unitPrice ?? 0);
      const donGia = Number.isFinite(price) && price >= 0 ? price : 0;
      const quyDoiRaw = parseLocalizedNumber(item.quy_doi_kg ?? item.quyDoiKg ?? item.weightKg ?? '');
      const quyDoi = Number.isFinite(quyDoiRaw) && quyDoiRaw > 0 ? round3(quyDoiRaw) : null;
      const nguonDongLoaiRaw = text(item.nguon_dong_loai ?? item.nguonDongLoai).toLowerCase();
      const nguonDongId = text(item.nguon_dong_id ?? item.nguonDongId ?? item.kho_nguon ?? item.khoNguon ?? item.kho);
      const khoNhap = text(item.kho_dong ?? item.khoDong ?? item.kho_dich ?? item.khoDich);
      if (loai === 'nhap' && !khoNhap) return { error: `Dòng ${index + 1}: chọn kho nhập.` };
      const dichDongLoai = text(item.dich_dong_loai ?? item.dichDongLoai).toLowerCase() || (loai === 'xuat' ? nguonDongLoaiRaw : '');
      const dichDongId = text(item.dich_dong_id ?? item.dichDongId) || (loai === 'xuat' ? nguonDongId || khoNhap : '');
      if (loai === 'xuat') {
        if (dichDongLoai !== 'kho' && dichDongLoai !== 'may' && dichDongLoai !== 'ncc') {
          return { error: `Dòng ${index + 1}: chọn kho, máy hoặc nhà cung cấp xuất đến.` };
        }
        if (!dichDongId) return { error: `Dòng ${index + 1}: chọn nơi xuất đến.` };
      }
      const classRaw = text(item.phan_loai_nvl ?? item.phanLoaiNvl ?? item.warehouseClass);
      const slCtRaw = parseLocalizedNumber(item.so_luong_ct ?? item.soLuongCt ?? item.documentQuantity ?? '');
      const normRaw = parseLocalizedNumber(item.norm_kg_per_unit ?? item.normKgPerUnit ?? '');
      const imageUrl = text(item.link_anh_can_thuc_te ?? item.linkAnhCanThucTe ?? item.actualWeightImageUrl);
      const imageId = text(
        item.link_anh_can_thuc_te_public_id ?? item.linkAnhCanThucTePublicId ?? item.actualWeightImagePublicId
      );
      const tenNvlSx = text(
        item.ten_nvl_sx ?? item.tenNvlSx ?? item.ten_san_xuat ?? item.tenSanXuat ?? item.productionName
      );
      const srcLoai = text(item.src_loai ?? item.srcLoai).toLowerCase();
      const srcId = text(item.src_id ?? item.srcId ?? item.src_ten ?? item.srcTen);
      const ngayDong = text(item.ngay_dong ?? item.ngayDong).slice(0, 10);
      const caDong = text(item.ca_dong ?? item.caDong);
      const tonDauRaw = parseLocalizedNumber(item.ton_dau_ca ?? item.tonDauCa ?? '');
      const kem = parseChiPhiKemTheo(item.chi_phi_kem_theo ?? item.chiPhiKemTheo, index + 1, ma);
      if ('error' in kem) return kem;
      lines.push({
        ma_hang: ma,
        ten_hang: text(item.ten_hang ?? item.tenHang ?? item.name),
        ten_nvl_sx: tenNvlSx,
        don_vi: text(item.don_vi ?? item.donVi ?? item.unit),
        so_luong: round3(qty),
        don_gia: donGia,
        thanh_tien: round3(qty * donGia),
        chi_phi_kem_theo: kem.items,
        quy_doi_kg: quyDoi,
        // Nguồn riêng từng dòng (phiếu xuất kiểu mới). Kiểu cũ không gửi 2 key này.
        ...(srcLoai === 'kho' || srcLoai === 'may' ? { src_loai: srcLoai } : {}),
        ...(srcId ? { src_id: srcId } : {}),
        ...(text(item.src_ten ?? item.srcTen) ? { src_ten: text(item.src_ten ?? item.srcTen) } : {}),
        ...(ngayDong ? { ngay_dong: ngayDong } : {}),
        ...(caDong ? { ca_dong: caDong } : {}),
        ...(Number.isFinite(tonDauRaw) ? { ton_dau_ca: round3(tonDauRaw) } : {}),
        nguon_dong_loai: loai === 'xuat' && dichDongLoai === 'may' ? 'may' : '',
        nguon_dong_id: loai === 'xuat' && dichDongLoai === 'may' ? dichDongId : '',
        nguon_dong_ten: loai === 'xuat' && dichDongLoai === 'may' ? dichDongId : '',
        // Giữ đích tường minh (kiểu mới đọc đích từ đây, không lẫn hack cũ).
        ...(loai === 'xuat' && dichDongLoai ? { dich_dong_loai: dichDongLoai } : {}),
        ...(loai === 'xuat' && dichDongId ? { dich_dong_id: dichDongId } : {}),
        ...(classRaw ? { phan_loai_nvl: materialClassOf(classRaw) } : {}),
        ...(Number.isFinite(slCtRaw) && slCtRaw > 0 ? { so_luong_ct: round3(slCtRaw) } : {}),
        ...(text(item.nhom_vthh ?? item.nhomVthh) ? { nhom_vthh: text(item.nhom_vthh ?? item.nhomVthh) } : {}),
        ...(Number.isFinite(normRaw) && normRaw > 0 ? { norm_kg_per_unit: normRaw } : {}),
        ...(imageUrl ? { link_anh_can_thuc_te: imageUrl } : {}),
        ...(imageId ? { link_anh_can_thuc_te_public_id: imageId } : {}),
        kho_dong_id: loai === 'nhap' ? khoNhap : loai === 'xuat' && dichDongLoai === 'kho' ? dichDongId : '',
        kho_dong_ten: loai === 'nhap' ? khoNhap : loai === 'xuat' && dichDongLoai === 'kho' ? dichDongId : '',
        kho_dong_ma: null,
        kho_dong_vat_tu: false
      });
    }
    return { lines };
  }

  async function parseBody(body: unknown): Promise<{ error: string } | { header: ParsedHeader }> {
    const source = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const loaiRaw = text(source.loai ?? source.loaiPhieu).toLowerCase();
    if (loaiRaw !== 'nhap' && loaiRaw !== 'xuat') return { error: 'Loại phiếu phải là nhập hoặc xuất.' };
    const loai = loaiRaw as 'nhap' | 'xuat';
    const ngay = deps.parseDate(source.ngay ?? source.ngayPhieu);
    if (!ngay) return { error: 'Vui lòng chọn ngày phiếu hợp lệ.' };
    const caRaw = source.caList ?? source.ca_list ?? source.ca;
    const caList = (Array.isArray(caRaw) ? caRaw : String(caRaw ?? '').split(/[,;+]/))
      .map(item => text(item))
      .filter((item, index, all) => item && all.indexOf(item) === index);
    const ca = caList.length ? caList.join(', ') : null;
    let nguon: Party | null = null;
    let dich: Party | null = null;
    if (loai === 'nhap') {
      const kind = text(source.nguon_loai ?? source.nguonLoai);
      const id = text(source.nguon_id ?? source.nguonId);
      if (kind && id) {
        const loaded = await loadParty(kind, id);
        if ('error' in loaded) return { error: loaded.error };
        if (loaded.loai === 'may') return { error: 'Nguồn nhập là kho hoặc nhà cung cấp.' };
        nguon = loaded;
      }
    } else {
      // Phiếu xuất kiểu mới: nguồn nằm trên từng dòng (src_*), header được phép trống.
      // Kiểu cũ: nguồn chung ở header (nguon_loai/nguon_id).
      const headerSrcKind = text(source.nguon_loai ?? source.nguonLoai ?? source.dich_loai ?? source.dichLoai);
      const headerSrcId = text(source.nguon_id ?? source.nguonId ?? source.dich_id ?? source.dichId);
      if (headerSrcKind || headerSrcId) {
        const loaded = await loadParty(headerSrcKind, headerSrcId);
        if ('error' in loaded) return { error: loaded.error };
        if (loaded.loai === 'ncc') return { error: 'Nguồn xuất là kho hoặc máy.' };
        nguon = loaded;
      }
    }
    const parsedLines = parseLines(source.lines ?? source.chi_tiet, loai);
    if ('error' in parsedLines) return parsedLines;
    for (const line of parsedLines.lines) {
      if (loai === 'nhap') {
        const kho = await loadParty('kho', line.kho_dong_id);
        if ('error' in kho) return { error: kho.error };
        line.kho_dong_id = kho.id;
        line.kho_dong_ten = kho.ten;
        line.kho_dong_ma = kho.maKho;
        line.kho_dong_vat_tu = kho.vatTu;
        if (nguon) {
          const sourceNvl = nguon.loai === 'ncc' || nguon.vatTu;
          if (sourceNvl !== kho.vatTu) {
            return { error: `Dòng ${line.ma_hang}: kho nhập phải cùng loại với nguồn nhập.` };
          }
          if (nguon.loai === 'kho' && deps.normalizeKho(nguon.ten) === deps.normalizeKho(kho.ten)) {
            return { error: `Dòng ${line.ma_hang}: kho nguồn và kho nhập phải khác nhau.` };
          }
        }
      } else if (loai === 'xuat') {
        // Nguồn riêng từng dòng (src_* kiểu mới) hoặc nguồn header (kiểu cũ).
        const partyCache = new Map<string, Party>();
        const loadCached = async (kind: string, id: string): Promise<Party> => {
          const key = `${kind}|${id}`.toLowerCase();
          const hit = partyCache.get(key);
          if (hit) return hit;
          const loaded = await loadParty(kind, id);
          if ('error' in loaded) throw new Error(loaded.error);
          if (loaded.loai === 'ncc') throw new Error('Nguồn xuất là kho hoặc máy.');
          partyCache.set(key, loaded);
          return loaded;
        };
        const lineSrcs: Party[] = [];
        let firstDest: Party | null = null;
        const catalogSet = new Set<'nvl' | 'san_pham'>();
        for (let li = 0; li < parsedLines.lines.length; li += 1) {
          const line = parsedLines.lines[li];
          const tag = `Dòng ${li + 1} (${line.ma_hang})`;
          const hinted = xuatLineSrcOf(line);
          let src: Party;
          try {
            if (hinted) src = await loadCached(hinted.loai, hinted.id);
            else if (nguon) src = nguon;
            else return { error: `${tag}: thiếu nguồn xuất.` };
          } catch (err: any) {
            return { error: `${tag}: ${err?.message || 'nguồn xuất không hợp lệ.'}` };
          }
          // Chuẩn hóa nguồn lên dòng để legs/stock/hủy đọc thống nhất.
          line.nguon_dong_loai = src.loai === 'may' ? 'may' : 'kho';
          line.nguon_dong_id = src.id;
          line.nguon_dong_ten = src.ten;
          const dest = xuatLineDestOf(line);
          let destParty: Party;
          try {
            if (dest.loai === 'ncc') {
              const loaded = await loadParty('ncc', dest.id);
              if ('error' in loaded) throw new Error(loaded.error);
              destParty = loaded;
            } else {
              destParty = await loadCached(dest.loai, dest.id);
            }
          } catch (err: any) {
            return { error: `${tag}: ${err?.message || 'nơi đến không hợp lệ.'}` };
          }
          const sourceNvl = src.loai === 'may' || src.vatTu;
          if (destParty.loai === 'ncc') {
            line.kho_dong_id = '';
            line.kho_dong_ten = '';
            line.kho_dong_ma = null;
            line.kho_dong_vat_tu = false;
            line.dich_dong_loai = 'ncc';
            line.dich_dong_id = destParty.id;
            if (!sourceNvl) return { error: `${tag}: trả nhà cung cấp chỉ xuất từ kho NVL.` };
          } else if (destParty.loai === 'may') {
            line.kho_dong_id = '';
            line.kho_dong_ten = '';
            line.kho_dong_ma = null;
            line.kho_dong_vat_tu = false;
            line.dich_dong_loai = 'may';
            line.dich_dong_id = destParty.id;
            if (!sourceNvl) return { error: 'Máy chỉ nhận NVL.' };
            if (src.loai === 'may' && src.id === destParty.id) {
              return { error: `${tag}: máy nguồn và máy đến phải khác nhau.` };
            }
          } else {
            line.kho_dong_id = destParty.id;
            line.kho_dong_ten = destParty.ten;
            line.kho_dong_ma = destParty.maKho;
            line.kho_dong_vat_tu = destParty.vatTu;
            line.dich_dong_loai = 'kho';
            line.dich_dong_id = destParty.id;
            if (sourceNvl !== destParty.vatTu) {
              return { error: `${tag}: nơi đến phải cùng loại với nguồn xuất.` };
            }
            if (src.loai === 'kho' && deps.normalizeKho(src.ten) === deps.normalizeKho(destParty.ten)) {
              return { error: `${tag}: kho nguồn và kho đến phải khác nhau.` };
            }
          }
          catalogSet.add(sourceNvl ? 'nvl' : 'san_pham');
          lineSrcs.push(src);
          if (!firstDest) firstDest = destParty;
        }
        if (catalogSet.size > 1) return { error: 'Một phiếu xuất chỉ dùng một loại hàng (NVL hoặc thành phẩm).' };
        const firstSrc = lineSrcs[0];
        // Header giữ nguồn chung khi đồng nhất (list/in tương thích), nhiều nguồn thì null.
        nguon = lineSrcs.every(s => s.loai === firstSrc.loai && s.id === firstSrc.id) ? firstSrc : null;
        (parsedLines as { xuatCatalog?: 'nvl' | 'san_pham' }).xuatCatalog = catalogSet.has('san_pham')
          ? 'san_pham'
          : 'nvl';
        (parsedLines as { xuatFirstDest?: Party }).xuatFirstDest = firstDest;
      }
    }
    if (loai === 'nhap') {
      const first = parsedLines.lines[0];
      if (!first?.kho_dong_id) return { error: 'Chọn kho nhập.' };
      dich = {
        loai: 'kho',
        id: first.kho_dong_id,
        ten: first.kho_dong_ten,
        maKho: first.kho_dong_ma,
        vatTu: first.kho_dong_vat_tu
      };
    }
    if (loai === 'xuat') {
      const stored = parsedLines as { xuatFirstDest?: Party };
      if (!stored.xuatFirstDest) return { error: 'Thiếu nơi xuất đến.' };
      dich = stored.xuatFirstDest;
    }
    if (!dich) return { error: 'Thiếu nơi xuất đến.' };
    const catalog: 'nvl' | 'san_pham' = loai === 'nhap'
      ? (!nguon || nguon.loai === 'ncc' || nguon.vatTu ? 'nvl' : 'san_pham')
      : ((parsedLines as { xuatCatalog?: 'nvl' | 'san_pham' }).xuatCatalog
        || (nguon?.loai === 'may' || nguon?.vatTu ? 'nvl' : 'san_pham'));
    if (dich.loai === 'may' && catalog !== 'nvl') return { error: 'Máy chỉ làm việc với NVL.' };
    return {
      header: {
        loai,
        ngay,
        ca,
        caList,
        nguon,
        dich,
        loaiNhap: loai === 'nhap' ? text(source.loai_nhap ?? source.loaiNhap).slice(0, 120) || null : null,
        loaiXuat: loai === 'xuat' ? text(source.loai_xuat ?? source.loaiXuat).slice(0, 200) || null : null,
        nguoiLap: text(source.nguoi_lap ?? source.nguoiLap) || null,
        nguoiGiao: text(source.nguoi_giao ?? source.nguoiGiao) || null,
        diaDiem: text(source.dia_diem ?? source.diaDiem) || null,
        lyDo: text(source.ly_do ?? source.lyDo) || null,
        ghiChu: text(source.ghi_chu ?? source.ghiChu) || null,
        lines: parsedLines.lines,
        catalog
      }
    };
  }

  async function stockOf(code: string, party: { loai: 'kho' | 'may'; id: string }, catalog: 'nvl' | 'san_pham') {
    if (!deps.supabase) return 0;
    const tables = await deps.readTables(null);
    const matchCatalogId = catalog === 'nvl' && party.loai === 'kho' && (await deps.slipsHaveCatalogStamp());
    const liveIds = matchCatalogId ? await deps.liveKhoNvlIds(code, party.id) : null;
    let ton = 0;
    for (const table of tables) {
      let query = deps.supabase
        .from(table)
        .select(
          matchCatalogId
            ? 'ma_npl, ma_sp, ten_kho, may, loai_phieu, so_luong, id_danh_muc, loai_danh_muc'
            : 'ma_npl, ma_sp, ten_kho, may, loai_phieu, so_luong'
        )
        .limit(20000);
      query = catalog === 'nvl' ? query.eq('ma_npl', code) : query.eq('ma_sp', code);
      const { data, error } = await query;
      if (error) {
        if (deps.isMissingTable(error) || deps.isMissingColumn(error)) continue;
        throw new Error(error.message || 'Không tính được tồn.');
      }
      for (const row of (data || []) as Array<Record<string, unknown>>) {
        const qty = Number(row.so_luong) || 0;
        const xuat = text(row.loai_phieu).toLowerCase() === 'xuat';
        const tenKho = text(row.ten_kho);
        const may = text(row.may);
        if (party.loai === 'kho') {
          if (matchCatalogId) {
            const catalogId = text(row.id_danh_muc);
            if (text(row.loai_danh_muc) !== 'kho_nvl' || !liveIds?.has(catalogId)) continue;
          } else if (deps.normalizeKho(tenKho) !== deps.normalizeKho(party.id)) {
            continue;
          }
          ton += xuat ? -qty : qty;
        } else if (may === party.id || may === party.id) {
          const inbound =
            (xuat && tenKho) || (!xuat && !tenKho);
          const outbound = (xuat && !tenKho) || (!xuat && tenKho);
          if (inbound) ton += qty;
          if (outbound) ton -= qty;
        }
      }
    }
    return round3(ton);
  }

  async function assertSourceStock(header: ParsedHeader, excludeCodes: string[]) {
    const groups = new Map<string, { party: { loai: 'kho' | 'may'; id: string }; qty: number; code: string }>();
    const sources: Array<{ party: { loai: 'kho' | 'may'; id: string }; code: string; qty: number }> = [];
    if (header.loai === 'nhap') {
      if (header.nguon?.loai === 'kho') {
        for (const line of header.lines) {
          sources.push({ party: { loai: 'kho', id: header.nguon.id }, code: line.ma_hang, qty: line.so_luong });
        }
      }
    } else {
      for (const line of header.lines) {
        // Nguồn riêng từng dòng (kiểu mới), fallback nguồn header (kiểu cũ).
        const hinted = xuatLineSrcOf(line);
        const kind = hinted?.loai
          || (header.nguon && header.nguon.loai !== 'ncc' ? header.nguon.loai : '');
        const id = hinted?.id || (header.nguon ? header.nguon.id : '');
        if ((kind === 'kho' || kind === 'may') && id) {
          sources.push({ party: { loai: kind, id }, code: line.ma_hang, qty: line.so_luong });
        }
      }
    }
    for (const row of sources) {
      const key = `${row.party.loai}|${row.party.id}|${row.code}`;
      const current = groups.get(key);
      if (current) current.qty = round3(current.qty + row.qty);
      else groups.set(key, { party: row.party, qty: row.qty, code: row.code });
    }
    for (const group of groups.values()) {
      let ton = await stockOf(group.code, group.party, header.catalog);
      if (excludeCodes.length) {
        /* tồn đã gồm phiếu đang sửa; phần trừ được hoàn khi xóa vế cũ trước khi ghi lại */
      }
      if (ton + 1e-9 < group.qty) {
        const where = group.party.loai === 'may' ? `máy ${group.party.id}` : group.party.id;
        throw new Error(`${where} chỉ còn ${ton} ${group.code} — không đủ xuất ${group.qty}.`);
      }
    }
  }

  /**
   * Xuất khỏi kho: KHÔNG tạo/sửa master kho_nvl — chỉ gắn id_danh_muc của dòng
   * đang sống. Tên / tên sản xuất không khớp kho nguồn thì lỗi, không tự sinh mã mới.
   */
  async function stampOutboundKhoNvlIds<T extends Record<string, unknown>>(
    records: T[],
    lines: Array<{ code: string; name: string; productionName?: string }>,
    tenKho: string
  ): Promise<T[]> {
    if (!deps.supabase) throw new Error('Supabase chưa được cấu hình.');
    const warehouse = text(tenKho);
    const codes = [...new Set(lines.map(line => text(line.code)).filter(Boolean))];
    const hits = new Map<string, string>();
    for (let index = 0; index < codes.length; index += 150) {
      const chunk = codes.slice(index, index + 150);
      const { data, error } = await deps.supabase
        .from(deps.tables.materials)
        .select('id, ma_npl, ten_npl, ten_nvl_sx, ten_kho')
        .in('ma_npl', chunk);
      if (error) throw new Error(error.message || 'Không đọc được danh mục kho_nvl.');
      for (const row of ((data || []) as Array<Record<string, unknown>>)) {
        const id = text(row.id);
        if (!id) continue;
        hits.set(
          [text(row.ma_npl), text(row.ten_npl), text(row.ten_nvl_sx), text(row.ten_kho)].join(''),
          id
        );
      }
    }
    return records.map(record => {
      const identity = [
        text(record.ma_npl),
        text(record.ten_npl),
        text(record.ten_nvl_sx),
        text(record.ten_kho ?? warehouse)
      ].join('');
      const hit = hits.get(identity);
      if (!hit) {
        throw new Error(
          `Dòng ${text(record.ma_npl)}: tên / tên sản xuất không khớp danh mục ${warehouse} — phiếu xuất không được tạo mã NVL mới.`
        );
      }
      return { ...record, id_danh_muc: hit, loai_danh_muc: 'kho_nvl' } as T;
    });
  }

  async function legPlan(header: ParsedHeader) {
    type Leg = {
      loai: 'nhap' | 'xuat';
      tenKho: string;
      may: string | null;
      maKho: string;
      loaiKho: 'nvl' | 'san_pham';
      lines: DetailLine[];
      loaiNhap: string | null;
      nguoiGiao: string | null;
    };
    const legs: Leg[] = [];
    const push = (leg: Leg) => {
      if (leg.lines.length) legs.push(leg);
    };
    if (header.loai === 'nhap' && header.dich.loai === 'may') {
      push({
        loai: 'nhap',
        tenKho: '',
        may: header.dich.id,
        maKho: '',
        loaiKho: 'nvl',
        lines: header.lines,
        loaiNhap: header.loaiNhap,
        nguoiGiao: null
      });
      return legs;
    }
    if (header.loai === 'nhap') {
      if (header.nguon?.loai === 'kho') {
        push({
          loai: 'xuat',
          tenKho: header.nguon.ten,
          may: null,
          maKho: header.nguon.maKho || '',
          loaiKho: header.catalog,
          lines: header.lines,
          loaiNhap: null,
          nguoiGiao: null
        });
      }
      const byDest = new Map<string, DetailLine[]>();
      for (const line of header.lines) {
        const key = line.kho_dong_ten || line.kho_dong_id;
        byDest.set(key, [...(byDest.get(key) || []), line]);
      }
      for (const [tenKho, group] of byDest) {
        push({
          loai: 'nhap',
          tenKho,
          may: null,
          maKho: group[0]?.kho_dong_ma || '',
          loaiKho: header.catalog,
          lines: group,
          loaiNhap: header.loaiNhap,
          nguoiGiao: header.nguon?.loai === 'ncc' ? header.nguon.ten : null
        });
      }
      return legs;
    }
    // Phiếu xuất: mỗi dòng có nguồn + đích riêng (nguon_dong_* = nguồn đã chuẩn hóa,
    // dich_dong_*/kho_dong_* = đích). Gộp vế giống nhau để ít phiếu lẻ.
    const partyCache = new Map<string, Party>();
    const resolveLegParty = async (kind: 'kho' | 'may', id: string): Promise<Party> => {
      const key = `${kind}|${id}`.toLowerCase();
      const hit = partyCache.get(key);
      if (hit) return hit;
      const loaded = await loadParty(kind, id);
      if ('error' in loaded) throw new Error(loaded.error);
      partyCache.set(key, loaded);
      return loaded;
    };
    const mergeLeg = (
      bucket: Map<string, {
        loai: 'nhap' | 'xuat';
        tenKho: string;
        may: string | null;
        maKho: string;
        loaiKho: 'nvl' | 'san_pham';
        lines: DetailLine[];
        loaiNhap: string | null;
        nguoiGiao: string | null;
      }>,
      leg: {
        loai: 'nhap' | 'xuat';
        tenKho: string;
        may: string | null;
        maKho: string;
        loaiKho: 'nvl' | 'san_pham';
        lines: DetailLine[];
        loaiNhap: string | null;
        nguoiGiao: string | null;
      }
    ) => {
      const key = `${leg.loai}|${leg.tenKho}|${leg.may}|${leg.maKho}|${leg.loaiKho}|${leg.loaiNhap}`;
      const cur = bucket.get(key);
      if (cur) cur.lines.push(...leg.lines);
      else bucket.set(key, leg);
    };
    const xuatBucket = new Map<string, Parameters<typeof mergeLeg>[1]>();
    const nhapBucket = new Map<string, Parameters<typeof mergeLeg>[1]>();
    for (const line of header.lines) {
      const srcKind = line.nguon_dong_loai === 'may' ? 'may' : 'kho';
      if (!line.nguon_dong_id) throw new Error(`Dòng ${line.ma_hang}: thiếu nguồn xuất.`);
      const src = await resolveLegParty(srcKind, line.nguon_dong_id);
      if (src.loai === 'ncc') throw new Error(`Dòng ${line.ma_hang}: nguồn xuất là kho hoặc máy.`);
      const dest = xuatLineDestOf(line);
      if (dest.loai === 'ncc') {
        mergeLeg(xuatBucket, {
          loai: 'xuat',
          tenKho: src.loai === 'kho' ? src.ten : '',
          may: src.loai === 'may' ? src.id : null,
          maKho: src.maKho || '',
          loaiKho: 'nvl',
          lines: [line],
          loaiNhap: null,
          nguoiGiao: null
        });
        continue;
      }
      const destParty = await resolveLegParty(dest.loai, dest.id);
      const loaiKho = header.catalog;
      mergeLeg(xuatBucket, {
        loai: 'xuat',
        tenKho: src.loai === 'kho' ? src.ten : '',
        may: src.loai === 'may' ? src.id : destParty.loai === 'may' ? destParty.id : null,
        maKho: src.maKho || '',
        loaiKho: src.loai === 'may' ? 'nvl' : loaiKho,
        lines: [line],
        loaiNhap: null,
        nguoiGiao: null
      });
      if (header.skipInbound) continue;
      // Kho → máy: chỉ vế xuất (tồn máy tính từ chính vế này, thêm vế nhập sẽ double).
      if (src.loai === 'kho' && destParty.loai === 'may') continue;
      if (destParty.loai === 'may') {
        mergeLeg(nhapBucket, {
          loai: 'nhap',
          tenKho: '',
          may: destParty.id,
          maKho: '',
          loaiKho: 'nvl',
          lines: [line],
          loaiNhap: header.loaiXuat,
          nguoiGiao: null
        });
      } else {
        mergeLeg(nhapBucket, {
          loai: 'nhap',
          tenKho: destParty.ten,
          may: null,
          maKho: destParty.maKho || '',
          loaiKho,
          lines: [line],
          loaiNhap: header.loaiXuat || 'Nhập điều chuyển',
          nguoiGiao: null
        });
      }
    }
    for (const leg of xuatBucket.values()) push(leg);
    for (const leg of nhapBucket.values()) push(leg);
    return legs;
  }

  async function writeLegs(header: ParsedHeader, codes: { nhap?: string; xuat?: string }, reason: string) {
    const plan = await legPlan(header);
    const created: string[] = [];
    let maNhap = codes.nhap || '';
    let maXuat = codes.xuat || '';
    const nhapLegs = plan.filter(leg => leg.loai === 'nhap');
    const xuatLegs = plan.filter(leg => leg.loai === 'xuat');
    const insertedNhapIds: string[] = [];

    const writeOne = async (leg: (typeof plan)[number], maPhieu: string, link?: { id: string; code: string }) => {
      const maKho =
        leg.maKho ||
        (leg.tenKho ? await deps.resolveMaKho(leg.tenKho, leg.loaiKho === 'nvl' ? 'kho_nvl' : 'kho_thanh_pham') : leg.loaiKho === 'nvl' ? 'kho_nvl' : 'kho_thanh_pham');
      const items = slipItems(leg.lines, leg.may || undefined).map(item =>
        link ? { ...item, sourceInboundLineId: link.id, sourceInboundSlipCode: link.code } : item
      );
      const built = deps.buildSlipRecords(
        {
          loaiPhieu: leg.loai,
          loaiKho: leg.loaiKho,
          maKho,
          ngayPhieu: header.ngay,
          lyDo: header.lyDo || reason,
          ghiChu: header.ghiChu,
          nguoiLap: header.nguoiLap,
          ca: header.caList[0] || null,
          caList: header.caList,
          tenKho: leg.tenKho || null,
          nguoiGiao: header.nguoiGiao || leg.nguoiGiao,
          diaDiem: header.diaDiem,
          loaiNhapKho: leg.loai === 'nhap' ? leg.loaiNhap : null,
          may: leg.may,
          items
        },
        maPhieu
      );
      let records = built.map((record, index) => {
        const imageUrl = text(items[index]?.actualWeightImageUrl);
        if (!imageUrl) return record;
        return {
          ...record,
          link_anh_can_thuc_te: imageUrl,
          link_anh_can_thuc_te_public_id: text(items[index]?.actualWeightImagePublicId) || null
        };
      });
      if (leg.loaiKho === 'nvl' && leg.tenKho) {
        if (leg.loai === 'nhap') {
          // Nhập vào kho: thiếu bộ mã + tên + tên SX + kho thì thêm dòng kho_nvl.
          const attached = await deps.attachLiveKhoNvlIds(
            records,
            leg.lines.map(line => ({
              code: line.ma_hang,
              name: line.ten_hang,
              productionName: line.ten_nvl_sx,
              unit: line.don_vi,
              materialClass: line.phan_loai_nvl
            })),
            leg.tenKho
          );
          if (attached.error) throw new Error(attached.error);
          records = attached.records;
        } else {
          // Xuất khỏi kho: không tạo/sửa master — sai tên thì lỗi.
          records = await stampOutboundKhoNvlIds(
            records,
            leg.lines.map(line => ({
              code: line.ma_hang,
              name: line.ten_hang,
              productionName: line.ten_nvl_sx
            })),
            leg.tenKho
          );
        }
      }
      const table = await deps.writeTable(leg.loai);
      const saved = await deps.insertSlipRecords(table, records);
      if (saved.error) throw new Error(saved.error.message || 'Không ghi được vế phiếu.');
      created.push(maPhieu);
      return (saved.data || []) as Array<Record<string, unknown>>;
    };

    try {
      const nhapCodes: string[] = [];
      if (nhapLegs.length) {
        for (const leg of nhapLegs) {
          const code = deps.newSlipCode('nhap');
          const rows = await writeOne(leg, code);
          nhapCodes.push(code);
          for (const row of rows) {
            const id = text(row.id);
            if (id) insertedNhapIds.push(id);
          }
          if (header.catalog === 'san_pham' && leg.tenKho) {
            await deps.insertNhapKho(
              leg.lines.map(line => ({
                ma_sp: line.ma_hang,
                ten_sp: line.ten_hang,
                don_vi: line.don_vi || 'Cái',
                loai_kho: leg.maKho || line.kho_dong_ma,
                ten_kho: leg.tenKho,
                ma_may: null,
                ten_may: null
              }))
            );
          }
        }
        maNhap = nhapCodes.join(',');
      }
      const xuatCodes: string[] = [];
      if (xuatLegs.length) {
        for (let index = 0; index < xuatLegs.length; index += 1) {
          const code = deps.newSlipCode('xuat');
          const linkId = insertedNhapIds[0];
          await writeOne(xuatLegs[index], code, linkId ? { id: linkId, code: maNhap } : undefined);
          xuatCodes.push(code);
        }
        maXuat = xuatCodes.join(',');
      }
      return { maNhap: maNhap || null, maXuat: maXuat || null };
    } catch (error) {
      for (const code of created) await deps.deleteSlip(code);
      throw error;
    }
  }

  async function rowsOf(maPhieu: string | null) {
    if (!maPhieu || !deps.supabase) return [];
    const tables = await deps.readTables(null);
    const rows: unknown[] = [];
    for (const table of tables) {
      const { data, error } = await deps.supabase.from(table).select('*').eq('ma_phieu', maPhieu).limit(500);
      if (error) continue;
      rows.push(...(data || []));
    }
    return rows;
  }

  app.get('/api/xuat-nhap-tong-hop', async (req, res) => {
    if (!deps.supabase) return res.json({ records: [], total: 0, source: 'local' });
    const loai = text(req.query.loai);
    let query = deps.supabase.from(deps.tables.header).select(SELECT).order('ngay', { ascending: false }).limit(300);
    if (loai === 'nhap' || loai === 'xuat') query = query.eq('loai', loai);
    const { data, error } = await query;
    if (error) {
      if (deps.isMissingTable(error)) return res.status(503).json({ error: tableMissing(error), records: [] });
      return res.status(500).json({ error: error.message || 'Không tải được phiếu tổng hợp.' });
    }
    return res.json({ records: data || [], total: (data || []).length, source: 'supabase' });
  });

  app.get('/api/xuat-nhap-tong-hop/ton', async (req, res) => {
    try {
      const code = text(req.query.ma_hang ?? req.query.ma);
      const tenKho = text(req.query.ten_kho);
      const maMay = text(req.query.ma_may);
      if (!code || (!tenKho && !maMay)) return res.status(400).json({ error: 'Thiếu mã hàng và kho hoặc máy.' });
      const catalog = text(req.query.catalog) === 'san_pham' ? 'san_pham' : 'nvl';
      const ton = await stockOf(code, tenKho ? { loai: 'kho', id: tenKho } : { loai: 'may', id: maMay }, catalog);
      return res.json({ ton, ma_hang: code, ten_kho: tenKho || null, ma_may: maMay || null });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Không tính được tồn.' });
    }
  });

  app.get('/api/ton-may', async (req, res) => {
    if (!deps.supabase) return res.json({ rows: [], total: 0, source: 'local' });
    const maMay = text(req.query.ma_may);
    if (!maMay) return res.status(400).json({ error: 'Thiếu ma_may.' });
    try {
      const tables = await deps.readTables(null);
      const map = new Map<string, { ma_nvl: string; ten_nvl: string; don_vi: string; nhap: number; xuat: number }>();
      for (const table of tables) {
        const { data, error } = await deps.supabase.from(table).select('ma_npl, ten_npl, don_vi, ten_kho, may, loai_phieu, so_luong').eq('may', maMay).limit(20000);
        if (error) continue;
        for (const row of (data || []) as Array<Record<string, unknown>>) {
          const code = text(row.ma_npl);
          if (!code) continue;
          const current = map.get(code) || { ma_nvl: code, ten_nvl: text(row.ten_npl), don_vi: text(row.don_vi), nhap: 0, xuat: 0 };
          const qty = Number(row.so_luong) || 0;
          const xuat = text(row.loai_phieu).toLowerCase() === 'xuat';
          const tenKho = text(row.ten_kho);
          const inbound = (xuat && Boolean(tenKho)) || (!xuat && !tenKho);
          if (inbound) current.nhap = round3(current.nhap + qty);
          else current.xuat = round3(current.xuat + qty);
          map.set(code, current);
        }
      }
      let catalog: unknown[] = [];
      const cat = await deps.supabase.from(deps.tables.nhapKho).select('ma_sp, ten_sp, don_vi, ma_may, ten_may, ten_kho').eq('ma_may', maMay).limit(5000);
      if (!cat.error) catalog = cat.data || [];
      const ngay = text(req.query.ngay);
      const ca = text(req.query.ca);
      let soTron: unknown[] = [];
      let baoCao: unknown[] = [];
      if (ngay) {
        const tron = await deps.supabase.from('so_tron').select('id, ngay, ma_may, ca, bang_ban_giao').eq('ma_may', maMay).eq('ngay', ngay).limit(20);
        if (!tron.error) {
          soTron = ((tron.data || []) as Array<Record<string, unknown>>).filter(row => !ca || text(row.ca) === ca);
        }
        const bc = await deps.supabase.from('bao_cao_may_nvl_ton').select('id, ngay, ma_may, ca, loai_bao_cao').eq('ma_may', maMay).eq('ngay', ngay).limit(50);
        if (!bc.error) baoCao = bc.data || [];
      }
      const rows = [...map.values()].map(row => ({ ...row, ton: round3(row.nhap - row.xuat) }));
      return res.json({ rows, catalog, so_tron: soTron, bao_cao_may_nvl_ton: baoCao, total: rows.length, source: 'supabase' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Không tải được tồn máy.' });
    }
  });

  async function saveHeader(header: ParsedHeader, existing?: Record<string, unknown>) {
    if (!deps.supabase) throw new Error('Supabase chưa được cấu hình.');
    if (header.loai === 'nhap' || header.loai === 'xuat') await assertSourceStock(header, []);
    if (header.loai === 'xuat') await assertSourceStock(header, []);
    const oldNhapCodes = text(existing?.ma_phieu_nhap).split(',').map(item => item.trim()).filter(Boolean);
    const oldXuatCodes = text(existing?.ma_phieu_xuat).split(',').map(item => item.trim()).filter(Boolean);
    if (existing) {
      for (const oldXuat of oldXuatCodes) {
        await deps.insertHistory({
          maPhieu: oldXuat,
          loaiPhieu: 'xuat',
          loaiKho: header.catalog,
          ngayPhieu: header.ngay,
          ca: header.ca,
          nguoiSua: header.nguoiLap,
          snapshotCu: await rowsOf(oldXuat),
          snapshotMoi: []
        });
        await deps.deleteSlip(oldXuat);
      }
      for (const oldNhap of oldNhapCodes) {
        await deps.insertHistory({
          maPhieu: oldNhap,
          loaiPhieu: 'nhap',
          loaiKho: header.catalog,
          ngayPhieu: header.ngay,
          ca: header.ca,
          nguoiSua: header.nguoiLap,
          snapshotCu: await rowsOf(oldNhap),
          snapshotMoi: []
        });
        await deps.deleteSlip(oldNhap);
      }
    }
    const reason = header.loai === 'nhap'
      ? `Nhập tổng hợp ${header.dich.ten}`
      : `Xuất tổng hợp tới ${header.dich.ten}`;
    const codes = await writeLegs(header, {}, reason);
    for (const code of text(codes.maXuat).split(',').map(item => item.trim()).filter(Boolean)) {
      await deps.insertHistory({
        maPhieu: code,
        loaiPhieu: 'xuat',
        loaiKho: header.catalog,
        ngayPhieu: header.ngay,
        ca: header.ca,
        nguoiSua: header.nguoiLap,
        snapshotCu: [],
        snapshotMoi: await rowsOf(code)
      });
    }
    for (const code of text(codes.maNhap).split(',').map(item => item.trim()).filter(Boolean)) {
      await deps.insertHistory({
        maPhieu: code,
        loaiPhieu: 'nhap',
        loaiKho: header.catalog,
        ngayPhieu: header.ngay,
        ca: header.ca,
        nguoiSua: header.nguoiLap,
        snapshotCu: [],
        snapshotMoi: await rowsOf(code)
      });
    }
    // Xuất nhiều nguồn/đích: header giữ tên gộp để list hiển thị, chi tiết từng dòng trong chi_tiet.
    const xuatSrcLabels = header.loai === 'xuat'
      ? [...new Set(header.lines.map(line => line.nguon_dong_ten || line.nguon_dong_id).filter(Boolean))]
      : [];
    const xuatDestLabels = header.loai === 'xuat'
      ? [...new Set(header.lines.map(line => {
        const d = xuatLineDestOf(line);
        return d.loai === 'may' ? line.dich_dong_id || d.id : line.kho_dong_ten || d.id;
      }).filter(Boolean))]
      : [];
    const row = {
      loai: header.loai,
      ngay: header.ngay,
      kho_dich: header.loai === 'nhap'
        ? [...new Set(header.lines.map(line => line.kho_dong_ten).filter(Boolean))].join(', ')
        : xuatDestLabels.join(', ') || (header.dich.loai === 'kho' ? header.dich.ten : ''),
      nguon_loai: header.nguon?.loai || null,
      nguon_id: header.nguon?.id || (xuatSrcLabels.length ? xuatSrcLabels.join(', ') : null),
      dich_loai: header.dich.loai,
      dich_id: header.dich.id,
      ca: header.ca,
      loai_nhap: header.loaiNhap,
      loai_xuat: header.loaiXuat,
      chi_tiet: header.lines,
      ma_phieu_nhap: codes.maNhap,
      ma_phieu_xuat: codes.maXuat,
      trang_thai: 'hoan_thanh',
      nguoi_lap: header.nguoiLap,
      nguoi_giao: header.nguoiGiao,
      dia_diem: header.diaDiem,
      ly_do: header.lyDo,
      ghi_chu: header.ghiChu
    };
    return row;
  }

  app.post('/api/xuat-nhap-tong-hop', async (req, res) => {
    try {
      const parsed = await parseBody(req.body);
      if ('error' in parsed) return res.status(400).json({ error: parsed.error });
      if (!deps.supabase) return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
      const maChung = text((req.body as any)?.ma_phieu_chung) || `TH-${deps.newSlipCode(parsed.header.loai)}`;
      const row = await saveHeader(parsed.header);
      const { data, error } = await deps.supabase
        .from(deps.tables.header)
        .insert({ ...row, ma_phieu_chung: maChung })
        .select(SELECT);
      if (error) {
        for (const code of text(row.ma_phieu_nhap).split(',').map(item => item.trim()).filter(Boolean)) {
          await deps.deleteSlip(code);
        }
        for (const code of text(row.ma_phieu_xuat).split(',').map(item => item.trim()).filter(Boolean)) {
          await deps.deleteSlip(code);
        }
        if (deps.isMissingTable(error)) return res.status(503).json({ error: tableMissing(error) });
        return res.status(500).json({ error: error.message || 'Không lưu được phiếu tổng hợp.' });
      }
      return res.status(201).json({ success: true, record: (data || [])[0] || null });
    } catch (err: any) {
      const message = err.message || 'Lỗi khi lưu phiếu tổng hợp.';
      const status = /không đủ|chỉ còn/.test(message) ? 400 : 500;
      return res.status(status).json({ error: message });
    }
  });

  app.put('/api/xuat-nhap-tong-hop/:id', async (req, res) => {
    try {
      if (!deps.supabase) return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
      const id = text(req.params.id);
      const { data: existing, error: loadError } = await deps.supabase.from(deps.tables.header).select(SELECT).eq('id', id).limit(1);
      if (loadError) return res.status(500).json({ error: loadError.message });
      const current = (existing || [])[0] as Record<string, unknown> | undefined;
      if (!current) return res.status(404).json({ error: 'Không tìm thấy phiếu.' });
      if (text(current.trang_thai) === 'huy') return res.status(400).json({ error: 'Phiếu đã hủy — không sửa được.' });
      const parsed = await parseBody({ ...(req.body as object), loai: current.loai });
      if ('error' in parsed) return res.status(400).json({ error: parsed.error });
      const row = await saveHeader(parsed.header, current);
      const { data, error } = await deps.supabase.from(deps.tables.header).update(row).eq('id', id).select(SELECT);
      if (error) return res.status(500).json({ error: error.message || 'Không cập nhật được phiếu.' });
      return res.json({ success: true, record: (data || [])[0] || null });
    } catch (err: any) {
      const message = err.message || 'Lỗi khi sửa phiếu tổng hợp.';
      return res.status(/không đủ|chỉ còn/.test(message) ? 400 : 500).json({ error: message });
    }
  });

  app.post('/api/xuat-nhap-tong-hop/:id/huy', async (req, res) => {
    try {
      if (!deps.supabase) return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
      const id = text(req.params.id);
      const { data: existing, error: loadError } = await deps.supabase.from(deps.tables.header).select(SELECT).eq('id', id).limit(1);
      if (loadError) return res.status(500).json({ error: loadError.message });
      const current = (existing || [])[0] as Record<string, unknown> | undefined;
      if (!current) return res.status(404).json({ error: 'Không tìm thấy phiếu.' });
      if (text(current.trang_thai) === 'huy') return res.status(400).json({ error: 'Phiếu đã hủy.' });
      const lines = (Array.isArray(current.chi_tiet) ? current.chi_tiet : []) as DetailLine[];
      const dichLoai = text(current.dich_loai) === 'may' ? 'may' : 'kho';
      const dichId = text(current.dich_id);
      const catalog: 'nvl' | 'san_pham' = dichLoai === 'may' ? 'nvl' : 'nvl';
      const party = await loadParty(dichLoai, dichId);
      const resolvedCatalog: 'nvl' | 'san_pham' =
        'error' in party ? catalog : party.loai === 'may' || party.vatTu ? 'nvl' : 'san_pham';
      // Hủy phiếu xuất = lấy lại từ từng nơi đến → holder là đích từng dòng.
      // Hủy phiếu nhập giữ logic cũ (holder theo đích chung).
      const huyPartyCache = new Map<string, Party>();
      const huyParty = async (kind: 'kho' | 'may', id: string): Promise<Party> => {
        const key = `${kind}|${id}`.toLowerCase();
        const hit = huyPartyCache.get(key);
        if (hit) return hit;
        const loaded = await loadParty(kind, id);
        if ('error' in loaded) throw new Error(loaded.error);
        huyPartyCache.set(key, loaded);
        return loaded;
      };
      for (const line of lines) {
        if (text(current.loai) === 'xuat') {
          const dest = xuatLineDestOf(line);
          if (!dest.id) return res.status(400).json({ error: `Dòng ${line.ma_hang}: thiếu nơi đến, không hủy được.` });
          if (dest.loai === 'ncc') continue;
          const destPartyOf = await huyParty(dest.loai, dest.id);
          const lineCatalog: 'nvl' | 'san_pham' =
            destPartyOf.loai === 'may' || destPartyOf.vatTu ? 'nvl' : 'san_pham';
          const holder = { loai: destPartyOf.loai === 'may' ? ('may' as const) : ('kho' as const), id: destPartyOf.id };
          const ton = await stockOf(line.ma_hang, holder, lineCatalog);
          if (ton + 1e-9 < Number(line.so_luong)) {
            return res.status(400).json({
              error: `${holder.loai === 'may' ? 'Máy' : 'Kho'} ${destPartyOf.ten || destPartyOf.id} chỉ còn ${ton} ${line.ma_hang} — không đủ để hủy.`
            });
          }
          continue;
        }
        const holder =
          dichLoai === 'may'
            ? { loai: 'may' as const, id: dichId }
            : { loai: 'kho' as const, id: text(current.kho_dich) || dichId };
        const ton = await stockOf(line.ma_hang, holder, resolvedCatalog);
        if (ton + 1e-9 < Number(line.so_luong)) {
          return res.status(400).json({
            error: `${holder.loai === 'may' ? 'Máy' : 'Kho'} chỉ còn ${ton} ${line.ma_hang} — không đủ để hủy.`
          });
        }
      }
      const destParty: Party = 'error' in party
        ? { loai: dichLoai, id: dichId, ten: text(current.kho_dich) || dichId, maKho: null, vatTu: resolvedCatalog === 'nvl' }
        : party;
      const caText = text(current.ca);
      const caList = caText.split(/[,;+]/).map(item => item.trim()).filter(Boolean);
      const reason = `Hủy phiếu tổng hợp ${text(current.ma_phieu_chung)}`;
      const merged = { maNhap: '', maXuat: '' };
      const joinCode = (currentCode: string, next: string | null) => [currentCode, next || ''].filter(Boolean).join(',');
      if (text(current.loai) === 'nhap') {
        const groups = new Map<string, DetailLine[]>();
        for (const line of lines) {
          const key = `${line.nguon_dong_loai}|${line.nguon_dong_id}`;
          groups.set(key, [...(groups.get(key) || []), line]);
        }
        for (const group of groups.values()) {
          const sample = group[0];
          const fromKho = sample?.nguon_dong_loai === 'kho';
          const back = fromKho ? await loadParty('kho', text(sample?.nguon_dong_id)) : null;
          const backParty: Party = back && !('error' in back)
            ? back
            : destParty;
          const header: ParsedHeader = {
            loai: 'xuat',
            ngay: new Date().toISOString().slice(0, 10),
            ca: caText || null,
            caList,
            nguon: null,
            dich: fromKho ? backParty : destParty,
            loaiNhap: 'Hủy phiếu tổng hợp',
            loaiXuat: 'Hủy phiếu tổng hợp',
            nguoiLap: text((req.body as any)?.nguoiLap) || text(current.nguoi_lap) || null,
            nguoiGiao: text(current.nguoi_giao) || null,
            diaDiem: text(current.dia_diem) || null,
            lyDo: reason,
            ghiChu: `Hủy ${text(current.ma_phieu_chung)}`,
            lines: group.map(line => ({
              ...line,
              nguon_dong_loai: 'kho',
              nguon_dong_id: destParty.ten || destParty.id,
              nguon_dong_ten: destParty.ten || destParty.id
            })),
            catalog: resolvedCatalog,
            skipInbound: !fromKho
          };
          const codes = await writeLegs(header, {}, reason);
          merged.maNhap = joinCode(merged.maNhap, codes.maNhap);
          merged.maXuat = joinCode(merged.maXuat, codes.maXuat);
        }
      } else {
        // Đảo phiếu xuất theo cặp (nguồn, đích): lấy từ đích trả về nguồn.
        // Dòng cũ không có src_* thì nguồn = nguồn header (nguon_loai/nguon_id).
        const legacySrc = text(current.nguon_loai) === 'kho' || text(current.nguon_loai) === 'may'
          ? { loai: text(current.nguon_loai) as 'kho' | 'may', id: text(current.nguon_id) }
          : null;
        const pairGroups = new Map<string, {
          src: { loai: 'kho' | 'may'; id: string };
          dest: { loai: 'kho' | 'may'; id: string };
          lines: DetailLine[];
        }>();
        const nccGroups = new Map<string, {
          src: { loai: 'kho' | 'may'; id: string };
          nccId: string;
          lines: DetailLine[];
        }>();
        for (const line of lines) {
          const s = xuatLineSrcOf(line) || legacySrc;
          if (!s?.id) return res.status(400).json({ error: `Dòng ${line.ma_hang}: thiếu nguồn xuất, không hủy được.` });
          const d = xuatLineDestOf(line);
          if (!d.id) return res.status(400).json({ error: `Dòng ${line.ma_hang}: thiếu nơi đến, không hủy được.` });
          if (d.loai === 'ncc') {
            const key = `${s.loai}|${s.id}=>ncc|${d.id}`;
            const cur = nccGroups.get(key);
            if (cur) cur.lines.push(line);
            else nccGroups.set(key, { src: { loai: s.loai, id: s.id }, nccId: d.id, lines: [line] });
            continue;
          }
          const key = `${s.loai}|${s.id}=>${d.loai}|${d.id}`;
          const cur = pairGroups.get(key);
          if (cur) cur.lines.push(line);
          else pairGroups.set(key, { src: { loai: s.loai, id: s.id }, dest: { loai: d.loai, id: d.id }, lines: [line] });
        }
        const today = new Date().toISOString().slice(0, 10);
        for (const pair of pairGroups.values()) {
          const takeFrom = await huyParty(pair.dest.loai, pair.dest.id);
          const giveBack = await huyParty(pair.src.loai, pair.src.id);
          const pairCatalog: 'nvl' | 'san_pham' =
            takeFrom.loai === 'may' || takeFrom.vatTu || giveBack.loai === 'may' || giveBack.vatTu ? 'nvl' : 'san_pham';
          const codes = await writeLegs({
            loai: 'xuat',
            ngay: today,
            ca: caText || null,
            caList,
            nguon: takeFrom,
            dich: giveBack,
            loaiNhap: 'Hủy phiếu tổng hợp',
            loaiXuat: 'Hủy phiếu tổng hợp',
            nguoiLap: text((req.body as any)?.nguoiLap) || text(current.nguoi_lap) || null,
            nguoiGiao: text(current.nguoi_giao) || null,
            diaDiem: text(current.dia_diem) || null,
            lyDo: reason,
            ghiChu: `Hủy ${text(current.ma_phieu_chung)}`,
            lines: pair.lines.map(line => ({
              ...line,
              // Đích mới = nguồn cũ (trả hàng về). legPlan đọc nguồn từ nguon_dong_*,
              // đích từ dich_dong_*/kho_dong_* — vế kho→máy chỉ sinh vế xuất (không double).
              dich_dong_loai: pair.src.loai,
              dich_dong_id: pair.src.id,
              kho_dong_id: pair.src.loai === 'kho' ? pair.src.id : '',
              kho_dong_ten: pair.src.loai === 'kho' ? giveBack.ten : '',
              kho_dong_ma: pair.src.loai === 'kho' ? giveBack.maKho : null,
              kho_dong_vat_tu: pair.src.loai === 'kho' ? giveBack.vatTu : false,
              nguon_dong_loai: takeFrom.loai,
              nguon_dong_id: takeFrom.id,
              nguon_dong_ten: takeFrom.ten
            })),
            catalog: pairCatalog
          }, {}, reason);
          merged.maXuat = joinCode(merged.maXuat, codes.maXuat);
          merged.maNhap = joinCode(merged.maNhap, codes.maNhap);
        }
        for (const group of nccGroups.values()) {
          if (group.src.loai !== 'kho') {
            return res.status(400).json({ error: 'Không hủy được phiếu trả nhà cung cấp khi nguồn không phải kho.' });
          }
          const ncc = await loadParty('ncc', group.nccId);
          if ('error' in ncc) return res.status(400).json({ error: ncc.error });
          const kho = await huyParty('kho', group.src.id);
          const codes = await writeLegs({
            loai: 'nhap',
            ngay: today,
            ca: caText || null,
            caList,
            nguon: ncc,
            dich: kho,
            loaiNhap: 'Hủy phiếu tổng hợp',
            loaiXuat: null,
            nguoiLap: text((req.body as any)?.nguoiLap) || text(current.nguoi_lap) || null,
            nguoiGiao: text(current.nguoi_giao) || null,
            diaDiem: text(current.dia_diem) || null,
            lyDo: reason,
            ghiChu: `Hủy ${text(current.ma_phieu_chung)}`,
            lines: group.lines.map(line => ({
              ...line,
              kho_dong_id: kho.id,
              kho_dong_ten: kho.ten,
              kho_dong_ma: kho.maKho,
              kho_dong_vat_tu: kho.vatTu,
              dich_dong_loai: '',
              dich_dong_id: ''
            })),
            catalog: 'nvl'
          }, {}, reason);
          merged.maNhap = joinCode(merged.maNhap, codes.maNhap);
          merged.maXuat = joinCode(merged.maXuat, codes.maXuat);
        }
      }
      const codes = { maNhap: merged.maNhap || null, maXuat: merged.maXuat || null };
      const { data, error } = await deps.supabase
        .from(deps.tables.header)
        .update({ trang_thai: 'huy', ma_phieu_xuat_huy: codes.maXuat, ma_phieu_nhap_huy: codes.maNhap })
        .eq('id', id)
        .select(SELECT);
      if (error) {
        return res.status(500).json({
          error: `Đã ghi phiếu đảo nhưng không cập nhật header. ${error.message}`,
          ma_phieu_xuat_huy: codes.maXuat,
          ma_phieu_nhap_huy: codes.maNhap
        });
      }
      return res.json({ success: true, record: (data || [])[0] || null, ...codes });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Lỗi khi hủy phiếu tổng hợp.' });
    }
  });

  app.post('/api/xuat-nhap-tong-hop/ma-moi', async (req, res) => {
    if (!deps.supabase) return res.status(503).json({ error: 'Supabase chưa được cấu hình.' });
    const source = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const catalog = text(source.catalog) === 'san_pham' ? 'san_pham' : 'nvl';
    const code = text(source.code ?? source.ma);
    const name = text(source.name ?? source.ten);
    const unit = text(source.unit ?? source.don_vi) || (catalog === 'nvl' ? 'kg' : 'Cái');
    if (!code || !name) return res.status(400).json({ error: 'Nhập mã và tên.' });
    if (catalog === 'nvl') {
      // Master kho_nvl khóa unique mã + tên + tên SX + kho: thiếu kho sẽ thành dòng
      // trống kho hiện canonical "Kho NVL" 0/0/0 gây nhiễu; thiếu tên SX/phân loại sẽ
      // lệch với dòng ensure từ phiếu (cùng mã khác tên SX là các dòng khác nhau).
      const tenKhoNvl = text(source.ten_kho ?? source.tenKho ?? source.warehouse);
      const tenNvlSx = text(
        source.ten_nvl_sx ?? source.tenNvlSx ?? source.ten_san_xuat ?? source.tenSanXuat ?? source.productionName
      );
      const phanLoai = nvlCatalogPhanLoaiLabel(
        source.phan_loai ?? source.phanLoai ?? source.materialClass ?? source.warehouseClass ?? source.phan_loai_nvl
      );
      if (!tenKhoNvl) return res.status(400).json({ error: 'Chọn kho NVL (Kho NVL Chính / Phụ / PC) để thêm mã.' });
      const kho = await loadParty('kho', tenKhoNvl);
      if ('error' in kho) return res.status(400).json({ error: kho.error });
      if (!kho.vatTu) return res.status(400).json({ error: `Kho "${kho.ten}" không phải kho NVL.` });
      const baseRecord: Record<string, unknown> = { ma_npl: code, ten_npl: name, don_vi: unit };
      const fullRecord: Record<string, unknown> = {
        ...baseRecord,
        ten_nvl_sx: tenNvlSx || null,
        ten_kho: kho.ten,
        loai_kho: kho.maKho || (await deps.resolveMaKho(kho.ten, 'kho_nvl')),
        ...(phanLoai ? { phan_loai: phanLoai } : {})
      };
      const selectAll = async (record: Record<string, unknown>) =>
        deps.supabase!.from(deps.tables.materials).insert(record).select().limit(1);
      let nvlResult = await selectAll(fullRecord);
      if (nvlResult.error && deps.isMissingColumn(nvlResult.error)) {
        // DB cũ thiếu cột: thử bỏ phan_loai trước, rồi bỏ tên SX/kho.
        const withoutPhanLoai: Record<string, unknown> = { ...fullRecord };
        delete withoutPhanLoai.phan_loai;
        nvlResult = await selectAll(withoutPhanLoai);
        if (nvlResult.error && deps.isMissingColumn(nvlResult.error)) {
          nvlResult = await selectAll(baseRecord);
        }
      }
      if (nvlResult.error) {
        // Trùng unique mã + tên + tên SX + kho: trả dòng đang sống thay vì 500.
        if (String((nvlResult.error as { code?: unknown }).code || '') === '23505') {
          const existing = await deps.supabase!
            .from(deps.tables.materials)
            .select()
            .eq('ma_npl', code)
            .limit(500);
          if (!existing.error) {
            const hit = ((existing.data || []) as Array<Record<string, unknown>>).find(
              item =>
                text(item.ten_npl) === name &&
                text(item.ten_nvl_sx) === tenNvlSx &&
                deps.normalizeKho(text(item.ten_kho)) === deps.normalizeKho(kho.ten)
            );
            if (hit) return res.status(200).json({ success: true, duplicate: true, item: hit });
          }
          return res.status(409).json({ error: 'Mã, tên và tên sản xuất đã tồn tại trong kho này.' });
        }
        return res.status(500).json({ error: nvlResult.error.message || 'Không thêm được NVL.' });
      }
      const { data, error } = nvlResult;
      if (error) return res.status(500).json({ error: error.message || 'Không thêm được NVL.' });
      return res.status(201).json({ success: true, item: (data || [])[0] || { ma_npl: code, ten_npl: name, don_vi: unit } });
    }
    const tenKho = text(source.ten_kho);
    const saved = await deps.insertNhapKho([
      {
        ma_sp: code,
        ten_sp: name,
        don_vi: unit,
        loai_kho: tenKho ? await deps.resolveMaKho(tenKho) : 'kho_thanh_pham',
        ten_kho: tenKho,
        ma_may: null,
        ten_may: null
      }
    ]);
    if (!saved.saved) return res.status(500).json({ error: saved.error || 'Không thêm được sản phẩm vào sổ kho.' });
    return res.status(201).json({ success: true, item: { ma_sp: code, ten_sp: name, don_vi: unit, ten_kho: tenKho } });
  });
}

export async function aggregateSlipOwnsCode(
  supabase: { from: (table: string) => any } | null,
  table: string,
  maPhieu: string,
  isMissingTable: (error: { message?: string; code?: string } | null) => boolean
): Promise<boolean> {
  if (!supabase || !maPhieu) return false;
  const { data, error } = await supabase
    .from(table)
    .select('id, ma_phieu_nhap, ma_phieu_xuat, ma_phieu_nhap_huy, ma_phieu_xuat_huy')
    .or(`ma_phieu_nhap.eq.${maPhieu},ma_phieu_xuat.eq.${maPhieu},ma_phieu_nhap_huy.eq.${maPhieu},ma_phieu_xuat_huy.eq.${maPhieu}`)
    .limit(1);
  if (error) {
    if (isMissingTable(error) || /ma_phieu_.*_huy/i.test(error.message || '')) return false;
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}
