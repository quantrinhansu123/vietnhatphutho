/**
 * Mô-đun tạo HTML và kích hoạt in Phiếu giao ca kiêm nhật ký sản xuất
 * Thiết kế 2 trang A4 dọc. Mọi chữ xuống dòng, không cắt bằng dấu ba chấm.
 * Phần chưa kín trang được chèn ô trống cho đủ trang, không tràn thêm trang.
 * - Trang 1: Header + I. VẬT TƯ (L1..L10, tồn đầu, lấy kho, tồn cuối, giao ca)
 * - Trang 2: II. THÀNH PHẨM (trái) + III. HÀNG LỖI PHẾ (phải trên) + IV. SỰ CỐ / LƯU Ý (phải dưới) + 4 Chữ ký chân trang
 */

import { vietNhatLogoUrl } from '../../components/layout/constants';
import { parseSlipNumber } from './parseSlipNumber';
import { formatTongSuCo, gioSuCoRow, kgSuCo, parseSuCo, tongSuCo } from './suCoGiaoCa';

export { parseSlipNumber };

export interface PhieuGiaoCaHeader {
  tieuDeMay: string;
  kyHieu: string;
  lanBanHanh: string;
  ngayHieuLuc: string;
  gioTu: string;
  gioDen: string;
  ngay: string; // YYYY-MM-DD
  soPhieu: string;
  nguoiThucHien: string;
  tenMay: string;
}

export interface PhieuGiaoCaVatTuRow {
  key: string;
  material_id?: string;
  ma_nvl: string;
  ten_nvl: string;
  ten_nvl_sx?: string;
  dvt: string;
  dinh_muc: string;
  ton_dau_ca: string | number;
  lay_trong_kho: string | number;
  lan: string[]; // 10 lần
  tong_su_dung: number;
  ton_cuoi_ca: number;
}

export interface PhieuGiaoCaThanhPhamRow {
  key: string;
  ma_sp: string;
  ten_sp: string;
  dinh_muc: string;
  lan_1: string;
  lan_2: string;
  lan_3: string;
  so_luong: string | number; // Tổng nhập kho
  trong_luong: string | number; // Tổng trọng lượng
  ghi_chu?: string;
}

export interface PhieuGiaoCaHangLoiRow {
  key: string;
  ten_loi: string;
  dvt: string;
  so_luong: string | number;
}

export interface PhieuGiaoCaInput {
  header: PhieuGiaoCaHeader;
  vatTu: PhieuGiaoCaVatTuRow[];
  giaoCaNote: string;
  thanhPham: PhieuGiaoCaThanhPhamRow[];
  hangLoi: PhieuGiaoCaHangLoiRow[];
  suCoLuuY: string;
  chuKy: {
    thuKhoVatTu: string;
    truongCa: string;
    thuKhoThanhPham: string;
    keHoachSanXuat: string;
  };
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function num(value: unknown): number {
  return parseSlipNumber(value);
}

/** Phần nghìn `,`, thập phân `.`, một chữ số (vd 1,234.6). */
function fmt(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  if (rounded === 0) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(rounded);
}

/** Hiển thị số trên xem trước và bản in. Giữ nguyên khi đang gõ dở `12.` hoặc `12,`. */
export function formatSlipNumber(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.endsWith('.') || text.endsWith(',')) return text;
  const parsed = parseSlipNumber(text);
  if (!Number.isFinite(parsed)) return text;
  if (parsed === 0) return /^-?0(?:[,.]0*)?$/.test(text) ? '0.0' : '';
  return fmt(parsed);
}

function printNum(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return fmt(num(value));
}

function numCell(value: unknown, _widthPct?: number, extraClass = ''): string {
  const text = printNum(value);
  if (!text) return `<td class="num ${extraClass}">&nbsp;</td>`;
  return `<td class="num ${extraClass}">${esc(text)}</td>`;
}

