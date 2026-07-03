import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Eye, Factory, FileText, Hash, ImagePlus, Loader2, Pencil, Plus, RotateCcw, Save, ScanBarcode, Trash2, UserCheck, Users } from 'lucide-react';
import vietNhatLogoUrl from '../../logovietnhat_1.png';
import type { WeighingPendingAdd, WeighingRecord } from './WeighingShiftSummary';
import { generateWeighingDocumentNo, getWeighingDataRows, isSlipHeaderRow } from './WeighingShiftSummary';
import ProductQrScanner from './ProductQrScanner';
import SearchableSelect from './SearchableSelect';
import WeighingImagePreviewModal, {
  WeighingImageThumbnail,
  type WeighingPreviewImage
} from './WeighingImagePreviewModal';

interface WeighingRow {
  id: number;
  dbId?: string | number;
  productionDate: string;
  shiftName: string;
  worker1: string;
  worker2: string;
  weigherName: string;
  productCode: string;
  productName: string;
  coreWeight: string;
  coreWeightImageUrl?: string;
  coreWeightImagePublicId?: string;
  shellWeight: string;
  acceptanceStatus: string;
  note: string;
  machineName: string;
  weighNo: string;
  weighTime: string;
  weight: string;
  imageUrl?: string;
  imagePublicId?: string;
  savedToDb?: boolean;
}

const DEFAULT_ROWS: WeighingRow[] = [];

const FACTORY_PLACEHOLDER = 'Nhà máy Đà Nẵng';

function isRealMachineName(name?: string) {
  const value = String(name ?? '').trim();
  return Boolean(value) && value !== FACTORY_PLACEHOLDER;
}

function resolveMachineName(...candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    if (isRealMachineName(candidate)) {
      return String(candidate).trim();
    }
  }
  return '—';
}
import { DEFAULT_WEIGHING_SLIP_CONFIG, type WeighingSlipConfig } from '../lib/weighingSlipConfig';
import {
  getProductionShiftOptions,
  normalizeShiftSettings,
  type ShiftSetting
} from '../utils/shiftSettings';
import {
  buildWeighingProductOptionsFromOrders,
  normalizeMixingProductionOrders,
  type MixingProductionOrder
} from '../utils/mixingOrderAutofill';
import { sanitizeDecimalTyping } from '../lib/mixingReportModel';

const DEFAULT_SHELL_WEIGHT = '0,16';
const ACCEPTANCE_STATUS_OPTIONS = ['Đạt', 'Không đạt'] as const;

function readStoredWeigherName(storageKey: string) {
  try {
    return localStorage.getItem(storageKey) || '';
  } catch {
    return '';
  }
}

function storeWeigherName(storageKey: string, name: string) {
  try {
    if (name.trim()) {
      localStorage.setItem(storageKey, name.trim());
    }
  } catch {
    // ignore storage errors
  }
}

const inputClass = 'h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none transition focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
const modalInputClass =
  'h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-800 outline-none transition focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
const modalFileClass =
  'w-full rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-2 py-1.5 text-[11px] font-bold text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-red-50 file:px-2 file:py-1 file:text-[10px] file:font-bold file:text-[#ef1b2d] hover:bg-white';
const modalLabelClass = 'text-[10px] font-black uppercase tracking-wider text-zinc-500';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getCurrentWeighTime() {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
}

function getNextWeighRound(rowCount: number) {
  return String(rowCount + 1);
}

function formatWeighRound(round: string | number) {
  return `Lần ${round}`;
}

async function uploadImage(imageDataUrl: string) {
  const res = await fetch('/api/cloudinary/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Không thể upload ảnh lên Cloudinary.');
  }
  return { imageUrl: data.url as string, imagePublicId: data.publicId as string };
}

interface ProductOption {
  productName: string;
  productCode: string;
  newCode?: string;
}

interface MachineOption {
  id: string;
  code: string;
  name: string;
}

function normalizeProducts(data: unknown): ProductOption[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { products?: unknown }).products)
      ? (data as { products: unknown[] }).products
      : [];

  return rows
    .map((item): ProductOption | null => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { productName: name, productCode: '' } : null;
      }

      if (!item || typeof item !== 'object') return null;

      if ('productName' in item) {
        const record = item as ProductOption;
        const productName = String(record.productName ?? '').trim();
        const productCode = String(record.productCode ?? '').trim();
        const newCode = String(record.newCode ?? '').trim();
        if (!productName && !productCode) return null;
        return { productName, productCode, newCode: newCode || undefined };
      }

      const record = item as Record<string, unknown>;
      const productName = String(
        record.ten_sp ?? record.ten_san_pham ?? record.productName ?? record.name ?? ''
      ).trim();
      const productCode = String(
        record.ma_sp ?? record.ma_san_pham ?? record.productCode ?? record.code ?? ''
      ).trim();
      const newCode = String(record.ma_sp_moi ?? record.newCode ?? '').trim();
      if (!productName && !productCode) return null;
      return { productName, productCode, newCode: newCode || undefined };
    })
    .filter((item): item is ProductOption => Boolean(item));
}

function findProductByCode(products: ProductOption[], code: string) {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;

  return (
    products.find(
      product =>
        product.productCode.toLowerCase() === normalized ||
        product.newCode?.toLowerCase() === normalized
    ) ?? null
  );
}

function resolveProductNameFromCode(
  products: ProductOption[],
  productCode: string,
  fallbackName = ''
) {
  const match = findProductByCode(products, productCode);
  if (match) return match.productName;
  return productCode.trim() ? '' : fallbackName;
}

function findProductByName(products: ProductOption[], name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  return products.find(product => product.productName.toLowerCase() === normalized) ?? null;
}

function normalizeMachines(data: unknown): MachineOption[] {
  if (!data || typeof data !== 'object') return [];
  const machines = (data as { machines?: unknown }).machines;
  if (!Array.isArray(machines)) return [];

  return machines
    .map((item): MachineOption | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = String(record.ten_may ?? record.name ?? record.may ?? '').trim();
      const code = String(record.ma_may ?? record.code ?? record.ma_so_may ?? '').trim();
      if (!name) return null;
      return {
        id: String(record.id ?? code ?? name),
        code,
        name
      };
    })
    .filter((item): item is MachineOption => Boolean(item));
}

