import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { 
  ProductionReport, ShiftInfo, ProductEntry, MaterialBatches, STANDARD_SHIFTS
} from './types';
import { computeReportMetrics, formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from './utils';
import ShiftInfoForm from './components/ShiftInfoForm';
import ProductEntryForm from './components/ProductEntryForm';
import MaterialsForm from './components/MaterialsForm';
import WasteForm from './components/WasteForm';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import WeighingShiftSummary from './components/WeighingShiftSummary';
import { AppTab, pathFromTab, tabFromPath } from './routes';
import vietNhatLogoUrl from '../logovietnhat_1.png';
import { 
  FilePlus2, BarChart3, Layers, Wifi, WifiOff, 
  HelpCircle, CheckCircle, Smartphone, MapPin, 
  ChevronRight, ChevronLeft, ChevronDown, Save, Sparkles, Loader2, Menu, History, UsersRound,
  Building2, UserPlus, Search, MoreVertical, ShieldCheck, BriefcaseBusiness, Package, Cpu, Plus, Boxes, ClipboardList, Settings,
  ImagePlus,
  Eye, Pencil, Trash2, Factory, LayoutDashboard, FlaskConical, ArrowDownToLine, ArrowUpFromLine
} from 'lucide-react';

const STORAGE_DRAFT_KEY = 'factory_report_draft_v1';
const STORAGE_OFFLINE_KEY = 'factory_reports_offline_queue';
const STORAGE_REPORTS_CACHE_KEY = 'factory_reports_cache_v1';

function readCachedReports(): ProductionReport[] {
  try {
    const cached = localStorage.getItem(STORAGE_REPORTS_CACHE_KEY);
    return cached ? JSON.parse(cached) as ProductionReport[] : [];
  } catch {
    return [];
  }
}

function VietNhatLogo() {
  return (
    <img
      src={vietNhatLogoUrl}
      alt="Viet Nhat IPT"
      className="brand-logo h-12 w-auto max-w-[190px] object-contain"
    />
  );
}

interface HrMember {
  id: string;
  code?: string;
  name: string;
  role: string;
  position?: string;
  shift: string;
  status: string;
}

interface HrDepartment {
  id: string;
  name: string;
  lead: string;
  members: HrMember[];
}

interface HrBranch {
  id: string;
  name: string;
  shortName: string;
  departments: HrDepartment[];
}

function normalizeHrBranches(data: unknown): HrBranch[] {
  if (!data || typeof data !== 'object') return [];
  const branches = (data as { branches?: unknown }).branches;
  if (!Array.isArray(branches)) return [];

  return branches
    .map((branch): HrBranch | null => {
      if (!branch || typeof branch !== 'object') return null;
      const record = branch as Record<string, unknown>;
      const departments = Array.isArray(record.departments) ? record.departments : [];
      const normalizedDepartments = departments
        .map((department): HrDepartment | null => {
          if (!department || typeof department !== 'object') return null;
          const departmentRecord = department as Record<string, unknown>;
          const members = Array.isArray(departmentRecord.members) ? departmentRecord.members : [];

          return {
            id: String(departmentRecord.id ?? departmentRecord.name ?? ''),
            name: String(departmentRecord.name ?? 'Chưa phân phòng ban'),
            lead: String(departmentRecord.lead ?? 'Chưa phân công'),
            members: members
              .map((member): HrMember | null => {
                if (!member || typeof member !== 'object') return null;
                const memberRecord = member as Record<string, unknown>;
                const name = String(memberRecord.name ?? '').trim();
                if (!name) return null;

                return {
                  id: String(memberRecord.id ?? memberRecord.code ?? name),
                  code: String(memberRecord.code ?? '').trim() || undefined,
                  name,
                  role: String(memberRecord.role ?? 'Nhân sự'),
                  position: String(memberRecord.position ?? '').trim() || undefined,
                  shift: String(memberRecord.shift ?? 'Theo phân công'),
                  status: String(memberRecord.status ?? 'Đang làm')
                };
              })
              .filter((member): member is HrMember => Boolean(member))
          };
        })
        .filter((department): department is HrDepartment => Boolean(department));

      return {
        id: String(record.id ?? record.name ?? ''),
        name: String(record.name ?? 'Chưa phân chi nhánh'),
        shortName: String(record.shortName ?? record.name ?? 'Chi nhánh'),
        departments: normalizedDepartments
      };
    })
    .filter((branch): branch is HrBranch => Boolean(branch));
}

interface ProductRow {
  id: string;
  code: string;
  newCode: string;
  name: string;
  nature: string;
  group: string;
  unit: string;
  openingStock: string;
  inbound: string;
  outbound: string;
  stock: string;
  minStock: string;
  origin: string;
  description: string;
  nplItems: ProductNplItem[];
}

type ProductNplAmountType = 'percent' | 'quantity';

interface ProductNplItem {
  code: string;
  name: string;
  amountType: ProductNplAmountType;
  percent: number | null;
  quantity: number | null;
  unit: string;
}

interface MaterialOption {
  code: string;
  name: string;
  unit: string;
}

function roundNplNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function resolveProductNplAmountType(record: Record<string, unknown>): ProductNplAmountType {
  const loai = String(record.loai ?? record.amountType ?? record.dinh_luong_loai ?? '').trim().toLowerCase();
  if (loai === 'so_luong' || loai === 'quantity') return 'quantity';
  if (loai === 'phan_tram' || loai === 'percent') return 'percent';

  const quantityRaw = record.so_luong ?? record.quantity;
  const percentRaw = record.phan_tram ?? record.percent ?? record.ty_le;
  const quantity = parsePercentInput(String(quantityRaw ?? ''));
  const percent = parsePercentInput(String(percentRaw ?? ''));

  if (quantityRaw !== undefined && quantityRaw !== null && quantityRaw !== '' && (percentRaw === undefined || percentRaw === null || percentRaw === '')) {
    return 'quantity';
  }

  if (Number.isFinite(quantity) && !Number.isFinite(percent)) return 'quantity';
  return 'percent';
}

function productNplAmountTypeLabel(type: ProductNplAmountType) {
  return type === 'quantity' ? 'Số lượng' : 'Phần trăm';
}

function formatProductNplAmount(item: ProductNplItem) {
  if (item.amountType === 'quantity') {
    const unitSuffix = item.unit && item.unit !== '-' ? ` ${item.unit}` : '';
    return `${formatNumber(item.quantity ?? 0, 2)}${unitSuffix}`;
  }
  return `${formatPercent(item.percent ?? 0)}%`;
}

function parseProductNplItems(raw: unknown): ProductNplItem[] {
  let source = raw;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      source = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }

  const list = Array.isArray(source)
    ? source
    : source && typeof source === 'object' && Array.isArray((source as { items?: unknown }).items)
      ? (source as { items: unknown[] }).items
      : [];

  return list
    .map((entry): ProductNplItem | null => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const code = String(record.ma_npl ?? record.code ?? record.ma ?? '').trim();
      const name = String(record.ten_npl ?? record.name ?? record.ten ?? '').trim();
      const unit = String(record.don_vi ?? record.unit ?? '').trim() || '-';
      const amountType = resolveProductNplAmountType(record);

      if (!code) return null;

      if (amountType === 'quantity') {
        const quantity = Number(record.so_luong ?? record.quantity);
        if (!Number.isFinite(quantity) || quantity < 0) return null;
        return {
          code,
          name,
          amountType: 'quantity',
          percent: null,
          quantity: roundNplNumber(quantity),
          unit
        };
      }

      const percent = Number(record.phan_tram ?? record.percent ?? record.ty_le);
      if (!Number.isFinite(percent)) return null;
      return {
        code,
        name,
        amountType: 'percent',
        percent: roundNplNumber(percent),
        quantity: null,
        unit
      };
    })
    .filter((item): item is ProductNplItem => Boolean(item));
}

function formatProductNplSummary(items: ProductNplItem[]) {
  if (items.length === 0) return '-';
  return items.map(item => `${item.code} ${formatProductNplAmount(item)}`).join(' · ');
}

function productNplItemsToJson(items: ProductNplItem[]) {
  return items.map(item => {
    const base = {
      ma_npl: item.code,
      ten_npl: item.name,
      loai: item.amountType === 'quantity' ? 'so_luong' : 'phan_tram',
      don_vi: item.unit && item.unit !== '-' ? item.unit : null
    };

    if (item.amountType === 'quantity') {
      return {
        ...base,
        so_luong: item.quantity,
        phan_tram: null
      };
    }

    return {
      ...base,
      phan_tram: item.percent,
      so_luong: null
    };
  });
}

const productFieldClass =
  'h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

