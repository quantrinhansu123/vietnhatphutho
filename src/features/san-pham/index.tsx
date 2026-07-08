import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage, formatCell } from '../_shared/recordHelpers';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { normalizeMaterialsInventory } from '../kho-nvl';
import { Loader2, Save, FlaskConical, Download, Upload, Plus, Eye, Pencil, Trash2, Search } from 'lucide-react';
import { productFieldClass } from './productFieldClass';
import type { ProductRow, ProductNplItem, MaterialOption, ProductNplAmountType } from './types';
import { parseProductNplItems, productNplItemsToJson, formatProductNplSummary, excelRowsToProductNplItems, bulkExcelRowsToProductMap, productNplAmountTypeLabel, formatProductNplAmount, roundNplNumber } from './types';
import { downloadBulkProductNplComponentsTemplate, downloadProductNplComponentsTemplate, parseBulkProductNplComponentsExcel, parseProductNplComponentsExcel } from '../../utils/productNplComponentsExcel';
import { vietNhatLogoUrl } from '../../components/layout/constants';

export type ProductViewTab = 'info' | 'components';

export function ProductNplItemFormModal({
  mode,
  initialItem,
  materialOptions,
  isLoadingMaterials,
  isSaving,
  existingCodes,
  onClose,
  onSave
}: {
  mode: 'add' | 'edit';
  initialItem?: ProductNplItem;
  materialOptions: MaterialOption[];
  isLoadingMaterials: boolean;
  isSaving: boolean;
  existingCodes: string[];
  onClose: () => void;
  onSave: (item: ProductNplItem) => Promise<void>;
}) {
  const [code, setCode] = useState(initialItem?.code ?? '');
  const [name, setName] = useState(initialItem?.name ?? '');
  const [amountType, setAmountType] = useState<ProductNplAmountType>(initialItem?.amountType ?? 'percent');
  const [amountValue, setAmountValue] = useState(() => {
    if (!initialItem) return '';
    if (initialItem.amountType === 'quantity') {
      return formatNumber(initialItem.quantity ?? 0, 2);
    }
    return formatPercent(initialItem.percent ?? 0);
  });
  const [unit, setUnit] = useState(initialItem?.unit && initialItem.unit !== '-' ? initialItem.unit : '');
  const [formError, setFormError] = useState('');

  const pickMaterial = (nextCode: string) => {
    setCode(nextCode);
    const material = materialOptions.find(option => option.code === nextCode);
    if (material) {
      setName(material.name);
      if (material.unit && material.unit !== '-') {
        setUnit(material.unit);
      }
    }
  };

  useEffect(() => {
    const trimmedCode = code.trim();
    if (!trimmedCode) return;
    const material = materialOptions.find(option => option.code === trimmedCode);
    if (material?.unit && material.unit !== '-') {
      setUnit(material.unit);
    }
  }, [code, materialOptions]);

  const handleSave = async () => {
    const trimmedCode = code.trim();
    const numericValue = parsePercentInput(amountValue);

    if (!trimmedCode) {
      setFormError('Vui lòng chọn mã NPL.');
      return;
    }
    if (existingCodes.includes(trimmedCode)) {
      setFormError(`Mã NPL ${trimmedCode} đã có trong thành phần.`);
      return;
    }

    const material = materialOptions.find(option => option.code === trimmedCode);
    const resolvedUnit = unit.trim() || material?.unit || '-';

    if (amountType === 'percent') {
      if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
        setFormError('Phần trăm phải từ 0 đến 100.');
        return;
      }
    } else if (!Number.isFinite(numericValue) || numericValue < 0) {
      setFormError('Số lượng phải lớn hơn hoặc bằng 0.');
      return;
    }

    setFormError('');
    try {
      await onSave({
        code: trimmedCode,
        name: name.trim() || material?.name || '',
        amountType,
        percent: amountType === 'percent' ? roundNplNumber(numericValue) : null,
        quantity: amountType === 'quantity' ? roundNplNumber(numericValue) : null,
        unit: resolvedUnit
      });
    } catch (error: any) {
      setFormError(error.message || 'Không thể lưu thành phần.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
              {mode === 'add' ? 'Thêm thành phần' : 'Sửa thành phần'}
            </h3>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">NVL · phần trăm hoặc số lượng</p>
          </div>
          <BackButton onClick={onClose} />
        </div>
        {formError && (
          <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
            {formError}
          </div>
        )}
        <div className="space-y-3 p-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã NPL *</span>
            <SearchableSelect
              value={code}
              onChange={pickMaterial}
              options={materialOptions}
              placeholder="Gõ để tìm mã NPL"
              isLoading={isLoadingMaterials}
              disabled={isLoadingMaterials || mode === 'edit'}
              inputClassName={productFieldClass}
              getLabel={item => {
                const material = item as MaterialOption;
                return `${material.code} · ${material.name}`;
              }}
              getValue={item => (item as MaterialOption).code}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tên NVL</span>
            <input value={name} onChange={e => setName(e.target.value)} className={productFieldClass} placeholder="Tên nguyên vật liệu" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Loại định lượng *</span>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['percent', 'Phần trăm'],
                ['quantity', 'Số lượng']
              ] as const).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setAmountType(type);
                    setAmountValue('');
                  }}
                  className={`h-11 rounded-lg border px-3 text-xs font-extrabold transition ${
                    amountType === type
                      ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
          {amountType === 'percent' ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Phần trăm *</span>
              <input
                type="text"
                inputMode="decimal"
                value={amountValue}
                onChange={e => setAmountValue(e.target.value)}
                className={productFieldClass}
                placeholder="VD: 40,50"
              />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Số lượng *</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountValue}
                  onChange={e => setAmountValue(e.target.value)}
                  className={productFieldClass}
                  placeholder="VD: 100,00"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Đơn vị</span>
                <input
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className={productFieldClass}
                  placeholder="VD: Kg, Cuộn"
                />
              </label>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <BackButton onClick={onClose} className="h-10 rounded-lg bg-white" />
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Đang lưu...' : mode === 'add' ? 'Thêm' : 'Cập nhật'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function parseProductSpecNumber(value: string) {
  if (!value || value === '-') return null;
  const num = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

export function formatProductSpecDisplay(value: string) {
  const num = parseProductSpecNumber(value);
  if (num === null) return '-';
  return formatNumber(num, 2);
}

export function resolveProductPlasticWeight(
  product: Pick<ProductRow, 'plasticWeight' | 'totalWeight' | 'coreWeight' | 'bagWeight'>
) {
  const stored = parseProductSpecNumber(product.plasticWeight);
  if (stored !== null) return formatNumber(stored, 2);
  const total = parseProductSpecNumber(product.totalWeight);
  if (total === null) return '-';
  const core = parseProductSpecNumber(product.coreWeight) ?? 0;
  const bag = parseProductSpecNumber(product.bagWeight) ?? 0;
  return formatNumber(total - core - bag, 2);
}

export function resolveProductMaterialBaseKg(
  product?: Pick<ProductRow, 'plasticWeight' | 'totalWeight' | 'coreWeight' | 'bagWeight'> | null
) {
  if (!product) return 0;
  const stored = parseProductSpecNumber(product.plasticWeight);
  if (stored !== null && stored > 0) return stored;
  const total = parseProductSpecNumber(product.totalWeight);
  if (total === null || total <= 0) return 0;
  const core = parseProductSpecNumber(product.coreWeight) ?? 0;
  const bag = parseProductSpecNumber(product.bagWeight) ?? 0;
  return roundNplNumber(total - core - bag);
}

export function normalizeProductCodeKey(code: string) {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

export function findProductByCode(products: ProductRow[], code: string) {
  const key = normalizeProductCodeKey(code);
  if (!key) return undefined;
  return products.find(
    product =>
      normalizeProductCodeKey(product.code) === key ||
      (product.amisCode && normalizeProductCodeKey(product.amisCode) === key) ||
      (product.newCode && normalizeProductCodeKey(product.newCode) === key)
  );
}

export function productAmisDisplayCode(product: Pick<ProductRow, 'amisCode' | 'code'>) {
  return product.amisCode && product.amisCode !== '-' ? product.amisCode : product.code || '-';
}

export function ProductViewModal({
  product,
  initialTab = 'info',
  materialOptions,
  isLoadingMaterials,
  isSaving,
  onClose,
  onSaveItems,
  onEdit,
  onDelete,
  isDeleting
}: {
  product: ProductRow;
  initialTab?: ProductViewTab;
  materialOptions: MaterialOption[];
  isLoadingMaterials: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSaveItems: (items: ProductNplItem[]) => Promise<void>;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}) {
  const [tab, setTab] = useState<ProductViewTab>(initialTab);
  const [items, setItems] = useState<ProductNplItem[]>(product.nplItems);
  const [detailItem, setDetailItem] = useState<ProductNplItem | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [formIndex, setFormIndex] = useState<number | null>(null);
  const componentsFileInputRef = useRef<HTMLInputElement>(null);
  const [isReadingComponentsExcel, setIsReadingComponentsExcel] = useState(false);
  const [componentsExcelMessage, setComponentsExcelMessage] = useState('');
  const [componentsExcelError, setComponentsExcelError] = useState('');

  useEffect(() => {
    setItems(product.nplItems);
  }, [product]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, product.id]);

  const totalPercent = items.reduce((sum, item) => {
    if (item.amountType !== 'percent' || item.percent === null) return sum;
    return sum + item.percent;
  }, 0);
  const percentItemCount = items.filter(item => item.amountType === 'percent').length;

  const materialBaseKg = resolveProductMaterialBaseKg(product);

  const roundWeightKg = (value: number) => Math.round(value * 10000) / 10000;

  const resolveItemWeightKg = (item: ProductNplItem): number | null => {
    if (item.amountType === 'percent') {
      if (item.percent === null || materialBaseKg <= 0) return null;
      return roundWeightKg((item.percent / 100) * materialBaseKg);
    }
    if (item.quantity === null) return null;
    const unit = (item.unit || '').trim().toLowerCase();
    if (unit === '' || unit === 'kg' || unit === '-') return roundWeightKg(item.quantity);
    return null;
  };

  const formatItemWeight = (item: ProductNplItem): string => {
    const weight = resolveItemWeightKg(item);
    if (weight === null) return '-';
    return `${formatNumber(weight, 4)} kg`;
  };

  const resolveItemUnit = (item: ProductNplItem): string => {
    const key = normalizeProductCodeKey(item.code);
    const material = materialOptions.find(option => normalizeProductCodeKey(option.code) === key);
    if (material && material.unit && material.unit !== '-') return material.unit;
    if (item.unit && item.unit !== '-') return item.unit;
    return '-';
  };

  const openAddForm = () => {
    setFormIndex(null);
    setFormMode('add');
  };

  const openEditForm = (index: number) => {
    setFormIndex(index);
    setFormMode('edit');
  };

  const handleDeleteItem = async (index: number) => {
    const item = items[index];
    if (!item) return;
    if (!window.confirm(`Xóa thành phần "${item.code}" khỏi sản phẩm?`)) return;

    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    try {
      await onSaveItems(nextItems);
      setItems(nextItems);
      if (detailItem?.code === item.code) setDetailItem(null);
    } catch {
      // Lỗi đã hiển thị ở ProductsPanel
    }
  };

  const handleSaveItem = async (item: ProductNplItem) => {
    let nextItems: ProductNplItem[];

    if (formMode === 'edit' && formIndex !== null) {
      nextItems = items.map((existing, index) => (index === formIndex ? item : existing));
    } else {
      nextItems = [...items, item];
    }

    try {
      await onSaveItems(nextItems);
      setItems(nextItems);
      setFormMode(null);
      setFormIndex(null);
    } catch {
      // Lỗi đã hiển thị ở ProductsPanel
    }
  };

  const handleDownloadComponentsTemplate = () => {
    downloadProductNplComponentsTemplate(
      items.map(item => ({
        code: item.code,
        name: item.name,
        amountType: item.amountType,
        percent: item.percent,
        quantity: item.quantity,
        unit: item.unit
      })),
      product.code
    );
  };

  const handleComponentsExcelChange = async (file?: File | null) => {
    if (!file) return;

    setIsReadingComponentsExcel(true);
    setComponentsExcelError('');
    setComponentsExcelMessage('');

    try {
      const rows = await parseProductNplComponentsExcel(file);
      if (rows.length === 0) {
        throw new Error(
          'File Excel không có dòng thành phần hợp lệ. Kiểm tra cột Mã NPL, Loại, Giá trị và ĐVT (nếu là Số lượng).'
        );
      }

      const importedItems = excelRowsToProductNplItems(rows, materialOptions);
      const mergedItems = [...items];
      let addedCount = 0;
      let updatedCount = 0;

      importedItems.forEach(importedItem => {
        const key = normalizeProductCodeKey(importedItem.code);
        const existingIndex = mergedItems.findIndex(existing => normalizeProductCodeKey(existing.code) === key);
        if (existingIndex >= 0) {
          mergedItems[existingIndex] = importedItem;
          updatedCount += 1;
        } else {
          mergedItems.push(importedItem);
          addedCount += 1;
        }
      });

      const summaryParts = [
        addedCount > 0 ? `thêm ${addedCount} mới` : '',
        updatedCount > 0 ? `cập nhật ${updatedCount}` : ''
      ].filter(Boolean);
      const summary = summaryParts.join(', ');

      if (!window.confirm(`Excel có ${importedItems.length} dòng (${summary}). Thêm vào danh sách thành phần hiện tại?`)) {
        return;
      }

      await onSaveItems(mergedItems);
      setItems(mergedItems);
      setComponentsExcelMessage(`Đã ${summary} thành phần từ Excel.`);
    } catch (error: any) {
      setComponentsExcelError(error.message || 'Không thể đọc file Excel.');
    } finally {
      setIsReadingComponentsExcel(false);
      if (componentsFileInputRef.current) {
        componentsFileInputRef.current.value = '';
      }
    }
  };

  const compactInfoRows: Array<[string, string]> = [
    ['Mã SP', product.code || '-'],
    ['Mã AMIS', productAmisDisplayCode(product)],
    ...(product.newCode && product.newCode !== '-' && product.newCode !== product.code
      ? [['Mã mới', product.newCode] as [string, string]]
      : []),
    ['Nhóm', product.group],
    ['Tính chất', product.nature],
    ['Tồn đầu', product.openingStock],
    ['Nhập', product.inbound],
    ['Xuất', product.outbound],
    ['Tồn kho', product.stock],
    ['Tồn TT', product.minStock],
    ['Nguồn gốc', product.origin]
  ].filter(([, value]) => value && value !== '-');

  const productDescription =
    product.description && product.description !== '-' ? product.description.trim() : '';

  const normSpecCells = [
    { label: 'Đơn vị tính', value: product.unit && product.unit !== '-' ? product.unit : '-' },
    { label: 'Tổng trọng lượng TP (kg)', value: formatProductSpecDisplay(product.totalWeight), highlight: true },
    { label: 'Khổ cuộn (m)', value: formatProductSpecDisplay(product.rollWidth) },
    { label: 'Chiều dài mét/cuộn (m)', value: formatProductSpecDisplay(product.rollLength) },
    { label: 'Trọng lượng lõi (kg)', value: formatProductSpecDisplay(product.coreWeight) },
    { label: 'Trọng lượng túi (kg)', value: formatProductSpecDisplay(product.bagWeight) },
    { label: 'Trọng lượng nhựa + phụ gia (kg)', value: resolveProductPlasticWeight(product), highlight: true }
  ];

  const hasNormSpecs = normSpecCells.some(
    cell => cell.label !== 'Đơn vị tính' && cell.value !== '-'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-red-500">Xem sản phẩm</p>
            <h3 className="mt-1 text-lg font-black text-zinc-950">{product.name || product.code}</h3>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">{product.code}{product.newCode ? ` · ${product.newCode}` : ''}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                title="Sửa"
                className="flex h-9 items-center gap-1 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-[#ef1b2d] transition hover:bg-red-50"
              >
                <Pencil className="h-4 w-4" />
                Sửa
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                title="Xóa"
                className="flex h-9 items-center gap-1 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Xóa
              </button>
            )}
            <BackButton onClick={onClose} />
          </div>
        </div>

        <div className="flex gap-1 border-b border-zinc-200 px-4">
          <button
            type="button"
            onClick={() => setTab('info')}
            className={`border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
              tab === 'info' ? 'border-[#ef1b2d] text-[#ef1b2d]' : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Thông tin
          </button>
          <button
            type="button"
            onClick={() => setTab('components')}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
              tab === 'components' ? 'border-[#ef1b2d] text-[#ef1b2d]' : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <FlaskConical className="h-4 w-4" />
            Thành phần
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">{items.length}</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === 'info' ? (
            <div className="space-y-3">
              <section className="rounded-lg border border-zinc-200 bg-zinc-50/80">
                <p className="border-b border-zinc-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  Thông tin chung
                </p>
                <div className="overflow-x-auto px-2 py-2">
                  <table className="min-w-full text-xs">
                    <tbody>
                      <tr className="divide-x divide-zinc-200">
                        {compactInfoRows.map(([label, value]) => (
                          <td key={label} className="px-2 py-1 align-top whitespace-nowrap">
                            <span className="text-[9px] font-black uppercase tracking-wide text-zinc-400">{label}</span>
                            <p className="mt-0.5 font-bold text-zinc-900">{value}</p>
                          </td>
                        ))}
                      </tr>
                      {productDescription ? (
                        <tr>
                          <td colSpan={Math.max(compactInfoRows.length, 1)} className="border-t border-zinc-200 px-2 py-1.5">
                            <span className="text-[9px] font-black uppercase tracking-wide text-zinc-400">Mô tả</span>
                            <p className="mt-0.5 text-xs font-semibold text-zinc-700">{productDescription}</p>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border-2 border-emerald-200 bg-emerald-50/30">
                <div className="border-b border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Định mức sản phẩm</p>
                  <p className="text-[10px] font-semibold text-emerald-700/80">
                    Mã AMIS · {productAmisDisplayCode(product)}
                    {product.unit && product.unit !== '-' ? ` · ${product.unit}` : ''}
                  </p>
                </div>
                {!hasNormSpecs ? (
                  <p className="px-4 py-6 text-center text-sm font-semibold text-zinc-500">
                    Chưa khai báo định mức. Bấm Sửa để nhập hoặc chạy file seed SQL trên Supabase.
                  </p>
                ) : (
                  <div className="overflow-x-auto p-2">
                    <table className="min-w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-zinc-950 text-[9px] uppercase tracking-wider text-white">
                          {normSpecCells.map(cell => (
                            <th key={cell.label} className="px-2 py-2 font-black whitespace-nowrap">
                              {cell.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          {normSpecCells.map(cell => (
                            <td
                              key={cell.label}
                              className={`border border-zinc-200 px-2 py-2 font-bold whitespace-nowrap ${
                                cell.highlight ? 'bg-emerald-50 text-emerald-800' : 'text-zinc-900'
                              }`}
                            >
                              {cell.value}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-zinc-950">Bảng thành phần NVL</p>
                  <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                    Nguyên vật liệu · phần trăm hoặc số lượng
                    {materialBaseKg > 0
                      ? ` · Quy đổi % theo ${formatNumber(materialBaseKg, 3)} kg nhựa+phụ gia`
                      : ' · Chưa có KL nhựa+phụ gia để quy đổi %'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {percentItemCount > 0 && (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${Math.abs(totalPercent - 100) < 0.01 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                      Tổng %: {formatPercent(totalPercent)}%
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleDownloadComponentsTemplate}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-extrabold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <Download className="h-4 w-4" />
                    Tải mẫu Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => componentsFileInputRef.current?.click()}
                    disabled={isSaving || isReadingComponentsExcel}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-extrabold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isReadingComponentsExcel ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {isReadingComponentsExcel ? 'Đang đọc...' : 'Tải Excel lên'}
                  </button>
                  <input
                    ref={componentsFileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={event => handleComponentsExcelChange(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={openAddForm}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm
                  </button>
                </div>
              </div>

              {(componentsExcelError || componentsExcelMessage) && (
                <p
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                    componentsExcelError
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {componentsExcelError || componentsExcelMessage}
                </p>
              )}

              <p className="text-[11px] font-semibold text-zinc-500">
                Excel gồm các cột: <strong>Mã NPL</strong>, <strong>Tên NVL</strong>, <strong>Loại</strong> (Phần trăm / Số lượng), <strong>Giá trị</strong>, <strong>ĐVT</strong> (bắt buộc nếu Số lượng). Tải lên sẽ thêm mới vào danh sách hiện tại, dòng trùng Mã NPL sẽ được cập nhật.
              </p>

              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-4 py-3 font-black">STT</th>
                      <th className="px-4 py-3 font-black">Mã NPL</th>
                      <th className="px-4 py-3 font-black">Tên NVL</th>
                      <th className="px-4 py-3 font-black">Loại</th>
                      <th className="px-4 py-3 font-black">Giá trị</th>
                      <th className="px-4 py-3 font-black">Khối lượng (kg)</th>
                      <th className="px-4 py-3 font-black">ĐVT</th>
                      <th className="px-4 py-3 text-center font-black">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.map((item, index) => (
                      <tr key={`${item.code}-${index}`} className="hover:bg-red-50/40">
                        <td className="px-4 py-3 font-bold text-zinc-600">{index + 1}</td>
                        <td className="px-4 py-3 font-black text-zinc-950">{item.code}</td>
                        <td className="px-4 py-3 font-semibold text-zinc-800">{item.name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-black text-zinc-700">
                            {productNplAmountTypeLabel(item.amountType)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
                            {item.amountType === 'percent'
                              ? formatPercent(item.percent ?? 0)
                              : formatNumber(item.quantity ?? 0, 2)}
                            {item.amountType === 'percent' ? '%' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-700">
                          {formatItemWeight(item)}
                        </td>
                        <td className="px-4 py-3 font-bold text-zinc-700">
                          {resolveItemUnit(item)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setDetailItem(item)}
                              title="Xem"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditForm(index)}
                              title="Sửa"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(index)}
                              disabled={isSaving}
                              title="Xóa"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center font-bold text-zinc-400">
                          Chưa khai báo thành phần NVL.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {detailItem && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Chi tiết thành phần</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">{detailItem.code}</p>
              </div>
              <BackButton onClick={() => setDetailItem(null)} />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {[
                ['Mã NPL', detailItem.code],
                ['Tên NVL', detailItem.name || '-'],
                ['Loại', productNplAmountTypeLabel(detailItem.amountType)],
                ['Giá trị', formatProductNplAmount(detailItem)],
                ['Khối lượng', formatItemWeight(detailItem)],
                ['Đơn vị', resolveItemUnit(detailItem)],
                ['Sản phẩm', product.code]
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="mt-1 font-bold text-zinc-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {formMode && (
        <ProductNplItemFormModal
          mode={formMode}
          initialItem={formMode === 'edit' && formIndex !== null ? items[formIndex] : undefined}
          materialOptions={materialOptions}
          isLoadingMaterials={isLoadingMaterials}
          isSaving={isSaving}
          existingCodes={items
            .filter((_, index) => formMode !== 'edit' || index !== formIndex)
            .map(item => item.code)}
          onClose={() => {
            setFormMode(null);
            setFormIndex(null);
          }}
          onSave={handleSaveItem}
        />
      )}
    </div>
  );
}

export function normalizeProducts(data: unknown): ProductRow[] {
  if (!data || typeof data !== 'object') return [];
  const products = (data as { products?: unknown }).products;
  if (!Array.isArray(products)) return [];

  return products
    .map((item): ProductRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = String(record.ma_sp ?? record.code ?? '').trim();
      const name = String(record.ten_sp ?? record.name ?? '').trim();
      if (!code && !name) return null;

      return {
        id: String(record.id ?? '').trim() || code || name,
        code,
        newCode: String(record.ma_sp_moi ?? '').trim(),
        amisCode: String(record.ma_amis ?? '').trim(),
        name,
        nature: String(record.tinh_chat ?? '').trim() || 'Chưa phân loại',
        group: String(record.nhom_vthh ?? '').trim() || 'Chưa nhóm',
        unit: String(record.don_vi ?? '').trim() || '-',
        totalWeight: formatCell(record.tong_trong_luong),
        rollWidth: formatCell(record.kho_cuon),
        rollLength: formatCell(record.chieu_dai_cuon),
        coreWeight: formatCell(record.trong_luong_loi),
        bagWeight: formatCell(record.trong_luong_tui),
        plasticWeight: formatCell(record.trong_luong_nhua),
        openingStock:
          record.ton_dau_ky === null || record.ton_dau_ky === undefined ? '-' : String(record.ton_dau_ky),
        inbound: formatCell(record.nhap_trong_ky),
        outbound: formatCell(record.xuat_trong_ky),
        stock: record.sl_ton === null || record.sl_ton === undefined ? '-' : String(record.sl_ton),
        minStock:
          record.so_luong_ton_toi_thieu === null || record.so_luong_ton_toi_thieu === undefined
            ? '-'
            : String(record.so_luong_ton_toi_thieu),
        origin: String(record.nguon_goc ?? '').trim() || '-',
        description: String(record.mo_ta ?? '').trim(),
        nplItems: parseProductNplItems(
          record.npl_phan_tram ??
          record.nplPhanTram ??
          record.nplItems ??
          record.thanh_phan ??
          record.dinh_muc
        )
      };
    })
    .filter((product): product is ProductRow => Boolean(product));
}

export type ProductFormState = {
  code: string;
  newCode: string;
  amisCode: string;
  name: string;
  nature: string;
  group: string;
  unit: string;
  totalWeight: string;
  rollWidth: string;
  rollLength: string;
  coreWeight: string;
  bagWeight: string;
  plasticWeight: string;
  openingStock: string;
  inbound: string;
  outbound: string;
  stock: string;
  minStock: string;
  origin: string;
  description: string;
};

export function productCellToInput(value: string) {
  return value === '-' ? '' : value;
}

export function productToForm(product: ProductRow): ProductFormState {
  return {
    code: productCellToInput(product.code),
    newCode: productCellToInput(product.newCode),
    amisCode: productCellToInput(product.amisCode),
    name: productCellToInput(product.name),
    nature: productCellToInput(product.nature),
    group: productCellToInput(product.group),
    unit: productCellToInput(product.unit),
    totalWeight: productCellToInput(product.totalWeight),
    rollWidth: productCellToInput(product.rollWidth),
    rollLength: productCellToInput(product.rollLength),
    coreWeight: productCellToInput(product.coreWeight),
    bagWeight: productCellToInput(product.bagWeight),
    plasticWeight: productCellToInput(product.plasticWeight),
    openingStock: productCellToInput(product.openingStock),
    inbound: productCellToInput(product.inbound),
    outbound: productCellToInput(product.outbound),
    stock: productCellToInput(product.stock),
    minStock: productCellToInput(product.minStock),
    origin: productCellToInput(product.origin),
    description: productCellToInput(product.description)
  };
}

export function emptyProductForm(): ProductFormState {
  return {
    code: '',
    newCode: '',
    amisCode: '',
    name: '',
    nature: '',
    group: '',
    unit: '',
    totalWeight: '',
    rollWidth: '',
    rollLength: '',
    coreWeight: '',
    bagWeight: '',
    plasticWeight: '',
    openingStock: '',
    inbound: '',
    outbound: '',
    stock: '',
    minStock: '',
    origin: '',
    description: ''
  };
}

export function productFormToPayload(form: ProductFormState) {
  return {
    code: form.code.trim(),
    newCode: form.newCode.trim(),
    amisCode: form.amisCode.trim(),
    name: form.name.trim(),
    nature: form.nature.trim(),
    group: form.group.trim(),
    unit: form.unit.trim(),
    totalWeight: form.totalWeight.trim(),
    rollWidth: form.rollWidth.trim(),
    rollLength: form.rollLength.trim(),
    coreWeight: form.coreWeight.trim(),
    bagWeight: form.bagWeight.trim(),
    plasticWeight: form.plasticWeight.trim(),
    openingStock: form.openingStock.trim(),
    inbound: form.inbound.trim(),
    outbound: form.outbound.trim(),
    stock: form.stock.trim(),
    minStock: form.minStock.trim(),
    origin: form.origin.trim(),
    description: form.description.trim()
  };
}

export function ProductEditModal({
  mode,
  product,
  isSaving,
  formError,
  onClose,
  onSave
}: {
  mode: 'add' | 'edit';
  product: ProductRow | null;
  isSaving: boolean;
  formError: string;
  onClose: () => void;
  onSave: (form: ProductFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<ProductFormState>(() =>
    mode === 'edit' && product ? productToForm(product) : emptyProductForm()
  );

  useEffect(() => {
    setForm(mode === 'edit' && product ? productToForm(product) : emptyProductForm());
  }, [mode, product?.id]);

  const fields: Array<{ key: keyof ProductFormState; label: string; required?: boolean; span?: boolean }> = [
    { key: 'code', label: 'Mã SP', required: true },
    { key: 'amisCode', label: 'Mã AMIS' },
    { key: 'newCode', label: 'Mã mới' },
    { key: 'name', label: 'Tên sản phẩm', required: true },
    { key: 'nature', label: 'Tính chất' },
    { key: 'group', label: 'Nhóm VTHH' },
    { key: 'unit', label: 'Đơn vị tính' },
    { key: 'totalWeight', label: 'Tổng trọng lượng TP (kg)' },
    { key: 'rollWidth', label: 'Khổ cuộn (m)' },
    { key: 'rollLength', label: 'Chiều dài mét/cuộn (m)' },
    { key: 'coreWeight', label: 'Trọng lượng lõi (kg)' },
    { key: 'bagWeight', label: 'Trọng lượng túi (kg)' },
    { key: 'plasticWeight', label: 'Trọng lượng nhựa + phụ gia (kg)' },
    { key: 'openingStock', label: 'Tồn đầu' },
    { key: 'inbound', label: 'Nhập' },
    { key: 'outbound', label: 'Xuất' },
    { key: 'stock', label: 'Tồn kho' },
    { key: 'minStock', label: 'Tồn tối thiểu' },
    { key: 'origin', label: 'Nguồn gốc' },
    { key: 'description', label: 'Mô tả', span: true }
  ];

  const handleSave = async () => {
    await onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
              {mode === 'add' ? 'Thêm sản phẩm mới' : 'Sửa sản phẩm'}
            </h3>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              {mode === 'add' ? 'Ghi vào bảng san_pham trên Supabase' : product?.code || '-'}
            </p>
          </div>
          <BackButton onClick={onClose} />
        </div>
        {formError && (
          <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
            {formError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          {fields.map(field => (
            <label key={field.key} className={`block space-y-1.5 ${field.span ? 'sm:col-span-2' : ''}`}>
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                {field.label}{field.required ? ' *' : ''}
              </span>
              <input
                value={form[field.key]}
                onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))}
                className={productFieldClass}
              />
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <BackButton onClick={onClose} className="h-10 rounded-lg bg-white" />
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Đang lưu...' : mode === 'add' ? 'Thêm mới' : 'Cập nhật'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductsPanel({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedNatures, setSelectedNatures] = useState<Set<string>>(() => new Set());
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set());
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [isDeletingProducts, setIsDeletingProducts] = useState(false);
  const [productActionMessage, setProductActionMessage] = useState('');
  const [viewingProduct, setViewingProduct] = useState<ProductRow | null>(null);
  const [productViewTab, setProductViewTab] = useState<ProductViewTab>('info');
  const [materialOptions, setMaterialOptions] = useState<MaterialOption[]>([]);
  const [isLoadingMaterialOptions, setIsLoadingMaterialOptions] = useState(false);
  const [isSavingProductNpl, setIsSavingProductNpl] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [productFormMode, setProductFormMode] = useState<'add' | 'edit' | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState('');
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const bulkComponentsFileInputRef = useRef<HTMLInputElement>(null);
  const [isImportingBulkProductComponents, setIsImportingBulkProductComponents] = useState(false);

  const loadProducts = async () => {
    setIsLoadingProducts(true);
    setProductError('');

    try {
      const res = await fetch('/api/san-pham?format=table');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải sản phẩm từ Supabase.');
      }

      setProducts(normalizeProducts(data));
    } catch (error: any) {
      setProducts([]);
      setProductError(error.message || 'Không thể tải sản phẩm từ Supabase.');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!viewingProduct) return;
    const fresh = products.find(product => product.id === viewingProduct.id);
    if (fresh) setViewingProduct(fresh);
  }, [products, viewingProduct?.id]);

  const loadMaterialOptions = async () => {
    setIsLoadingMaterialOptions(true);
    try {
      const res = await fetch('/api/kho-nvl');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải danh sách NPL.');
      }
      const materials = normalizeMaterialsInventory(data);
      const options = materials.map(material => ({
        code: material.code,
        name: material.name,
        unit: material.unit && material.unit !== '-' ? material.unit : ''
      }));
      setMaterialOptions(options);
      return options;
    } catch {
      setMaterialOptions([]);
      return [];
    } finally {
      setIsLoadingMaterialOptions(false);
    }
  };

  const openProductView = (product: ProductRow, tab: ProductViewTab = 'info') => {
    setProductActionMessage('');
    setProductError('');
    setProductFormError('');
    setEditingProduct(null);
    setProductFormMode(null);
    setViewingProduct(product);
    setProductViewTab(tab);
    if (materialOptions.length === 0) {
      loadMaterialOptions();
    }
  };

  const openProductCreate = () => {
    setProductActionMessage('');
    setProductError('');
    setProductFormError('');
    setViewingProduct(null);
    setEditingProduct(null);
    setProductFormMode('add');
  };

  const openProductEdit = (product: ProductRow) => {
    setProductActionMessage('');
    setProductError('');
    setProductFormError('');
    setViewingProduct(null);
    setEditingProduct(product);
    setProductFormMode('edit');
  };

  const closeProductForm = () => {
    setProductFormMode(null);
    setEditingProduct(null);
    setProductFormError('');
  };

  const handleCreateProduct = async (form: ProductFormState) => {
    if (!form.code.trim() && !form.name.trim()) {
      setProductFormError('Vui lòng nhập mã SP hoặc tên sản phẩm.');
      return;
    }

    setIsSavingProduct(true);
    setProductFormError('');

    try {
      const res = await fetch('/api/san-pham', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productFormToPayload(form))
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể thêm sản phẩm.');
      }

      closeProductForm();
      setProductActionMessage('Đã thêm sản phẩm mới.');
      await loadProducts();
    } catch (error: any) {
      setProductFormError(error.message || 'Không thể thêm sản phẩm.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleSaveProduct = async (form: ProductFormState) => {
    if (!editingProduct) return;
    if (!form.code.trim() && !form.name.trim()) {
      setProductFormError('Vui lòng nhập mã SP hoặc tên sản phẩm.');
      return;
    }

    setIsSavingProduct(true);
    setProductFormError('');

    try {
      const res = await fetch(`/api/san-pham/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productFormToPayload(form))
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể cập nhật sản phẩm.');
      }

      closeProductForm();
      setProductActionMessage('Đã cập nhật sản phẩm.');
      await loadProducts();
    } catch (error: any) {
      setProductFormError(error.message || 'Không thể cập nhật sản phẩm.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: ProductRow) => {
    if (!product.id) {
      setProductError('Không tìm thấy ID để xóa.');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa sản phẩm "${product.code || product.name}"?`)) return;

    setDeletingProductId(product.id);
    setProductActionMessage('');

    try {
      const res = await fetch('/api/san-pham', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [product.id] })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa sản phẩm.');
      }

      if (viewingProduct?.id === product.id) setViewingProduct(null);
      if (editingProduct?.id === product.id) closeProductForm();
      setSelectedProductIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
      setProductActionMessage('Đã xóa sản phẩm.');
      await loadProducts();
    } catch (error: any) {
      setProductError(error.message || 'Không thể xóa sản phẩm.');
    } finally {
      setDeletingProductId(null);
    }
  };

  const saveProductNplItems = async (productId: string, items: ProductNplItem[]) => {
    setIsSavingProductNpl(true);
    setProductError('');

    try {
      const res = await fetch(`/api/san-pham/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npl_phan_tram: productNplItemsToJson(items) })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu thành phần sản phẩm.');
      }

      setProductActionMessage('Đã cập nhật thành phần sản phẩm.');
      await loadProducts();
    } catch (error: any) {
      setProductError(error.message || 'Không thể lưu thành phần sản phẩm.');
      throw error;
    } finally {
      setIsSavingProductNpl(false);
    }
  };

  const handleDownloadBulkProductComponentsTemplate = () => {
    downloadBulkProductNplComponentsTemplate(
      products.flatMap(product =>
        product.nplItems.map(item => ({
          productCode: product.code,
          componentName: item.name,
          amountType: item.amountType,
          percent: item.percent,
          quantity: item.quantity,
          unit: item.unit
        }))
      )
    );
  };

  const handleImportBulkProductComponents = async (file?: File | null) => {
    if (!file) return;

    setIsImportingBulkProductComponents(true);
    setProductError('');
    setProductActionMessage('');

    try {
      const effectiveMaterialOptions =
        materialOptions.length > 0 ? materialOptions : await loadMaterialOptions();

      const rows = await parseBulkProductNplComponentsExcel(file);
      if (rows.length === 0) {
        throw new Error(
          'File Excel không có dòng hợp lệ. Cần có các cột Mã SP, Tên NVL, Loại, Giá trị và ĐVT nếu là Số lượng.'
        );
      }

      const productMap = bulkExcelRowsToProductMap(rows, effectiveMaterialOptions);
      const unknownMaterialNames = rows
        .filter(
          row =>
            !effectiveMaterialOptions.some(
              option => normalizeProductCodeKey(option.name) === normalizeProductCodeKey(row.componentName)
            )
        )
        .map(row => row.componentName);
      if (unknownMaterialNames.length > 0) {
        const sample = [...new Set(unknownMaterialNames)].slice(0, 5).join(', ');
        throw new Error(`Không tìm thấy NVL trong kho theo tên: ${sample}.`);
      }
      const updates = products
        .map(product => {
          const key = normalizeProductCodeKey(product.code || product.amisCode || product.newCode || '');
          const importedItems = productMap.get(key) || [];
          if (!key || importedItems.length === 0) return null;

          const mergedItems = [...product.nplItems];
          importedItems.forEach(importedItem => {
            const importKey = normalizeProductCodeKey(importedItem.code);
            const existingIndex = mergedItems.findIndex(
              existing => normalizeProductCodeKey(existing.code) === importKey
            );
            if (existingIndex >= 0) {
              mergedItems[existingIndex] = importedItem;
            } else {
              mergedItems.push(importedItem);
            }
          });

          return { product, key, items: mergedItems };
        })
        .filter((entry): entry is { product: ProductRow; key: string; items: ProductNplItem[] } => Boolean(entry));

      if (updates.length === 0) {
        throw new Error('Không tìm thấy sản phẩm nào trong file khớp với danh sách hiện tại.');
      }

      const missingProductCodes = [...productMap.keys()].filter(
        key =>
          !products.some(product =>
            [
              normalizeProductCodeKey(product.code),
              normalizeProductCodeKey(product.amisCode),
              normalizeProductCodeKey(product.newCode)
            ].includes(key)
          )
      );

      const confirmMessage = [
        `Cập nhật thành phần cho ${updates.length} sản phẩm từ Excel?`,
        missingProductCodes.length > 0 ? `Bỏ qua ${missingProductCodes.length} mã SP không khớp.` : null
      ]
        .filter(Boolean)
        .join('\n');

      if (!window.confirm(confirmMessage)) {
        return;
      }

      await Promise.all(
        updates.map(async entry => {
          const res = await fetch(`/api/san-pham/${entry.product.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ npl_phan_tram: productNplItemsToJson(entry.items) })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || `Không thể cập nhật thành phần cho ${entry.product.code}.`);
          }
        })
      );

      const parts = [`Đã cập nhật thành phần cho ${updates.length} sản phẩm.`];
      if (missingProductCodes.length > 0) {
        parts.push(`Bỏ qua ${missingProductCodes.length} mã SP không khớp.`);
      }
      setProductActionMessage(parts.join(' '));
      await loadProducts();
    } catch (error: any) {
      setProductError(error.message || 'Không thể tải Excel thành phần sản phẩm.');
    } finally {
      setIsImportingBulkProductComponents(false);
      if (bulkComponentsFileInputRef.current) {
        bulkComponentsFileInputRef.current.value = '';
      }
    }
  };

  const productGroups = useMemo(
    () => ['all', ...Array.from(new Set(products.map(product => product.group))).sort((a, b) => a.localeCompare(b, 'vi'))],
    [products]
  );
  const productNatures = useMemo(
    () => Array.from(new Set(products.map(product => product.nature))).sort((a, b) => a.localeCompare(b, 'vi')),
    [products]
  );
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesGroup = selectedGroup === 'all' || product.group === selectedGroup;
      const matchesNature = selectedNatures.size === 0 || selectedNatures.has(product.nature);
      const matchesSearch =
        !normalizedSearch ||
        `${product.code} ${product.newCode} ${product.name} ${product.nature} ${product.group} ${product.origin} ${formatProductNplSummary(product.nplItems)}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesGroup && matchesNature && matchesSearch;
    });
  }, [normalizedSearch, products, selectedGroup, selectedNatures]);

  const natureCount = new Set(products.map(product => product.nature)).size;
  const unitCount = new Set(products.map(product => product.unit).filter(Boolean)).size;
  const selectedProducts = useMemo(
    () => products.filter(product => selectedProductIds.has(product.id)),
    [products, selectedProductIds]
  );
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(product => selectedProductIds.has(product.id));

  useEffect(() => {
    let cancelled = false;

    const generateQrImages = async () => {
      const nextEntries = await Promise.all(
        products
          .filter(product => product.code)
          .map(async product => {
            const url = await QRCode.toDataURL(product.code, {
              errorCorrectionLevel: 'H',
              margin: 1,
              width: 160,
              color: {
                dark: '#111111',
                light: '#ffffff'
              }
            });
            return [product.id, url] as const;
          })
      );

      if (!cancelled) {
        setQrImages(Object.fromEntries(nextEntries));
      }
    };

    if (products.length > 0) {
      generateQrImages();
    } else {
      setQrImages({});
    }

    return () => {
      cancelled = true;
    };
  }, [products]);

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleNature = (nature: string) => {
    setSelectedNatures(prev => {
      const next = new Set(prev);
      if (next.has(nature)) {
        next.delete(nature);
      } else {
        next.add(nature);
      }
      return next;
    });
  };

  const clearNatureFilters = () => {
    setSelectedNatures(new Set());
  };

  const toggleFilteredProducts = () => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredProducts.forEach(product => next.delete(product.id));
      } else {
        filteredProducts.forEach(product => next.add(product.id));
      }
      return next;
    });
  };

  const handlePrintSelectedQr = () => {
    if (selectedProducts.length === 0) return;
    window.print();
  };

  const handleBulkDeleteProducts = async () => {
    if (selectedProducts.length === 0) return;

    const label =
      selectedProducts.length === 1
        ? `"${selectedProducts[0].code || selectedProducts[0].name}"`
        : `${selectedProducts.length} sản phẩm`;

    if (!window.confirm(`Bạn có chắc muốn xóa ${label}? Hành động này không thể hoàn tác.`)) {
      return;
    }

    setIsDeletingProducts(true);
    setProductActionMessage('');
    setProductError('');

    try {
      const res = await fetch('/api/san-pham', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedProducts.map(product => product.id) })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa sản phẩm đã chọn.');
      }

      setSelectedProductIds(new Set());
      setProductActionMessage(`Đã xóa ${data.deleted ?? selectedProducts.length} sản phẩm.`);
      await loadProducts();
    } catch (error: any) {
      setProductError(error.message || 'Không thể xóa sản phẩm đã chọn.');
    } finally {
      setIsDeletingProducts(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="bg-white p-3 text-slate-700 border-b border-slate-200">
          <div className="flex items-start justify-end gap-3">
            <div className="hidden">
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Danh mục sản phẩm</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Sản phẩm</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase san_pham.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={openProductCreate}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Sản phẩm', products.length],
              ['Nhóm VTHH', productGroups.length > 0 ? productGroups.length - 1 : 0],
              ['Đơn vị', unitCount || natureCount]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="block font-bold text-zinc-400">{label}</span>
                <span className="mt-1 block text-xl font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {productGroups.map(group => (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(group)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedGroup === group
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {group === 'all' ? 'Tất cả' : group}
            </button>
          ))}
          {isLoadingProducts && (
            <div className="flex h-11 shrink-0 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-500">
              Đang tải Supabase...
            </div>
          )}
        </div>

        <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 lg:mt-0 lg:w-[420px]">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Tìm mã, tên, nhóm, nguồn gốc..."
            disabled={isLoadingProducts || products.length === 0}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {productError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {productError}
          </p>
        )}

        {productActionMessage && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 lg:mt-0">
            {productActionMessage}
          </p>
        )}
      </section>

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-zinc-950">Lọc theo tính chất</p>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              {selectedNatures.size === 0
                ? 'Đang hiển thị tất cả tính chất.'
                : `Đã chọn ${selectedNatures.size} tính chất.`}
            </p>
          </div>

          {selectedNatures.size > 0 && (
            <button
              type="button"
              onClick={clearNatureFilters}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-black text-zinc-600 transition hover:border-zinc-950"
            >
              Bỏ lọc tính chất
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {productNatures.map(nature => {
            const checked = selectedNatures.has(nature);
            return (
              <label
                key={nature}
                className={`flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-black transition ${
                  checked
                    ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleNature(nature)}
                  disabled={isLoadingProducts}
                  className="h-4 w-4 accent-[#ef1b2d]"
                />
                <span>{nature}</span>
              </label>
            );
          })}

          {!isLoadingProducts && productNatures.length === 0 && (
            <div className="flex h-10 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold text-zinc-500">
              Chưa có dữ liệu tính chất
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border-2 border-zinc-900/10 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-black text-zinc-950">Thao tác hàng loạt</p>
          <p className="mt-0.5 text-xs font-semibold text-zinc-500">
            Đã chọn {selectedProducts.length} dòng. Có thể nhập Excel thành phần cho nhiều sản phẩm, in QR hoặc xóa các sản phẩm đã tick.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button
            type="button"
            onClick={handleDownloadBulkProductComponentsTemplate}
            disabled={isLoadingProducts}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black text-zinc-700 transition hover:border-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Tải mẫu Excel TP
          </button>
          <button
            type="button"
            onClick={() => bulkComponentsFileInputRef.current?.click()}
            disabled={isLoadingProducts || isImportingBulkProductComponents}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 text-xs font-black text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isImportingBulkProductComponents ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isImportingBulkProductComponents ? 'Đang nhập...' : 'Tải Excel TP lên'}
          </button>
          <input
            ref={bulkComponentsFileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={event => handleImportBulkProductComponents(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={toggleFilteredProducts}
            disabled={filteredProducts.length === 0}
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black text-zinc-700 transition hover:border-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allFilteredSelected ? 'Bỏ chọn bộ lọc' : 'Chọn các dòng đang lọc'}
          </button>
          <button
            type="button"
            onClick={handleBulkDeleteProducts}
            disabled={selectedProducts.length === 0 || isDeletingProducts}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeletingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {isDeletingProducts ? 'Đang xóa...' : 'Xóa đã chọn'}
          </button>
          <button
            type="button"
            onClick={handlePrintSelectedQr}
            disabled={selectedProducts.length === 0}
            className="h-11 rounded-xl bg-[#ef1b2d] px-5 text-xs font-black text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            In QR đã chọn
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[56px]" />
              <col className="w-[155px]" />
              <col className="w-[110px]" />
              <col className="w-[30%]" />
              <col className="w-[155px]" />
              <col className="w-[100px]" />
              <col className="w-[72px]" />
              <col className="w-[96px]" />
              <col className="w-[76px]" />
              <col className="w-[76px]" />
              <col className="w-[76px]" />
              <col className="w-[76px]" />
              <col className="w-[118px]" />
              <col className="w-[120px]" />
            </colgroup>
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-3 py-4 text-center font-black">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleFilteredProducts}
                    className="h-4 w-4 accent-[#ef1b2d]"
                    aria-label="Chọn tất cả sản phẩm đang lọc"
                  />
                </th>
                <th className="px-4 py-4 font-black">Mã SP</th>
                <th className="px-3 py-4 text-center font-black">Mã QR</th>
                <th className="px-4 py-4 font-black">Tên sản phẩm</th>
                <th className="px-4 py-4 font-black">Tính chất</th>
                <th className="px-4 py-4 text-center font-black">Nhóm</th>
                <th className="px-4 py-4 text-center font-black">Đơn vị</th>
                <th className="px-3 py-4 text-center font-black">Tổng TL (kg)</th>
                <th className="px-3 py-4 text-center font-black">Tồn đầu</th>
                <th className="px-3 py-4 text-center font-black">Nhập</th>
                <th className="px-3 py-4 text-center font-black">Xuất</th>
                <th className="px-3 py-4 text-center font-black">Tồn</th>
                <th className="px-3 py-4 text-center font-black">Tồn tối thiểu</th>
                <th className="sticky right-0 z-10 border-l border-zinc-800 bg-zinc-950 px-3 py-4 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredProducts.map(product => (
                <tr key={`${product.code}-${product.name}`} className="group align-middle transition hover:bg-red-50/40">
                  <td className="px-3 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.has(product.id)}
                      onChange={() => toggleProduct(product.id)}
                      className="h-4 w-4 accent-[#ef1b2d]"
                      aria-label={`Chọn in QR ${product.code}`}
                    />
                  </td>
                  <td className="px-4 py-3.5 font-black text-zinc-950">{product.code || '-'}</td>
                  <td className="px-3 py-3.5">
                    {qrImages[product.id] ? (
                      <div className="relative mx-auto h-14 w-14 rounded-lg border border-zinc-200 bg-white p-1">
                        <img src={qrImages[product.id]} alt={`QR ${product.code}`} className="h-full w-full" />
                        <span className="absolute left-1/2 top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded bg-white p-0.5 shadow-sm">
                          <img src={vietNhatLogoUrl} alt="Logo Viet Nhat" className="max-h-full max-w-full object-contain" />
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-zinc-300">Đang tạo</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-black text-zinc-950">{product.name || '-'}</div>
                    {product.description && (
                      <div className="mt-0.5 max-w-sm truncate text-xs font-semibold text-zinc-400">{product.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex max-w-full items-center rounded-full border border-[#ef1b2d]/20 bg-red-50 px-2.5 py-1 text-xs font-black leading-tight text-[#ef1b2d]">
                      {product.nature}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center font-bold text-zinc-700">{product.group}</td>
                  <td className="px-4 py-3.5 text-center font-bold text-zinc-700">{product.unit}</td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-emerald-800">
                    {formatProductSpecDisplay(product.totalWeight)}
                  </td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-zinc-700">{product.openingStock}</td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-zinc-700">{product.inbound}</td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-zinc-700">{product.outbound}</td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-zinc-700">{product.stock}</td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-zinc-700">{product.minStock}</td>
                  <td className="sticky right-0 z-10 border-l border-zinc-100 bg-white px-3 py-3.5 group-hover:bg-red-50/40">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openProductView(product)}
                        title="Xem"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openProductEdit(product)}
                        title="Sửa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(product)}
                        disabled={deletingProductId === product.id}
                        title="Xóa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingProductId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoadingProducts && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Không có sản phẩm phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {productFormMode && (
        <ProductEditModal
          mode={productFormMode}
          product={editingProduct}
          isSaving={isSavingProduct}
          formError={productFormError}
          onClose={closeProductForm}
          onSave={productFormMode === 'add' ? handleCreateProduct : handleSaveProduct}
        />
      )}

      {viewingProduct && (
        <ProductViewModal
          product={viewingProduct}
          initialTab={productViewTab}
          materialOptions={materialOptions}
          isLoadingMaterials={isLoadingMaterialOptions}
          isSaving={isSavingProductNpl}
          onClose={() => setViewingProduct(null)}
          onSaveItems={items => saveProductNplItems(viewingProduct.id, items)}
          onEdit={() => openProductEdit(viewingProduct)}
          onDelete={() => handleDeleteProduct(viewingProduct)}
          isDeleting={deletingProductId === viewingProduct.id}
        />
      )}

      <div className="qr-print-sheet">
        <div className="qr-print-page">
          {selectedProducts.map(product => (
            <div key={`print-${product.id}`} className="qr-print-card">
              <div className="qr-print-code">
                {qrImages[product.id] && <img src={qrImages[product.id]} alt={`QR ${product.code}`} />}
                <span>
                  <img src={vietNhatLogoUrl} alt="Logo Viet Nhat" />
                </span>
              </div>
              <div className="qr-print-meta">
                <strong>{product.code || '-'}</strong>
                <p>{product.name || '-'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

