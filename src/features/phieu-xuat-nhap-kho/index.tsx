import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage } from '../_shared/recordHelpers';
import WarehouseSlipPrintModal from '../../components/WarehouseSlipPrintModal';
import { STORAGE_WAREHOUSE_SLIP_DRAFT_KEY } from '../_shared/storage';

export type WarehouseSlipType = 'nhap' | 'xuat';
export type WarehouseKind = 'nvl' | 'san_pham';

export interface WarehouseMovementRow {
  id: string;
  slipCode: string;
  slipType: WarehouseSlipType;
  warehouseKind: WarehouseKind;
  slipDate: string;
  shift: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  documentQuantity?: number;
  unitPrice: number;
  lineAmount: number;
  reason: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface WarehouseSlipLineDraft {
  key: string;
  code: string;
  name: string;
  unit: string;
  quantity: string;
  documentQuantity?: string;
  unitPrice: string;
  quotaQuantity?: string;
  suggestedQuantity?: string;
  lineNote?: string;
}

export type WarehouseSlipPrefillDraft = {
  slipType: WarehouseSlipType;
  warehouseKind: WarehouseKind;
  slipDate?: string;
  reason: string;
  note: string;
  createdBy: string;
  productionOrderRef?: string;
  machine?: string;
  shift?: string;
  recipient?: string;
  deliverer?: string;
  warehouseLocation?: string;
  editSlipCode?: string;
  lines: Array<
    Pick<
      WarehouseSlipLineDraft,
      'code' | 'name' | 'unit' | 'quantity' | 'documentQuantity' | 'unitPrice' | 'quotaQuantity' | 'suggestedQuantity' | 'lineNote'
    >
  >;
};

export function buildWarehouseSlipDraftFromHistoryRows(
  rows: WarehouseMovementRow[],
  slipCode: string
): WarehouseSlipPrefillDraft | null {
  const header = rows[0];
  if (!header) return null;

  return {
    slipType: header.slipType,
    warehouseKind: header.warehouseKind,
    slipDate: header.slipDate,
    reason: header.reason || '',
    note: header.note || '',
    createdBy: header.createdBy || '',
    shift: header.shift || '',
    editSlipCode: slipCode,
    lines: rows.map(row => ({
      code: row.itemCode,
      name: row.itemName,
      unit: row.unit,
      quantity: formatNumber(row.quantity, 2),
      documentQuantity:
        row.documentQuantity != null && Number.isFinite(row.documentQuantity)
          ? formatNumber(row.documentQuantity, 2)
          : '',
      unitPrice: row.unitPrice > 0 ? String(row.unitPrice) : ''
    }))
  };
}

const warehouseFieldClass =
  'h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

export function parseWarehouseShiftSelection(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map(item => item.trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[,;+]/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function formatWarehouseShiftSelection(shifts: string[]): string {
  return shifts.join(', ');
}

export function toggleWarehouseShiftSelection(current: string[], shiftValue: string): string[] {
  return current.includes(shiftValue)
    ? current.filter(item => item !== shiftValue)
    : [...current, shiftValue];
}

export function warehouseSlipTypeLabel(type: WarehouseSlipType) {
  return type === 'nhap' ? 'Nhập kho' : 'Xuất kho';
}

export function warehouseKindLabel(kind: WarehouseKind) {
  return kind === 'san_pham' ? 'Kho Sản phẩm' : 'Kho NVL';
}

export function warehouseItemCodeLabel(kind: WarehouseKind) {
  return kind === 'san_pham' ? 'Mã SP' : 'Mã NPL';
}

export function warehouseItemNameLabel(kind: WarehouseKind) {
  return kind === 'san_pham' ? 'Tên SP' : 'Tên NVL';
}

export function computeWarehouseLineAmount(quantityText: string, unitPriceText: string): number {
  const quantity = parsePercentInput(quantityText);
  const unitPrice = parseMoneyInput(unitPriceText);
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return 0;
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function generateWarehouseSlipPreviewCode(slipType: WarehouseSlipType) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  return `${slipType === 'nhap' ? 'PN' : 'PX'}-${date}-${time}`;
}

export type WarehouseSlipPayloadItem = {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  documentQuantity?: number;
  unitPrice: number;
  quotaQuantity?: number;
  suggestedQuantity?: number;
  lineNote?: string;
};

export function parseWarehouseSlipPayloadItems(
  lines: WarehouseSlipLineDraft[],
  warehouseKind: WarehouseKind,
  options?: { allowMissingUnitPrice?: boolean }
): { error: string } | { items: WarehouseSlipPayloadItem[] } {
  const itemLabel = warehouseKind === 'san_pham' ? 'sản phẩm' : 'NVL';
  const codeLabel = warehouseItemCodeLabel(warehouseKind);
  const allowMissingUnitPrice = options?.allowMissingUnitPrice ?? false;

  const payloadItems = lines
    .map(line => {
      const quantity = parsePercentInput(line.quantity);
      const documentQuantity = parsePercentInput(line.documentQuantity ?? line.suggestedQuantity ?? '');
      const unitPrice = parseMoneyInput(line.unitPrice);
      const quotaQuantity = parsePercentInput(line.quotaQuantity ?? '');
      const suggestedQuantity = parsePercentInput(line.suggestedQuantity ?? '');
      return {
        code: line.code.trim(),
        name: line.name.trim(),
        unit: line.unit.trim(),
        quantity,
        documentQuantity:
          Number.isFinite(documentQuantity) && documentQuantity > 0 ? documentQuantity : undefined,
        unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
        quotaQuantity: Number.isFinite(quotaQuantity) && quotaQuantity > 0 ? quotaQuantity : undefined,
        suggestedQuantity:
          Number.isFinite(suggestedQuantity) && suggestedQuantity > 0 ? suggestedQuantity : undefined,
        lineNote: line.lineNote?.trim() || undefined
      };
    })
    .filter(line => line.code || line.quantity);

  if (payloadItems.length === 0) {
    return { error: `Vui lòng thêm ít nhất một dòng ${itemLabel}.` };
  }

  for (const item of payloadItems) {
    if (!item.code) {
      return { error: `Mỗi dòng cần chọn ${codeLabel}.` };
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return { error: `Số lượng của ${item.code} phải lớn hơn 0.` };
    }
    if (!allowMissingUnitPrice && (!Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
      return { error: `Giá của ${item.code} không hợp lệ.` };
    }
  }

  return { items: payloadItems };
}

export function buildWarehouseSlipPrintData(
  items: WarehouseSlipPayloadItem[],
  options: {
    slipCode: string;
    slipType: WarehouseSlipType;
    warehouseKind: WarehouseKind;
    slipDate: string;
    reason: string;
    note: string;
    createdBy: string;
    productionOrderRef?: string;
    machine?: string;
    shift?: string;
    recipient?: string;
    deliverer?: string;
    warehouseLocation?: string;
  }
): WarehouseSlipPrintData {
  const printLines = items.map(item => ({
    code: item.code,
    name: item.name,
    unit: item.unit,
    quantity: item.quantity,
    documentQuantity: item.documentQuantity ?? item.suggestedQuantity ?? null,
    unitPrice: item.unitPrice,
    lineAmount: Math.round(item.quantity * item.unitPrice * 100) / 100,
    quotaQuantity: item.quotaQuantity ?? null,
    suggestedQuantity: item.suggestedQuantity ?? null,
    lineNote: item.lineNote
  }));

  return {
    slipCode: options.slipCode,
    slipType: options.slipType,
    warehouseKind: options.warehouseKind,
    slipDate: options.slipDate,
    reason: options.reason,
    note: options.note,
    createdBy: options.createdBy,
    productionOrderRef: options.productionOrderRef,
    machine: options.machine,
    shift: options.shift,
    recipient: options.recipient,
    deliverer: options.deliverer,
    warehouseLocation: options.warehouseLocation,
    totalAmount: printLines.reduce((sum, line) => sum + line.lineAmount, 0),
    lines: printLines
  };
}

export function formatWarehouseMoney(value: number) {
  return formatMoney(value, 0);
}

export function createWarehouseLineDraft(): WarehouseSlipLineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: '',
    name: '',
    unit: '',
    quantity: '',
    documentQuantity: '',
    unitPrice: ''
  };
}

export function createWarehouseLineDraftFromPrefill(
  line: Pick<
    WarehouseSlipLineDraft,
    'code' | 'name' | 'unit' | 'quantity' | 'documentQuantity' | 'unitPrice' | 'quotaQuantity' | 'suggestedQuantity' | 'lineNote'
  >
): WarehouseSlipLineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: line.code || '',
    name: line.name || '',
    unit: line.unit || '',
    quantity: line.quantity || '',
    documentQuantity: line.documentQuantity || line.suggestedQuantity || '',
    unitPrice: line.unitPrice || '',
    quotaQuantity: line.quotaQuantity || '',
    suggestedQuantity: line.suggestedQuantity || '',
    lineNote: line.lineNote || ''
  };
}

