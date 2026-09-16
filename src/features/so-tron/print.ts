/**
 * Phiếu in Sổ trộn theo đúng mẫu giấy: 1 tờ A4 NGANG.
 * Bố cục: header Ngày/Máy/Ca/Nhân sự → bảng NVL L1..Ln full-width →
 * dòng tổng sản phẩm → 3 bảng cạnh nhau (Sản phẩm | Hàng lỗi | Bàn giao ca sau).
 * In qua cửa sổ riêng (pattern LichLamViecPrintModal) để ép @page chính xác.
 */

export interface SoTronPrintNvlRow {
  ma_nvl: string;
  ten_nvl: string;
  ten_nvl_sx: string;
  dvt: string;
  lan: string[];
  tong: number;
}

export interface SoTronPrintSpRow {
  ma_lenh_sx: string;
  ten_sp: string;
  so_luong: string;
  dinh_muc: string;
  trong_luong: string;
  ghi_chu: string;
}

export interface SoTronPrintLoiRow {
  ten_loi: string;
  so_luong: string;
}

export interface SoTronPrintBanGiaoRow {
  ma_nvl: string;
  ten_nvl: string;
  lay_trong_kho: string;
  ton_dau_ca: string;
  tong_su_dung: number;
  ton_cuoi_ca: number;
}

export interface SoTronPrintInput {
  ngay: string;
  mayCa: string;
  nhanSu: string;
  lenhSx: string[];
  numLan: number;
  nvl: SoTronPrintNvlRow[];
  sp: SoTronPrintSpRow[];
  loi: SoTronPrintLoiRow[];
  banGiao: SoTronPrintBanGiaoRow[];
  ghiChu: string;
}