function splitNgay(ngay: string) {
  const m = String(ngay || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const now = new Date();
    return {
      d: String(now.getDate()).padStart(2, '0'),
      m: String(now.getMonth() + 1).padStart(2, '0'),
      y: String(now.getFullYear())
    };
  }
  return { d: m[3], m: m[2], y: m[1] };
}

export function buildPhieuGiaoCaHtml(input: PhieuGiaoCaInput): string {
  const { d, m, y } = splitNgay(input.header.ngay);
  const tenMayUpper = (input.header.tieuDeMay || input.header.tenMay || 'SÓNG 2').trim().toUpperCase();

  // Tính tổng sử dụng vật tư
  const tongCongSuDungVatTu = input.vatTu.reduce((sum, r) => sum + (r.tong_su_dung || 0), 0);

  // Cột lần trống trên mọi dòng thì không in.
  const usedLan = Array.from({ length: 10 }, (_, index) => index).filter(index =>
    input.vatTu.some(row => printNum(row?.lan?.[index] ?? '') !== '')
  );
  const vatTuCells = 8 + usedLan.length;
  const vatTuColWidths = (() => {
    const ma = 5;
    const dvt = 4;
    const numCols = 5 + usedLan.length;
    const minTen = 10;
    let num = 6.5;
    let ten = 100 - ma - dvt - num * numCols;
    if (ten < minTen) {
      ten = minTen;
      num = numCols > 0 ? (100 - ma - dvt - ten) / numCols : num;
    }
    num = Math.round(num * 10) / 10;
    ten = Math.round((100 - ma - dvt - num * numCols) * 10) / 10;
    return [ma, ten, dvt, num, num, num, ...usedLan.map(() => num), num, num];
  })();
  const vatTuColsHtml = vatTuColWidths.map(width => `<col style="width:${width}%" />`).join('');
  const headSpan = usedLan.length > 0 ? ' rowspan="2"' : '';
  const lanHeadHtml = usedLan.length > 0
    ? `<tr>${usedLan.map(index => `<th class="th-lan">Lần<br>${index + 1}</th>`).join('')}</tr>`
    : '';
  const suDungHeadHtml = usedLan.length > 0
    ? `<th colspan="${usedLan.length}">SỬ DỤNG</th>`
    : '';
  const tongLanHtml = usedLan.length > 0
    ? `<td colspan="${usedLan.length}" class="num b">${tongCongSuDungVatTu > 0 ? esc(fmt(tongCongSuDungVatTu)) : ''}</td>`
    : '';

  const vatTuRowsHtml = input.vatTu
    .map((row) => {
      const lanCells = usedLan.map(index => numCell(row?.lan?.[index] ?? '', 5)).join('');

      return `
      <tr class="grid-row">
        <td class="c font-mono">${esc(row?.ma_nvl ?? '') || '&nbsp;'}</td>
        <td class="l ten" title="${esc(row?.ten_nvl_sx || row?.ten_nvl || '')}">${esc(row?.ten_nvl_sx || row?.ten_nvl || '') || '&nbsp;'}</td>
        <td class="c">${esc(row?.dvt ?? (row ? 'Kg' : '')) || '&nbsp;'}</td>
        ${numCell(row?.dinh_muc ?? '', 8)}
        ${numCell(row && row.ton_dau_ca !== '' && row.ton_dau_ca !== 0 ? row.ton_dau_ca : '', 7.5)}
        ${numCell(row && row.lay_trong_kho !== '' && row.lay_trong_kho !== 0 ? row.lay_trong_kho : '', 7.5)}
        ${lanCells}
        ${numCell(row && row.tong_su_dung > 0 ? row.tong_su_dung : '', 7.5, 'b')}
        ${numCell(row ? row.ton_cuoi_ca : '', 7.5, 'b')}
      </tr>
    `;
    })
    .join('');

  // Thành phẩm
  const tongNhapKhoThanhPham = input.thanhPham.reduce((sum, r) => sum + num(r.so_luong), 0);
  const tongTrongLuongThanhPham = input.thanhPham.reduce((sum, r) => sum + num(r.trong_luong), 0);
  const thanhPhamRowsHtml = input.thanhPham
    .map(row => {
      return `
      <tr class="grid-row">
        <td class="c font-mono">${esc(row?.ma_sp ?? '') || '&nbsp;'}</td>
        <td class="l ten" title="${esc(row?.ten_sp ?? '')}">${esc(row?.ten_sp ?? '') || '&nbsp;'}</td>
        ${numCell(row?.dinh_muc ?? '', 13)}
        ${numCell(row?.lan_1 ?? '', 8)}
        ${numCell(row?.lan_2 ?? '', 8)}
        ${numCell(row?.lan_3 ?? '', 8)}
        ${numCell(row ? row.so_luong : '', 12, 'b')}
        ${numCell(row ? row.trong_luong : '', 12, 'b')}
      </tr>
    `;
    })
    .join('');

  // Hàng lỗi
  const tongHangLoi = input.hangLoi.reduce((sum, r) => sum + num(r.so_luong), 0);
  const parsedSuCo = parseSuCo(input.suCoLuuY || '');
  const tongSuCoIn = tongSuCo(parsedSuCo.rows);
  const suCoRowsHtml = parsedSuCo.rows
    .map(row => {
      if (row.kind === 'tu_do') {
        const range =
          str(row.gio_tu) || str(row.gio_den) ? `${str(row.gio_tu) || '--:--'}–${str(row.gio_den) || '--:--'}` : '';
        const label = [str(row.ghi_chu) || 'Sự cố', range].filter(Boolean).join(' · ');
        return `
      <tr class="grid-row">
        <td class="l">${esc(label) || '&nbsp;'}</td>
        <td class="c">Tự do</td>
        <td class="c">${esc(str(row.tong_gio)) || '&nbsp;'}</td>
        <td class="c">—</td>
      </tr>`;
      }
      return `
      <tr class="grid-row">
        <td class="l">${esc(row.ten) || '&nbsp;'}</td>
        <td class="c">${esc(String(row.lan).trim()) || '&nbsp;'}</td>
        <td class="c">${esc(gioSuCoRow(row)) || '&nbsp;'}</td>
        <td class="c">${esc(kgSuCo(row.ten, row.lan)) || '&nbsp;'}</td>
      </tr>`;
    })
    .join('');
  const suCoNote = parsedSuCo.note.trim();
  const hangLoiRowsHtml = input.hangLoi
    .map(row => {
      return `
      <tr class="grid-row">
        <td class="l">${esc(row?.ten_loi ?? '') || '&nbsp;'}</td>
        <td class="c">${esc(row?.dvt ?? (row ? 'Kg' : '')) || '&nbsp;'}</td>
        ${numCell(row ? row.so_luong : '', 30, 'b')}
      </tr>
    `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>${esc(tenMayUpper)} - NHẬT KÝ SẢN XUẤT KIÊM PHIẾU GIAO CA</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 5mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      width: 200mm;
    }
    body {
      font-family: "Times New Roman", Times, serif, Arial;
      font-size: 10pt;
      line-height: 1.25;
      color: #000;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .page {
      width: 100%;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
      clear: both;
    }
    .sheet-body {
      display: block;
    }
    
    /* Header layout */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
    }
    .header-table td {
      border: none;
      padding: 0;
      vertical-align: middle;
    }
    .logo-img {
      max-height: 48px;
      max-width: 140px;
      object-fit: contain;
    }
    .main-title {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 0;
      text-transform: uppercase;
      padding: 0 2px;
      white-space: normal;
      overflow-wrap: anywhere;
      line-height: 1.25;
    }
    .iso-box {
      border: 0.5pt solid #000;
      padding: 2px 4px;
      font-size: 12px;
      line-height: 1.2;
      width: 132px;
      margin-left: auto;
    }

    /* Sub-header meta */
    .meta-bar {
      margin-top: 2px;
      margin-bottom: 2px;
      font-size: 16px;
      line-height: 1.3;
    }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: baseline;
      gap: 2px 10px;
      margin-bottom: 2px;
    }
    .underline-fill {
      border-bottom: 1px dotted #444;
      display: inline-block;
      min-width: 28px;
      max-width: 100%;
      text-align: center;
      font-weight: bold;
      padding: 0 2px;
      white-space: normal;
      overflow-wrap: anywhere;
      vertical-align: bottom;
    }

    /* Section titles */
    .sec-title {
      font-size: 16px;
      font-weight: bold;
      margin: 2px 0 2px 0;
      text-transform: uppercase;
    }

    /* Tables */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.data-table th,
    table.data-table td {
      border: 0.5pt solid #000;
      padding: 1px 1px;
      font-size: 16px;
      color: #000;
      vertical-align: middle;
      height: auto;
      max-height: none;
      overflow: visible;
      white-space: normal;
      text-overflow: clip;
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: 1.2;
    }
    table.data-table th {
      background-color: #f7f7f7;
      font-weight: bold;
      text-align: center;
      font-size: 14px;
      padding: 2px 1px;
      overflow: hidden;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    table.data-table th.th-ten {
      text-align: center;
      padding: 2px 2px;
    }
    table.data-table tbody tr.grid-row,
    table.data-table tbody tr.grid-row td {
      height: auto;
      min-height: 8mm;
      max-height: none;
    }
    table.data-table tbody tr.blank-row,
    table.data-table tbody tr.blank-row td {
      height: 8mm;
      min-height: 8mm;
      max-height: 8mm;
      line-height: 8mm;
      padding: 0;
      overflow: hidden;
      white-space: nowrap;
    }
    table.data-table td.c { text-align: center; color: #000; }
    table.data-table td.l { text-align: left; color: #000; }
    table.data-table td.r { text-align: right; font-variant-numeric: tabular-nums; color: #000; }
    table.data-table td.num {
      font-size: 13px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      color: #000;
      white-space: nowrap;
      word-break: normal;
      overflow-wrap: normal;
      overflow: hidden;
      text-overflow: clip;
      line-height: 1.1;
      padding: 0 1px;
    }
    table.data-table th.th-lan {
      font-size: 14px;
      white-space: normal;
      line-height: 1.15;
      padding: 1px 0;
    }
    table.data-table th.th-ma {
      font-size: 12px;
    }
    table.data-table td.font-mono {
      font-family: "Times New Roman", Times, serif;
      font-size: 12px;
      color: #000;
      text-align: center;
      white-space: normal;
      word-break: break-all;
      overflow-wrap: anywhere;
      overflow: hidden;
      line-height: 1.15;
    }
    table.data-table td.b, table.data-table th.b { font-weight: bold; }
    table.data-table tr.total-row {
      break-before: avoid;
      page-break-before: avoid;
    }
    .font-mono {
      font-family: "Times New Roman", Times, serif;
      font-size: 12px;
      color: #000;
      white-space: normal;
      word-break: break-all;
      overflow-wrap: anywhere;
    }
    .sub { font-size: 6.5pt; color: #444; font-style: italic; }

    .bottom-note-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-top: 2mm;
      font-size: 16px;
      font-weight: bold;
      break-inside: avoid;
      page-break-inside: avoid;
      break-before: avoid;
      page-break-before: avoid;
      break-after: avoid;
      page-break-after: avoid;
    }

    /* Page 2 2-column layout */
    .p2-container {
      display: flex;
      gap: 8px;
      width: 100%;
      flex: 1 1 auto;
      align-items: stretch;
    }
    .p2-left {
      width: 64%;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .p2-right {
      width: 36%;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .notes-box {
      border: 0.5pt solid #000;
      min-height: 12mm;
      margin-top: 2mm;
      padding: 3px;
      font-size: 9pt;
      white-space: pre-wrap;
      line-height: 1.25;
      background: #fafafa;
      overflow-wrap: anywhere;
      text-align: left;
    }
    .su-co-table {
      font-size: 8pt;
      line-height: 1.2;
    }
    .su-co-table th,
    .su-co-table td {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    /* Chữ ký luôn một khối ở cuối trang 2. Nếu thành phẩm tràn, cả khối sang trang sau. */
    .signatures-row {
      margin-top: 3mm;
      display: flex;
      justify-content: space-between;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
      break-before: avoid;
      page-break-before: avoid;
    }
    .sig-col {
      width: 24%;
    }
    .sig-title {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 2px;
    }
    .sig-sub {
      font-size: 16px;
      font-style: italic;
      color: #444;
    }
    .sig-space {
      height: 50mm;
    }
    .sig-name {
      font-size: 16px;
      font-weight: bold;
      overflow-wrap: anywhere;
    }
  </style>
</head>
<body>

  <!-- TRANG 1: ẢNH 1 -->
  <div class="page">
    <table class="header-table">
      <tr>
        <td style="width: 25%; text-align: left;">
          ${vietNhatLogoUrl ? `<img src="${esc(vietNhatLogoUrl)}" class="logo-img" alt="Việt Nhật IPT">` : '<b>VIỆT NHẬT IPT</b>'}
        </td>
        <td style="width: 50%; text-align: center;">
          <div class="main-title">${esc(tenMayUpper)} - NHẬT KÝ SẢN XUẤT KIÊM PHIẾU GIAO CA</div>
        </td>
        <td style="width: 25%;">
          <div class="iso-box">
            <div>Ký hiệu: <b>${esc(input.header.kyHieu || 'BM02')}</b></div>
            <div>Lần ban hành: <b>${esc(input.header.lanBanHanh || '02')}</b></div>
            <div>Ngày hiệu lực: <b>${esc(input.header.ngayHieuLuc || '14/4/2022')}</b></div>
          </div>
        </td>
      </tr>
    </table>

    <div class="meta-bar">
      <div class="meta-row">
        <div>
          Ca sản xuất từ: <span class="underline-fill">${esc(input.header.gioTu || '6')}</span> H 
          Đến <span class="underline-fill">${esc(input.header.gioDen || '18')}</span> H 
          ngày <span class="underline-fill">${esc(d)}</span> 
          Tháng <span class="underline-fill">${esc(m)}</span> 
          Năm <span class="underline-fill" style="min-width: 50px;">${esc(y)}</span>
        </div>
        <div>
          Số phiếu: <span class="underline-fill" style="min-width: 36px;">${esc(input.header.soPhieu || '')}</span> / ${esc(y)}
        </div>
      </div>
      <div class="meta-row">
        <div style="flex: 1; margin-right: 20px;">
          Người thực hiện: <span class="underline-fill" style="min-width: 40px; text-align: left;">${esc(input.header.nguoiThucHien || '—')}</span>
        </div>
        <div>
          Máy: <span class="underline-fill" style="min-width: 40px;">${esc(input.header.tenMay || tenMayUpper)}</span>
        </div>
      </div>
    </div>

    <div class="sheet-body">
    <div class="sec-title">I. VẬT TƯ</div>
    <table class="data-table" data-fill="page" data-keep-total="1" data-cells="${vatTuCells}">
      <colgroup>
        ${vatTuColsHtml}
      </colgroup>
      <thead>
        <tr>
          <th${headSpan} class="th-ma">Mã vật tư</th>
          <th${headSpan} class="th-ten">Tên vật tư</th>
          <th${headSpan}>ĐVT</th>
          <th${headSpan}>Định mức<br>vật tư</th>
          <th${headSpan}>Tồn đầu<br>ca</th>
          <th${headSpan}>Lấy kho</th>
          ${suDungHeadHtml}
          <th${headSpan}>Tổng SD</th>
          <th${headSpan}>Tồn cuối</th>
        </tr>
        ${lanHeadHtml}
      </thead>
      <tbody>
        ${vatTuRowsHtml}
        <tr class="grid-row total-row" style="background-color: #f7f7f7;">
          <td colspan="6" class="l b" style="text-align: right; padding-right: 8px;">Cộng tổng sử dụng:</td>
          ${tongLanHtml}
          <td class="num b">${tongCongSuDungVatTu > 0 ? esc(fmt(tongCongSuDungVatTu)) : ''}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    </div>

    <div class="bottom-note-row">
      <div>
        ${input.giaoCaNote ? `Giao ca: <span class="underline-fill" style="min-width: 100px; text-align: left;">${esc(input.giaoCaNote)}</span>` : `Giao ca: <span class="underline-fill" style="min-width: 120px;"></span>`}
      </div>
      <div>
        Tổng sử dụng: <b>${esc(fmt(tongCongSuDungVatTu))} kg</b>
      </div>
    </div>
  </div>

  <!-- TRANG 2: ẢNH 2 -->
  <div class="page page-break">
    <div class="p2-container">
      
      <!-- Cột trái: II. THÀNH PHẨM -->
      <div class="p2-left">
        <div class="sec-title">II. THÀNH PHẨM</div>
        <table class="data-table" data-fill="page" data-cells="8">
          <colgroup>
            <col style="width:11%" />
            <col style="width:23%" />
            <col style="width:12%" />
            <col style="width:10%" />
            <col style="width:10%" />
            <col style="width:10%" />
            <col style="width:12%" />
            <col style="width:12%" />
          </colgroup>
          <thead>
            <tr>
              <th rowspan="2" class="th-ma">Mã TP</th>
              <th rowspan="2">Thành phẩm</th>
              <th rowspan="2">TL định mức/tấm (Kg)</th>
              <th colspan="3">TP Nhập kho</th>
              <th rowspan="2">Tổng nhập kho</th>
              <th rowspan="2">Tổng TL (Kg)</th>
            </tr>
            <tr>
              <th class="th-lan">Lần<br>1</th>
              <th class="th-lan">Lần<br>2</th>
              <th class="th-lan">Lần<br>3</th>
            </tr>
          </thead>
          <tbody>
            ${thanhPhamRowsHtml}
            <tr class="grid-row total-row" style="background-color: #f7f7f7;">
              <td colspan="6" class="l b" style="text-align: right; padding-right: 6px;">Cộng:</td>
              <td class="num b">${tongNhapKhoThanhPham > 0 ? esc(fmt(tongNhapKhoThanhPham)) : ''}</td>
              <td class="num b">${tongTrongLuongThanhPham > 0 ? esc(fmt(tongTrongLuongThanhPham)) : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Cột phải: III. HÀNG LỖI/PHẾ & IV. SỰ CỐ SẢN XUẤT -->
      <div class="p2-right">
        <div>
          <div class="sec-title">III. HÀNG LỖI HỎNG/PHẾ</div>
          <table class="data-table" data-fill="min" data-min="7" data-cells="3">
            <thead>
              <tr>
                <th style="width: 48%;">TÊN LỖI/PHẾ</th>
                <th style="width: 22%;">ĐVT</th>
                <th style="width: 30%;">SỐ LƯỢNG</th>
              </tr>
            </thead>
            <tbody>
              ${hangLoiRowsHtml}
              <tr class="grid-row total-row" style="background-color: #f7f7f7;">
                <td colspan="2" class="l b" style="text-align: right; padding-right: 6px;">Cộng:</td>
                <td class="num b">${tongHangLoi > 0 ? esc(fmt(tongHangLoi)) : ''}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 8px; text-align: left;">
          <div class="sec-title" style="text-align: left;">IV. SỰ CỐ SẢN XUẤT / LƯU Ý KHÁC</div>
          <table class="data-table su-co-table">
            <colgroup>
              <col style="width:42%" />
              <col style="width:16%" />
              <col style="width:18%" />
              <col style="width:24%" />
            </colgroup>
            <thead>
              <tr>
                <th>Sự cố</th>
                <th>Số lần</th>
                <th>Số giờ</th>
                <th>Giảm trừ kg</th>
              </tr>
            </thead>
            <tbody>
              ${suCoRowsHtml || '<tr class="grid-row"><td colspan="4" class="c" style="color:#888;">(Không có sự cố ghi nhận)</td></tr>'}
              <tr class="grid-row total-row" style="background-color: #f7f7f7;">
                <td colspan="4" class="l b">Tổng: ${esc(formatTongSuCo(tongSuCoIn.gio))} giờ | ${esc(formatTongSuCo(tongSuCoIn.kg))} kg</td>
              </tr>
            </tbody>
          </table>
          ${suCoNote ? `<div class="notes-box">${esc(suCoNote)}</div>` : ''}
        </div>
      </div>

    </div>

    <!-- 4 Khối chữ ký ở chân trang 2 -->
    <div class="signatures-row">
      <div class="sig-col">
        <div class="sig-title">Thủ kho vật tư</div>
        <div class="sig-sub">(Ký, họ tên)</div>
        <div class="sig-space"></div>
        <div class="sig-name">${esc(input.chuKy.thuKhoVatTu || '')}</div>
      </div>
      <div class="sig-col">
        <div class="sig-title">Trưởng ca sản xuất</div>
        <div class="sig-sub">(Giao ca sau - Ký, họ tên)</div>
        <div class="sig-space"></div>
        <div class="sig-name">${esc(input.chuKy.truongCa || '')}</div>
      </div>
      <div class="sig-col">
        <div class="sig-title">Thủ kho thành phẩm</div>
        <div class="sig-sub">(Ký, họ tên)</div>
        <div class="sig-space"></div>
        <div class="sig-name">${esc(input.chuKy.thuKhoThanhPham || '')}</div>
      </div>
      <div class="sig-col">
        <div class="sig-title">Kế hoạch sản xuất</div>
        <div class="sig-sub">(Ký, họ tên)</div>
        <div class="sig-space"></div>
        <div class="sig-name">${esc(input.chuKy.keHoachSanXuat || '')}</div>
      </div>
    </div>
  </div>

<script>
(function () {
  function mm(value) {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:0;top:0;height:' + value + 'mm;width:0;visibility:hidden;';
    document.body.appendChild(probe);
    var height = probe.offsetHeight;
    probe.remove();
    return height;
  }
  function makeRow(cells) {
    var tr = document.createElement('tr');
    tr.className = 'grid-row blank-row';
    for (var i = 0; i < cells; i++) {
      var td = document.createElement('td');
      td.innerHTML = '&nbsp;';
      tr.appendChild(td);
    }
    return tr;
  }
  var pagePx = mm(287);
  var slack = mm(6);
  var reserve = mm(18);
  var rowNeed = mm(8);
  function edgeY(page, el, edge) {
    var pageTop = page.getBoundingClientRect().top;
    var box = el.getBoundingClientRect();
    var y = (edge === 'bottom' ? box.bottom : box.top) - pageTop;
    if (edge === 'bottom') y = Math.max(0, y - 1);
    return Math.max(0, y);
  }
  function pageIndex(page, el, edge) {
    return Math.floor(edgeY(page, el, edge) / pagePx);
  }
  function lastDataRow(tbody) {
    var rows = tbody ? tbody.rows : [];
    for (var i = rows.length - 1; i >= 0; i--) {
      if (!rows[i].classList.contains('blank-row') && !rows[i].classList.contains('total-row')) return rows[i];
    }
    return null;
  }
  function totalFitsOnDataPage(page, tbody, total, note) {
    if (!total) return true;
    var dataRow = lastDataRow(tbody);
    var dataPage = dataRow ? pageIndex(page, dataRow, 'top') : 0;
    var limit = (dataPage + 1) * pagePx - reserve;
    var totalBottom = edgeY(page, total, 'bottom');
    var noteBottom = note ? edgeY(page, note, 'bottom') : totalBottom;
    return pageIndex(page, total, 'top') <= dataPage && noteBottom <= limit;
  }
  function tryAdd(page, tbody, total, cells, note, keepWithData) {
    var anchor = note || total;
    if (keepWithData && anchor && !totalFitsOnDataPage(page, tbody, total, note)) return false;
    if (keepWithData && anchor) {
      var dataRow = lastDataRow(tbody);
      var dataPage = dataRow ? pageIndex(page, dataRow, 'top') : 0;
      var room = (dataPage + 1) * pagePx - reserve - edgeY(page, anchor, 'bottom');
      if (room < rowNeed) return false;
    } else {
      var before = page.offsetHeight;
      var used = before % pagePx;
      if (used === 0 || used <= slack) return false;
      if (pagePx - used - slack < rowNeed) return false;
    }
    var tr = makeRow(cells);
    if (total && total.parentNode === tbody) tbody.insertBefore(tr, total);
    else tbody.appendChild(tr);
    if (keepWithData) {
      if (!totalFitsOnDataPage(page, tbody, total, note)) {
        tr.remove();
        return false;
      }
      return true;
    }
    var after = page.offsetHeight;
    var crossed = Math.floor(after / pagePx) > Math.floor((after - tr.offsetHeight) / pagePx);
    if (crossed) {
      tr.remove();
      return false;
    }
    return true;
  }
  function layoutSlip() {
    document.querySelectorAll('tr.blank-row').forEach(function (row) { row.remove(); });
    document.querySelectorAll('table[data-fill="min"]').forEach(function (table) {
      var cells = Number(table.getAttribute('data-cells')) || 1;
      var min = Number(table.getAttribute('data-min')) || 0;
      var page = table.closest('.page');
      var tbody = table.tBodies[0];
      if (!page || !tbody) return;
      var total = tbody.querySelector('tr.total-row');
      var note = page.querySelector('.bottom-note-row');
      var data = Array.prototype.filter.call(tbody.rows, function (row) {
        return !row.classList.contains('total-row');
      }).length;
      for (var i = data; i < min; i++) {
        if (!tryAdd(page, tbody, total, cells, note, false)) break;
      }
    });
    document.querySelectorAll('table[data-fill="page"]').forEach(function (table) {
      var cells = Number(table.getAttribute('data-cells')) || 1;
      var page = table.closest('.page');
      var tbody = table.tBodies[0];
      if (!page || !tbody) return;
      var total = tbody.querySelector('tr.total-row');
      var note = page.querySelector('.bottom-note-row');
      var keepWithData = table.hasAttribute('data-keep-total');
      var guard = 0;
      while (guard++ < 80 && tryAdd(page, tbody, total, cells, note, keepWithData)) {}
    });
    document.querySelectorAll('table[data-keep-total]').forEach(function (table) {
      var page = table.closest('.page');
      var tbody = table.tBodies[0];
      var total = table.querySelector('tr.total-row');
      var note = page ? page.querySelector('.bottom-note-row') : null;
      if (!page || !tbody || !total) return;
      var guard = 0;
      while (guard++ < 40 && !totalFitsOnDataPage(page, tbody, total, note)) {
        var blanks = table.querySelectorAll('tr.blank-row');
        if (!blanks.length) break;
        blanks[blanks.length - 1].remove();
      }
    });
  }
  layoutSlip();
  window.layoutPhieuGiaoCa = layoutSlip;
  window.addEventListener('load', layoutSlip);
})();
</script>
</body>
</html>`;
}

export function printPhieuGiaoCaSlip(input: PhieuGiaoCaInput): void {
  const win = window.open('', '', 'width=820,height=1100');
  if (!win) {
    alert('Trình duyệt chặn mở cửa sổ in. Vui lòng cho phép popup để in phiếu.');
    return;
  }
  win.document.write(buildPhieuGiaoCaHtml(input));
  win.document.close();
  const printWhenReady = () => {
    const layout = (win as Window & { layoutPhieuGiaoCa?: () => void }).layoutPhieuGiaoCa;
    if (layout) layout();
    win.focus();
    win.print();
    win.close();
  };
  if (win.document.readyState === 'complete') setTimeout(printWhenReady, 80);
  else win.addEventListener('load', () => setTimeout(printWhenReady, 80));
}