export function normalizeWarehouseMovements(data: unknown): WarehouseMovementRow[] {
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
      const documentQuantity = Number(record.so_luong_chung_tu ?? record.documentQuantity);
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
        shift: String(record.ca ?? record.shift ?? record.ca_san_xuat ?? '').trim(),
        itemCode,
        itemName,
        unit: String(record.don_vi ?? record.unit ?? '').trim() || '-',
        quantity: Number.isFinite(quantity) ? quantity : 0,
        documentQuantity: Number.isFinite(documentQuantity) && documentQuantity > 0 ? documentQuantity : undefined,
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

export function mapWarehouseMovementsForShiftSummary(rows: WarehouseMovementRow[]): ShiftSummaryWarehouseMovement[] {
  return rows.map(row => ({
    id: row.id,
    slipCode: row.slipCode,
    slipDate: row.slipDate,
    shift: row.shift,
    slipType: row.slipType,
    warehouseKind: row.warehouseKind,
    itemCode: row.itemCode,
    itemName: row.itemName,
    unit: row.unit,
    quantity: row.quantity,
    createdBy: row.createdBy
  }));
}

export function WarehouseSlipPanel({
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
  const [productionOrderRef, setProductionOrderRef] = useState('');
  const [machine, setMachine] = useState('');
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [recipient, setRecipient] = useState('');
  const [deliverer, setDeliverer] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('Đà Nẵng');
  const [lines, setLines] = useState<WarehouseSlipLineDraft[]>(() => [createWarehouseLineDraft()]);
  const [itemOptions, setItemOptions] = useState<MaterialOption[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [printSlip, setPrintSlip] = useState<WarehouseSlipPrintData | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printAutoTrigger, setPrintAutoTrigger] = useState(false);
  const [editSlipCode, setEditSlipCode] = useState<string | null>(null);
  const [shiftSettings, setShiftSettings] = useState<ReturnType<typeof normalizeShiftSettings>>([]);

  const shiftOptions = useMemo(() => getProductionShiftOptions(shiftSettings), [shiftSettings]);

  useEffect(() => {
    const loadShiftSettings = async () => {
      try {
        const res = await fetch('/api/cai-dat');
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setShiftSettings(normalizeShiftSettings(data));
        }
      } catch {
        setShiftSettings([]);
      }
    };
    void loadShiftSettings();
  }, []);

  useEffect(() => {
    const rawDraft = localStorage.getItem(STORAGE_WAREHOUSE_SLIP_DRAFT_KEY);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as Partial<WarehouseSlipPrefillDraft>;
      if (!draft || !Array.isArray(draft.lines) || draft.lines.length === 0) return;

      setWarehouseKind(draft.warehouseKind === 'san_pham' ? 'san_pham' : 'nvl');
      setSlipType(draft.slipType === 'nhap' ? 'nhap' : 'xuat');
      if (draft.slipDate) setSlipDate(draft.slipDate);
      setReason(draft.reason || '');
      setNote(draft.note || '');
      setCreatedBy(draft.createdBy || '');
      setProductionOrderRef(draft.productionOrderRef || '');
      setMachine(draft.machine || '');
      setSelectedShifts(parseWarehouseShiftSelection(draft.shift));
      setRecipient(draft.recipient || '');
      setDeliverer(draft.deliverer || draft.recipient || '');
      setWarehouseLocation(draft.warehouseLocation || 'Đà Nẵng');
      setLines(draft.lines.map(createWarehouseLineDraftFromPrefill));
      const editingCode = String(draft.editSlipCode || '').trim();
      if (editingCode) {
        setEditSlipCode(editingCode);
        setActionMessage(`Đang sửa phiếu ${editingCode}. Chỉnh sửa và bấm cập nhật để lưu.`);
      } else {
        setActionMessage('Đã điền sẵn phiếu xuất kho từ hạch toán định mức NVL.');
      }
      setFormError('');
    } catch {
      setFormError('Không thể đọc dữ liệu phiếu xuất kho đã chuyển sang.');
    } finally {
      localStorage.removeItem(STORAGE_WAREHOUSE_SLIP_DRAFT_KEY);
    }
  }, []);

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

  const shiftLabel = formatWarehouseShiftSelection(selectedShifts);

  const handlePrintPreview = () => {
    void handleSave();
  };

  const handleSave = async () => {
    const parsed = parseWarehouseSlipPayloadItems(lines, warehouseKind, {
      allowMissingUnitPrice: warehouseKind === 'nvl' && slipType === 'xuat'
    });
    if ('error' in parsed) {
      setFormError(parsed.error);
      return;
    }

    const payloadItems = parsed.items;
    setIsSaving(true);
    setFormError('');
    setActionMessage('');

    const isEditing = Boolean(editSlipCode);
    const slipPayload = {
      loaiPhieu: slipType,
      loaiKho: warehouseKind,
      ngayPhieu: slipDate,
      lyDo: reason.trim(),
      ghiChu: note.trim(),
      nguoiLap: createdBy.trim(),
      ca: shiftLabel || null,
      items: payloadItems
    };

    try {
      const res = await fetch(
        isEditing ? `/api/phieu-xuat-nhap-kho/${encodeURIComponent(editSlipCode!)}` : '/api/phieu-xuat-nhap-kho',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slipPayload)
        }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || (isEditing ? 'Không thể cập nhật phiếu xuất nhập kho.' : 'Không thể lưu phiếu xuất nhập kho.'));
      }

      const savedSlipCode = String(data.slipCode || editSlipCode || '').trim();

      setPrintSlip(
        buildWarehouseSlipPrintData(payloadItems, {
          slipCode: savedSlipCode,
          slipType,
          warehouseKind,
          slipDate,
          reason: reason.trim(),
          note: note.trim(),
          createdBy: createdBy.trim(),
          productionOrderRef: productionOrderRef.trim(),
          machine: machine.trim(),
          shift: shiftLabel,
          recipient: recipient.trim(),
          deliverer: deliverer.trim(),
          warehouseLocation: warehouseLocation.trim()
        })
      );
      setPrintAutoTrigger(false);
      setPrintModalOpen(true);
      setActionMessage(
        isEditing
          ? `Đã cập nhật phiếu ${savedSlipCode} (${warehouseKindLabel(warehouseKind)}). Xem tại Lịch sử xuất nhập kho.`
          : `Đã lưu phiếu ${savedSlipCode} (${warehouseKindLabel(warehouseKind)}) vào lịch sử.`
      );
      setEditSlipCode(null);
      setReason('');
      setNote('');
      setDeliverer('');
      setProductionOrderRef('');
      setLines([createWarehouseLineDraft()]);
    } catch (error: any) {
      setFormError(error.message || 'Không thể lưu phiếu xuất nhập kho.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="bg-white p-3 text-slate-700 border-b border-slate-200">
          <div className="flex items-start justify-end gap-3">
            <div className="hidden">
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
            </div>
          </div>
        </div>
      </section>

      {editSlipCode ? (
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-amber-800">Chế độ sửa phiếu</p>
          <p className="mt-1 text-sm font-bold text-amber-950">
            Mã phiếu: <span className="font-black">{editSlipCode}</span> — thay đổi sẽ ghi đè toàn bộ dòng của phiếu này.
          </p>
        </section>
      ) : null}

      {(formError || actionMessage) && (
        <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-4 shadow-sm">
          {formError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{formError}</p>
          )}
          {actionMessage && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-xs font-bold text-emerald-700">{actionMessage}</p>
              <button
                type="button"
                onClick={onOpenHistory}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 text-[11px] font-black text-emerald-800 transition hover:bg-emerald-100"
              >
                <History className="h-3.5 w-3.5" />
                Xem lịch sử
              </button>
            </div>
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
          <div className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ca</span>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              {shiftOptions.length === 0 ? (
                <p className="text-xs font-semibold text-zinc-400">Chưa có ca trong cài đặt.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {shiftOptions.map(option => {
                    const checked = selectedShifts.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                          checked
                            ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedShifts(current => toggleWarehouseShiftSelection(current, option.value))
                          }
                          className="h-3.5 w-3.5 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              )}
              {selectedShifts.length > 0 ? (
                <p className="mt-2 text-[11px] font-semibold text-zinc-500">
                  Đã chọn: {shiftLabel}
                </p>
              ) : null}
            </div>
          </div>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Lý do</span>
            <input value={reason} onChange={event => setReason(event.target.value)} className={warehouseFieldClass} placeholder="VD: Nhập mua ngoài, xuất sản xuất..." />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
            <input value={note} onChange={event => setNote(event.target.value)} className={warehouseFieldClass} placeholder={slipType === 'nhap' ? 'Số chứng từ gốc kèm theo...' : 'Ghi chú thêm (tuỳ chọn)'} />
          </label>
          {slipType === 'nhap' && (
            <>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Theo số chứng từ / lệnh SX</span>
                <input
                  value={productionOrderRef}
                  onChange={event => setProductionOrderRef(event.target.value)}
                  className={warehouseFieldClass}
                  placeholder="Số hóa đơn, lệnh SX, biên bản giao nhận..."
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Người giao hàng</span>
                <input
                  value={deliverer}
                  onChange={event => setDeliverer(event.target.value)}
                  className={warehouseFieldClass}
                  placeholder="Họ tên người giao hàng"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Địa điểm</span>
                <input
                  value={warehouseLocation}
                  onChange={event => setWarehouseLocation(event.target.value)}
                  className={warehouseFieldClass}
                  placeholder="VD: Đà Nẵng"
                />
              </label>
            </>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border-2 border-zinc-900/10 bg-white p-4 shadow-sm">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                Chi tiết {warehouseKind === 'san_pham' ? 'sản phẩm' : 'NVL'}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-zinc-500">
                Mỗi dòng là một {warehouseKind === 'san_pham' ? 'mã SP' : 'mã NPL'} trong phiếu
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLines(current => [...current, createWarehouseLineDraft()])}
              className="flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-extrabold text-zinc-700 transition hover:bg-zinc-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm dòng
            </button>
          </div>

          <div
            className={
              slipType === 'nhap'
                ? 'hidden xl:grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_4.5rem_5.5rem_5.5rem_5.5rem_5.5rem_2.5rem] xl:gap-3 xl:border-b xl:border-zinc-200/80 xl:pb-1.5'
                : 'hidden xl:grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_5rem_6rem_6rem_6rem_2.5rem] xl:gap-3 xl:border-b xl:border-zinc-200/80 xl:pb-1.5'
            }
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              {warehouseItemCodeLabel(warehouseKind)} *
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              {warehouseItemNameLabel(warehouseKind)}
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Đơn vị</span>
            {slipType === 'nhap' ? (
              <>
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Theo chứng từ</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Thực nhập *</span>
              </>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Số lượng *</span>
            )}
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Giá</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Thành tiền</span>
            <span />
          </div>

          <div className="divide-y divide-zinc-200/80">
            {lines.map(line => (
              <div
                key={line.key}
                className={
                  slipType === 'nhap'
                    ? 'grid grid-cols-1 gap-3 py-2 first:pt-0 last:pb-0 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_4.5rem_5.5rem_5.5rem_5.5rem_5.5rem_2.5rem] xl:items-end xl:gap-3'
                    : 'grid grid-cols-1 gap-3 py-2 first:pt-0 last:pb-0 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_5rem_6rem_6rem_6rem_2.5rem] xl:items-end xl:gap-3'
                }
              >
                <div className="sm:col-span-2 xl:col-span-1">
                  <SearchableSelect
                    value={line.code}
                    onChange={code => pickItem(line.key, code)}
                    options={itemOptions}
                    placeholder={warehouseKind === 'san_pham' ? 'Gõ để tìm mã SP' : 'Gõ để tìm mã NPL'}
                    isLoading={isLoadingItems}
                    disabled={isLoadingItems}
                    inputClassName={warehouseFieldClass}
                    getLabel={item => {
                      const option = item as MaterialOption;
                      return `${option.code} · ${option.name}`;
                    }}
                    getValue={item => (item as MaterialOption).code}
                  />
                </div>
                <div>
                  <input
                    value={line.name}
                    onChange={event => updateLine(line.key, { name: event.target.value })}
                    className={warehouseFieldClass}
                  />
                </div>
                <div>
                  <input
                    value={line.unit}
                    onChange={event => updateLine(line.key, { unit: event.target.value })}
                    className={warehouseFieldClass}
                  />
                </div>
                {slipType === 'nhap' ? (
                  <>
                    <div>
                      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500 xl:hidden">
                        Theo chứng từ
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={line.documentQuantity || ''}
                        onChange={event => updateLine(line.key, { documentQuantity: event.target.value })}
                        className={warehouseFieldClass}
                        placeholder="SL CT"
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500 xl:hidden">
                        Thực nhập *
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={event => updateLine(line.key, { quantity: event.target.value })}
                        className={warehouseFieldClass}
                        placeholder="SL thực"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={event => updateLine(line.key, { quantity: event.target.value })}
                      className={warehouseFieldClass}
                      placeholder="VD: 100,00"
                    />
                  </div>
                )}
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={line.unitPrice}
                    onChange={event => updateLine(line.key, { unitPrice: sanitizeMoneyInput(event.target.value) })}
                    onBlur={event => updateLine(line.key, { unitPrice: sanitizeMoneyInput(event.target.value) })}
                    className={warehouseFieldClass}
                    placeholder="VD: 25.000"
                  />
                </div>
                <div>
                  <div className={`${warehouseFieldClass} flex items-center bg-white font-mono font-bold text-zinc-900`}>
                    {formatWarehouseMoney(computeWarehouseLineAmount(line.quantity, line.unitPrice))} đ
                  </div>
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines(current => current.filter(item => item.key !== line.key))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 xl:mb-0.5"
                    title="Xóa dòng"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="mr-auto text-[11px] font-semibold text-zinc-500">
            Phiếu chỉ xuất hiện trong lịch sử sau khi bấm <strong>Lưu &amp; in</strong> hoặc <strong>In phiếu</strong>.
          </p>
          <button
            type="button"
            onClick={handlePrintPreview}
            disabled={isSaving}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-5 text-xs font-extrabold text-zinc-700 transition hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            In phiếu
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-[#ef1b2d] px-5 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving
              ? editSlipCode
                ? 'Đang cập nhật...'
                : 'Đang lưu...'
              : editSlipCode
                ? `Cập nhật phiếu ${editSlipCode}`
                : `Lưu & in phiếu ${warehouseSlipTypeLabel(slipType).toLowerCase()}`}
          </button>
        </div>
      </section>

      <WarehouseSlipPrintModal
        open={printModalOpen}
        data={printSlip}
        autoPrint={printAutoTrigger}
        onClose={() => {
          setPrintModalOpen(false);
          setPrintSlip(null);
          setPrintAutoTrigger(false);
        }}
      />
    </div>
  );
}

export function WarehouseHistoryPanel({
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
  const [deletingSlipCode, setDeletingSlipCode] = useState<string | null>(null);
  const [selectedSlipCodes, setSelectedSlipCodes] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [historyPrintSlip, setHistoryPrintSlip] = useState<WarehouseSlipPrintData | null>(null);
  const [historyPrintOpen, setHistoryPrintOpen] = useState(false);
  const [historyPrintAutoTrigger, setHistoryPrintAutoTrigger] = useState(false);

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
    setSelectedSlipCodes(new Set());
    loadMovements();
  }, [warehouseTab, selectedType, fromDate, toDate]);

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredMovements = useMemo(() => {
    return movements.filter(row => {
      if (!normalizedSearch) return true;
      return `${row.slipCode} ${row.shift} ${row.itemCode} ${row.itemName} ${row.reason} ${row.createdBy}`
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [movements, normalizedSearch]);

  useEffect(() => {
    setSelectedSlipCodes(new Set());
  }, [normalizedSearch]);

  const slipGroups = useMemo(() => {
    const map = new Map<string, WarehouseMovementRow[]>();
    filteredMovements.forEach(row => {
      const key = row.slipCode || row.id;
      const current = map.get(key) || [];
      current.push(row);
      map.set(key, current);
    });
    return [...map.entries()]
      .map(([slipCode, rows]) => ({
        slipCode,
        rows,
        header: rows[0],
        totalAmount: rows.reduce((sum, row) => sum + row.lineAmount, 0)
      }))
      .sort((a, b) => {
        const byDate = (b.header.slipDate || '').localeCompare(a.header.slipDate || '');
        if (byDate !== 0) return byDate;
        return (b.slipCode || '').localeCompare(a.slipCode || '', 'vi');
      });
  }, [filteredMovements]);

  const selectableSlips = useMemo(
    () => slipGroups.filter(group => group.slipCode && group.rows.some(row => row.id)),
    [slipGroups]
  );
  const allSelected =
    selectableSlips.length > 0 && selectableSlips.every(group => selectedSlipCodes.has(group.slipCode));
  const selectedCount = selectedSlipCodes.size;

  const toggleSlipSelection = (slipCode: string) => {
    setSelectedSlipCodes(prev => {
      const next = new Set(prev);
      if (next.has(slipCode)) next.delete(slipCode);
      else next.add(slipCode);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedSlipCodes(
      allSelected ? new Set() : new Set(selectableSlips.map(group => group.slipCode))
    );
  };

  const viewingRows = viewingSlipCode
    ? filteredMovements.filter(row => row.slipCode === viewingSlipCode)
    : [];

  const viewingSlipTotal = useMemo(
    () => viewingRows.reduce((sum, row) => sum + row.lineAmount, 0),
    [viewingRows]
  );

  const handlePrintSlipByCode = (slipCode: string, autoPrint = false) => {
    const rows = filteredMovements.filter(row => row.slipCode === slipCode);
    const header = rows[0];
    if (!header) return;

    const totalAmount = rows.reduce((sum, row) => sum + row.lineAmount, 0);
    setHistoryPrintSlip({
      slipCode,
      slipType: header.slipType,
      warehouseKind: header.warehouseKind,
      slipDate: header.slipDate,
      shift: header.shift,
      reason: header.reason,
      note: header.note,
      createdBy: header.createdBy,
      totalAmount,
      lines: rows.map(row => ({
        code: row.itemCode,
        name: row.itemName,
        unit: row.unit,
        quantity: row.quantity,
        documentQuantity: row.documentQuantity ?? null,
        unitPrice: row.unitPrice,
        lineAmount: row.lineAmount
      }))
    });
    setHistoryPrintAutoTrigger(autoPrint);
    setHistoryPrintOpen(true);
  };

  const handlePrintViewingSlip = (autoPrint = false) => {
    if (!viewingSlipCode) return;
    handlePrintSlipByCode(viewingSlipCode, autoPrint);
  };

  const handleEditSlip = (slipCode: string) => {
    const rows = filteredMovements.filter(row => row.slipCode === slipCode);
    const draft = buildWarehouseSlipDraftFromHistoryRows(rows, slipCode);
    if (!draft) return;

    localStorage.setItem(STORAGE_WAREHOUSE_SLIP_DRAFT_KEY, JSON.stringify(draft));
    setViewingSlipCode(null);
    onOpenSlip();
  };

  const handleDeleteSlip = async (slipCode: string, lineCount: number) => {
    if (!slipCode) return;
    if (!window.confirm(`Xóa toàn bộ phiếu ${slipCode} (${lineCount} dòng)?`)) return;

    setDeletingSlipCode(slipCode);
    setError('');
    try {
      const res = await fetch(`/api/phieu-xuat-nhap-kho/slip/${encodeURIComponent(slipCode)}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa phiếu.');
      setSelectedSlipCodes(prev => {
        const next = new Set(prev);
        next.delete(slipCode);
        return next;
      });
      if (viewingSlipCode === slipCode) setViewingSlipCode(null);
      await loadMovements();
    } catch (deleteError: any) {
      setError(deleteError.message || 'Không thể xóa phiếu.');
    } finally {
      setDeletingSlipCode(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;
    if (!window.confirm(`Bạn có chắc muốn xóa ${selectedCount} phiếu đã chọn?`)) return;

    setIsBulkDeleting(true);
    setError('');
    try {
      for (const slipCode of selectedSlipCodes) {
        const res = await fetch(`/api/phieu-xuat-nhap-kho/slip/${encodeURIComponent(slipCode)}`, {
          method: 'DELETE'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Không thể xóa phiếu.');
      }
      if (viewingSlipCode && selectedSlipCodes.has(viewingSlipCode)) {
        setViewingSlipCode(null);
      }
      setSelectedSlipCodes(new Set());
      await loadMovements();
    } catch (deleteError: any) {
      setError(deleteError.message || 'Không thể xóa các phiếu đã chọn.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="bg-white p-3 text-slate-700 border-b border-slate-200">
          <div className="flex items-start justify-end gap-3">
            <div className="hidden">
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Quản lý kho</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Lịch sử xuất nhập kho</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Mỗi dòng là một phiếu · bấm Xem để xem chi tiết NVL/SP bên trong.
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
        {selectableSlips.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-semibold text-zinc-600">
              {selectedCount > 0 ? `Đã chọn ${selectedCount} phiếu` : 'Chọn phiếu để xóa nhiều'}
            </p>
            <button
              type="button"
              disabled={selectedCount === 0 || isBulkDeleting || Boolean(deletingSlipCode)}
              onClick={() => void handleBulkDelete()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Xóa đã chọn{selectedCount > 0 ? ` (${selectedCount})` : ''}
            </button>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="w-10 px-3 py-3 text-center font-black">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={selectableSlips.length === 0 || isBulkDeleting || Boolean(deletingSlipCode)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                    title="Chọn tất cả"
                  />
                </th>
                <th className="px-4 py-3 font-black">Mã phiếu</th>
                <th className="px-4 py-3 font-black">Loại</th>
                <th className="px-4 py-3 font-black">Ngày</th>
                <th className="px-4 py-3 font-black">Ca</th>
                <th className="px-4 py-3 font-black">Người lập</th>
                <th className="px-4 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Đang tải Supabase...
                  </td>
                </tr>
              ) : slipGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-bold text-zinc-400">
                    Chưa có lịch sử {warehouseKindLabel(warehouseTab).toLowerCase()}.
                  </td>
                </tr>
              ) : (
                slipGroups.map(group => {
                  const header = group.header;
                  const lineCount = group.rows.length;
                  const isSelected = selectedSlipCodes.has(group.slipCode);
                  const isDeleting = deletingSlipCode === group.slipCode;

                  return (
                    <tr
                      key={group.slipCode}
                      className={`hover:bg-red-50/40 ${isSelected ? 'bg-red-50/30' : ''}`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!group.slipCode || isBulkDeleting || isDeleting}
                          onChange={() => toggleSlipSelection(group.slipCode)}
                          className="h-3.5 w-3.5 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Chọn phiếu"
                        />
                      </td>
                      <td className="px-4 py-3 font-black text-zinc-950">
                        <div>{group.slipCode || '-'}</div>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                          {lineCount} dòng · {formatWarehouseMoney(group.totalAmount)} đ
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-black ${
                            header.slipType === 'nhap'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {warehouseSlipTypeLabel(header.slipType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-700">{header.slipDate || '-'}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-700">{header.shift || '-'}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-600">{header.createdBy || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingSlipCode(group.slipCode)}
                            title="Xem chi tiết NVL"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditSlip(group.slipCode)}
                            title="Sửa phiếu"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-amber-700 transition hover:bg-amber-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintSlipByCode(group.slipCode, true)}
                            title="In phiếu"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteSlip(group.slipCode, lineCount)}
                            disabled={isDeleting || isBulkDeleting}
                            title="Xóa phiếu"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                  {viewingSlipCode} · {viewingRows.length} dòng {warehouseTab === 'san_pham' ? 'SP' : 'NVL'}
                </p>
              </div>
              <BackButton onClick={() => setViewingSlipCode(null)} />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {[
                ['Kho', warehouseKindLabel(viewingRows[0].warehouseKind)],
                ['Loại', warehouseSlipTypeLabel(viewingRows[0].slipType)],
                ['Ngày', viewingRows[0].slipDate || '-'],
                ['Ca', viewingRows[0].shift || '-'],
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
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#ef1b2d]/20 bg-red-50 px-4 py-3">
                <p className="text-sm font-black text-zinc-950">
                  Tổng tiền: <span className="text-[#ef1b2d]">{formatWarehouseMoney(viewingSlipTotal)} đ</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditSlip(viewingSlipCode!)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-extrabold text-amber-800 transition hover:bg-amber-100"
                  >
                    <Pencil className="h-4 w-4" />
                    Sửa phiếu
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintViewingSlip(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
                  >
                    <Printer className="h-4 w-4" />
                    In phiếu
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <WarehouseSlipPrintModal
        open={historyPrintOpen}
        data={historyPrintSlip}
        autoPrint={historyPrintAutoTrigger}
        onClose={() => {
          setHistoryPrintOpen(false);
          setHistoryPrintSlip(null);
          setHistoryPrintAutoTrigger(false);
        }}
      />
    </div>
  );
}

