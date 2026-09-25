/**
 * Mô-đun tạo HTML và kích hoạt in Phiếu giao ca kiêm nhật ký sản xuất
 * Thiết kế chuẩn xác theo 2 mặt/trang giấy (A4 Portrait):
 * - Trang 1: Header + I. VẬT TƯ (Bảng theo dõi vật tư sử dụng L1..L10, tồn đầu, lấy kho, tồn cuối, giao ca)
 * - Trang 2: II. THÀNH PHẨM (trái) + III. HÀNG LỖI PHẾ (phải trên) + IV. SỰ CỐ / LƯU Ý (phải dưới) + 4 Chữ ký chân trang
 */

import { vietNhatLogoUrl } from '../../components/layout/constants';

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

/** Số dòng dữ liệu (chưa kể dòng Cộng) để lưới ô trắng kín một trang A4, mỗi ô cao cố định. */
const VAT_TU_GRID_ROWS = 30;
const THANH_PHAM_GRID_ROWS = 30;
const HANG_LOI_GRID_ROWS = 7;

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(value: unknown): number {
  let text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return 0;
  const negative = text.startsWith('-');
  if (negative) text = text.slice(1);
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

/** In đủ số, không dấu chấm hàng nghìn và không dấu chấm thập phân (thập phân dùng dấu phẩy). */
function fmt(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const text = Number.isInteger(abs) ? String(abs) : String(abs).replace('.', ',');
  return negative ? `-${text}` : text;
}

function printNum(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return fmt(num(text));
}

/** Khổ in A4 dọc, lề 7mm mỗi bên. */
const PRINT_CONTENT_MM = 196;

function numCell(value: unknown, widthPct: number, extraClass = ''): string {
  const text = printNum(value);
  if (!text) return `<td class="num ${extraClass}"></td>`;
  const innerMm = Math.max(4, PRINT_CONTENT_MM * (widthPct / 100) - 0.6);
  const digitMm = 0.5 * 7 * 0.3528;
  const fitPt = text.length * digitMm <= innerMm
    ? 7
    : Math.max(5, innerMm / (text.length * 0.5 * 0.3528));
  return `<td class="num ${extraClass}"><span style="font-size:${fitPt.toFixed(2)}pt">${esc(text)}</span></td>`;
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

function padList<T>(rows: T[], minCount: number): (T | null)[] {
  const result: (T | null)[] = [...rows];
  while (result.length < minCount) {
    result.push(null);
  }
  return result;
}

export function buildPhieuGiaoCaHtml(input: PhieuGiaoCaInput): string {
  const { d, m, y } = splitNgay(input.header.ngay);
  const tenMayUpper = (input.header.tieuDeMay || input.header.tenMay || 'SÓNG 2').trim().toUpperCase();

  // Tính tổng sử dụng vật tư
  const tongCongSuDungVatTu = input.vatTu.reduce((sum, r) => sum + (r.tong_su_dung || 0), 0);

  // Pad vật tư
  const paddedVatTu = padList(input.vatTu, Math.max(input.vatTu.length, VAT_TU_GRID_ROWS));
  const vatTuRowsHtml = paddedVatTu
    .map((row) => {
      const lanCells = Array.from({ length: 10 }, (_, li) => numCell(row?.lan?.[li] ?? '', 3.2)).join('');

      return `
      <tr>
        <td class="c font-mono">${esc(row?.ma_nvl ?? '')}</td>
        <td class="l">${esc(row?.ten_nvl ?? '')}${row?.ten_nvl_sx ? ` <span class="sub">(${esc(row.ten_nvl_sx)})</span>` : ''}</td>
        <td class="c">${esc(row?.dvt ?? (row ? 'Kg' : ''))}</td>
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
  const paddedThanhPham = padList(input.thanhPham, Math.max(input.thanhPham.length, THANH_PHAM_GRID_ROWS));
  const thanhPhamRowsHtml = paddedThanhPham
    .map(row => {
      return `
      <tr>
        <td class="c font-mono">${esc(row?.ma_sp ?? '')}</td>
        <td class="l">${esc(row?.ten_sp ?? '')}</td>
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
  const paddedHangLoi = padList(input.hangLoi, Math.max(input.hangLoi.length, HANG_LOI_GRID_ROWS));
  const hangLoiRowsHtml = paddedHangLoi
    .map(row => {
      return `
      <tr>
        <td class="l">${esc(row?.ten_loi ?? '')}</td>
        <td class="c">${esc(row?.dvt ?? (row ? 'Kg' : ''))}</td>
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
      margin: 6mm 7mm 6mm 7mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: "Times New Roman", Times, serif, Arial;
      font-size: 8pt;
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
      font-size: 11.5pt;
      font-weight: bold;
      text-align: center;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 0 4px;
    }
    .iso-box {
      border: 1px solid #000;
      padding: 3px 5px;
      font-size: 7pt;
      line-height: 1.2;
      width: 125px;
      margin-left: auto;
    }

    /* Sub-header meta */
    .meta-bar {
      margin-top: 4px;
      margin-bottom: 4px;
      font-size: 8.5pt;
      line-height: 1.35;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 2px;
    }
    .underline-fill {
      border-bottom: 1px dotted #444;
      display: inline-block;
      min-width: 45px;
      text-align: center;
      font-weight: bold;
      padding: 0 2px;
    }

    /* Section titles */
    .sec-title {
      font-size: 8.5pt;
      font-weight: bold;
      margin: 4px 0 2px 0;
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
      border: 1px solid #000;
      padding: 0 4px;
      font-size: 8pt;
      line-height: 1.15;
      height: 6.4mm;
      vertical-align: middle;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    table.data-table th {
      background-color: #f7f7f7;
      font-weight: bold;
      text-align: center;
      font-size: 7pt;
      height: auto;
      white-space: normal;
      line-height: 1.15;
      padding: 2px 3px;
    }
    table.data-table td.c { text-align: center; }
    table.data-table td.l { text-align: left; }
    table.data-table td.r { text-align: right; font-variant-numeric: tabular-nums; }
    table.data-table td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      overflow: visible;
      text-overflow: clip;
      white-space: nowrap;
      padding: 0 0.3mm;
      font-size: 7pt;
    }
    table.data-table td.num span {
      display: inline-block;
      white-space: nowrap;
      letter-spacing: -0.15pt;
    }
    table.data-table td.b, table.data-table th.b { font-weight: bold; }
    .font-mono { font-family: monospace, Courier, monospace; font-size: 8pt; }
    .sub { font-size: 6.5pt; color: #444; font-style: italic; }

    .bottom-note-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 5px;
      font-size: 8.5pt;
      font-weight: bold;
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
      border: 1px solid #000;
      min-height: 32mm;
      padding: 6px;
      font-size: 8.5pt;
      white-space: pre-wrap;
      line-height: 1.35;
      background: #fafafa;
    }

    /* Chữ ký luôn một khối ở cuối trang 2. Nếu thành phẩm tràn, cả khối sang trang sau. */
    .signatures-row {
      margin-top: 6mm;
      display: flex;
      justify-content: space-between;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .sig-col {
      width: 24%;
    }
    .sig-title {
      font-weight: bold;
      font-size: 8.5pt;
      margin-bottom: 2px;
    }
    .sig-sub {
      font-size: 7.5pt;
      font-style: italic;
      color: #444;
    }
    .sig-space {
      height: 16mm;
    }
    .sig-name {
      font-size: 8pt;
      font-weight: bold;
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
          Số phiếu: <span class="underline-fill" style="min-width: 80px;">${esc(input.header.soPhieu || '')}</span> / ${esc(y)}
        </div>
      </div>
      <div class="meta-row">
        <div style="flex: 1; margin-right: 20px;">
          Người thực hiện: <span class="underline-fill" style="min-width: 220px; text-align: left;">${esc(input.header.nguoiThucHien || '—')}</span>
        </div>
        <div>
          Máy: <span class="underline-fill" style="min-width: 90px;">${esc(input.header.tenMay || tenMayUpper)}</span>
        </div>
      </div>
    </div>

    <div class="sheet-body">
    <div class="sec-title">I. VẬT TƯ</div>
    <table class="data-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 9%;">Mã vật tư</th>
          <th rowspan="2" style="width: 16%;">Tên vật tư (Kế hoạch chi tiết kể vật tư cần sử dụng, mã vật tư và định mức vật tư sử dụng (Kg))</th>
          <th rowspan="2" style="width: 4.5%;">ĐVT</th>
          <th rowspan="2" style="width: 8%;">Định mức vật tư</th>
          <th rowspan="2" style="width: 7.5%;">Tồn đầu ca</th>
          <th rowspan="2" style="width: 7.5%;">Lấy trong kho</th>
          <th colspan="10" style="width: 32%;">SỬ DỤNG</th>
          <th rowspan="2" style="width: 7.5%;">Tổng sử dụng</th>
          <th rowspan="2" style="width: 7.5%;">Tồn cuối ca</th>
        </tr>
        <tr>
          <th style="width: 3.2%;">Lần 1</th>
          <th style="width: 3.2%;">Lần 2</th>
          <th style="width: 3.2%;">Lần 3</th>
          <th style="width: 3.2%;">Lần 4</th>
          <th style="width: 3.2%;">Lần 5</th>
          <th style="width: 3.2%;">Lần 6</th>
          <th style="width: 3.2%;">Lần 7</th>
          <th style="width: 3.2%;">Lần 8</th>
          <th style="width: 3.2%;">Lần 9</th>
          <th style="width: 3.2%;">Lần 10</th>
        </tr>
      </thead>
      <tbody>
        ${vatTuRowsHtml}
        <tr style="background-color: #f7f7f7;">
          <td colspan="6" class="l b" style="text-align: right; padding-right: 8px;">Cộng tổng sử dụng:</td>
          <td colspan="10" class="num b" style="text-align: right; padding-right: 1mm;">
            ${tongCongSuDungVatTu > 0 ? esc(fmt(tongCongSuDungVatTu)) : ''}
          </td>
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
        <table class="data-table">
          <thead>
            <tr>
              <th rowspan="2" style="width: 11%;">Mã TP</th>
              <th rowspan="2" style="width: 28%;">THÀNH PHẨM (Kế hoạch sản xuất liệt kê các thành phẩm trừ khi dự kiến, dự kiến số lượng thành phẩm trừ khi thu kho)</th>
              <th rowspan="2" style="width: 13%;">TL định mức/tấm (Kg)</th>
              <th colspan="3" style="width: 24%;">TP Nhập kho</th>
              <th rowspan="2" style="width: 12%;">Tổng nhập kho</th>
              <th rowspan="2" style="width: 12%;">Tổng TL (Kg)</th>
            </tr>
            <tr>
              <th style="width: 8%;">Lần 1</th>
              <th style="width: 8%;">Lần 2</th>
              <th style="width: 8%;">Lần 3</th>
            </tr>
          </thead>
          <tbody>
            ${thanhPhamRowsHtml}
            <tr style="background-color: #f7f7f7;">
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
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 48%;">TÊN LỖI/PHẾ</th>
                <th style="width: 22%;">ĐVT</th>
                <th style="width: 30%;">SỐ LƯỢNG</th>
              </tr>
            </thead>
            <tbody>
              ${hangLoiRowsHtml}
              <tr style="background-color: #f7f7f7;">
                <td colspan="2" class="l b" style="text-align: right; padding-right: 6px;">Cộng:</td>
                <td class="num b">${tongHangLoi > 0 ? esc(fmt(tongHangLoi)) : ''}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 8px; flex: 1; display: flex; flex-direction: column;">
          <div class="sec-title">IV. SỰ CỐ SẢN XUẤT / LƯU Ý KHÁC</div>
          <div class="notes-box">
            ${esc(input.suCoLuuY || '').trim() || '<span style="color:#888;">(Không có sự cố ghi nhận)</span>'}
          </div>
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

</body>
</html>`;
}

export function printPhieuGiaoCaSlip(input: PhieuGiaoCaInput): void {
  const win = window.open('', '', 'width=1100,height=900');
  if (!win) {
    alert('Trình duyệt chặn mở cửa sổ in. Vui lòng cho phép popup để in phiếu.');
    return;
  }
  win.document.write(buildPhieuGiaoCaHtml(input));
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
}