function BackButton({
  onClick,
  variant = 'light',
  className = ''
}: {
  onClick: () => void;
  variant?: 'light' | 'dark';
  className?: string;
}) {
  const styles =
    variant === 'dark'
      ? 'border-white/15 text-white hover:border-[#ef1b2d] hover:bg-[#ef1b2d]'
      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border px-3 text-xs font-bold transition ${styles} ${className}`}
    >
      <ChevronLeft className="h-4 w-4" />
      Quay lại
    </button>
  );
}

type ProductViewTab = 'info' | 'components';

function ProductNplItemFormModal({
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

function ProductViewModal({
  product,
  initialTab = 'info',
  materialOptions,
  isLoadingMaterials,
  isSaving,
  onClose,
  onSaveItems
}: {
  product: ProductRow;
  initialTab?: ProductViewTab;
  materialOptions: MaterialOption[];
  isLoadingMaterials: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSaveItems: (items: ProductNplItem[]) => Promise<void>;
}) {
  const [tab, setTab] = useState<ProductViewTab>(initialTab);
  const [items, setItems] = useState<ProductNplItem[]>(product.nplItems);
  const [detailItem, setDetailItem] = useState<ProductNplItem | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [formIndex, setFormIndex] = useState<number | null>(null);

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

  const infoRows: Array<[string, string]> = [
    ['Mã SP', product.code || '-'],
    ['Mã mới', product.newCode || '-'],
    ['Tên sản phẩm', product.name || '-'],
    ['Tính chất', product.nature],
    ['Nhóm VTHH', product.group],
    ['Đơn vị', product.unit],
    ['Tồn đầu', product.openingStock],
    ['Nhập', product.inbound],
    ['Xuất', product.outbound],
    ['Tồn kho', product.stock],
    ['Tồn tối thiểu', product.minStock],
    ['Nguồn gốc', product.origin],
    ['Mô tả', product.description || '-']
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-red-500">Xem sản phẩm</p>
            <h3 className="mt-1 text-lg font-black text-zinc-950">{product.name || product.code}</h3>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">{product.code}{product.newCode ? ` · ${product.newCode}` : ''}</p>
          </div>
          <BackButton onClick={onClose} />
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
            <div className="grid grid-cols-2 gap-3">
              {infoRows.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="mt-1 text-sm font-bold text-zinc-900">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-zinc-950">Bảng thành phần NVL</p>
                  <p className="mt-0.5 text-xs font-semibold text-zinc-500">Nguyên vật liệu · phần trăm hoặc số lượng</p>
                </div>
                <div className="flex items-center gap-2">
                  {percentItemCount > 0 && (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${Math.abs(totalPercent - 100) < 0.01 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                      Tổng %: {formatPercent(totalPercent)}%
                    </span>
                  )}
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

              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-4 py-3 font-black">STT</th>
                      <th className="px-4 py-3 font-black">Mã NPL</th>
                      <th className="px-4 py-3 font-black">Tên NVL</th>
                      <th className="px-4 py-3 font-black">Loại</th>
                      <th className="px-4 py-3 font-black">Giá trị</th>
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
                        <td className="px-4 py-3 font-bold text-zinc-700">
                          {item.amountType === 'quantity' ? item.unit || '-' : '-'}
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
                        <td colSpan={7} className="px-4 py-8 text-center font-bold text-zinc-400">
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
                ['Đơn vị', detailItem.amountType === 'quantity' ? detailItem.unit || '-' : '-'],
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

function normalizeProducts(data: unknown): ProductRow[] {
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
        name,
        nature: String(record.tinh_chat ?? '').trim() || 'Chưa phân loại',
        group: String(record.nhom_vthh ?? '').trim() || 'Chưa nhóm',
        unit: String(record.don_vi ?? '').trim() || '-',
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
        nplItems: parseProductNplItems(record.npl_phan_tram)
      };
    })
    .filter((product): product is ProductRow => Boolean(product));
}

type ProductFormState = {
  code: string;
  newCode: string;
  name: string;
  nature: string;
  group: string;
  unit: string;
  openingStock: string;
  inbound: string;
  outbound: string;
  stock: string;
  minStock: string;
  origin: string;
  description: string;
};

function productCellToInput(value: string) {
  return value === '-' ? '' : value;
}

function productToForm(product: ProductRow): ProductFormState {
  return {
    code: productCellToInput(product.code),
    newCode: productCellToInput(product.newCode),
    name: productCellToInput(product.name),
    nature: productCellToInput(product.nature),
    group: productCellToInput(product.group),
    unit: productCellToInput(product.unit),
    openingStock: productCellToInput(product.openingStock),
    inbound: productCellToInput(product.inbound),
    outbound: productCellToInput(product.outbound),
    stock: productCellToInput(product.stock),
    minStock: productCellToInput(product.minStock),
    origin: productCellToInput(product.origin),
    description: productCellToInput(product.description)
  };
}

function ProductEditModal({
  product,
  isSaving,
  formError,
  onClose,
  onSave
}: {
  product: ProductRow;
  isSaving: boolean;
  formError: string;
  onClose: () => void;
  onSave: (form: ProductFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<ProductFormState>(() => productToForm(product));

  useEffect(() => {
    setForm(productToForm(product));
  }, [product.id]);

  const fields: Array<{ key: keyof ProductFormState; label: string; required?: boolean }> = [
    { key: 'code', label: 'Mã SP', required: true },
    { key: 'newCode', label: 'Mã mới' },
    { key: 'name', label: 'Tên sản phẩm', required: true },
    { key: 'nature', label: 'Tính chất' },
    { key: 'group', label: 'Nhóm VTHH' },
    { key: 'unit', label: 'Đơn vị' },
    { key: 'openingStock', label: 'Tồn đầu' },
    { key: 'inbound', label: 'Nhập' },
    { key: 'outbound', label: 'Xuất' },
    { key: 'stock', label: 'Tồn kho' },
    { key: 'minStock', label: 'Tồn tối thiểu' },
    { key: 'origin', label: 'Nguồn gốc' },
    { key: 'description', label: 'Mô tả' }
  ];

  const handleSave = async () => {
    await onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Sửa sản phẩm</h3>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">{product.code}</p>
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
            <label key={field.key} className={`block space-y-1.5 ${field.key === 'description' ? 'sm:col-span-2' : ''}`}>
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
            {isSaving ? 'Đang lưu...' : 'Cập nhật'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductsPanel({ onBack }: { onBack: () => void }) {
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
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState('');
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

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
      setMaterialOptions(
        materials.map(material => ({
          code: material.code,
          name: material.name,
          unit: material.unit && material.unit !== '-' ? material.unit : ''
        }))
      );
    } catch {
      setMaterialOptions([]);
    } finally {
      setIsLoadingMaterialOptions(false);
    }
  };

  const openProductView = (product: ProductRow, tab: ProductViewTab = 'info') => {
    setProductActionMessage('');
    setProductError('');
    setProductFormError('');
    setEditingProduct(null);
    setViewingProduct(product);
    setProductViewTab(tab);
    if (materialOptions.length === 0) {
      loadMaterialOptions();
    }
  };

  const openProductEdit = (product: ProductRow) => {
    setProductActionMessage('');
    setProductError('');
    setProductFormError('');
    setViewingProduct(null);
    setEditingProduct(product);
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
        body: JSON.stringify({
          code: form.code.trim(),
          newCode: form.newCode.trim(),
          name: form.name.trim(),
          nature: form.nature.trim(),
          group: form.group.trim(),
          unit: form.unit.trim(),
          openingStock: form.openingStock.trim(),
          inbound: form.inbound.trim(),
          outbound: form.outbound.trim(),
          stock: form.stock.trim(),
          minStock: form.minStock.trim(),
          origin: form.origin.trim(),
          description: form.description.trim()
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể cập nhật sản phẩm.');
      }

      setEditingProduct(null);
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
      if (editingProduct?.id === product.id) setEditingProduct(null);
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
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Danh mục sản phẩm</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Sản phẩm</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase san_pham.
              </p>
            </div>
            <BackButton onClick={onBack} variant="dark" className="h-10 rounded-xl" />
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
            Đã chọn {selectedProducts.length} dòng. In QR hoặc xóa các sản phẩm đã tick.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
          <table className="w-full min-w-[1320px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[56px]" />
              <col className="w-[155px]" />
              <col className="w-[110px]" />
              <col className="w-[34%]" />
              <col className="w-[155px]" />
              <col className="w-[100px]" />
              <col className="w-[92px]" />
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
                <th className="px-3 py-4 text-center font-black">Tồn đầu</th>
                <th className="px-3 py-4 text-center font-black">Nhập</th>
                <th className="px-3 py-4 text-center font-black">Xuất</th>
                <th className="px-3 py-4 text-center font-black">Tồn</th>
                <th className="px-3 py-4 text-center font-black">Tồn tối thiểu</th>
                <th className="px-3 py-4 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredProducts.map(product => (
                <tr key={`${product.code}-${product.name}`} className="align-middle transition hover:bg-red-50/40">
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
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-zinc-700">{product.openingStock}</td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-zinc-700">{product.inbound}</td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-zinc-700">{product.outbound}</td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-zinc-700">{product.stock}</td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-zinc-700">{product.minStock}</td>
                  <td className="px-3 py-3.5">
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
                  <td colSpan={13} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Không có sản phẩm phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          isSaving={isSavingProduct}
          formError={productFormError}
          onClose={() => {
            setEditingProduct(null);
            setProductFormError('');
          }}
          onSave={handleSaveProduct}
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

interface MachineRow {
  id: string;
  code: string;
  name: string;
  type: string;
  branch: string;
  location: string;
  status: string;
  note: string;
  imageUrl?: string;
  imagePublicId?: string;
}

function pickText(record: Record<string, unknown>, keys: string[], fallback = '-') {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return fallback;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadImage(imageDataUrl: string) {
  const res = await fetch('/api/cloudinary/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl })
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Không thể upload ảnh.');
  }

  return {
    imageUrl: String(data.url ?? data.imageUrl ?? ''),
    imagePublicId: String(data.publicId ?? data.imagePublicId ?? '')
  };
}

function normalizeMachines(data: unknown): MachineRow[] {
  if (!data || typeof data !== 'object') return [];
  const machines = (data as { machines?: unknown }).machines;
  if (!Array.isArray(machines)) return [];

  return machines
    .map((item): MachineRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = pickText(record, ['ma_may', 'ma_so_may', 'machine_code', 'code', 'id'], '');
      const name = pickText(record, ['ten_may', 'may', 'machine_name', 'name'], '');
      if (!code && !name) return null;

      return {
        id: pickText(record, ['id'], code || name),
        code,
        name,
        type: pickText(record, ['loai_may', 'nhom_may', 'type', 'category'], 'Chưa phân loại'),
        branch: pickText(record, ['chi_nhanh', 'co_so', 'branch'], '-'),
        location: pickText(record, ['vi_tri', 'khu_vuc', 'location', 'line'], '-'),
        status: pickText(record, ['trang_thai', 'status', 'tinh_trang'], 'Đang dùng'),
        note: pickText(record, ['ghi_chu', 'mo_ta', 'note', 'description'], ''),
        imageUrl: pickText(record, ['anh_url', 'hinh_anh_url', 'image_url', 'imageUrl'], ''),
        imagePublicId: pickText(record, ['anh_public_id', 'image_public_id', 'imagePublicId'], '')
      };
    })
    .filter((machine): machine is MachineRow => Boolean(machine));
}

type MachineFormState = {
  code: string;
  name: string;
  type: string;
  branch: string;
  location: string;
  status: string;
  note: string;
};

const emptyMachineForm = (): MachineFormState => ({
  code: '',
  name: '',
  type: '',
  branch: 'Đà Nẵng',
  location: '',
  status: 'Đang dùng',
  note: ''
});

function machineCellToInput(value: string) {
  return value === '-' ? '' : value;
}

function machineToForm(machine: MachineRow): MachineFormState {
  return {
    code: machineCellToInput(machine.code),
    name: machineCellToInput(machine.name),
    type: machineCellToInput(machine.type === 'Chưa phân loại' ? '' : machine.type),
    branch: machineCellToInput(machine.branch),
    location: machineCellToInput(machine.location),
    status: machineCellToInput(machine.status) || 'Đang dùng',
    note: machineCellToInput(machine.note)
  };
}

const machineFieldClass =
  'h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

function MachinesPanel({ onBack }: { onBack: () => void }) {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [isLoadingMachines, setIsLoadingMachines] = useState(true);
  const [machineError, setMachineError] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingMachineId, setDeletingMachineId] = useState<string | null>(null);
  const [isSavingMachine, setIsSavingMachine] = useState(false);
  const [uploadingMachineIds, setUploadingMachineIds] = useState<Set<string>>(() => new Set());
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [machineForm, setMachineForm] = useState<MachineFormState>(emptyMachineForm);
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState('');
  const [isUploadingFormImage, setIsUploadingFormImage] = useState(false);

  const resetFormImage = () => {
    setFormImageFile(null);
    setFormImagePreview('');
  };

  const saveMachineImage = async (machineId: string, file: File) => {
    const uploaded = await uploadImage(await fileToDataUrl(file));
    const res = await fetch(`/api/danh-sach-may/${encodeURIComponent(machineId)}/image`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uploaded)
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Không thể lưu ảnh cho máy.');
    }

    return uploaded;
  };

  const loadMachines = async () => {
    setIsLoadingMachines(true);
    setMachineError('');

    try {
      const res = await fetch('/api/danh-sach-may');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải danh sách máy từ Supabase.');
      }

      setMachines(normalizeMachines(data));
    } catch (error: any) {
      setMachines([]);
      setMachineError(error.message || 'Không thể tải danh sách máy từ Supabase.');
    } finally {
      setIsLoadingMachines(false);
    }
  };

  useEffect(() => {
    loadMachines();
  }, []);

  const openAddForm = () => {
    setFormError('');
    setActionMessage('');
    setEditingId(null);
    setMachineForm(emptyMachineForm());
    resetFormImage();
    setFormMode('add');
  };

  const openEditForm = (machine: MachineRow) => {
    setFormError('');
    setActionMessage('');
    setEditingId(machine.id);
    setMachineForm(machineToForm(machine));
    setFormImageFile(null);
    setFormImagePreview(machine.imageUrl || '');
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormError('');
    resetFormImage();
  };

  const handleFormImageChange = (file?: File | null) => {
    if (!file) return;
    setFormImageFile(file);
    setFormImagePreview(URL.createObjectURL(file));
  };

  const handleSaveMachine = async () => {
    if (!machineForm.code.trim() || !machineForm.name.trim()) {
      setFormError('Vui lòng nhập mã máy và tên máy.');
      return;
    }

    setIsSavingMachine(true);
    setFormError('');

    try {
      const isEdit = formMode === 'edit' && editingId;
      const res = await fetch(isEdit ? `/api/danh-sach-may/${editingId}` : '/api/danh-sach-may', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(machineForm)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || (isEdit ? 'Không thể cập nhật máy.' : 'Không thể thêm máy mới.'));
      }

      const savedId = isEdit
        ? String(editingId)
        : String((data.machine as { id?: string | number } | undefined)?.id ?? '');

      if (formImageFile && savedId) {
        setIsUploadingFormImage(true);
        try {
          await saveMachineImage(savedId, formImageFile);
        } catch (error: any) {
          closeForm();
          setMachineError(error.message || 'Đã lưu máy nhưng không thể tải ảnh.');
          await loadMachines();
          return;
        } finally {
          setIsUploadingFormImage(false);
        }
      }

      closeForm();
      setActionMessage(
        formImageFile
          ? isEdit
            ? 'Đã cập nhật máy và tải ảnh.'
            : 'Đã thêm máy mới và tải ảnh.'
          : isEdit
            ? 'Đã cập nhật máy.'
            : 'Đã thêm máy mới.'
      );
      await loadMachines();
    } catch (error: any) {
      setFormError(error.message || 'Không thể lưu máy.');
    } finally {
      setIsSavingMachine(false);
    }
  };

  const handleDeleteMachine = async (machine: MachineRow) => {
    if (!machine.id) {
      setMachineError('Không tìm thấy ID để xóa.');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa máy "${machine.code || machine.name}"?`)) return;

    setDeletingMachineId(machine.id);
    setActionMessage('');

    try {
      const res = await fetch(`/api/danh-sach-may/${machine.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa máy.');
      }

      setActionMessage('Đã xóa máy.');
      await loadMachines();
    } catch (error: any) {
      setMachineError(error.message || 'Không thể xóa máy.');
    } finally {
      setDeletingMachineId(null);
    }
  };

  const handleMachineImageUpload = async (machine: MachineRow, file?: File | null) => {
    if (!file) return;

    setMachineError('');
    setUploadingMachineIds(prev => {
      const next = new Set(prev);
      next.add(machine.id);
      return next;
    });

    try {
      const uploaded = await saveMachineImage(machine.id, file);

      setMachines(prev =>
        prev.map(item =>
          item.id === machine.id
            ? {
                ...item,
                imageUrl: uploaded.imageUrl,
                imagePublicId: uploaded.imagePublicId
              }
            : item
        )
      );
      setActionMessage(`Đã tải ảnh cho máy ${machine.code || machine.name}.`);
    } catch (error: any) {
      setMachineError(error.message || 'Không thể upload ảnh cho máy.');
    } finally {
      setUploadingMachineIds(prev => {
        const next = new Set(prev);
        next.delete(machine.id);
        return next;
      });
    }
  };

  const machineTypes = useMemo(
    () => ['all', ...Array.from(new Set(machines.map(machine => machine.type))).sort((a, b) => a.localeCompare(b, 'vi'))],
    [machines]
  );
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredMachines = useMemo(() => {
    return machines.filter(machine => {
      const matchesType = selectedType === 'all' || machine.type === selectedType;
      const matchesSearch =
        !normalizedSearch ||
        `${machine.code} ${machine.name} ${machine.type} ${machine.branch} ${machine.location} ${machine.status}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesType && matchesSearch;
    });
  }, [machines, normalizedSearch, selectedType]);

  const branchCount = new Set(machines.map(machine => machine.branch).filter(branch => branch && branch !== '-')).size;
  const activeCount = machines.filter(machine => /đang|hoạt|active|dung|dùng/i.test(machine.status)).length;

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Thiết bị sản xuất</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Danh sách máy</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase danh_sach_may.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={openAddForm}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>
              <button
                type="button"
                onClick={onBack}
                className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:border-[#ef1b2d] hover:bg-[#ef1b2d]"
              >
                Menu
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Máy', machines.length],
              ['Đang dùng', activeCount],
              ['Chi nhánh', branchCount]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="block font-bold text-zinc-400">{label}</span>
                <span className="mt-1 block text-xl font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {formMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  {formMode === 'edit' ? 'Sửa máy' : 'Thêm máy mới'}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">Ghi vào bảng danh_sach_may trên Supabase</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã máy *</span>
                <input
                  value={machineForm.code}
                  onChange={e => setMachineForm(prev => ({ ...prev, code: e.target.value }))}
                  className={machineFieldClass}
                  placeholder="VD: MAY-01"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tên máy *</span>
                <input
                  value={machineForm.name}
                  onChange={e => setMachineForm(prev => ({ ...prev, name: e.target.value }))}
                  className={machineFieldClass}
                  placeholder="VD: Máy đùn PE 01"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Loại/Nhóm</span>
                <input
                  value={machineForm.type}
                  onChange={e => setMachineForm(prev => ({ ...prev, type: e.target.value }))}
                  className={machineFieldClass}
                  placeholder="VD: Đùn PE"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Chi nhánh</span>
                <input
                  value={machineForm.branch}
                  onChange={e => setMachineForm(prev => ({ ...prev, branch: e.target.value }))}
                  className={machineFieldClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Vị trí</span>
                <input
                  value={machineForm.location}
                  onChange={e => setMachineForm(prev => ({ ...prev, location: e.target.value }))}
                  className={machineFieldClass}
                  placeholder="VD: Khu A"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Trạng thái</span>
                <SearchableSelect
                  value={machineForm.status}
                  onChange={status => setMachineForm(prev => ({ ...prev, status }))}
                  options={['Đang dùng', 'Bảo trì', 'Ngừng']}
                  placeholder="Gõ để tìm trạng thái"
                  inputClassName={machineFieldClass}
                  getLabel={item => String(item)}
                  getValue={item => String(item)}
                  allowEmpty={false}
                />
              </label>
              <label className="col-span-2 space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
                <input
                  value={machineForm.note}
                  onChange={e => setMachineForm(prev => ({ ...prev, note: e.target.value }))}
                  className={machineFieldClass}
                />
              </label>

              <div className="col-span-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Hình ảnh máy</p>
                <p className="mt-1 text-[11px] font-semibold text-zinc-500">
                  Chọn ảnh để upload lên Cloudinary và lưu vào cột anh_url trên Supabase.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {formImagePreview ? (
                    <a
                      href={formImagePreview}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-24 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white"
                    >
                      <img
                        src={formImagePreview}
                        alt="Xem trước ảnh máy"
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ) : (
                    <div className="flex h-24 w-36 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Chưa chọn ảnh
                    </div>
                  )}

                  <label className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-black text-zinc-700 transition hover:border-[#ef1b2d] hover:text-[#ef1b2d]">
                    <ImagePlus className="h-4 w-4" />
                    {formImageFile ? 'Đổi ảnh' : formImagePreview ? 'Chọn ảnh khác' : 'Chọn ảnh'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        handleFormImageChange(file);
                      }}
                    />
                  </label>

                  {formImageFile && (
                    <p className="text-xs font-semibold text-zinc-600">{formImageFile.name}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              {formError && (
                <p className="mr-auto text-xs font-bold text-rose-600">{formError}</p>
              )}
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveMachine}
                disabled={isSavingMachine || isUploadingFormImage}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingMachine || isUploadingFormImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSavingMachine || isUploadingFormImage
                  ? isUploadingFormImage
                    ? 'Đang tải ảnh...'
                    : 'Đang lưu...'
                  : formMode === 'edit'
                    ? 'Cập nhật'
                    : 'Lưu máy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {machineTypes.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedType === type
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {type === 'all' ? 'Tất cả' : type}
            </button>
          ))}
          {isLoadingMachines && (
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
            placeholder="Tìm mã máy, tên máy, vị trí..."
            disabled={isLoadingMachines}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {machineError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {machineError}
          </p>
        )}

        {actionMessage && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 lg:mt-0">
            {actionMessage}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã máy</th>
                <th className="px-4 py-3 font-black">Tên máy</th>
                <th className="px-4 py-3 font-black">Hình ảnh</th>
                <th className="px-4 py-3 font-black">Loại/Nhóm</th>
                <th className="px-4 py-3 font-black">Chi nhánh</th>
                <th className="px-4 py-3 font-black">Vị trí</th>
                <th className="px-4 py-3 font-black">Trạng thái</th>
                <th className="px-4 py-3 font-black">Ghi chú</th>
                <th className="px-4 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredMachines.map(machine => (
                <tr key={machine.id} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{machine.code || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-black text-zinc-950">
                      <Cpu className="h-4 w-4 text-[#ef1b2d]" />
                      {machine.name || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[220px] flex-col gap-2">
                      <div className="flex items-center gap-3">
                        {machine.imageUrl ? (
                          <a
                            href={machine.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
                          >
                            <img src={machine.imageUrl} alt={`Ảnh ${machine.name || machine.code}`} className="h-full w-full object-cover" />
                          </a>
                        ) : (
                          <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Chưa có
                          </div>
                        )}

                        <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-black text-zinc-700 transition hover:border-[#ef1b2d] hover:text-[#ef1b2d]">
                          {uploadingMachineIds.has(machine.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImagePlus className="h-4 w-4" />
                          )}
                          {uploadingMachineIds.has(machine.id) ? 'Đang tải' : machine.imageUrl ? 'Đổi ảnh' : 'Tải ảnh'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingMachineIds.has(machine.id)}
                            onChange={event => {
                              const file = event.target.files?.[0];
                              event.target.value = '';
                              handleMachineImageUpload(machine, file);
                            }}
                          />
                        </label>
                      </div>
                      <p className="text-[10px] font-semibold text-zinc-400">JPG, PNG · lưu Cloudinary</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-zinc-700">{machine.type}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{machine.branch}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{machine.location}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#ef1b2d]/20 bg-red-50 px-2.5 py-1 text-xs font-black text-[#ef1b2d]">
                      {machine.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-500">{machine.note || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(machine)}
                        title="Sửa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMachine(machine)}
                        disabled={deletingMachineId === machine.id}
                        title="Xóa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingMachineId === machine.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoadingMachines && filteredMachines.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Bảng danh_sach_may chưa có dữ liệu hoặc không có máy phù hợp bộ lọc.
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

interface MaterialRow {
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

function formatCell(value: unknown) {
  return value === null || value === undefined || String(value).trim() === '' ? '-' : String(value);
}

function parseInventoryNumber(value: string): number | null {
  if (!value || value === '-') return null;
  const normalized = String(value).trim().replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function computeClosingStock(opening: string, inbound: string, outbound: string): string {
  const openingVal = parseInventoryNumber(opening);
  if (openingVal === null) return '-';
  const inboundVal = parseInventoryNumber(inbound) ?? 0;
  const outboundVal = parseInventoryNumber(outbound) ?? 0;
  return String(Math.round((openingVal + inboundVal - outboundVal) * 100) / 100);
}

function normalizeMaterialsInventory(data: unknown): MaterialRow[] {
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

      return {
        id: String(record.id ?? '').trim() || code || name,
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

type MaterialFormState = {
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

function materialCellToInput(value: string) {
  return value === '-' ? '' : value;
}

function materialToForm(material: MaterialRow): MaterialFormState {
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

const materialFieldClass =
  'h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

interface MaterialMovementRow {
  slipCode: string;
  slipType: 'nhap' | 'xuat';
  slipDate: string;
  quantity: number;
}

function parseMaterialMovements(data: unknown): MaterialMovementRow[] {
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

function sumMaterialMovementQuantity(rows: MaterialMovementRow[], slipType: 'nhap' | 'xuat') {
  return rows
    .filter(row => row.slipType === slipType)
    .reduce((sum, row) => sum + row.quantity, 0);
}

type MaterialViewTab = 'info' | 'nvl-info' | 'history';

function MaterialViewModal({
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

function MaterialsInventoryPanel({ onBack }: { onBack: () => void }) {
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

  const totalPlasticWeight = materials.reduce((sum, material) => {
    const value = Number(material.plasticWeight);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

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
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Quản lý kho</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Kho NVL</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Nguyên phụ liệu · dữ liệu từ bảng Supabase kho_nvl.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={openAddForm}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>
              <button
                type="button"
                onClick={onBack}
                className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:border-[#ef1b2d] hover:bg-[#ef1b2d]"
              >
                Menu
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Mã NVL', materials.length],
              ['Đơn vị', units.length > 0 ? units.length - 1 : 0],
              ['Kg nhựa', formatNumber(totalPlasticWeight)]
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

        <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 lg:mt-0 lg:w-[420px]">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Tìm mã NVL, tên nguyên phụ liệu..."
            disabled={isLoadingMaterials || materials.length === 0}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

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

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã NPL</th>
                <th className="px-4 py-3 font-black">Tên nguyên phụ liệu</th>
                <th className="px-4 py-3 font-black">Đơn vị</th>
                <th className="px-4 py-3 font-black">Tồn đầu</th>
                <th className="px-4 py-3 font-black">Nhập</th>
                <th className="px-4 py-3 font-black">Xuất</th>
                <th className="px-4 py-3 font-black">Tồn cuối</th>
                <th className="px-4 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredMaterials.map(material => (
                <tr key={material.id} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{material.code || '-'}</td>
                  <td className="px-4 py-3 font-black text-zinc-950">{material.name || '-'}</td>
                  <td className="px-4 py-3 font-bold text-zinc-700">{material.unit}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.openingStock}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.inbound}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.outbound}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">
                    {computeClosingStock(material.openingStock, material.inbound, material.outbound)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingMaterial(material)}
                        title="Xem"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(material)}
                        title="Sửa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMaterial(material)}
                        disabled={deletingMaterialId === material.id}
                        title="Xóa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <td colSpan={8} className="px-4 py-8 text-center font-bold text-zinc-500">
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

type WarehouseSlipType = 'nhap' | 'xuat';
type WarehouseKind = 'nvl' | 'san_pham';

interface WarehouseMovementRow {
  id: string;
  slipCode: string;
  slipType: WarehouseSlipType;
  warehouseKind: WarehouseKind;
  slipDate: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  reason: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

interface WarehouseSlipLineDraft {
  key: string;
  code: string;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

const warehouseFieldClass =
  'h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

function warehouseSlipTypeLabel(type: WarehouseSlipType) {
  return type === 'nhap' ? 'Nhập kho' : 'Xuất kho';
}

function warehouseKindLabel(kind: WarehouseKind) {
  return kind === 'san_pham' ? 'Kho Sản phẩm' : 'Kho NVL';
}

function warehouseItemCodeLabel(kind: WarehouseKind) {
  return kind === 'san_pham' ? 'Mã SP' : 'Mã NPL';
}

function warehouseItemNameLabel(kind: WarehouseKind) {
  return kind === 'san_pham' ? 'Tên SP' : 'Tên NVL';
}

function computeWarehouseLineAmount(quantityText: string, unitPriceText: string): number {
  const quantity = parsePercentInput(quantityText);
  const unitPrice = parseMoneyInput(unitPriceText);
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return 0;
  return Math.round(quantity * unitPrice * 100) / 100;
}

function formatWarehouseMoney(value: number) {
  return formatMoney(value, 0);
}

function createWarehouseLineDraft(): WarehouseSlipLineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: '',
    name: '',
    unit: '',
    quantity: '',
    unitPrice: ''
  };
}

function normalizeWarehouseMovements(data: unknown): WarehouseMovementRow[] {
  const list = data && typeof data === 'object' && Array.isArray((data as { movements?: unknown }).movements)
    ? (data as { movements: unknown[] }).movements
    : Array.isArray(data)
      ? data
      : [];

  return list
    .map((entry): WarehouseMovementRow | null => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const slipTypeRaw = String(record.loai_phieu ?? record.slipType ?? '').trim().toLowerCase();
      const slipType: WarehouseSlipType = slipTypeRaw === 'xuat' ? 'xuat' : 'nhap';
      const warehouseKindRaw = String(record.loai_kho ?? record.warehouseKind ?? 'nvl').trim().toLowerCase();
      const warehouseKind: WarehouseKind = warehouseKindRaw === 'san_pham' ? 'san_pham' : 'nvl';
      const quantity = Number(record.so_luong ?? record.quantity);
      const unitPrice = Number(record.don_gia ?? record.unitPrice ?? record.price ?? 0);
      const lineAmountRaw = Number(record.thanh_tien ?? record.lineAmount ?? record.amount);
      const lineAmount = Number.isFinite(lineAmountRaw)
        ? lineAmountRaw
        : Number.isFinite(quantity) && Number.isFinite(unitPrice)
          ? Math.round(quantity * unitPrice * 100) / 100
          : 0;
      const itemCode =
        warehouseKind === 'san_pham'
          ? String(record.ma_sp ?? record.productCode ?? record.itemCode ?? '').trim()
          : String(record.ma_npl ?? record.materialCode ?? record.itemCode ?? '').trim();
      const itemName =
        warehouseKind === 'san_pham'
          ? String(record.ten_sp ?? record.productName ?? record.itemName ?? '').trim()
          : String(record.ten_npl ?? record.materialName ?? record.itemName ?? '').trim();

      return {
        id: String(record.id ?? '').trim(),
        slipCode: String(record.ma_phieu ?? record.slipCode ?? '').trim(),
        slipType,
        warehouseKind,
        slipDate: String(record.ngay_phieu ?? record.slipDate ?? '').trim(),
        itemCode,
        itemName,
        unit: String(record.don_vi ?? record.unit ?? '').trim() || '-',
        quantity: Number.isFinite(quantity) ? quantity : 0,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        lineAmount: Number.isFinite(lineAmount) ? lineAmount : 0,
        reason: String(record.ly_do ?? record.reason ?? '').trim(),
        note: String(record.ghi_chu ?? record.note ?? '').trim(),
        createdBy: String(record.nguoi_lap ?? record.nhan_su ?? record.createdBy ?? '').trim(),
        createdAt: String(record.created_at ?? record.createdAt ?? '').trim()
      };
    })
    .filter((row): row is WarehouseMovementRow => Boolean(row.id || row.slipCode));
}

function WarehouseSlipPanel({
  onBack,
  onOpenHistory
}: {
  onBack: () => void;
  onOpenHistory: () => void;
}) {
  const [warehouseKind, setWarehouseKind] = useState<WarehouseKind>('nvl');
  const [slipType, setSlipType] = useState<WarehouseSlipType>('nhap');
  const [slipDate, setSlipDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [lines, setLines] = useState<WarehouseSlipLineDraft[]>(() => [createWarehouseLineDraft()]);
  const [itemOptions, setItemOptions] = useState<MaterialOption[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    const loadItems = async () => {
      setIsLoadingItems(true);
      try {
        if (warehouseKind === 'san_pham') {
          const res = await fetch('/api/san-pham?format=table');
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Không thể tải danh sách sản phẩm.');
          const products = normalizeProducts(data);
          setItemOptions(
            products.map(product => ({
              code: product.code,
              name: product.name,
              unit: product.unit && product.unit !== '-' ? product.unit : ''
            }))
          );
        } else {
          const res = await fetch('/api/kho-nvl');
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Không thể tải kho NVL.');
          const materials = normalizeMaterialsInventory(data);
          setItemOptions(
            materials.map(material => ({
              code: material.code,
              name: material.name,
              unit: material.unit && material.unit !== '-' ? material.unit : ''
            }))
          );
        }
      } catch {
        setItemOptions([]);
      } finally {
        setIsLoadingItems(false);
      }
    };

    loadItems();
  }, [warehouseKind]);

  const handleWarehouseKindChange = (kind: WarehouseKind) => {
    setWarehouseKind(kind);
    setLines([createWarehouseLineDraft()]);
    setFormError('');
    setActionMessage('');
  };

  const updateLine = (key: string, patch: Partial<WarehouseSlipLineDraft>) => {
    setLines(current => current.map(line => (line.key === key ? { ...line, ...patch } : line)));
  };

  const pickItem = (key: string, code: string) => {
    const item = itemOptions.find(option => option.code === code);
    updateLine(key, {
      code,
      name: item?.name || '',
      unit: item?.unit || ''
    });
  };

  const slipTotal = useMemo(
    () => lines.reduce((sum, line) => sum + computeWarehouseLineAmount(line.quantity, line.unitPrice), 0),
    [lines]
  );

  const handleSave = async () => {
    const itemLabel = warehouseKind === 'san_pham' ? 'sản phẩm' : 'NVL';
    const codeLabel = warehouseItemCodeLabel(warehouseKind);

    const payloadItems = lines
      .map(line => {
        const quantity = parsePercentInput(line.quantity);
        const unitPrice = parseMoneyInput(line.unitPrice);
        return {
          code: line.code.trim(),
          name: line.name.trim(),
          unit: line.unit.trim(),
          quantity,
          unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0
        };
      })
      .filter(line => line.code || line.quantity);

    if (payloadItems.length === 0) {
      setFormError(`Vui lòng thêm ít nhất một dòng ${itemLabel}.`);
      return;
    }

    for (const item of payloadItems) {
      if (!item.code) {
        setFormError(`Mỗi dòng cần chọn ${codeLabel}.`);
        return;
      }
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        setFormError(`Số lượng của ${item.code} phải lớn hơn 0.`);
        return;
      }
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
        setFormError(`Giá của ${item.code} không hợp lệ.`);
        return;
      }
    }

    setIsSaving(true);
    setFormError('');
    setActionMessage('');

    try {
      const res = await fetch('/api/phieu-xuat-nhap-kho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loaiPhieu: slipType,
          loaiKho: warehouseKind,
          ngayPhieu: slipDate,
          lyDo: reason.trim(),
          ghiChu: note.trim(),
          nguoiLap: createdBy.trim(),
          items: payloadItems
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu phiếu xuất nhập kho.');
      }

      setActionMessage(`Đã lưu phiếu ${data.slipCode || ''} (${warehouseKindLabel(warehouseKind)}).`.trim());
      setReason('');
      setNote('');
      setLines([createWarehouseLineDraft()]);
    } catch (error: any) {
      setFormError(error.message || 'Không thể lưu phiếu xuất nhập kho.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Quản lý kho</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Phiếu xuất nhập kho</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Lập phiếu nhập hoặc xuất cho kho NVL hoặc kho Sản phẩm.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onOpenHistory}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:border-[#ef1b2d] hover:bg-[#ef1b2d]"
              >
                <History className="h-4 w-4" />
                Lịch sử
              </button>
              <BackButton onClick={onBack} variant="dark" className="h-10 rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {(formError || actionMessage) && (
        <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-4 shadow-sm">
          {formError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{formError}</p>
          )}
          {actionMessage && (
            <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{actionMessage}</p>
          )}
        </section>
      )}

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-4 shadow-sm space-y-4">
        <div>
          <p className="text-sm font-black text-zinc-950">Loại kho</p>
          <p className="mt-0.5 text-xs font-semibold text-zinc-500">Chọn kho NVL hoặc kho Sản phẩm trước khi lập phiếu</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {([
            ['nvl', 'Kho NVL', Boxes],
            ['san_pham', 'Kho Sản phẩm', Package]
          ] as const).map(([kind, label, Icon]) => (
            <button
              key={kind}
              type="button"
              onClick={() => handleWarehouseKindChange(kind)}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition ${
                warehouseKind === kind
                  ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#ef1b2d]/20 bg-red-50 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#ef1b2d]">Tổng tiền phiếu</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{formatWarehouseMoney(slipTotal)} đ</p>
          </div>
          <p className="text-xs font-semibold text-zinc-500">
            Tự động cộng thành tiền các dòng (Giá × Số lượng)
          </p>
        </div>

        <div>
          <p className="text-sm font-black text-zinc-950">Thông tin phiếu</p>
          <p className="mt-0.5 text-xs font-semibold text-zinc-500">
            {warehouseSlipTypeLabel(slipType)} · {warehouseKindLabel(warehouseKind)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {([
            ['nhap', 'Nhập kho', ArrowDownToLine],
            ['xuat', 'Xuất kho', ArrowUpFromLine]
          ] as const).map(([type, label, Icon]) => (
            <button
              key={type}
              type="button"
              onClick={() => setSlipType(type)}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition ${
                slipType === type
                  ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ngày phiếu *</span>
            <input type="date" value={slipDate} onChange={event => setSlipDate(event.target.value)} className={warehouseFieldClass} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Người lập</span>
            <input value={createdBy} onChange={event => setCreatedBy(event.target.value)} className={warehouseFieldClass} placeholder="Tên người lập phiếu" />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Lý do</span>
            <input value={reason} onChange={event => setReason(event.target.value)} className={warehouseFieldClass} placeholder="VD: Nhập mua ngoài, xuất sản xuất..." />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
            <input value={note} onChange={event => setNote(event.target.value)} className={warehouseFieldClass} placeholder="Ghi chú thêm (tuỳ chọn)" />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-zinc-950">
              Chi tiết {warehouseKind === 'san_pham' ? 'sản phẩm' : 'NVL'}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">
              Mỗi dòng là một {warehouseKind === 'san_pham' ? 'mã SP' : 'mã NPL'} trong phiếu
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLines(current => [...current, createWarehouseLineDraft()])}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
          >
            <Plus className="h-4 w-4" />
            Thêm dòng
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={line.key} className="rounded-xl border border-zinc-200 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Dòng {index + 1}</p>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines(current => current.filter(item => item.key !== line.key))}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700"
                  >
                    Xóa dòng
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <label className="block space-y-1.5 sm:col-span-2 xl:col-span-1">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                    {warehouseItemCodeLabel(warehouseKind)} *
                  </span>
                  <SearchableSelect
                    value={line.code}
                    onChange={code => pickItem(line.key, code)}
                    options={itemOptions}
                    placeholder={
                      warehouseKind === 'san_pham' ? 'Gõ để tìm mã SP' : 'Gõ để tìm mã NPL'
                    }
                    isLoading={isLoadingItems}
                    disabled={isLoadingItems}
                    inputClassName={warehouseFieldClass}
                    getLabel={item => {
                      const option = item as MaterialOption;
                      return `${option.code} · ${option.name}`;
                    }}
                    getValue={item => (item as MaterialOption).code}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                    {warehouseItemNameLabel(warehouseKind)}
                  </span>
                  <input value={line.name} onChange={event => updateLine(line.key, { name: event.target.value })} className={warehouseFieldClass} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Đơn vị</span>
                  <input value={line.unit} onChange={event => updateLine(line.key, { unit: event.target.value })} className={warehouseFieldClass} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Số lượng *</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={event => updateLine(line.key, { quantity: event.target.value })}
                    className={warehouseFieldClass}
                    placeholder="VD: 100,00"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Giá</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={line.unitPrice}
                    onChange={event => updateLine(line.key, { unitPrice: sanitizeMoneyInput(event.target.value) })}
                    onBlur={event => updateLine(line.key, { unitPrice: sanitizeMoneyInput(event.target.value) })}
                    className={warehouseFieldClass}
                    placeholder="VD: 25.000"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Thành tiền</span>
                  <div className={`${warehouseFieldClass} flex items-center bg-zinc-50 font-mono font-bold text-zinc-900`}>
                    {formatWarehouseMoney(computeWarehouseLineAmount(line.quantity, line.unitPrice))} đ
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-[#ef1b2d] px-5 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Đang lưu...' : `Lưu phiếu ${warehouseSlipTypeLabel(slipType).toLowerCase()}`}
          </button>
        </div>
      </section>
    </div>
  );
}

function WarehouseHistoryPanel({
  onBack,
  onOpenSlip
}: {
  onBack: () => void;
  onOpenSlip: () => void;
}) {
  const [warehouseTab, setWarehouseTab] = useState<WarehouseKind>('nvl');
  const [movements, setMovements] = useState<WarehouseMovementRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | WarehouseSlipType>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingSlipCode, setViewingSlipCode] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMovements = async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('loai_kho', warehouseTab);
      if (selectedType !== 'all') params.set('loai', selectedType);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await fetch(`/api/phieu-xuat-nhap-kho?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải lịch sử xuất nhập kho.');
      }

      setMovements(normalizeWarehouseMovements(data));
    } catch (loadError: any) {
      setMovements([]);
      setError(loadError.message || 'Không thể tải lịch sử xuất nhập kho.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setViewingSlipCode(null);
    loadMovements();
  }, [warehouseTab, selectedType, fromDate, toDate]);

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredMovements = useMemo(() => {
    return movements.filter(row => {
      if (!normalizedSearch) return true;
      return `${row.slipCode} ${row.itemCode} ${row.itemName} ${row.reason} ${row.createdBy}`
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [movements, normalizedSearch]);

  const slipGroups = useMemo(() => {
    const map = new Map<string, WarehouseMovementRow[]>();
    filteredMovements.forEach(row => {
      const key = row.slipCode || row.id;
      const current = map.get(key) || [];
      current.push(row);
      map.set(key, current);
    });
    return [...map.entries()].map(([slipCode, rows]) => ({
      slipCode,
      rows,
      header: rows[0]
    }));
  }, [filteredMovements]);

  const viewingRows = viewingSlipCode
    ? filteredMovements.filter(row => row.slipCode === viewingSlipCode)
    : [];

  const viewingSlipTotal = useMemo(
    () => viewingRows.reduce((sum, row) => sum + row.lineAmount, 0),
    [viewingRows]
  );

  const handleDeleteRow = async (row: WarehouseMovementRow) => {
    if (!row.id) return;
    if (!window.confirm(`Xóa dòng ${row.itemCode} khỏi phiếu ${row.slipCode}?`)) return;

    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/phieu-xuat-nhap-kho/${row.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa dòng phiếu.');
      if (viewingSlipCode && viewingRows.length <= 1) setViewingSlipCode(null);
      await loadMovements();
    } catch (deleteError: any) {
      setError(deleteError.message || 'Không thể xóa dòng phiếu.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Quản lý kho</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Lịch sử xuất nhập kho</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Tra cứu phiếu theo kho NVL hoặc kho Sản phẩm.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onOpenSlip}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Lập phiếu
              </button>
              <BackButton onClick={onBack} variant="dark" className="h-10 rounded-xl" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Phiếu', slipGroups.length],
              [warehouseTab === 'san_pham' ? 'Dòng SP' : 'Dòng NVL', filteredMovements.length],
              ['Nhập', filteredMovements.filter(row => row.slipType === 'nhap').length]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="block font-bold text-zinc-400">{label}</span>
                <span className="mt-1 block text-xl font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="flex gap-1 border-b border-zinc-200 px-4">
          {([
            ['nvl', 'Kho NVL', Boxes],
            ['san_pham', 'Kho Sản phẩm', Package]
          ] as const).map(([tab, label, Icon]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setWarehouseTab(tab)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wider transition ${
                warehouseTab === tab ? 'border-[#ef1b2d] text-[#ef1b2d]' : 'border-transparent text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-3 lg:flex lg:flex-wrap lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
          {([
            ['all', 'Tất cả'],
            ['nhap', 'Nhập kho'],
            ['xuat', 'Xuất kho']
          ] as const).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedType === type
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:mt-0 lg:w-auto">
          <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className={warehouseFieldClass} />
          <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className={warehouseFieldClass} />
        </div>

        <label className="mt-3 flex h-11 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 lg:mt-0 lg:min-w-[320px]">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder={warehouseTab === 'san_pham' ? 'Tìm mã phiếu, SP, lý do...' : 'Tìm mã phiếu, NPL, lý do...'}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          {error}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã phiếu</th>
                <th className="px-4 py-3 font-black">Loại</th>
                <th className="px-4 py-3 font-black">Ngày</th>
                <th className="px-4 py-3 font-black">{warehouseItemCodeLabel(warehouseTab)}</th>
                <th className="px-4 py-3 font-black">{warehouseItemNameLabel(warehouseTab)}</th>
                <th className="px-4 py-3 font-black">SL</th>
                <th className="px-4 py-3 font-black">ĐVT</th>
                <th className="px-4 py-3 font-black">Giá</th>
                <th className="px-4 py-3 font-black">Thành tiền</th>
                <th className="px-4 py-3 font-black">Người lập</th>
                <th className="px-4 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredMovements.map(row => (
                <tr key={row.id || `${row.slipCode}-${row.itemCode}`} className="hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{row.slipCode || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.slipType === 'nhap' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                      {warehouseSlipTypeLabel(row.slipType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{row.slipDate || '-'}</td>
                  <td className="px-4 py-3 font-black text-zinc-950">{row.itemCode || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-800">{row.itemName || '-'}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-800">{formatNumber(row.quantity, 2)}</td>
                  <td className="px-4 py-3 font-bold text-zinc-700">{row.unit}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-800">{formatWarehouseMoney(row.unitPrice)} đ</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-900">{formatWarehouseMoney(row.lineAmount)} đ</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{row.createdBy || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingSlipCode(row.slipCode)}
                        title="Xem phiếu"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row)}
                        disabled={deletingId === row.id}
                        title="Xóa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center font-bold text-zinc-400">
                    Chưa có lịch sử {warehouseKindLabel(warehouseTab).toLowerCase()}.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Đang tải Supabase...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {viewingSlipCode && viewingRows[0] && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Chi tiết phiếu</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">{viewingSlipCode}</p>
              </div>
              <BackButton onClick={() => setViewingSlipCode(null)} />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {[
                ['Kho', warehouseKindLabel(viewingRows[0].warehouseKind)],
                ['Loại', warehouseSlipTypeLabel(viewingRows[0].slipType)],
                ['Ngày', viewingRows[0].slipDate || '-'],
                ['Tổng tiền', `${formatWarehouseMoney(viewingSlipTotal)} đ`],
                ['Lý do', viewingRows[0].reason || '-'],
                ['Ghi chú', viewingRows[0].note || '-'],
                ['Người lập', viewingRows[0].createdBy || '-']
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="mt-1 font-bold text-zinc-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-zinc-200 px-4 py-3">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3 font-black">{warehouseItemCodeLabel(viewingRows[0].warehouseKind)}</th>
                    <th className="py-2 pr-3 font-black">{warehouseItemNameLabel(viewingRows[0].warehouseKind)}</th>
                    <th className="py-2 pr-3 font-black">SL</th>
                    <th className="py-2 pr-3 font-black">ĐVT</th>
                    <th className="py-2 pr-3 font-black">Giá</th>
                    <th className="py-2 font-black">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {viewingRows.map(row => (
                    <tr key={row.id || `${row.itemCode}-${row.quantity}`}>
                      <td className="py-2 pr-3 font-bold text-zinc-900">{row.itemCode}</td>
                      <td className="py-2 pr-3 text-zinc-700">{row.itemName || '-'}</td>
                      <td className="py-2 pr-3 font-mono font-bold text-zinc-800">{formatNumber(row.quantity, 2)}</td>
                      <td className="py-2 pr-3 text-zinc-700">{row.unit}</td>
                      <td className="py-2 pr-3 font-mono font-bold text-zinc-800">{formatWarehouseMoney(row.unitPrice)} đ</td>
                      <td className="py-2 font-mono font-bold text-zinc-900">{formatWarehouseMoney(row.lineAmount)} đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex justify-end rounded-xl border border-[#ef1b2d]/20 bg-red-50 px-4 py-3">
                <p className="text-sm font-black text-zinc-950">
                  Tổng tiền: <span className="text-[#ef1b2d]">{formatWarehouseMoney(viewingSlipTotal)} đ</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ORDER_TYPE_OPTIONS = ['Đơn bán', 'Đơn sản xuất'] as const;
const ORDER_STATUS_DEFAULT = 'Chờ sx';
const ORDER_STATUS_OPTIONS = ['Chờ sx', 'Đang sx', 'Hoàn thành', 'Hủy'] as const;
const STORAGE_ORDER_UNIT_KEY = 'order_unit_suggestions_v1';
const orderFieldClass =
  'h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

interface StaffOption {
  name: string;
}

interface CustomerOption {
  id: string;
  name: string;
  code: string;
}

interface OrderProductOption {
  code: string;
  name: string;
  unit: string;
  newCode: string;
}

function normalizeStaffOptions(data: unknown): StaffOption[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item): StaffOption | null => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { name } : null;
      }
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = pickText(record, ['name', 'nhan_su', 'ho_ten', 'ten'], '');
      return name ? { name } : null;
    })
    .filter((item): item is StaffOption => Boolean(item));
}

function normalizeCustomerOptions(data: unknown): CustomerOption[] {
  if (!data || typeof data !== 'object') return [];
  const customers = (data as { customers?: unknown }).customers;
  if (!Array.isArray(customers)) return [];

  return customers
    .map((item): CustomerOption | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = pickText(record, ['ten_khach_hang', 'khach_hang', 'ten', 'name', 'ten_cong_ty'], '');
      const code = pickText(record, ['ma_khach_hang', 'ma_kh', 'code', 'id'], '');
      if (!name && !code) return null;
      return {
        id: code || name,
        name: name || code,
        code
      };
    })
    .filter((item): item is CustomerOption => Boolean(item));
}

function normalizeOrderProducts(data: unknown): OrderProductOption[] {
  return normalizeProducts(data).map(product => ({
    code: product.code,
    name: product.name,
    unit: product.unit === '-' ? '' : product.unit,
    newCode: product.newCode
  }));
}

function findOrderProductByCode(products: OrderProductOption[], code: string) {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;

  return (
    products.find(
      product =>
        product.code.toLowerCase() === normalized ||
        product.newCode.toLowerCase() === normalized
    ) ?? null
  );
}

function resolveOrderProductFields(
  products: OrderProductOption[],
  productCode: string,
  fallback: { productName?: string; unit?: string } = {}
) {
  const match = findOrderProductByCode(products, productCode);
  if (!match) {
    return {
      productName: productCode.trim() ? '' : (fallback.productName ?? ''),
      unit: fallback.unit ?? ''
    };
  }

  return {
    productName: match.name,
    unit: match.unit || fallback.unit || ''
  };
}

function readUnitSuggestions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_ORDER_UNIT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
}

function saveUnitSuggestion(unit: string) {
  const trimmed = unit.trim();
  if (!trimmed) return;
  const next = [...new Set([trimmed, ...readUnitSuggestions()])].slice(0, 30);
  localStorage.setItem(STORAGE_ORDER_UNIT_KEY, JSON.stringify(next));
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  isLoading,
  disabled,
  getLabel,
  getValue,
  inputClassName,
  maxResults = 50,
  allowEmpty = true,
  onSelectOption
}: {
  value: string;
  onChange: (value: string) => void;
  options: unknown[];
  placeholder: string;
  isLoading?: boolean;
  disabled?: boolean;
  getLabel: (item: unknown) => string;
  getValue: (item: unknown) => string;
  inputClassName?: string;
  maxResults?: number;
  allowEmpty?: boolean;
  onSelectOption?: (item: unknown | null) => void;
}) {
  const fieldClass = inputClassName || orderFieldClass;
  const selectedItem = useMemo(
    () => options.find(item => getValue(item) === value) ?? null,
    [options, value, getLabel, getValue]
  );
  const selectedLabel = selectedItem ? getLabel(selectedItem) : value;

  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery(selectedLabel);
    }
  }, [selectedLabel, open]);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = normalized
      ? options.filter(item => {
          const label = getLabel(item).toLowerCase();
          const optionValue = getValue(item).toLowerCase();
          return label.includes(normalized) || optionValue.includes(normalized);
        })
      : options;
    return list.slice(0, maxResults);
  }, [options, query, getLabel, getValue, maxResults]);

  const commitValue = (nextValue: string, item: unknown | null = null) => {
    const trimmed = nextValue.trim();
    onChange(trimmed);
    onSelectOption?.(item);
    if (item) {
      setQuery(getLabel(item));
    } else if (trimmed) {
      const match = options.find(opt => getValue(opt) === trimmed);
      setQuery(match ? getLabel(match) : trimmed);
    } else {
      setQuery('');
    }
    setOpen(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) {
        if (allowEmpty) {
          commitValue('', null);
        } else {
          setQuery(selectedLabel);
          setOpen(false);
        }
        return;
      }

      const exactValue = options.find(item => getValue(item).toLowerCase() === normalized);
      if (exactValue) {
        commitValue(getValue(exactValue), exactValue);
        return;
      }

      const exactLabel = options.find(item => getLabel(item).toLowerCase() === normalized);
      if (exactLabel) {
        commitValue(getValue(exactLabel), exactLabel);
        return;
      }

      if (filteredOptions.length === 1) {
        commitValue(getValue(filteredOptions[0]), filteredOptions[0]);
        return;
      }

      setQuery(selectedLabel);
      setOpen(false);
    }, 120);
  };

  const isDisabled = Boolean(disabled || isLoading);
  const emptyText = isLoading ? 'Đang tải...' : options.length === 0 ? 'Không có dữ liệu' : placeholder;

  return (
    <div className="relative">
      <input
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (!isDisabled) setOpen(true);
        }}
        onBlur={handleBlur}
        disabled={isDisabled}
        placeholder={emptyText}
        className={fieldClass}
      />
      {open && !isDisabled && filteredOptions.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {allowEmpty && !query.trim() && (
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => commitValue('', null)}
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-zinc-500 transition hover:bg-zinc-50"
            >
              {placeholder}
            </button>
          )}
          {filteredOptions.map((item, index) => {
            const optionValue = getValue(item);
            const optionLabel = getLabel(item);
            return (
              <button
                key={`${optionValue}-${index}`}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => commitValue(optionValue, item)}
                className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-red-50 ${
                  optionValue === value ? 'bg-red-50 font-black text-[#ef1b2d]' : 'font-semibold text-zinc-800'
                }`}
              >
                {optionLabel}
              </button>
            );
          })}
        </div>
      )}
      {open && !isDisabled && query.trim() && filteredOptions.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-500 shadow-lg">
          Không tìm thấy kết quả
        </div>
      )}
    </div>
  );
}

function SimpleSelect({
  value,
  onChange,
  options,
  placeholder,
  isLoading,
  disabled,
  getLabel,
  getValue
}: {
  value: string;
  onChange: (value: string) => void;
  options: unknown[];
  placeholder: string;
  isLoading?: boolean;
  disabled?: boolean;
  getLabel: (item: unknown) => string;
  getValue: (item: unknown) => string;
}) {
  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      isLoading={isLoading}
      disabled={disabled}
      getLabel={getLabel}
      getValue={getValue}
    />
  );
}

function SearchableProductCodeField({
  value,
  onChange,
  products,
  isLoading,
  onSelectProduct
}: {
  value: string;
  onChange: (value: string) => void;
  products: OrderProductOption[];
  isLoading?: boolean;
  onSelectProduct: (product: OrderProductOption | null) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = normalized
      ? products.filter(product =>
          `${product.code} ${product.newCode} ${product.name}`.toLowerCase().includes(normalized)
        )
      : products;
    return list.slice(0, 40);
  }, [products, query]);

  const commitCode = (nextCode: string) => {
    const trimmed = nextCode.trim();
    onChange(trimmed);
    onSelectProduct(findOrderProductByCode(products, trimmed));
    setQuery(trimmed);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            commitCode(query);
          }, 120);
        }}
        disabled={isLoading}
        placeholder={isLoading ? 'Đang tải hàng hóa...' : 'Gõ để tìm mã hàng'}
        className={orderFieldClass}
      />
      {open && !isLoading && filteredProducts.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {filteredProducts.map(product => (
            <button
              key={`${product.code}-${product.name}`}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => commitCode(product.code || product.newCode)}
              className="flex w-full flex-col items-start px-3 py-2 text-left transition hover:bg-red-50"
            >
              <span className="text-sm font-black text-zinc-900">
                {product.code || product.newCode || '—'}
              </span>
              <span className="text-xs font-semibold text-zinc-500">{product.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ProductionOrderRow {
  id: string;
  code: string;
  name: string;
  productCode: string;
  productName: string;
  quantity: string;
  unit: string;
  status: string;
  customer: string;
  orderRef: string;
  startDate: string;
  endDate: string;
  machine: string;
  shift: string;
  staff: string;
  note: string;
}

function normalizeProductionOrders(data: unknown): ProductionOrderRow[] {
  if (!data || typeof data !== 'object') return [];
  const rows = (data as { productionOrders?: unknown }).productionOrders;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((item): ProductionOrderRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = pickText(record, ['ma_lenh_sx', 'ma', 'code', 'so_lenh'], '');
      const name = pickText(record, ['ten_lenh_sx', 'ten', 'name', 'tieu_de'], '');
      const productCode = pickText(record, ['ma_hang', 'ma_sp', 'product_code'], '');
      const productName = pickText(record, ['ten_hang', 'ten_sp', 'product_name'], '');
      if (!code && !name && !productCode && !productName) return null;

      return {
        id: String(record.id ?? '').trim() || code || name || productCode,
        code,
        name,
        productCode,
        productName,
        quantity: formatCell(record.so_luong ?? record.sl ?? record.quantity),
        unit: formatCell(record.don_vi ?? record.unit),
        status: pickText(record, ['trang_thai', 'status', 'tinh_trang'], '-'),
        customer: pickText(record, ['khach_hang', 'customer', 'ten_khach_hang'], '-'),
        orderRef: pickText(record, ['ma_don_hang', 'don_hang', 'order_code'], '-'),
        startDate: formatCell(
          record.ngay_gio_bat_dau ?? record.ngay_bat_dau ?? record.ngay_san_xuat ?? record.ngay_sx ?? record.start_date
        ),
        endDate: formatCell(record.ngay_gio_ket_thuc ?? record.ngay_ket_thuc ?? record.end_date),
        machine: pickText(record, ['may', 'ten_may', 'ma_may', 'machine'], '-'),
        shift: pickText(record, ['ca', 'shift'], '-'),
        staff: pickText(record, ['nhan_su', 'staff', 'nhan_vien'], '-'),
        note: pickText(record, ['ghi_chu', 'note', 'mo_ta'], '')
      };
    })
    .filter((row): row is ProductionOrderRow => Boolean(row));
}

const PRODUCTION_ORDER_STATUS_OPTIONS = ['Chờ sx', 'Đang sx', 'Hoàn thành', 'Hủy'];

type ProductionOrderLookupSetting = {
  id: string;
  code: string;
  name: string;
  loaiCaiDat: string;
  group: string;
  timeFrame: string;
  note: string;
};

function mapProductionOrderSettings(data: unknown): ProductionOrderLookupSetting[] {
  if (!data || typeof data !== 'object') return [];
  const settings = (data as { settings?: unknown }).settings;
  if (!Array.isArray(settings)) return [];

  return settings.map(item => {
    const record = item as Record<string, unknown>;
    return {
      id: String(record.id ?? ''),
      code: pickText(record, ['ma_cai_dat', 'ma', 'code'], ''),
      name: pickText(record, ['ten_cai_dat', 'hang_muc', 'name'], ''),
      loaiCaiDat: pickText(record, ['loai_cai_dat', 'loai'], '-'),
      group: pickText(record, ['nhom', 'group'], '-'),
      timeFrame: formatCell(record.khung_gio),
      note: pickText(record, ['ghi_chu', 'note'], '')
    };
  });
}

function toDatetimeLocalValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function settingMatchesShift(setting: ProductionOrderLookupSetting, shift: string) {
  if (!shift) return false;
  const needle = shift.toLowerCase();
  return [setting.group, setting.name, setting.timeFrame, setting.note, setting.code]
    .some(value => value && value !== '-' && value.toLowerCase().includes(needle));
}

type ProductionOrderFormState = {
  code: string;
  name: string;
  selectedProductCodes: string[];
  quantity: string;
  unit: string;
  status: string;
  orderRef: string;
  shift: string;
  selectedStaffIds: string[];
  startDateTime: string;
  endDateTime: string;
  machine: string;
  note: string;
};

function emptyProductionOrderForm(): ProductionOrderFormState {
  return {
    code: '',
    name: '',
    selectedProductCodes: [],
    quantity: '',
    unit: '',
    status: 'Chờ sx',
    orderRef: '',
    shift: '',
    selectedStaffIds: [],
    startDateTime: toDatetimeLocalValue(),
    endDateTime: '',
    machine: '',
    note: ''
  };
}

function AddProductionOrderModal({
  open,
  onClose,
  onCreated
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<ProductionOrderFormState>(emptyProductionOrderForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [settings, setSettings] = useState<ProductionOrderLookupSetting[]>([]);
  const [staffBranches, setStaffBranches] = useState<HrBranch[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductRow[]>([]);

  useEffect(() => {
    if (!open) return;

    setForm(emptyProductionOrderForm());
    setFormError('');
    setIsLoadingLookups(true);

    const loadLookups = async () => {
      try {
        const [orderRes, machineRes, settingRes, staffRes, productRes] = await Promise.all([
          fetch('/api/don-hang'),
          fetch('/api/danh-sach-may'),
          fetch('/api/cai-dat'),
          fetch('/api/nhan-su?format=groups'),
          fetch('/api/san-pham?format=table')
        ]);

        const orderData = await orderRes.json().catch(() => ({}));
        const machineData = await machineRes.json().catch(() => ({}));
        const settingData = await settingRes.json().catch(() => ({}));
        const staffData = await staffRes.json().catch(() => ({}));
        const productData = await productRes.json().catch(() => ({}));

        if (orderRes.ok) setOrders(normalizeOrders(orderData));
        if (machineRes.ok) setMachines(normalizeMachines(machineData));
        if (settingRes.ok) setSettings(mapProductionOrderSettings(settingData));
        if (staffRes.ok) setStaffBranches(normalizeHrBranches(staffData));
        if (productRes.ok) setCatalogProducts(normalizeProducts(productData));
      } finally {
        setIsLoadingLookups(false);
      }
    };

    loadLookups();
  }, [open]);

  const orderCodeOptions = useMemo(() => {
    return [...new Set(orders.map(order => order.orderCode).filter(code => code && code !== '-'))].sort((a, b) =>
      a.localeCompare(b, 'vi')
    );
  }, [orders]);

  const productOptions = useMemo(() => {
    if (!form.orderRef) return [];

    const fromOrders = orders
      .filter(order => order.orderCode === form.orderRef)
      .map(order => ({ code: order.productCode, name: order.productName }))
      .filter(item => item.code && item.code !== '-');

    const unique = new Map<string, string>();
    fromOrders.forEach(item => unique.set(item.code, item.name || item.code));

    if (unique.size === 0) {
      catalogProducts.forEach(product => {
        if (product.code) unique.set(product.code, product.name || product.code);
      });
    }

    return [...unique.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code, 'vi'));
  }, [catalogProducts, form.orderRef, orders]);

  const derivedProductNames = useMemo(() => {
    return form.selectedProductCodes
      .map(code => productOptions.find(item => item.code === code)?.name || code)
      .join(', ');
  }, [form.selectedProductCodes, productOptions]);

  const shiftOptions = useMemo(() => {
    const fromSettings = settings
      .filter(
        setting =>
          setting.loaiCaiDat === 'Thời gian' ||
          setting.loaiCaiDat === 'Sản xuất' ||
          /ca/i.test(setting.name) ||
          /ca/i.test(setting.code)
      )
      .map(setting => setting.name || setting.code)
      .filter((name, index, arr) => name && arr.indexOf(name) === index);

    return fromSettings.length > 0 ? fromSettings : [...STANDARD_SHIFTS];
  }, [settings]);

  const assignedMachineKeys = useMemo(() => {
    if (!form.shift) return new Set<string>();

    const keys = settings
      .filter(setting => setting.loaiCaiDat === 'Ca máy' && settingMatchesShift(setting, form.shift))
      .flatMap(setting =>
        [setting.code, setting.name].filter(value => value && value !== '-').map(value => value.toLowerCase())
      );

    return new Set(keys);
  }, [form.shift, settings]);

  const availableMachines = useMemo(() => {
    return machines.filter(machine => {
      const candidates = [machine.code, machine.name]
        .filter(value => value && value !== '-')
        .map(value => value.toLowerCase());

      return !candidates.some(
        key =>
          assignedMachineKeys.has(key) ||
          [...assignedMachineKeys].some(assigned => key.includes(assigned) || assigned.includes(key))
      );
    });
  }, [assignedMachineKeys, machines]);

  const staffOptions = useMemo(() => {
    const allMembers = staffBranches.flatMap(branch =>
      branch.departments.flatMap(department => department.members)
    );

    if (!form.shift) return allMembers;

    const needle = form.shift.toLowerCase();
    const filtered = allMembers.filter(member => {
      const memberShift = member.shift.toLowerCase();
      return memberShift.includes(needle) || needle.includes(memberShift);
    });

    return filtered.length > 0 ? filtered : allMembers;
  }, [form.shift, staffBranches]);

  const selectedStaffNames = useMemo(() => {
    return staffOptions
      .filter(member => form.selectedStaffIds.includes(member.id))
      .map(member => member.name)
      .join(', ');
  }, [form.selectedStaffIds, staffOptions]);

  const handleOrderChange = (orderRef: string) => {
    const matchingOrders = orders.filter(order => order.orderCode === orderRef);
    const defaultCodes = [...new Set(matchingOrders.map(order => order.productCode).filter(code => code && code !== '-'))];
    const defaultUnit = matchingOrders.find(order => order.unit && order.unit !== '-')?.unit || '';

    setForm(prev => ({
      ...prev,
      orderRef,
      selectedProductCodes: defaultCodes.length === 1 ? defaultCodes : [],
      unit: defaultUnit,
      machine: ''
    }));
  };

  const toggleProductCode = (code: string) => {
    setForm(prev => ({
      ...prev,
      selectedProductCodes: prev.selectedProductCodes.includes(code)
        ? prev.selectedProductCodes.filter(item => item !== code)
        : [...prev.selectedProductCodes, code]
    }));
  };

  const toggleStaffId = (staffId: string) => {
    setForm(prev => ({
      ...prev,
      selectedStaffIds: prev.selectedStaffIds.includes(staffId)
        ? prev.selectedStaffIds.filter(id => id !== staffId)
        : [...prev.selectedStaffIds, staffId]
    }));
  };

  if (!open) return null;

  const handleSubmit = async () => {
    const quantity = Number(form.quantity);
    const productCode = form.selectedProductCodes.join(', ');
    const productName = derivedProductNames;

    if (!form.orderRef.trim()) {
      setFormError('Vui lòng chọn mã đơn hàng.');
      return;
    }
    if (!productCode) {
      setFormError('Vui lòng chọn ít nhất một mã hàng.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError('Số lượng phải lớn hơn 0.');
      return;
    }
    if (!form.shift.trim()) {
      setFormError('Vui lòng chọn ca.');
      return;
    }
    if (!form.machine.trim()) {
      setFormError('Vui lòng chọn máy.');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const res = await fetch('/api/lenh-sx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ma_lenh_sx: form.code.trim(),
          ten_lenh_sx: form.name.trim() || (productName ? `SX ${productName}` : ''),
          ma_hang: productCode,
          ten_hang: productName,
          so_luong: quantity,
          don_vi: form.unit.trim(),
          trang_thai: form.status,
          ma_don_hang: form.orderRef.trim(),
          ca: form.shift.trim(),
          nhan_su: selectedStaffNames,
          ngay_gio_bat_dau: form.startDateTime,
          ngay_gio_ket_thuc: form.endDateTime.trim() || null,
          may: form.machine.trim(),
          ghi_chu: form.note.trim()
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tạo lệnh sản xuất.');
      }

      await onCreated();
      onClose();
    } catch (error: any) {
      setFormError(error.message || 'Không thể tạo lệnh sản xuất.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Thêm lệnh sản xuất mới</h3>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">Ghi vào bảng lenh_sx trên Supabase</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Đóng
          </button>
        </div>

        {formError && (
          <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700">
            {formError}
          </div>
        )}

        {isLoadingLookups && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải đơn hàng, máy, ca và nhân sự...
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 p-4">
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã lệnh</span>
            <input
              value={form.code}
              onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
              className={orderFieldClass}
              placeholder="Để trống = tự sinh"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tên lệnh</span>
            <input
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              className={orderFieldClass}
              placeholder="Tự điền theo tên hàng"
            />
          </label>

          <label className="col-span-2 space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã đơn hàng *</span>
            <SearchableSelect
              value={form.orderRef}
              onChange={handleOrderChange}
              options={orderCodeOptions}
              placeholder="Gõ để tìm mã đơn hàng"
              isLoading={isLoadingLookups}
              getLabel={item => String(item)}
              getValue={item => String(item)}
            />
          </label>

          <div className="col-span-2 space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã hàng * (chọn nhiều)</span>
            <div className="max-h-36 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2">
              {!form.orderRef && (
                <p className="px-2 py-3 text-xs font-semibold text-zinc-400">Chọn mã đơn hàng trước.</p>
              )}
              {form.orderRef && productOptions.length === 0 && (
                <p className="px-2 py-3 text-xs font-semibold text-zinc-400">Không có mã hàng cho đơn này.</p>
              )}
              {productOptions.map(product => {
                const checked = form.selectedProductCodes.includes(product.code);
                return (
                  <label
                    key={product.code}
                    className={`mb-1 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition last:mb-0 ${
                      checked ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-zinc-200 bg-white text-zinc-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProductCode(product.code)}
                      className="h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                    />
                    <span className="font-black">{product.code}</span>
                    <span className="text-zinc-500">{product.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="col-span-2 space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tên hàng *</span>
            <input
              value={derivedProductNames}
              readOnly
              className={`${orderFieldClass} bg-zinc-50 text-zinc-800`}
              placeholder="Tự hiện theo mã hàng đã chọn"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Số lượng *</span>
            <input
              type="number"
              min="0"
              step="any"
              value={form.quantity}
              onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
              className={orderFieldClass}
              placeholder="VD: 1000"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Đơn vị</span>
            <input
              value={form.unit}
              onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
              className={orderFieldClass}
              placeholder="VD: kg, cái"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ca *</span>
            <SearchableSelect
              value={form.shift}
              onChange={shift => setForm(prev => ({ ...prev, shift, machine: '' }))}
              options={shiftOptions}
              placeholder="Gõ để tìm ca"
              isLoading={isLoadingLookups}
              getLabel={item => String(item)}
              getValue={item => String(item)}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Trạng thái</span>
            <SearchableSelect
              value={form.status}
              onChange={status => setForm(prev => ({ ...prev, status }))}
              options={[...PRODUCTION_ORDER_STATUS_OPTIONS]}
              placeholder="Gõ để tìm trạng thái"
              getLabel={item => String(item)}
              getValue={item => String(item)}
              allowEmpty={false}
            />
          </label>

          <label className="col-span-2 space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Máy *</span>
            <SearchableSelect
              value={form.machine}
              onChange={machine => setForm(prev => ({ ...prev, machine }))}
              options={availableMachines}
              placeholder={form.shift ? 'Gõ để tìm máy' : 'Chọn ca trước'}
              disabled={!form.shift}
              getLabel={item => {
                const machine = item as MachineRow;
                return machine.code ? `${machine.code} · ${machine.name}` : machine.name;
              }}
              getValue={item => {
                const machine = item as MachineRow;
                return machine.code || machine.name;
              }}
            />
            {form.shift && availableMachines.length === 0 && (
              <p className="text-[11px] font-semibold text-amber-700">
                Không còn máy trống cho ca này (các máy đã khai báo trong Ca máy).
              </p>
            )}
          </label>

          <div className="col-span-2 space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Nhân sự (chọn nhiều)</span>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2">
              {staffOptions.length === 0 && (
                <p className="px-2 py-3 text-xs font-semibold text-zinc-400">Chưa có nhân sự Sản xuất · Đà Nẵng.</p>
              )}
              {staffOptions.map(member => {
                const checked = form.selectedStaffIds.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className={`mb-1 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition last:mb-0 ${
                      checked ? 'border-[#ef1b2d]/30 bg-red-50 text-[#b30d1c]' : 'border-zinc-200 bg-white text-zinc-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStaffId(member.id)}
                      className="h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                    />
                    <span className="font-black">{member.name}</span>
                    <span className="text-zinc-500">{member.role} · {member.shift}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ngày giờ bắt đầu</span>
            <input
              type="datetime-local"
              value={form.startDateTime}
              onChange={e => setForm(prev => ({ ...prev, startDateTime: e.target.value }))}
              className={orderFieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ngày giờ kết thúc</span>
            <input
              type="datetime-local"
              value={form.endDateTime}
              onChange={e => setForm(prev => ({ ...prev, endDateTime: e.target.value }))}
              className={orderFieldClass}
            />
          </label>

          <label className="col-span-2 space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
            <textarea
              value={form.note}
              onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
              rows={2}
              className={`${orderFieldClass} min-h-[72px] resize-y`}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 rounded-xl border border-zinc-200 px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || isLoadingLookups}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isSaving ? 'Đang lưu...' : 'Tạo lệnh SX'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductionOrdersPanel({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<ProductionOrderRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [viewingRow, setViewingRow] = useState<ProductionOrderRow | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadProductionOrders = async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const res = await fetch('/api/lenh-sx');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải lệnh sản xuất từ Supabase.');
      }

      setRows(normalizeProductionOrders(data));
    } catch (error: any) {
      setRows([]);
      setLoadError(error.message || 'Không thể tải lệnh sản xuất từ Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProductionOrders();
  }, []);

  const statusFilters = useMemo(() => {
    const statuses = rows
      .map(row => row.status)
      .filter((status): status is string => status !== '-' && status.length > 0);
    return ['all', ...[...new Set(statuses)].sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [rows]);

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const matchesStatus = selectedStatus === 'all' || row.status === selectedStatus;
      const matchesSearch =
        !normalizedSearch ||
        `${row.code} ${row.name} ${row.productCode} ${row.productName} ${row.customer} ${row.orderRef} ${row.machine} ${row.status} ${row.note}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [normalizedSearch, rows, selectedStatus]);

  const activeCount = rows.filter(row => /đang|cho|chờ|active|sx/i.test(row.status)).length;
  const totalQuantity = rows.reduce((sum, row) => {
    const value = Number(row.quantity);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Kế hoạch & điều phối</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Lệnh sản xuất</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase lenh_sx.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>
              <button
                type="button"
                onClick={onBack}
                className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:border-[#ef1b2d] hover:bg-[#ef1b2d]"
              >
                Menu
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Lệnh SX', rows.length],
              ['Đang / chờ SX', activeCount],
              ['Tổng SL', formatNumber(totalQuantity)]
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
          {statusFilters.map(status => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedStatus === status
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {status === 'all' ? 'Tất cả' : status}
            </button>
          ))}
          {isLoading && (
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
            placeholder="Tìm mã lệnh, hàng, khách, đơn hàng..."
            disabled={isLoading}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {loadError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {loadError}
          </p>
        )}
      </section>

      <AddProductionOrderModal
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        onCreated={loadProductionOrders}
      />

      {viewingRow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Chi tiết lệnh SX</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">{viewingRow.code || viewingRow.name}</p>
              </div>
              <button type="button" onClick={() => setViewingRow(null)} className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50">
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 text-sm">
              {[
                ['Mã lệnh', viewingRow.code],
                ['Tên lệnh', viewingRow.name],
                ['Mã hàng', viewingRow.productCode],
                ['Tên hàng', viewingRow.productName],
                ['Số lượng', viewingRow.quantity],
                ['Đơn vị', viewingRow.unit],
                ['Trạng thái', viewingRow.status],
                ['Khách hàng', viewingRow.customer],
                ['Đơn hàng', viewingRow.orderRef],
                ['Ca', viewingRow.shift],
                ['Nhân sự', viewingRow.staff],
                ['Bắt đầu', viewingRow.startDate],
                ['Kết thúc', viewingRow.endDate],
                ['Máy', viewingRow.machine],
                ['Ghi chú', viewingRow.note || '-']
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="mt-1 font-bold text-zinc-900">{value || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1480px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã lệnh</th>
                <th className="px-4 py-3 font-black">Tên lệnh</th>
                <th className="px-4 py-3 font-black">Mã hàng</th>
                <th className="px-4 py-3 font-black">Tên hàng</th>
                <th className="px-4 py-3 font-black">SL</th>
                <th className="px-4 py-3 font-black">Đơn vị</th>
                <th className="px-4 py-3 font-black">Trạng thái</th>
                <th className="px-4 py-3 font-black">Khách hàng</th>
                <th className="px-4 py-3 font-black">Đơn hàng</th>
                <th className="px-4 py-3 font-black">Bắt đầu</th>
                <th className="px-4 py-3 font-black">Kết thúc</th>
                <th className="px-4 py-3 font-black">Máy</th>
                <th className="px-4 py-3 text-center font-black">Xem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRows.map(row => (
                <tr key={row.id} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{row.code || '-'}</td>
                  <td className="px-4 py-3 font-black text-zinc-950">{row.name || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{row.productCode || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-800">{row.productName || '-'}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{row.quantity}</td>
                  <td className="px-4 py-3 font-bold text-zinc-700">{row.unit}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{row.customer}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{row.orderRef}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-zinc-600">{row.startDate}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-zinc-600">{row.endDate}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{row.machine}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setViewingRow(row)}
                      title="Xem chi tiết"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {!isLoading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Bảng lenh_sx chưa có dữ liệu hoặc không có lệnh phù hợp bộ lọc.
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

interface OrderRow {
  id: string;
  orderCode: string;
  orderType: string;
  status: string;
  staffName: string;
  customer: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: string;
  stockQuantity: string;
  productionOrder: string;
  note: string;
}

function normalizeOrders(data: unknown): OrderRow[] {
  if (!data || typeof data !== 'object') return [];
  const orders = (data as { orders?: unknown }).orders;
  if (!Array.isArray(orders)) return [];

  return orders
    .map((item): OrderRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const orderCode = pickText(record, ['ma_don_hang', 'order_code', 'code'], '');
      const productCode = pickText(record, ['ma_hang', 'ma_sp', 'product_code'], '');
      const productName = pickText(record, ['ten_hang', 'ten_sp', 'product_name'], '');
      if (!orderCode && !productCode && !productName) return null;

      return {
        id: String(record.id ?? '').trim() || orderCode || productCode || productName,
        orderCode,
        orderType: pickText(record, ['loai_don_hang', 'order_type', 'type'], '-'),
        status: pickText(record, ['trang_thai', 'status', 'trang_thai_don'], ORDER_STATUS_DEFAULT),
        staffName: pickText(record, ['nhan_vien', 'staff', 'nv'], '-'),
        customer: pickText(record, ['khach_hang', 'customer'], '-'),
        productCode,
        productName,
        unit: formatCell(record.don_vi),
        quantity: formatCell(record.so_luong ?? record.sl ?? record.quantity),
        stockQuantity: formatCell(
          record.so_luong_ton ?? record.so_luong_ton_kho ?? record.sl_ton ?? record.stock_quantity
        ),
        productionOrder: pickText(record, ['lenh_sx', 'production_order'], '-'),
        note: pickText(record, ['ghi_chu', 'note'], '')
      };
    })
    .filter((order): order is OrderRow => Boolean(order));
}

type OrderFormState = {
  orderCode: string;
  orderType: string;
  staffName: string;
  customer: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: string;
  stockQuantity: string;
  productionOrder: string;
  note: string;
  status: string;
};

const emptyOrderForm = (): OrderFormState => ({
  orderCode: '',
  orderType: ORDER_TYPE_OPTIONS[0],
  staffName: '',
  customer: '',
  productCode: '',
  productName: '',
  unit: '',
  quantity: '',
  stockQuantity: '',
  productionOrder: '',
  note: '',
  status: ORDER_STATUS_DEFAULT
});

function orderCellToInput(value: string) {
  return value === '-' ? '' : value;
}

function orderHasProductionOrder(order: OrderRow) {
  return Boolean(order.productionOrder && order.productionOrder !== '-');
}

function orderToForm(order: OrderRow): OrderFormState {
  const orderType = (ORDER_TYPE_OPTIONS as readonly string[]).includes(order.orderType)
    ? order.orderType
    : ORDER_TYPE_OPTIONS[0];

  return {
    orderCode: orderCellToInput(order.orderCode),
    orderType,
    staffName: orderCellToInput(order.staffName),
    customer: orderCellToInput(order.customer),
    productCode: orderCellToInput(order.productCode),
    productName: orderCellToInput(order.productName),
    unit: orderCellToInput(order.unit),
    quantity: orderCellToInput(order.quantity),
    stockQuantity: orderCellToInput(order.stockQuantity),
    productionOrder: orderCellToInput(order.productionOrder),
    note: orderCellToInput(order.note),
    status: (ORDER_STATUS_OPTIONS as readonly string[]).includes(order.status)
      ? order.status
      : order.status && order.status !== '-'
        ? order.status
        : ORDER_STATUS_DEFAULT
  };
}

function OrdersPanel({ onBack }: { onBack: () => void }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingOrder, setViewingOrder] = useState<OrderRow | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [creatingProductionOrderId, setCreatingProductionOrderId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [productOptions, setProductOptions] = useState<OrderProductOption[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [orderForm, setOrderForm] = useState<OrderFormState>(emptyOrderForm);

  const loadOrders = async () => {
    setIsLoadingOrders(true);
    setOrdersError('');

    try {
      const res = await fetch('/api/don-hang');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải đơn hàng từ Supabase.');
      }

      setOrders(normalizeOrders(data));
    } catch (error: any) {
      setOrders([]);
      setOrdersError(error.message || 'Không thể tải đơn hàng từ Supabase.');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (!formMode) return;

    let cancelled = false;

    const loadLookups = async () => {
      setIsLoadingLookups(true);
      setLookupError('');

      try {
        const [staffRes, customerRes, productRes] = await Promise.all([
          fetch('/api/nhan-su'),
          fetch('/api/khach-hang'),
          fetch('/api/san-pham?format=table')
        ]);

        const staffData = await staffRes.json().catch(() => ({}));
        const customerData = await customerRes.json().catch(() => ({}));
        const productData = await productRes.json().catch(() => ({}));

        if (!staffRes.ok) {
          throw new Error(staffData.error || 'Không thể tải nhân sự.');
        }
        if (!customerRes.ok) {
          throw new Error(customerData.error || 'Không thể tải khách hàng.');
        }
        if (!productRes.ok) {
          throw new Error(productData.error || 'Không thể tải hàng hóa.');
        }

        if (!cancelled) {
          setStaffOptions(normalizeStaffOptions(staffData));
          setCustomerOptions(normalizeCustomerOptions(customerData));
          setProductOptions(normalizeOrderProducts(productData));
        }
      } catch (error: any) {
        if (!cancelled) {
          setStaffOptions([]);
          setCustomerOptions([]);
          setProductOptions([]);
          setLookupError(error.message || 'Không thể tải dữ liệu tham chiếu.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLookups(false);
        }
      }
    };

    loadLookups();

    return () => {
      cancelled = true;
    };
  }, [formMode]);

  const openAddForm = () => {
    setFormError('');
    setActionMessage('');
    setEditingId(null);
    setOrderForm(emptyOrderForm());
    setFormMode('add');
  };

  const openEditForm = (order: OrderRow) => {
    setFormError('');
    setActionMessage('');
    setViewingOrder(null);
    setEditingId(order.id);
    setOrderForm(orderToForm(order));
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormError('');
  };

  const unitSuggestions = useMemo(() => {
    const fromProducts = productOptions.map(product => product.unit).filter(Boolean);
    const fromOrders = orders.map(order => order.unit).filter(unit => unit && unit !== '-');
    return [...new Set([...fromProducts, ...fromOrders, ...readUnitSuggestions()])].sort((a, b) =>
      a.localeCompare(b, 'vi')
    );
  }, [orders, productOptions]);

  const matchedProduct = useMemo(
    () => findOrderProductByCode(productOptions, orderForm.productCode),
    [orderForm.productCode, productOptions]
  );

  const handleSaveOrder = async () => {
    if (!orderForm.orderCode.trim()) {
      setFormError('Vui lòng nhập mã đơn hàng.');
      return;
    }
    if (!orderForm.productCode.trim() && !orderForm.productName.trim()) {
      setFormError('Vui lòng nhập mã hàng hoặc tên hàng.');
      return;
    }

    const resolvedFields = resolveOrderProductFields(productOptions, orderForm.productCode, {
      productName: orderForm.productName,
      unit: orderForm.unit
    });
    const payload = {
      ...orderForm,
      productName: resolvedFields.productName || orderForm.productName,
      unit: orderForm.unit.trim() || resolvedFields.unit
    };

    setIsSavingOrder(true);
    setFormError('');

    try {
      const isEdit = formMode === 'edit' && editingId;
      const res = await fetch(isEdit ? `/api/don-hang/${editingId}` : '/api/don-hang', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || (isEdit ? 'Không thể cập nhật đơn hàng.' : 'Không thể thêm đơn hàng mới.'));
      }

      if (payload.unit.trim()) {
        saveUnitSuggestion(payload.unit.trim());
      }

      closeForm();
      setActionMessage(isEdit ? 'Đã cập nhật đơn hàng.' : 'Đã thêm đơn hàng mới.');
      await loadOrders();
    } catch (error: any) {
      setFormError(error.message || 'Không thể lưu đơn hàng.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleCreateProductionOrder = async (order: OrderRow) => {
    if (!order.id) {
      setOrdersError('Không tìm thấy ID đơn hàng.');
      return;
    }

    if (orderHasProductionOrder(order)) {
      setOrdersError(`Đơn hàng đã có lệnh SX: ${order.productionOrder}`);
      return;
    }

    if (!window.confirm(`Tạo lệnh SX từ đơn "${order.orderCode || order.productCode}"?`)) return;

    setCreatingProductionOrderId(order.id);
    setOrdersError('');
    setActionMessage('');

    try {
      const res = await fetch(`/api/lenh-sx/from-don-hang/${order.id}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tạo lệnh sản xuất.');
      }

      const code = typeof data.code === 'string' ? data.code : '';
      setActionMessage(
        data.warning
          ? String(data.warning)
          : code
            ? `Đã tạo lệnh SX ${code} và ghi vào bảng lenh_sx.`
            : 'Đã tạo lệnh sản xuất.'
      );
      if (code) {
        setViewingOrder(prev => (prev?.id === order.id ? { ...prev, productionOrder: code } : prev));
      }
      await loadOrders();
    } catch (error: any) {
      setOrdersError(error.message || 'Không thể tạo lệnh sản xuất.');
    } finally {
      setCreatingProductionOrderId(null);
    }
  };

  const handleDeleteOrder = async (order: OrderRow) => {
    if (!order.id) {
      setOrdersError('Không tìm thấy ID để xóa.');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa đơn "${order.orderCode || order.productCode}"?`)) return;

    setDeletingOrderId(order.id);
    setActionMessage('');

    try {
      const res = await fetch(`/api/don-hang/${order.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa đơn hàng.');
      }

      if (viewingOrder?.id === order.id) setViewingOrder(null);
      setActionMessage('Đã xóa đơn hàng.');
      await loadOrders();
    } catch (error: any) {
      setOrdersError(error.message || 'Không thể xóa đơn hàng.');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const orderTypes = useMemo(() => {
    const types = orders
      .map(order => order.orderType)
      .filter((type): type is string => type !== '-' && type.length > 0);
    return ['all', ...[...new Set(types)].sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [orders]);
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesType = selectedType === 'all' || order.orderType === selectedType;
      const matchesSearch =
        !normalizedSearch ||
        `${order.orderCode} ${order.orderType} ${order.status} ${order.staffName} ${order.customer} ${order.productCode} ${order.productName} ${order.quantity} ${order.stockQuantity} ${order.productionOrder} ${order.note}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesType && matchesSearch;
    });
  }, [orders, normalizedSearch, selectedType]);

  const customerCount = new Set(orders.map(order => order.customer).filter(customer => customer && customer !== '-')).size;
  const totalQuantity = orders.reduce((sum, order) => {
    const value = Number(order.quantity);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Kế hoạch sản xuất</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Đơn hàng</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase don_hang.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={openAddForm}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>
              <button
                type="button"
                onClick={onBack}
                className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:border-[#ef1b2d] hover:bg-[#ef1b2d]"
              >
                Menu
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Đơn hàng', orders.length],
              ['Khách hàng', customerCount],
              ['Tổng SL', formatNumber(totalQuantity)]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="block font-bold text-zinc-400">{label}</span>
                <span className="mt-1 block text-xl font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {formMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  {formMode === 'edit' ? 'Sửa đơn hàng' : 'Thêm đơn hàng mới'}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">Ghi vào bảng don_hang trên Supabase</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            {(formError || lookupError) && (
              <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700">
                {formError || lookupError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 p-4">
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã đơn *</span>
                <input
                  value={orderForm.orderCode}
                  onChange={e => setOrderForm(prev => ({ ...prev, orderCode: e.target.value }))}
                  className={orderFieldClass}
                  placeholder="VD: DH-2026-001"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Loại đơn</span>
                <SearchableSelect
                  value={orderForm.orderType}
                  onChange={orderType => setOrderForm(prev => ({ ...prev, orderType }))}
                  options={[...ORDER_TYPE_OPTIONS]}
                  placeholder="Gõ để tìm loại đơn"
                  getLabel={item => String(item)}
                  getValue={item => String(item)}
                  allowEmpty={false}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Trạng thái</span>
                {formMode === 'add' ? (
                  <input
                    value={ORDER_STATUS_DEFAULT}
                    readOnly
                    className={`${orderFieldClass} bg-amber-50 font-black text-amber-800`}
                  />
                ) : (
                  <SearchableSelect
                    value={orderForm.status}
                    onChange={status => setOrderForm(prev => ({ ...prev, status }))}
                    options={[...ORDER_STATUS_OPTIONS]}
                    placeholder="Gõ để tìm trạng thái"
                    getLabel={item => String(item)}
                    getValue={item => String(item)}
                    allowEmpty={false}
                  />
                )}
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Nhân viên</span>
                <SimpleSelect
                  value={orderForm.staffName}
                  onChange={staffName => setOrderForm(prev => ({ ...prev, staffName }))}
                  options={staffOptions}
                  placeholder="Chọn nhân viên"
                  isLoading={isLoadingLookups}
                  getValue={item => (item as StaffOption).name}
                  getLabel={item => (item as StaffOption).name}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Khách hàng</span>
                <SimpleSelect
                  value={orderForm.customer}
                  onChange={customer => setOrderForm(prev => ({ ...prev, customer }))}
                  options={customerOptions}
                  placeholder="Chọn khách hàng"
                  isLoading={isLoadingLookups}
                  getValue={item => (item as CustomerOption).name}
                  getLabel={item => {
                    const customer = item as CustomerOption;
                    return customer.code ? `${customer.code} · ${customer.name}` : customer.name;
                  }}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã hàng</span>
                <SearchableProductCodeField
                  value={orderForm.productCode}
                  onChange={productCode => {
                    setOrderForm(prev => {
                      const resolved = resolveOrderProductFields(productOptions, productCode, {
                        productName: prev.productName,
                        unit: prev.unit
                      });
                      return {
                        ...prev,
                        productCode,
                        productName: resolved.productName,
                        unit: resolved.unit || prev.unit
                      };
                    });
                  }}
                  products={productOptions}
                  isLoading={isLoadingLookups}
                  onSelectProduct={product => {
                    if (!product) return;
                    setOrderForm(prev => ({
                      ...prev,
                      productCode: product.code || product.newCode,
                      productName: product.name,
                      unit: product.unit || prev.unit
                    }));
                  }}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tên hàng</span>
                <input
                  value={matchedProduct ? matchedProduct.name : orderForm.productName}
                  readOnly={Boolean(matchedProduct)}
                  onChange={e => setOrderForm(prev => ({ ...prev, productName: e.target.value }))}
                  className={`${orderFieldClass} ${matchedProduct ? 'bg-zinc-50 text-zinc-800' : ''}`}
                  placeholder={matchedProduct ? '' : 'Tự động theo mã hàng'}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Đơn vị</span>
                <input
                  list="order-unit-suggestions"
                  value={orderForm.unit}
                  onChange={e => setOrderForm(prev => ({ ...prev, unit: e.target.value }))}
                  onBlur={e => {
                    const trimmed = e.target.value.trim();
                    if (trimmed) saveUnitSuggestion(trimmed);
                  }}
                  className={orderFieldClass}
                  placeholder="Chọn hoặc nhập đơn vị mới"
                />
                <datalist id="order-unit-suggestions">
                  {unitSuggestions.map(unit => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Số lượng</span>
                <input
                  type="number"
                  value={orderForm.quantity}
                  onChange={e => setOrderForm(prev => ({ ...prev, quantity: e.target.value }))}
                  className={orderFieldClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Số lượng tồn</span>
                <input
                  type="number"
                  value={orderForm.stockQuantity}
                  onChange={e => setOrderForm(prev => ({ ...prev, stockQuantity: e.target.value }))}
                  className={orderFieldClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Lệnh SX</span>
                <input
                  value={orderForm.productionOrder}
                  onChange={e => setOrderForm(prev => ({ ...prev, productionOrder: e.target.value }))}
                  className={orderFieldClass}
                />
              </label>
              <label className="col-span-2 space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
                <input
                  value={orderForm.note}
                  onChange={e => setOrderForm(prev => ({ ...prev, note: e.target.value }))}
                  className={orderFieldClass}
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSavingOrder ? 'Đang lưu...' : formMode === 'edit' ? 'Cập nhật' : 'Lưu đơn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Chi tiết đơn hàng</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">{viewingOrder.orderCode}</p>
              </div>
              <button type="button" onClick={() => setViewingOrder(null)} className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50">
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 text-sm">
              {[
                ['Mã đơn', viewingOrder.orderCode],
                ['Loại đơn', viewingOrder.orderType],
                ['Trạng thái', viewingOrder.status],
                ['Nhân viên', viewingOrder.staffName],
                ['Khách hàng', viewingOrder.customer],
                ['Mã hàng', viewingOrder.productCode],
                ['Tên hàng', viewingOrder.productName],
                ['Đơn vị', viewingOrder.unit],
                ['Số lượng', viewingOrder.quantity],
                ['Số lượng tồn', viewingOrder.stockQuantity],
                ['Lệnh SX', viewingOrder.productionOrder],
                ['Ghi chú', viewingOrder.note || '-']
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="mt-1 font-bold text-zinc-900">{value || '-'}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              {!orderHasProductionOrder(viewingOrder) && (
                <button
                  type="button"
                  onClick={() => handleCreateProductionOrder(viewingOrder)}
                  disabled={creatingProductionOrderId === viewingOrder.id}
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingProductionOrderId === viewingOrder.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Factory className="h-4 w-4" />
                  )}
                  Tạo Lệnh sx
                </button>
              )}
              <button type="button" onClick={() => openEditForm(viewingOrder)} className="flex h-10 items-center gap-1.5 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100">
                <Pencil className="h-4 w-4" />
                Sửa
              </button>
              <button
                type="button"
                onClick={() => handleDeleteOrder(viewingOrder)}
                disabled={deletingOrderId === viewingOrder.id}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingOrderId === viewingOrder.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {orderTypes.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedType === type
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {type === 'all' ? 'Tất cả' : type}
            </button>
          ))}
          {isLoadingOrders && (
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
            placeholder="Tìm mã đơn, khách hàng, mã hàng..."
            disabled={isLoadingOrders}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {ordersError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {ordersError}
          </p>
        )}

        {actionMessage && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 lg:mt-0">
            {actionMessage}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1480px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã đơn</th>
                <th className="px-4 py-3 font-black">Loại đơn</th>
                <th className="px-4 py-3 font-black">Trạng thái</th>
                <th className="px-4 py-3 font-black">Nhân viên</th>
                <th className="px-4 py-3 font-black">Khách hàng</th>
                <th className="px-4 py-3 font-black">Mã hàng</th>
                <th className="px-4 py-3 font-black">Tên hàng</th>
                <th className="px-4 py-3 font-black">Đơn vị</th>
                <th className="px-4 py-3 font-black">Số lượng</th>
                <th className="px-4 py-3 font-black">Số lượng tồn</th>
                <th className="px-4 py-3 font-black">Lệnh SX</th>
                <th className="px-4 py-3 font-black">Ghi chú</th>
                <th className="px-4 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredOrders.map(order => (
                <tr key={order.id} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{order.orderCode || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#ef1b2d]/20 bg-red-50 px-2.5 py-1 text-xs font-black text-[#ef1b2d]">
                      {order.orderType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{order.staffName}</td>
                  <td className="px-4 py-3 font-bold text-zinc-800">{order.customer}</td>
                  <td className="px-4 py-3 font-black text-zinc-950">{order.productCode || '-'}</td>
                  <td className="px-4 py-3 font-black text-zinc-950">{order.productName || '-'}</td>
                  <td className="px-4 py-3 font-bold text-zinc-700">{order.unit}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{order.quantity}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{order.stockQuantity}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{order.productionOrder}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-500">{order.note || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {!orderHasProductionOrder(order) && (
                        <button
                          type="button"
                          onClick={() => handleCreateProductionOrder(order)}
                          disabled={creatingProductionOrderId === order.id}
                          title="Tạo Lệnh sx"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {creatingProductionOrderId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Factory className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setViewingOrder(order)}
                        title="Xem"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(order)}
                        title="Sửa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(order)}
                        disabled={deletingOrderId === order.id}
                        title="Xóa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingOrderId === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoadingOrders && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Bảng don_hang chưa có dữ liệu hoặc không có đơn phù hợp bộ lọc.
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

function formatTimeCell(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  const text = String(value).trim();
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return text;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

interface SettingRow {
  id: string;
  code: string;
  name: string;
  loaiCaiDat: string;
  timeFrame: string;
  startTime: string;
  endTime: string;
  group: string;
  note: string;
}

function normalizeSettings(data: unknown): SettingRow[] {
  if (!data || typeof data !== 'object') return [];
  const settings = (data as { settings?: unknown }).settings;
  if (!Array.isArray(settings)) return [];

  return settings
    .map((item): SettingRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = pickText(record, ['ma_cai_dat', 'ma', 'key', 'code'], '');
      const name = pickText(record, ['ten_cai_dat', 'hang_muc', 'ten', 'name', 'tieu_de'], '');
      const startTime = formatTimeCell(
        record.gio_bat_dau ?? record.thoi_gian_bat_dau ?? record.start_time ?? record.gio_bd
      );
      let endTime = formatTimeCell(
        record.gio_ket_thuc ?? record.thoi_gian_ket_thuc ?? record.end_time ?? record.gio_kt
      );
      if (startTime === '-' || endTime === '-') {
        const legacyValue = formatCell(record.gia_tri);
        if (legacyValue !== '-') {
          const parts = legacyValue.split(/\s*[-–—]\s*|\s+đến\s+/i).map(part => part.trim()).filter(Boolean);
          if (parts[0]) {
            const parsedStart = formatTimeCell(parts[0]);
            if (parsedStart !== '-') {
              const parsedEnd = parts[1] ? formatTimeCell(parts[1]) : '-';
              return {
                id: pickText(record, ['id'], code || name),
                code,
                name,
                loaiCaiDat: pickText(record, ['loai_cai_dat', 'loai'], '-'),
                timeFrame: pickText(record, ['khung_gio'], '-'),
                startTime: startTime === '-' ? parsedStart : startTime,
                endTime: endTime === '-' ? parsedEnd : endTime,
                group: pickText(record, ['nhom', 'group', 'phan_loai'], '-'),
                note: pickText(record, ['mo_ta', 'ghi_chu', 'note', 'description'], '')
              };
            }
          }
        }
      }
      if (!code && !name && startTime === '-' && endTime === '-') return null;

      return {
        id: pickText(record, ['id'], code || name),
        code,
        name,
        loaiCaiDat: pickText(record, ['loai_cai_dat', 'loai'], '-'),
        timeFrame: pickText(record, ['khung_gio'], '-'),
        startTime,
        endTime,
        group: pickText(record, ['nhom', 'group', 'phan_loai'], '-'),
        note: pickText(record, ['mo_ta', 'ghi_chu', 'note', 'description'], '')
      };
    })
    .filter((setting): setting is SettingRow => Boolean(setting));
}

const SETTING_TYPE_OPTIONS = ['Thời gian', 'Ca máy', 'Sản xuất', 'Chung'] as const;

type SettingFormState = {
  code: string;
  name: string;
  loaiCaiDat: string;
  startTime: string;
  endTime: string;
  group: string;
  note: string;
};

const emptySettingForm = (): SettingFormState => ({
  code: '',
  name: '',
  loaiCaiDat: SETTING_TYPE_OPTIONS[0],
  startTime: '',
  endTime: '',
  group: 'Chung',
  note: ''
});

function settingToForm(setting: SettingRow): SettingFormState {
  const loaiCaiDat = (SETTING_TYPE_OPTIONS as readonly string[]).includes(setting.loaiCaiDat)
    ? setting.loaiCaiDat
    : SETTING_TYPE_OPTIONS[0];

  return {
    code: setting.code === '-' ? '' : setting.code,
    name: setting.name === '-' ? '' : setting.name,
    loaiCaiDat,
    startTime: setting.startTime === '-' ? '' : setting.startTime,
    endTime: setting.endTime === '-' ? '' : setting.endTime,
    group: setting.group === '-' ? 'Chung' : setting.group,
    note: setting.note === '-' ? '' : setting.note
  };
}

function SettingsPanel({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingSetting, setViewingSetting] = useState<SettingRow | null>(null);
  const [deletingSettingId, setDeletingSettingId] = useState<string | null>(null);
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [settingForm, setSettingForm] = useState<SettingFormState>(emptySettingForm);

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    setSettingsError('');

    try {
      const res = await fetch('/api/cai-dat');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải cài đặt từ Supabase.');
      }

      setSettings(normalizeSettings(data));
    } catch (error: any) {
      setSettings([]);
      setSettingsError(error.message || 'Không thể tải cài đặt từ Supabase.');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const openAddForm = () => {
    setFormError('');
    setActionMessage('');
    setEditingId(null);
    setSettingForm(emptySettingForm());
    setFormMode('add');
  };

  const openEditForm = (setting: SettingRow) => {
    setFormError('');
    setActionMessage('');
    setViewingSetting(null);
    setEditingId(setting.id);
    setSettingForm(settingToForm(setting));
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormError('');
  };

  const validateSettingForm = () => {
    if (!settingForm.code.trim()) {
      setFormError('Vui lòng nhập mã cài đặt.');
      return false;
    }
    if (!settingForm.name.trim()) {
      setFormError('Vui lòng nhập hạng mục / tên cài đặt.');
      return false;
    }
    if (!settingForm.loaiCaiDat.trim()) {
      setFormError('Vui lòng chọn loại cài đặt (loai_cai_dat).');
      return false;
    }
    if (!settingForm.startTime) {
      setFormError('Vui lòng chọn giờ bắt đầu.');
      return false;
    }
    if (!settingForm.endTime) {
      setFormError('Vui lòng chọn giờ kết thúc.');
      return false;
    }
    return true;
  };

  const handleSaveSetting = async () => {
    if (!validateSettingForm()) return;

    setIsSavingSetting(true);
    setFormError('');

    try {
      const payload = {
        ...settingForm,
        khungGio: `${settingForm.startTime} - ${settingForm.endTime}`
      };
      const isEdit = formMode === 'edit' && editingId;
      const res = await fetch(isEdit ? `/api/cai-dat/${editingId}` : '/api/cai-dat', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || (isEdit ? 'Không thể cập nhật cài đặt.' : 'Không thể thêm cài đặt mới.'));
      }

      closeForm();
      setActionMessage(isEdit ? 'Đã cập nhật cài đặt.' : 'Đã thêm cài đặt mới.');
      await loadSettings();
    } catch (error: any) {
      setFormError(error.message || 'Không thể lưu cài đặt.');
    } finally {
      setIsSavingSetting(false);
    }
  };

  const handleDeleteSetting = async (setting: SettingRow) => {
    if (!setting.id) {
      setActionMessage('Không tìm thấy ID để xóa.');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa cài đặt "${setting.name || setting.code}"?`)) return;

    setDeletingSettingId(setting.id);
    setActionMessage('');

    try {
      const res = await fetch(`/api/cai-dat/${setting.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa cài đặt.');
      }

      if (viewingSetting?.id === setting.id) setViewingSetting(null);
      setActionMessage('Đã xóa cài đặt.');
      await loadSettings();
    } catch (error: any) {
      setActionMessage(error.message || 'Không thể xóa cài đặt.');
    } finally {
      setDeletingSettingId(null);
    }
  };

  const settingGroups = useMemo(() => {
    const groups = settings
      .map(setting => setting.group)
      .filter((group): group is string => group !== '-' && group.length > 0);
    return ['all', ...[...new Set(groups)].sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [settings]);

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredSettings = useMemo(() => {
    return settings.filter(setting => {
      const matchesGroup = selectedGroup === 'all' || setting.group === selectedGroup;
      const matchesSearch =
        !normalizedSearch ||
        `${setting.code} ${setting.name} ${setting.loaiCaiDat} ${setting.timeFrame} ${setting.startTime} ${setting.endTime} ${setting.group} ${setting.note}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesGroup && matchesSearch;
    });
  }, [normalizedSearch, selectedGroup, settings]);

  const filledTimeRangeCount = settings.filter(
    setting => setting.startTime !== '-' && setting.endTime !== '-'
  ).length;

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Tham số hệ thống</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Cài đặt</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase cai_dat_thoi_gian.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={openAddForm}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>
              <button
                type="button"
                onClick={onBack}
                className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:border-[#ef1b2d] hover:bg-[#ef1b2d]"
              >
                Menu
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Mục cài đặt', settings.length],
              ['Nhóm', settingGroups.length > 0 ? settingGroups.length - 1 : 0],
              ['Đủ khung giờ', filledTimeRangeCount]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="block font-bold text-zinc-400">{label}</span>
                <span className="mt-1 block text-xl font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {formMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  {formMode === 'edit' ? 'Sửa cài đặt' : 'Thêm cài đặt mới'}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">Ghi vào bảng cai_dat_thoi_gian trên Supabase</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
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
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã cài đặt *</span>
                <input
                  value={settingForm.code}
                  onChange={e => setSettingForm(prev => ({ ...prev, code: e.target.value }))}
                  className={orderFieldClass}
                  placeholder="VD: TG_CA_SANG"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Hạng mục *</span>
                <input
                  value={settingForm.name}
                  onChange={e => setSettingForm(prev => ({ ...prev, name: e.target.value }))}
                  className={orderFieldClass}
                  placeholder="VD: Ca sáng"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Loại cài đặt *</span>
                <SearchableSelect
                  value={settingForm.loaiCaiDat}
                  onChange={loaiCaiDat => setSettingForm(prev => ({ ...prev, loaiCaiDat }))}
                  options={[...SETTING_TYPE_OPTIONS]}
                  placeholder="Gõ để tìm loại cài đặt"
                  getLabel={item => String(item)}
                  getValue={item => String(item)}
                  allowEmpty={false}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Giờ bắt đầu *</span>
                <input
                  type="time"
                  value={settingForm.startTime}
                  onChange={e => setSettingForm(prev => ({ ...prev, startTime: e.target.value }))}
                  className={orderFieldClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Giờ kết thúc *</span>
                <input
                  type="time"
                  value={settingForm.endTime}
                  onChange={e => setSettingForm(prev => ({ ...prev, endTime: e.target.value }))}
                  className={orderFieldClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Nhóm</span>
                <input
                  value={settingForm.group}
                  onChange={e => setSettingForm(prev => ({ ...prev, group: e.target.value }))}
                  className={orderFieldClass}
                  placeholder="VD: Thời gian"
                />
              </label>
              <label className="col-span-2 space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
                <input
                  value={settingForm.note}
                  onChange={e => setSettingForm(prev => ({ ...prev, note: e.target.value }))}
                  className={orderFieldClass}
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveSetting}
                disabled={isSavingSetting}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingSetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSavingSetting ? 'Đang lưu...' : formMode === 'edit' ? 'Cập nhật' : 'Lưu cài đặt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingSetting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Chi tiết cài đặt</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">{viewingSetting.code || viewingSetting.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingSetting(null)}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            <div className="space-y-3 p-4 text-sm">
              {[
                ['Mã cài đặt', viewingSetting.code],
                ['Hạng mục', viewingSetting.name],
                ['Loại cài đặt', viewingSetting.loaiCaiDat],
                ['Khung giờ', viewingSetting.timeFrame !== '-' ? viewingSetting.timeFrame : `${viewingSetting.startTime} - ${viewingSetting.endTime}`],
                ['Giờ bắt đầu', viewingSetting.startTime],
                ['Giờ kết thúc', viewingSetting.endTime],
                ['Nhóm', viewingSetting.group],
                ['Ghi chú', viewingSetting.note || '-']
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="mt-1 font-bold text-zinc-900">{value || '-'}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={() => openEditForm(viewingSetting)}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100"
              >
                <Pencil className="h-4 w-4" />
                Sửa
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSetting(viewingSetting)}
                disabled={deletingSettingId === viewingSetting.id}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingSettingId === viewingSetting.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {settingGroups.map(group => (
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
          {isLoadingSettings && (
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
            placeholder="Tìm mã, tên, giá trị cài đặt..."
            disabled={isLoadingSettings}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {settingsError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {settingsError}
          </p>
        )}

        {actionMessage && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 lg:mt-0">
            {actionMessage}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã</th>
                <th className="px-4 py-3 font-black">Tên cài đặt</th>
                <th className="px-4 py-3 font-black">Loại</th>
                <th className="px-4 py-3 font-black">Giờ bắt đầu</th>
                <th className="px-4 py-3 font-black">Giờ kết thúc</th>
                <th className="px-4 py-3 font-black">Nhóm</th>
                <th className="px-4 py-3 font-black">Ghi chú</th>
                <th className="px-4 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredSettings.map(setting => (
                <tr key={setting.id} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{setting.code || '-'}</td>
                  <td className="px-4 py-3 font-black text-zinc-950">{setting.name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-black text-zinc-800">
                      {setting.loaiCaiDat}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#ef1b2d]/20 bg-red-50 px-2.5 py-1 text-xs font-black text-[#ef1b2d]">
                      {setting.startTime}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-black text-zinc-800">
                      {setting.endTime}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{setting.group}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-500">{setting.note || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingSetting(setting)}
                        title="Xem"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(setting)}
                        title="Sửa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSetting(setting)}
                        disabled={deletingSettingId === setting.id}
                        title="Xóa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingSettingId === setting.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoadingSettings && filteredSettings.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Bảng cai_dat_thoi_gian chưa có dữ liệu hoặc không có mục phù hợp bộ lọc.
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

function flattenHrMembers(branches: HrBranch[]): HrMember[] {
  return branches.flatMap(branch => branch.departments.flatMap(department => department.members));
}

function DashboardWindow({
  title,
  subtitle,
  icon: Icon,
  accentClass,
  count,
  countLabel,
  search,
  onSearchChange,
  isLoading,
  error,
  onOpen,
  openLabel,
  secondaryAction,
  compact = false,
  children
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  count: number;
  countLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
  error: string;
  onOpen: () => void;
  openLabel: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm ${
        compact ? 'min-h-[300px]' : 'min-h-[440px]'
      }`}
    >
      <div className={`flex items-start justify-between gap-2 border-b border-zinc-100 ${compact ? 'px-3 py-2' : 'px-4 py-3'} ${accentClass}`}>
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={`flex shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 ${
              compact ? 'h-8 w-8' : 'h-10 w-10'
            }`}
          >
            <Icon className={compact ? 'h-4 w-4 text-white' : 'h-5 w-5 text-white'} />
          </span>
          <div className="min-w-0">
            <h3 className={`font-black text-white ${compact ? 'text-sm' : 'text-base'}`}>{title}</h3>
            {!compact && <p className="mt-0.5 text-xs font-semibold text-white/75">{subtitle}</p>}
            <p className={`font-bold uppercase tracking-wider text-white/60 ${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-[11px]'}`}>
              {countLabel}: <span className="text-white">{isLoading ? '...' : count}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled || secondaryAction.loading}
              className="rounded-lg border border-white/30 bg-white/15 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {secondaryAction.loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang tạo...
                </span>
              ) : (
                secondaryAction.label
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onOpen}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-white/20"
          >
            {openLabel}
          </button>
        </div>
      </div>

      <div className={`flex flex-1 flex-col ${compact ? 'p-2' : 'p-3'}`}>
        <label className={`flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-2 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 ${compact ? 'h-8' : 'h-10'}`}>
          <Search className={`text-zinc-400 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
          <input
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Lọc nhanh..."
            disabled={isLoading}
            className={`min-w-0 flex-1 bg-transparent font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none ${compact ? 'text-xs' : 'text-sm'}`}
          />
        </label>

        {error && (
          <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-100">
          {isLoading ? (
            <div className={`flex h-full items-center justify-center font-bold text-zinc-400 ${compact ? 'min-h-[160px] text-xs' : 'min-h-[240px] text-sm'}`}>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang tải...
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </section>
  );
}

function ControlBoardPanel({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  const [staffBranches, setStaffBranches] = useState<HrBranch[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [machineSearch, setMachineSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [productionOrderSearch, setProductionOrderSearch] = useState('');
  const [showAddProductionOrder, setShowAddProductionOrder] = useState(false);

  const loadBoard = async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const [staffRes, orderRes, productRes, machineRes, materialRes, productionRes] = await Promise.all([
        fetch('/api/nhan-su?format=groups'),
        fetch('/api/don-hang'),
        fetch('/api/san-pham?format=table'),
        fetch('/api/danh-sach-may'),
        fetch('/api/kho-nvl'),
        fetch('/api/lenh-sx')
      ]);

      const staffData = await staffRes.json().catch(() => ({}));
      const orderData = await orderRes.json().catch(() => ({}));
      const productData = await productRes.json().catch(() => ({}));
      const machineData = await machineRes.json().catch(() => ({}));
      const materialData = await materialRes.json().catch(() => ({}));
      const productionData = await productionRes.json().catch(() => ({}));

      if (!staffRes.ok) throw new Error(staffData.error || 'Không thể tải nhân sự.');
      if (!orderRes.ok) throw new Error(orderData.error || 'Không thể tải đơn hàng.');
      if (!productRes.ok) throw new Error(productData.error || 'Không thể tải sản phẩm.');
      if (!machineRes.ok) throw new Error(machineData.error || 'Không thể tải danh sách máy.');
      if (!materialRes.ok) throw new Error(materialData.error || 'Không thể tải kho NVL.');
      if (!productionRes.ok) throw new Error(productionData.error || 'Không thể tải lệnh sản xuất.');

      setStaffBranches(normalizeHrBranches(staffData));
      setOrders(normalizeOrders(orderData));
      setProducts(normalizeProducts(productData));
      setMachines(normalizeMachines(machineData));
      setMaterials(normalizeMaterialsInventory(materialData));
      setProductionOrders(normalizeProductionOrders(productionData));
    } catch (error: any) {
      setStaffBranches([]);
      setOrders([]);
      setProducts([]);
      setMachines([]);
      setMaterials([]);
      setProductionOrders([]);
      setLoadError(error.message || 'Không thể tải dữ liệu bảng điều khiển.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, []);

  const staffMembers = useMemo(() => flattenHrMembers(staffBranches), [staffBranches]);
  const staffQuery = staffSearch.trim().toLowerCase();
  const filteredStaff = useMemo(() => {
    if (!staffQuery) return staffMembers;
    return staffMembers.filter(member =>
      `${member.name} ${member.role} ${member.shift} ${member.status}`.toLowerCase().includes(staffQuery)
    );
  }, [staffMembers, staffQuery]);

  const orderQuery = orderSearch.trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    if (!orderQuery) return orders;
    return orders.filter(order =>
      `${order.orderCode} ${order.productCode} ${order.productName} ${order.customer} ${order.status} ${order.quantity} ${order.stockQuantity}`
        .toLowerCase()
        .includes(orderQuery)
    );
  }, [orders, orderQuery]);

  const productQuery = productSearch.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    if (!productQuery) return products;
    return products.filter(product =>
      `${product.code} ${product.name} ${product.group} ${product.nature}`.toLowerCase().includes(productQuery)
    );
  }, [products, productQuery]);

  const machineQuery = machineSearch.trim().toLowerCase();
  const filteredMachines = useMemo(() => {
    if (!machineQuery) return machines;
    return machines.filter(machine =>
      `${machine.code} ${machine.name} ${machine.type} ${machine.branch} ${machine.location} ${machine.status}`
        .toLowerCase()
        .includes(machineQuery)
    );
  }, [machines, machineQuery]);

  const materialQuery = materialSearch.trim().toLowerCase();
  const filteredMaterials = useMemo(() => {
    if (!materialQuery) return materials;
    return materials.filter(material =>
      `${material.code} ${material.name} ${material.unit}`.toLowerCase().includes(materialQuery)
    );
  }, [materials, materialQuery]);

  const productionOrderQuery = productionOrderSearch.trim().toLowerCase();
  const recentProductionOrders = useMemo(() => {
    const sorted = [...productionOrders].sort((a, b) => {
      const idA = Number(a.id);
      const idB = Number(b.id);
      if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) {
        return idB - idA;
      }
      return `${b.startDate} ${b.code}`.localeCompare(`${a.startDate} ${a.code}`, 'vi');
    });

    if (!productionOrderQuery) return sorted;

    return sorted.filter(row =>
      `${row.code} ${row.name} ${row.productCode} ${row.productName} ${row.customer} ${row.orderRef} ${row.status} ${row.machine}`
        .toLowerCase()
        .includes(productionOrderQuery)
    );
  }, [productionOrders, productionOrderQuery]);

  const previewLimit = 12;
  const sidePreviewLimit = 6;
  const productionPreviewLimit = 20;

  return (
    <div className="mx-auto w-full max-w-[1880px] space-y-4">
      {loadError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {loadError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <DashboardWindow
          title="Nhân sự"
          subtitle="Danh sách thợ máy, phụ máy theo ca"
          icon={UsersRound}
          accentClass="bg-gradient-to-r from-zinc-950 to-zinc-800"
          count={staffMembers.length}
          countLabel="NV"
          search={staffSearch}
          onSearchChange={setStaffSearch}
          isLoading={isLoading}
          error=""
          onOpen={() => onNavigate('hr')}
          openLabel="Mở"
          compact
        >
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-zinc-100 text-[9px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-2 py-1.5 font-black">Tên</th>
                <th className="px-2 py-1.5 font-black">Ca</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredStaff.slice(0, sidePreviewLimit).map(member => (
                <tr key={member.id} className="hover:bg-red-50/50">
                  <td className="px-2 py-1.5 font-bold text-zinc-900">{member.name}</td>
                  <td className="px-2 py-1.5 text-zinc-600">{member.shift}</td>
                </tr>
              ))}
              {!isLoading && filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-2 py-4 text-center text-[10px] font-bold text-zinc-400">Không có nhân sự.</td>
                </tr>
              )}
            </tbody>
          </table>
        </DashboardWindow>

        <div className="xl:col-span-2">
          <DashboardWindow
            title="Lệnh sản xuất"
            subtitle="Các dòng lệnh mới nhất từ bảng lenh_sx"
            icon={Factory}
            accentClass="bg-gradient-to-r from-emerald-900 to-emerald-700"
            count={productionOrders.length}
            countLabel="Lệnh"
            search={productionOrderSearch}
            onSearchChange={setProductionOrderSearch}
            isLoading={isLoading}
            error=""
            onOpen={() => onNavigate('production-orders')}
            openLabel="Mở Lệnh SX"
            secondaryAction={{
              label: 'Thêm mới',
              onClick: () => setShowAddProductionOrder(true)
            }}
          >
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="sticky top-0 bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-black">Mã lệnh</th>
                  <th className="px-3 py-2 font-black">Tên lệnh</th>
                  <th className="px-3 py-2 font-black">Mã hàng</th>
                  <th className="px-3 py-2 font-black">Tên hàng</th>
                  <th className="px-3 py-2 font-black">SL</th>
                  <th className="px-3 py-2 font-black">ĐVT</th>
                  <th className="px-3 py-2 font-black">Trạng thái</th>
                  <th className="px-3 py-2 font-black">Đơn hàng</th>
                  <th className="px-3 py-2 font-black">Khách</th>
                  <th className="px-3 py-2 font-black">Bắt đầu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentProductionOrders.slice(0, productionPreviewLimit).map(row => (
                  <tr key={row.id} className="hover:bg-emerald-50/50">
                    <td className="px-3 py-2 font-black text-zinc-950">{row.code || '-'}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-800">{row.name || '-'}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-700">{row.productCode || '-'}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-800">{row.productName || '-'}</td>
                    <td className="px-3 py-2 font-mono font-bold text-zinc-700">{row.quantity}</td>
                    <td className="px-3 py-2 font-bold text-zinc-700">{row.unit}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-zinc-600">{row.orderRef}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-600">{row.customer}</td>
                    <td className="px-3 py-2 font-mono text-[11px] font-bold text-zinc-600">{row.startDate}</td>
                  </tr>
                ))}
                {!isLoading && recentProductionOrders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center font-bold text-zinc-400">
                      Chưa có lệnh SX. Tạo lệnh từ trang Đơn hàng.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DashboardWindow>
        </div>

        <DashboardWindow
          title="Danh sách máy"
          subtitle="Ảnh máy, mã, tên và trạng thái vận hành"
          icon={Cpu}
          accentClass="bg-gradient-to-r from-emerald-900 to-emerald-700"
          count={machines.length}
          countLabel="Máy"
          search={machineSearch}
          onSearchChange={setMachineSearch}
          isLoading={isLoading}
          error=""
          onOpen={() => onNavigate('machines')}
          openLabel="Mở"
          compact
        >
          <div className="grid grid-cols-1 gap-1.5 p-0.5">
            {filteredMachines.slice(0, sidePreviewLimit).map(machine => (
              <div
                key={machine.id}
                className="flex gap-2 overflow-hidden rounded-lg border border-zinc-200 bg-white p-1.5 transition hover:border-[#ef1b2d]/30"
              >
                {machine.imageUrl ? (
                  <a
                    href={machine.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-12 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-100"
                  >
                    <img
                      src={machine.imageUrl}
                      alt={`Ảnh ${machine.name || machine.code}`}
                      className="h-full w-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-zinc-50 text-zinc-400">
                    <Cpu className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[9px] font-black uppercase tracking-wider text-zinc-400">
                    {machine.code || '-'}
                  </p>
                  <p className="truncate text-[11px] font-black text-zinc-900">{machine.name || '-'}</p>
                  <span className="inline-block rounded-full border border-[#ef1b2d]/20 bg-red-50 px-1.5 py-0.5 text-[9px] font-black text-[#ef1b2d]">
                    {machine.status}
                  </span>
                </div>
              </div>
            ))}
            {!isLoading && filteredMachines.length === 0 && (
              <div className="py-6 text-center text-[10px] font-bold text-zinc-400">Không có máy.</div>
            )}
          </div>
        </DashboardWindow>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashboardWindow
          title="Đơn hàng"
          subtitle="Mã đơn, hàng hóa, số lượng và trạng thái"
          icon={ClipboardList}
          accentClass="bg-gradient-to-r from-[#ef1b2d] to-[#b30d1c]"
          count={orders.length}
          countLabel="Đơn"
          search={orderSearch}
          onSearchChange={setOrderSearch}
          isLoading={isLoading}
          error=""
          onOpen={() => onNavigate('orders')}
          openLabel="Mở Đơn hàng"
        >
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-black">Mã đơn</th>
                <th className="px-3 py-2 font-black">Hàng</th>
                <th className="px-3 py-2 font-black">Số lượng</th>
                <th className="px-3 py-2 font-black">Số lượng tồn</th>
                <th className="px-3 py-2 font-black">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredOrders.slice(0, previewLimit).map(order => (
                <tr key={order.id} className="hover:bg-red-50/50">
                  <td className="px-3 py-2 font-bold text-zinc-900">{order.orderCode || '-'}</td>
                  <td className="px-3 py-2 text-zinc-700">{order.productCode || order.productName || '-'}</td>
                  <td className="px-3 py-2 font-mono font-bold text-zinc-700">{order.quantity}</td>
                  <td className="px-3 py-2 font-mono font-bold text-zinc-700">{order.stockQuantity}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800">
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center font-bold text-zinc-400">Không có đơn hàng.</td>
                </tr>
              )}
            </tbody>
          </table>
        </DashboardWindow>

        <DashboardWindow
          title="Sản phẩm"
          subtitle="Mã hàng, tên và nhóm VTHH"
          icon={Package}
          accentClass="bg-gradient-to-r from-zinc-900 to-zinc-700"
          count={products.length}
          countLabel="Mã SP"
          search={productSearch}
          onSearchChange={setProductSearch}
          isLoading={isLoading}
          error=""
          onOpen={() => onNavigate('products')}
          openLabel="Mở Sản phẩm"
        >
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-black">Mã</th>
                <th className="px-3 py-2 font-black">Tên</th>
                <th className="px-3 py-2 font-black">Nhóm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredProducts.slice(0, previewLimit).map(product => (
                <tr key={product.id} className="hover:bg-red-50/50">
                  <td className="px-3 py-2 font-bold text-zinc-900">{product.code || '-'}</td>
                  <td className="px-3 py-2 text-zinc-800">{product.name || '-'}</td>
                  <td className="px-3 py-2 text-zinc-600">{product.group}</td>
                </tr>
              ))}
              {!isLoading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center font-bold text-zinc-400">Không có sản phẩm.</td>
                </tr>
              )}
            </tbody>
          </table>
        </DashboardWindow>

        <DashboardWindow
          title="Kho NVL"
          subtitle="Nguyên phụ liệu từ bảng kho_nvl"
          icon={Boxes}
          accentClass="bg-gradient-to-r from-amber-900 to-amber-700"
          count={materials.length}
          countLabel="NVL"
          search={materialSearch}
          onSearchChange={setMaterialSearch}
          isLoading={isLoading}
          error=""
          onOpen={() => onNavigate('materials')}
          openLabel="Mở Kho NVL"
        >
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-black">Mã NVL</th>
                <th className="px-3 py-2 font-black">Tên</th>
                <th className="px-3 py-2 font-black">ĐVT</th>
                <th className="px-3 py-2 font-black">Tồn đầu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredMaterials.slice(0, previewLimit).map(material => (
                <tr key={material.id} className="hover:bg-red-50/50">
                  <td className="px-3 py-2 font-bold text-zinc-900">{material.code || '-'}</td>
                  <td className="px-3 py-2 text-zinc-800">{material.name || '-'}</td>
                  <td className="px-3 py-2 text-zinc-600">{material.unit}</td>
                  <td className="px-3 py-2 font-mono font-bold text-zinc-700">{material.openingStock}</td>
                </tr>
              ))}
              {!isLoading && filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center font-bold text-zinc-400">Không có NVL.</td>
                </tr>
              )}
            </tbody>
          </table>
        </DashboardWindow>
      </div>

      <AddProductionOrderModal
        open={showAddProductionOrder}
        onClose={() => setShowAddProductionOrder(false)}
        onCreated={loadBoard}
      />
    </div>
  );
}

function HumanResourcesPanel({ onBack }: { onBack: () => void }) {
  const [branches, setBranches] = useState<HrBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadStaffGroups = async () => {
      setIsLoadingStaff(true);
      setStaffError('');

      try {
        const res = await fetch('/api/nhan-su?format=groups');
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải nhân sự từ Supabase.');
        }

        const nextBranches = normalizeHrBranches(data);
        if (!cancelled) {
          setBranches(nextBranches);
          setSelectedBranchId(prev => prev || nextBranches[0]?.id || '');
        }
      } catch (error: any) {
        if (!cancelled) {
          setBranches([]);
          setStaffError(error.message || 'Không thể tải nhân sự từ Supabase.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStaff(false);
        }
      }
    };

    loadStaffGroups();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBranch = branches.find(branch => branch.id === selectedBranchId) ?? branches[0];
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredDepartments = useMemo(() => {
    if (!selectedBranch) return [];
    if (!normalizedSearch) return selectedBranch.departments;

    return selectedBranch.departments
      .map(department => ({
        ...department,
        members: department.members.filter(member =>
          `${member.name} ${member.role} ${member.shift}`.toLowerCase().includes(normalizedSearch)
        )
      }))
      .filter(department =>
        department.name.toLowerCase().includes(normalizedSearch) ||
        department.lead.toLowerCase().includes(normalizedSearch) ||
        department.members.length > 0
      );
  }, [normalizedSearch, selectedBranch]);

  const totalDepartments = selectedBranch?.departments.length ?? 0;
  const totalMembers = selectedBranch?.departments.reduce((sum, department) => sum + department.members.length, 0) ?? 0;
  const activeMembers = selectedBranch?.departments.reduce(
    (sum, department) => sum + department.members.filter(member => member.status === 'Đang làm').length,
    0
  ) ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Quản lý nhân sự</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Chi nhánh & Phòng ban</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Phòng ban Sản xuất · Chi nhánh Đà Nẵng.
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:border-[#ef1b2d] hover:bg-[#ef1b2d]"
            >
              Menu
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Phòng ban', totalDepartments],
              ['Nhân sự', totalMembers],
              ['Đang làm', activeMembers]
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
          {branches.map(branch => (
            <button
              key={branch.id}
              type="button"
              onClick={() => setSelectedBranchId(branch.id)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedBranchId === branch.id
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {branch.shortName}
            </button>
          ))}
          {isLoadingStaff && (
            <div className="flex h-11 shrink-0 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-500">
              Đang tải Supabase...
            </div>
          )}
        </div>

        <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 lg:mt-0 lg:w-[360px]">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Tìm tên, chức vụ, ca làm..."
            disabled={isLoadingStaff || branches.length === 0}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {staffError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {staffError}
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {!isLoadingStaff && !staffError && branches.length === 0 && (
          <div className="rounded-2xl border-2 border-zinc-900/10 bg-white px-4 py-8 text-center text-sm font-bold text-zinc-500">
            Supabase chưa có dữ liệu nhân sự để hiển thị.
          </div>
        )}

        {filteredDepartments.map(department => (
          <article
            key={department.id}
            className="overflow-hidden rounded-xl border-2 border-zinc-900/10 bg-white shadow-sm"
          >
            <div className="flex items-start justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2">
              <div className="flex min-w-0 gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-[#ef1b2d]">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black leading-tight text-zinc-950">{department.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#ef1b2d]" />
                    <span className="truncate">Trưởng nhóm: {department.lead}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Thêm nhân sự vào ${department.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ef1b2d] text-white transition hover:bg-[#b30d1c]"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-zinc-100">
              {department.members.map(member => (
                <div key={`${department.id}-${member.name}`} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-xs font-black text-white">
                    {member.name.split(' ').slice(-1)[0].charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black leading-tight text-zinc-950">{member.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <BriefcaseBusiness className="h-3 w-3" />
                        {member.role}
                      </span>
                      <span className="rounded-full border border-zinc-200 px-1.5 py-0.5">{member.shift}</span>
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-black ${
                    member.status === 'Đang làm'
                      ? 'border-[#ef1b2d]/20 bg-red-50 text-[#ef1b2d]'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                  }`}>
                    {member.status}
                  </span>
                  <button type="button" className="h-7 w-7 shrink-0 rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-950">
                    <MoreVertical className="mx-auto h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {department.members.length === 0 && (
                <div className="px-4 py-5 text-center text-sm font-semibold text-zinc-500">
                  Không có nhân sự phù hợp bộ lọc.
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

const DEFAULT_REPORT: Omit<ProductionReport, 'id' | 'createdAt'> = {
  date: new Date().toISOString().split('T')[0],
  shiftInfo: {
    machineId: '',
    shiftName: '',
    operatorName: '',
    assistantName: ''
  },
  productEntry: {
    productCode: '',
    rolls: 0,
    actualWeight: 0
  },
  materials: {
    virginPlastic: [0],
    recycledPlastic: [0],
    brightenerPowder: [0],
    dispersionOil: [0],
    otherAdditives: [0]
  },
  wasteWeight: 0,
  notes: ''
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => tabFromPath(window.location.pathname));
  const [currentStep, setCurrentStep] = useState<number>(1); // 1: Shift & Product, 2: Materials, 3: Waste & Submit
  const [reportForm, setReportForm] = useState<Omit<ProductionReport, 'id' | 'createdAt'>>(DEFAULT_REPORT);
  const [reports, setReports] = useState<ProductionReport[]>(() => readCachedReports());
  
  // App states
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [isFetchLoading, setIsFetchLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notifications, setNotifications] = useState<{ id: string; text: string; type: 'success' | 'error' | 'warning' }[]>([]);
  const [offlineReports, setOfflineReports] = useState<ProductionReport[]>([]);
  const navigateToTab = (tab: AppTab, options?: { replace?: boolean }) => {
    const path = pathFromTab(tab);

    if (window.location.pathname !== path) {
      if (options?.replace) {
        window.history.replaceState({ tab }, '', path);
      } else {
        window.history.pushState({ tab }, '', path);
      }
    }

    setActiveTab(tab);

    if (tab === 'dashboard') {
      fetchReports();
    }
  };

  const handleNavClick = (event: React.MouseEvent<HTMLAnchorElement>, tab: AppTab) => {
    event.preventDefault();
    navigateToTab(tab);
  };

  // 1. Fetch reports from Server DB
  const fetchReports = async () => {
    setIsFetchLoading(true);
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data);
        localStorage.setItem(STORAGE_REPORTS_CACHE_KEY, JSON.stringify(data));
      } else {
        const cached = readCachedReports();
        if (cached.length > 0) {
          setReports(cached);
        }
        addNotification('Không thể lấy báo cáo từ máy chủ. Đang hiển thị bản lưu thiết bị.', 'warning');
      }
    } catch (err) {
      const cached = readCachedReports();
      if (cached.length > 0) {
        setReports(cached);
        addNotification('Mất kết nối máy chủ. Đang hiển thị bản lưu thiết bị.', 'warning');
      } else {
        addNotification('Mất kết nối máy chủ dữ liệu. Kiểm tra sóng di động.', 'warning');
      }
    } finally {
      setIsFetchLoading(false);
    }
  };

  // Sync / loading on mount
  useEffect(() => {
    fetchReports();

    // Check navigator online status
    const handleOnline = () => {
      setIsOnline(true);
      addNotification('Thiết bị trực tuyến bản ghi. Sẵn sàng đồng bộ!', 'success');
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      addNotification('Đã ngắt mạng kết nối. Đang kích hoạt lưu cục bộ.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handlePopState = () => {
      const tab = tabFromPath(window.location.pathname);
      setActiveTab(tab);
      if (tab === 'dashboard') {
        fetchReports();
      }
    };
    window.addEventListener('popstate', handlePopState);

    // Load draft from localStorage on start
    const cachedDraft = localStorage.getItem(STORAGE_DRAFT_KEY);
    if (cachedDraft) {
      try {
        setReportForm(JSON.parse(cachedDraft));
      } catch (e) {
        console.error('Lỗi khi phục hồi bản nháp:', e);
      }
    }

    // Load offline queue
    const cachedQueue = localStorage.getItem(STORAGE_OFFLINE_KEY);
    if (cachedQueue) {
      try {
        setOfflineReports(JSON.parse(cachedQueue));
      } catch (e) {
        console.error('Lỗi phục hồi hàng chờ ngoại tuyến:', e);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Sync draft to storage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(reportForm));
  }, [reportForm]);

  // Sync offline queue to storage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_OFFLINE_KEY, JSON.stringify(offlineReports));
  }, [offlineReports]);

  // Helper to add floating toast notifications
  const addNotification = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = `${Date.now()}`;
    setNotifications(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Submit a production report
  const handleSubmitReport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Complete form validation
    const { machineId, shiftName, operatorName, assistantName } = reportForm.shiftInfo;
    const { productCode, rolls, actualWeight } = reportForm.productEntry;
    
    if (!machineId || !shiftName || !operatorName || !assistantName) {
      addNotification('Vui lòng điền đầy đủ Thông tin Ca Trực ở Bước 1!', 'error');
      setCurrentStep(1);
      return;
    }
    if (!productCode || !rolls || !actualWeight) {
      addNotification('Vui lòng điền thông tin Thành Phẩm ở Bước 1!', 'error');
      setCurrentStep(1);
      return;
    }

    setIsSubmitLoading(true);

    try {
      if (isOnline) {
        // Send directly to Express Server API
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportForm)
        });

        if (res.ok) {
          const newRep = await res.json();
          addNotification('Lưu báo cáo lên database Đà Nẵng thành công!', 'success');
          // Update local list
          setReports(prev => [newRep, ...prev]);
          // Reset form draft
          handleResetForm();
        } else {
          // Server returned error, queue offline instead
          throw new Error('Server returned error status');
        }
      } else {
        // Offline capability fallback
        const offlineRep: ProductionReport = {
          ...reportForm,
          id: `rep_offline_${Date.now()}`,
          createdAt: new Date().toISOString()
        };
        setOfflineReports(prev => [offlineRep, ...prev]);
        addNotification('Mất sóng kho! Báo cáo đã lưu tạm tại LocalStorage trên máy dọn.', 'warning');
        // Reset form draft
        handleResetForm();
      }
    } catch (err) {
      // API error fallback
      const offlineRep: ProductionReport = {
        ...reportForm,
        id: `rep_offline_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      setOfflineReports(prev => [offlineRep, ...prev]);
      addNotification('Mất mạng kết nối. Đã lưu báo cáo dự phòng ngoại tuyến.', 'warning');
      handleResetForm();
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Synchronize queued offline reports once connection returns
  const syncOfflineQueue = async () => {
    const cachedQueue = localStorage.getItem(STORAGE_OFFLINE_KEY);
    if (!cachedQueue) return;
    
    try {
      const parsedQueue: ProductionReport[] = JSON.parse(cachedQueue);
      if (parsedQueue.length === 0) return;

      addNotification(`Đang tự động đồng bộ ${parsedQueue.length} báo cáo nộp tạm...`, 'success');

      for (const rep of parsedQueue) {
        // Stripe out id generated for offline identification so server assigns database order key
        const { id, ...cleanForm } = rep; 
        await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanForm)
        });
      }

      // Success, empty local table queue
      setOfflineReports([]);
      localStorage.setItem(STORAGE_OFFLINE_KEY, '[]');
      addNotification('Đồng bộ dữ liệu nộp tạm thành công!', 'success');
      // Reload main database
      fetchReports();
    } catch (e) {
      console.error('Không thể tự động đồng bộ báo cáo ngoại tuyến:', e);
    }
  };

  // Reset form helper
  const handleResetForm = () => {
    setReportForm(DEFAULT_REPORT);
    localStorage.removeItem(STORAGE_DRAFT_KEY);
    setCurrentStep(1);
    navigateToTab('menu', { replace: true });
  };

  // Reset Server Database (for demo and review testing)
  const handleResetDb = async () => {
    if (window.confirm('Vui lòng xác nhận khôi phục tất cả dữ liệu báo cáo về bản seeding mẫu?')) {
      try {
        const res = await fetch('/api/reports/reset', { method: 'POST' });
        if (res.ok) {
          const resJson = await res.json();
          setReports(resJson.data);
          addNotification('Khôi phục database mẫu Đà Nẵng thành công!', 'success');
        }
      } catch (e) {
        addNotification('Lỗi khi khôi phục database.', 'error');
      }
    }
  };

  // Wizard update handlers
  const updateShiftInfo = (updated: Partial<ShiftInfo>) => {
    setReportForm(prev => ({
      ...prev,
      shiftInfo: { ...prev.shiftInfo, ...updated }
    }));
  };

  const updateProductEntry = (updated: Partial<ProductEntry>) => {
    setReportForm(prev => ({
      ...prev,
      productEntry: { ...prev.productEntry, ...updated }
    }));
  };

  const updateMaterials = (updated: Partial<MaterialBatches>) => {
    setReportForm(prev => ({
      ...prev,
      materials: { ...prev.materials, ...updated }
    }));
  };

  const updateWasteAndNotes = (updates: { wasteWeight?: number; notes?: string }) => {
    setReportForm(prev => ({
      ...prev,
      ...updates
    }));
  };

  // Derived metrics for real-time stepper footer preview
  const activeMetrics = computeReportMetrics(reportForm);

  return (
    <div className={`h-[100dvh] overflow-hidden bg-[#151515] flex flex-col font-sans selection:bg-[#ef1b2d] selection:text-white ${
      activeTab === 'control-board'
        ? 'p-0'
        : activeTab === 'hr' || activeTab === 'products' || activeTab === 'machines' || activeTab === 'materials' || activeTab === 'warehouse-slip' || activeTab === 'warehouse-history' || activeTab === 'orders' || activeTab === 'settings'
          ? 'sm:p-4'
          : 'sm:py-6 sm:px-4'
    }`} id="main-root-container">
      {/* Smartphone framework emulator on Wide Screens, fullscreen and intuitive on small touch screens */}
      <div className={`flex-1 min-h-0 w-full mx-auto bg-white overflow-hidden flex flex-col ${
        activeTab === 'control-board'
          ? 'max-w-none'
          : activeTab === 'hr' || activeTab === 'products' || activeTab === 'machines' || activeTab === 'materials' || activeTab === 'warehouse-slip' || activeTab === 'warehouse-history' || activeTab === 'orders' || activeTab === 'settings'
          ? 'max-w-none sm:rounded-2xl sm:shadow-2xl sm:border sm:border-zinc-800'
          : 'max-w-4xl sm:rounded-3xl sm:shadow-2xl sm:border sm:border-zinc-800'
      }`}>
        
        {/* Device Status Header / Bar */}
        <header className="sticky top-0 z-40 bg-white border-b-4 border-[#ef1b2d] px-4 py-3 shrink-0 flex items-center justify-between pt-safe">
          <div className="flex items-center gap-2">
            {activeTab === 'products' && (
              <BackButton onClick={() => navigateToTab('menu')} className="h-10 rounded-xl" />
            )}
            <VietNhatLogo />
          </div>

          {/* Network status and offline indicator pills */}
          <div className="flex items-center gap-1.5">
            {offlineReports.length > 0 && (
              <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full animate-pulse border border-rose-500/30">
                Tạm {offlineReports.length}
              </span>
            )}
            
            {isOnline ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <Wifi className="w-3.5 h-3.5" />
                Đồng bộ
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                <WifiOff className="w-3.5 h-3.5" />
                Ngoại tuyến
              </span>
            )}
          </div>
        </header>

        {/* Floating notifications / Toasts layout */}
        <div className="fixed top-14 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm mx-auto">
          <AnimatePresence>
            {notifications.map(n => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-3 rounded-xl border shadow-lg text-xs font-semibold flex items-start gap-2 backdrop-blur-md ${
                  n.type === 'success' 
                    ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' 
                    : n.type === 'error' 
                    ? 'bg-rose-950/90 border-rose-500/30 text-rose-200' 
                    : 'bg-amber-950/90 border-amber-500/30 text-amber-200'
                }`}
              >
                {n.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                <p className="flex-1 leading-relaxed">{n.text}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Main Content scrollable container viewport */}
        <main className={`flex-1 min-h-0 overflow-y-auto bg-zinc-50 focus:outline-none ${
          activeTab === 'control-board' ? 'p-2 md:p-4' : 'p-4 md:p-6 pb-4'
        }`} id="applet-viewport">
          <AnimatePresence mode="wait">
            {activeTab === 'control-board' ? (
              <motion.div
                key="control-board"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <ControlBoardPanel onNavigate={navigateToTab} />
              </motion.div>
            ) : activeTab === 'menu' ? (
              <motion.div
                key="main-menu"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      title: 'Bảng điều khiển',
                      desc: 'Nhân sự, đơn hàng, sản phẩm và danh sách máy trên một màn hình.',
                      icon: LayoutDashboard,
                      action: () => navigateToTab('control-board')
                    },
                    {
                      title: 'Nhập báo cáo sản xuất',
                      desc: 'Ghi ca máy, mã hàng, nguyên liệu và phế phẩm.',
                      icon: FilePlus2,
                      action: () => navigateToTab('form')
                    },
                    {
                      title: 'Phiếu cân ca',
                      desc: 'Xem danh sách phiếu cân và cộng dồn theo ca.',
                      icon: History,
                      action: () => navigateToTab('weighing-summary')
                    },
                    {
                      title: 'Nhân sự',
                      desc: 'Quản lý thợ máy, phụ máy và phân công ca trực.',
                      icon: UsersRound,
                      action: () => navigateToTab('hr')
                    },
                    {
                      title: 'Sản phẩm',
                      desc: 'Xem danh mục mã hàng, nhóm VTHH, đơn vị và tồn kho.',
                      icon: Package,
                      action: () => navigateToTab('products')
                    },
                    {
                      title: 'Danh sách máy',
                      desc: 'Theo dõi mã máy, vị trí, loại máy và trạng thái vận hành.',
                      icon: Cpu,
                      action: () => navigateToTab('machines')
                    },
                    {
                      title: 'Kho NVL',
                      desc: 'Quản lý nguyên phụ liệu, trọng lượng, khổ cuộn và tồn nhập xuất.',
                      icon: Boxes,
                      action: () => navigateToTab('materials')
                    },
                    {
                      title: 'Phiếu xuất nhập kho',
                      desc: 'Lập phiếu nhập hoặc xuất NVL theo từng mã NPL.',
                      icon: ArrowDownToLine,
                      action: () => navigateToTab('warehouse-slip')
                    },
                    {
                      title: 'Lịch sử xuất nhập kho',
                      desc: 'Tra cứu phiếu đã lưu, lọc theo loại và ngày.',
                      icon: History,
                      action: () => navigateToTab('warehouse-history')
                    },
                    {
                      title: 'Đơn hàng',
                      desc: 'Theo dõi mã đơn, khách hàng, mã hàng và lệnh sản xuất.',
                      icon: ClipboardList,
                      action: () => navigateToTab('orders')
                    },
                    {
                      title: 'Lệnh sản xuất',
                      desc: 'Xem danh sách lệnh SX, mã hàng, trạng thái và kế hoạch sản xuất.',
                      icon: Factory,
                      action: () => navigateToTab('production-orders')
                    },
                    {
                      title: 'Cài đặt',
                      desc: 'Xem tham số cấu hình và giá trị mặc định của hệ thống.',
                      icon: Settings,
                      action: () => navigateToTab('settings')
                    },
                    {
                      title: 'Phân tích & đối chiếu',
                      desc: 'Kiểm tra báo cáo đã lưu, biểu đồ và dữ liệu mẫu.',
                      icon: BarChart3,
                      action: () => navigateToTab('dashboard')
                    }
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.title}
                        type="button"
                        onClick={item.action}
                        className="group relative min-h-[128px] overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white p-4 text-left shadow-sm transition hover:border-[#ef1b2d] hover:shadow-[0_12px_32px_rgba(17,17,17,0.12)] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#ef1b2d]/25"
                      >
                        <span className="absolute inset-x-0 top-0 h-1 bg-zinc-900 transition group-hover:bg-[#ef1b2d]" />
                        <div className="flex items-start gap-3">
                          <span className="h-11 w-11 rounded-xl border border-zinc-800 bg-zinc-950 text-[#ef1b2d] flex items-center justify-center shrink-0 shadow-sm group-hover:border-[#ef1b2d] group-hover:bg-[#ef1b2d]/10 transition">
                            <Icon className="w-5 h-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-black leading-snug text-slate-900">{item.title}</span>
                            <span className="mt-1.5 block text-sm font-medium leading-5 text-slate-500">{item.desc}</span>
                          </span>
                          <ChevronRight className="mt-1 w-4 h-4 text-zinc-400 group-hover:text-[#ef1b2d] shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </section>
              </motion.div>
            ) : activeTab === 'form' ? (
              <motion.div
                key="form-stepper"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Visual Wizard Stepper Indicator */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider leading-none">BƯỚC</span>
                    <span className="text-lg font-black text-slate-800 leading-none">{currentStep}/3</span>
                  </div>
                  
                  {/* Visual segment progress lines */}
                  <div className="flex-1 mx-4 flex gap-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${currentStep >= 1 ? 'bg-emerald-500 w-1/3' : 'w-0'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${currentStep >= 2 ? 'bg-emerald-500 w-1/3' : 'w-0'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${currentStep >= 3 ? 'bg-emerald-500 w-1/3' : 'w-0'}`} />
                  </div>

                  <span className="text-[11px] font-bold text-slate-500 shrink-0">
                    {currentStep === 1 ? 'Thông tin & Mã hàng' : currentStep === 2 ? 'Phối trộn polymer' : 'Phế phẩm & Lưu'}
                  </span>
                </div>

                {/* Stepper Card Frame */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm min-h-[300px]">
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <ShiftInfoForm data={reportForm.shiftInfo} onChange={updateShiftInfo} />
                      <div className="pt-2 border-t border-slate-100">
                        <ProductEntryForm data={reportForm.productEntry} onChange={updateProductEntry} />
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <MaterialsForm data={reportForm.materials} onChange={updateMaterials} />
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <WasteForm 
                        wasteWeight={reportForm.wasteWeight} 
                        notes={reportForm.notes || ''} 
                        onChange={updateWasteAndNotes} 
                      />

                      {/* Final layout summary review before submission */}
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                          Tổng Hợp Kết Quả Báo Cáo
                        </h4>

                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-semibold py-1 border-b border-slate-800">
                          <div>Ca máy: <span className="text-slate-300 block">{reportForm.shiftInfo.machineId.split(' ')[0] || '--'}</span></div>
                          <div>Mã hàng: <span className="text-slate-300 block">{reportForm.productEntry.productCode || '--'}</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs py-1 border-b border-slate-800 font-mono">
                          <div>Polymer phối: <strong className="text-indigo-400 text-sm block">{formatNumber(activeMetrics.totalPlastic)} kg</strong></div>
                          <div>Thành phẩm: <strong className="text-emerald-400 text-sm block">{formatNumber(activeMetrics.actualProductWeight)} kg</strong></div>
                        </div>

                        {/* Variance result */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Phế phẩm: <strong className="text-rose-400">{formatNumber(reportForm.wasteWeight)} kg</strong></span>
                          <span>Tỉ lệ hao hụt: <strong className={`${
                            activeMetrics.status === 'optimal' ? 'text-emerald-400' : activeMetrics.status === 'warning' ? 'text-amber-400' : 'text-rose-400'
                          }`}>{formatNumber(activeMetrics.variancePercent)}%</strong></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submitting / Loader overlay */}
                {isSubmitLoading && (
                  <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="p-5 bg-white rounded-2xl shadow-xl flex items-center gap-3.5 text-slate-800 font-bold max-w-sm">
                      <Loader2 className="w-6 h-6 text-emerald-600 animate-spin shrink-0" />
                      <span>Đang mã hóa & đồng bộ dữ liệu Đà Nẵng...</span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : activeTab === 'weighing-summary' ? (
              <motion.div
                key="weighing-summary"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <WeighingShiftSummary />
              </motion.div>
            ) : activeTab === 'hr' ? (
              <motion.div
                key="human-resources"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <HumanResourcesPanel onBack={() => navigateToTab('menu')} />
              </motion.div>
            ) : activeTab === 'products' ? (
              <motion.div
                key="products"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <ProductsPanel onBack={() => navigateToTab('menu')} />
              </motion.div>
            ) : activeTab === 'machines' ? (
              <motion.div
                key="machines"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <MachinesPanel onBack={() => navigateToTab('menu')} />
              </motion.div>
            ) : activeTab === 'materials' ? (
              <motion.div
                key="materials"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <MaterialsInventoryPanel onBack={() => navigateToTab('menu')} />
              </motion.div>
            ) : activeTab === 'warehouse-slip' ? (
              <motion.div
                key="warehouse-slip"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <WarehouseSlipPanel
                  onBack={() => navigateToTab('menu')}
                  onOpenHistory={() => navigateToTab('warehouse-history')}
                />
              </motion.div>
            ) : activeTab === 'warehouse-history' ? (
              <motion.div
                key="warehouse-history"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <WarehouseHistoryPanel
                  onBack={() => navigateToTab('menu')}
                  onOpenSlip={() => navigateToTab('warehouse-slip')}
                />
              </motion.div>
            ) : activeTab === 'orders' ? (
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <OrdersPanel onBack={() => navigateToTab('menu')} />
              </motion.div>
            ) : activeTab === 'production-orders' ? (
              <motion.div
                key="production-orders"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <ProductionOrdersPanel onBack={() => navigateToTab('menu')} />
              </motion.div>
            ) : activeTab === 'settings' ? (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <SettingsPanel onBack={() => navigateToTab('menu')} />
              </motion.div>
            ) : (
              <motion.div
                key="dashboard-charts"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <AnalyticsDashboard 
                  reports={reports} 
                  onResetDb={handleResetDb} 
                  isLoading={isFetchLoading} 
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Dynamic STICKY Wizard Footer Bar for Form Inputs - locked at bottom, min height 44px layout */}
        {activeTab === 'form' && (
          <footer className="z-30 shrink-0 border-t border-slate-200 bg-white px-4 py-3.5 shadow-lg flex items-center justify-between" id="sticky-wizard-footer">
            <div className="flex-1 flex gap-3">
              {currentStep > 1 ? (
                <button
                  type="button"
                  id="wizard-prev-btn"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="h-12 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition font-bold text-sm text-slate-600 flex items-center justify-center gap-1 active:scale-95"
                  style={{ minHeight: '44px' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Quay lại</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Khôi phục bản ghi nháp hiện tại?')) {
                      setReportForm(DEFAULT_REPORT);
                      localStorage.removeItem(STORAGE_DRAFT_KEY);
                      addNotification('Đã xóa trắng nháp báo cáo!', 'success');
                    }
                  }}
                  className="h-12 px-4 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 transition font-bold text-xs text-slate-500 shrink-0 active:scale-95"
                  style={{ minHeight: '44px' }}
                >
                  Reset Nháp
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  id="wizard-next-btn"
                  onClick={() => {
                    // Quick validation for Step 1
                    if (currentStep === 1) {
                      const { machineId, shiftName, operatorName, assistantName } = reportForm.shiftInfo;
                      const { productCode, rolls, actualWeight } = reportForm.productEntry;
                      if (!machineId || !shiftName || !operatorName || !assistantName) {
                        addNotification('Thiếu! Hãy nhập đầy đủ thông tin Ca máy và thợ máy.', 'warning');
                        return;
                      }
                      if (!productCode || !rolls || !actualWeight) {
                        addNotification('Thiếu! Hãy chọn Mã SP, Số lượng cuộn đạt và Cân nặng.', 'warning');
                        return;
                      }
                    }
                    setCurrentStep(prev => prev + 1);
                  }}
                  className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-850 text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow"
                  style={{ minHeight: '44px' }}
                >
                  <span>Tiếp tục</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  id="save-report-submit-btn"
                  onClick={() => handleSubmitReport()}
                  className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-600/10"
                  style={{ minHeight: '44px' }}
                >
                  <Save className="w-4.5 h-4.5" />
                  <span>Nộp & Lưu báo cáo</span>
                </button>
              )}
            </div>
          </footer>
        )}

        <nav
          className="hidden"
          id="tab-navigation"
        >
          <a
            href={pathFromTab('menu')}
            id="tab-btn-menu"
            onClick={event => handleNavClick(event, 'menu')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'menu'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <Menu className="h-4 w-4" />
            Menu
          </a>

          <a
            href={pathFromTab('form')}
            id="tab-btn-form"
            onClick={event => handleNavClick(event, 'form')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'form'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <FilePlus2 className="h-4 w-4" />
            Nhập Báo Cáo
          </a>

          <a
            href={pathFromTab('weighing-summary')}
            id="tab-btn-weighing-summary"
            onClick={event => handleNavClick(event, 'weighing-summary')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'weighing-summary'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <Layers className="h-4 w-4" />
            Phiếu Cân Ca
          </a>

          <a
            href={pathFromTab('dashboard')}
            id="tab-btn-dashboard"
            onClick={event => handleNavClick(event, 'dashboard')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'dashboard'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <BarChart3 className="h-4 w-4" />
            Phân Tích
          </a>

          <a
            href={pathFromTab('products')}
            id="tab-btn-products"
            onClick={event => handleNavClick(event, 'products')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'products'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <Package className="h-4 w-4" />
            Sản Phẩm
          </a>

          <a
            href={pathFromTab('machines')}
            id="tab-btn-machines"
            onClick={event => handleNavClick(event, 'machines')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'machines'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <Cpu className="h-4 w-4" />
            Máy
          </a>

          <a
            href={pathFromTab('materials')}
            id="tab-btn-materials"
            onClick={event => handleNavClick(event, 'materials')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'materials'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <Boxes className="h-4 w-4" />
            Kho NVL
          </a>

          <a
            href={pathFromTab('orders')}
            id="tab-btn-orders"
            onClick={event => handleNavClick(event, 'orders')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'orders'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <ClipboardList className="h-4 w-4" />
            Đơn Hàng
          </a>
        </nav>
        
      </div>
    </div>
  );
}
