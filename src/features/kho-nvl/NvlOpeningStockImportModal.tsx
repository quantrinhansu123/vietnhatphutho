import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Loader2, Upload, X } from 'lucide-react';
import { parsePeriodQuantityValue } from '../_shared/recordHelpers';
import { parseMaterialCatalogExcel } from '../../utils/materialCatalogExcel';
import { normalizeWarehouseName } from '../kho-hang';
import {
  StatusBadge,
  TableBody,
  TableEmptyRow,
  TableHead,
  TableHeadCell,
  TableRow,
  TableShell
} from '../../components/shared/table';
import type { MaterialRow } from './index';
import { normalizeMaterialCodeKey } from './index';

export interface NvlOpeningStockMonth {
  thang: number;
  nam: number;
}

type PreviewStatus = 'ready' | 'new' | 'invalid' | 'ambiguous';

export interface NvlOpeningStockPreviewRow {
  key: string;
  code: string;
  name: string;
  productionName: string;
  unit: string;
  warehouse: string;
  quantity: number | null;
  quantityText: string;
  material: MaterialRow | null;
  status: PreviewStatus;
  message: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Mã lý do phiếu tồn đầu, dùng để phát hiện import trùng tháng. */
export function nvlOpeningStockReason(thang: number, nam: number): string {
  return `Tồn đầu tháng ${thang}/${nam} (import)`;
}

/** Ghi chú phiếu tồn đầu: "Nhập tồn cuối tháng n đầu tháng n + 1". */
export function nvlOpeningStockNote(thang: number, nam: number): string {
  const prevThang = thang === 1 ? 12 : thang - 1;
  const prevNam = thang === 1 ? nam - 1 : nam;
  return `Nhập tồn cuối tháng ${prevThang}/${prevNam} đầu tháng ${thang}/${nam}`;
}

function normalizeReason(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ngày phiếu mặc định = ngày cuối tháng trước của tháng tồn đầu. */
export function defaultOpeningSlipDate(thang: number, nam: number): string {
  const date = new Date(nam, thang - 1, 0);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function firstDayOfMonth(thang: number, nam: number): string {
  return `${nam}-${pad2(thang)}-01`;
}

export function downloadNvlOpeningStockTemplate(materials: MaterialRow[], thang: number, nam: number) {
  const rows = materials
    .filter(material => material.code && material.code !== '-')
    .sort((a, b) => String(a.code).localeCompare(String(b.code), 'vi'))
    .map(material => ({
      'Mã NPL': material.code,
      'Tên nguyên vật liệu': material.name === '-' ? '' : material.name,
      'Tên NVL sản xuất': material.productionName === '-' ? '' : material.productionName,
      'ĐV': material.unit === '-' ? '' : material.unit,
      Kho: material.warehouse === '-' ? '' : material.warehouse,
      'SL tồn': ''
    }));
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ['Mã NPL', 'Tên nguyên vật liệu', 'Tên NVL sản xuất', 'ĐV', 'Kho', 'SL tồn']
  });
  worksheet['!cols'] = [{ wch: 18 }, { wch: 42 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ton_dau');
  XLSX.writeFile(workbook, `mau-ton-dau-nvl-thang-${thang}-${nam}.xlsx`);
}

function buildPreviewRows(
  parsed: Array<{ code: string; name: string; unit: string; warehouse: string; openingStock: string; productionName: string; rowNumber: number }>,
  materials: MaterialRow[],
  fallbackWarehouse: string
): NvlOpeningStockPreviewRow[] {
  const byCode = new Map<string, MaterialRow[]>();
  for (const material of materials) {
    const code = String(material.code || '').trim();
    if (!code || code === '-') continue;
    const key = normalizeMaterialCodeKey(code);
    const list = byCode.get(key);
    if (list) list.push(material);
    else byCode.set(key, [material]);
  }
  return parsed.map((row, index) => {
    const code = String(row.code || '').trim();
    const quantity = parsePeriodQuantityValue(row.openingStock);
    const base = {
      key: `${normalizeMaterialCodeKey(code) || 'norow'}-${row.rowNumber}-${index}`,
      code,
      name: String(row.name || '').trim(),
      productionName: String(row.productionName || '').trim(),
      unit: String(row.unit || '').trim(),
      warehouse: String(row.warehouse || '').trim(),
      quantity,
      quantityText: String(row.openingStock || '').trim()
    };
    if (!code) {
      return { ...base, material: null, status: 'invalid' as const, message: 'Thiếu mã NPL' };
    }
    if (quantity === null || !(quantity > 0)) {
      return { ...base, material: null, status: 'invalid' as const, message: 'SL tồn phải là số lớn hơn 0' };
    }
    const siblings = byCode.get(normalizeMaterialCodeKey(code)) ?? [];
    const wantWarehouse = base.warehouse || fallbackWarehouse;
    const matchWarehouse = (material: MaterialRow) =>
      !wantWarehouse ||
      normalizeWarehouseName(material.warehouse) === normalizeWarehouseName(wantWarehouse);
    const candidates = siblings.filter(matchWarehouse);
    if (candidates.length === 1) {
      const material = candidates[0];
      return {
        ...base,
        warehouse: material.warehouse && material.warehouse !== '-' ? material.warehouse : wantWarehouse,
        unit: material.unit && material.unit !== '-' ? material.unit : base.unit,
        name: material.name && material.name !== '-' ? material.name : base.name,
        material,
        status: 'ready' as const,
        message: ''
      };
    }
    if (candidates.length > 1) {
      return { ...base, material: null, status: 'ambiguous' as const, message: 'Mã này có ở nhiều kho, hãy điền cột Kho' };
    }
    if (!base.unit) {
      return { ...base, material: null, status: 'invalid' as const, message: 'Mã mới cần điền thêm ĐVT' };
    }
    return {
      ...base,
      warehouse: wantWarehouse,
      material: null,
      status: 'new' as const,
      message: 'Mã mới — sẽ tự tạo danh mục khi lưu phiếu'
    };
  });
}

export function NvlOpeningStockImportModal({
  open,
  materials,
  warehouseOptions,
  defaultWarehouse,
  defaultMonth,
  onClose,
  onImported
}: {
  open: boolean;
  materials: MaterialRow[];
  warehouseOptions: string[];
  defaultWarehouse: string;
  defaultMonth: NvlOpeningStockMonth;
  onClose: () => void;
  onImported: (message: string, slipCodes: string[]) => void;
}) {
  const [thang, setThang] = useState(defaultMonth.thang);
  const [nam, setNam] = useState(defaultMonth.nam);
  const [tenKho, setTenKho] = useState(defaultWarehouse);
  const [ngayPhieu, setNgayPhieu] = useState(() => defaultOpeningSlipDate(defaultMonth.thang, defaultMonth.nam));
  const [parsedRows, setParsedRows] = useState<
    Array<{ code: string; name: string; unit: string; warehouse: string; openingStock: string; productionName: string; rowNumber: number }>
  >([]);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [formError, setFormError] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateSlips, setDuplicateSlips] = useState<string[]>([]);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setThang(defaultMonth.thang);
    setNam(defaultMonth.nam);
    setTenKho(defaultWarehouse);
    setNgayPhieu(defaultOpeningSlipDate(defaultMonth.thang, defaultMonth.nam));
    setParsedRows([]);
    setUploadedFileName('');
    setFormError('');
    setDuplicateSlips([]);
    setDuplicateConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open, defaultMonth.thang, defaultMonth.nam, defaultWarehouse]);

