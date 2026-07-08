import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import {
  ClipboardCheck,
  ClipboardPaste,
  Download,
  Eye,
  FlaskConical,
  History,
  Loader2,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload
} from 'lucide-react';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage, formatCell } from '../_shared/recordHelpers';
import { downloadBulkOpeningStockTemplate, parseBulkOpeningStockExcel } from '../../utils/bulkOpeningStockExcel';
import { downloadBulkMaterialTotalWeightTemplate, parseBulkMaterialTotalWeightExcel } from '../../utils/bulkMaterialTotalWeightExcel';
import { productFieldClass } from '../san-pham/productFieldClass';
import { readUnitSuggestions, saveUnitSuggestion } from '../_shared/orderHelpers';

export interface MaterialRow {
  id: string;
  code: string;
  name: string;
  unit: string;
  totalWeight: string;
  plasticWeight: string;
  bagWeight: string;
  coreWeight: string;
  rollWidth: string;
  unitLength: string;
  openingStock: string;
  inbound: string;
  outbound: string;
}

export function parseInventoryNumber(value: string): number | null {
  if (!value || value === '-') return null;
  const normalized = String(value).trim().replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function isMaterialKgUnit(unit: string) {
  const normalized = unit.trim().toLowerCase();
  return normalized === 'kg';
}

export function computeClosingStock(opening: string, inbound: string, outbound: string): string {
  const openingVal = parseInventoryNumber(opening);
  if (openingVal === null) return '-';
  const inboundVal = parseInventoryNumber(inbound) ?? 0;
  const outboundVal = parseInventoryNumber(outbound) ?? 0;
  return String(Math.round((openingVal + inboundVal - outboundVal) * 100) / 100);
}

export function normalizeMaterialsInventory(data: unknown): MaterialRow[] {
  if (!data || typeof data !== 'object') return [];
  const materials = (data as { materials?: unknown }).materials;
  if (!Array.isArray(materials)) return [];

  return materials
    .map((item): MaterialRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = String(record.ma_npl ?? '').trim();
      const name = String(record.ten_npl ?? '').trim();
      if (!code && !name) return null;

      const rawId = String(record.id ?? '').trim();
      return {
        id: rawId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId)
          ? rawId
          : code || rawId || name,
        code,
        name,
        unit: formatCell(record.don_vi),
        totalWeight: formatCell(record.tong_trong_luong),
        plasticWeight: formatCell(record.trong_luong_nhua),
        bagWeight: formatCell(record.trong_luong_tui),
        coreWeight: formatCell(record.trong_luong_loi),
        rollWidth: formatCell(record.kho_cuon),
        unitLength: formatCell(record.chieu_dai_don_vi),
        openingStock: formatCell(record.ton_dau_ky),
        inbound: formatCell(record.nhap_trong_ky),
        outbound: formatCell(record.xuat_trong_ky)
      };
    })
    .filter((material): material is MaterialRow => Boolean(material));
}

export type MaterialFormState = {
  code: string;
  name: string;
  unit: string;
  totalWeight: string;
  plasticWeight: string;
  bagWeight: string;
  coreWeight: string;
  rollWidth: string;
  unitLength: string;
  openingStock: string;
  inbound: string;
  outbound: string;
};

const emptyMaterialForm = (): MaterialFormState => ({
  code: '',
  name: '',
  unit: '',
  totalWeight: '',
  plasticWeight: '',
  bagWeight: '',
  coreWeight: '',
  rollWidth: '',
  unitLength: '',
  openingStock: '',
  inbound: '',
  outbound: ''
});

export function materialCellToInput(value: string) {
  return value === '-' ? '' : value;
}

export function materialToForm(material: MaterialRow): MaterialFormState {
  return {
    code: materialCellToInput(material.code),
    name: materialCellToInput(material.name),
    unit: materialCellToInput(material.unit),
    totalWeight: materialCellToInput(material.totalWeight),
    plasticWeight: materialCellToInput(material.plasticWeight),
    bagWeight: materialCellToInput(material.bagWeight),
    coreWeight: materialCellToInput(material.coreWeight),
    rollWidth: materialCellToInput(material.rollWidth),
    unitLength: materialCellToInput(material.unitLength),
    openingStock: materialCellToInput(material.openingStock),
    inbound: materialCellToInput(material.inbound),
    outbound: materialCellToInput(material.outbound)
  };
}

async function patchMaterialsTotalWeight(materials: MaterialRow[], totalWeight: string) {
  await Promise.all(
    materials.map(async material => {
      const payload = {
        ...materialToForm(material),
        totalWeight
      };
      const res = await fetch(`/api/kho-nvl/${encodeURIComponent(material.code)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Không thể cập nhật ${material.code}.`);
      }
    })
  );
  return materials.length;
}

export function isFetchNetworkError(error: unknown) {
  if (error instanceof TypeError) return true;
  const message = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('networkerror');
}

const materialFieldClass =
  'h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

export type BulkOpeningStockPreviewRow = BulkOpeningStockImportRow & {
  material: MaterialRow | null;
  status: 'update' | 'create' | 'invalid' | 'skipped';
};

