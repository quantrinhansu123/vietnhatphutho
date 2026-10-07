import React, { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTabAccess } from '../../app/useTabAccess';
import {
  Download,
  Eye,
  History,
  Loader2,
  Package,
  Pencil,
  Plus,
  QrCode,
  Save,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { pickText, formatCell, filterDuplicateZeroWarehouseRows, parsePeriodQuantityValue } from '../_shared/recordHelpers';
import {
  downloadBulkMaterialTotalWeightTemplate,
  parseBulkMaterialTotalWeightExcel,
  type BulkMaterialTotalWeightImportRow
} from '../../utils/bulkMaterialTotalWeightExcel';
import {
  downloadMaterialCatalogExcelTemplate,
  parseMaterialCatalogExcel,
  materialCatalogRowToPayload
} from '../../utils/materialCatalogExcel';
import { showAppToast } from '../../lib/appToast';
import ProductQrPrintModal, {
  type ProductQrPrintLabel as WarehouseProductQrPrintLabel
} from '../../components/ProductQrPrintModal';
import type { WeighingPreviewImage } from '../../components/WeighingImagePreviewModal';
import { productFieldClass } from '../san-pham/productFieldClass';
import { readUnitSuggestions, saveUnitSuggestion } from '../_shared/orderHelpers';
import { isNvlCoreWarehouse, matchesWarehouseFilter, normalizeWarehouseName, pickNvlCoreWarehouses } from '../kho-hang';
import { SoTronDatePicker } from '../so-tron/SoTronDatePicker';
import { getCatalogCache, hasFreshCatalogCache, invalidateCatalogCache } from '../kho-hang/catalogCache';
import {
  FilterCombobox,
  TableSearchInput,
  TableShell,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableEmptyRow,
  StatusBadge,
  RowActionsMenu
} from '../../components/shared/table';

type NvlPeriodBalance = {
  ma_npl: string;
  ten_npl: string;
  ten_nvl_sx: string;
  don_vi: string;
  ten_kho: string;
  tong_kg: number | null;
  ton_dau: number;
  nhap: number;
  xuat: number;
  phan_loai: string;
  nhom_vthh: string;
};

function formatPeriodQty(value: number) {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function periodIdentity(code: string, name: string, productionName: string, warehouse: string) {
  return `${normalizeMaterialCodeKey(code)}\0${name.trim().toLocaleLowerCase('vi')}\0${productionName.trim().toLocaleLowerCase('vi')}\0${normalizeWarehouseName(warehouse)}`;
}

function periodCodeWarehouse(code: string, warehouse: string) {
  return `${normalizeMaterialCodeKey(code)}\0${normalizeWarehouseName(warehouse)}`;
}

export interface MaterialRow {
  id: string;
  code: string;
  name: string;
  productionName: string;
  unit: string;
  warehouse: string;
  /** Mã kho (quan_ly_kho.ma_kho) — nguồn thật để lọc theo kho khi đổi tên. */
  loaiKho: string;
  totalWeight: string;
  plasticWeight: string;
  bagWeight: string;
  coreWeight: string;
  rollWidth: string;
  unitLength: string;
  openingStock: string;
  inbound: string;
  outbound: string;
  phanLoai: string;
  auxiliaryMaterialGroup: string;
  /** Dòng tồn phát sinh từ phiếu kho nhưng chưa có bản ghi riêng trong danh mục kho_nvl. */
  inventoryBalanceOnly?: boolean;
}

export const AUXILIARY_MATERIAL_GROUPS = [
  'Băng Dính',
  'Bạt Bọc',
  'Dây Đai',
  'Dung Môi',
  'Màng',
  'Mực In',
  'Tem',
  'Kẹp Sắt'
] as const;

export type MaterialIssuedQrCode = {
  id: string;
  ma_qr: string;
  ma_npl_goc: string;
  ten_npl: string;
  ten_kho: string;
  so_lan_in: number;
  ngay_in_gan_nhat: string;
  nguoi_tao: string;
  trang_thai: string;
  ma_phieu_nhap: string;
  created_at: string;
};

export function parseInventoryNumber(value: string): number | null {
  if (!value || value === '-') return null;
  // Dùng chung parser với view gộp tồn kỳ: chịu được `1,234.5` lẫn `1.234,5`.
  // Trước đây chỉ `.replace(',', '.')` 1 lần nên `1,234.5` thành `1.234.5` → NaN,
  // Tồn cuối hiển thị `-` sai dù server trả số đúng.
  return parsePeriodQuantityValue(value);
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
        productionName: String(record.ten_nvl_sx ?? '').trim(),
        unit: formatCell(record.don_vi),
        warehouse: formatCell(record.ten_kho),
        loaiKho: String(record.loai_kho ?? '').trim(),
        totalWeight: formatCell(record.tong_trong_luong),
        plasticWeight: formatCell(record.trong_luong_nhua),
        bagWeight: formatCell(record.trong_luong_tui),
        coreWeight: formatCell(record.trong_luong_loi),
        rollWidth: formatCell(record.kho_cuon),
        unitLength: formatCell(record.chieu_dai_don_vi),
        openingStock: formatCell(record.ton_dau_ky),
        inbound: formatCell(record.nhap_trong_ky),
        outbound: formatCell(record.xuat_trong_ky),
        phanLoai: formatCell(record.phan_loai ?? record.kho_ngam_dinh),
        auxiliaryMaterialGroup: formatCell(
          record.nhom_vat_tu_phu === 'Bạt Dọc' ? 'Bạt Bọc' : record.nhom_vat_tu_phu
        )
      };
    })
    .filter((material): material is MaterialRow => Boolean(material));
}

export type MaterialFormState = {
  code: string;
  name: string;
  productionName: string;
  unit: string;
  warehouse: string;
  totalWeight: string;
  plasticWeight: string;
  bagWeight: string;
  coreWeight: string;
  rollWidth: string;
  unitLength: string;
  openingStock: string;
  inbound: string;
  outbound: string;
  phanLoai: string;
  auxiliaryMaterialGroup: string;
};

const emptyMaterialForm = (): MaterialFormState => ({
  code: '',
  name: '',
  productionName: '',
  unit: '',
  warehouse: '',
  totalWeight: '',
  plasticWeight: '',
  bagWeight: '',
  coreWeight: '',
  rollWidth: '',
  unitLength: '',
  openingStock: '',
  inbound: '',
  outbound: '',
  phanLoai: '',
  auxiliaryMaterialGroup: ''
});

export function materialCellToInput(value: string) {
  return value === '-' ? '' : value;
}

export function materialToForm(material: MaterialRow): MaterialFormState {
  return {
    code: materialCellToInput(material.code),
    name: materialCellToInput(material.name),
    productionName: materialCellToInput(material.productionName),
    unit: materialCellToInput(material.unit),
    warehouse: materialCellToInput(material.warehouse),
    totalWeight: materialCellToInput(material.totalWeight),
    plasticWeight: materialCellToInput(material.plasticWeight),
    bagWeight: materialCellToInput(material.bagWeight),
    coreWeight: materialCellToInput(material.coreWeight),
    rollWidth: materialCellToInput(material.rollWidth),
    unitLength: materialCellToInput(material.unitLength),
    openingStock: materialCellToInput(material.openingStock),
    inbound: materialCellToInput(material.inbound),
    outbound: materialCellToInput(material.outbound),
    phanLoai: materialCellToInput(material.phanLoai),
    auxiliaryMaterialGroup: materialCellToInput(
      material.auxiliaryMaterialGroup === 'Bạt Dọc' ? 'Bạt Bọc' : material.auxiliaryMaterialGroup
    )
  };
}

const materialFieldClass =
  'h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