  useEffect(() => {
    if (!open) return;
    setNgayPhieu(defaultOpeningSlipDate(thang, nam));
    setDuplicateSlips([]);
    setDuplicateConfirmed(false);
  }, [open, thang, nam]);

  const previewRows = useMemo(
    () => (parsedRows.length > 0 ? buildPreviewRows(parsedRows, materials, tenKho) : []),
    [parsedRows, materials, tenKho]
  );
  const submittableRows = previewRows.filter(row => row.status === 'ready' || row.status === 'new');
  const invalidCount = previewRows.filter(row => row.status === 'invalid' || row.status === 'ambiguous').length;

  const handleDownloadTemplate = () => {
    downloadNvlOpeningStockTemplate(materials, thang, nam);
  };

  const handleFileChange = async (file?: File | null) => {
    if (!file) return;
    setIsReadingFile(true);
    setFormError('');
    setUploadedFileName(file.name);
    setDuplicateSlips([]);
    setDuplicateConfirmed(false);
    try {
      const rows = await parseMaterialCatalogExcel(file);
      if (rows.length === 0) throw new Error('File Excel không có dòng NVL hợp lệ (cần cột Mã NPL).');
      setParsedRows(rows);
    } catch (error: any) {
      setParsedRows([]);
      setFormError(error?.message || 'Không thể đọc file Excel.');
    } finally {
      setIsReadingFile(false);
    }
  };

