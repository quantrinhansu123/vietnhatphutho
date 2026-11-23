import * as XLSX from 'xlsx';
import {
  classifyProductPxGroup,
  composeProductionDisplayName,
  extractDoLiDmLi,
  extractZemToken,
  normalizeDinhMucKg,
  normalizeDoLiDm,
  normalizeDoLiToken,
  extractHangPhe,
  resolveDacHangPhe,
  resolveSongDoDaiTamTieuChuan,
  seedProductionSpecs,
  stripDuplicateLiFromTenGoc
} from './productProductionName.ts';

/** Dòng Excel danh mục sản phẩm — khớp form / bảng UI / cột `san_pham`. */
export type ProductCatalogExcelRow = {
  code: string;
  amisCode: string;
  amisOldCode: string;
  newCode: string;
  name: string;
  productionName: string;
  tenGoc: string;
  doLi: string;
  doLiDm: string;
  /** `6ZEM`, `8ZEM` — nối sau sóng (Sóng) / sau màu (Đặc). */
  zem: string;
  /** Số sóng (`11` của `11 SÓNG`). */
  soSong: string;
  /** `(đm n kg)` — định mức kg. */
  dinhMucKg: string;
  /** Mét dài tấm tiêu chuẩn của ĐM kg (Sóng), vd `6m`. */
  doDaiTamTieuChuan: string;
  /** `x` / `1` / `TCMB` = có; trống = không. */
  tcmb: string;
  doDayM: string;
  doDaiM: string;
  mang: string;
  hangPhe: string;
  mau: string;
  giaRe: string;
  tcmn: string;
  nature: string;
  group: string;
  unit: string;
  totalWeight: string;
  wastePercent: string;
  rollWidth: string;
  rollLength: string;
  coreWeight: string;
  bagWeight: string;
  plasticWeight: string;
  openingStock: string;
  inbound: string;
  outbound: string;
  stock: string;
  minStock: string;
  origin: string;
  description: string;
  rowNumber: number;
};

const HEADER_ALIASES: Record<keyof Omit<ProductCatalogExcelRow, 'rowNumber'>, string[]> = {
  code: ['ma sp', 'ma_sp', 'ma san pham', 'code'],
  amisCode: ['ma amis', 'ma_amis', 'amis'],
  amisOldCode: ['ma amis cu', 'ma_amis_cu', 'amis cu', 'amis old'],
  newCode: ['ma moi', 'ma_sp_moi', 'ma sp moi'],
  name: ['ten san pham', 'ten_sp', 'ten sp', 'name'],
  productionName: ['ten san xuat moi', 'ten san xuat', 'ten_san_xuat', 'production name'],
  tenGoc: ['ten goc', 'ten_goc'],
  doLi: ['do li', 'do_li'],
  doLiDm: ['dm dm n li', 'dm dm li', 'dm n li', 'do li dm', 'do_li_dm', 'dinh muc dm li', 'dinh muc li'],
  zem: ['zem', 'do zem', 'so zem'],
  soSong: ['so song', 'song'],
  dinhMucKg: ['dm dm kg', 'dm kg', 'dinh muc kg', 'dm (kg)'],
  doDaiTamTieuChuan: [
    'met dai dm m',
    'met dai dm',
    'do dai tam tieu chuan',
    'do_dai_tam_tieu_chuan',
    'dai tam tieu chuan',
    'm dai dm'
  ],
  tcmb: ['tcmb', 'tieu chuan mien bac', 'tc mien bac'],
  doDayM: ['kho rong m', 'kho rong', 'do day m', 'do_day_m', 'do day'],
  doDaiM: ['met dai', 'do dai m', 'do_dai_m', 'm dai'],
  mang: ['mang', 'mang eco'],
  hangPhe: ['hang phe', 'hang_phe'],
  mau: ['mau'],
  giaRe: ['gia re', 'gia_re'],
  tcmn: ['tcmn'],
  nature: ['tinh chat', 'tinh_chat', 'nature'],
  group: ['nhom vthh', 'nhom_vthh', 'nhom', 'loai', 'group'],
  unit: ['don vi tinh', 'don_vi', 'don vi', 'dvt', 'unit'],
  totalWeight: ['tong tl kg', 'tong tl', 'tong trong luong', 'tong_trong_luong', 'total weight'],
  wastePercent: ['% ty le hao hut', 'ty le hao hut', 'ty_le_hao_hut', 'hao hut', 'ty le hang hong', 'ty le hang hong %', 'waste percent'],
  rollWidth: ['kho cuon m', 'kho cuon', 'kho_cuon', 'roll width'],
  rollLength: ['chieu dai met cuon m', 'chieu dai met cuon', 'chieu_dai_cuon', 'roll length'],
  coreWeight: ['trong luong loi kg', 'trong luong loi', 'trong_luong_loi', 'core weight'],
  bagWeight: ['trong luong tui kg', 'trong luong tui', 'trong_luong_tui', 'bag weight'],
  plasticWeight: [
    'trong luong nhua phu gia kg',
    'trong luong nhua phu gia',
    'trong luong nhua',
    'trong_luong_nhua',
    'plastic weight'
  ],
  openingStock: ['ton dau', 'ton_dau_ky', 'opening stock'],
  inbound: ['nhap trong ky', 'nhap_trong_ky', 'nhap', 'inbound'],
  outbound: ['xuat trong ky', 'xuat_trong_ky', 'xuat', 'outbound'],
  stock: ['sl_ton', 'ton kho', 'stock'],
  minStock: ['ton toi thieu', 'so_luong_ton_toi_thieu', 'min stock'],
  origin: ['nguon goc', 'nguon_goc', 'origin'],
  description: ['mo ta', 'mo_ta', 'ghi chu', 'description']
};