export function normalizeMaterialCodeKey(code: string) {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

const MATERIAL_ROW_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MATERIAL_IMPORT_BATCH_SIZE = 200;

function chunkMaterialImport<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function materialWarehouseKey(warehouse: string) {
  const text = String(warehouse || '').trim();
  return text === '-' ? '' : text;
}

/** Khớp unique mã + tên + tên sản xuất + kho. */
function materialImportIdentity(code: string, name: string, productionName: string, warehouse = '') {
  return `${code.trim()}\0${name.trim()}\0${productionName.trim()}\0${materialWarehouseKey(warehouse)}`;
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
              Tải mẫu Tổng kg
            </button>
            <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100">
              {isReadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isReadingFile ? 'Đang đọc file...' : 'Tải file Tổng kg lên'}
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
                Bấm <strong>Tải mẫu Tổng kg</strong> — file có 2 cột: <strong>Mã NVL</strong> và{' '}
                <strong>Tổng trọng lượng</strong> (chỉ cập nhật Tổng kg, không phải danh mục đầy đủ).
              </li>
              <li>Sửa cột <strong>Tổng trọng lượng</strong> theo từng mã NPL.</li>
              <li>
                Bấm <strong>Tải file Tổng kg lên</strong> — hệ thống khớp Mã NVL và cập nhật cột Tổng kg.
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

              <TableShell minWidthClassName="min-w-[560px]" maxHeightClassName="max-h-72">
                <TableHead>
                  <TableHeadCell>Mã NVL</TableHeadCell>
                  <TableHeadCell>Tổng trọng lượng mới</TableHeadCell>
                  <TableHeadCell>Tổng kg hiện tại</TableHeadCell>
                  <TableHeadCell>Trạng thái</TableHeadCell>
                </TableHead>
                <TableBody>
                  {previewRows.map((row, index) => (
                    <React.Fragment key={`${row.code}-${index}`}>
                      <TableRow
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
                        <td className="px-4 py-3 font-black text-zinc-900">{row.code}</td>
                        <td className="px-4 py-3 font-mono font-bold text-zinc-800">{row.totalWeight}</td>
                        <td className="px-4 py-3 font-mono font-bold text-zinc-500">
                          {row.material?.totalWeight ?? '-'}
                        </td>
                        <td className="px-4 py-3">
                          {row.status === 'update' && <StatusBadge label="Cập nhật" color="emerald" />}
                          {row.status === 'not_found' && <StatusBadge label="Không tìm thấy" color="amber" />}
                          {row.status === 'skipped' && <StatusBadge label="Bỏ qua" color="zinc" />}
                          {row.status === 'invalid' && <StatusBadge label="Số không hợp lệ" color="rose" />}
                        </td>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </TableShell>
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

export type MaterialViewTab = 'detail' | 'inbound-history' | 'outbound-history' | 'issued-qr';

export function MaterialViewModal({
  material,
  onClose,
  onEdit,
  onDelete,
  onPrintIssuedQrCodes,
  canEditQrCodes = false,
  isDeleting
}: {
  material: MaterialRow;
  onClose: () => void;
  onEdit?: (material: MaterialRow) => void;
  onDelete?: (material: MaterialRow) => void;
  onPrintIssuedQrCodes?: (codes: MaterialIssuedQrCode[]) => Promise<void>;
  canEditQrCodes?: boolean;
  isDeleting: boolean;
}) {
  const [tab, setTab] = useState<MaterialViewTab>('detail');
  const [movements, setMovements] = useState<MaterialMovementRow[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [issuedQrCodes, setIssuedQrCodes] = useState<MaterialIssuedQrCode[]>([]);
  const [isLoadingIssuedQrCodes, setIsLoadingIssuedQrCodes] = useState(false);
  const [issuedQrCodesError, setIssuedQrCodesError] = useState('');
  const [selectedIssuedQrIds, setSelectedIssuedQrIds] = useState<Set<string>>(() => new Set());
  const [isPrintingIssuedQrCodes, setIsPrintingIssuedQrCodes] = useState(false);
  const [issuedQrStatusFilter, setIssuedQrStatusFilter] = useState<'all' | 'dang_dung' | 'da_huy'>('all');
  const [updatingIssuedQrId, setUpdatingIssuedQrId] = useState('');

  useEffect(() => {
    if (tab === 'detail' || tab === 'issued-qr' || !material.code || movements.length > 0) return;

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
  }, [tab, material.code, movements.length]);

  useEffect(() => {
    if (tab !== 'issued-qr') return;
    const controller = new AbortController();
    setIsLoadingIssuedQrCodes(true);
    setIssuedQrCodesError('');

    const params = new URLSearchParams({ ma_npl: material.code });
    if (material.warehouse && material.warehouse !== '-') params.set('ten_kho', material.warehouse);
    void fetch(`/api/kho-nvl/ma-qr?${params.toString()}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Không thể tải danh sách QR đã cấp.');
        const records = Array.isArray(data.records) ? data.records : [];
        const normalized: MaterialIssuedQrCode[] = records.map((record: Record<string, unknown>) => ({
          id: String(record.id ?? ''),
          ma_qr: String(record.ma_qr ?? ''),
          ma_npl_goc: String(record.ma_npl_goc ?? ''),
          ten_npl: String(record.ten_npl ?? ''),
          ten_kho: String(record.ten_kho ?? ''),
          so_lan_in: Number(record.so_lan_in) || 0,
          ngay_in_gan_nhat: String(record.ngay_in_gan_nhat ?? ''),
          nguoi_tao: String(record.nguoi_tao ?? ''),
          trang_thai: String(record.trang_thai ?? ''),
          ma_phieu_nhap: String(record.ma_phieu_nhap ?? ''),
          created_at: String(record.created_at ?? '')
        }));
        setIssuedQrCodes(normalized);
        const availableIds = new Set(normalized.map(record => record.id));
        setSelectedIssuedQrIds(previous => new Set([...previous].filter(id => availableIds.has(id))));
      })
      .catch(error => {
        if (error?.name !== 'AbortError') {
          setIssuedQrCodes([]);
          setIssuedQrCodesError(error?.message || 'Không thể tải danh sách QR đã cấp.');
        }
      })
      .finally(() => setIsLoadingIssuedQrCodes(false));

    return () => controller.abort();
  }, [material.code, material.warehouse, tab]);

  const filteredIssuedQrCodes = issuedQrCodes.filter(code =>
    issuedQrStatusFilter === 'all' || code.trang_thai === issuedQrStatusFilter
  );
  const printableIssuedQrCodes = filteredIssuedQrCodes.filter(code => code.trang_thai !== 'da_huy');
  const selectedIssuedQrCodes = filteredIssuedQrCodes.filter(
    code => code.trang_thai !== 'da_huy' && selectedIssuedQrIds.has(code.id)
  );
  const allIssuedQrCodesSelected = printableIssuedQrCodes.length > 0
    && printableIssuedQrCodes.every(code => selectedIssuedQrIds.has(code.id));

  const toggleAllIssuedQrCodes = () => {
    setSelectedIssuedQrIds(previous => {
      const next = new Set(previous);
      if (allIssuedQrCodesSelected) printableIssuedQrCodes.forEach(code => next.delete(code.id));
      else printableIssuedQrCodes.forEach(code => next.add(code.id));
      return next;
    });
  };

  const handlePrintSelectedIssuedQrCodes = async () => {
    if (!onPrintIssuedQrCodes || selectedIssuedQrCodes.length === 0) return;
    setIsPrintingIssuedQrCodes(true);
    setIssuedQrCodesError('');
    try {
      await onPrintIssuedQrCodes(selectedIssuedQrCodes);
    } catch (error: any) {
      setIssuedQrCodesError(error?.message || 'Không thể in lại các mã QR đã chọn.');
    } finally {
      setIsPrintingIssuedQrCodes(false);
    }
  };

  const handleUpdateIssuedQrStatus = async (code: MaterialIssuedQrCode, trangThai: 'dang_dung' | 'da_huy') => {
    if (code.trang_thai === trangThai) return;
    setUpdatingIssuedQrId(code.id);
    setIssuedQrCodesError('');
    try {
      const response = await fetch(`/api/ma-qr-nvl/${encodeURIComponent(code.id)}/trang-thai`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trang_thai: trangThai })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Không thể cập nhật trạng thái QR.');
      setIssuedQrCodes(previous => previous.map(item => item.id === code.id ? { ...item, trang_thai: trangThai } : item));
      if (trangThai === 'da_huy') {
        setSelectedIssuedQrIds(previous => {
          const next = new Set(previous);
          next.delete(code.id);
          return next;
        });
      }
    } catch (error: any) {
      setIssuedQrCodesError(error?.message || 'Không thể cập nhật trạng thái QR.');
    } finally {
      setUpdatingIssuedQrId('');
    }
  };

  const inboundRows = useMemo(() => movements.filter(row => row.slipType === 'nhap'), [movements]);
  const outboundRows = useMemo(() => movements.filter(row => row.slipType === 'xuat'), [movements]);
  const totalInbound = sumMaterialMovementQuantity(movements, 'nhap');
  const totalOutbound = sumMaterialMovementQuantity(movements, 'xuat');
  const inboundDisplay = tab !== 'detail' ? String(Math.round(totalInbound * 100) / 100) : material.inbound;
  const outboundDisplay = tab !== 'detail' ? String(Math.round(totalOutbound * 100) / 100) : material.outbound;
  const closingDisplay = computeClosingStock(material.openingStock, inboundDisplay, outboundDisplay);

  const infoRows: Array<[string, string]> = [
    ['Mã NPL', material.code],
    ['Tên NVL', material.name],
    ['Đơn vị', material.unit],
    ['Kho', material.warehouse || '—'],
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
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl"
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
            onClick={() => setTab('detail')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
              tab === 'detail' ? 'border-[#ef1b2d] text-[#ef1b2d]' : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Package className="h-4 w-4" />
            Chi tiết
          </button>
          <button
            type="button"
            onClick={() => setTab('inbound-history')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
              tab === 'inbound-history' ? 'border-[#ef1b2d] text-[#ef1b2d]' : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <History className="h-4 w-4" />
            Lịch sử nhập
          </button>
          <button
            type="button"
            onClick={() => setTab('outbound-history')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
              tab === 'outbound-history' ? 'border-[#ef1b2d] text-[#ef1b2d]' : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <History className="h-4 w-4" />
            Lịch sử xuất
          </button>
          <button
            type="button"
            onClick={() => setTab('issued-qr')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
              tab === 'issued-qr' ? 'border-[#ef1b2d] text-[#ef1b2d]' : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <QrCode className="h-4 w-4" />
            Mã QR đã cấp
          </button>
        </div>

        <div
          className={`min-h-0 flex-1 p-4 ${
            tab === 'issued-qr' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {tab === 'inbound-history' || tab === 'outbound-history' ? (
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
                <div className={`overflow-hidden rounded-xl border ${
                  tab === 'inbound-history' ? 'border-emerald-200' : 'border-amber-200'
                }`}>
                    <div className={`px-3 py-2 text-xs font-black uppercase tracking-wider ${
                      tab === 'inbound-history'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-amber-50 text-amber-800'
                    }`}>
                      {tab === 'inbound-history'
                        ? `Nhập kho (${inboundRows.length})`
                        : `Xuất kho (${outboundRows.length})`}
                    </div>
                    <TableShell minWidthClassName="min-w-full" maxHeightClassName="max-h-64">
                      <TableHead>
                        <TableHeadCell>Ngày</TableHeadCell>
                        <TableHeadCell>Phiếu</TableHeadCell>
                        <TableHeadCell align="center">SL</TableHeadCell>
                      </TableHead>
                      <TableBody>
                        {(tab === 'inbound-history' ? inboundRows : outboundRows).map(row => (
                          <React.Fragment key={`${row.slipCode}-${row.slipDate}-${row.quantity}`}>
                            <TableRow>
                              <td className="px-4 py-3 font-semibold text-zinc-700">{row.slipDate || '-'}</td>
                              <td className="px-4 py-3 font-bold text-zinc-900">{row.slipCode || '-'}</td>
                              <td className={`px-4 py-3 text-right font-mono font-bold ${
                                tab === 'inbound-history' ? 'text-emerald-700' : 'text-amber-800'
                              }`}>
                                {formatNumber(row.quantity, 2)}
                              </td>
                            </TableRow>
                          </React.Fragment>
                        ))}
                        {(tab === 'inbound-history' ? inboundRows : outboundRows).length === 0 && (
                          <TableEmptyRow colSpan={3}>
                            {tab === 'inbound-history' ? 'Chưa có phiếu nhập' : 'Chưa có phiếu xuất'}
                          </TableEmptyRow>
                        )}
                      </TableBody>
                    </TableShell>
                  </div>
              )}
            </div>
          ) : tab === 'issued-qr' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-zinc-950">Danh sách QR đã cấp</p>
                  <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                    Mỗi mã được lưu duy nhất trong CSDL; chọn mã để in lại mà không sinh mã mới.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={issuedQrStatusFilter}
                    onChange={event => {
                      setIssuedQrStatusFilter(event.target.value as 'all' | 'dang_dung' | 'da_huy');
                      setSelectedIssuedQrIds(new Set());
                    }}
                    className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 outline-none focus:border-[#ef1b2d]"
                    aria-label="Lọc trạng thái QR"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="dang_dung">Đang dùng</option>
                    <option value="da_huy">Đã hủy</option>
                  </select>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-[#ef1b2d]">
                    {selectedIssuedQrCodes.length > 0
                      ? `Đã chọn ${selectedIssuedQrCodes.length}/${printableIssuedQrCodes.length}`
                      : `${filteredIssuedQrCodes.length} mã`}
                  </span>
                  {onPrintIssuedQrCodes ? (
                    <button
                      type="button"
                      onClick={() => void handlePrintSelectedIssuedQrCodes()}
                      disabled={selectedIssuedQrCodes.length === 0 || isPrintingIssuedQrCodes}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-black text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPrintingIssuedQrCodes ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                      {isPrintingIssuedQrCodes ? 'Đang chuẩn bị...' : 'In lại mã đã chọn'}
                    </button>
                  ) : null}
                </div>
              </div>

              {issuedQrCodesError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {issuedQrCodesError}
                </p>
              ) : null}

              <TableShell
                className="min-h-0 flex flex-1 flex-col"
                minWidthClassName="min-w-[980px]"
                maxHeightClassName="min-h-0 flex-1"
              >
                <TableHead>
                  <TableHeadCell align="center" className="w-12">
                    <input
                      type="checkbox"
                      checked={allIssuedQrCodesSelected}
                      onChange={toggleAllIssuedQrCodes}
                      disabled={printableIssuedQrCodes.length === 0}
                      aria-label="Chọn tất cả QR đã cấp"
                      className="h-4 w-4 cursor-pointer accent-[#ef1b2d] disabled:cursor-not-allowed"
                    />
                  </TableHeadCell>
                  <TableHeadCell>STT</TableHeadCell>
                  <TableHeadCell>Mã QR đầy đủ</TableHeadCell>
                  <TableHeadCell>Trạng thái</TableHeadCell>
                  <TableHeadCell>Kho</TableHeadCell>
                  <TableHeadCell align="center">Số lần in</TableHeadCell>
                  <TableHeadCell>Ngày in gần nhất</TableHeadCell>
                  <TableHeadCell>Ngày cấp</TableHeadCell>
                </TableHead>
                <TableBody>
                  {filteredIssuedQrCodes.map((code, index) => (
                    <TableRow key={code.id || code.ma_qr}>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIssuedQrIds.has(code.id)}
                          disabled={code.trang_thai === 'da_huy'}
                          onChange={() => setSelectedIssuedQrIds(previous => {
                            const next = new Set(previous);
                            if (next.has(code.id)) next.delete(code.id);
                            else next.add(code.id);
                            return next;
                          })}
                          aria-label={`Chọn in ${code.ma_qr}`}
                          className="h-4 w-4 cursor-pointer accent-[#ef1b2d] disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-zinc-500">{index + 1}</td>
                      <td className="px-4 py-3 font-mono font-black text-zinc-950">{code.ma_qr}</td>
                      <td className="px-4 py-3">
                        {canEditQrCodes ? (
                          <select
                            value={code.trang_thai}
                            disabled={updatingIssuedQrId === code.id}
                            onChange={event => void handleUpdateIssuedQrStatus(code, event.target.value as 'dang_dung' | 'da_huy')}
                            className="h-8 cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-700 outline-none focus:border-[#ef1b2d] disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Đổi trạng thái ${code.ma_qr}`}
                          >
                            <option value="dang_dung">Đang dùng</option>
                            <option value="da_huy">Đã hủy</option>
                          </select>
                        ) : (
                          <StatusBadge
                            label={code.trang_thai === 'dang_dung' ? 'Đang dùng' : code.trang_thai === 'da_huy' ? 'Đã hủy' : code.trang_thai || '-'}
                            color={code.trang_thai === 'dang_dung' ? 'emerald' : 'rose'}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-700">{code.ten_kho || '-'}</td>
                      <td className="px-4 py-3 text-center font-bold text-zinc-700">{code.so_lan_in}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-zinc-600">{code.ngay_in_gan_nhat ? new Date(code.ngay_in_gan_nhat).toLocaleString('vi-VN') : '-'}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-zinc-600">{code.created_at ? new Date(code.created_at).toLocaleString('vi-VN') : '-'}</td>
                    </TableRow>
                  ))}
                  {!isLoadingIssuedQrCodes && filteredIssuedQrCodes.length === 0 ? (
                    <TableEmptyRow colSpan={8}>{issuedQrCodes.length === 0 ? 'NVL này chưa có mã QR đã cấp.' : 'Không có mã QR theo trạng thái đã chọn.'}</TableEmptyRow>
                  ) : null}
                  {isLoadingIssuedQrCodes ? <TableEmptyRow colSpan={8}>Đang tải danh sách QR đã cấp...</TableEmptyRow> : null}
                </TableBody>
              </TableShell>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[...infoRows, ...nvlInfoRows].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
                    <p className="mt-1 font-bold text-zinc-900">{value || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          {onEdit ? (
            <button type="button" onClick={() => onEdit(material)} className="flex h-10 items-center gap-1.5 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100">
              <Pencil className="h-4 w-4" />
              Sửa
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(material)}
              disabled={isDeleting}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Xóa
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MaterialsInventoryPanel({
  onBack,
  warehouseFilter = '',
  includeUnassigned = false,
  topControls = null,
  showWarehouseColumn
}: {
  onBack: () => void;
  warehouseFilter?: string;
  includeUnassigned?: boolean;
  topControls?: ReactNode;
  /** Hiện cột Kho kể cả khi không lọc theo kho (màn /kho-nvl chọn kho). */
  showWarehouseColumn?: boolean;
}) {
  /**
   * Kho NVL là nhóm gồm Kho NVL / Chính / Phụ / PC
   * (unique mã + tên + tên SX + kho nên mỗi dòng là một mã trong một kho).
   * Bỏ trống hoặc chọn đúng "Kho NVL" = toàn bộ bảng, liệt kê tách riêng
   * từng kho. Chọn kho NVL cụ thể khác (Chính/Phụ/PC) = chỉ kho đó.
   */
  const isWholeGroupFilter =
    !String(warehouseFilter ?? '').trim() || normalizeWarehouseName(warehouseFilter) === 'kho nvl';
  /** Luôn hiện cột Kho để phân biệt từng dòng (một mã trong một kho). */
  const showKhoColumn = isWholeGroupFilter || Boolean(warehouseFilter) || showWarehouseColumn === true;
  const { canCreate, canEdit, canDelete } = useTabAccess('materials');
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [materialsError, setMaterialsError] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingMaterial, setViewingMaterial] = useState<MaterialRow | null>(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(() => new Set());
  const [isDeletingMaterials, setIsDeletingMaterials] = useState(false);
  const [isSavingMaterial, setIsSavingMaterial] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [materialForm, setMaterialForm] = useState<MaterialFormState>(emptyMaterialForm);
  const [showBulkTotalWeight, setShowBulkTotalWeight] = useState(false);
  const [isImportingCatalog, setIsImportingCatalog] = useState(false);
  const catalogFileInputRef = useRef<HTMLInputElement>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);
  const [warehouseMaByName, setWarehouseMaByName] = useState<Record<string, string>>({});
  const [isUploadingMaterialImage, setIsUploadingMaterialImage] = useState(false);
  const [viewingMaterialImage, setViewingMaterialImage] = useState<WeighingPreviewImage | null>(null);
  const [materialQrPrintLabels, setMaterialQrPrintLabels] = useState<WarehouseProductQrPrintLabel[]>([]);
  const [materialQrPrintOpen, setMaterialQrPrintOpen] = useState(false);
  const [showPrintQtyModal, setShowPrintQtyModal] = useState(false);
  const [printQtyById, setPrintQtyById] = useState<Record<string, string>>({});
  const [bulkPrintQty, setBulkPrintQty] = useState('1');
  const [printQtyError, setPrintQtyError] = useState('');
  const [isGeneratingPrintQr, setIsGeneratingPrintQr] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [periodReload, setPeriodReload] = useState(0);
  const [toDate, setToDate] = useState('');
  const [periodRows, setPeriodRows] = useState<NvlPeriodBalance[]>([]);
  const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);
  const [periodError, setPeriodError] = useState('');

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const names = await getCatalogCache('warehouses', async () => {
          const res = await fetch('/api/quan-ly-kho');
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Không thể tải danh sách kho.');
          const records: Array<{ ten_kho?: string }> = Array.isArray(data?.records) ? data.records : [];
          return Array.from(new Set(records.map(r => String(r.ten_kho ?? '').trim()).filter(Boolean)));
        });
        setWarehouseOptions(names);
        // Bản đồ tên kho → mã kho để lọc theo loai_kho (đúng cả khi đổi tên kho).
        try {
          const full = await getCatalogCache('warehouses-full', async () => {
            const res2 = await fetch('/api/quan-ly-kho');
            const data2 = await res2.json().catch(() => ({}));
            if (!res2.ok) throw new Error('Không thể tải danh sách kho.');
            const records: Array<{ ten_kho?: string; ma_kho?: string }> = Array.isArray(data2?.records)
              ? data2.records
              : [];
            return records
              .map(r => ({ ten: String(r.ten_kho ?? '').trim(), ma: String(r.ma_kho ?? '').trim() }))
              .filter(r => Boolean(r.ten));
          });
          const map: Record<string, string> = {};
          for (const row of full) {
            if (row.ma && !map[normalizeWarehouseName(row.ten)]) map[normalizeWarehouseName(row.ten)] = row.ma;
          }
          setWarehouseMaByName(map);
        } catch {
          setWarehouseMaByName({});
        }
      } catch {
        setWarehouseOptions([]);
      }
    };
    void loadWarehouses();
  }, []);

  const loadMaterials = async (options?: { force?: boolean }) => {
    if (options?.force) invalidateCatalogCache('materials');
    const cacheHit = !options?.force && hasFreshCatalogCache('materials');
    if (!cacheHit) setIsLoadingMaterials(true);
    setMaterialsError('');

    try {
      const list = await getCatalogCache(
        'materials',
        async () => {
          const res = await fetch('/api/kho-nvl');
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || 'Không thể tải nguyên phụ liệu từ Supabase.');
          }
          return normalizeMaterialsInventory(data);
        },
        { force: options?.force }
      );
      setMaterials(list);
    } catch (error: any) {
      setMaterials([]);
      setMaterialsError(error.message || 'Không thể tải nguyên phụ liệu từ Supabase.');
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  const handlePrintIssuedQrCodes = async (codes: MaterialIssuedQrCode[]) => {
    if (!viewingMaterial || codes.length === 0) return;
    setMaterialQrPrintLabels(codes.map((code, index) => ({
      key: `${viewingMaterial.code}-${code.id || index}`,
      payload: code.ma_qr,
      productCode: code.ma_npl_goc || viewingMaterial.code,
      productName: code.ten_npl || viewingMaterial.name,
      itemLabel: 'Tên NVL',
      unit: viewingMaterial.unit !== '-' ? viewingMaterial.unit : undefined
    })));
    setMaterialQrPrintOpen(true);
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const materialWarehouseOptions = useMemo(
    () => pickNvlCoreWarehouses(warehouseOptions),
    [warehouseOptions]
  );

  const resolveMaterialWarehouseName = (value: string) => {
    const key = normalizeWarehouseName(value);
    if (!key) return '';
    return materialWarehouseOptions.find(name => normalizeWarehouseName(name) === key) || '';
  };

  const units = useMemo(
    () =>
      [
        'all',
        ...Array.from(new Set(materials.map(material => material.unit).filter(unit => unit !== '-'))).sort((a, b) =>
          String(a).localeCompare(String(b), 'vi')
        )
      ],
    [materials]
  );
  const materialUnitSuggestions = useMemo(() => {
    const fromMaterials = materials.map(material => material.unit).filter(unit => unit && unit !== '-');
    return [...new Set([...fromMaterials, ...readUnitSuggestions()])].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [materials]);
  const unitFilterOptions = useMemo(() => units.filter(unit => unit !== 'all'), [units]);
  const normalizedSearch = searchText.trim().toLowerCase();
  const coreMaKho = useMemo(() => {
    const codes = new Set<string>();
    for (const name of materialWarehouseOptions) {
      const ma = warehouseMaByName[normalizeWarehouseName(name)];
      if (ma) codes.add(ma);
    }
    return codes;
  }, [materialWarehouseOptions, warehouseMaByName]);
  const filteredMaterials = useMemo(() => {
    const hasSpecificFilter = Boolean(warehouseFilter.trim()) && !isWholeGroupFilter;
    const filterMaKho = hasSpecificFilter ? warehouseMaByName[normalizeWarehouseName(warehouseFilter)] || '' : '';
    return materials.filter(material => {
      // Toàn nhóm (Tất cả hoặc đúng "Kho NVL"): lấy toàn bộ bảng kho-nvl,
      // mỗi dòng giữ riêng kho của nó (unique mã + tên + tên SX + kho).
      // Chọn kho cụ thể khác: chỉ lấy đúng kho đó.
      const matchesWarehouse = hasSpecificFilter
        ? matchesWarehouseFilter(material.warehouse, warehouseFilter, {
            includeUnassigned,
            skipFilter: false
          }) ||
          (Boolean(filterMaKho) && material.loaiKho === filterMaKho)
        : isNvlCoreWarehouse(material.warehouse) || (Boolean(material.loaiKho) && coreMaKho.has(material.loaiKho));
      const matchesUnit = selectedUnit === 'all' || material.unit === selectedUnit;
      const matchesSearch =
        !normalizedSearch ||
        `${material.code} ${material.name} ${material.productionName} ${material.unit} ${material.auxiliaryMaterialGroup} ${material.warehouse}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesWarehouse && matchesUnit && matchesSearch;
    });
  }, [coreMaKho, includeUnassigned, isWholeGroupFilter, materials, normalizedSearch, selectedUnit, warehouseFilter, warehouseMaByName]);

  const periodReady = Boolean(fromDate && toDate && fromDate <= toDate);

  useEffect(() => {
    if (!fromDate || !toDate) {
      setPeriodRows([]);
      setPeriodError('');
      setIsLoadingPeriod(false);
      return;
    }
    if (fromDate > toDate) {
      setPeriodRows([]);
      setPeriodError('Từ ngày không được lớn hơn Đến ngày.');
      setIsLoadingPeriod(false);
      return;
    }
    const controller = new AbortController();
    const loadPeriod = async () => {
      setIsLoadingPeriod(true);
      setPeriodError('');
      try {
        const params = new URLSearchParams({ from: fromDate, to: toDate });
        // Toàn nhóm thì không gửi ten_kho để server trả toàn bộ nhóm NVL.
        if (warehouseFilter.trim() && !isWholeGroupFilter) params.set('ten_kho', warehouseFilter.trim());
        const response = await fetch(`/api/ton-kho-nvl?${params.toString()}`, { signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Không thể tải tồn kho NVL theo ngày.');
        const rows: NvlPeriodBalance[] = Array.isArray(data.rows) ? data.rows : [];
        setPeriodRows(rows);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setPeriodRows([]);
        setPeriodError(error instanceof Error ? error.message : 'Không thể tải tồn kho NVL theo ngày.');
      } finally {
        if (!controller.signal.aborted) setIsLoadingPeriod(false);
      }
    };
    void loadPeriod();
    return () => controller.abort();
  }, [fromDate, toDate, periodReload, warehouseFilter]);

  const displayedMaterials = useMemo(() => {
    // Liệt kê tách riêng từng kho: mỗi dòng là một mã trong một kho
    // (unique mã + tên + tên SX + kho), tồn/nhập/xuất tính riêng đúng kho đó.
    // Toàn nhóm (Tất cả / Kho NVL) thì server trả toàn bộ nhóm, frontend giữ riêng từng kho.
    const effectivePeriodRows = isWholeGroupFilter
      ? periodRows
      : periodRows.filter(
          row => normalizeWarehouseName(row.ten_kho) === normalizeWarehouseName(warehouseFilter)
        );
    if (!periodReady) {
      return filteredMaterials.map(material => ({
        ...material,
        openingStock: '—',
        inbound: '—',
        outbound: '—'
      }));
    }

    const byIdentity = new Map<string, NvlPeriodBalance>();
    const byCodeWarehouse = new Map<string, NvlPeriodBalance[]>();
    for (const row of effectivePeriodRows) {
      byIdentity.set(periodIdentity(row.ma_npl, row.ten_npl, row.ten_nvl_sx, row.ten_kho), row);
      const bucketKey = periodCodeWarehouse(row.ma_npl, row.ten_kho);
      const bucket = byCodeWarehouse.get(bucketKey);
      if (bucket) bucket.push(row);
      else byCodeWarehouse.set(bucketKey, [row]);
    }

    const used = new Set<NvlPeriodBalance>();
    const take = (row: NvlPeriodBalance | undefined) => {
      if (!row || used.has(row)) return undefined;
      used.add(row);
      return row;
    };
    const apply = (material: MaterialRow, row: NvlPeriodBalance | undefined): MaterialRow => {
      if (!row) {
        return { ...material, openingStock: '0', inbound: '0', outbound: '0' };
      }
      return {
        ...material,
        openingStock: formatPeriodQty(row.ton_dau),
        inbound: formatPeriodQty(row.nhap),
        outbound: formatPeriodQty(row.xuat)
      };
    };

    const warehouseOf = (material: MaterialRow) => {
      if (material.warehouse && material.warehouse !== '-') return material.warehouse;
      const fromMa = materialWarehouseOptions.find(
        name => warehouseMaByName[normalizeWarehouseName(name)] === material.loaiKho
      );
      return fromMa || material.warehouse;
    };

    const fromCatalog = filteredMaterials.map(material => {
      const warehouse = warehouseOf(material);
      const exact = take(byIdentity.get(periodIdentity(material.code, material.name, material.productionName, warehouse)));
      if (exact) return apply(material, exact);
      const bucket = byCodeWarehouse.get(periodCodeWarehouse(material.code, warehouse)) ?? [];
      const only = bucket.filter(row => !used.has(row));
      if (only.length === 1) return apply(material, take(only[0]));
      return apply(material, undefined);
    });

    const extras: MaterialRow[] = [];
    for (const row of effectivePeriodRows) {
      if (used.has(row)) continue;
      const haystack = `${row.ma_npl} ${row.ten_npl} ${row.ten_nvl_sx} ${row.don_vi} ${row.nhom_vthh} ${row.ten_kho}`.toLowerCase();
      if (normalizedSearch && !haystack.includes(normalizedSearch)) continue;
      if (selectedUnit !== 'all' && row.don_vi !== selectedUnit) continue;
      extras.push({
        id: `period:${row.ma_npl}:${row.ten_npl}:${row.ten_nvl_sx}:${row.ten_kho}`,
        code: row.ma_npl,
        name: row.ten_npl || row.ma_npl,
        productionName: row.ten_nvl_sx,
        unit: row.don_vi || '-',
        warehouse: row.ten_kho,
        loaiKho: '',
        totalWeight: row.tong_kg === null || row.tong_kg === undefined ? '-' : String(row.tong_kg),
        plasticWeight: '-',
        bagWeight: '-',
        coreWeight: '-',
        rollWidth: '-',
        unitLength: '-',
        openingStock: formatPeriodQty(row.ton_dau),
        inbound: formatPeriodQty(row.nhap),
        outbound: formatPeriodQty(row.xuat),
        phanLoai: row.phan_loai || '-',
        auxiliaryMaterialGroup: row.nhom_vthh || '-',
        inventoryBalanceOnly: true
      });
      used.add(row);
    }

    return [...fromCatalog, ...extras];
  }, [filteredMaterials, isWholeGroupFilter, materialWarehouseOptions, normalizedSearch, periodReady, periodRows, selectedUnit, warehouseFilter, warehouseMaByName]);

  /** View gộp (Tất cả / Kho NVL): ẩn dòng trùng mã 0/0/0 khi mã đó đã phát sinh ở kho khác. */
  const visibleMaterials = useMemo(() => {
    if (!isWholeGroupFilter || !periodReady) return displayedMaterials;
    return filterDuplicateZeroWarehouseRows(displayedMaterials);
  }, [displayedMaterials, isWholeGroupFilter, periodReady]);

  const hasActiveFilters = selectedUnit !== 'all' || Boolean(searchText);
  const resetFilters = () => {
    setSelectedUnit('all');
    setSearchText('');
  };

  const selectableFilteredMaterials = useMemo(
    () => filteredMaterials.filter(material => !material.inventoryBalanceOnly && Boolean(material.id)),
    [filteredMaterials]
  );
  const selectedMaterials = useMemo(
    () => materials.filter(material => selectedMaterialIds.has(material.id)),
    [materials, selectedMaterialIds]
  );
  const allFilteredSelected =
    selectableFilteredMaterials.length > 0 &&
    selectableFilteredMaterials.every(material => selectedMaterialIds.has(material.id));

  const toggleMaterial = (materialId: string) => {
    setSelectedMaterialIds(prev => {
      const next = new Set(prev);
      if (next.has(materialId)) next.delete(materialId);
      else next.add(materialId);
      return next;
    });
  };

  const toggleFilteredMaterials = () => {
    setSelectedMaterialIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        selectableFilteredMaterials.forEach(material => next.delete(material.id));
      } else {
        selectableFilteredMaterials.forEach(material => next.add(material.id));
      }
      return next;
    });
  };

  const selectedPrintMaterials = useMemo(
    () => selectedMaterials.filter(material => String(material.code || '').trim() && !material.inventoryBalanceOnly),
    [selectedMaterials]
  );
  const parsePrintCopyCount = (value: string) => {
    const num = Math.floor(Number(String(value).trim()));
    return Number.isFinite(num) && num > 0 ? Math.min(num, 999) : 0;
  };
  const totalPrintCopies = useMemo(
    () => selectedPrintMaterials.reduce((sum, material) => sum + parsePrintCopyCount(printQtyById[material.id] ?? '0'), 0),
    [printQtyById, selectedPrintMaterials]
  );

  const handlePrintSelectedMaterialQr = () => {
    const next: Record<string, string> = {};
    selectedPrintMaterials.forEach(material => {
      next[material.id] = printQtyById[material.id] ?? '1';
    });
    setActionMessage('');
    setPrintQtyById(next);
    setBulkPrintQty('1');
    setPrintQtyError('');
    setShowPrintQtyModal(true);
  };

  const handleApplyBulkPrintQty = () => {
    const qty = String(Math.max(1, parsePrintCopyCount(bulkPrintQty) || 1));
    setBulkPrintQty(qty);
    setPrintQtyById(prev => {
      const nextState = { ...prev };
      selectedPrintMaterials.forEach(material => {
        nextState[material.id] = qty;
      });
      return nextState;
    });
  };

  const handleConfirmPrintQrLabels = async () => {
    setPrintQtyError('');
    const items = selectedPrintMaterials
      .map(material => ({
        maNpl: material.code,
        tenNpl: material.name,
        tenKho: material.warehouse && material.warehouse !== '-' ? material.warehouse : '',
        soLuongTem: parsePrintCopyCount(printQtyById[material.id] ?? '0')
      }))
      .filter(item => item.maNpl && item.soLuongTem > 0);
    if (items.length === 0) {
      setPrintQtyError('Nhập số lượng (> 0) cho ít nhất một mã NVL.');
      return;
    }
    setIsGeneratingPrintQr(true);
    try {
      const response = await fetch('/api/ma-qr-nvl/cap-moi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Không thể cấp mã QR mới.');
      const records: Array<Record<string, unknown>> = Array.isArray(data.records) ? data.records : [];
      const labels: WarehouseProductQrPrintLabel[] = records.map(record => ({
        key: String(record.id ?? record.ma_qr ?? ''),
        payload: String(record.ma_qr ?? '').trim(),
        productCode: String(record.ma_npl_goc ?? '').trim(),
        productName: String(record.ten_npl ?? '').trim() || '-',
        itemLabel: 'Tên NVL'
      })).filter(label => Boolean(label.key && label.payload && label.productCode));
      if (labels.length !== totalPrintCopies) {
        throw new Error('CSDL trả về thiếu mã QR. Chưa thể mở tem để in.');
      }
      setMaterialQrPrintLabels(labels);
      setShowPrintQtyModal(false);
      setMaterialQrPrintOpen(true);
    } catch (reason: unknown) {
      setPrintQtyError(reason instanceof Error ? reason.message : 'Không thể cấp mã QR mới.');
    } finally {
      setIsGeneratingPrintQr(false);
    }
  };

  const handleDownloadTotalWeightTemplate = () => {
    downloadBulkMaterialTotalWeightTemplate(
      materials.map(material => ({
        code: material.code,
        totalWeight: material.totalWeight
      }))
    );
  };

  const handleDownloadCatalogTemplate = () => {
    downloadMaterialCatalogExcelTemplate();
  };

  const handleImportCatalogExcel = async (file?: File | null) => {
    if ((!canCreate && !canEdit) || !file) return;

    setIsImportingCatalog(true);
    setMaterialsError('');
    setActionMessage('');

    try {
      const rows = await parseMaterialCatalogExcel(file);
      if (rows.length === 0) {
        throw new Error('File Excel không có dòng NVL hợp lệ (cần cột Mã NPL).');
      }

      const byIdentity = new Map<string, MaterialRow>();
      const byCode = new Map<string, MaterialRow[]>();
      for (const material of materials) {
        const code = material.code.trim();
        if (!code || code === '-') continue;
        const codeKey = normalizeMaterialCodeKey(code);
        const siblings = byCode.get(codeKey);
        if (siblings) siblings.push(material);
        else byCode.set(codeKey, [material]);
        if (!MATERIAL_ROW_UUID.test(material.id) || material.inventoryBalanceOnly) continue;
        byIdentity.set(
          materialImportIdentity(material.code, material.name, material.productionName, material.warehouse),
          material
        );
      }

      const failures: string[] = [];
      const createMap = new Map<string, Record<string, unknown>>();
      const updateMap = new Map<string, Record<string, unknown>>();

      for (const row of rows) {
        const code = row.code.trim();
        if (!code) {
          failures.push(`dòng ${row.rowNumber}: thiếu mã NPL`);
          continue;
        }

        const siblings = byCode.get(normalizeMaterialCodeKey(code)) ?? [];
        let name = row.name.trim();
        let productionName = row.productionName.trim();
        if (!name || name === '-') {
          if (siblings.length === 1) {
            name = siblings[0].name.trim();
            if (!productionName) productionName = siblings[0].productionName.trim();
          } else {
            failures.push(`dòng ${row.rowNumber}: thiếu tên nguyên phụ liệu`);
            continue;
          }
        }
        if (!name || name === '-') {
          failures.push(`dòng ${row.rowNumber}: thiếu tên nguyên phụ liệu`);
          continue;
        }

        const payload: Record<string, unknown> = {
          ...materialCatalogRowToPayload(row),
          name,
          productionName
        };

        if (typeof payload.unit === 'string' && payload.unit) {
          saveUnitSuggestion(payload.unit);
        }

        // Cùng mã có thể nằm nhiều kho. Khớp đúng bộ mã + tên + tên sản xuất + kho.
        // File không ghi kho: chỉ cập nhật khi bộ 3 khớp đúng một kho.
        const warehouse = materialWarehouseKey(row.warehouse);
        const identity = materialImportIdentity(code, name, productionName, warehouse);
        let existing = byIdentity.get(identity);
        if (!existing && !warehouse) {
          const prefix = materialImportIdentity(code, name, productionName, '');
          const matches = [...byIdentity.entries()]
            .filter(([key]) => key.startsWith(prefix))
            .map(([, item]) => item);
          if (matches.length > 1) {
            failures.push(`dòng ${row.rowNumber}: mã này có ở nhiều kho, hãy điền cột Kho`);
            continue;
          }
          existing = matches[0];
        }
        if (existing) {
          updateMap.set(identity, { ...payload, id: existing.id });
        } else {
          createMap.set(identity, payload);
        }
      }

      const creates = [...createMap.values()];
      const updates = [...updateMap.values()];
      let created = 0;
      let updated = 0;

      const postBatch = async (
        createsChunk: Record<string, unknown>[],
        updatesChunk: Record<string, unknown>[],
        label: string
      ) => {
        if (createsChunk.length === 0 && updatesChunk.length === 0) return;
        const res = await fetch('/api/kho-nvl/import-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creates: createsChunk, updates: updatesChunk })
        });
        const data = await res.json().catch(() => ({}));
        created += Number(data.createdCount || 0);
        updated += Number(data.updatedCount || 0);
        if (!res.ok) {
          failures.push(`${label}: ${data.error || 'Không lưu được'}`);
        }
      };

      for (const [index, chunk] of chunkMaterialImport(creates, MATERIAL_IMPORT_BATCH_SIZE).entries()) {
        await postBatch(chunk, [], `Insert batch ${index + 1}`);
      }
      for (const [index, chunk] of chunkMaterialImport(updates, MATERIAL_IMPORT_BATCH_SIZE).entries()) {
        await postBatch([], chunk, `Update batch ${index + 1}`);
      }

      if (created > 0 || updated > 0) {
        await loadMaterials({ force: true });
      }

      const summary = [
        created || updated ? `Đã nhập Excel NVL: thêm ${created}, cập nhật ${updated}.` : 'Không nhập được dòng nào.',
        failures.length ? `${failures.length} lỗi (${failures.slice(0, 3).join('; ')}).` : ''
      ]
        .filter(Boolean)
        .join(' ');
      setActionMessage(summary);
      if (created > 0 || updated > 0) showAppToast(summary);
      else if (failures.length > 0) {
        setMaterialsError(summary);
        showAppToast(failures[0], 'error');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể đọc hoặc nhập Excel danh mục NVL.';
      setMaterialsError(message);
      showAppToast(message, 'error');
    } finally {
      setIsImportingCatalog(false);
      if (catalogFileInputRef.current) catalogFileInputRef.current.value = '';
    }
  };

  const openAddForm = () => {
    if (!canCreate) return;
    setFormError('');
    setActionMessage('');
    setEditingId(null);
    setMaterialForm({ ...emptyMaterialForm(), warehouse: warehouseFilter });
    setFormMode('add');
  };

  const openEditForm = (material: MaterialRow) => {
    if (!canEdit) return;
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
    const warehouseName = resolveMaterialWarehouseName(materialForm.warehouse);
    if (!warehouseName) {
      setFormError(
        materialWarehouseOptions.length === 0
          ? 'Chưa tải được danh sách kho. Hãy kiểm tra Quản lý kho.'
          : 'Vui lòng chọn kho trong danh sách Quản lý kho.'
      );
      return;
    }

    const payload = {
      ...materialForm,
      warehouse: warehouseName,
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
      await loadMaterials({ force: true });
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
      setSelectedMaterialIds(prev => {
        const next = new Set(prev);
        next.delete(material.id);
        return next;
      });
      setActionMessage('Đã xóa nguyên phụ liệu.');
      await loadMaterials({ force: true });
    } catch (error: any) {
      setMaterialsError(error.message || 'Không thể xóa nguyên phụ liệu.');
    } finally {
      setDeletingMaterialId(null);
    }
  };

  const handleBulkDeleteMaterials = async () => {
    if (selectedMaterials.length === 0) return;

    const label =
      selectedMaterials.length === 1
        ? `"${selectedMaterials[0].code || selectedMaterials[0].name}"`
        : `${selectedMaterials.length} nguyên phụ liệu`;

    if (!window.confirm(`Bạn có chắc muốn xóa ${label}? Hành động này không thể hoàn tác.`)) {
      return;
    }

    setIsDeletingMaterials(true);
    setActionMessage('');
    setMaterialsError('');

    try {
      const res = await fetch('/api/kho-nvl', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedMaterials.map(material => material.id) })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa nguyên phụ liệu đã chọn.');
      }

      if (viewingMaterial && selectedMaterialIds.has(viewingMaterial.id)) {
        setViewingMaterial(null);
      }
      setSelectedMaterialIds(new Set());
      setActionMessage(`Đã xóa ${data.deleted ?? selectedMaterials.length} nguyên phụ liệu.`);
      await loadMaterials({ force: true });
    } catch (error: any) {
      setMaterialsError(error.message || 'Không thể xóa nguyên phụ liệu đã chọn.');
    } finally {
      setIsDeletingMaterials(false);
    }
  };

  const materialFormFields: Array<{ key: keyof MaterialFormState; label: string; required?: boolean; placeholder?: string }> = [
    { key: 'name', label: 'Tên nguyên vật liệu', required: true, placeholder: 'VD: Màng PE' },
    { key: 'productionName', label: 'Tên nguyên vật liệu sản xuất', placeholder: 'Tên dùng trong sản xuất' },
    { key: 'phanLoai', label: 'Phân loại' },
    { key: 'auxiliaryMaterialGroup', label: 'Nhóm vật tư phụ' },
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
      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {topControls}
          {topControls ? <div className="hidden h-8 w-px shrink-0 bg-zinc-200 lg:block" aria-hidden /> : null}

          <button
            type="button"
            onClick={handlePrintSelectedMaterialQr}
            disabled={selectedPrintMaterials.length === 0 || isLoadingMaterials}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Nhập số tem QR cần in cho các NVL đã chọn; mỗi tem là một mã QR duy nhất lưu trong CSDL"
          >
            <QrCode className="h-4 w-4" />
            In mã QR
          </button>
          <button
            type="button"
            onClick={handleDownloadCatalogTemplate}
            disabled={isImportingCatalog || isLoadingMaterials}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-extrabold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Mẫu Excel khớp cột bảng /kho-nvl — ô trống vẫn đẩy lên"
          >
            <Download className="h-4 w-4" />
            Tải mẫu Excel
          </button>
          {canCreate || canEdit ? (
            <button
              type="button"
              onClick={() => catalogFileInputRef.current?.click()}
              disabled={isImportingCatalog || isLoadingMaterials}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-extrabold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImportingCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isImportingCatalog ? 'Đang nhập...' : 'Tải Excel lên'}
            </button>
          ) : null}
          <input
            ref={catalogFileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={event => void handleImportCatalogExcel(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={handleDownloadTotalWeightTemplate}
            disabled={isLoadingMaterials}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-extrabold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            title="Chỉ cập nhật cột Tổng kg theo mã NVL"
          >
            <Download className="h-4 w-4" />
            Mẫu cập nhật Tổng kg
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setShowBulkTotalWeight(true)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-extrabold text-slate-700 transition hover:bg-slate-200"
            >
              <Upload className="h-4 w-4" />
              Nhập Tổng kg
            </button>
          ) : null}
          {canCreate ? (
            <button
              type="button"
              onClick={openAddForm}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
            >
              <Plus className="h-4 w-4" />
              Thêm mới
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={() => void handleBulkDeleteMaterials()}
              disabled={selectedMaterials.length === 0 || isDeletingMaterials}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeletingMaterials ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isDeletingMaterials ? 'Đang xóa...' : 'Xóa đã chọn'}
            </button>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Từ ngày</span>
            <SoTronDatePicker value={fromDate} onChange={setFromDate} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Đến ngày</span>
            <SoTronDatePicker value={toDate} onChange={setToDate} />
          </label>
          <TableSearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Tìm mã / tên / tên sản xuất / nhóm"
            disabled={isLoadingMaterials}
          />
          <button
            type="button"
            onClick={() => setPeriodReload(value => value + 1)}
            disabled={!periodReady || isLoadingPeriod}
            className="h-10 rounded-xl bg-[#ef1b2d] px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#d41424] disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Tải lại
          </button>

          <FilterCombobox
            label="Đơn vị"
            options={unitFilterOptions}
            value={selectedUnit}
            onChange={setSelectedUnit}
            searchPlaceholder="Tìm đơn vị..."
            compact
          />

          {isLoadingMaterials || isLoadingPeriod ? (
            <div className="flex h-10 shrink-0 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-500">
              {isLoadingPeriod ? 'Đang tính tồn...' : 'Đang tải...'}
            </div>
          ) : null}

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="flex h-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-600 transition hover:border-[#ef1b2d] hover:text-[#ef1b2d]"
            >
              Xóa lọc
            </button>
          ) : null}
        </div>

        <p className="mt-2 text-xs font-semibold text-zinc-500">
          {isWholeGroupFilter
            ? 'Toàn bộ bảng kho-nvl (Kho NVL, Kho NVL Chính, Kho NVL Phụ, Kho PC) — mỗi dòng là một mã trong một kho, Tồn đầu / Nhập / Xuất / Tồn cuối tính riêng đúng kho đó từ phiếu nhập kho và phiếu xuất kho.'
            : `Chi tiết kho ${warehouseFilter.trim()} — mỗi dòng là một mã trong kho này, Tồn đầu / Nhập / Xuất / Tồn cuối tính riêng đúng kho đó từ phiếu nhập kho và phiếu xuất kho.`}
          {periodReady ? '' : ' Chưa chọn đủ ngày nên các cột tồn để trống.'}
        </p>
        {materialsError || periodError ? (
          <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {materialsError || periodError}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            {actionMessage}
          </p>
        ) : null}
      </section>

      {formMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  {formMode === 'edit' ? 'Sửa nguyên phụ liệu' : 'Thêm nguyên phụ liệu'}
                </h3>
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
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                  Kho *
                </span>
                <SearchableSelect
                  value={materialForm.warehouse}
                  onChange={value => setMaterialForm(prev => ({ ...prev, warehouse: value }))}
                  options={materialWarehouseOptions}
                  placeholder="Chọn kho trong Quản lý kho"
                  emptyInputText="Chưa có kho vật tư trong Quản lý kho"
                  searchPlaceholder="Tìm kho..."
                  getLabel={item => String(item)}
                  getValue={item => String(item)}
                  inputClassName={materialFieldClass}
                  allowEmpty={false}
                  maxResults={200}
                  comboboxMode
                />
              </label>
              {materialFormFields.map(field => (
                <label key={field.key} className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                    {field.label}{field.required ? ' *' : ''}
                  </span>
                  {field.key === 'phanLoai' ? (
                    <select
                      value={materialForm[field.key]}
                      onChange={e => setMaterialForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className={materialFieldClass}
                    >
                      <option value="">-- Chọn phân loại --</option>
                      <option value="Nguyên vật liệu phụ">Nguyên vật liệu phụ</option>
                      <option value="Nguyên vật liệu chính">Nguyên vật liệu chính</option>
                    </select>
                  ) : field.key === 'auxiliaryMaterialGroup' ? (
                    <select
                      value={materialForm[field.key]}
                      onChange={e => setMaterialForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className={materialFieldClass}
                    >
                      <option value="">-- Chọn nhóm vật tư phụ --</option>
                      {AUXILIARY_MATERIAL_GROUPS.map(group => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={materialForm[field.key]}
                      onChange={e => setMaterialForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className={materialFieldClass}
                      placeholder={field.placeholder}
                    />
                  )}
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
          onEdit={canEdit ? openEditForm : undefined}
          onDelete={canDelete ? handleDeleteMaterial : undefined}
          onPrintIssuedQrCodes={handlePrintIssuedQrCodes}
          canEditQrCodes={canEdit}
          isDeleting={deletingMaterialId === viewingMaterial.id}
        />
      )}

      {showPrintQtyModal
        ? createPortal(
            <div className="fixed inset-0 z-[90] flex items-end justify-center bg-zinc-950/45 p-0 sm:items-center sm:p-4">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="Đóng"
                onClick={() => setShowPrintQtyModal(false)}
              />
              <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-gradient-to-r from-zinc-50 to-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ef1b2d]">In tem QR</p>
                    <h3 className="mt-0.5 text-base font-black text-zinc-900">Số bản theo mã NVL</h3>
                    <p className="mt-1 text-[11px] font-semibold text-zinc-500">
                      Mỗi tem là một mã QR duy nhất được lưu trong CSDL
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPrintQtyModal(false)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50"
                    title="Đóng"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3 overflow-y-auto px-4 py-4">
                  <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <label className="min-w-[120px] flex-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                      Áp dụng tất cả
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={bulkPrintQty}
                        onChange={e => setBulkPrintQty(e.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleApplyBulkPrintQty}
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black text-zinc-700 transition hover:border-zinc-950"
                    >
                      Áp dụng
                    </button>
                  </div>

                  <TableShell minWidthClassName="min-w-full" maxHeightClassName="max-h-72">
                    <TableHead>
                      <TableHeadCell>Mã NVL</TableHeadCell>
                      <TableHeadCell align="center" className="w-28">Số bản</TableHeadCell>
                    </TableHead>
                    <TableBody>
                      {selectedPrintMaterials.map(material => (
                        <React.Fragment key={material.id}>
                          <TableRow>
                            <td className="px-3 py-2.5">
                              <p className="font-black text-zinc-900">{material.code}</p>
                              <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-zinc-500">
                                {material.name || '—'}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="number"
                                min={0}
                                max={999}
                                value={printQtyById[material.id] ?? '1'}
                                onChange={e =>
                                  setPrintQtyById(prev => ({ ...prev, [material.id]: e.target.value }))
                                }
                                className="mx-auto h-10 w-20 rounded-lg border border-zinc-200 bg-white px-2 text-center text-sm font-black text-zinc-900 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                              />
                            </td>
                          </TableRow>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </TableShell>

                  {printQtyError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                      {printQtyError}
                    </div>
                  ) : null}

                  <p className="text-xs font-semibold text-zinc-500">
                    Tổng sẽ in: <span className="font-black text-[#ef1b2d]">{totalPrintCopies}</span> tem
                  </p>
                </div>

                <div className="flex gap-2 border-t border-zinc-200 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setShowPrintQtyModal(false)}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmPrintQrLabels()}
                    disabled={totalPrintCopies <= 0 || isGeneratingPrintQr}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] text-xs font-bold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <QrCode className="h-4 w-4" />
                    {isGeneratingPrintQr ? 'Đang cấp QR...' : `Xem trước ${totalPrintCopies > 0 ? `${totalPrintCopies} tem` : 'QR'}`}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <ProductQrPrintModal
        open={materialQrPrintOpen}
        labels={materialQrPrintLabels}
        trackProductPrint={false}
        trackMaterialPrint
        showPayload={false}
        title="Mã QR NVL"
        description={`${materialQrPrintLabels.length} tem · mỗi tem là một đơn vị NVL đã lưu trong CSDL`}
        onClose={() => {
          setMaterialQrPrintOpen(false);
          setMaterialQrPrintLabels([]);
        }}
      />

      <BulkMaterialTotalWeightModal
        open={showBulkTotalWeight}
        materials={materials}
        onClose={() => setShowBulkTotalWeight(false)}
        onApplied={message => {
          setActionMessage(message);
          void loadMaterials({ force: true });
        }}
      />

      <TableShell minWidthClassName="min-w-[1250px]">
        <TableHead>
          <TableHeadCell align="center" className="w-14">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleFilteredMaterials}
              disabled={selectableFilteredMaterials.length === 0 || isDeletingMaterials}
              className="h-4 w-4 accent-[#ef1b2d]"
              aria-label="Chọn tất cả nguyên phụ liệu đang lọc"
            />
          </TableHeadCell>
          <TableHeadCell>Mã NPL</TableHeadCell>
          <TableHeadCell>Tên nguyên vật liệu</TableHeadCell>
          <TableHeadCell>Phân loại</TableHeadCell>
          <TableHeadCell>Nhóm vật tư phụ</TableHeadCell>
          <TableHeadCell>Tên NVL sản xuất</TableHeadCell>
          <TableHeadCell>ĐV</TableHeadCell>
            {showKhoColumn ? <TableHeadCell>Kho</TableHeadCell> : null}
          <TableHeadCell align="center">Tổng kg</TableHeadCell>
          <TableHeadCell>Tồn đầu</TableHeadCell>
          <TableHeadCell>Nhập</TableHeadCell>
          <TableHeadCell>Xuất</TableHeadCell>
          <TableHeadCell>Tồn cuối</TableHeadCell>
          <TableHeadCell align="center">Thao tác</TableHeadCell>
        </TableHead>
        <TableBody>
          {visibleMaterials.map(material => {
            const canSelect = !material.inventoryBalanceOnly && Boolean(material.id);
            return (
            <React.Fragment key={material.id}>
              <TableRow>
                <td className="px-3 py-3 text-center">
                  {canSelect ? (
                    <input
                      type="checkbox"
                      checked={selectedMaterialIds.has(material.id)}
                      onChange={() => toggleMaterial(material.id)}
                      disabled={isDeletingMaterials}
                      className="h-4 w-4 accent-[#ef1b2d]"
                      aria-label={`Chọn ${material.code || material.name}`}
                    />
                  ) : (
                    <span className="inline-block h-4 w-4" aria-hidden />
                  )}
                </td>
                <td className="px-4 py-3 font-black text-zinc-950">{material.code || '-'}</td>
                <td className="px-4 py-3 font-semibold text-zinc-900">{material.name || '-'}</td>
                <td className="px-4 py-3 text-xs font-semibold text-zinc-600">{material.phanLoai || '-'}</td>
                <td className="px-4 py-3 text-xs font-semibold text-zinc-700">{material.auxiliaryMaterialGroup || '-'}</td>
                <td className="px-4 py-3 font-semibold text-zinc-700">{material.productionName || '-'}</td>
                <td className="px-4 py-3 text-zinc-700">{material.unit}</td>
                {showKhoColumn ? (
                  <td className="px-4 py-3 text-zinc-700">{material.warehouse || '—'}</td>
                ) : null}
                <td className="px-4 py-3 text-right font-mono font-bold text-zinc-800">{material.totalWeight}</td>
                <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.openingStock}</td>
                <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.inbound}</td>
                <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.outbound}</td>
                <td className="px-4 py-3 font-mono font-bold text-zinc-900">
                  {material.openingStock === '—'
                    ? '—'
                    : computeClosingStock(material.openingStock, material.inbound, material.outbound)}
                </td>
                <td className="px-4 py-3 text-center">
                  <RowActionsMenu label={`Thao tác ${material.code || material.name}`}>
                  <div className="inline-flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const catalogRow = materials.find(row => row.id === material.id);
                        setViewingMaterial(
                          periodReady || material.inventoryBalanceOnly ? material : catalogRow ?? material
                        );
                      }}
                      title="Xem"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 active:scale-95"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {canEdit && !material.inventoryBalanceOnly ? (
                      <button
                        type="button"
                        onClick={() => openEditForm(materials.find(row => row.id === material.id) ?? material)}
                        title="Sửa"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 text-sky-700 transition hover:bg-sky-50 active:scale-95"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    ) : null}
                    {canDelete && !material.inventoryBalanceOnly ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteMaterial(material)}
                        disabled={deletingMaterialId === material.id || isDeletingMaterials}
                        title="Xóa"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                      >
                        {deletingMaterialId === material.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                  </RowActionsMenu>
                </td>
              </TableRow>
            </React.Fragment>
            );
          })}

          {!isLoadingMaterials && visibleMaterials.length === 0 && (
            <TableEmptyRow colSpan={showKhoColumn ? 14 : 13}>
              {warehouseFilter
                ? 'Không có mã hàng trong kho này.'
                : 'Chưa có nguyên vật liệu trong danh mục.'}
            </TableEmptyRow>
          )}
        </TableBody>
      </TableShell>
    </div>
  );
}

/**
 * /kho-nvl: danh mục NVL + dropdown chọn kho vật tư (mặc định Tất cả).
 * Panel con đã hỗ trợ warehouseFilter — trang này chỉ thêm chọn kho rồi truyền xuống.
 */
export function MaterialsCatalogPage({ onBack }: { onBack: () => void }) {
  const [warehouses, setWarehouses] = useState<string[]>([]);
  // 'all' = Tất cả (quy ước của FilterCombobox).
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        const names = await getCatalogCache('warehouses', async () => {
          const res = await fetch('/api/quan-ly-kho');
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error('Không thể tải danh sách kho.');
          const records: Array<{ ten_kho?: string }> = Array.isArray(data?.records) ? data.records : [];
          return Array.from(new Set(records.map(r => String(r.ten_kho ?? '').trim()).filter(Boolean)));
        });
        setWarehouses(names);
      } catch {
        setWarehouses([]);
      }
    };
    void load();
  }, []);

  const vatTuWarehouses = useMemo(() => pickNvlCoreWarehouses(warehouses), [warehouses]);

  useEffect(() => {
    if (selectedWarehouse !== 'all' && !vatTuWarehouses.includes(selectedWarehouse)) setSelectedWarehouse('all');
  }, [selectedWarehouse, vatTuWarehouses]);

  const warehousePicker = (
    <FilterCombobox
      label="Kho"
      options={vatTuWarehouses}
      value={selectedWarehouse}
      onChange={setSelectedWarehouse}
      formatOption={value => value}
      includeAll
      searchPlaceholder="Tìm kho..."
    />
  );

  return (
    <MaterialsInventoryPanel
      onBack={onBack}
      warehouseFilter={selectedWarehouse === 'all' ? '' : selectedWarehouse}
      includeUnassigned={false}
      topControls={warehousePicker}
      showWarehouseColumn
    />
  );
}

