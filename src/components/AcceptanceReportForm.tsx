import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  Clock3,
  Cpu,
  ImagePlus,
  List,
  Loader2,
  Plus,
  Save,
  ScanBarcode,
  Trash2,
  X
} from 'lucide-react';
import ProductQrScanner from './ProductQrScanner';
import SearchableSelect from './SearchableSelect';
import {
  RepeatableLineCard,
  RepeatableLineRow,
  RepeatableLinesBlock
} from './RepeatableLinesBlock';
import { LineEditorSheet } from './LineEditorSheet';

export type AcceptanceReport = {
  id: string;
  ngay: string;
  ca: string;
  lan: string;
  gio: string;
  ma_may: string;
  ten_may: string;
  mat_hang: string;
  don_vi: string;
  so_luong: number | null;
  hinh_anh: string;
  hinh_anh_public_id?: string;
  created_at?: string;
};

interface MachineOption {
  id: string;
  code: string;
  name: string;
}

interface ProductionOrderOption {
  shift: string;
  machine: string;
  productCode: string;
  productName: string;
  unit: string;
  startDate: string;
}

interface ProductSelectOption {
  code: string;
  name: string;
  unit: string;
}

const inputClass =
  'h-9 w-full min-w-0 rounded-md border border-ink-200 bg-ink-50 focus:bg-white px-2.5 text-[13px] font-semibold text-ink-900 outline-none transition placeholder:text-ink-400 placeholder:italic focus:border-accent-700 focus:ring-2 focus:ring-accent-700/20';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function extractIsoDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') return '';
  const match = trimmed.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function shiftMatches(orderShift: string, selectedShift: string) {
  if (!orderShift || !selectedShift) return false;
  const left = orderShift.replace(/^ca\s*/i, '').trim().toLowerCase();
  const right = selectedShift.replace(/^ca\s*/i, '').trim().toLowerCase();
  return left === right || left.includes(right) || right.includes(left);
}

function machineMatches(orderMachine: string, machineCode: string, machineName: string, machineRef: string) {
  const ref = orderMachine.trim();
  if (!ref || ref === '-') return false;

  const candidates = new Set<string>();
  if (machineCode) candidates.add(normalizeKey(machineCode));
  if (machineName) candidates.add(normalizeKey(machineName));
  if (machineRef) candidates.add(normalizeKey(machineRef));
  if (machineCode && machineName) candidates.add(normalizeKey(`${machineCode} · ${machineName}`));

  const refKey = normalizeKey(ref);
  return [...candidates].some(key => key && (key === refKey || key.includes(refKey) || refKey.includes(key)));
}

function parseQrProductCode(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const plusIdx = trimmed.indexOf('+');
  if (plusIdx > 0) return trimmed.slice(0, plusIdx).trim();
  return trimmed;
}

function productCodeFromOrder(order: ProductionOrderOption) {
  return order.productCode.trim() || order.productName.trim();
}

function lineHasProductCode(line: ProductLine, code: string) {
  const target = normalizeKey(code);
  if (!target) return false;
  return normalizeKey(parseQrProductCode(line.mat_hang)) === target;
}

function findProductOption(code: string, options: ProductSelectOption[]) {
  const key = normalizeKey(parseQrProductCode(code));
  if (!key) return null;
  return options.find(option => normalizeKey(option.code) === key) ?? null;
}

function normalizeCatalogProducts(data: unknown): ProductSelectOption[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { products?: unknown }).products)
      ? (data as { products: unknown[] }).products
      : [];

  return rows
    .map((item): ProductSelectOption | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = String(
        record.ma_sp ?? record.ma_san_pham ?? record.productCode ?? record.code ?? ''
      ).trim();
      const name = String(
        record.ten_sp ?? record.ten_san_pham ?? record.productName ?? record.name ?? ''
      ).trim();
      const unit = String(record.don_vi ?? record.unit ?? '').trim();
      if (!code) return null;
      return { code, name, unit };
    })
    .filter((item): item is ProductSelectOption => Boolean(item));
}

function isBlankProductLine(line: ProductLine) {
  return !line.mat_hang.trim() && !line.so_luong.trim();
}