const NVL_PAD_ROWS = 10;
const SP_PAD_ROWS = 7;
const LOI_PAD_ROWS = 8;
const BG_PAD_ROWS = 8;

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(value: unknown) {
  const parsed = Number(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmt(value: number) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function splitNgay(ngay: string) {
  const m = String(ngay || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { d: '', m: '', y: '' };
  return { d: m[3], m: m[2], y: m[1] };
}

function padRows<T>(rows: T[], count: number): (T | null)[] {
  const out: (T | null)[] = [...rows];
  while (out.length < count) out.push(null);
  return out;
}

export function buildSoTronSlipHtml(input: SoTronPrintInput) {
  const date = splitNgay(input.ngay);
  const numLan = Math.max(1, Math.min(20, Math.trunc(input.numLan) || 0));
  const lanWidth = ((100 - 22 - 7 - 8) / numLan).toFixed(2);

  const nvlCells = (row: SoTronPrintNvlRow | null) => {
    const cells: string[] = [];
    for (let i = 0; i < numLan; i += 1) {
      cells.push(`<td>${esc(row?.lan[i] ?? '')}</td>`);
    }
    return cells.join('');
  };

  const nvlRows = padRows(input.nvl, NVL_PAD_ROWS)
    .map(
      row => `<tr>
        <td class="l"><b>${esc(row?.ma_nvl ?? '')}</b>${row?.ten_nvl ? `<br>${esc(row.ten_nvl)}` : ''}${row?.ten_nvl_sx ? `<br><i>${esc(row.ten_nvl_sx)}</i>` : ''}</td>
        <td>${esc(row?.dvt ?? '')}</td>
        ${nvlCells(row)}
        <td class="r"><b>${row ? fmt(row.tong) : ''}</b></td>
      </tr>`
    )
    .join('');

  const lanHeaders = Array.from(
    { length: numLan },
    (_, i) => `<th style="width:${lanWidth}%">L${i + 1}</th>`
  ).join('');

  const spTotalSl = input.sp.reduce((s, r) => s + num(r.so_luong), 0);
  const spTotalTl = input.sp.reduce((s, r) => s + num(r.trong_luong), 0);
  const spRows = padRows(input.sp, SP_PAD_ROWS)
    .map(
      row => `<tr>
        <td class="l">${esc(row?.ten_sp ?? '')}${row?.ma_lenh_sx ? `<br><span class="muted">${esc(row.ma_lenh_sx)}</span>` : ''}</td>
        <td class="r">${esc(row?.so_luong ?? '')}</td>
        <td>${esc(row?.dinh_muc ?? '')}</td>
        <td class="r">${esc(row?.trong_luong ?? '')}</td>
        <td>${esc(row?.ghi_chu ?? '')}</td>
      </tr>`
    )
    .join('');

  const loiTotal = input.loi.reduce((s, r) => s + num(r.so_luong), 0);
  const loiRows = padRows(input.loi, LOI_PAD_ROWS)
    .map(
      (row, i) => `<tr>
        <td>${row ? i + 1 : ''}</td>
        <td class="l">${esc(row?.ten_loi ?? '')}</td>
        <td class="r">${esc(row?.so_luong ?? '')}</td>
      </tr>`
    )
    .join('');

  const bgRows = padRows(input.banGiao, BG_PAD_ROWS)
    .map(
      row => `<tr>
        <td class="l"><b>${esc(row?.ma_nvl ?? '')}</b>${row?.ten_nvl ? `<br>${esc(row.ten_nvl)}` : ''}</td>
        <td class="r">${esc(row?.lay_trong_kho ?? '')}</td>
        <td class="r">${esc(row?.ton_dau_ca ?? '')}</td>
        <td class="r"><b>${row ? fmt(row.ton_cuoi_ca) : ''}</b></td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sổ trộn ${esc(input.ngay)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #111; font-size: 8pt; }
  h1 { font-size: 15pt; text-align: center; margin: 0 0 2px; letter-spacing: 1px; }
  .meta { display: flex; justify-content: space-between; gap: 8px; font-size: 9.5pt; margin: 0 0 4px; }
  .meta b { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid #333; padding: 2px 3px; text-align: center; vertical-align: middle; overflow: hidden; }
  th { background: #f0f0f0; font-size: 7.5pt; }
  td { font-size: 8pt; height: 15px; }
  td.l { text-align: left; }
  td.r { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: #555; font-size: 7pt; }
  .sp-line { font-size: 9.5pt; margin: 3px 0; }
  .bottom { display: flex; gap: 6px; margin-top: 4px; }
  .bottom .col-sp { width: 42%; }
  .bottom .col-loi { width: 20%; }
  .bottom .col-bg { width: 38%; }
  .cap { font-size: 9pt; font-weight: bold; text-align: center; margin: 0 0 2px; }
  .total-row td { font-weight: bold; background: #f7f7f7; }
  .ghi-chu { font-size: 8.5pt; margin-top: 3px; }
</style></head><body>
  <h1>SỔ TRỘN</h1>
  <div class="meta">
    <span>Ngày <b>${esc(date.d)}</b> Tháng <b>${esc(date.m)}</b> Năm <b>${esc(date.y)}</b></span>
    <span>Máy - Ca: <b>${esc(input.mayCa || '—')}</b></span>
    <span>Nhân sự chạy máy: <b>${esc(input.nhanSu || '—')}</b></span>
  </div>
  <table>
    <thead><tr>
      <th style="width:22%">Nguyên Liệu</th><th style="width:7%">ĐVT</th>${lanHeaders}<th style="width:8%">Trọng Lượng</th>
    </tr></thead>
    <tbody>${nvlRows}</tbody>
  </table>
  <p class="sp-line">Sản phẩm của quá trình chạy máy: <b>${fmt(spTotalTl)} kg</b>${input.lenhSx.length ? ` <span class="muted">(Lệnh: ${esc(input.lenhSx.join(', '))})</span>` : ''}</p>
  <div class="bottom">
    <div class="col-sp">
      <p class="cap">Sản Phẩm</p>
      <table>
        <thead><tr><th style="width:34%">Tên hàng hóa</th><th style="width:12%">Số Lượng</th><th style="width:16%">Định mức</th><th style="width:16%">Trọng lượng</th><th style="width:22%">Ghi chú</th></tr></thead>
        <tbody>${spRows}
          <tr class="total-row"><td class="l">Cộng</td><td class="r">${fmt(spTotalSl)}</td><td></td><td class="r">${fmt(spTotalTl)}</td><td></td></tr>
        </tbody>
      </table>
    </div>
    <div class="col-loi">
      <p class="cap">Hàng Lỗi Hỏng</p>
      <table>
        <thead><tr><th style="width:14%">Stt</th><th style="width:48%">Tên Lỗi</th><th style="width:38%">Số lượng</th></tr></thead>
        <tbody>${loiRows}
          <tr class="total-row"><td colspan="2" class="l">Cộng</td><td class="r">${fmt(loiTotal)}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="col-bg">
      <p class="cap">Nhựa Bàn Giao Ca Sau</p>
      <table>
        <thead><tr><th style="width:34%">Loại Nhựa</th><th style="width:22%">Nhập Trong Ngày</th><th style="width:22%">Nhập Ca Trước</th><th style="width:22%">Tồn Cuối Ca</th></tr></thead>
        <tbody>${bgRows}</tbody>
      </table>
    </div>
  </div>
  ${input.ghiChu ? `<p class="ghi-chu">Ghi chú: ${esc(input.ghiChu)}</p>` : ''}
</body></html>`;
}

export function printSoTronSlip(input: SoTronPrintInput) {
  const win = window.open('', '', 'width=1200,height=800');
  if (!win) return;
  win.document.write(buildSoTronSlipHtml(input));
  win.document.close();
  win.focus();
  win.print();
  win.close();
}
