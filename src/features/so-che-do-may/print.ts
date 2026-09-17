/**
 * In phiếu Sổ chế độ máy khổ ngang (A4 Landscape):
 * mỗi máy 1 trang — 8 khu vực x 3 ca x ngày + bàn giao + ghi chú.
 */

export interface SoCheDoMayPrintNote {
  tu: string;
  den: string;
  mayText: string;
  noi_dung: string;
  span: { tu: number; den: number } | null;
}

export interface SoCheDoMayPrintSheet {
  thang: number;
  nam: number;
  mayLabel: string;
  days: number;
  cells: Record<string, string>;
  handover: Record<string, { ban_giao: string; nhan: string }>;
  notes: SoCheDoMayPrintNote[];
  areas: string[];
  cas: string[];
}

function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSoCheDoMaySlipsHtml(sheets: SoCheDoMayPrintSheet[]): string {
  const pages = sheets.map(sheet => {
    const dayList = Array.from({ length: sheet.days }, (_, i) => i + 1);
    const covered = new Set<number>();
    for (const n of sheet.notes) {
      if (!n.span) continue;
      for (let d = n.span.tu; d <= n.span.den; d++) covered.add(d);
    }
    const machineRows = sheet.areas
      .map((area, kv) =>
        sheet.cas
          .map((ca, ci) => {
            const firstCells =
              ci === 0
                ? `<td rowspan="3" class="c">${kv + 1}</td><td rowspan="3" class="area">${esc(area)}</td>`
                : '';
            const dayCells = dayList
              .map(d => {
                const val = sheet.cells[`${kv}_${ca}_${d}`] || '';
                const cls = val === 'v' ? 'v' : val === 'x' ? 'x' : '';
                const bg = covered.has(d) ? ' noted' : '';
                return `<td class="day${bg}"><span class="${cls}">${esc(val)}</span></td>`;
              })
              .join('');
            return `<tr>${firstCells}<td class="c ca">${esc(ca)}</td>${dayCells}</tr>`;
          })
          .join('')
      )
      .join('');
    const handoverRows = (
      [
        { field: 'ban_giao', label: 'Người bàn giao' },
        { field: 'nhan', label: 'Người nhận bàn giao' }
      ] as const
    )
      .map(row => {
        const cells = dayList
          .map(d => {
            const full = sheet.handover[String(d)]?.[row.field] || '';
            return `<td class="handover">${full ? `<span class="vname">${esc(full)}</span>` : ''}</td>`;
          })
          .join('');
        return `<tr><td colspan="3" class="hlabel">${row.label}</td>${cells}</tr>`;
      })
      .join('');
    const notesHtml =
      sheet.notes.length > 0
        ? `<div class="notes"><b>Ghi chú:</b><ul>${sheet.notes
            .map(n => `<li>Từ ${esc(n.tu)} đến ${esc(n.den)} (${esc(n.mayText)}): ${esc(n.noi_dung)}</li>`)
            .join('')}</ul></div>`
        : '';
    const headDays = dayList.map(d => `<th>${d}</th>`).join('');
    return `
    <div class="sheet">
      <div class="main-title">${esc(sheet.mayLabel || 'Sổ chế độ máy')} - Tháng ${sheet.thang} năm ${sheet.nam} - (v: máy bình thường - x: máy có phát sinh bất thường)</div>
      <table>
        <colgroup><col class="w-stt"><col class="w-area"><col class="w-ca">${dayList.map(() => '<col class="w-day">').join('')}</colgroup>
        <thead>
          <tr><th rowspan="2">Stt</th><th rowspan="2">Khu Vực Máy</th><th rowspan="2">Ca</th><th colspan="${sheet.days}">Ngày trong tháng</th></tr>
          <tr>${headDays}</tr>
        </thead>
        <tbody>${machineRows}${handoverRows}</tbody>
      </table>
      ${notesHtml}
    </div>`;
  });

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Sổ chế độ máy</title>
  <style>
    @page { size: A4 landscape; margin: 6mm 8mm 6mm 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: "Times New Roman", Times, serif; font-size: 9pt; color: #000; margin: 0; background: #fff; }
    .sheet { page-break-after: always; }
    .sheet:last-child { page-break-after: auto; }
    .main-title { font-size: 12pt; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #000; padding: 1px 2px; text-align: center; }
    thead th { background: #f0f0f0; font-size: 8pt; }
    .w-stt { width: 26px; } .w-area { width: 110px; } .w-ca { width: 28px; }
    td.c, td.ca { font-weight: bold; font-size: 8pt; }
    td.area { font-size: 7.5pt; font-weight: bold; }
    td.day { height: 16px; font-size: 9pt; }
    td.day .v { color: #1e40af; font-style: italic; font-weight: bold; }
    td.day .x { color: #b91c1c; font-style: italic; font-weight: bold; }
    td.day.noted { background: #fef3c7; }
    td.hlabel { font-size: 8pt; font-weight: bold; background: #f0f0f0; }
    td.handover { height: 30px; }
    .vname { writing-mode: vertical-rl; font-size: 8pt; font-weight: bold; color: #1e3a8a; margin: 0 auto; }
    .notes { margin-top: 4px; font-size: 9pt; }
    .notes ul { margin: 2px 0 0; padding-left: 18px; }
  </style>
</head>
<body>${pages.join('')}</body>
</html>`;
}

export function printSoCheDoMaySlips(sheets: SoCheDoMayPrintSheet[]): void {
  if (!sheets.length) return;
  const win = window.open('', '', 'width=1200,height=800');
  if (!win) {
    alert('Trình duyệt chặn mở cửa sổ in. Vui lòng cho phép popup để in.');
    return;
  }
  win.document.write(buildSoCheDoMaySlipsHtml(sheets));
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
}
