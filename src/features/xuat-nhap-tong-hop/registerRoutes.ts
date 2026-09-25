/**
 * Phiếu nhập / xuất tổng hợp.
 * Header không có tên kho chung. Kho hoặc máy nằm trên từng dòng / đích.
 * Ghi vế vào phieu_nhap_kho / phieu_xuat_kho. ten_kho không bao giờ là tên máy.
 */
import type { Express } from 'express';

type SlipLine = {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  materialClass: 'chua_phan_loai';
  weightKg?: number;
  machine?: string;
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
  quy_doi_kg: number | null;
  /** Nhập: kho hoặc nhà cung cấp lấy hàng. Xuất: kho lấy hàng ra. */
  nguon_dong_loai: '' | 'kho' | 'may' | 'ncc';
  nguon_dong_id: string;
  nguon_dong_ten: string;
  /** Kho nhận hàng (nhập: kho đích trên header, copy xuống dòng). */
  kho_dong_id: string;
  kho_dong_ten: string;
  kho_dong_ma: string | null;
  kho_dong_vat_tu: boolean;
};

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

function slipItems(lines: DetailLine[], machine?: string): SlipLine[] {
  return lines.map(line => ({
    code: line.ma_hang,
    name: line.ten_hang,
    unit: line.don_vi || '',
    quantity: line.so_luong,
    unitPrice: line.don_gia,
    lineAmount: line.thanh_tien,
    materialClass: 'chua_phan_loai' as const,
    ...(line.quy_doi_kg && line.quy_doi_kg > 0 ? { weightKg: line.quy_doi_kg } : {}),
    ...(machine ? { machine } : {})
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
      const qty = Number(String(item.so_luong ?? item.soLuong ?? item.quantity ?? '').replace(',', '.'));
      if (!Number.isFinite(qty) || qty <= 0) return { error: `Dòng ${index + 1} (${ma}): số lượng phải lớn hơn 0.` };
      const price = Number(String(item.don_gia ?? item.donGia ?? item.unitPrice ?? 0).replace(',', '.'));
      const donGia = Number.isFinite(price) && price >= 0 ? price : 0;
      const quyDoiRaw = Number(String(item.quy_doi_kg ?? item.quyDoiKg ?? item.weightKg ?? '').replace(',', '.'));
      const quyDoi = Number.isFinite(quyDoiRaw) && quyDoiRaw > 0 ? round3(quyDoiRaw) : null;
      const nguonDongLoaiRaw = text(item.nguon_dong_loai ?? item.nguonDongLoai).toLowerCase();
      const nguonDongId = text(item.nguon_dong_id ?? item.nguonDongId ?? item.kho_nguon ?? item.khoNguon ?? item.kho);
      const khoNhap = text(item.kho_dong ?? item.khoDong ?? item.kho_dich ?? item.khoDich);
      if (loai === 'nhap' && !khoNhap) return { error: `Dòng ${index + 1}: chọn kho nhập.` };
      const dichDongLoai = text(item.dich_dong_loai ?? item.dichDongLoai).toLowerCase() || (loai === 'xuat' ? nguonDongLoaiRaw : '');
      const dichDongId = text(item.dich_dong_id ?? item.dichDongId) || (loai === 'xuat' ? nguonDongId || khoNhap : '');
      if (loai === 'xuat') {
        if (dichDongLoai !== 'kho' && dichDongLoai !== 'may') return { error: `Dòng ${index + 1}: chọn kho hoặc máy xuất đến.` };
        if (!dichDongId) return { error: `Dòng ${index + 1}: chọn nơi xuất đến.` };
      }
      lines.push({
        ma_hang: ma,
        ten_hang: text(item.ten_hang ?? item.tenHang ?? item.name),
        don_vi: text(item.don_vi ?? item.donVi ?? item.unit),
        so_luong: round3(qty),
        don_gia: donGia,
        thanh_tien: round3(qty * donGia),
        quy_doi_kg: quyDoi,
        nguon_dong_loai: loai === 'xuat' && dichDongLoai === 'may' ? 'may' : '',
        nguon_dong_id: loai === 'xuat' && dichDongLoai === 'may' ? dichDongId : '',
        nguon_dong_ten: loai === 'xuat' && dichDongLoai === 'may' ? dichDongId : '',
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
      const loaded = await loadParty(text(source.nguon_loai ?? source.nguonLoai), text(source.nguon_id ?? source.nguonId));
      if ('error' in loaded) return { error: loaded.error };
      if (loaded.loai === 'may') return { error: 'Nguồn nhập là kho hoặc nhà cung cấp.' };
      nguon = loaded;
    } else {
      const loaded = await loadParty(text(source.nguon_loai ?? source.nguonLoai ?? source.dich_loai ?? source.dichLoai), text(source.nguon_id ?? source.nguonId ?? source.dich_id ?? source.dichId));
      if ('error' in loaded) return { error: loaded.error };
      if (loaded.loai === 'ncc') return { error: 'Nguồn xuất là kho hoặc máy.' };
      nguon = loaded;
    }
    const parsedLines = parseLines(source.lines ?? source.chi_tiet, loai);
    if ('error' in parsedLines) return parsedLines;
    for (const line of parsedLines.lines) {
      if (loai === 'nhap' && nguon) {
        const kho = await loadParty('kho', line.kho_dong_id);
        if ('error' in kho) return { error: kho.error };
        line.kho_dong_id = kho.id;
        line.kho_dong_ten = kho.ten;
        line.kho_dong_ma = kho.maKho;
        line.kho_dong_vat_tu = kho.vatTu;
        const sourceNvl = nguon.loai === 'ncc' || nguon.vatTu;
        if (sourceNvl !== kho.vatTu) {
          return { error: `Dòng ${line.ma_hang}: kho nhập phải cùng loại với nguồn nhập.` };
        }
        if (nguon.loai === 'kho' && deps.normalizeKho(nguon.ten) === deps.normalizeKho(kho.ten)) {
          return { error: `Dòng ${line.ma_hang}: kho nguồn và kho nhập phải khác nhau.` };
        }
      } else if (loai === 'xuat' && nguon) {
        const destKind = line.nguon_dong_loai === 'may' ? 'may' : 'kho';
        const destKey = destKind === 'may' ? line.nguon_dong_id : line.kho_dong_id;
        const destParty = await loadParty(destKind, destKey);
        if ('error' in destParty) return { error: destParty.error };
        const sourceNvl = nguon.loai === 'may' || nguon.vatTu;
        if (destParty.loai === 'may') {
          line.nguon_dong_loai = 'may';
          line.nguon_dong_id = destParty.id;
          line.nguon_dong_ten = destParty.ten;
          if (!sourceNvl) return { error: 'Máy chỉ nhận NVL.' };
          if (nguon.loai === 'may' && nguon.id === destParty.id) return { error: `Dòng ${line.ma_hang}: máy nguồn và máy đến phải khác nhau.` };
        } else {
          line.kho_dong_id = destParty.id;
          line.kho_dong_ten = destParty.ten;
          line.kho_dong_ma = destParty.maKho;
          line.kho_dong_vat_tu = destParty.vatTu;
          line.nguon_dong_loai = '';
          line.nguon_dong_id = '';
          if (sourceNvl !== destParty.vatTu) return { error: `Dòng ${line.ma_hang}: nơi đến phải cùng loại với nguồn xuất.` };
          if (nguon.loai === 'kho' && deps.normalizeKho(nguon.ten) === deps.normalizeKho(destParty.ten)) {
            return { error: `Dòng ${line.ma_hang}: kho nguồn và kho đến phải khác nhau.` };
          }
        }
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
      const first = parsedLines.lines[0];
      const firstMay = first?.nguon_dong_loai === 'may';
      dich = firstMay
        ? { loai: 'may', id: first?.nguon_dong_id || '', ten: first?.nguon_dong_ten || '', maKho: null, vatTu: true }
        : { loai: 'kho', id: first?.kho_dong_id || '', ten: first?.kho_dong_ten || '', maKho: first?.kho_dong_ma || null, vatTu: Boolean(first?.kho_dong_vat_tu) };
    }
    if (!dich) return { error: 'Thiếu nơi xuất đến.' };
    const catalog: 'nvl' | 'san_pham' = loai === 'nhap'
      ? (nguon?.loai === 'ncc' || nguon?.vatTu ? 'nvl' : 'san_pham')
      : nguon?.loai === 'may' || nguon?.vatTu ? 'nvl' : 'san_pham';
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
        loaiXuat: loai === 'xuat' ? text(source.loai_xuat ?? source.loaiXuat).slice(0, 120) || null : null,
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
    let ton = 0;
    for (const table of tables) {
      let query = deps.supabase.from(table).select('ma_npl, ma_sp, ten_kho, may, loai_phieu, so_luong').limit(20000);
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
          if (deps.normalizeKho(tenKho) !== deps.normalizeKho(party.id)) continue;
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
        if (header.nguon && header.nguon.loai !== 'ncc') {
          sources.push({
            party: { loai: header.nguon.loai === 'may' ? 'may' : 'kho', id: header.nguon.id },
            code: line.ma_hang,
            qty: line.so_luong
          });
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

  function legPlan(header: ParsedHeader) {
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
    const sourceParty = header.nguon;
    const toMay = header.lines.filter(line => line.nguon_dong_loai === 'may');
    const toKho = header.lines.filter(line => line.nguon_dong_loai !== 'may');
    if (sourceParty?.loai === 'kho') {
      for (const line of toMay) {
        push({
          loai: 'xuat',
          tenKho: sourceParty.ten,
          may: line.nguon_dong_id,
          maKho: sourceParty.maKho || '',
          loaiKho: header.catalog,
          lines: [line],
          loaiNhap: null,
          nguoiGiao: null
        });
      }
    } else if (sourceParty?.loai === 'may' && toMay.length && !header.skipInbound) {
      push({
        loai: 'xuat',
        tenKho: '',
        may: sourceParty.id,
        maKho: '',
        loaiKho: 'nvl',
        lines: toMay,
        loaiNhap: null,
        nguoiGiao: null
      });
      for (const line of toMay) {
        push({
          loai: 'nhap',
          tenKho: '',
          may: line.nguon_dong_id,
          maKho: '',
          loaiKho: 'nvl',
          lines: [line],
          loaiNhap: header.loaiXuat,
          nguoiGiao: null
        });
      }
    }
    if (toKho.length && sourceParty) {
      push({
        loai: 'xuat',
        tenKho: sourceParty.loai === 'kho' ? sourceParty.ten : '',
        may: sourceParty.loai === 'may' ? sourceParty.id : null,
        maKho: sourceParty.maKho || '',
        loaiKho: header.catalog,
        lines: toKho,
        loaiNhap: null,
        nguoiGiao: null
      });
      if (!header.skipInbound) {
        const byDest = new Map<string, DetailLine[]>();
        for (const line of toKho) byDest.set(line.kho_dong_ten || line.kho_dong_id, [...(byDest.get(line.kho_dong_ten || line.kho_dong_id) || []), line]);
        for (const [tenKho, group] of byDest) {
          push({
            loai: 'nhap',
            tenKho,
            may: null,
            maKho: group[0]?.kho_dong_ma || '',
            loaiKho: header.catalog,
            lines: group,
            loaiNhap: header.loaiXuat || 'Nhập điều chuyển',
            nguoiGiao: null
          });
        }
      }
    }
    return legs;
  }

  async function writeLegs(header: ParsedHeader, codes: { nhap?: string; xuat?: string }, reason: string) {
    const plan = legPlan(header);
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
      const records = deps.buildSlipRecords(
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
    const row = {
      loai: header.loai,
      ngay: header.ngay,
      kho_dich: header.loai === 'nhap'
        ? [...new Set(header.lines.map(line => line.kho_dong_ten).filter(Boolean))].join(', ')
        : header.dich.loai === 'kho' ? header.dich.ten : '',
      nguon_loai: header.nguon?.loai || null,
      nguon_id: header.nguon?.id || null,
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
      for (const line of lines) {
        const holder =
          text(current.loai) === 'xuat' && dichLoai === 'may'
            ? { loai: 'may' as const, id: dichId }
            : text(current.loai) === 'nhap'
              ? dichLoai === 'may'
                ? { loai: 'may' as const, id: dichId }
                : { loai: 'kho' as const, id: text(current.kho_dich) || dichId }
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
        const stamp = {
          ngay: new Date().toISOString().slice(0, 10),
          ca: caText || null,
          caList,
          nguon: null,
          loaiNhap: 'Hủy phiếu tổng hợp',
          loaiXuat: 'Hủy phiếu tổng hợp',
          nguoiLap: text((req.body as any)?.nguoiLap) || text(current.nguoi_lap) || null,
          nguoiGiao: text(current.nguoi_giao) || null,
          diaDiem: text(current.dia_diem) || null,
          lyDo: reason,
          ghiChu: `Hủy ${text(current.ma_phieu_chung)}`,
          catalog: resolvedCatalog
        };
        const out = await writeLegs({
          ...stamp,
          loai: 'xuat',
          dich: destParty,
          skipInbound: true,
          lines: lines.map(line => ({
            ...line,
            nguon_dong_loai: dichLoai === 'may' ? 'may' : 'kho',
            nguon_dong_id: dichLoai === 'may' ? dichId : destParty.ten || destParty.id,
            nguon_dong_ten: dichLoai === 'may' ? dichId : destParty.ten || destParty.id
          }))
        }, {}, reason);
        merged.maXuat = joinCode(merged.maXuat, out.maXuat);
        const bySource = new Map<string, DetailLine[]>();
        for (const line of lines) {
          const key = `${line.nguon_dong_loai}|${line.nguon_dong_id}`;
          bySource.set(key, [...(bySource.get(key) || []), line]);
        }
        for (const group of bySource.values()) {
          const sample = group[0];
          if (sample?.nguon_dong_loai === 'may') {
            const machine = await loadParty('may', text(sample.nguon_dong_id));
            if ('error' in machine) throw new Error(machine.error);
            const backCodes = await writeLegs({
              ...stamp,
              loai: 'nhap',
              dich: machine,
              lines: group
            }, {}, reason);
            merged.maNhap = joinCode(merged.maNhap, backCodes.maNhap);
            continue;
          }
          const back = await loadParty('kho', text(sample?.nguon_dong_id));
          if ('error' in back) throw new Error(back.error);
          const backCodes = await writeLegs({
            ...stamp,
            loai: 'nhap',
            dich: back,
            lines: group.map(line => ({
              ...line,
              nguon_dong_loai: 'ncc',
              nguon_dong_id: destParty.id,
              nguon_dong_ten: destParty.ten
            }))
          }, {}, reason);
          merged.maNhap = joinCode(merged.maNhap, backCodes.maNhap);
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
      const { data, error } = await deps.supabase
        .from(deps.tables.materials)
        .insert({ ma_npl: code, ten_npl: name, don_vi: unit })
        .select('ma_npl, ten_npl, don_vi')
        .limit(1);
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