/**
 * Mẫu Excel gọn — giống sheet miền nam v2 (+ Mét dài ĐM cho Sóng).
 * Không gồm cột tồn kho / lõi túi thừa; quy đổi cân nặng nằm file quy đổi riêng.
 */
export const PRODUCT_CATALOG_EXCEL_HEADERS = [
  'Mã AMIS',
  'Tên sản phẩm',
  'Tên sản xuất mới',
  'Loại',
  'ĐVT',
  'Tên gốc',
  'Số sóng',
  'ZEM',
  'Hàng phế',
  'Màng',
  'TCMB',
  'Độ li',
  'ĐM (đm li)',
  'ĐM (đm kg)',
  'Mét dài ĐM (m)',
  'Khổ rộng (m)',
  'Mét dài',
  'Màu',
  'Giá rẻ',
  'TCMN',
  'Ghi chú'
] as const;

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[_/-]+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Giữ đủ chữ số từ ô số (raw:true); không lấy format hiển thị Excel. */
export function cellToText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Object.is(value, -0)) return '0';
    if (Number.isInteger(value)) return String(value);
    const precise = value.toPrecision(15);
    if (/e/i.test(precise)) return String(value);
    return precise.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '');
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

/** Ưu tiên khớp đúng cả chuỗi header; tránh "ton" ăn nhầm "ton dau". */
function findColumn(headers: string[], aliases: string[]) {
  const exact = headers.findIndex(header => aliases.some(alias => header === alias));
  if (exact >= 0) return exact;
  return headers.findIndex(header =>
    aliases.some(alias => alias.length >= 4 && (header.includes(alias) || alias.includes(header)))
  );
}

function sheetLooksLikeCatalog(headers: string[]) {
  const hasName = findColumn(headers, HEADER_ALIASES.name) >= 0;
  const hasCode =
    findColumn(headers, HEADER_ALIASES.code) >= 0
    || findColumn(headers, HEADER_ALIASES.amisCode) >= 0;
  const hasTenGoc = findColumn(headers, HEADER_ALIASES.tenGoc) >= 0;
  const hasProduction = findColumn(headers, HEADER_ALIASES.productionName) >= 0;
  return hasName && hasCode && (hasTenGoc || hasProduction);
}

function pickCatalogSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  const preferred = workbook.SheetNames.find(name => {
    const key = normalizeHeader(name);
    return (
      (key.includes('san pham') || key === 'san_pham')
      && !key.includes('quy doi')
      && !key.includes('nvl')
    );
  });
  if (preferred && workbook.Sheets[preferred]) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[preferred], {
      header: 1,
      defval: '',
      raw: true
    }) as unknown[][];
    const headers = (matrix[0] || []).map(normalizeHeader);
    if (sheetLooksLikeCatalog(headers)) return workbook.Sheets[preferred];
  }

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: true
    }) as unknown[][];
    const headers = (matrix[0] || []).map(normalizeHeader);
    if (sheetLooksLikeCatalog(headers)) return sheet;
  }

  return workbook.Sheets[workbook.SheetNames[0]] || null;
}

