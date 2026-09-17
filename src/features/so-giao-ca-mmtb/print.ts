import { getTieuChuanContent } from './types';
/**
 * Mô-đun tạo HTML và in Biểu mẫu Sổ giao ca MMTB (Trưởng ca/Công nhân)
 * BẢNG THEO DÕI CHẾ ĐỘ CHẠY MÁY & CHẤT LƯỢNG HÀNG NGÀY
 * Định dạng: A4 Landscape (Ngang)
 */

import {
  type SoGiaoCaMmtbRecord,
  COT_THAY_MANG,
  COT_KHU_KHUON
} from './types';

function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function splitNgay(ngayStr: string) {
  const m = String(ngayStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
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

export function buildSoGiaoCaMmtbSlipHtml(data: SoGiaoCaMmtbRecord): string {
  const { d, m, y } = splitNgay(data.ngay);

  // Đệm dòng bảng chế độ chạy (ít nhất 6 dòng)
  const minCheDoRows = 6;
  const cheDoRows = [...(data.bang_che_do_chay || [])];
  while (cheDoRows.length < minCheDoRows) {
    cheDoRows.push({
      key: `pad-${cheDoRows.length}`,
      stt: cheDoRows.length + 1,
      thoi_gian_kiem_tra: '',
      toc_do_bom: '',
      toc_do_lo: '',
      do_day: '',
      chieu_rong: '',
      chieu_dai: '',
      thay_mang_note: '',
      thay_mang: {},
      khu_khuon: {},
      lo_ep_quang: { tren: '', giua: '', duoi: '' }
    });
  }

  // Đệm dòng bảng sản phẩm (ít nhất 6 dòng)
  const minSpRows = 6;
  const spRows = [...(data.bang_san_pham || [])];
  while (spRows.length < minSpRows) {
    spRows.push({
      key: `pad-${spRows.length}`,
      stt: spRows.length + 1,
      gio_kiem_tra: '',
      mau_sac: '',
      do_day: '',
      chieu_rong: '',
      chieu_dai: '',
      trong_luong: '',
      so_seri: '',
      ket_qua: ''
    });
  }

  const tc = data.dong_tieu_chuan || {
    toc_do_bom: '',
    toc_do_lo: '',
    do_day: '',
    chieu_rong: '',
    chieu_dai: '',
    thay_mang: {},
    khu_khuon: {},
    lo_ep_quang: { tren: '', giua: '', duoi: '' },
    ghi_chu: ''
  };

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>BẢNG THEO DÕI CHẾ ĐỘ CHẠY MÁY & CHẤT LƯỢNG HÀNG NGÀY - ${esc(data.ten_may || data.ma_may)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 6mm 8mm 6mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: "Times New Roman", Times, serif, Arial;
      font-size: 14px;
      line-height: 1.2;
      color: #000;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .main-title {
      font-size: 14px;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .underline-fill {
      border-bottom: 1px dotted #444;
      display: inline-block;
      min-width: 45px;
      text-align: center;
      font-weight: bold;
      padding: 0 2px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 6px;
    }
    table.data-table th,
    table.data-table td {
      border: 1px solid #000;
      padding: 1.5px 1px;
      font-size: 13px;
      line-height: 1.1;
      height: 17px;
      text-align: center;
      vertical-align: middle;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    table.data-table th {
      background-color: #f7f7f7;
      font-weight: bold;
      font-size: 13px;
    }
    table.data-table td.l { text-align: left; padding-left: 3px; }
    table.data-table td.r { text-align: right; padding-right: 3px; }
    table.data-table td.b, table.data-table th.b { font-weight: bold; }
    .tc-row {
      background-color: #fafafa;
      font-weight: bold;
    }
    .sec-header {
      font-size: 14px;
      font-weight: bold;
      margin: 4px 0 2px 0;
      text-transform: uppercase;
    }
    .footer-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 6px;
      font-size: 14px;
    }
    .notes-box {
      width: 55%;
      font-size: 13px;
      line-height: 1.35;
      white-space: pre-line;
    }
    .signatures-box {
      width: 42%;
      display: flex;
      justify-content: space-around;
      text-align: center;
    }
    .sig-col {
      width: 45%;
    }
    .sig-title {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .sig-name {
      font-weight: bold;
    }
  </style>
</head>
<body>

  <div class="main-title">BẢNG THEO DÕI CHẾ ĐỘ CHẠY MÁY &amp; CHẤT LƯỢNG HÀNG NGÀY</div>

  <div class="meta-bar">
    <div>
      NGÀY: <span class="underline-fill">${esc(d)}</span> / 
      <span class="underline-fill">${esc(m)}</span> / 
      <span class="underline-fill">${esc(y)}</span>
    </div>
    <div>
      CA SX: <span class="underline-fill" style="min-width: 50px;">${esc(data.ca || '')}</span>
    </div>
    <div>
      MÁY: <span class="underline-fill" style="min-width: 90px;">${esc(data.ten_may || data.ma_may || '')}</span>
    </div>
    <div>
      Trưởng ca: <span class="underline-fill" style="min-width: 80px;">${esc(data.truong_ca || '')}</span>
    </div>
  </div>

  <!-- BẢNG 1: CHẾ ĐỘ CHẠY MÁY & NHIỆT ĐỘ -->
  <table class="data-table">
    <thead>
      <tr>
        <th rowspan="2" style="width: 2.2%;">Stt</th>
        <th rowspan="2" style="width: 4.2%;">Thời gian kiểm tra</th>
        <th rowspan="2" style="width: 4%;">Tốc Độ Bơm Định Lượng</th>
        <th rowspan="2" style="width: 4%;">Tốc Độ Lô Ép Quang</th>
        <th colspan="3" style="width: 9%;">Kích Thước SP</th>
        <th colspan="9" style="width: 25.2%;">Đồng Hồ Báo Nhiệt Khu Vực Thay Màng</th>
        <th colspan="15" style="width: 40.5%;">Đồng Hồ Báo Nhiệt Khu Khuôn</th>
        <th colspan="3" style="width: 8.1%;">Đồng Hồ Báo Nhiệt Lô Ép Quang</th>
        <th rowspan="2" style="width: 2.8%;">Ghi chú</th>
      </tr>
      <tr>
        <th style="width: 3%;">Độ Dày</th>
        <th style="width: 3%;">Chiều Rộng</th>
        <th style="width: 3%;">Chiều Dài</th>
        ${COT_THAY_MANG.map(c => `<th style="width: 2.8%;">${c}</th>`).join('')}
        ${COT_KHU_KHUON.map(c => `<th style="width: 2.7%;">${c}</th>`).join('')}
        <th style="width: 2.7%;">Trên</th>
        <th style="width: 2.7%;">Giữa</th>
        <th style="width: 2.7%;">Dưới</th>
      </tr>
      <!-- DÒNG TIÊU CHUẨN (DO NGƯỜI DÙNG NHẬP) -->
      <tr class="tc-row">
        <td colspan="2" style="font-weight: bold; text-align: left; padding-left: 2px;">Tiêu Chuẩn</td>
        <td colspan="32" style="white-space: pre-wrap;">${esc(getTieuChuanContent(tc))}</td>
        <td>${esc(tc.ghi_chu || '')}</td>
      </tr>
    </thead>
    <tbody>
      ${cheDoRows.map((row, idx) => {
        // Nếu có thay_mang_note (như trong ảnh: 3L x 2,1 x 30m) thì có thể gộp hoặc hiển thị
        const hasThayMangNote = Boolean(row.thay_mang_note);

        return `
        <tr>
          <td>${row.thoi_gian_kiem_tra || row.toc_do_bom ? row.stt || idx + 1 : idx + 1}</td>
          <td>${esc(row.thoi_gian_kiem_tra || '')}</td>
          <td>${esc(row.toc_do_bom || '')}</td>
          <td>${esc(row.toc_do_lo || '')}</td>
          <td>${esc(row.do_day || '')}</td>
          <td>${esc(row.chieu_rong || '')}</td>
          <td>${esc(row.chieu_dai || '')}</td>
          ${
            hasThayMangNote
              ? `<td colspan="9" style="font-weight: bold; font-size: 14px;">${esc(row.thay_mang_note)}</td>`
              : COT_THAY_MANG.map(c => `<td>${esc(row.thay_mang?.[c] || '')}</td>`).join('')
          }
          ${COT_KHU_KHUON.map(c => `<td>${esc(row.khu_khuon?.[c] || '')}</td>`).join('')}
          <td>${esc(row.lo_ep_quang?.tren || '')}</td>
          <td>${esc(row.lo_ep_quang?.giua || '')}</td>
          <td>${esc(row.lo_ep_quang?.duoi || '')}</td>
          <td>${esc(row.ghi_chu || '')}</td>
        </tr>
      `;
      }).join('')}
    </tbody>
  </table>

  <!-- BẢNG 2: SẢN PHẨM -->
  <div class="sec-header">SẢN PHẨM:</div>
  <table class="data-table">
    <thead>
      <tr>
        <th rowspan="2" style="width: 4%;">Stt</th>
        <th rowspan="2" style="width: 10%;">Giờ Kiểm Tra</th>
        <th colspan="7" style="width: 86%;">Tiêu Chuẩn SP</th>
      </tr>
      <tr>
        <th style="width: 12%;">Màu Sắc</th>
        <th style="width: 12%;">Độ Dày</th>
        <th style="width: 14%;">Chiều Rộng</th>
        <th style="width: 14%;">Chiều Dài</th>
        <th style="width: 14%;">Trọng Lượng</th>
        <th style="width: 10%;">Số seri</th>
        <th style="width: 10%;">Kết Quả</th>
      </tr>
    </thead>
    <tbody>
      ${spRows.map((row, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${esc(row.gio_kiem_tra || '')}</td>
          <td>${esc(row.mau_sac || '')}</td>
          <td>${esc(row.do_day || '')}</td>
          <td>${esc(row.chieu_rong || '')}</td>
          <td>${esc(row.chieu_dai || '')}</td>
          <td class="b">${esc(row.trong_luong || '')}</td>
          <td>${esc(row.so_seri || '')}</td>
          <td class="b">${esc(row.ket_qua || '')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- FOOTER -->
  <div class="footer-container">
    <div class="notes-box">
      <b>Tiêu Chuẩn Kiểm Tra Sản Phẩm:</b><br>
      ${esc(data.ghi_chu_tieu_chuan_sp || '')}
    </div>

    <div class="signatures-box">
      <div class="sig-col">
        <div class="sig-title">Trưởng ca</div>
        <div class="sig-name">${esc(data.truong_ca || '')}</div>
      </div>
      <div class="sig-col">
        <div class="sig-title">Công nhân / Người KT</div>
        <div class="sig-name">${esc(data.nguoi_kiem_tra || '')}</div>
      </div>
    </div>
  </div>

</body>
</html>`;
}

export function printSoGiaoCaMmtbSlip(data: SoGiaoCaMmtbRecord): void {
  const win = window.open('', '', 'width=1200,height=800');
  if (!win) {
    alert('Trình duyệt chặn mở cửa sổ in. Vui lòng cho phép popup để in.');
    return;
  }
  win.document.write(buildSoGiaoCaMmtbSlipHtml(data));
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
}

export interface SoGiaoCaMmtbListFilterInfo {
  ngay?: string;
  may?: string;
  ca?: string;
  tuKhoa?: string;
}

/**
 * In DANH SÁCH sổ giao ca MMTB khổ ngang (A4 Landscape):
 * STT | Ngày (DD/MM/YYYY) | Ca | Máy | Trưởng ca | Người kiểm tra.
 */
export function buildSoGiaoCaMmtbListHtml(
  records: SoGiaoCaMmtbRecord[],
  filter: SoGiaoCaMmtbListFilterInfo = {}
): string {
  const rows = [...(records || [])].sort(
    (a, b) =>
      String(a.ngay || '').localeCompare(String(b.ngay || '')) ||
      String(a.ca || '').localeCompare(String(b.ca || '')) ||
      String(a.ten_may || a.ma_may || '').localeCompare(String(b.ten_may || b.ma_may || ''), 'vi')
  );
  const fmtNgay = (ngayStr: string) => {
    const { d, m, y } = splitNgay(ngayStr);
    return `${d}/${m}/${y}`;
  };
  const filterParts: string[] = [];
  if (filter.ngay) filterParts.push(`Ngày: <b>${esc(fmtNgay(filter.ngay))}</b>`);
  if (filter.may) filterParts.push(`Máy: <b>${esc(filter.may)}</b>`);
  if (filter.ca) filterParts.push(`Ca: <b>${esc(filter.ca)}</b>`);
  if (filter.tuKhoa) filterParts.push(`Từ khóa: <b>${esc(filter.tuKhoa)}</b>`);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>DANH SÁCH SỔ GIAO CA MMTB</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 10mm 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: "Times New Roman", Times, serif, Arial;
      font-size: 14px;
      line-height: 1.25;
      color: #000;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .company {
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
    }
    .main-title {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      margin: 2px 0 4px 0;
    }
    .filter-line {
      font-size: 13px;
      text-align: center;
      margin-bottom: 6px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.data-table th,
    table.data-table td {
      border: 1px solid #000;
      padding: 3px 4px;
      font-size: 13px;
      text-align: center;
      vertical-align: middle;
      overflow: hidden;
    }
    table.data-table th {
      background-color: #f7f7f7;
      font-weight: bold;
    }
    table.data-table td.l { text-align: left; }
    .total-line {
      font-size: 13px;
      font-weight: bold;
      margin-top: 4px;
    }
    .footer-container {
      display: flex;
      justify-content: space-around;
      text-align: center;
      margin-top: 10px;
      font-size: 14px;
    }
    .sig-title {
      font-weight: bold;
      margin-bottom: 48px;
    }
    .sig-name {
      font-weight: bold;
    }
  </style>
</head>
<body>

  <div class="company">CÔNG TY CỔ PHẦN SX &amp; TM VIỆT NHẬT PHÚ THỌ</div>
  <div class="main-title">DANH SÁCH SỔ GIAO CA MÁY MÓC THIẾT BỊ (MMTB)</div>
  ${filterParts.length > 0 ? `<div class="filter-line">Điều kiện lọc — ${filterParts.join(' &nbsp;·&nbsp; ')}</div>` : ''}

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 6%;">STT</th>
        <th style="width: 14%;">Ngày</th>
        <th style="width: 10%;">Ca</th>
        <th style="width: 26%;">Máy</th>
        <th style="width: 22%;">Trưởng ca</th>
        <th style="width: 22%;">Người kiểm tra</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length === 0 ? `
      <tr>
        <td colspan="6" style="font-style: italic;">Chưa có sổ giao ca nào phù hợp.</td>
      </tr>` : rows.map((r, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${esc(fmtNgay(r.ngay || ''))}</td>
        <td>${esc(r.ca || '')}</td>
        <td class="l">${esc(r.ten_may && r.ten_may !== r.ma_may ? `${r.ma_may} - ${r.ten_may}` : (r.ten_may || r.ma_may || ''))}</td>
        <td>${esc(r.truong_ca || '')}</td>
        <td>${esc(r.nguoi_kiem_tra || '')}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="total-line">Tổng số: ${rows.length} sổ giao ca</div>

  <div class="footer-container">
    <div>
      <div class="sig-title">NGƯỜI LẬP</div>
      <div class="sig-name"></div>
    </div>
    <div>
      <div class="sig-title">TRƯỞNG CA</div>
      <div class="sig-name"></div>
    </div>
  </div>

</body>
</html>`;
}

export function printSoGiaoCaMmtbList(
  records: SoGiaoCaMmtbRecord[],
  filter: SoGiaoCaMmtbListFilterInfo = {}
): void {
  const win = window.open('', '', 'width=1200,height=800');
  if (!win) {
    alert('Trình duyệt chặn mở cửa sổ in. Vui lòng cho phép popup để in.');
    return;
  }
  win.document.write(buildSoGiaoCaMmtbListHtml(records, filter));
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
}
