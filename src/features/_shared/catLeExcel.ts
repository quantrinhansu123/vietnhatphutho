import * as XLSX from 'xlsx';

export type TheoDoiCatLeExportRow = {
  maHang: string;
  tenHang?: string;
  maMoi?: string[];
  donVi: string;
  nhomVthh?: string;
  ngayCat?: string;
  tonDau: number;
  tonDauKg: number;
  nhap: number;
  nhapKg: number;
  xuat: number;
  xuatKg: number;
  tonCuoi: number;
  tonCuoiKg: number;
  tonCuoiTien: number;
};

export type BaoCaoCatLeExportRow = {
  maHang: string;
  tenHang?: string;
  dvt: string;
  dvc: string;
  maMoi?: string[];
  dauSl: number;
  dauDvc: number;
  dauTien: number;
  nhapSl: number;
  nhapDvc: number;
  nhapTien: number;
  xuatSl: number;
  xuatDvc: number;
  xuatTien: number;
  cuoiSl: number;
  cuoiDvc: number;
  cuoiTien: number;
};

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** Xuất theo dõi cắt lẻ — bố cục theo sheet TONGHOP NXT (XNT tấm nhựa đặc). */
export function exportTheoDoiCatLe(rows: TheoDoiCatLeExportRow[], from: string, to: string): void {
  const title = `THEO DÕI CẮT LẺ${from || to ? ` (${from || '...'} → ${to || '...'})` : ''}`;
  const aoa: unknown[][] = [
    [title],
    [],
    ['STT', 'Mã hàng', 'Tên hàng', 'ĐVT', 'Nhóm VTHH', 'Ngày cắt', 'Tồn đầu', 'Tồn đầu (kg)', 'Nhập', 'Nhập (kg)', 'Xuất', 'Xuất (kg)', 'Tồn cuối', 'Tồn cuối (kg)', 'Thành tiền']
  ];
  rows.forEach((row, index) => {
    aoa.push([
      index + 1,
      row.maHang,
      row.tenHang || '',
      row.donVi,
      row.nhomVthh || '',
      row.ngayCat || '',
      row.tonDau,
      row.tonDauKg,
      row.nhap,
      row.nhapKg,
      row.xuat,
      row.xuatKg,
      row.tonCuoi,
      row.tonCuoiKg,
      row.tonCuoiTien
    ]);
  });
  const total = (pick: (r: TheoDoiCatLeExportRow) => number) => Math.round(rows.reduce((s, r) => s + pick(r), 0) * 1000) / 1000;
  aoa.push([
    '', 'Tổng cộng', '', '', '', '',
    total(r => r.tonDau), total(r => r.tonDauKg),
    total(r => r.nhap), total(r => r.nhapKg),
    total(r => r.xuat), total(r => r.xuatKg),
    total(r => r.tonCuoi), total(r => r.tonCuoiKg), total(r => r.tonCuoiTien)
  ]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 34 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'THEO DOI CAT LE');
  XLSX.writeFile(wb, `theo-doi-cat-le-${stamp()}.xlsx`);
}

/** Xuất báo cáo cắt lẻ — bố cục theo file Tổng hợp tồn kho (phần mềm). */
export function exportBaoCaoCatLe(rows: BaoCaoCatLeExportRow[], from: string, to: string): void {
  const aoa: unknown[][] = [
    ['TỔNG HỢP CẮT LẺ'],
    [`Từ ${from || '...'} đến ${to || '...'}`],
    [],
    ['Mã hàng', 'Tên hàng', 'ĐVT', 'ĐVC (m2)', 'Đầu kỳ', '', '', 'Nhập kho', '', '', 'Xuất kho', '', '', 'Cuối kỳ', '', ''],
    ['', '', '', '', 'Số lượng', 'Số lượng theo ĐVC', 'Giá trị', 'Số lượng', 'Số lượng theo ĐVC', 'Giá trị', 'Số lượng', 'Số lượng theo ĐVC', 'Giá trị', 'Số lượng', 'Số lượng theo ĐVC', 'Giá trị']
  ];
  rows.forEach(row => {
    aoa.push([
      row.maHang, row.tenHang || '', row.dvt, row.dvc,
      row.dauSl, row.dauDvc, row.dauTien,
      row.nhapSl, row.nhapDvc, row.nhapTien,
      row.xuatSl, row.xuatDvc, row.xuatTien,
      row.cuoiSl, row.cuoiDvc, row.cuoiTien
    ]);
  });
  const total = (pick: (r: BaoCaoCatLeExportRow) => number) => Math.round(rows.reduce((s, r) => s + pick(r), 0) * 1000) / 1000;
  aoa.push([
    'Tổng cộng', '', '', '',
    total(r => r.dauSl), total(r => r.dauDvc), total(r => r.dauTien),
    total(r => r.nhapSl), total(r => r.nhapDvc), total(r => r.nhapTien),
    total(r => r.xuatSl), total(r => r.xuatDvc), total(r => r.xuatTien),
    total(r => r.cuoiSl), total(r => r.cuoiDvc), total(r => r.cuoiTien)
  ]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 24 }, { wch: 42 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TONG HOP CAT LE');
  XLSX.writeFile(wb, `bao-cao-cat-le-${stamp()}.xlsx`);
}