function defaultTenGoc(group: string) {
  const px = classifyProductPxGroup(group);
  if (px === 'song') return 'NHỰA SÓNG';
  if (px === 'dac') return 'Tấm nhựa đặc';
  if (px === 'rong') return 'Tấm nhựa rỗng';
  return '';
}

export async function parseProductCatalogExcel(file: File): Promise<ProductCatalogExcelRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = pickCatalogSheet(workbook);
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true
  }) as unknown[][];
  if (matrix.length === 0) return [];

  const headers = matrix[0].map(normalizeHeader);

  // File thành phần NVL cũ (Mã SP / Tên NVL / Loại…) → báo rõ dùng mẫu danh mục
  const looksLikeBom =
    headers.some(h => h.includes('ten nvl') || h.includes('ten npl')) &&
    headers.some(h => h === 'loai' || h.includes('gia tri'));
  if (looksLikeBom) {
    throw new Error(
      'File này là mẫu thành phần NVL (Tên NVL / Loại / Giá trị), không phải danh mục sản phẩm. Hãy dùng nút "Tải mẫu Excel SP".'
    );
  }

  const codeIndex = findColumn(headers, HEADER_ALIASES.code);
  const amisIndex = findColumn(headers, HEADER_ALIASES.amisCode);
  const nameIndex = findColumn(headers, HEADER_ALIASES.name);
  if (codeIndex < 0 && amisIndex < 0 && nameIndex < 0) {
    throw new Error('Không tìm thấy cột "Mã AMIS" / "Mã SP" hoặc "Tên sản phẩm" trong file Excel.');
  }

  // "Tồn" đúng cột — sau khi đã map ton dau / ton toi thieu
  const stockAliases = [...HEADER_ALIASES.stock, 'ton'];

  const indices = {
    code: codeIndex,
    amisCode: amisIndex,
    amisOldCode: findColumn(headers, HEADER_ALIASES.amisOldCode),
    newCode: findColumn(headers, HEADER_ALIASES.newCode),
    name: nameIndex,
    productionName: findColumn(headers, HEADER_ALIASES.productionName),
    tenGoc: findColumn(headers, HEADER_ALIASES.tenGoc),
    doLi: findColumn(headers, HEADER_ALIASES.doLi),
    doLiDm: findColumn(headers, HEADER_ALIASES.doLiDm),
    zem: findColumn(headers, HEADER_ALIASES.zem),
    soSong: findColumn(headers, HEADER_ALIASES.soSong),
    dinhMucKg: findColumn(headers, HEADER_ALIASES.dinhMucKg),
    doDaiTamTieuChuan: findColumn(headers, HEADER_ALIASES.doDaiTamTieuChuan),
    tcmb: findColumn(headers, HEADER_ALIASES.tcmb),
    doDayM: findColumn(headers, HEADER_ALIASES.doDayM),
    doDaiM: findColumn(headers, HEADER_ALIASES.doDaiM),
    mang: findColumn(headers, HEADER_ALIASES.mang),
    hangPhe: findColumn(headers, HEADER_ALIASES.hangPhe),
    mau: findColumn(headers, HEADER_ALIASES.mau),
    giaRe: findColumn(headers, HEADER_ALIASES.giaRe),
    tcmn: findColumn(headers, HEADER_ALIASES.tcmn),
    nature: findColumn(headers, HEADER_ALIASES.nature),
    group: findColumn(headers, HEADER_ALIASES.group),
    unit: findColumn(headers, HEADER_ALIASES.unit),
    totalWeight: findColumn(headers, HEADER_ALIASES.totalWeight),
    wastePercent: findColumn(headers, HEADER_ALIASES.wastePercent),
    rollWidth: findColumn(headers, HEADER_ALIASES.rollWidth),
    rollLength: findColumn(headers, HEADER_ALIASES.rollLength),
    coreWeight: findColumn(headers, HEADER_ALIASES.coreWeight),
    bagWeight: findColumn(headers, HEADER_ALIASES.bagWeight),
    plasticWeight: findColumn(headers, HEADER_ALIASES.plasticWeight),
    openingStock: findColumn(headers, HEADER_ALIASES.openingStock),
    inbound: findColumn(headers, HEADER_ALIASES.inbound),
    outbound: findColumn(headers, HEADER_ALIASES.outbound),
    stock: findColumn(headers, stockAliases),
    minStock: findColumn(headers, HEADER_ALIASES.minStock),
    origin: findColumn(headers, HEADER_ALIASES.origin),
    description: findColumn(headers, HEADER_ALIASES.description)
  } as const;

  // Nếu "ton" trùng cột đã dùng cho tồn đầu / tồn TT thì bỏ
  if (
    indices.stock >= 0 &&
    (indices.stock === indices.openingStock || indices.stock === indices.minStock)
  ) {
    const exactTon = headers.findIndex(header => header === 'ton');
    (indices as { stock: number }).stock =
      exactTon >= 0 && exactTon !== indices.openingStock && exactTon !== indices.minStock
        ? exactTon
        : -1;
  }
  // "Mét dài" không được trùng cột "Mét dài ĐM (m)".
  if (
    indices.doDaiM >= 0
    && indices.doDaiTamTieuChuan >= 0
    && indices.doDaiM === indices.doDaiTamTieuChuan
  ) {
    const exactMetDai = headers.findIndex(header => header === 'met dai');
    (indices as { doDaiM: number }).doDaiM =
      exactMetDai >= 0 && exactMetDai !== indices.doDaiTamTieuChuan ? exactMetDai : -1;
  }
  // "Màu" không được khớp nhầm "mau amis" nếu có.
  if (indices.mau >= 0 && headers[indices.mau]?.includes('amis')) {
    const exactMau = headers.findIndex(header => header === 'mau');
    (indices as { mau: number }).mau = exactMau;
  }

  return matrix
    .slice(1)
    .map((row, index) => {
      const get = (key: keyof typeof indices) => {
        const col = indices[key];
        return col >= 0 ? cellToText(row[col]) : '';
      };
      const codeRaw = get('code');
      const amisRaw = get('amisCode');
      // File miền nam / Phú Thọ chỉ có Mã AMIS → dùng luôn làm mã SP.
      const amisCode = amisRaw || codeRaw;
      const code = codeRaw || amisCode;
      return {
        code,
        amisCode,
        amisOldCode: get('amisOldCode'),
        newCode: get('newCode'),
        name: get('name'),
        productionName: get('productionName'),
        tenGoc: get('tenGoc'),
        doLi: get('doLi'),
        doLiDm: get('doLiDm'),
        zem: get('zem'),
        soSong: get('soSong'),
        dinhMucKg: get('dinhMucKg'),
        doDaiTamTieuChuan: get('doDaiTamTieuChuan'),
        tcmb: get('tcmb'),
        doDayM: get('doDayM'),
        doDaiM: get('doDaiM'),
        mang: get('mang'),
        hangPhe: get('hangPhe'),
        mau: get('mau'),
        giaRe: get('giaRe'),
        tcmn: get('tcmn'),
        nature: get('nature'),
        group: get('group'),
        unit: get('unit'),
        totalWeight: get('totalWeight'),
        wastePercent: get('wastePercent'),
        rollWidth: get('rollWidth'),
        rollLength: get('rollLength'),
        coreWeight: get('coreWeight'),
        bagWeight: get('bagWeight'),
        plasticWeight: get('plasticWeight'),
        openingStock: get('openingStock'),
        inbound: get('inbound'),
        outbound: get('outbound'),
        stock: get('stock'),
        minStock: get('minStock'),
        origin: get('origin'),
        description: get('description'),
        rowNumber: index + 2
      };
    })
    .filter(row => Boolean(row.code.trim() || row.name.trim()));
}

export function downloadProductCatalogExcelTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...PRODUCT_CATALOG_EXCEL_HEADERS],
    // Sóng — tên gốc chỉ loại SP
    [
      'STS02-11s-6zem',
      'Tấm nhựa sóng Standart màu xanh 11 sóng 6 zem',
      'NHỰA SÓNG XANH - 11 SÓNG - 6ZEM - (đm 5.2 kg/6m) - 2m',
      'TP; PX Sóng',
      'Tấm',
      'NHỰA SÓNG',
      '11',
      '6ZEM',
      '',
      '',
      '',
      '',
      '',
      '(đm 5.2 kg)',
      '6m',
      '1.08m',
      '2m',
      'XANH',
      '',
      '',
      ''
    ],
    // Đặc
    [
      'STD02-10li*1.22m',
      'Tấm nhựa đặc Standard màu xanh da trời 10li',
      'Tấm nhựa đặc màu XDT - STD - 10li - (đm 9.7 li) - 1.22m - 9m',
      'TP; PX Đặc',
      'Cuộn',
      'Tấm nhựa đặc',
      '',
      '',
      '',
      'STD',
      '',
      '10li',
      '(đm 9.7 li)',
      '',
      '',
      '1.22m',
      '9m',
      'XDT',
      '',
      '',
      ''
    ]
  ]);
  worksheet['!cols'] = PRODUCT_CATALOG_EXCEL_HEADERS.map(header => ({
    wch: Math.min(34, Math.max(12, header.length + 2))
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sản phẩm');
  XLSX.writeFile(workbook, 'mau-danh-muc-san-pham.xlsx');
}

/** ĐVT import: "CUỘN, TẤM" (ghi cả 2) chuẩn hóa về "Tấm"; còn lại giữ nguyên. */
export function normalizeImportUnit(raw: string): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const low = text.toLocaleLowerCase('vi');
  const hasCuon = low.includes('cuộn') || low.includes('cuon');
  const hasTam = low.includes('tấm') || low.includes('tam');
  if (hasCuon && hasTam) return 'Tấm';
  return text;
}

/** Ô TCMB: `x`, `X`, `1`, `true`, `có`, `tcmb` → có. */
export function parseTcmbCell(value: unknown): boolean {
  const t = String(value ?? '').trim().toLocaleLowerCase('vi');
  if (!t) return false;
  return /^(x|1|true|yes|y|có|co|tcmb|✓|✔)$/iu.test(t);
}

/** Ô ZEM: `6`, `6zem`, `6 ZEM` → `6ZEM`. */
export function normalizeZemCell(value: unknown): string {
  const t = String(value ?? '').trim();
  if (!t) return '';
  const token = extractZemToken(t);
  if (token) return token;
  const n = t.match(/\d+/);
  return n ? `${Number(n[0])}ZEM` : '';
}

/** Ô số sóng: `11`, `11 sóng` → `11`. */
export function normalizeSoSongCell(value: unknown): string {
  const t = String(value ?? '');
  const m = t.match(/\d+/);
  return m ? String(Number(m[0])) : '';
}

/** Hàng phế: chỉ lấy cột Excel hoặc marker tường minh trong tên SX — không suy từ token NP. */
export function resolveImportHangPhe(input: {
  hangPheExcel?: string;
  productionName?: string;
  group?: string;
}): string {
  const fromExcel = String(input.hangPheExcel || '').trim();
  if (fromExcel) {
    if (/GIÁ\s+RẺ/iu.test(fromExcel)) return '(GIÁ RẺ)';
    if (/^100%\s*NS$/iu.test(fromExcel)) return '100% NS';
    if (/NS\s*Off/iu.test(fromExcel)) return 'hàng chạy 100% NS Off';
    return fromExcel;
  }
  const productionName = String(input.productionName || '').trim();
  const fromName = extractHangPhe(productionName);
  if (classifyProductPxGroup(input.group || '') === 'dac') {
    return resolveDacHangPhe(productionName, fromName);
  }
  return fromName;
}

export type ProductCatalogPayload = ReturnType<typeof buildProductCatalogPayload>;

function buildProductCatalogPayload(row: ProductCatalogExcelRow) {
  const productionName = row.productionName.trim();
  const group = row.group.trim();
  const amisCode = (row.amisCode.trim() || row.code.trim());
  const code = (row.code.trim() || amisCode);
  const seeded = seedProductionSpecs({
    tenSanXuat: productionName,
    maAmis: amisCode,
    nhomVthh: group
  });
  // Độ li Excel ghi tay phải hợp lệ (…li, chấp nhận `10i`) — chứa KG hay ZEM thì
  // không phải độ li, bỏ qua để dùng giá trị suy từ tên SX.
  const rawDoLi = row.doLi.trim();
  const doLi = normalizeDoLiToken(rawDoLi) || seeded.doLi;
  // Ô đm li / đm kg tách riêng; file cũ ghi `(đm n kg)` vào cột đm li vẫn nhận.
  const rawDm = row.doLiDm.trim();
  let doLiDm = '';
  let dinhMucKg = '';
  if (rawDm) {
    if (/\bkg\b/iu.test(rawDm)) dinhMucKg = normalizeDinhMucKg(rawDm);
    else doLiDm = normalizeDoLiDm(rawDm);
  }
  // Chỉ nhánh `(đm n li)`. `(đm n kg)` đã nằm ở dinhMucKg — gán vào doLiDm sẽ bị compose in hai lần.
  doLiDm = doLiDm || extractDoLiDmLi(productionName) || seeded.doLiDm;
  dinhMucKg =
    normalizeDinhMucKg(String(row.dinhMucKg ?? '').trim()) ||
    dinhMucKg ||
    normalizeDinhMucKg(seeded.dinhMucKg);
  const pxGroup = classifyProductPxGroup(group);
  if (pxGroup === 'dac' || pxGroup === 'rong') dinhMucKg = '';
  const doDaiTamTieuChuan = pxGroup === 'dac' || pxGroup === 'rong'
    ? ''
    : resolveSongDoDaiTamTieuChuan(productionName, dinhMucKg, row.doDaiTamTieuChuan).replace(/,/g, '.');
  const zem = normalizeZemCell(row.zem) || seeded.zem;
  const soSong = normalizeSoSongCell(row.soSong) || seeded.soSong;
  const tcmb = parseTcmbCell(row.tcmb) ? 'TCMB' : seeded.tcmb;
  const mau = row.mau.trim() || seeded.mau;
  const giaRe = /giá\s*rẻ/iu.test(row.giaRe.trim()) || /giá\s*rẻ/iu.test(row.hangPhe)
    ? 'Giá rẻ'
    : seeded.giaRe;
  const tcmn = /tcmn/iu.test(row.tcmn.trim()) ? 'TCMN' : seeded.tcmn;
  // Tên gốc: ưu tiên ô Excel (chỉ loại SP như miền nam); thiếu thì suy theo nhóm.
  const tenGoc = stripDuplicateLiFromTenGoc(
    row.tenGoc.trim() || defaultTenGoc(group) || seeded.tenGoc,
    doLi
  );
  // DB / hệ thống dùng `.` thập phân (`1,08` → `1.08`).
  const doDayM = (row.doDayM.trim() || seeded.doDayM).replace(/,/g, '.');
  const doDaiM = (row.doDaiM.trim() || seeded.doDaiM).replace(/,/g, '.');
  const mang = row.mang.trim() || seeded.mang;
  const hangPhe = resolveImportHangPhe({
    hangPheExcel: row.hangPhe,
    productionName,
    group
  });
  const unit = normalizeImportUnit(row.unit);
  // Canonical: chỉ lưu ten_san_xuat (chuỗi đã ghép) — đã bỏ ten_ghep trên danh mục SP.
  const composedName = composeProductionDisplayName(
    {
      tenGoc,
      mau,
      giaRe,
      tcmn,
      np: seeded.np,
      off: seeded.off,
      doLi,
      doLiDm,
      dinhMucKg,
      doDaiTamTieuChuan,
      zem,
      soSong,
      tcmb,
      doDayM,
      doDaiM,
      mang,
      hangPhe
    },
    group
  );
  return {
    code,
    newCode: row.newCode.trim(),
    amisCode,
    amisOldCode: row.amisOldCode.trim(),
    name: row.name.trim(),
    productionName: composedName || productionName,
    tenGoc,
    mau,
    giaRe,
    tcmn,
    doLi,
    doLiDm,
    dinhMucKg,
    doDaiTamTieuChuan,
    zem,
    soSong,
    tcmb: Boolean(tcmb),
    doDayM,
    doDaiM,
    mang,
    hangPhe,
    nature: row.nature.trim() || 'Thành phẩm',
    group,
    unit,
    wastePercent: row.wastePercent.trim().replace(',', '.'),
    // Không lưu cột đã DROP trên san_pham (nguon_goc / nhap-xuat / sl_ton / trọng lượng cuộn…).
    openingStock: row.openingStock.trim(),
    minStock: row.minStock.trim(),
    description: row.description.trim()
  };
}

/** Cột Excel tương ứng field payload — ô trống khi update thì bỏ field để giữ giá trị DB. */
const UPDATE_OMIT_WHEN_EXCEL_EMPTY: Array<{
  excel: keyof ProductCatalogExcelRow;
  payload: Array<keyof ReturnType<typeof buildProductCatalogPayload>>;
}> = [
  { excel: 'newCode', payload: ['newCode'] },
  { excel: 'amisOldCode', payload: ['amisOldCode'] },
  { excel: 'name', payload: ['name'] },
  { excel: 'nature', payload: ['nature'] },
  { excel: 'group', payload: ['group'] },
  { excel: 'unit', payload: ['unit'] },
  { excel: 'totalWeight', payload: ['totalWeight'] },
  { excel: 'wastePercent', payload: ['wastePercent'] },
  { excel: 'rollWidth', payload: ['rollWidth'] },
  { excel: 'rollLength', payload: ['rollLength'] },
  { excel: 'coreWeight', payload: ['coreWeight'] },
  { excel: 'bagWeight', payload: ['bagWeight'] },
  { excel: 'plasticWeight', payload: ['plasticWeight'] },
  { excel: 'openingStock', payload: ['openingStock'] },
  { excel: 'inbound', payload: ['inbound'] },
  { excel: 'outbound', payload: ['outbound'] },
  { excel: 'stock', payload: ['stock'] },
  { excel: 'minStock', payload: ['minStock'] },
  { excel: 'origin', payload: ['origin'] },
  { excel: 'description', payload: ['description'] },
  { excel: 'tenGoc', payload: ['tenGoc'] },
  { excel: 'mau', payload: ['mau'] },
  { excel: 'giaRe', payload: ['giaRe'] },
  { excel: 'tcmn', payload: ['tcmn'] },
  { excel: 'doLi', payload: ['doLi'] },
  { excel: 'doLiDm', payload: ['doLiDm'] },
  { excel: 'dinhMucKg', payload: ['dinhMucKg'] },
  { excel: 'doDaiTamTieuChuan', payload: ['doDaiTamTieuChuan'] },
  { excel: 'zem', payload: ['zem'] },
  { excel: 'soSong', payload: ['soSong'] },
  { excel: 'tcmb', payload: ['tcmb'] },
  { excel: 'doDayM', payload: ['doDayM'] },
  { excel: 'doDaiM', payload: ['doDaiM'] },
  { excel: 'mang', payload: ['mang'] },
  { excel: 'hangPhe', payload: ['hangPhe'] }
];

function excelCellFilled(row: ProductCatalogExcelRow, key: keyof ProductCatalogExcelRow) {
  return String(row[key] ?? '').trim() !== '';
}

/**
 * Payload import danh mục.
 * `forUpdate: true` → bỏ field tương ứng ô Excel trống (giữ giá trị đang có trong DB).
 * Khi có `Tên sản xuất mới` thì vẫn ghép lại ten_san_xuat / ten_ghep + thông số suy từ tên.
 */
export function productCatalogRowToPayload(
  row: ProductCatalogExcelRow,
  options?: { forUpdate?: boolean }
) {
  const full = buildProductCatalogPayload(row);
  if (!options?.forUpdate) return full;

  const next: Record<string, unknown> = {
    code: full.code,
    amisCode: full.amisCode
  };

  const hasProductionName = excelCellFilled(row, 'productionName');
  if (hasProductionName) {
    next.productionName = full.productionName;
    next.tenGhep = full.tenGhep;
    next.tenGoc = full.tenGoc;
    next.mau = full.mau;
    next.giaRe = full.giaRe;
    next.tcmn = full.tcmn;
    next.doLi = full.doLi;
    next.doLiDm = full.doLiDm;
    next.dinhMucKg = full.dinhMucKg;
    next.doDaiTamTieuChuan = full.doDaiTamTieuChuan;
    next.zem = full.zem;
    next.soSong = full.soSong;
    next.tcmb = full.tcmb;
    next.doDayM = full.doDayM;
    next.doDaiM = full.doDaiM;
    next.mang = full.mang;
    next.hangPhe = full.hangPhe;
  }

  for (const rule of UPDATE_OMIT_WHEN_EXCEL_EMPTY) {
    if (!excelCellFilled(row, rule.excel)) continue;
    // productionName đã gắn cụm thông số ở trên; cột lẻ vẫn ghi đè khi có giá trị Excel.
    for (const key of rule.payload) {
      next[key] = full[key];
    }
  }

  if (excelCellFilled(row, 'name')) next.name = full.name;
  if (excelCellFilled(row, 'nature')) next.nature = full.nature;

  return next as typeof full & { id?: string };
}

export type ProductCatalogImportExisting = {
  id: string;
  code: string;
  amisCode?: string;
  name: string;
  productionName?: string;
};

export type ProductCatalogImportPlanItem = {
  rowNumber: number;
  action: 'create' | 'update' | 'skip';
  code: string;
  name: string;
  productionName: string;
  existingId?: string;
  warnings: string[];
  clearedFields: string[];
  payload: Record<string, unknown>;
};

export type ProductCatalogImportPlan = {
  items: ProductCatalogImportPlanItem[];
  duplicateCodeGroups: Array<{ code: string; rowNumbers: number[] }>;
  createCount: number;
  updateCount: number;
  skipCount: number;
  warningCount: number;
};

function normalizeImportCodeKey(code: string) {
  return String(code || '')
    .trim()
    .replace(/[\s\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]+/g, '')
    .toUpperCase();
}

function normalizeImportNameKey(value: string) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '');
}