function incrementQuantityString(current: string) {
  const num = Number(String(current).replace(',', '.'));
  if (!Number.isFinite(num) || num <= 0) return '1';
  return String(num + 1);
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
    body: JSON.stringify({ imageDataUrl, folder: 'bao_cao_nghiem_thu' })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Không thể upload ảnh lên Cloudinary.');
  return { imageUrl: data.url as string, imagePublicId: data.publicId as string };
}

function normalizeProductionOrders(data: unknown): ProductionOrderOption[] {
  if (!data || typeof data !== 'object') return [];
  const rows = (data as { productionOrders?: unknown }).productionOrders;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((item): ProductionOrderOption | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const shift = String(record.ca ?? record.shift ?? '').trim();
      const machine = String(record.may ?? record.ma_may ?? record.ten_may ?? '').trim();
      const productCode = String(record.ma_hang ?? record.ma_sp ?? '').trim();
      const productName = String(record.ten_hang ?? record.san_pham ?? record.ten_sp ?? '').trim();
      const unit = String(record.don_vi ?? record.unit ?? '').trim();
      const startDate = extractIsoDate(
        String(record.ngay_gio_bat_dau ?? record.ngay_bat_dau ?? record.start_date ?? '')
      );
      if (!shift && !machine && !productName && !startDate) return null;
      return { shift, machine, productCode, productName, unit, startDate };
    })
    .filter((row): row is ProductionOrderOption => Boolean(row));
}

function normalizeMachines(data: unknown): MachineOption[] {
  if (!data || typeof data !== 'object') return [];
  const rows = (data as { machines?: unknown }).machines;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((item): MachineOption | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = String(record.ma_may ?? record.code ?? '').trim();
      const name = String(record.ten_may ?? record.name ?? '').trim();
      if (!code && !name) return null;
      return {
        id: String(record.id ?? code ?? name),
        code,
        name
      };
    })
    .filter((row): row is MachineOption => Boolean(row));
}

export function normalizeReportFromApi(record: Record<string, unknown>): AcceptanceReport {
  return {
    id: String(record.id ?? ''),
    ngay: String(record.ngay ?? '').slice(0, 10),
    ca: String(record.ca ?? ''),
    lan: String(record.lan ?? ''),
    gio: String(record.gio ?? '').slice(0, 5),
    ma_may: String(record.ma_may ?? ''),
    ten_may: String(record.ten_may ?? ''),
    mat_hang: String(record.mat_hang ?? ''),
    don_vi: String(record.don_vi ?? ''),
    so_luong:
      record.so_luong === null || record.so_luong === undefined ? null : Number(record.so_luong),
    hinh_anh: String(record.hinh_anh ?? ''),
    hinh_anh_public_id: String(record.hinh_anh_public_id ?? ''),
    created_at: String(record.created_at ?? '')
  };
}

interface ProductLine {
  id: string;
  mat_hang: string;
  don_vi: string;
  so_luong: string;
}

function newProductLine(): ProductLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mat_hang: '',
    don_vi: '',
    so_luong: ''
  };
}

function newReportForm() {
  return {
    ngay: todayIso(),
    ca: '',
    lan: '1',
    gio: nowTimeValue(),
    ma_may: '',
    ten_may: '',
    machineRef: '',
    teamId: '',
    lines: [newProductLine()],
    hinh_anh: '',
    hinh_anh_public_id: '',
    imagePreview: ''
  };
}