function MachineSelect({
  value,
  onChange,
  machines,
  isLoading,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  machines: MachineOption[];
  isLoading?: boolean;
  className?: string;
}) {
  const machineNames = useMemo(() => new Set(machines.map(machine => machine.name)), [machines]);
  const selectedValue = !isLoading && value && machineNames.has(value) ? value : '';

  return (
    <div className="relative">
      <select
        value={selectedValue}
        onChange={e => onChange(e.target.value)}
        disabled={isLoading || machines.length === 0}
        className={`${className} appearance-none pr-9`}
      >
        <option value="">
          {isLoading
            ? 'Đang tải danh sách máy...'
            : machines.length === 0
              ? 'Chưa có máy — thêm tại Danh sách máy'
              : 'Chọn tên máy'}
        </option>
        {machines.map(machine => (
          <option key={machine.id} value={machine.name}>
            {machine.code ? `${machine.code} · ${machine.name}` : machine.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}

interface StaffOption {
  name: string;
}

function normalizeStaff(data: unknown): StaffOption[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      if (typeof item === 'string') {
        return { name: item.trim() };
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const name = String(record.name ?? record.nhan_su ?? record.ho_ten ?? record.ten ?? '').trim();
        if (name) return { name };
      }
      return null;
    })
    .filter((item): item is StaffOption => Boolean(item?.name));
}

function StaffSelect({
  value,
  onChange,
  staff,
  isLoading,
  placeholder,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  staff: StaffOption[];
  isLoading?: boolean;
  placeholder: string;
  className?: string;
}) {
  const staffNames = useMemo(() => new Set(staff.map(person => person.name)), [staff]);
  const selectedValue = !isLoading && value && staffNames.has(value) ? value : '';

  return (
    <div className="relative">
      <select
        value={selectedValue}
        onChange={e => onChange(e.target.value)}
        disabled={isLoading || staff.length === 0}
        className={`${className} appearance-none pr-9`}
      >
        <option value="">
          {isLoading
            ? 'Đang tải nhân sự...'
            : staff.length === 0
              ? 'Không có nhân sự'
              : placeholder}
        </option>
        {staff.map(person => (
          <option key={person.name} value={person.name}>{person.name}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}

function ProductNameSelect({
  value,
  onChange,
  products,
  isLoading,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  products: ProductOption[];
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={isLoading || products.length === 0}
      className={className}
    >
      <option value="">
        {isLoading
          ? 'Đang tải sản phẩm...'
          : products.length === 0
            ? 'Không có SP trong lệnh SX'
            : 'Chọn tên sản phẩm'}
      </option>
      {products.map(product => (
        <option key={`${product.productCode}-${product.productName}`} value={product.productName}>
          {product.productCode ? `${product.productCode} · ${product.productName}` : product.productName}
        </option>
      ))}
    </select>
  );
}

function getSlipInfo(rows: WeighingRow[]) {
  const source = rows[0];
  if (!source) return null;

  return {
    productionDate: source.productionDate
      ? source.productionDate.split('-').reverse().join('/')
      : '—',
    shiftName: source.shiftName || '—',
    worker1: source.worker1 || '—',
    worker2: source.worker2 || '—',
    machineName: resolveMachineName(...rows.map(row => row.machineName))
  };
}

function getSlipContextFromRows(rowList: WeighingRow[]) {
  const source = rowList[0];
  if (!source) return null;

  return {
    productionDate: source.productionDate,
    shiftName: source.shiftName,
    worker1: source.worker1,
    worker2: source.worker2,
    machineName: source.machineName
  };
}

function recordsToRows(records: WeighingRecord[]): WeighingRow[] {
  return records.map((record, index) => ({
    id: index + 1,
    dbId: record.id,
    productionDate: record.productionDate,
    shiftName: record.shiftName,
    worker1: record.worker1,
    worker2: record.worker2,
    weigherName: record.weigherName || '',
    productCode: record.productCode || '',
    productName: record.productName,
    coreWeight: record.coreWeight,
    coreWeightImageUrl: record.coreWeightImageUrl,
    shellWeight: record.shellWeight || '',
    acceptanceStatus: record.acceptanceStatus || '',
    note: record.note || '',
    machineName: isRealMachineName(record.machineName) ? record.machineName : '',
    weighNo: record.weighNo,
    weighTime: record.weighTime,
    weight: record.weight,
    imageUrl: record.imageUrl,
    savedToDb: Boolean(record.id)
  }));
}

function rowToNewRowState(row: WeighingRow): Omit<WeighingRow, 'id' | 'weighNo' | 'weighTime' | 'savedToDb'> {
  return {
    productionDate: row.productionDate,
    shiftName: row.shiftName,
    worker1: row.worker1,
    worker2: row.worker2,
    weigherName: row.weigherName,
    productCode: row.productCode,
    productName: row.productName,
    coreWeight: row.coreWeight,
    coreWeightImageUrl: row.coreWeightImageUrl,
    coreWeightImagePublicId: row.coreWeightImagePublicId,
    shellWeight: row.shellWeight || DEFAULT_SHELL_WEIGHT,
    acceptanceStatus: row.acceptanceStatus,
    note: row.note,
    machineName: row.machineName,
    weight: row.weight,
    imageUrl: row.imageUrl,
    imagePublicId: row.imagePublicId
  };
}

export default function WeighingReportForm({
  pendingAdd = null,
  onPendingAddHandled,
  config = DEFAULT_WEIGHING_SLIP_CONFIG
}: {
  pendingAdd?: WeighingPendingAdd | null;
  onPendingAddHandled?: () => void;
  config?: WeighingSlipConfig;
} = {}) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [form, setForm] = useState({
    documentNo: '',
    reportDate: today
  });
  const [rows, setRows] = useState<WeighingRow[]>(DEFAULT_ROWS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [addFormError, setAddFormError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [coreWeightImageFile, setCoreWeightImageFile] = useState<File | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState('');
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(true);
  const [machinesError, setMachinesError] = useState('');
  const [shiftSettings, setShiftSettings] = useState<ShiftSetting[]>([]);
  const [productionOrders, setProductionOrders] = useState<MixingProductionOrder[]>([]);
  const [isLoadingProductionOrders, setIsLoadingProductionOrders] = useState(true);
  const [productionOrdersError, setProductionOrdersError] = useState('');
  const [viewingRow, setViewingRow] = useState<WeighingRow | null>(null);
  const [viewingImage, setViewingImage] = useState<WeighingPreviewImage | null>(null);
  const [editingRow, setEditingRow] = useState<WeighingRow | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<number | null>(null);
  const [currentWeigherName, setCurrentWeigherName] = useState(() => readStoredWeigherName(config.weigherStorageKey));
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  const updateCurrentWeigherName = (name: string) => {
    setCurrentWeigherName(name);
    storeWeigherName(config.weigherStorageKey, name);
  };

  const shiftOptions = useMemo(() => getProductionShiftOptions(shiftSettings), [shiftSettings]);

  const applySavedRowIds = (savedRows: WeighingRecord[] | undefined, targetRows: WeighingRow[]) => {
    if (!savedRows?.length) return targetRows;

    return targetRows.map((row, index) => ({
      ...row,
      dbId: savedRows[index]?.id ?? row.dbId,
      savedToDb: true
    }));
  };

  const persistRowsToServer = async (rowsToSave: WeighingRow[]) => {
    const firstRow = rowsToSave[0];
    const res = await fetch(config.apiBasePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        productionDate: firstRow.productionDate,
        shiftName: firstRow.shiftName,
        worker1: firstRow.worker1,
        worker2: firstRow.worker2,
        rows: rowsToSave
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Không thể lưu phiếu cân.');
    }

    return data as {
      success?: boolean;
      inserted?: number;
      mode?: string;
      warning?: string;
      rows?: WeighingRecord[];
    };
  };

  const updateRowOnServer = async (row: WeighingRow) => {
    if (!row.dbId) {
      throw new Error('Dòng chưa có ID trên server. Hãy lưu phiếu trước khi sửa.');
    }

    const res = await fetch(`${config.apiBasePath}/${row.dbId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        productionDate: row.productionDate,
        shiftName: row.shiftName,
        worker1: row.worker1,
        worker2: row.worker2,
        row
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Không thể cập nhật dòng cân.');
    }

    return data as { success?: boolean; row?: WeighingRecord; mode?: string };
  };

  const deleteRowOnServer = async (dbId: string | number) => {
    const res = await fetch(`${config.apiBasePath}/${dbId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Không thể xóa dòng cân.');
    }

    return data as { success?: boolean; mode?: string };
  };

  const getSaveSuccessMessage = (mode?: string, count = 1, warning?: string) => {
    if (warning) return warning;
    if (mode === 'local') {
      return `Đã lưu ${count} dòng vào file local (chưa ghi Supabase). Kiểm tra kết nối mạng và SUPABASE_SERVICE_KEY trong .env.`;
    }
    return `Đã lưu ${count} dòng vào Supabase (phieu_can_dinh_ki).`;
  };

  const [newRow, setNewRow] = useState<Omit<WeighingRow, 'id' | 'weighNo' | 'weighTime' | 'savedToDb'>>({
    productionDate: today,
    shiftName: '',
    worker1: '',
    worker2: '',
    weigherName: '',
    productCode: '',
    productName: '',
    machineName: '',
    coreWeight: '',
    shellWeight: DEFAULT_SHELL_WEIGHT,
    acceptanceStatus: '',
    note: '',
    weight: '',
    imageUrl: '',
    imagePublicId: '',
    coreWeightImageUrl: '',
    coreWeightImagePublicId: ''
  });

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      setIsLoadingProducts(true);
      setProductsError('');

      try {
        const res = await fetch('/api/san-pham?format=table');
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải danh sách sản phẩm.');
        }

        if (!cancelled) {
          setProducts(normalizeProducts(data));
        }
      } catch (error: any) {
        if (!cancelled) {
          setProductsError(error.message || 'Không thể tải danh sách sản phẩm.');
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProducts(false);
        }
      }
    };

    loadProducts();

    const loadStaff = async () => {
      setIsLoadingStaff(true);
      setStaffError('');

      try {
        const res = await fetch('/api/nhan-su');
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải danh sách nhân sự.');
        }

        if (!cancelled) {
          setStaff(normalizeStaff(data));
        }
      } catch (error: any) {
        if (!cancelled) {
          setStaffError(error.message || 'Không thể tải danh sách nhân sự.');
          setStaff([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStaff(false);
        }
      }
    };

    loadStaff();

    const loadMachines = async () => {
      setIsLoadingMachines(true);
      setMachinesError('');

      try {
        const res = await fetch('/api/danh-sach-may');
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải danh sách máy.');
        }

        if (!cancelled) {
          setMachines(normalizeMachines(data));
        }
      } catch (error: any) {
        if (!cancelled) {
          setMachinesError(error.message || 'Không thể tải danh sách máy.');
          setMachines([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMachines(false);
        }
      }
    };

    loadMachines();

    const loadShiftSettings = async () => {
      try {
        const res = await fetch('/api/cai-dat');
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setShiftSettings(normalizeShiftSettings(data));
        }
      } catch {
        if (!cancelled) setShiftSettings([]);
      }
    };

    loadShiftSettings();

    const loadProductionOrders = async () => {
      setIsLoadingProductionOrders(true);
      setProductionOrdersError('');
      try {
        const res = await fetch('/api/lenh-sx');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải lệnh sản xuất.');
        }
        if (!cancelled) {
          setProductionOrders(normalizeMixingProductionOrders(data));
        }
      } catch (error: any) {
        if (!cancelled) {
          setProductionOrders([]);
          setProductionOrdersError(error.message || 'Không thể tải lệnh sản xuất.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProductionOrders(false);
        }
      }
    };

    loadProductionOrders();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoadingStaff || staff.length === 0) return;

    const validNames = new Set(staff.map(person => person.name));
    setNewRow(prev => {
      const worker1 = validNames.has(prev.worker1) ? prev.worker1 : '';
      const worker2 = validNames.has(prev.worker2) ? prev.worker2 : '';
      if (worker1 === prev.worker1 && worker2 === prev.worker2) return prev;
      return { ...prev, worker1, worker2 };
    });

    setCurrentWeigherName(prev => (prev && validNames.has(prev) ? prev : ''));
  }, [isLoadingStaff, staff]);


  const openAddForm = (options?: {
    productionDate?: string;
    shiftName?: string;
    worker1?: string;
    worker2?: string;
    productName?: string;
    productCode?: string;
    machineName?: string;
  }) => {
    const slip = rows.length > 0 ? getSlipContextFromRows(rows) : null;
    const lastRow = rows[rows.length - 1];
    const productionDate = options?.productionDate || slip?.productionDate || lastRow?.productionDate || today;
    setNewRow({
      productionDate,
      shiftName: options?.shiftName || slip?.shiftName || lastRow?.shiftName || '',
      worker1: options?.worker1 ?? slip?.worker1 ?? lastRow?.worker1 ?? '',
      worker2: options?.worker2 ?? slip?.worker2 ?? lastRow?.worker2 ?? '',
      productCode: slip ? '' : options?.productCode ?? lastRow?.productCode ?? '',
      productName: slip ? '' : options?.productName ?? lastRow?.productName ?? '',
      machineName:
        options?.machineName ??
        slip?.machineName ??
        (isRealMachineName(lastRow?.machineName) ? lastRow.machineName : ''),
      coreWeight: '',
      shellWeight: DEFAULT_SHELL_WEIGHT,
      acceptanceStatus: '',
      note: '',
      weight: '',
      imageUrl: '',
      imagePublicId: '',
      coreWeightImageUrl: '',
      coreWeightImagePublicId: ''
    });
    setForm(prev => ({
      ...prev,
      reportDate: productionDate || prev.reportDate
    }));
    setImageFile(null);
    setCoreWeightImageFile(null);
    setSaveMessage(null);
    setAddFormError('');
    setEditingRow(null);
    if (!currentWeigherName) {
      setCurrentWeigherName(readStoredWeigherName());
    }
    setIsAddFormOpen(true);
  };

  const openEditRow = (row: WeighingRow) => {
    setEditingRow(row);
    if (row.weigherName) {
      updateCurrentWeigherName(row.weigherName);
    }
    setNewRow(rowToNewRowState(row));
    setImageFile(null);
    setCoreWeightImageFile(null);
    setSaveMessage(null);
    setAddFormError('');
    setIsAddFormOpen(true);
  };

  const handleDeleteRow = async (row: WeighingRow) => {
    if (!window.confirm('Bạn có chắc muốn xóa dòng cân này?')) return;

    setDeletingRowId(row.id);
    setSaveMessage(null);

    try {
      if (row.dbId) {
        await deleteRowOnServer(row.dbId);
      } else if (row.savedToDb) {
        throw new Error('Không tìm thấy ID dòng trên server. Vui lòng tải lại trang.');
      }

      setRows(prev => prev.filter(item => item.id !== row.id));
      setSaveMessage({ type: 'success', text: 'Đã xóa dòng cân.' });
      if (viewingRow?.id === row.id) setViewingRow(null);
      if (editingRow?.id === row.id) {
        setEditingRow(null);
        setIsAddFormOpen(false);
      }
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.message || 'Không thể xóa dòng cân.' });
    } finally {
      setDeletingRowId(null);
    }
  };

  useLayoutEffect(() => {
    if (!pendingAdd) return;

    const existingRows = pendingAdd.existingRows?.length
      ? recordsToRows(pendingAdd.existingRows)
      : [];

    if (pendingAdd.createNewSlip) {
      const productionDate = pendingAdd.productionDate || today;
      const documentNo = pendingAdd.documentNo || generateWeighingDocumentNo(productionDate);

      setRows([]);
      setForm({
        documentNo,
        reportDate: pendingAdd.reportDate || productionDate
      });
      openAddForm({
        productionDate,
        shiftName: pendingAdd.shiftName || '',
        worker1: '',
        worker2: '',
        productCode: '',
        productName: '',
        machineName: ''
      });
    } else if (existingRows.length) {
      setRows(existingRows);
      setForm({
        documentNo: pendingAdd.documentNo || '',
        reportDate: pendingAdd.reportDate || pendingAdd.productionDate || today
      });
    } else {
      setRows([]);
      setForm({
        documentNo: pendingAdd.documentNo || '',
        reportDate: pendingAdd.productionDate || today
      });
    }

    const lastRecord = pendingAdd.createNewSlip
      ? undefined
      : pendingAdd.existingRows?.[pendingAdd.existingRows.length - 1];

    if (pendingAdd.editingRow) {
      const editRows = existingRows.length ? existingRows : recordsToRows([pendingAdd.editingRow]);
      if (editRows.length) setRows(editRows);
      const target = editRows.find(item => item.dbId === pendingAdd.editingRow?.id)
        ?? recordsToRows([pendingAdd.editingRow])[0];
      openEditRow(target);
    } else if (!pendingAdd.createNewSlip) {
      openAddForm({
        productionDate: pendingAdd.productionDate || lastRecord?.productionDate,
        shiftName: pendingAdd.shiftName || lastRecord?.shiftName,
        worker1: pendingAdd.worker1 || lastRecord?.worker1,
        worker2: pendingAdd.worker2 || lastRecord?.worker2,
        productCode: pendingAdd.productCode || lastRecord?.productCode,
        productName: pendingAdd.productName || lastRecord?.productName,
        machineName: isRealMachineName(pendingAdd.machineName)
          ? pendingAdd.machineName
          : isRealMachineName(lastRecord?.machineName)
            ? lastRecord.machineName
            : ''
      });
    }

    onPendingAddHandled?.();
  }, [pendingAdd]);

  const addFormRow = async () => {
    const slip = rows.length > 0 ? getSlipContextFromRows(rows) : null;
    const productionDate = slip?.productionDate || newRow.productionDate;
    const shiftName = slip?.shiftName || newRow.shiftName;
    const worker1 = slip?.worker1 ?? newRow.worker1 ?? '';
    const worker2 = slip?.worker2 ?? newRow.worker2 ?? '';
    const machineName = (slip?.machineName || newRow.machineName).trim();

    if (!productionDate || !shiftName.trim()) {
      setAddFormError('Vui lòng nhập ngày sản xuất và ca sản xuất.');
      return;
    }

    if (!machineName) {
      setAddFormError('Vui lòng chọn tên máy từ danh sách máy.');
      return;
    }

    if (!currentWeigherName.trim()) {
      setAddFormError('Vui lòng chọn Người cân (người đang nhập liệu).');
      return;
    }

    if (
      !newRow.productCode.trim() &&
      !newRow.productName.trim() &&
      !newRow.coreWeight.trim() &&
      !newRow.shellWeight.trim() &&
      !newRow.weight.trim() &&
      !newRow.acceptanceStatus.trim() &&
      !newRow.note.trim() &&
      !imageFile &&
      !coreWeightImageFile
    ) {
      setAddFormError('Vui lòng nhập thông tin hoặc chọn ảnh trước khi thêm form.');
      return;
    }

    setIsUploadingImage(true);
    setSaveMessage(null);
    setAddFormError('');

    try {
      let imagePayload = {
        imageUrl: newRow.imageUrl,
        imagePublicId: newRow.imagePublicId
      };
      let coreWeightImagePayload = {
        coreWeightImageUrl: newRow.coreWeightImageUrl,
        coreWeightImagePublicId: newRow.coreWeightImagePublicId
      };

      if (imageFile && !newRow.imageUrl) {
        const uploaded = await uploadImage(await fileToDataUrl(imageFile));
        imagePayload = {
          imageUrl: uploaded.imageUrl,
          imagePublicId: uploaded.imagePublicId
        };
      }

      if (coreWeightImageFile && !newRow.coreWeightImageUrl) {
        const uploaded = await uploadImage(await fileToDataUrl(coreWeightImageFile));
        coreWeightImagePayload = {
          coreWeightImageUrl: uploaded.imageUrl,
          coreWeightImagePublicId: uploaded.imagePublicId
        };
      }

      if (editingRow) {
        const slipForEdit = getSlipContextFromRows(rows);
        const updatedRow: WeighingRow = {
          ...editingRow,
          productionDate: slipForEdit?.productionDate || editingRow.productionDate,
          shiftName: slipForEdit?.shiftName || editingRow.shiftName,
          worker1: slipForEdit?.worker1 ?? editingRow.worker1 ?? '',
          worker2: slipForEdit?.worker2 ?? editingRow.worker2 ?? '',
          weigherName: currentWeigherName.trim(),
          productCode: newRow.productCode.trim(),
          productName: newRow.productName || '',
          coreWeight: newRow.coreWeight || '',
          shellWeight: newRow.shellWeight || '',
          acceptanceStatus: newRow.acceptanceStatus || '',
          note: newRow.note || '',
          machineName: slipForEdit?.machineName || editingRow.machineName,
          weight: newRow.weight || '',
          ...imagePayload,
          ...coreWeightImagePayload
        };

        if (updatedRow.dbId) {
          const updateResult = await updateRowOnServer(updatedRow);
          if (updateResult.row?.id) {
            updatedRow.dbId = updateResult.row.id;
          }
          updatedRow.savedToDb = true;
        }

        setRows(prev => prev.map(row => (row.id === editingRow.id ? updatedRow : row)));
        setSaveMessage({
          type: 'success',
          text: updatedRow.dbId
            ? 'Đã cập nhật dòng cân.'
            : 'Đã cập nhật dòng trên bảng (chưa đồng bộ server).'
        });
        setEditingRow(null);
        setIsAddFormOpen(false);
        setImageFile(null);
        setCoreWeightImageFile(null);
        setAddFormError('');
        return;
      }

      const nextId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
      const newRowData: WeighingRow = {
        id: nextId,
        productionDate,
        shiftName,
        worker1,
        worker2,
        weigherName: currentWeigherName.trim(),
        productCode: newRow.productCode.trim(),
        productName: newRow.productName || '',
        coreWeight: newRow.coreWeight || '',
        shellWeight: newRow.shellWeight || '',
        acceptanceStatus: newRow.acceptanceStatus || '',
        note: newRow.note || '',
        machineName,
        weight: newRow.weight || '',
        weighNo: getNextWeighRound(getWeighingDataRows(rows).length),
        weighTime: getCurrentWeighTime(),
        savedToDb: false,
        ...imagePayload,
        ...coreWeightImagePayload
      };

      const saveResult = await persistRowsToServer([newRowData]);
      const [savedRow] = applySavedRowIds(saveResult.rows, [newRowData]);
      newRowData.dbId = savedRow.dbId;
      newRowData.savedToDb = true;

      setRows(prev => [...prev, newRowData]);
      setSaveMessage({
        type: 'success',
        text: getSaveSuccessMessage(saveResult.mode, saveResult.inserted ?? 1, saveResult.warning)
      });
      setImageFile(null);
      setCoreWeightImageFile(null);
      setAddFormError('');
      const slipAfterAdd = getSlipContextFromRows([...rows, newRowData]);
      setNewRow({
        productionDate: slipAfterAdd?.productionDate || productionDate,
        shiftName: slipAfterAdd?.shiftName || shiftName,
        worker1: slipAfterAdd?.worker1 ?? worker1,
        worker2: slipAfterAdd?.worker2 ?? worker2,
        machineName: slipAfterAdd?.machineName || machineName,
        productCode: '',
        productName: '',
        coreWeight: '',
        shellWeight: DEFAULT_SHELL_WEIGHT,
        acceptanceStatus: '',
        note: '',
        weight: '',
        imageUrl: '',
        imagePublicId: '',
        coreWeightImageUrl: '',
        coreWeightImagePublicId: ''
      });
    } catch (error: any) {
      setAddFormError(error.message || 'Không thể thêm form cân.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCoreImageUpload = async (file?: File | null) => {
    if (!file) return;

    setIsUploadingImage(true);
    setAddFormError('');

    try {
      const uploaded = await uploadImage(await fileToDataUrl(file));
      setNewRow(prev => ({
        ...prev,
        coreWeightImageUrl: uploaded.imageUrl,
        coreWeightImagePublicId: uploaded.imagePublicId
      }));
      setCoreWeightImageFile(null);
    } catch (error: any) {
      setAddFormError(error.message || 'Không thể upload ảnh trọng lượng lõi.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleWeightImageUpload = async (file?: File | null) => {
    if (!file) return;

    setIsUploadingImage(true);
    setAddFormError('');

    try {
      const uploaded = await uploadImage(await fileToDataUrl(file));
      setNewRow(prev => ({
        ...prev,
        imageUrl: uploaded.imageUrl,
        imagePublicId: uploaded.imagePublicId
      }));
      setImageFile(null);
    } catch (error: any) {
      setAddFormError(error.message || 'Không thể upload ảnh cân.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const resetForm = () => {
    setForm({
      documentNo: '',
      reportDate: today
    });
    setRows(DEFAULT_ROWS);
    setImageFile(null);
    setCoreWeightImageFile(null);
    setSaveMessage(null);
  };

  const handleSave = async () => {
    const filledRows = rows.filter(row =>
      row.productCode.trim() ||
      row.productName.trim() ||
      row.machineName.trim() ||
      row.coreWeight.trim() ||
      row.shellWeight.trim() ||
      row.weighNo.trim() ||
      row.weight.trim() ||
      row.acceptanceStatus.trim() ||
      row.note.trim() ||
      row.imageUrl ||
      row.coreWeightImageUrl
    );

    if (filledRows.length === 0) {
      setSaveMessage({ type: 'error', text: 'Vui lòng thêm ít nhất một dòng cân.' });
      return;
    }

    const missingShift = filledRows.find(row => !row.productionDate || !row.shiftName.trim());
    if (missingShift) {
      setSaveMessage({ type: 'error', text: 'Mỗi dòng cần có ngày sản xuất và ca sản xuất.' });
      return;
    }

    const unsavedRows = filledRows.filter(row => !row.savedToDb);
    if (unsavedRows.length === 0) {
      setSaveMessage({ type: 'success', text: 'Tất cả dòng đã được lưu lên Supabase.' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const saveResult = await persistRowsToServer(unsavedRows);
      const savedRows = applySavedRowIds(saveResult.rows, unsavedRows);
      const savedIds = new Set(unsavedRows.map(row => row.id));
      setRows(prev =>
        prev.map(row => {
          if (!savedIds.has(row.id)) return row;
          const saved = savedRows.find(item => item.id === row.id);
          return saved ? { ...row, ...saved } : { ...row, savedToDb: true };
        })
      );
      setSaveMessage({
        type: 'success',
        text: getSaveSuccessMessage(saveResult.mode, saveResult.inserted ?? unsavedRows.length, saveResult.warning)
      });
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.message || 'Không thể lưu phiếu cân.' });
    } finally {
      setIsSaving(false);
    }
  };

  const slipInfo = getSlipInfo(rows);
  const modalSlipInfo = slipInfo ?? (editingRow ? getSlipInfo([editingRow]) : null);
  const weighingRows = getWeighingDataRows(rows);
  const showSlipFields = !editingRow && weighingRows.length === 0 && rows.length === 0;
  const slipContext = rows.length > 0 ? getSlipContextFromRows(rows) : null;

  const productFilterContext = useMemo(() => {
    const machineName =
      slipContext?.machineName ||
      newRow.machineName ||
      (modalSlipInfo?.machineName && modalSlipInfo.machineName !== '—' ? modalSlipInfo.machineName : '');

    return {
      ngay: slipContext?.productionDate || newRow.productionDate || '',
      ca: slipContext?.shiftName || newRow.shiftName || '',
      machineName: isRealMachineName(machineName) ? machineName : ''
    };
  }, [
    slipContext,
    newRow.productionDate,
    newRow.shiftName,
    newRow.machineName,
    modalSlipInfo?.machineName
  ]);

  const orderProductOptions = useMemo(
    () =>
      buildWeighingProductOptionsFromOrders(
        productionOrders,
        productFilterContext,
        machines,
        products
      ),
    [productionOrders, productFilterContext, machines, products]
  );

  const productSelectOptions = useMemo(() => {
    const options = [...orderProductOptions];
    const currentCode = newRow.productCode.trim();
    if (currentCode && !options.some(item => item.productCode === currentCode)) {
      const catalog = findProductByCode(products, currentCode);
      options.push({
        productCode: currentCode,
        productName: catalog?.productName || newRow.productName || currentCode,
        newCode: catalog?.newCode
      });
    }
    return options.sort((a, b) => a.productCode.localeCompare(b.productCode, 'vi'));
  }, [orderProductOptions, newRow.productCode, newRow.productName, products]);

  const productCodePlaceholder = useMemo(() => {
    if (isLoadingProductionOrders) return 'Đang tải lệnh SX...';
    if (!productFilterContext.ngay || !productFilterContext.ca || !productFilterContext.machineName) {
      return 'Chọn ngày, ca và máy trước';
    }
    if (productSelectOptions.length === 0) {
      return 'Không có SP trong lệnh SX phù hợp';
    }
    return 'Gõ để tìm mã SP';
  }, [isLoadingProductionOrders, productFilterContext, productSelectOptions.length]);

  const productCodeSelectDisabled =
    isLoadingProductionOrders ||
    !productFilterContext.ngay ||
    !productFilterContext.ca ||
    !productFilterContext.machineName ||
    productSelectOptions.length === 0;

  const handleProductCodeScan = useCallback(
    (code: string): boolean => {
      const trimmed = code.trim();
      if (!trimmed) return false;

      const match = findProductByCode(productSelectOptions, trimmed);
      if (!match) {
        setAddFormError('Mã SP không có trong lệnh SX của ca, ngày và máy này.');
        return false;
      }

      setNewRow(prev => ({
        ...prev,
        productCode: match.productCode,
        productName: match.productName
      }));
      setAddFormError('');
      return true;
    },
    [productSelectOptions]
  );

  useEffect(() => {
    if (!newRow.productCode?.trim() || isLoadingProductionOrders) return;
    const resolvedName = resolveProductNameFromCode(productSelectOptions, newRow.productCode);
    if (!resolvedName) return;
    setNewRow(prev => (prev.productName === resolvedName ? prev : { ...prev, productName: resolvedName }));
  }, [productSelectOptions, isLoadingProductionOrders, newRow.productCode]);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b-4 border-[#ef1b2d] bg-white p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={vietNhatLogoUrl} alt="Viet Nhat IPT" crossOrigin="anonymous" className="h-14 w-auto max-w-[190px] object-contain" />
              <div className="hidden h-12 w-px bg-zinc-200 sm:block" />
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-zinc-950">Báo cáo trọng lượng</h2>
                <p className="mt-1 text-xs font-semibold text-zinc-500">Phiếu ghi nhận trọng lượng lõi, trọng lượng và ảnh cân</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-zinc-600 sm:w-72">
              <label className="space-y-1">
                <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-[#ef1b2d]" /> Ngày lập</span>
                <input
                  type="date"
                  value={form.reportDate}
                  onChange={e => setForm(prev => ({ ...prev, reportDate: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5 text-[#ef1b2d]" /> Bản số</span>
                <input
                  value={form.documentNo}
                  onChange={e => setForm(prev => ({ ...prev, documentNo: e.target.value }))}
                  className={inputClass}
                  placeholder="..."
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 bg-zinc-50 p-4 md:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-zinc-500">
              <CalendarDays className="h-4 w-4 text-[#ef1b2d]" />
              Ngày SX
            </p>
            <p className="text-sm font-bold text-zinc-900">{slipInfo?.productionDate ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-zinc-500">
              <FileText className="h-4 w-4 text-[#ef1b2d]" />
              Ca SX
            </p>
            <p className="text-sm font-bold text-zinc-900">{slipInfo?.shiftName ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-zinc-500">
              <Users className="h-4 w-4 text-[#ef1b2d]" />
              Tên CN 1
            </p>
            <p className="text-sm font-bold text-zinc-900">{slipInfo?.worker1 ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-zinc-500">
              <Users className="h-4 w-4 text-[#ef1b2d]" />
              Tên CN 2
            </p>
            <p className="text-sm font-bold text-zinc-900">{slipInfo?.worker2 ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-zinc-500">
              <Factory className="h-4 w-4 text-[#ef1b2d]" />
              Tên máy sản xuất
            </p>
            <p className="text-sm font-bold text-zinc-900">{slipInfo?.machineName ?? '—'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">Bảng chi tiết cân</h3>
          <p className="mt-0.5 text-xs font-semibold text-zinc-500">
            Tổng số dòng: {weighingRows.length}
            {form.documentNo ? ` · Bản số: ${form.documentNo}` : ''}
            {weighingRows.length > 0 ? ` · ${weighingRows.length} lần cân` : ''}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-zinc-950 text-xs font-black uppercase tracking-wider text-white">
                <th className="w-20 px-3 py-3 text-center">Lần cân</th>
                <th className="w-28 px-3 py-3">Mã SP</th>
                <th className="px-3 py-3">Tên sản phẩm</th>
                <th className="px-3 py-3">Người cân</th>
                <th className="px-3 py-3">Trọng lượng lõi</th>
                <th className="px-3 py-3">Trọng lượng bì</th>
                <th className="px-3 py-3">Trọng lượng</th>
                <th className="px-3 py-3">Giờ cân</th>
                <th className="px-3 py-3">Nghiệm thu</th>
                <th className="px-3 py-3">Ghi chú</th>
                <th className="px-3 py-3">Ảnh TL lõi</th>
                <th className="px-3 py-3">Ảnh</th>
                <th className="w-28 px-3 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {weighingRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-sm font-semibold text-zinc-400">
                    Chưa có dòng cân. Bấm Nhập liệu để thêm lần cân.
                  </td>
                </tr>
              ) : weighingRows.map(row => (
                <tr key={row.id} className="transition hover:bg-red-50/40">
                  <td className="border-r border-zinc-100 px-3 py-2 text-center text-sm font-black text-zinc-800">
                    {row.weighNo ? formatWeighRound(row.weighNo) : '—'}
                  </td>
                  <td className="px-2 py-2 text-sm font-bold text-zinc-800">{row.productCode || '—'}</td>
                  <td className="px-2 py-2 text-sm font-semibold text-zinc-700">{row.productName || '—'}</td>
                  <td className="px-2 py-2 text-sm font-semibold text-zinc-600">{row.weigherName || '—'}</td>
                  <td className="px-2 py-2 text-sm font-semibold text-zinc-700">{row.coreWeight || '—'}</td>
                  <td className="px-2 py-2 text-sm font-semibold text-zinc-700">{row.shellWeight || '—'}</td>
                  <td className="px-2 py-2 text-sm font-bold text-zinc-900">{row.weight || '—'}</td>
                  <td className="px-2 py-2 text-sm font-semibold text-zinc-600">{row.weighTime || '—'}</td>
                  <td className="px-2 py-2">
                    {row.acceptanceStatus ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          row.acceptanceStatus === 'Đạt'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {row.acceptanceStatus}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="max-w-[120px] truncate px-2 py-2 text-sm font-semibold text-zinc-600" title={row.note || undefined}>
                    {row.note || '—'}
                  </td>
                  <td className="px-2 py-2">
                    {row.coreWeightImageUrl ? (
                      <WeighingImageThumbnail
                        url={row.coreWeightImageUrl}
                        alt="Ảnh trọng lượng lõi"
                        title="Ảnh trọng lượng lõi"
                        onView={() =>
                          setViewingImage({ url: row.coreWeightImageUrl!, title: 'Ảnh trọng lượng lõi' })
                        }
                      />
                    ) : (
                      <span className="text-xs font-semibold text-zinc-300">Chưa có</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {row.imageUrl ? (
                      <WeighingImageThumbnail
                        url={row.imageUrl}
                        alt="Ảnh cân"
                        title="Ảnh cân"
                        onView={() => setViewingImage({ url: row.imageUrl!, title: 'Ảnh cân' })}
                      />
                    ) : (
                      <span className="text-xs font-semibold text-zinc-300">Chưa có</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingRow(row)}
                        title="Xem"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditRow(row)}
                        title="Sửa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row)}
                        disabled={deletingRowId === row.id}
                        title="Xóa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingRowId === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-zinc-200 px-4 py-3">
          <button
            type="button"
            onClick={resetForm}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Đang lưu' : 'Lưu phiếu'}
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-zinc-500">Thao tác phiếu cân</span>
            {productsError && (
              <p className="text-xs font-bold text-rose-600">{productsError}</p>
            )}
            {staffError && (
              <p className="text-xs font-bold text-rose-600">{staffError}</p>
            )}
            {saveMessage && (
              <p className={`text-xs font-bold ${saveMessage.type === 'success' ? 'text-[#ef1b2d]' : 'text-rose-600'}`}>
                {saveMessage.text}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={openAddForm}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] shadow-sm transition hover:bg-red-100"
          >
            <Plus className="h-4 w-4" />
            Nhập liệu
          </button>
        </div>
      </section>

      {isAddFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-3">
          <div className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-3 py-2">
              <div className="min-w-0 pr-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  {editingRow ? 'Sửa dòng cân' : 'Nhập liệu'}
                </h3>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-500">
                  {editingRow
                    ? `${editingRow.weighNo ? formatWeighRound(editingRow.weighNo) : 'Dòng cân'} · ${editingRow.weighTime || '—'}`
                    : `${formatWeighRound(getNextWeighRound(weighingRows.length))}${
                        showSlipFields ? ' · Phiếu mới' : ''
                      }`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddFormOpen(false);
                  setEditingRow(null);
                }}
                className="h-8 shrink-0 rounded-lg border border-zinc-200 px-2.5 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid grid-cols-2 gap-2 p-3">
              <label className="col-span-2 space-y-1">
                <span className={`flex items-center gap-1 ${modalLabelClass}`}>
                  <UserCheck className="h-3.5 w-3.5 text-[#ef1b2d]" />
                  Người cân
                </span>
                <StaffSelect
                  value={currentWeigherName}
                  onChange={updateCurrentWeigherName}
                  staff={staff}
                  isLoading={isLoadingStaff}
                  placeholder="Chọn người nhập liệu"
                  className={modalInputClass}
                />
              </label>
              {!showSlipFields && modalSlipInfo && (
                <div className="col-span-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[11px] font-semibold text-zinc-600">
                  <span className="font-bold text-zinc-900">{modalSlipInfo.productionDate}</span>
                  {' · '}
                  <span className="font-bold text-zinc-900">{modalSlipInfo.shiftName}</span>
                  {' · '}
                  <span className="font-bold text-zinc-900">{modalSlipInfo.machineName}</span>
                </div>
              )}
              {showSlipFields && (
              <>
              <label className="space-y-1">
                <span className={`flex items-center gap-1 ${modalLabelClass}`}>
                  <CalendarDays className="h-3.5 w-3.5 text-[#ef1b2d]" />
                  Ngày SX
                </span>
                <input
                  type="date"
                  value={newRow.productionDate}
                  onChange={e => setNewRow(prev => ({ ...prev, productionDate: e.target.value }))}
                  className={modalInputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={`flex items-center gap-1 ${modalLabelClass}`}>
                  <FileText className="h-3.5 w-3.5 text-[#ef1b2d]" />
                  Ca SX
                </span>
                <select
                  value={newRow.shiftName}
                  onChange={e => setNewRow(prev => ({ ...prev, shiftName: e.target.value }))}
                  className={modalInputClass}
                >
                  <option value="">Chọn ca</option>
                  {shiftOptions.map(shift => (
                    <option key={shift.value} value={shift.value}>{shift.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={`flex items-center gap-1 ${modalLabelClass}`}>
                  <Users className="h-3.5 w-3.5 text-[#ef1b2d]" />
                  CN 1
                </span>
                <StaffSelect
                  value={newRow.worker1}
                  onChange={value => setNewRow(prev => ({ ...prev, worker1: value }))}
                  staff={staff}
                  isLoading={isLoadingStaff}
                  placeholder="CN 1"
                  className={modalInputClass}
                />
              </label>
              <label className="space-y-1">
                <span className={`flex items-center gap-1 ${modalLabelClass}`}>
                  <Users className="h-3.5 w-3.5 text-[#ef1b2d]" />
                  CN 2
                </span>
                <StaffSelect
                  value={newRow.worker2}
                  onChange={value => setNewRow(prev => ({ ...prev, worker2: value }))}
                  staff={staff}
                  isLoading={isLoadingStaff}
                  placeholder="CN 2"
                  className={modalInputClass}
                />
              </label>
              <label className="col-span-2 space-y-1">
                <span className={`flex items-center gap-1 ${modalLabelClass}`}>
                  <Factory className="h-3.5 w-3.5 text-[#ef1b2d]" />
                  Tên máy
                </span>
                <MachineSelect
                  value={newRow.machineName}
                  onChange={value => setNewRow(prev => ({ ...prev, machineName: value }))}
                  machines={machines}
                  isLoading={isLoadingMachines}
                  className={modalInputClass}
                />
                {machinesError && (
                  <p className="text-[11px] font-bold text-rose-600">{machinesError}</p>
                )}
              </label>
              </>
              )}
              <label className="col-span-2 space-y-1">
                <span className={`flex items-center gap-1 ${modalLabelClass}`}>
                  <Hash className="h-3.5 w-3.5 text-[#ef1b2d]" />
                  Mã SP
                </span>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <SearchableSelect
                      value={newRow.productCode ?? ''}
                      onChange={productCode => {
                        setNewRow(prev => ({
                          ...prev,
                          productCode,
                          productName: resolveProductNameFromCode(productSelectOptions, productCode, prev.productName)
                        }));
                      }}
                      onSelectOption={item => {
                        if (!item) return;
                        const product = item as ProductOption;
                        setNewRow(prev => ({
                          ...prev,
                          productCode: product.productCode,
                          productName: product.productName
                        }));
                      }}
                      options={productSelectOptions}
                      placeholder={productCodePlaceholder}
                      isLoading={isLoadingProductionOrders}
                      disabled={productCodeSelectDisabled}
                      inputClassName={modalInputClass}
                      getValue={item => (item as ProductOption).productCode}
                      getLabel={item => {
                        const product = item as ProductOption;
                        const codeLabel =
                          product.newCode && product.newCode !== product.productCode
                            ? `${product.productCode} / ${product.newCode}`
                            : product.productCode;
                        return product.productName ? `${codeLabel} · ${product.productName}` : codeLabel;
                      }}
                      resolveSelectedItem={(options, value) =>
                        findProductByCode(options as ProductOption[], value)
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQrScannerOpen(true)}
                    disabled={productCodeSelectDisabled}
                    className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-[#ef1b2d] bg-red-50 px-2.5 text-[11px] font-extrabold text-[#ef1b2d] transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ScanBarcode className="h-4 w-4" />
                    QR
                  </button>
                </div>
                {(productionOrdersError || productFilterContext.ngay) && (
                  <p className="text-[10px] font-semibold text-zinc-400">
                    {productionOrdersError ||
                      (productFilterContext.ngay && productFilterContext.ca && productFilterContext.machineName
                        ? `${productSelectOptions.length} mã từ lệnh SX`
                        : 'Lọc theo ngày, ca, máy')}
                  </p>
                )}
              </label>
              <label className="col-span-2 space-y-1">
                <span className={modalLabelClass}>Tên SP</span>
                {(() => {
                  const codeMatch = findProductByCode(productSelectOptions, newRow.productCode ?? '');
                  if (codeMatch) {
                    return (
                      <input
                        type="text"
                        readOnly
                        value={codeMatch.productName}
                        className={`${modalInputClass} bg-zinc-50 text-zinc-800`}
                      />
                    );
                  }
                  return (
                    <ProductNameSelect
                      value={newRow.productName ?? ''}
                      onChange={value => {
                        const match = findProductByName(productSelectOptions, value);
                        setNewRow(prev => ({
                          ...prev,
                          productName: value,
                          productCode: match?.productCode || prev.productCode
                        }));
                      }}
                      products={productSelectOptions}
                      isLoading={isLoadingProductionOrders}
                      className={modalInputClass}
                    />
                  );
                })()}
                {productsError && (
                  <p className="text-[11px] font-bold text-rose-600">{productsError}</p>
                )}
              </label>
              <div className="col-span-2 grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className={modalLabelClass}>TL cân</span>
                  <input
                    value={newRow.weight ?? ''}
                    onChange={e => setNewRow(prev => ({ ...prev, weight: e.target.value }))}
                    className={modalInputClass}
                    placeholder="8,0"
                  />
                </label>
                <label className="space-y-1">
                  <span className={modalLabelClass}>TL lõi</span>
                  <input
                    value={newRow.coreWeight ?? ''}
                    onChange={e => setNewRow(prev => ({ ...prev, coreWeight: e.target.value }))}
                    className={modalInputClass}
                    placeholder="0,5"
                  />
                </label>
                <label className="space-y-1">
                  <span className={modalLabelClass}>TL bì</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newRow.shellWeight ?? ''}
                    onChange={e =>
                      setNewRow(prev => ({ ...prev, shellWeight: sanitizeDecimalTyping(e.target.value) }))
                    }
                    className={modalInputClass}
                    placeholder={DEFAULT_SHELL_WEIGHT}
                  />
                </label>
              </div>
              <label className="space-y-1">
                <span className={modalLabelClass}>Nghiệm thu</span>
                <select
                  value={newRow.acceptanceStatus ?? ''}
                  onChange={e => setNewRow(prev => ({ ...prev, acceptanceStatus: e.target.value }))}
                  className={modalInputClass}
                >
                  <option value="">Chọn...</option>
                  {ACCEPTANCE_STATUS_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={modalLabelClass}>Ghi chú</span>
                <input
                  type="text"
                  value={newRow.note ?? ''}
                  onChange={e => setNewRow(prev => ({ ...prev, note: e.target.value }))}
                  className={modalInputClass}
                  placeholder="Ghi chú lần cân"
                />
              </label>
              <label className="space-y-1">
                <span className={`flex items-center gap-1 ${modalLabelClass}`}>
                  <ImagePlus className="h-3.5 w-3.5 text-[#ef1b2d]" />
                  Ảnh lõi
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0] || null;
                    setCoreWeightImageFile(file);
                    if (file) handleCoreImageUpload(file);
                  }}
                  className={modalFileClass}
                />
                {(coreWeightImageFile || newRow.coreWeightImageUrl) && (
                  <p className="truncate text-[10px] font-semibold text-zinc-500">
                    {newRow.coreWeightImageUrl ? 'Đã upload' : coreWeightImageFile?.name}
                  </p>
                )}
              </label>
              <label className="space-y-1">
                <span className={`flex items-center gap-1 ${modalLabelClass}`}>
                  <ImagePlus className="h-3.5 w-3.5 text-[#ef1b2d]" />
                  Ảnh cân
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0] || null;
                    setImageFile(file);
                    if (file) handleWeightImageUpload(file);
                  }}
                  className={modalFileClass}
                />
                {(imageFile || newRow.imageUrl) && (
                  <p className="truncate text-[10px] font-semibold text-zinc-500">
                    {newRow.imageUrl ? 'Đã upload' : imageFile?.name}
                  </p>
                )}
              </label>
            </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-2.5">
              {addFormError && (
                <p className="mr-auto max-w-xs text-xs font-bold text-rose-600">
                  {addFormError}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsAddFormOpen(false);
                  setEditingRow(null);
                }}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={addFormRow}
                disabled={isUploadingImage}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingRow ? (
                  <Save className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {isUploadingImage
                  ? 'Đang upload ảnh...'
                  : editingRow
                    ? 'Lưu thay đổi'
                    : 'Thêm vào bảng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingRow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Chi tiết dòng cân</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                  {viewingRow.weighNo ? formatWeighRound(viewingRow.weighNo) : '—'} · {viewingRow.weighTime || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingRow(null)}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 text-xs">
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Ngày SX</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.productionDate || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Ca</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.shiftName || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">CN 1</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.worker1 || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">CN 2</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.worker2 || '—'}</p>
              </div>
              <div className="col-span-2 rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Người cân</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.weigherName || '—'}</p>
              </div>
              <div className="col-span-2 rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Tên máy</span>
                <p className="mt-1 font-bold text-zinc-800">
                  {isRealMachineName(viewingRow.machineName) ? viewingRow.machineName : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Mã sản phẩm</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.productCode || '—'}</p>
              </div>
              <div className="col-span-2 rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Tên sản phẩm</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.productName || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">TL lõi</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.coreWeight || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">TL bì</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.shellWeight || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Trọng lượng</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.weight || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Nghiệm thu</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.acceptanceStatus || '—'}</p>
              </div>
              <div className="col-span-2 rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Ghi chú</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.note || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Ảnh TL lõi</span>
                {viewingRow.coreWeightImageUrl ? (
                  <WeighingImageThumbnail
                    url={viewingRow.coreWeightImageUrl}
                    alt="Ảnh TL lõi"
                    title="Ảnh trọng lượng lõi"
                    onView={() =>
                      setViewingImage({ url: viewingRow.coreWeightImageUrl!, title: 'Ảnh trọng lượng lõi' })
                    }
                    className="mt-2 block h-24 w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition hover:border-[#ef1b2d]"
                  />
                ) : (
                  <p className="mt-1 font-semibold text-zinc-400">Chưa có</p>
                )}
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Ảnh cân</span>
                {viewingRow.imageUrl ? (
                  <WeighingImageThumbnail
                    url={viewingRow.imageUrl}
                    alt="Ảnh cân"
                    title="Ảnh cân"
                    onView={() => setViewingImage({ url: viewingRow.imageUrl!, title: 'Ảnh cân' })}
                    className="mt-2 block h-24 w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition hover:border-[#ef1b2d]"
                  />
                ) : (
                  <p className="mt-1 font-semibold text-zinc-400">Chưa có</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setViewingRow(null);
                  openEditRow(viewingRow);
                }}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-[#ef1b2d] transition hover:bg-red-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Sửa
              </button>
              <button
                type="button"
                onClick={() => setViewingRow(null)}
                className="h-9 rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white transition hover:bg-zinc-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      <WeighingImagePreviewModal image={viewingImage} onClose={() => setViewingImage(null)} />
      <ProductQrScanner
        open={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScan={handleProductCodeScan}
        closeAfterScan
        getConfirmMessage={code => `Đã quét mã ${code}. Bấm Xác nhận để điền mã sản phẩm.`}
      />
    </div>
  );
}