export function normalizeMaterialCodeKey(code: string) {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

export function buildBulkOpeningStockPreview(
  rows: BulkOpeningStockImportRow[],
  materials: MaterialRow[]
): BulkOpeningStockPreviewRow[] {
  const materialByCode = new Map<string, MaterialRow>();
  materials.forEach(material => {
    if (material.code && material.code !== '-') {
      materialByCode.set(normalizeMaterialCodeKey(material.code), material);
    }
  });

  return rows.map(row => {
    const openingValue = row.openingStock.trim().replace(',', '.');
    const hasOpeningValue = openingValue !== '' && openingValue !== '-';
    const isValidNumber = hasOpeningValue && Number.isFinite(Number(openingValue));
    const material = materialByCode.get(normalizeMaterialCodeKey(row.code)) ?? null;

    if (!hasOpeningValue) {
      return { ...row, material, status: 'skipped' as const };
    }

    return {
      ...row,
      material,
      status: !isValidNumber ? 'invalid' : material ? 'update' : 'create'
    };
  });
}

export function buildBulkOpeningStockPayload(
  row: BulkOpeningStockPreviewRow,
  material?: MaterialRow | null
) {
  const openingStock = row.openingStock.trim().replace(',', '.');
  const code = row.code.trim();
  const name = (row.name || material?.name || code).trim();

  if (material) {
    return {
      ...materialToForm(material),
      code,
      name: name || material.name.trim(),
      unit: material.unit === '-' ? '' : material.unit.trim(),
      openingStock
    };
  }

  return {
    ...emptyMaterialForm(),
    code,
    name: name || code,
    openingStock
  };
}

export function BulkOpeningStockModal({
  open,
  materials,
  onClose,
  onApplied
}: {
  open: boolean;
  materials: MaterialRow[];
  onClose: () => void;
  onApplied: (message: string) => void;
}) {
  const [importRows, setImportRows] = useState<BulkOpeningStockImportRow[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setImportRows([]);
      setUploadedFileName('');
      setPasteError('');
      setIsApplying(false);
      setIsReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  const previewRows = useMemo(
    () => (importRows.length > 0 ? buildBulkOpeningStockPreview(importRows, materials) : []),
    [importRows, materials]
  );
  const updateRows = previewRows.filter(row => row.status === 'update');
  const createRows = previewRows.filter(row => row.status === 'create');
  const applicableCount = updateRows.length + createRows.length;
  const invalidCount = previewRows.filter(row => row.status === 'invalid').length;
  const skippedCount = previewRows.filter(row => row.status === 'skipped').length;

  const handleDownloadTemplate = () => {
    downloadBulkOpeningStockTemplate(
      materials.map(material => ({
        code: material.code,
        name: material.name,
        openingStock: material.openingStock
      }))
    );
  };

  const handleFileChange = async (file?: File | null) => {
    if (!file) return;

    setIsReadingFile(true);
    setPasteError('');
    setUploadedFileName(file.name);

    try {
      const rows = await parseBulkOpeningStockExcel(file);
      if (rows.length === 0) {
        throw new Error('File Excel không có dòng dữ liệu hợp lệ.');
      }
      setImportRows(rows);
    } catch (error: any) {
      setImportRows([]);
      setPasteError(error.message || 'Không thể đọc file Excel.');
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleApply = async () => {
    if (applicableCount === 0) {
      setPasteError('Không có dòng hợp lệ để xử lý. Kiểm tra lại cột Mã NPL và Tồn đầu trong file Excel.');
      return;
    }

    if (
      !window.confirm(
        `Ghi đè Tồn đầu cho ${updateRows.length} NPL và thêm mới ${createRows.length} NPL?`
      )
    ) {
      return;
    }

    setIsApplying(true);
    setPasteError('');

    try {
      const updatedCodes: string[] = [];
      const createdCodes: string[] = [];

      await Promise.all([
        ...updateRows.map(async row => {
          const material = row.material!;
          const payload = buildBulkOpeningStockPayload(row, material);
          const res = await fetch(`/api/kho-nvl/${material.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || `Không thể cập nhật ${material.code}.`);
          }
          updatedCodes.push(material.code);
        }),
        ...createRows.map(async row => {
          const payload = buildBulkOpeningStockPayload(row);
          const res = await fetch('/api/kho-nvl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || `Không thể thêm mới ${row.code}.`);
          }
          createdCodes.push(row.code);
        })
      ]);

      const parts: string[] = [];
      if (updatedCodes.length > 0) parts.push(`ghi đè ${updatedCodes.length} NPL`);
      if (createdCodes.length > 0) parts.push(`thêm mới ${createdCodes.length} NPL`);
      onApplied(`Đã ${parts.join(', ')}.`);
      onClose();
    } catch (error: any) {
      setPasteError(error.message || 'Không thể cập nhật tồn đầu hàng loạt.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Cập nhật Tồn đầu từ Excel</h3>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              Mã đã có sẽ ghi đè Tồn đầu; mã chưa có sẽ tự thêm dòng NPL mới
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Đóng
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {pasteError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700">
              {pasteError}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
            >
              <Download className="h-4 w-4" />
              Tải mẫu Excel
            </button>
            <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100">
              {isReadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isReadingFile ? 'Đang đọc file...' : 'Tải file Excel lên'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0];
                  void handleFileChange(file);
                }}
              />
            </label>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs leading-5 text-zinc-600">
            <p className="font-bold text-zinc-800">Hướng dẫn</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>Bấm <strong>Tải mẫu Excel</strong> — file có sẵn Mã NPL, Tên NVL và Tồn đầu hiện tại.</li>
              <li>Sửa cột <strong>Tồn đầu</strong> hoặc thêm dòng mới (Mã NPL + Tên NVL + Tồn đầu).</li>
              <li>Bấm <strong>Tải file Excel lên</strong> — mã cũ ghi đè, mã mới tự thêm.</li>
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
                  Ghi đè: {updateRows.length}
                </span>
                <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-sky-800">
                  Thêm mới: {createRows.length}
                </span>
                {skippedCount > 0 && (
                  <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-zinc-700">
                    Bỏ qua (trống): {skippedCount}
                  </span>
                )}
                {invalidCount > 0 && (
                  <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-rose-700">
                    Tồn đầu không hợp lệ: {invalidCount}
                  </span>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-[10px] uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-3 py-2 font-black">Mã NPL</th>
                      <th className="px-3 py-2 font-black">Tên NVL</th>
                      <th className="px-3 py-2 font-black">Tồn đầu mới</th>
                      <th className="px-3 py-2 font-black">Tồn đầu hiện tại</th>
                      <th className="px-3 py-2 font-black">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {previewRows.map((row, index) => (
                      <tr
                        key={`${row.code}-${index}`}
                        className={
                          row.status === 'update'
                            ? 'bg-white'
                            : row.status === 'create'
                              ? 'bg-sky-50/60'
                              : row.status === 'skipped'
                                ? 'bg-zinc-50'
                                : 'bg-rose-50/60'
                        }
                      >
                        <td className="px-3 py-2 font-black text-zinc-900">{row.code}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-700">
                          {row.name || row.material?.name || '-'}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-zinc-800">{row.openingStock}</td>
                        <td className="px-3 py-2 font-mono font-bold text-zinc-500">
                          {row.material?.openingStock ?? '-'}
                        </td>
                        <td className="px-3 py-2 font-bold">
                          {row.status === 'update' && <span className="text-emerald-700">Ghi đè</span>}
                          {row.status === 'create' && <span className="text-sky-700">Thêm mới</span>}
                          {row.status === 'skipped' && <span className="text-zinc-500">Bỏ qua</span>}
                          {row.status === 'invalid' && <span className="text-rose-700">Số không hợp lệ</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying || applicableCount === 0}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isApplying ? 'Đang xử lý...' : `Áp dụng ${applicableCount} dòng`}
          </button>
        </div>
      </div>
    </div>
  );
}

export type BulkMaterialTotalWeightPreviewRow = BulkMaterialTotalWeightImportRow & {
  material: MaterialRow | null;
  status: 'update' | 'not_found' | 'invalid' | 'skipped';
};

export function buildBulkMaterialTotalWeightPreview(
  rows: BulkMaterialTotalWeightImportRow[],
  materials: MaterialRow[]
): BulkMaterialTotalWeightPreviewRow[] {
  const materialByCode = new Map<string, MaterialRow>();
  materials.forEach(material => {
    if (material.code && material.code !== '-') {
      materialByCode.set(normalizeMaterialCodeKey(material.code), material);
    }
  });

  return rows.map(row => {
    const weightValue = row.totalWeight.trim().replace(',', '.');
    const hasWeightValue = weightValue !== '' && weightValue !== '-';
    const isValidNumber = hasWeightValue && Number.isFinite(Number(weightValue));
    const material = materialByCode.get(normalizeMaterialCodeKey(row.code)) ?? null;

    if (!hasWeightValue) {
      return { ...row, material, status: 'skipped' as const };
    }

    if (!isValidNumber) {
      return { ...row, material, status: 'invalid' as const };
    }

    if (!material) {
      return { ...row, material, status: 'not_found' as const };
    }

    return { ...row, material, status: 'update' as const };
  });
}

export function BulkMaterialTotalWeightModal({
  open,
  materials,
  onClose,
  onApplied
}: {
  open: boolean;
  materials: MaterialRow[];
  onClose: () => void;
  onApplied: (message: string) => void;
}) {
  const [importRows, setImportRows] = useState<BulkMaterialTotalWeightImportRow[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setImportRows([]);
      setUploadedFileName('');
      setPasteError('');
      setIsApplying(false);
      setIsReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  const previewRows = useMemo(
    () => (importRows.length > 0 ? buildBulkMaterialTotalWeightPreview(importRows, materials) : []),
    [importRows, materials]
  );
  const updateRows = previewRows.filter(row => row.status === 'update');
  const applicableCount = updateRows.length;
  const invalidCount = previewRows.filter(row => row.status === 'invalid').length;
  const notFoundCount = previewRows.filter(row => row.status === 'not_found').length;
  const skippedCount = previewRows.filter(row => row.status === 'skipped').length;

  const handleDownloadTemplate = () => {
    downloadBulkMaterialTotalWeightTemplate(
      materials.map(material => ({
        code: material.code,
        totalWeight: material.totalWeight
      }))
    );
  };

  const handleFileChange = async (file?: File | null) => {
    if (!file) return;

    setIsReadingFile(true);
    setPasteError('');
    setUploadedFileName(file.name);

    try {
      const rows = await parseBulkMaterialTotalWeightExcel(file);
      if (rows.length === 0) {
        throw new Error('File Excel không có dòng dữ liệu hợp lệ.');
      }
      setImportRows(rows);
    } catch (error: any) {
      setImportRows([]);
      setPasteError(error.message || 'Không thể đọc file Excel.');
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleApply = async () => {
    if (applicableCount === 0) {
      setPasteError('Không có dòng hợp lệ để xử lý. Kiểm tra lại cột Mã NVL và Tổng trọng lượng trong file Excel.');
      return;
    }

    if (!window.confirm(`Cập nhật Tổng trọng lượng cho ${updateRows.length} NPL?`)) {
      return;
    }

    setIsApplying(true);
    setPasteError('');

    try {
      const updatedCodes: string[] = [];

      await Promise.all(
        updateRows.map(async row => {
          const material = row.material!;
          const payload = {
            ...materialToForm(material),
            totalWeight: row.totalWeight.trim().replace(',', '.')
          };
          const res = await fetch(`/api/kho-nvl/${material.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || `Không thể cập nhật ${material.code}.`);
          }
          updatedCodes.push(material.code);
        })
      );

      onApplied(`Đã cập nhật Tổng trọng lượng cho ${updatedCodes.length} NPL.`);
      onClose();
    } catch (error: any) {
      setPasteError(error.message || 'Không thể cập nhật Tổng trọng lượng hàng loạt.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
              Cập nhật Tổng trọng lượng từ Excel
            </h3>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              Khớp theo Mã NVL / Mã NPL và ghi vào cột Tổng kg
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Đóng
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {pasteError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700">
              {pasteError}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
            >
              <Download className="h-4 w-4" />
              Tải mẫu Excel
            </button>
            <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100">
              {isReadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isReadingFile ? 'Đang đọc file...' : 'Tải file Excel lên'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0];
                  void handleFileChange(file);
                }}
              />
            </label>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs leading-5 text-zinc-600">
            <p className="font-bold text-zinc-800">Hướng dẫn</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>
                Bấm <strong>Tải mẫu Excel</strong> — file có 2 cột: <strong>Mã NVL</strong> và{' '}
                <strong>Tổng trọng lượng</strong>.
              </li>
              <li>Sửa cột <strong>Tổng trọng lượng</strong> theo từng mã NPL.</li>
              <li>
                Bấm <strong>Tải file Excel lên</strong> — hệ thống khớp Mã NVL và cập nhật cột Tổng kg.
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
                  Cập nhật: {updateRows.length}
                </span>
                {notFoundCount > 0 && (
                  <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800">
                    Không tìm thấy mã: {notFoundCount}
                  </span>
                )}
                {skippedCount > 0 && (
                  <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-zinc-700">
                    Bỏ qua (trống): {skippedCount}
                  </span>
                )}
                {invalidCount > 0 && (
                  <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-rose-700">
                    Số không hợp lệ: {invalidCount}
                  </span>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-[10px] uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-3 py-2 font-black">Mã NVL</th>
                      <th className="px-3 py-2 font-black">Tổng trọng lượng mới</th>
                      <th className="px-3 py-2 font-black">Tổng kg hiện tại</th>
                      <th className="px-3 py-2 font-black">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {previewRows.map((row, index) => (
                      <tr
                        key={`${row.code}-${index}`}
                        className={
                          row.status === 'update'
                            ? 'bg-white'
                            : row.status === 'not_found'
                              ? 'bg-amber-50/60'
                              : row.status === 'skipped'
                                ? 'bg-zinc-50'
                                : 'bg-rose-50/60'
                        }
                      >
                        <td className="px-3 py-2 font-black text-zinc-900">{row.code}</td>
                        <td className="px-3 py-2 font-mono font-bold text-zinc-800">{row.totalWeight}</td>
                        <td className="px-3 py-2 font-mono font-bold text-zinc-500">
                          {row.material?.totalWeight ?? '-'}
                        </td>
                        <td className="px-3 py-2 font-bold">
                          {row.status === 'update' && <span className="text-emerald-700">Cập nhật</span>}
                          {row.status === 'not_found' && <span className="text-amber-700">Không tìm thấy</span>}
                          {row.status === 'skipped' && <span className="text-zinc-500">Bỏ qua</span>}
                          {row.status === 'invalid' && <span className="text-rose-700">Số không hợp lệ</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying || applicableCount === 0}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isApplying ? 'Đang xử lý...' : `Áp dụng ${applicableCount} dòng`}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface MaterialMovementRow {
  slipCode: string;
  slipType: 'nhap' | 'xuat';
  slipDate: string;
  quantity: number;
}

export function parseMaterialMovements(data: unknown): MaterialMovementRow[] {
  const list =
    data && typeof data === 'object' && Array.isArray((data as { movements?: unknown }).movements)
      ? (data as { movements: unknown[] }).movements
      : [];

  return list
    .map((entry): MaterialMovementRow | null => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const slipTypeRaw = String(record.loai_phieu ?? record.slipType ?? '').trim().toLowerCase();
      const quantity = Number(record.so_luong ?? record.quantity);
      return {
        slipCode: String(record.ma_phieu ?? record.slipCode ?? '').trim(),
        slipType: slipTypeRaw === 'xuat' ? 'xuat' : 'nhap',
        slipDate: String(record.ngay_phieu ?? record.slipDate ?? '').trim(),
        quantity: Number.isFinite(quantity) ? quantity : 0
      };
    })
    .filter((row): row is MaterialMovementRow => Boolean(row.slipCode || row.quantity));
}

export function sumMaterialMovementQuantity(rows: MaterialMovementRow[], slipType: 'nhap' | 'xuat') {
  return rows
    .filter(row => row.slipType === slipType)
    .reduce((sum, row) => sum + row.quantity, 0);
}

export type MaterialViewTab = 'info' | 'nvl-info' | 'history';

export function MaterialViewModal({
  material,
  onClose,
  onEdit,
  onDelete,
  isDeleting
}: {
  material: MaterialRow;
  onClose: () => void;
  onEdit: (material: MaterialRow) => void;
  onDelete: (material: MaterialRow) => void;
  isDeleting: boolean;
}) {
  const [tab, setTab] = useState<MaterialViewTab>('info');
  const [movements, setMovements] = useState<MaterialMovementRow[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    if (tab !== 'history' || !material.code) return;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setHistoryError('');
      try {
        const params = new URLSearchParams();
        params.set('loai_kho', 'nvl');
        params.set('ma_npl', material.code);
        const res = await fetch(`/api/phieu-xuat-nhap-kho?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Không thể tải lịch sử xuất nhập.');
        setMovements(parseMaterialMovements(data));
      } catch (error: any) {
        setMovements([]);
        setHistoryError(error.message || 'Không thể tải lịch sử xuất nhập.');
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [tab, material.code]);

  const inboundRows = useMemo(() => movements.filter(row => row.slipType === 'nhap'), [movements]);
  const outboundRows = useMemo(() => movements.filter(row => row.slipType === 'xuat'), [movements]);
  const totalInbound = sumMaterialMovementQuantity(movements, 'nhap');
  const totalOutbound = sumMaterialMovementQuantity(movements, 'xuat');
  const inboundDisplay = tab === 'history' ? String(Math.round(totalInbound * 100) / 100) : material.inbound;
  const outboundDisplay = tab === 'history' ? String(Math.round(totalOutbound * 100) / 100) : material.outbound;
  const closingDisplay = computeClosingStock(material.openingStock, inboundDisplay, outboundDisplay);

  const infoRows: Array<[string, string]> = [
    ['Mã NPL', material.code],
    ['Tên NVL', material.name],
    ['Đơn vị', material.unit],
    ['Tồn đầu', material.openingStock],
    ['Nhập', inboundDisplay],
    ['Xuất', outboundDisplay],
    ['Tồn cuối', closingDisplay]
  ];

  const nvlInfoRows: Array<[string, string]> = [
    ['Tổng kg', material.totalWeight],
    ['Kg nhựa', material.plasticWeight],
    ['Kg túi', material.bagWeight],
    ['Kg lõi', material.coreWeight],
    ['Khổ cuộn', material.rollWidth],
    ['Dài ĐV', material.unitLength]
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl ${
          tab === 'history' ? 'max-w-4xl' : 'max-w-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-red-500">Xem NVL</p>
            <h3 className="mt-1 text-lg font-black text-zinc-950">{material.name || material.code}</h3>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">{material.code}</p>
          </div>
          <BackButton onClick={onClose} />
        </div>

        <div className="flex gap-1 border-b border-zinc-200 px-4">
          <button
            type="button"
            onClick={() => setTab('info')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
              tab === 'info' ? 'border-[#ef1b2d] text-[#ef1b2d]' : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Package className="h-4 w-4" />
            Thông tin
          </button>
          <button
            type="button"
            onClick={() => setTab('nvl-info')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
              tab === 'nvl-info' ? 'border-[#ef1b2d] text-[#ef1b2d]' : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <FlaskConical className="h-4 w-4" />
            Thông tin NVL
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
              tab === 'history' ? 'border-[#ef1b2d] text-[#ef1b2d]' : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <History className="h-4 w-4" />
            Lịch sử X/N
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === 'history' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Tồn đầu', material.openingStock],
                  ['Nhập', formatNumber(totalInbound, 2)],
                  ['Xuất', formatNumber(totalOutbound, 2)],
                  ['Tồn cuối', closingDisplay]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
                    <p className="mt-1 font-black text-zinc-900">{value || '-'}</p>
                  </div>
                ))}
              </div>

              {historyError && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                  {historyError}
                </p>
              )}

              {isLoadingHistory ? (
                <p className="py-8 text-center text-sm font-bold text-zinc-500">Đang tải lịch sử...</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="overflow-hidden rounded-xl border border-emerald-200">
                    <div className="bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-emerald-800">
                      Nhập kho ({inboundRows.length})
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
                          <tr>
                            <th className="px-3 py-2 font-black">Ngày</th>
                            <th className="px-3 py-2 font-black">Phiếu</th>
                            <th className="px-3 py-2 text-right font-black">SL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {inboundRows.map(row => (
                            <tr key={`${row.slipCode}-${row.slipDate}-${row.quantity}`}>
                              <td className="px-3 py-2 font-semibold text-zinc-700">{row.slipDate || '-'}</td>
                              <td className="px-3 py-2 font-bold text-zinc-900">{row.slipCode || '-'}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                                {formatNumber(row.quantity, 2)}
                              </td>
                            </tr>
                          ))}
                          {inboundRows.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-3 py-6 text-center font-semibold text-zinc-400">
                                Chưa có phiếu nhập
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-amber-200">
                    <div className="bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-amber-800">
                      Xuất kho ({outboundRows.length})
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
                          <tr>
                            <th className="px-3 py-2 font-black">Ngày</th>
                            <th className="px-3 py-2 font-black">Phiếu</th>
                            <th className="px-3 py-2 text-right font-black">SL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {outboundRows.map(row => (
                            <tr key={`${row.slipCode}-${row.slipDate}-${row.quantity}`}>
                              <td className="px-3 py-2 font-semibold text-zinc-700">{row.slipDate || '-'}</td>
                              <td className="px-3 py-2 font-bold text-zinc-900">{row.slipCode || '-'}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-amber-800">
                                {formatNumber(row.quantity, 2)}
                              </td>
                            </tr>
                          ))}
                          {outboundRows.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-3 py-6 text-center font-semibold text-zinc-400">
                                Chưa có phiếu xuất
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(tab === 'info' ? infoRows : nvlInfoRows).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="mt-1 font-bold text-zinc-900">{value || '-'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <button type="button" onClick={() => onEdit(material)} className="flex h-10 items-center gap-1.5 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100">
            <Pencil className="h-4 w-4" />
            Sửa
          </button>
          <button
            type="button"
            onClick={() => onDelete(material)}
            disabled={isDeleting}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}

export function MaterialsInventoryPanel({ onBack }: { onBack: () => void }) {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [materialsError, setMaterialsError] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingMaterial, setViewingMaterial] = useState<MaterialRow | null>(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [isSavingMaterial, setIsSavingMaterial] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [materialForm, setMaterialForm] = useState<MaterialFormState>(emptyMaterialForm);
  const [showBulkOpeningStock, setShowBulkOpeningStock] = useState(false);
  const [showBulkTotalWeight, setShowBulkTotalWeight] = useState(false);
  const [isFillingKgTotalWeight, setIsFillingKgTotalWeight] = useState(false);

  const loadMaterials = async () => {
    setIsLoadingMaterials(true);
    setMaterialsError('');

    try {
      const res = await fetch('/api/kho-nvl');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải nguyên phụ liệu từ Supabase.');
      }

      setMaterials(normalizeMaterialsInventory(data));
    } catch (error: any) {
      setMaterials([]);
      setMaterialsError(error.message || 'Không thể tải nguyên phụ liệu từ Supabase.');
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const units = useMemo(
    () => ['all', ...Array.from(new Set(materials.map(material => material.unit).filter(unit => unit !== '-'))).sort((a, b) => a.localeCompare(b, 'vi'))],
    [materials]
  );
  const materialUnitSuggestions = useMemo(() => {
    const fromMaterials = materials.map(material => material.unit).filter(unit => unit && unit !== '-');
    return [...new Set([...fromMaterials, ...readUnitSuggestions()])].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [materials]);
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredMaterials = useMemo(() => {
    return materials.filter(material => {
      const matchesUnit = selectedUnit === 'all' || material.unit === selectedUnit;
      const matchesSearch =
        !normalizedSearch ||
        `${material.code} ${material.name} ${material.unit}`.toLowerCase().includes(normalizedSearch);
      return matchesUnit && matchesSearch;
    });
  }, [materials, normalizedSearch, selectedUnit]);

  const totalWeightAll = materials.reduce((sum, material) => {
    const value = parseInventoryNumber(material.totalWeight);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  const handleDownloadTotalWeightTemplate = () => {
    downloadBulkMaterialTotalWeightTemplate(
      materials.map(material => ({
        code: material.code,
        totalWeight: material.totalWeight
      }))
    );
  };

  const handleDownloadOpeningStockTemplate = () => {
    downloadBulkOpeningStockTemplate(
      materials.map(material => ({
        code: material.code,
        name: material.name,
        openingStock: material.openingStock
      }))
    );
  };

  const handleFillKgTotalWeight25 = async () => {
    const kgMaterials = materials.filter(
      material => material.code && isMaterialKgUnit(material.unit)
    );
    if (kgMaterials.length === 0) {
      setMaterialsError('Không có NPL nào có đơn vị Kg.');
      return;
    }

    if (!window.confirm(`Điền Tổng kg = 25 cho ${kgMaterials.length} NPL có đơn vị Kg?`)) {
      return;
    }

    setIsFillingKgTotalWeight(true);
    setMaterialsError('');
    setActionMessage('');

    try {
      let updated = 0;

      try {
        const res = await fetch('/api/kho-nvl/fill-total-kg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: 25 })
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          updated = data.updated ?? kgMaterials.length;
        } else if (res.status === 404) {
          updated = await patchMaterialsTotalWeight(kgMaterials, '25');
        } else {
          throw new Error(data.error || 'Không thể điền Tổng kg hàng loạt.');
        }
      } catch (error) {
        if (!isFetchNetworkError(error)) throw error;
        updated = await patchMaterialsTotalWeight(kgMaterials, '25');
      }

      setActionMessage(`Đã điền Tổng kg = 25 cho ${updated} NPL (đơn vị Kg).`);
      await loadMaterials();
    } catch (error: any) {
      if (isFetchNetworkError(error)) {
        setMaterialsError(
          'Mất kết nối server (Failed to fetch). Chạy `npm run dev` trong thư mục dự án, đợi dòng "Server running on http://0.0.0.0:3002", rồi tải lại trang.'
        );
        return;
      }
      setMaterialsError(error.message || 'Không thể điền Tổng kg hàng loạt.');
    } finally {
      setIsFillingKgTotalWeight(false);
    }
  };

  const openAddForm = () => {
    setFormError('');
    setActionMessage('');
    setEditingId(null);
    setMaterialForm(emptyMaterialForm());
    setFormMode('add');
  };

  const openEditForm = (material: MaterialRow) => {
    setFormError('');
    setActionMessage('');
    setViewingMaterial(null);
    setEditingId(material.id);
    setMaterialForm(materialToForm(material));
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormError('');
  };

  const handleSaveMaterial = async () => {
    if (!materialForm.code.trim()) {
      setFormError('Vui lòng nhập mã NPL.');
      return;
    }
    if (!materialForm.name.trim()) {
      setFormError('Vui lòng nhập tên nguyên phụ liệu.');
      return;
    }

    const payload = {
      ...materialForm,
      code: materialForm.code.trim(),
      unit: materialForm.unit.trim()
    };

    if (payload.unit) {
      saveUnitSuggestion(payload.unit);
    }

    setIsSavingMaterial(true);
    setFormError('');

    try {
      const isEdit = formMode === 'edit' && editingId;
      const res = await fetch(isEdit ? `/api/kho-nvl/${editingId}` : '/api/kho-nvl', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || (isEdit ? 'Không thể cập nhật nguyên phụ liệu.' : 'Không thể thêm nguyên phụ liệu.'));
      }

      closeForm();
      setActionMessage(isEdit ? 'Đã cập nhật nguyên phụ liệu.' : 'Đã thêm nguyên phụ liệu mới.');
      await loadMaterials();
    } catch (error: any) {
      setFormError(error.message || 'Không thể lưu nguyên phụ liệu.');
    } finally {
      setIsSavingMaterial(false);
    }
  };

  const handleDeleteMaterial = async (material: MaterialRow) => {
    if (!material.id) {
      setMaterialsError('Không tìm thấy ID để xóa.');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa NPL "${material.code || material.name}"?`)) return;

    setDeletingMaterialId(material.id);
    setActionMessage('');

    try {
      const res = await fetch(`/api/kho-nvl/${material.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa nguyên phụ liệu.');
      }

      if (viewingMaterial?.id === material.id) setViewingMaterial(null);
      setActionMessage('Đã xóa nguyên phụ liệu.');
      await loadMaterials();
    } catch (error: any) {
      setMaterialsError(error.message || 'Không thể xóa nguyên phụ liệu.');
    } finally {
      setDeletingMaterialId(null);
    }
  };

  const materialFormFields: Array<{ key: keyof MaterialFormState; label: string; required?: boolean; placeholder?: string }> = [
    { key: 'name', label: 'Tên nguyên phụ liệu', required: true, placeholder: 'VD: Màng PE' },
    { key: 'totalWeight', label: 'Tổng kg' },
    { key: 'plasticWeight', label: 'Kg nhựa' },
    { key: 'bagWeight', label: 'Kg túi' },
    { key: 'coreWeight', label: 'Kg lõi' },
    { key: 'rollWidth', label: 'Khổ cuộn' },
    { key: 'unitLength', label: 'Chiều dài ĐV' },
    { key: 'openingStock', label: 'Tồn đầu kỳ' },
    { key: 'inbound', label: 'Nhập trong kỳ' },
    { key: 'outbound', label: 'Xuất trong kỳ' }
  ];

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="bg-white p-3 text-slate-700 border-b border-slate-200">
          <div className="flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
            <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 lg:w-[360px]">
              <Search className="h-4 w-4 shrink-0 text-zinc-400" />
              <input
                value={searchText}
                onChange={event => setSearchText(event.target.value)}
                placeholder="Tìm mã NVL, tên nguyên phụ liệu..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
            </label>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={handleDownloadOpeningStockTemplate}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-extrabold text-emerald-700 transition hover:bg-emerald-100"
              >
                <Download className="h-4 w-4" />
                Tải mẫu Tồn đầu
              </button>
              <button
                type="button"
                onClick={() => setShowBulkOpeningStock(true)}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-extrabold text-slate-700 transition hover:bg-slate-200"
              >
                <ClipboardPaste className="h-4 w-4" />
                Excel Tồn đầu
              </button>
              <button
                type="button"
                onClick={handleDownloadTotalWeightTemplate}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-extrabold text-emerald-700 transition hover:bg-emerald-100"
              >
                <Download className="h-4 w-4" />
                Tải mẫu Excel
              </button>
              <button
                type="button"
                onClick={() => setShowBulkTotalWeight(true)}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-extrabold text-slate-700 transition hover:bg-slate-200"
              >
                <Upload className="h-4 w-4" />
                Tải Excel lên
              </button>
              <button
                type="button"
                onClick={handleFillKgTotalWeight25}
                disabled={isFillingKgTotalWeight || isLoadingMaterials || materials.length === 0}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-extrabold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFillingKgTotalWeight ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Điền 25 kg (Kg)
              </button>
              <button
                type="button"
                onClick={openAddForm}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>

            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Mã NVL', materials.length],
              ['Tổng kg', formatNumber(totalWeightAll, 4)],
              ['Đơn vị', units.length > 0 ? units.length - 1 : 0]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block font-bold text-slate-500">{label}</span>
                <span className="mt-1 block text-xl font-black text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {units.map(unit => (
            <button
              key={unit}
              type="button"
              onClick={() => setSelectedUnit(unit)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedUnit === unit
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {unit === 'all' ? 'Tất cả' : unit}
            </button>
          ))}
          {isLoadingMaterials && (
            <div className="flex h-11 shrink-0 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-500">
              Đang tải Supabase...
            </div>
          )}
        </div>

        {materialsError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {materialsError}
          </p>
        )}

        {actionMessage && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 lg:mt-0">
            {actionMessage}
          </p>
        )}
      </section>

      {formMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  {formMode === 'edit' ? 'Sửa nguyên phụ liệu' : 'Thêm nguyên phụ liệu'}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">Ghi vào bảng kho_nvl trên Supabase</p>
              </div>
              <button type="button" onClick={closeForm} className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50">
                Đóng
              </button>
            </div>
            {formError && (
              <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 p-4">
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã NPL *</span>
                <input
                  value={materialForm.code}
                  onChange={e => setMaterialForm(prev => ({ ...prev, code: e.target.value }))}
                  className={materialFieldClass}
                  placeholder="VD: NPL-001"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Đơn vị</span>
                <input
                  list="material-unit-suggestions"
                  value={materialForm.unit}
                  onChange={e => setMaterialForm(prev => ({ ...prev, unit: e.target.value }))}
                  onBlur={e => {
                    const trimmed = e.target.value.trim();
                    if (trimmed) saveUnitSuggestion(trimmed);
                  }}
                  className={materialFieldClass}
                  placeholder="Chọn hoặc nhập đơn vị mới"
                />
                <datalist id="material-unit-suggestions">
                  {materialUnitSuggestions.map(unit => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
              </label>
              {materialFormFields.map(field => (
                <label key={field.key} className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                    {field.label}{field.required ? ' *' : ''}
                  </span>
                  <input
                    value={materialForm[field.key]}
                    onChange={e => setMaterialForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className={materialFieldClass}
                    placeholder={field.placeholder}
                  />
                </label>
              ))}
            </div>
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button type="button" onClick={closeForm} className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50">
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveMaterial}
                disabled={isSavingMaterial}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingMaterial ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSavingMaterial ? 'Đang lưu...' : formMode === 'edit' ? 'Cập nhật' : 'Lưu NPL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingMaterial && (
        <MaterialViewModal
          material={viewingMaterial}
          onClose={() => {
            setViewingMaterial(null);
            loadMaterials();
          }}
          onEdit={openEditForm}
          onDelete={handleDeleteMaterial}
          isDeleting={deletingMaterialId === viewingMaterial.id}
        />
      )}

      <BulkOpeningStockModal
        open={showBulkOpeningStock}
        materials={materials}
        onClose={() => setShowBulkOpeningStock(false)}
        onApplied={message => {
          setActionMessage(message);
          void loadMaterials();
        }}
      />

      <BulkMaterialTotalWeightModal
        open={showBulkTotalWeight}
        materials={materials}
        onClose={() => setShowBulkTotalWeight(false)}
        onApplied={message => {
          setActionMessage(message);
          void loadMaterials();
        }}
      />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="overflow-x-auto md:overflow-visible">
          <table className="responsive-table w-full min-w-[640px] md:min-w-0 text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 font-bold">
              <tr>
                <th className="px-2.5 py-2 font-bold">Mã NPL</th>
                <th className="px-2.5 py-2 font-bold">Tên nguyên phụ liệu</th>
                <th className="px-2.5 py-2 font-bold">ĐV</th>
                <th className="px-2.5 py-2 text-right font-bold">Tổng kg</th>
                <th className="px-2.5 py-2 font-bold">Tồn đầu</th>
                <th className="px-2.5 py-2 font-bold">Nhập</th>
                <th className="px-2.5 py-2 font-bold">Xuất</th>
                <th className="px-2.5 py-2 font-bold">Tồn cuối</th>
                <th className="px-2.5 py-2 text-center font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMaterials.map(material => (
                <tr key={material.id} className="transition hover:bg-brand-50/40">
                  <td data-label="Mã NPL" className="px-1 md:px-2.5 py-2 font-black text-slate-900">{material.code || '-'}</td>
                  <td data-label="Tên NVL" className="px-1 md:px-2.5 py-2 font-semibold text-slate-900">{material.name || '-'}</td>
                  <td data-label="Đơn vị" className="px-1 md:px-2.5 py-2 font-semibold text-slate-700">{material.unit}</td>
                  <td data-label="Tổng kg" className="px-1 md:px-2.5 py-2 text-right font-mono font-bold text-slate-800">{material.totalWeight}</td>
                  <td data-label="Tồn đầu" className="px-1 md:px-2.5 py-2 font-mono font-bold text-slate-700">{material.openingStock}</td>
                  <td data-label="Nhập" className="px-1 md:px-2.5 py-2 font-mono font-bold text-slate-700">{material.inbound}</td>
                  <td data-label="Xuất" className="px-1 md:px-2.5 py-2 font-mono font-bold text-slate-700">{material.outbound}</td>
                  <td data-label="Tồn cuối" className="px-1 md:px-2.5 py-2 font-mono font-bold text-slate-900">
                    {computeClosingStock(material.openingStock, material.inbound, material.outbound)}
                  </td>
                  <td data-label="Thao tác" className="px-1 md:px-2.5 py-2">
                    <div className="flex items-center justify-end md:justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingMaterial(material)}
                        title="Xem"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 active:scale-95"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(material)}
                        title="Sửa"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-brand-600 transition hover:bg-brand-50 active:scale-95"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMaterial(material)}
                        disabled={deletingMaterialId === material.id}
                        title="Xóa"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                      >
                        {deletingMaterialId === material.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoadingMaterials && filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center font-semibold text-slate-500">
                    Không có nguyên phụ liệu phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