export default function AcceptanceReportForm({
  onBack,
  onOpenList,
  editReport,
  onEditConsumed
}: {
  onBack: () => void;
  onOpenList?: () => void;
  editReport?: AcceptanceReport | null;
  onEditConsumed?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrderOption[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductSelectOption[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [form, setForm] = useState(newReportForm());
  const formLinesRef = useRef(form.lines);
  formLinesRef.current = form.lines;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [highlightLineId, setHighlightLineId] = useState('');
  const [lineSheetOpen, setLineSheetOpen] = useState(false);
  const [lineSheetEditingId, setLineSheetEditingId] = useState<string | null>(null);
  const [draftLine, setDraftLine] = useState<ProductLine | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError('');
      try {
        const [machineRes, productionRes, productRes] = await Promise.all([
          fetch('/api/danh-sach-may'),
          fetch('/api/lenh-sx'),
          fetch('/api/san-pham?format=table')
        ]);
        const machineData = await machineRes.json().catch(() => ({}));
        const productionData = await productionRes.json().catch(() => ({}));
        const productData = await productRes.json().catch(() => ({}));
        if (!machineRes.ok) throw new Error(machineData.error || 'Không thể tải danh sách máy.');
        if (!productionRes.ok) throw new Error(productionData.error || 'Không thể tải lệnh sản xuất.');
        if (cancelled) return;

        setMachines(normalizeMachines(machineData));
        setProductionOrders(normalizeProductionOrders(productionData));
        if (productRes.ok) {
          setCatalogProducts(normalizeCatalogProducts(productData));
        } else {
          setCatalogProducts([]);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Không thể tải dữ liệu.');
      } finally {
        if (!cancelled) setIsLoadingProducts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editReport || machines.length === 0) return;
    startEdit(editReport);
    onEditConsumed?.();
  }, [editReport, machines, onEditConsumed]);

  useEffect(() => {
    if (!highlightLineId) return;
    const timer = window.setTimeout(() => setHighlightLineId(''), 2600);
    return () => window.clearTimeout(timer);
  }, [highlightLineId]);

  const ordersForSelectedDay = useMemo(
    () => productionOrders.filter(order => order.startDate === form.ngay),
    [productionOrders, form.ngay]
  );

  const shiftOptions = useMemo(() => {
    const shifts = ordersForSelectedDay
      .map(order => order.shift)
      .filter(shift => shift && shift !== '-');
    return [...new Set(shifts)].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [ordersForSelectedDay]);

  const teamOptions = useMemo(
    () =>
      [...machines]
        .filter(machine => machine.code || machine.name)
        .sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code, 'vi')),
    [machines]
  );

  const orderProductOptions = useMemo(() => {
    if (!form.ca || (!form.ma_may.trim() && !form.ten_may.trim())) return [] as ProductSelectOption[];

    return ordersForSelectedDay
      .filter(
        order =>
          shiftMatches(order.shift, form.ca) &&
          machineMatches(order.machine, form.ma_may, form.ten_may, form.machineRef || form.ten_may || form.ma_may)
      )
      .map(order => ({
        code: productCodeFromOrder(order),
        name: order.productName,
        unit: order.unit && order.unit !== '-' ? order.unit : ''
      }))
      .filter(item => item.code && item.code !== '-');
  }, [ordersForSelectedDay, form.ca, form.ma_may, form.ten_may, form.machineRef]);

  const productSelectOptions = useMemo(() => {
    const byCode = new Map<string, ProductSelectOption>();

    catalogProducts.forEach(product => {
      const key = normalizeKey(product.code);
      if (!key) return;
      byCode.set(key, product);
    });

    orderProductOptions.forEach(product => {
      const key = normalizeKey(product.code);
      if (!key) return;
      const existing = byCode.get(key);
      byCode.set(key, {
        code: product.code,
        name: product.name || existing?.name || '',
        unit: product.unit || existing?.unit || ''
      });
    });

    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, 'vi'));
  }, [catalogProducts, orderProductOptions]);

  const handleDateChange = (ngay: string) => {
    setForm(prev => ({
      ...prev,
      ngay,
      ca: '',
      ma_may: '',
      ten_may: '',
      machineRef: '',
      teamId: '',
      lines: [newProductLine()]
    }));
  };

  const handleShiftChange = (ca: string) => {
    setForm(prev => ({
      ...prev,
      ca,
      lines: [newProductLine()]
    }));
  };

  const handleTeamChange = (teamId: string) => {
    const team = machines.find(machine => machine.id === teamId);
    if (!team) {
      setForm(prev => ({
        ...prev,
        teamId: '',
        machineRef: '',
        ma_may: '',
        ten_may: '',
        lines: [newProductLine()]
      }));
      return;
    }

    const machineRef = team.name || team.code;
    setForm(prev => ({
      ...prev,
      teamId: team.id,
      machineRef,
      ma_may: team.code,
      ten_may: team.name,
      lines: [newProductLine()]
    }));
  };

  const handleLineProductChange = (lineId: string, mat_hang: string) => {
    if (
      mat_hang &&
      form.lines.some(line => line.id !== lineId && lineHasProductCode(line, mat_hang))
    ) {
      setError(`Mã SP "${parseQrProductCode(mat_hang)}" đã có trong danh sách.`);
      return;
    }

    const match = findProductOption(mat_hang, productSelectOptions);
    setForm(prev => ({
      ...prev,
      lines: prev.lines.map(line =>
        line.id === lineId ? { ...line, mat_hang, don_vi: match?.unit || '' } : line
      )
    }));
    setError('');
  };

  const handleLineQuantityChange = (lineId: string, so_luong: string) => {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.map(line => (line.id === lineId ? { ...line, so_luong } : line))
    }));
  };

  const addProductLine = () => {
    setForm(prev => ({ ...prev, lines: [...prev.lines, newProductLine()] }));
  };

  const removeProductLine = (lineId: string) => {
    setForm(prev => {
      if (prev.lines.length <= 1) return prev;
      return { ...prev, lines: prev.lines.filter(line => line.id !== lineId) };
    });
  };

  const openNewLineSheet = () => {
    setLineSheetEditingId(null);
    setDraftLine(newProductLine());
    setLineSheetOpen(true);
  };

  const openEditLineSheet = (lineId: string) => {
    const source = form.lines.find(line => line.id === lineId);
    if (!source) return;
    setLineSheetEditingId(lineId);
    setDraftLine({ ...source });
    setLineSheetOpen(true);
  };

  const closeLineSheet = () => {
    setLineSheetOpen(false);
    setDraftLine(null);
    setLineSheetEditingId(null);
  };

  const updateDraftLine = (patch: Partial<ProductLine>) => {
    setDraftLine(prev => (prev ? { ...prev, ...patch } : prev));
  };

  const handleDraftProductChange = (code: string) => {
    if (
      code &&
      draftLine &&
      form.lines.some(
        line => line.id !== draftLine.id && lineHasProductCode(line, code)
      )
    ) {
      setError(`Mã SP "${parseQrProductCode(code)}" đã có trong danh sách.`);
      return;
    }
    const match = findProductOption(code, productSelectOptions);
    setError('');
    setDraftLine(prev =>
      prev
        ? { ...prev, mat_hang: code, don_vi: match?.unit || prev.don_vi }
        : prev
    );
  };

  const persistDraftLine = () => {
    if (!draftLine) {
      closeLineSheet();
      return;
    }
    if (lineSheetEditingId === null) {
      const created: ProductLine = { ...draftLine };
      setForm(prev => ({ ...prev, lines: [...prev.lines, created] }));
    } else {
      const target = lineSheetEditingId;
      setForm(prev => ({
        ...prev,
        lines: prev.lines.map(line => (line.id === target ? { ...draftLine } : line))
      }));
    }
    closeLineSheet();
  };

  const removeDraftLineFromSheet = () => {
    if (lineSheetEditingId === null) {
      closeLineSheet();
      return;
    }
    const id = lineSheetEditingId;
    closeLineSheet();
    removeProductLine(id);
  };

  const draftMatchedProduct = draftLine ? findProductOption(draftLine.mat_hang, productSelectOptions) : null;
  const isDraftValid = Boolean(
    draftLine && draftLine.mat_hang.trim() && draftLine.so_luong.trim()
  );

  const describeAcceptanceLine = (line: ProductLine, index: number): React.ReactNode => {
    const matched = findProductOption(line.mat_hang, productSelectOptions);
    const code = line.mat_hang.trim() || 'Chưa chọn mã';
    const name = matched?.name || line.mat_hang.trim();
    const unit = (matched?.unit || line.don_vi).trim() || '-';
    const qty = line.so_luong.trim() || '—';
    return (
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-black text-ink-800">{code}</span>
          {name && (
            <>
              <span className="text-[11px] font-bold text-ink-500">·</span>
              <span className="truncate text-[11px] font-semibold text-ink-600">{name}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-[11px] font-semibold text-ink-500">
          <span>SL: <span className="font-mono font-black text-ink-800">{qty}</span> {unit}</span>
        </div>
      </div>
    );
  };

  const handleQrScan = useCallback(
    (raw: string): boolean | 'incremented' => {
      setMessage('');

      const code = parseQrProductCode(raw);
      if (!code) {
        setError('Mã QR không hợp lệ.');
        return false;
      }

      const unit = findProductOption(code, productSelectOptions)?.unit ?? '';

      let targetLineId = '';
      let result: boolean | 'incremented' = false;

      setForm(prev => {
        const existingIndex = prev.lines.findIndex(line => lineHasProductCode(line, code));
        if (existingIndex >= 0) {
          const existingLine = prev.lines[existingIndex];
          targetLineId = existingLine.id;
          result = 'incremented';
          return {
            ...prev,
            lines: prev.lines.map((line, index) =>
              index === existingIndex
                ? { ...line, so_luong: incrementQuantityString(line.so_luong) }
                : line
            )
          };
        }

        const emptyLineIndex = prev.lines.findIndex(line => isBlankProductLine(line));
        if (emptyLineIndex >= 0) {
          const targetLine = prev.lines[emptyLineIndex];
          targetLineId = targetLine.id;
          result = true;
          return {
            ...prev,
            lines: prev.lines.map((line, index) =>
              index === emptyLineIndex
                ? { ...line, mat_hang: code, don_vi: unit || line.don_vi, so_luong: '1' }
                : line
            )
          };
        }

        const nextLine = {
          ...newProductLine(),
          mat_hang: code,
          don_vi: unit,
          so_luong: '1'
        };
        targetLineId = nextLine.id;
        result = true;
        return {
          ...prev,
          lines: [...prev.lines, nextLine]
        };
      });

      if (!result) {
        setError('Không thể thêm mã SP.');
        return false;
      }

      setError('');
      setHighlightLineId(targetLineId);
      if (result === 'incremented') {
        setMessage(`Đã tăng số lượng mã SP: ${code}`);
        return 'incremented';
      }

      setMessage(`Đã thêm mã SP: ${code}`);
      return true;
    },
    [productSelectOptions]
  );

  const getQrConfirmMessage = useCallback((code: string) => {
    const exists = formLinesRef.current.some(line => lineHasProductCode(line, code));
    if (exists) {
      return `Đã quét mã ${code}. Mã này đã có — bấm Xác nhận để tăng thêm 1 SL.`;
    }
    const hasBlankLine = formLinesRef.current.some(line => isBlankProductLine(line));
    if (hasBlankLine) {
      return `Đã quét mã ${code}. Bấm Xác nhận để điền vào dòng trống.`;
    }
    return `Đã quét mã ${code}. Bấm Xác nhận để thêm dòng mới.`;
  }, []);

  const handleImagePick = async (file: File | null) => {
    if (!file) return;
    setError('');
    setIsUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm(prev => ({ ...prev, imagePreview: dataUrl }));
      const uploaded = await uploadImage(dataUrl);
      setForm(prev => ({
        ...prev,
        hinh_anh: uploaded.imageUrl,
        hinh_anh_public_id: uploaded.imagePublicId,
        imagePreview: uploaded.imageUrl
      }));
    } catch (err: any) {
      setError(err.message || 'Không thể upload ảnh.');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(newReportForm());
    setMessage('');
    setError('');
  };

  const startEdit = (report: AcceptanceReport) => {
    const linked =
      machines.find(machine => machine.code === report.ma_may) ??
      machines.find(machine => machine.name === report.ten_may) ??
      machines.find(machine => machine.code === report.ten_may || machine.name === report.ma_may) ??
      null;
    const machineRef = report.ten_may || report.ma_may;
    setEditingId(report.id);
    setForm({
      ngay: report.ngay || todayIso(),
      ca: report.ca,
      lan: report.lan || '1',
      gio: report.gio || nowTimeValue(),
      ma_may: report.ma_may,
      ten_may: report.ten_may,
      machineRef,
      teamId: linked?.id ?? '',
      lines: [
        {
          id: report.id,
          mat_hang: report.mat_hang,
          don_vi: report.don_vi,
          so_luong: report.so_luong === null ? '' : String(report.so_luong)
        }
      ],
      hinh_anh: report.hinh_anh,
      hinh_anh_public_id: report.hinh_anh_public_id || '',
      imagePreview: report.hinh_anh
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const parseLineQuantity = (value: string) => Number(String(value).replace(',', '.'));

  const validateForm = () => {
    if (!form.ngay.trim()) {
      setError('Vui lòng chọn ngày.');
      return null;
    }
    if (!form.ca.trim()) {
      setError('Vui lòng chọn ca.');
      return null;
    }
    if (!form.ma_may.trim() && !form.ten_may.trim()) {
      setError('Vui lòng chọn tổ.');
      return null;
    }
    if (!form.lan.trim()) {
      setError('Vui lòng nhập lần ghi nhận.');
      return null;
    }

    const validLines = form.lines
      .map(line => {
        const soLuong = parseLineQuantity(line.so_luong);
        return { ...line, soLuong };
      })
      .filter(line => line.mat_hang.trim() || line.so_luong.trim());

    if (validLines.length === 0) {
      setError('Vui lòng thêm ít nhất một dòng mã SP và số lượng.');
      return null;
    }

    for (const line of validLines) {
      if (!line.mat_hang.trim()) {
        setError('Vui lòng chọn mã SP cho từng dòng.');
        return null;
      }
      if (!Number.isFinite(line.soLuong) || line.soLuong <= 0) {
        setError(`Số lượng phải lớn hơn 0 (${line.mat_hang}).`);
        return null;
      }
    }

    if (!form.hinh_anh.trim()) {
      setError('Vui lòng chụp ảnh chung cho các dòng sản lượng.');
      return null;
    }

    return validLines;
  };

  const handleSave = async () => {
    const validLines = validateForm();
    if (!validLines) return;

    setIsSaving(true);
    setError('');
    setMessage('');

    const sharedPayload = {
      ngay: form.ngay,
      ca: form.ca,
      lan: form.lan,
      gio: form.gio,
      ma_may: form.ma_may,
      ten_may: form.ten_may,
      hinh_anh: form.hinh_anh,
      hinh_anh_public_id: form.hinh_anh_public_id
    };

    try {
      if (editingId) {
        const line = validLines[0];
        const res = await fetch(`/api/bao-cao-nghiem-thu/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...sharedPayload,
            mat_hang: line.mat_hang,
            don_vi: line.don_vi,
            so_luong: line.soLuong
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Không thể lưu báo cáo sản lượng.');
        setMessage('Đã cập nhật báo cáo sản lượng.');
      } else {
        let savedCount = 0;
        for (const line of validLines) {
          const res = await fetch('/api/bao-cao-nghiem-thu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...sharedPayload,
              mat_hang: line.mat_hang,
              don_vi: line.don_vi,
              so_luong: line.soLuong
            })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Không thể lưu báo cáo sản lượng.');
          savedCount += 1;
        }
        setMessage(
          savedCount > 1 ? `Đã lưu ${savedCount} dòng sản lượng với ảnh chung.` : 'Đã lưu báo cáo sản lượng.'
        );
      }

      resetForm();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu báo cáo sản lượng.');
    } finally {
      setIsSaving(false);
    }
  };

  const teamSelectValue =
    form.teamId ||
    machines.find(machine => machine.id === form.machineRef)?.id ||
    machines.find(machine => machine.code === form.ma_may || machine.name === form.ten_may)?.id ||
    '';

  return (
    <div className="space-y-3 pb-24">
      <section className="overflow-hidden rounded-lg border border-ink-200 bg-white" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between gap-2 border-b border-ink-200 px-3 py-2.5">
          <h2 className="text-[14px] font-semibold text-ink-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Phiếu báo cáo sản lượng</h2>
          <div className="flex items-center gap-1.5">
            {onOpenList && (
              <button
                type="button"
                onClick={onOpenList}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-ink-200 px-2 text-[11px] font-semibold text-ink-700 transition hover:bg-ink-50"
              >
                <List className="h-3.5 w-3.5" />
                Danh sách
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-ink-200 px-2 text-[11px] font-semibold text-ink-700 transition hover:bg-ink-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Quay lại
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-ink-50/60 p-2.5 md:grid-cols-3 lg:grid-cols-6">
          <label className="space-y-0.5">
            <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-ink-500">
              <CalendarDays className="h-3 w-3 text-brand-500" /> Ngày
            </span>
            <input type="date" value={form.ngay} onChange={e => handleDateChange(e.target.value)} className={inputClass} />
          </label>
          <label className="space-y-0.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-ink-500">Ca</span>
            <select value={form.ca} onChange={e => handleShiftChange(e.target.value)} className={inputClass}>
              <option value="">Chọn ca từ lệnh SX...</option>
              {shiftOptions.map(shift => (
                <option key={shift} value={shift}>
                  {shift}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-0.5 lg:col-span-2">
            <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-ink-500">
              <Cpu className="h-3 w-3 text-brand-500" /> Tổ
            </span>
            <select
              value={teamSelectValue}
              onChange={e => handleTeamChange(e.target.value)}
              className={inputClass}
              disabled={!form.ca}
            >
              <option value="">{form.ca ? 'Chọn tổ...' : 'Chọn ca trước'}</option>
              {teamOptions.map(team => (
                <option key={team.id} value={team.id}>
                  {team.code && team.name && team.code !== team.name
                    ? `${team.code} · ${team.name}`
                    : team.name || team.code}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-0.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-ink-500">Lần</span>
            <input
              value={form.lan}
              onChange={e => setForm(prev => ({ ...prev, lan: e.target.value }))}
              className={inputClass}
              placeholder="VD: 1"
            />
          </label>
          <label className="space-y-0.5">
            <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-ink-500">
              <Clock3 className="h-3 w-3 text-brand-500" /> Giờ
            </span>
            <input
              type="time"
              value={form.gio}
              onChange={e => setForm(prev => ({ ...prev, gio: e.target.value }))}
              className={inputClass}
            />
          </label>
        </div>

        <div className="border-t border-ink-100 bg-white p-2.5">
          <RepeatableLinesBlock
            title="Mã SP & số lượng"
            required
            showColumnHeaders
            onAdd={editingId ? addProductLine : openNewLineSheet}
            addLabel="Thêm dòng"
            hideAddButton={Boolean(editingId)}
            extraHeaderButtons={
              !editingId ? (
                <button
                  type="button"
                  onClick={() => setIsQrScannerOpen(true)}
                  className="flex h-7 items-center gap-1 rounded-md border border-brand-500 bg-brand-50 px-2 text-[10px] font-bold text-brand-700 transition hover:bg-brand-100"
                >
                  <ScanBarcode className="h-3 w-3" />
                  Quét QR
                </button>
              ) : null
            }
            columns={[
              { key: 'mat_hang', label: 'Mã SP', className: 'min-w-[180px] flex-[1.2]', required: true },
              { key: 'ten_sp', label: 'Tên SP', className: 'min-w-[220px] flex-[1.5]' },
              { key: 'don_vi', label: 'ĐVT', className: 'w-20' },
              { key: 'so_luong', label: 'SL', className: 'w-28', required: true },
              { key: 'actions', label: '', className: 'w-10' }
            ]}
          >
            {form.lines.map((line, index) => {
              const matchedProduct = findProductOption(line.mat_hang, productSelectOptions);
              return (
              <React.Fragment key={line.id}>
              <RepeatableLineRow
                className={line.id === highlightLineId ? 'line-added-flash rounded-lg px-1' : ''}
              >
                <div className="min-w-[180px] flex-[1.2]">
                  <SearchableSelect
                    value={line.mat_hang}
                    onChange={code => handleLineProductChange(line.id, code)}
                    options={productSelectOptions}
                    placeholder="Gõ để tìm mã SP"
                    isLoading={isLoadingProducts}
                    inputClassName={inputClass}
                    getValue={item => (item as ProductSelectOption).code}
                    getLabel={item => {
                      const product = item as ProductSelectOption;
                      return product.name ? `${product.code} · ${product.name}` : product.code;
                    }}
                  />
                </div>
                <div className="min-w-[220px] flex-[1.5]">
                  <input
                    value={matchedProduct?.name || ''}
                    readOnly
                    className={`${inputClass} bg-zinc-50 text-zinc-700`}
                    placeholder="Tự động theo mã SP"
                    aria-label="Tên SP"
                  />
                </div>
                <div className="w-20">
                  <input
                    value={line.don_vi}
                    readOnly
                    className={`${inputClass} bg-zinc-50 text-zinc-600`}
                    placeholder="-"
                    aria-label="ĐVT"
                  />
                </div>
                <div className="w-28">
                  <input
                    value={line.so_luong}
                    onChange={e => handleLineQuantityChange(line.id, e.target.value)}
                    className={inputClass}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Số lượng"
                  />
                </div>
                {!editingId && form.lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProductLine(line.id)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    aria-label={`Xóa dòng ${index + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </RepeatableLineRow>
              {!editingId ? (
                <RepeatableLineCard
                  index={index + 1}
                  summary={describeAcceptanceLine(line, index)}
                  onEdit={() => openEditLineSheet(line.id)}
                  onRemove={form.lines.length > 1 ? () => removeProductLine(line.id) : undefined}
                />
              ) : null}
              </React.Fragment>
            );
            })}
          </RepeatableLinesBlock>

          <div className="mt-2.5 space-y-1.5 rounded-md border border-ink-200 bg-ink-50/60 p-2.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-500">Ảnh chung <span className="text-rose-500">*</span></span>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handleImagePick(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 text-[11px] font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
              >
                {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {isUploading ? 'Đang tải ảnh...' : 'Chụp / chọn ảnh chung'}
              </button>
              {form.imagePreview && (
                <a
                  href={form.imagePreview}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-12 w-12 shrink-0 overflow-hidden rounded-md border border-ink-200"
                >
                  <img src={form.imagePreview} alt="Ảnh chung" className="h-full w-full object-cover" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-ink-100 bg-white px-3 py-2.5">
          <button type="button" onClick={resetForm} className="h-9 rounded-md border border-ink-200 bg-white px-3 text-[11px] font-semibold text-ink-700">
            Làm mới
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-500 px-3 text-[11px] font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {editingId ? 'Cập nhật' : 'Lưu báo cáo'}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-[12px] font-semibold text-danger-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-success-200 bg-success-50 px-3 py-2 text-[12px] font-semibold text-success-700">
          {message}
        </div>
      )}

      <ProductQrScanner
        open={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScan={handleQrScan}
        getConfirmMessage={getQrConfirmMessage}
      />

      <LineEditorSheet
        open={lineSheetOpen}
        onClose={closeLineSheet}
        title={lineSheetEditingId === null ? 'Thêm dòng sản phẩm' : 'Sửa dòng sản phẩm'}
        subtitle="Chọn mã SP, số lượng sẽ tự cộng dồn nếu quét QR."
        primaryLabel={lineSheetEditingId === null ? 'Thêm dòng' : 'Cập nhật'}
        primaryDisabled={!isDraftValid}
        onPrimary={persistDraftLine}
        primaryIcon={<Plus className="h-4 w-4" />}
      >
        {draftLine && (
          <>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-ink-500">
                Mã SP *
              </label>
              <div className="mt-1.5">
                <SearchableSelect
                  value={draftLine.mat_hang}
                  onChange={handleDraftProductChange}
                  options={productSelectOptions}
                  placeholder="Gõ để tìm mã SP"
                  isLoading={isLoadingProducts}
                  inputClassName="h-12 w-full rounded-lg border border-ink-200 bg-white px-3 text-base font-semibold text-ink-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                  getValue={item => (item as ProductSelectOption).code}
                  getLabel={item => {
                    const product = item as ProductSelectOption;
                    return product.name ? `${product.code} · ${product.name}` : product.code;
                  }}
                />
              </div>
              {draftMatchedProduct?.name ? (
                <p className="mt-1 text-[11px] font-semibold text-ink-500">
                  Tên: {draftMatchedProduct.name}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[0.6fr_1fr]">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-ink-500">Đơn vị</label>
                <input
                  value={draftMatchedProduct?.unit || draftLine.don_vi}
                  readOnly
                  className="mt-1 h-12 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 text-base font-semibold text-ink-700 outline-none"
                  placeholder="-"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-ink-500">Số lượng *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={draftLine.so_luong}
                  onChange={e => updateDraftLine({ so_luong: e.target.value })}
                  className="mt-1 h-12 w-full rounded-lg border border-ink-200 bg-white px-3 text-right text-base font-black text-ink-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                  placeholder="0"
                />
              </div>
            </div>

            {lineSheetEditingId !== null && (
              <button
                type="button"
                onClick={removeDraftLineFromSheet}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger-300 bg-danger-50 px-4 py-2.5 text-xs font-black text-danger-700 transition hover:bg-danger-100"
              >
                <Trash2 className="h-4 w-4" />
                Xoá dòng này
              </button>
            )}
          </>
        )}
      </LineEditorSheet>
    </div>
  );
}

export function normalizeAcceptanceReports(data: unknown): AcceptanceReport[] {
  if (!data || typeof data !== 'object') return [];
  const rows = (data as { reports?: unknown }).reports;
  if (!Array.isArray(rows)) return [];
  return rows.map((item: Record<string, unknown>) => normalizeReportFromApi(item));
}
