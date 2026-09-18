import type { PlasticTestRow } from './model';
import { formatPlasticTestDate } from './model';

function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Số dòng tối thiểu trên bản in để giống mẫu giấy (dòng chấm). */
const MIN_PRINT_ROWS = 24;

export function buildSoTestMauNhuaHtml(ngay: string, rows: PlasticTestRow[]): string {
  const dataRows = rows.filter(r =>
    [r.ma_npl, r.ten_npl, r.may_ep_mau, r.may_va_dap, r.chi_so_mi, r.ket_luan, r.nguoi_thuc_hien]
      .some(v => String(v ?? '').trim() !== '')
  );
  const padded = [...dataRows];
  while (padded.length < MIN_PRINT_ROWS) {
    padded.push({
      material_id: '', ma_npl: '', ten_npl: '', may_ep_mau: '', may_va_dap: '',
      chi_so_mi: '', ket_luan: '', nguoi_thuc_hien: ''
    });
  }
  const dateText = formatPlasticTestDate(ngay) || esc(ngay);
  const bodyRows = padded
    .map(r => {
      const loaiHang = [r.ma_npl, r.ten_npl].filter(v => String(v ?? '').trim() !== '').join(' - ');
      return `<tr>
        <td class="c date">${dateText}</td>
        <td class="loai">${esc(loaiHang)}</td>
        <td class="c">${esc(r.may_ep_mau)}</td>
        <td class="c">${esc(r.may_va_dap)}</td>
        <td class="c">${esc(r.chi_so_mi)}</td>
        <td class="c">${esc(r.ket_luan)}</td>
        <td class="c">${esc(r.nguoi_thuc_hien)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>SỔ TEST MẪU NHỰA - ${dateText}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 10mm 10mm 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Times New Roman", Times, serif; color: #000; background: #fff; margin: 0; padding: 0; }
  h1 { text-align: center; font-size: 18pt; font-weight: bold; margin: 0 0 8px; text-transform: uppercase; }
  .meta { text-align: center; font-size: 11pt; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #000; font-size: 11pt; padding: 4px 6px; vertical-align: middle; overflow: hidden; }
  th { font-weight: bold; text-align: center; background: #fff; }
  td.c { text-align: center; }
  td.date { text-align: center; white-space: nowrap; }
  td.loai { text-align: left; }
  tbody td { height: 26px; }
  tbody tr:nth-child(even) td { background: #fff; }
</style>
</head>
<body>
  <h1>Sổ test mẫu nhựa</h1>
  <div class="meta">Ngày: ${dateText}</div>
  <table>
    <colgroup>
      <col style="width:11%">
      <col style="width:27%">
      <col style="width:12%">
      <col style="width:12%">
      <col style="width:12%">
      <col style="width:13%">
      <col style="width:13%">
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2">Ngày<br>tháng</th>
        <th rowspan="2">Loại Hàng</th>
        <th colspan="3">Chỉ Số Test</th>
        <th rowspan="2">Kết Luận</th>
        <th rowspan="2">Người Thực<br>Hiện</th>
      </tr>
      <tr>
        <th>Máy Ép Mẫu</th>
        <th>Máy Va Đập</th>
        <th>Chỉ Số MFI</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
}

export function printSoTestMauNhua(ngay: string, rows: PlasticTestRow[]): void {
  const win = window.open('', '', 'width=1000,height=800');
  if (!win) {
    alert('Trình duyệt chặn mở cửa sổ in. Vui lòng cho phép popup để in.');
    return;
  }
  win.document.write(buildSoTestMauNhuaHtml(ngay, rows));
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
}