/** Lập kế hoạch import: tạo/cập nhật, mã trùng trong file, cảnh báo khớp sai nhận diện. */
export function buildProductCatalogImportPlan(
  rows: ProductCatalogExcelRow[],
  existingProducts: ProductCatalogImportExisting[]
): ProductCatalogImportPlan {
  const byCode = new Map<string, ProductCatalogImportExisting>();
  for (const product of existingProducts) {
    const keys = [product.code, product.amisCode || '']
      .map(normalizeImportCodeKey)
      .filter(Boolean);
    for (const key of keys) {
      if (!byCode.has(key)) byCode.set(key, product);
    }
  }

  const codeRows = new Map<string, number[]>();
  for (const row of rows) {
    const code = normalizeImportCodeKey(row.code.trim() || row.amisCode.trim());
    if (!code) continue;
    const list = codeRows.get(code) || [];
    list.push(row.rowNumber);
    codeRows.set(code, list);
  }
  const duplicateCodeGroups = [...codeRows.entries()]
    .filter(([, rowNumbers]) => rowNumbers.length > 1)
    .map(([code, rowNumbers]) => ({ code, rowNumbers }));

  const draftItems: ProductCatalogImportPlanItem[] = [];
  for (const row of rows) {
    const warnings: string[] = [];
    const code = (row.code.trim() || row.amisCode.trim());
    const name = row.name.trim();
    if (!code && !name) {
      draftItems.push({
        rowNumber: row.rowNumber,
        action: 'skip',
        code: '',
        name: '',
        productionName: '',
        warnings: [`dòng ${row.rowNumber}: thiếu mã SP và tên`],
        clearedFields: [],
        payload: {}
      });
      continue;
    }

    const codeKey = normalizeImportCodeKey(code);
    const existing = codeKey ? byCode.get(codeKey) : undefined;
    const duplicate = duplicateCodeGroups.find(group => group.code === codeKey);
    if (duplicate) {
      warnings.push(
        `Mã ${code} trùng ${duplicate.rowNumbers.length} dòng trong file (dòng ${duplicate.rowNumbers.join(', ')}); giữ dòng cuối.`
      );
    }

    if (existing) {
      const sameName =
        !name ||
        normalizeImportNameKey(name) === normalizeImportNameKey(existing.name);
      const excelProduction = row.productionName.trim();
      const sameProduction =
        !excelProduction ||
        normalizeImportNameKey(excelProduction) ===
          normalizeImportNameKey(existing.productionName || '');
      if (!sameName || !sameProduction) {
        warnings.push(
          `Cùng mã ${existing.code} nhưng khác tên/tên SX so với bản ghi đang có — sẽ cập nhật ID ${existing.id}.`
        );
      }
    }

    const payload = productCatalogRowToPayload(row, { forUpdate: Boolean(existing) });
    const clearedFields: string[] = [];
    // Preview: các cột Excel trống sẽ không đụng DB (không còn bị xóa).
    if (existing) {
      for (const rule of UPDATE_OMIT_WHEN_EXCEL_EMPTY) {
        if (!excelCellFilled(row, rule.excel)) {
          clearedFields.push(String(rule.excel));
        }
      }
    }

    draftItems.push({
      rowNumber: row.rowNumber,
      action: existing ? 'update' : 'create',
      code: String(payload.code || code),
      name: String(payload.name || name),
      productionName: String(payload.productionName || row.productionName.trim()),
      existingId: existing?.id,
      warnings,
      clearedFields,
      payload: existing ? { ...payload, id: existing.id } : payload
    });
  }

  // Mã trùng trong file: last-wins — chỉ giữ dòng cuối cùng của mỗi mã.
  const lastByCode = new Map<string, ProductCatalogImportPlanItem>();
  const items: ProductCatalogImportPlanItem[] = [];
  for (const item of draftItems) {
    if (item.action === 'skip') {
      items.push(item);
      continue;
    }
    const key = normalizeImportCodeKey(item.code);
    if (!key) {
      items.push(item);
      continue;
    }
    lastByCode.set(key, item);
  }
  items.push(...lastByCode.values());
  items.sort((a, b) => a.rowNumber - b.rowNumber);

  return {
    items,
    duplicateCodeGroups,
    createCount: items.filter(item => item.action === 'create').length,
    updateCount: items.filter(item => item.action === 'update').length,
    skipCount: items.filter(item => item.action === 'skip').length,
    warningCount: items.reduce((sum, item) => sum + item.warnings.length, 0)
  };
}
