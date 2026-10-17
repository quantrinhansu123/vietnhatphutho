import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Loader2, Upload, X } from 'lucide-react';
import { parsePeriodQuantityValue } from '../_shared/recordHelpers';
import { normalizeWarehouseName } from './index';
import { normalizeProducts } from '../san-pham';
import type { ProductRow } from '../san-pham/types';
import {
  StatusBadge,
  TableBody,
  TableEmptyRow,
  TableHead,
  TableHeadCell,
  TableRow,
  TableShell
} from '../../components/shared/table';

export interface TpOpeningStockMonth {
  thang: number;
  nam: number;
}

type PreviewStatus = 'ready' | 'new' | 'invalid' | 'ambiguous';

export interface TpOpeningStockPreviewRow {
  key: string;
  code: string;
  name: string;
  productionName: string;
  amisCode: string;
  unit: string;
  warehouse: string;
  quantity: number | null;
  quantityText: string;
  weightKg: number | null;
  weightText: string;
  product: ProductRow | null;
  status: PreviewStatus;
  message: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Mã lý do phiếu tồn đầu TP, dùng để phát hiện import trùng tháng. */
export function tpOpeningStockReason(thang: number, nam: number): string {
  return `Tồn đầu tháng ${thang}/${nam} (import)`;
}

/** Ghi chú phiếu tồn đầu TP. */
export function tpOpeningStockNote(thang: number, nam: number): string {
  const prevThang = thang === 1 ? 12 : thang - 1;
  const prevNam = thang === 1 ? nam - 1 : nam;
  return `Nhập tồn cuối tháng ${prevThang}/${prevNam} đầu tháng ${thang}/${nam}`;
}

function normalizeReason(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Khóa khớp mã SP/AMIS: bỏ khoảng trắng, hoa — `MT- MN001` và `MT-MN001` là một. */
function normalizeTpCodeKey(code: string): string {
  return String(code ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

/** Ngày phiếu mặc định = ngày cuối tháng trước của tháng tồn đầu. */
export function defaultTpOpeningSlipDate(thang: number, nam: number): string {
  const date = new Date(nam, thang - 1, 0);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function firstDayOfMonth(thang: number, nam: number): string {
  return `${nam}-${pad2(thang)}-01`;
}

export function downloadTpOpeningStockTemplate(products: ProductRow[], thang: number, nam: number) {
  const rows = products
    .filter(product => product.code && product.code !== '-')
    .sort((a, b) => String(a.code).localeCompare(String(b.code), 'vi'))
    .map(product => ({
      'Mã AMIS': product.amisCode && product.amisCode !== '-' ? product.amisCode : product.code,
      'Tên sản phẩm': product.name === '-' ? '' : product.name,
      'Tên sản xuất': (product.tenGhep && product.tenGhep !== '-' ? product.tenGhep : '') || (product.productionName === '-' ? '' : product.productionName || ''),
      'ĐVT': product.unit === '-' ? '' : product.unit,
      Kho: '',
      'SL tồn': '',
      'TL tồn (kg)': ''
    }));
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ['Mã AMIS', 'Tên sản phẩm', 'Tên sản xuất', 'ĐVT', 'Kho', 'SL tồn', 'TL tồn (kg)']
  });
  worksheet['!cols'] = [{ wch: 22 }, { wch: 42 }, { wch: 42 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ton_dau');
  XLSX.writeFile(workbook, `mau-ton-dau-tp-thang-${thang}-${nam}.xlsx`);
}

function normalizeExcelHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[_/-]+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ');
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function findExcelColumn(headers: string[], aliases: string[]): number {
  const exact = headers.findIndex(header => aliases.some(alias => header === alias));
  if (exact >= 0) return exact;
  return headers.findIndex(header =>
    aliases.some(alias => alias.length >= 3 && (header.includes(alias) || alias.includes(header)))
  );
}

export interface TpOpeningStockExcelRow {
  code: string;
  name: string;
  productionName: string;
  unit: string;
  warehouse: string;
  quantityText: string;
  weightText: string;
  rowNumber: number;
}

async function parseTpOpeningStockExcel(file: File): Promise<TpOpeningStockExcelRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false }) as unknown[][];
  if (matrix.length === 0) return [];
  const headers = matrix[0].map(normalizeExcelHeader);
  const codeIndex = findExcelColumn(headers, ['ma amis', 'ma_amis', 'amis', 'ma sp', 'ma_sp', 'ma san pham']);
  if (codeIndex < 0) throw new Error('Không tìm thấy cột "Mã AMIS" trong file Excel.');
  const nameIndex = findExcelColumn(headers, ['ten san pham', 'ten_sp', 'ten sp']);
  const sxIndex = findExcelColumn(headers, ['ten san xuat', 'ten_san_xuat', 'ten sx', 'ten ghep', 'ten_ghep']);
  const unitIndex = findExcelColumn(headers, ['don vi', 'don_vi', 'dvt', 'dvt ', 'unit']);
  const warehouseIndex = findExcelColumn(headers, ['kho', 'ten kho', 'ten_kho']);
  const qtyIndex = findExcelColumn(headers, ['sl ton', 'so luong ton', 'sl', 'so luong', 'ton dau', 'ton_dau']);
  const weightIndex = findExcelColumn(headers, ['tl ton', 'trong luong ton', 'tl', 'trong luong', 'tl kg', 'kg']);
  const get = (row: unknown[], index: number): string => (index >= 0 ? cellToText(row[index]) : '');
  return matrix
    .slice(1)
    .map((row, index) => ({
      code: get(row, codeIndex),
      name: get(row, nameIndex),
      productionName: get(row, sxIndex),
      unit: get(row, unitIndex),
      warehouse: get(row, warehouseIndex),
      quantityText: get(row, qtyIndex),
      weightText: get(row, weightIndex),
      rowNumber: index + 2
    }))
    .filter(row => Boolean(row.code.trim()));
}

function buildPreviewRows(
  parsed: TpOpeningStockExcelRow[],
  products: ProductRow[],
  fallbackWarehouse: string
): TpOpeningStockPreviewRow[] {
  const byCode = new Map<string, ProductRow[]>();
  for (const product of products) {
    for (const raw of [product.code, product.amisCode]) {
      const key = normalizeTpCodeKey(String(raw || ''));
      if (!key || key === '-') continue;
      const list = byCode.get(key);
      if (list) list.push(product);
      else byCode.set(key, [product]);
    }
  }
  const normName = (value: string): string =>
    String(value || '').trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ');
  return parsed.map((row, index) => {
    const code = String(row.code || '').trim();
    const quantity = parsePeriodQuantityValue(row.quantityText);
    const weightKg = row.weightText.trim() ? parsePeriodQuantityValue(row.weightText) : null;
    const base = {
      key: `${normalizeTpCodeKey(code) || 'norow'}-${row.rowNumber}-${index}`,
      code,
      name: String(row.name || '').trim(),
      productionName: String(row.productionName || '').trim(),
      amisCode: '',
      unit: String(row.unit || '').trim(),
      warehouse: String(row.warehouse || '').trim(),
      quantity,
      quantityText: String(row.quantityText || '').trim(),
      weightKg,
      weightText: String(row.weightText || '').trim()
    };
    if (!code) {
      return { ...base, product: null, status: 'invalid' as const, message: 'Thiếu mã AMIS' };
    }
    if (quantity === null || !(quantity > 0)) {
      return { ...base, product: null, status: 'invalid' as const, message: 'SL tồn phải là số lớn hơn 0' };
    }
    if (weightKg !== null && !(weightKg >= 0)) {
      return { ...base, product: null, status: 'invalid' as const, message: 'TL tồn phải là số ≥ 0' };
    }
    let candidates = byCode.get(normalizeTpCodeKey(code)) ?? [];
    if (candidates.length > 1 && (base.name || base.productionName)) {
      const wantName = normName(base.name);
      const wantSx = normName(base.productionName);
      const narrowed = candidates.filter(
        product =>
          (wantName && normName(product.name) === wantName) ||
          (wantSx && (normName(product.productionName || '') === wantSx || normName(product.tenGhep || '') === wantSx))
      );
      if (narrowed.length > 0) candidates = narrowed;
    }
    if (candidates.length === 1) {
      const product = candidates[0];
      return {
        ...base,
        name: product.name && product.name !== '-' ? product.name : base.name,
        productionName:
          base.productionName ||
          (product.tenGhep && product.tenGhep !== '-' ? product.tenGhep : '') ||
          (product.productionName && product.productionName !== '-' ? product.productionName : ''),
        amisCode: product.amisCode && product.amisCode !== '-' ? product.amisCode : code,
        unit: product.unit && product.unit !== '-' ? product.unit : base.unit,
        warehouse: base.warehouse || fallbackWarehouse,
        product,
        status: 'ready' as const,
        message: ''
      };
    }
    if (candidates.length > 1) {
      return { ...base, product: null, status: 'ambiguous' as const, message: 'Mã này có nhiều SP, hãy điền thêm Tên sản phẩm/Tên sản xuất để khớp' };
    }
    if (!base.name) {
      return { ...base, product: null, status: 'invalid' as const, message: 'Mã mới cần điền thêm Tên sản phẩm' };
    }
    if (!base.unit) {
      return { ...base, product: null, status: 'invalid' as const, message: 'Mã mới cần điền thêm ĐVT' };
    }
    return {
      ...base,
      amisCode: code,
      warehouse: base.warehouse || fallbackWarehouse,
      product: null,
      status: 'new' as const,
      message: 'Mã mới — sẽ tạo dòng tồn khi lưu phiếu'
    };
  });
}

export function TpOpeningStockImportModal({
  open,
  warehouseOptions,
  defaultWarehouse,
  defaultMonth,
  onClose,
  onImported
}: {
  open: boolean;
  warehouseOptions: string[];
  defaultWarehouse: string;
  defaultMonth: TpOpeningStockMonth;
  onClose: () => void;
  onImported: (message: string, slipCodes: string[]) => void;
}) {
  const [thang, setThang] = useState(defaultMonth.thang);
  const [nam, setNam] = useState(defaultMonth.nam);
  const [tenKho, setTenKho] = useState(defaultWarehouse);
  const [ngayPhieu, setNgayPhieu] = useState(() => defaultTpOpeningSlipDate(defaultMonth.thang, defaultMonth.nam));
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [parsedRows, setParsedRows] = useState<TpOpeningStockExcelRow[]>([]);
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
    setNgayPhieu(defaultTpOpeningSlipDate(defaultMonth.thang, defaultMonth.nam));
    setParsedRows([]);
    setUploadedFileName('');
    setFormError('');
    setDuplicateSlips([]);
    setDuplicateConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    let cancelled = false;
    const loadProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const res = await fetch('/api/san-pham?format=table');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Không thể tải danh mục sản phẩm.');
        if (!cancelled) setProducts(normalizeProducts(data));
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setIsLoadingProducts(false);
      }
    };
    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [open, defaultMonth.thang, defaultMonth.nam, defaultWarehouse]);

  useEffect(() => {
    if (!open) return;
    setNgayPhieu(defaultTpOpeningSlipDate(thang, nam));
    setDuplicateSlips([]);
    setDuplicateConfirmed(false);
  }, [open, thang, nam]);

  const previewRows = useMemo(
    () => (parsedRows.length > 0 ? buildPreviewRows(parsedRows, products, tenKho) : []),
    [parsedRows, products, tenKho]
  );
  const submittableRows = previewRows.filter(row => row.status === 'ready' || row.status === 'new');
  const invalidCount = previewRows.filter(row => row.status === 'invalid' || row.status === 'ambiguous').length;

  const handleDownloadTemplate = () => {
    downloadTpOpeningStockTemplate(products, thang, nam);
  };

  const handleFileChange = async (file?: File | null) => {
    if (!file) return;
    setIsReadingFile(true);
    setFormError('');
    setUploadedFileName(file.name);
    setDuplicateSlips([]);
    setDuplicateConfirmed(false);
    try {
      const rows = await parseTpOpeningStockExcel(file);
      if (rows.length === 0) throw new Error('File Excel không có dòng SP hợp lệ (cần cột Mã AMIS).');
      setParsedRows(rows);
    } catch (error: any) {
      setParsedRows([]);
      setFormError(error?.message || 'Không thể đọc file Excel.');
    } finally {
      setIsReadingFile(false);
    }
  };

  const checkDuplicateMonth = async (): Promise<string[]> => {
    const params = new URLSearchParams({ loai_kho: 'san_pham', from: ngayPhieu, to: ngayPhieu });
    const res = await fetch(`/api/phieu-nhap-kho?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Không thể kiểm tra phiếu trùng.');
    const needle = normalizeReason(tpOpeningStockReason(thang, nam));
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
      setFormError('Không có dòng hợp lệ để tạo phiếu. Kiểm tra lại cột Mã AMIS và SL tồn trong file Excel.');
      return;
    }
    const missingWarehouse = submittableRows.filter(row => !row.warehouse && !tenKho);
    if (missingWarehouse.length > 0) {
      setFormError('Có dòng chưa xác định được kho. Hãy điền cột Kho trong file Excel hoặc chọn kho mặc định.');
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
      const reason = tpOpeningStockReason(thang, nam);
      const byWarehouse = new Map<string, TpOpeningStockPreviewRow[]>();
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
            loaiKho: 'san_pham',
            ngayPhieu,
            tenKho: warehouse,
            lyDo: reason,
            ghiChu: tpOpeningStockNote(thang, nam),
            items: rows.map(row => ({
              code: row.code,
              name: row.name || row.product?.name || row.code,
              ...(row.productionName || row.product?.tenGhep || row.product?.productionName
                ? { productionName: row.productionName || row.product?.tenGhep || row.product?.productionName }
                : {}),
              ...(row.amisCode || row.product?.amisCode ? { amisCode: row.amisCode || row.product?.amisCode } : {}),
              unit: row.unit || row.product?.unit || '',
              quantity: row.quantity,
              ...(row.weightKg !== null && row.weightKg > 0 ? { weightKg: row.weightKg } : {})
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
              Import tồn đầu TP theo tháng
            </h3>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              Tạo phiếu nhập thành phẩm cho kho thành phẩm (Rỗng / Đặc / Sóng / Nẹp / hàng hóa…) — ngày phiếu trước mùng 1
            </p>
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
              Kho mặc định *
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
              disabled={isLoadingProducts}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isLoadingProducts ? 'Đang tải danh mục...' : 'Tải mẫu tồn đầu'}
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
                Bấm <strong>Tải mẫu tồn đầu</strong> — file có sẵn Mã AMIS, Tên SP, Tên SX của danh mục, cột{' '}
                <strong>SL tồn</strong> và <strong>TL tồn (kg)</strong> để trống.
              </li>
              <li>
                Điền <strong>SL tồn</strong> (bắt buộc) và <strong>TL tồn</strong> thực tế tại đầu tháng {thang}/{nam} cho
                từng mã, điền cột <strong>Kho</strong> nếu tồn nằm ở nhiều kho.
              </li>
              <li>
                Bấm <strong>Tải file tồn đầu lên</strong> — hệ thống khớp mã AMIS, tạo 1 phiếu nhập/kho với ngày{' '}
                {ngayPhieu || '—'} và ghi chú "{tpOpeningStockNote(thang, nam)}". Phiếu ghi đủ tên SP + tên SX + mã
                AMIS.
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
              <TableShell minWidthClassName="min-w-[720px]" maxHeightClassName="max-h-72">
                <TableHead>
                  <TableHeadCell>Mã AMIS</TableHeadCell>
                  <TableHeadCell>Tên sản phẩm</TableHeadCell>
                  <TableHeadCell>Kho</TableHeadCell>
                  <TableHeadCell align="center">SL tồn</TableHeadCell>
                  <TableHeadCell align="center">TL (kg)</TableHeadCell>
                  <TableHeadCell>Trạng thái</TableHeadCell>
                </TableHead>
                <TableBody>
                  {previewRows.length === 0 ? (
                    <TableEmptyRow colSpan={6}>Chưa có dòng nào.</TableEmptyRow>
                  ) : (
                    previewRows.map(row => (
                      <React.Fragment key={row.key}>
                        <TableRow className={row.status === 'ready' || row.status === 'new' ? 'bg-white' : 'bg-rose-50/60'}>
                          <td className="px-4 py-3 font-black text-zinc-900">{row.code || '—'}</td>
                          <td className="px-4 py-3 font-semibold text-zinc-700">{row.name || row.product?.name || '—'}</td>
                          <td className="px-4 py-3 text-zinc-600">{row.warehouse || tenKho || '—'}</td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-zinc-900">
                            {row.quantity !== null && Number.isFinite(row.quantity) ? row.quantity : '—'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-zinc-900">
                            {row.weightKg !== null && Number.isFinite(row.weightKg) ? row.weightKg : '—'}
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

export default TpOpeningStockImportModal;