  const checkDuplicateMonth = async (): Promise<string[]> => {
    const params = new URLSearchParams({ kho: 'nvl', from: ngayPhieu, to: ngayPhieu });
    const res = await fetch(`/api/phieu-nhap-kho?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Không thể kiểm tra phiếu trùng.');
    const needle = normalizeReason(nvlOpeningStockReason(thang, nam));
    const slips = new Map<string, string>();
    for (const item of Array.isArray(data.movements) ? data.movements : []) {
      const record = item as Record<string, unknown>;
      const reason = normalizeReason(record.ly_do ?? record.lyDo ?? record.reason);
      if (!reason.includes(needle)) continue;
      const slipCode = String(record.ma_phieu ?? record.slipCode ?? '').trim();
      const slipWarehouse = String(record.ten_kho ?? record.tenKho ?? '').trim();
      if (!slipCode || slips.has(slipCode)) continue;
      if (tenKho && normalizeWarehouseName(slipWarehouse) !== normalizeWarehouseName(tenKho)) continue;
      slips.set(slipCode, slipWarehouse);
    }
    return [...slips.keys()];
  };

  const handleSubmit = async () => {
    setFormError('');
    if (submittableRows.length === 0) {
      setFormError('Không có dòng hợp lệ để tạo phiếu. Kiểm tra lại cột Mã NPL và SL tồn trong file Excel.');
      return;
    }
    const monthStart = firstDayOfMonth(thang, nam);
    if (!ngayPhieu || ngayPhieu >= monthStart) {
      setFormError(`Ngày phiếu phải trước ngày mùng 1 tháng ${thang}/${nam} thì mới vào cột Tồn đầu.`);
      return;
    }
    setIsSubmitting(true);
    try {
      if (!duplicateConfirmed) {
        const dups = await checkDuplicateMonth();
        if (dups.length > 0) {
          setDuplicateSlips(dups);
          setFormError(
            `Đã có phiếu tồn đầu tháng ${thang}/${nam} (${dups.join(', ')}). Tạo tiếp sẽ cộng trùng tồn — chỉ tiếp tục khi chắc chắn.`
          );
          setIsSubmitting(false);
          return;
        }
      }
      const reason = nvlOpeningStockReason(thang, nam);
      const byWarehouse = new Map<string, NvlOpeningStockPreviewRow[]>();
      for (const row of submittableRows) {
        const warehouse = String(row.warehouse || tenKho || '').trim();
        if (!warehouse) {
          throw new Error(`Dòng ${row.code} chưa xác định được kho. Hãy điền cột Kho trong file Excel.`);
        }
        const list = byWarehouse.get(warehouse);
        if (list) list.push(row);
        else byWarehouse.set(warehouse, [row]);
      }
      const slipCodes: string[] = [];
      for (const [warehouse, rows] of byWarehouse) {
        const res = await fetch('/api/phieu-nhap-kho', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loaiPhieu: 'nhap',
            loaiKho: 'nvl',
            ngayPhieu,
            tenKho: warehouse,
            lyDo: reason,
            ghiChu: nvlOpeningStockNote(thang, nam),
            items: rows.map(row => ({
              ma_npl: row.code,
              ten_npl: row.name || row.material?.name || row.code,
              ...((row.productionName || row.material?.productionName) ? { ten_nvl_sx: row.productionName || row.material?.productionName } : {}),
              don_vi: row.unit || row.material?.unit || '',
              so_luong: row.quantity
            }))
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Không thể tạo phiếu nhập cho ${warehouse}.`);
        if (data.slipCode) slipCodes.push(String(data.slipCode));
      }
      onImported(
        `Đã tạo ${slipCodes.length} phiếu tồn đầu tháng ${thang}/${nam} (${submittableRows.length} mã): ${slipCodes.join(', ')}.`,
        slipCodes
      );
      onClose();
    } catch (error: any) {
      setFormError(error?.message || 'Không thể tạo phiếu tồn đầu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
              Import tồn đầu NVL theo tháng
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Đóng
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700">
              {formError}
              {duplicateSlips.length > 0 && !duplicateConfirmed && (
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateConfirmed(true);
                    setFormError('');
                  }}
                  className="mt-2 flex h-9 w-full items-center justify-center rounded-lg border border-rose-300 bg-white px-3 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100"
                >
                  Tôi chắc chắn — tạo phiếu tiếp
                </button>
              )}
            </div>
          )}

          <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Tháng tồn đầu *</span>
              <div className="flex gap-2">
                <select
                  value={thang}
                  onChange={e => setThang(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
                  className="h-10 flex-1 rounded-lg border border-zinc-200 bg-white px-2 text-sm font-bold text-zinc-800 outline-none focus:border-[#ef1b2d]"
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      Tháng {index + 1}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={2000}
                  max={2999}
                  value={nam}
                  onChange={e => setNam(Math.min(2999, Math.max(2000, Number(e.target.value) || 2000)))}
                  className="h-10 w-24 rounded-lg border border-zinc-200 bg-white px-2 text-center text-sm font-bold text-zinc-800 outline-none focus:border-[#ef1b2d]"
                />
              </div>
            </div>
            <label className="space-y-1 text-[11px] font-black uppercase tracking-wider text-zinc-500">
              Kho *
              <select
                value={tenKho}
                onChange={e => setTenKho(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm font-bold normal-case tracking-normal text-zinc-800 outline-none focus:border-[#ef1b2d]"
              >
                <option value="">— Chọn kho —</option>
                {warehouseOptions.map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-1 sm:col-span-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                Ngày phiếu (tự động)
              </span>
              <p className="flex h-10 items-center rounded-lg border border-zinc-200 bg-zinc-100 px-3 text-sm font-bold text-zinc-700">
                {ngayPhieu || '—'}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
            >
              <Download className="h-4 w-4" />
              Tải mẫu tồn đầu
            </button>
            <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100">
              {isReadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isReadingFile ? 'Đang đọc file...' : 'Tải file tồn đầu lên'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={event => {
                  void handleFileChange(event.target.files?.[0]);
                }}
              />
            </label>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs leading-5 text-zinc-600">
            <p className="font-bold text-zinc-800">Hướng dẫn</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>
                Bấm <strong>Tải mẫu tồn đầu</strong> — file có sẵn Mã NPL, Tên, ĐVT, Kho của kho đang xem, cột{' '}
                <strong>SL tồn</strong> để trống.
              </li>
              <li>
                Điền <strong>SL tồn</strong> thực tế tại đầu tháng {thang}/{nam} cho từng mã.
              </li>
              <li>
                Bấm <strong>Tải file tồn đầu lên</strong> — hệ thống khớp mã, tạo 1 phiếu nhập/kho với ngày{' '}
                {ngayPhieu || '—'} và ghi chú "{nvlOpeningStockNote(thang, nam)}".
              </li>
            </ol>
          </div>

          {uploadedFileName && (
            <p className="text-xs font-bold text-zinc-500">
              File: <span className="text-zinc-800">{uploadedFileName}</span>
            </p>
          )}

          {previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-800">
                  Tạo phiếu: {submittableRows.length}
                </span>
                {invalidCount > 0 && (
                  <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-rose-700">
                    Lỗi: {invalidCount}
                  </span>
                )}
              </div>
              <TableShell minWidthClassName="min-w-[640px]" maxHeightClassName="max-h-72">
                <TableHead>
                  <TableHeadCell>Mã NVL</TableHeadCell>
                  <TableHeadCell>Tên NVL</TableHeadCell>
                  <TableHeadCell>Kho</TableHeadCell>
                  <TableHeadCell align="center">SL tồn</TableHeadCell>
                  <TableHeadCell>Trạng thái</TableHeadCell>
                </TableHead>
                <TableBody>
                  {previewRows.length === 0 ? (
                    <TableEmptyRow colSpan={5}>Chưa có dòng nào.</TableEmptyRow>
                  ) : (
                    previewRows.map(row => (
                      <React.Fragment key={row.key}>
                        <TableRow className={row.status === 'ready' || row.status === 'new' ? 'bg-white' : 'bg-rose-50/60'}>
                          <td className="px-4 py-3 font-black text-zinc-900">{row.code || '—'}</td>
                          <td className="px-4 py-3 font-semibold text-zinc-700">{row.name || row.material?.name || '—'}</td>
                          <td className="px-4 py-3 text-zinc-600">{row.warehouse || tenKho || '—'}</td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-zinc-900">
                            {row.quantity !== null && Number.isFinite(row.quantity) ? row.quantity : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {row.status === 'ready' && <StatusBadge label="Tạo phiếu" color="emerald" />}
                            {row.status === 'new' && <StatusBadge label="Mã mới" color="amber" />}
                            {(row.status === 'invalid' || row.status === 'ambiguous') && (
                              <span className="text-xs font-bold text-rose-700">{row.message}</span>
                            )}
                            {row.status === 'new' && (
                              <span className="mt-1 block text-[11px] font-semibold text-amber-700">{row.message}</span>
                            )}
                          </td>
                        </TableRow>
                      </React.Fragment>
                    ))
                  )}
                </TableBody>
              </TableShell>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-zinc-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || submittableRows.length === 0}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] text-xs font-bold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isSubmitting ? 'Đang tạo phiếu...' : `Tạo phiếu tồn đầu (${submittableRows.length} mã)`}
          </button>
        </div>
      </div>
    </div>
  );
}
