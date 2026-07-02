import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Cpu,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Users,
  X
} from 'lucide-react';
import vietNhatLogoUrl from '../../logovietnhat_1.png';
import { formatNumber, parseMoneyInput } from '../utils';
import MixingProductionOrderAutofillModal from './MixingProductionOrderAutofillModal';
import {
  normalizeMixingCatalogProducts,
  normalizeMixingProductionOrders,
  type MixingCatalogProduct,
  type MixingProductionOrder
} from '../utils/mixingOrderAutofill';
import {
  applyMixingRoundAutofill,
  deriveLineUnit,
  getRoundBatchWeightFromLines,
  listRoundMaterialEntries,
  mixingRoundColumnLabel,
  normalizeChiTietLines,
  parseBatchWeightInput,
  removeMaterialFromRound,
  setRoundBatchWeightOnLines,
  upsertMaterialInRound
} from '../lib/mixingReportModel';
import {
  getProductionShiftOptions,
  normalizeShiftSettings,
  type ShiftSetting
} from '../utils/shiftSettings';

const ROUND_KEYS = ['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const;
type RoundKey = (typeof ROUND_KEYS)[number];

export type MixingRoundItem = {
  ma_nvl: string;
  ten_vat_tu: string;
  don_vi: string;
  so_luong: number | null;
  ti_le_phan_tram: number | null;
};

export type MixingRoundPhoto = {
  url: string;
  public_id?: string;
};

export type MixingPhoiTron = {
  so_lan?: number;
  khoi_luong_me?: Partial<Record<RoundKey, number | null>>;
  lan_1?: MixingRoundItem[];
  lan_2?: MixingRoundItem[];
  lan_3?: MixingRoundItem[];
  lan_4?: MixingRoundItem[];
  lan_5?: MixingRoundItem[];
};

export type MixingReportLine = {
  stt: number;
  ma_nvl: string;
  ten_vat_tu: string;
  lan_su_dung: MixingPhoiTron;
  tong_nhua_tron: number | null;
  hinh_anh?: string;
  hinh_anh_public_id?: string;
};

export type MixingReport = {
  id: string;
  ca: string;
  ngay: string;
  gio: string;
  chi_nhanh: string;
  ma_may: string;
  ten_may: string;
  nhan_su: string;
  so_phieu: string;
  ky_hieu: string;
  so_lan: number;
  thuc_te_su_dung: number | null;
  ghi_chu: string;
  hinh_anh_theo_lan?: Partial<Record<RoundKey, MixingRoundPhoto[]>>;
  chi_tiet: MixingReportLine[];
  created_at?: string;
};

interface MachineOption {
  id: string;
  code: string;
  name: string;
  branch: string;
}

interface MaterialOption {
  code: string;
  name: string;
  unit: string;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function extractIsoDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') return '';
  const match = trimmed.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function shiftMatches(orderShift: string, selectedShift: string) {
  if (!orderShift || !selectedShift) return false;
  const left = orderShift.replace(/^ca\s*/i, '').trim().toLowerCase();
  const right = selectedShift.replace(/^ca\s*/i, '').trim().toLowerCase();
  return left === right || left.includes(right) || right.includes(left);
}

function machineMatches(
  orderMachine: string,
  machineCode: string,
  machineName: string,
  machines: MachineOption[]
) {
  const ref = orderMachine.trim();
  if (!ref || ref === '-') return false;

  const candidates = new Set<string>();
  if (machineCode) candidates.add(normalizeKey(machineCode));
  if (machineName) candidates.add(normalizeKey(machineName));
  if (machineCode && machineName) candidates.add(normalizeKey(`${machineCode} · ${machineName}`));

  machines.forEach(machine => {
    candidates.add(normalizeKey(machine.code));
    candidates.add(normalizeKey(machine.name));
  });

  const refKey = normalizeKey(ref);
  return [...candidates].some(key => key && (key === refKey || key.includes(refKey) || refKey.includes(key)));
}

function resolveStaffFromProductionOrders(
  orders: MixingProductionOrder[],
  ngay: string,
  ca: string,
  maMay: string,
  tenMay: string,
  machines: MachineOption[]
) {
  const matched = orders.filter(order => {
    const orderDate = extractIsoDate(order.startDate);
    if (ngay && orderDate && orderDate !== ngay) return false;
    if (ca && !shiftMatches(order.shift, ca)) return false;
    return machineMatches(order.machine, maMay, tenMay, machines);
  });

  const staffValues = matched
    .map(order => order.staff)
    .filter(staff => staff && staff !== '-');

  return [...new Set(staffValues)].join(', ');
}

const inputClass =
  'h-9 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function parseOptionalNumber(value: string) {
  if (!value || !String(value).trim()) return null;
  const num = parseMoneyInput(value);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

function quantityInputText(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return String(value);
}

function formatOptionalNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return formatNumber(value, 2);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function emptyRoundItem(): MixingRoundItem {
  return { ma_nvl: '', ten_vat_tu: '', don_vi: 'kg', so_luong: null, ti_le_phan_tram: null };
}

function normalizeRoundItems(value: unknown): MixingRoundItem[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'number') {
    return [{ ma_nvl: '', ten_vat_tu: '', don_vi: 'kg', so_luong: value, ti_le_phan_tram: null }];
  }
  if (!Array.isArray(value)) {
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return [parseRoundItemRecord(record)];
    }
    return [];
  }
  return value
    .map((item): MixingRoundItem | null => {
      if (!item || typeof item !== 'object') return null;
      return parseRoundItemRecord(item as Record<string, unknown>);
    })
    .filter((item): item is MixingRoundItem => Boolean(item));
}

function parseRoundItemRecord(record: Record<string, unknown>): MixingRoundItem {
  return {
    ma_nvl: String(record.ma_npl ?? record.ma_nvl ?? record.code ?? '').trim(),
    ten_vat_tu: String(record.ten_vat_tu ?? record.ten_npl ?? '').trim(),
    don_vi: String(record.don_vi ?? record.unit ?? 'kg').trim() || 'kg',
    so_luong: parseOptionalNumber(String(record.so_luong ?? record.so_luong_kg ?? '')),
    ti_le_phan_tram: parseOptionalNumber(String(record.ti_le_phan_tram ?? record.phan_tram ?? ''))
  };
}

function deriveLineMaterial(phoiTron: MixingPhoiTron) {
  for (const key of ROUND_KEYS) {
    for (const item of getRoundItems(phoiTron, key)) {
      if (item.ma_nvl.trim() || item.ten_vat_tu.trim()) {
        return { ma_nvl: item.ma_nvl, ten_vat_tu: item.ten_vat_tu };
      }
    }
  }
  return { ma_nvl: '', ten_vat_tu: '' };
}

function hasPhoiTronMaterial(phoiTron: MixingPhoiTron) {
  return ROUND_KEYS.some(key =>
    getRoundItems(phoiTron, key).some(item => item.ma_nvl.trim() || item.ten_vat_tu.trim())
  );
}

function getRoundBatchWeight(phoiTron: MixingPhoiTron, key: RoundKey) {
  const value = phoiTron.khoi_luong_me?.[key];
  return value === null || value === undefined ? null : value;
}

function calcNormQuantityFromPercent(batchWeight: number | null, percent: number | null) {
  if (!batchWeight || batchWeight <= 0 || !percent || percent <= 0) return null;
  return round2((batchWeight * percent) / 100);
}

function applyPercentToRoundItem(item: MixingRoundItem, batchWeight: number | null): MixingRoundItem {
  const kg = calcNormQuantityFromPercent(batchWeight, item.ti_le_phan_tram);
  return kg !== null ? { ...item, so_luong: kg } : item;
}

function recalcRoundItems(phoiTron: MixingPhoiTron, key: RoundKey): MixingPhoiTron {
  const batchWeight = getRoundBatchWeight(phoiTron, key);
  if (!batchWeight) return phoiTron;
  return {
    ...phoiTron,
    [key]: getRoundItems(phoiTron, key).map(item => applyPercentToRoundItem(item, batchWeight))
  };
}

function setRoundBatchWeight(phoiTron: MixingPhoiTron, key: RoundKey, value: string): MixingPhoiTron {
  const parsed = parseOptionalNumber(value);
  const next: MixingPhoiTron = {
    ...phoiTron,
    khoi_luong_me: { ...phoiTron.khoi_luong_me, [key]: parsed }
  };
  return recalcRoundItems(next, key);
}

function normalizePhoiTron(source: unknown): MixingPhoiTron {
  const record = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  const phoiTron: MixingPhoiTron = {};
  ROUND_KEYS.forEach(key => {
    const items = normalizeRoundItems(record[key]);
    if (items.length > 0) phoiTron[key] = items;
  });
  const rawBatch = record.khoi_luong_me;
  if (rawBatch && typeof rawBatch === 'object') {
    const khoi_luong_me: Partial<Record<RoundKey, number | null>> = {};
    ROUND_KEYS.forEach(key => {
      const val = parseOptionalNumber(String((rawBatch as Record<string, unknown>)[key] ?? ''));
      if (val !== null && val > 0) khoi_luong_me[key] = val;
    });
    if (Object.keys(khoi_luong_me).length > 0) phoiTron.khoi_luong_me = khoi_luong_me;
  }
  if (!phoiTron.lan_1) phoiTron.lan_1 = [];
  return phoiTron;
}

function buildEmptyPhoiTron(): MixingPhoiTron {
  return { lan_1: [] };
}

function visibleRoundCount(phoiTron: MixingPhoiTron) {
  for (let index = ROUND_KEYS.length - 1; index >= 0; index -= 1) {
    if (phoiTron[ROUND_KEYS[index]] !== undefined) return index + 1;
  }
  return 1;
}

function addNextRound(phoiTron: MixingPhoiTron): MixingPhoiTron | null {
  const current = visibleRoundCount(phoiTron);
  if (current >= 5) return null;
  const nextKey = ROUND_KEYS[current];
  return { ...phoiTron, [nextKey]: [] };
}

function getRoundItems(phoiTron: MixingPhoiTron, key: RoundKey): MixingRoundItem[] {
  return phoiTron[key] ?? [];
}

function sumRoundQuantity(phoiTron: MixingPhoiTron, key: RoundKey) {
  return round2(getRoundItems(phoiTron, key).reduce((sum, item) => sum + (item.so_luong ?? 0), 0));
}

function sumMixingRounds(phoiTron: MixingPhoiTron) {
  return round2(ROUND_KEYS.reduce((sum, key) => sum + sumRoundQuantity(phoiTron, key), 0));
}

function emptyLine(stt: number): MixingReportLine {
  return {
    stt,
    ma_nvl: '',
    ten_vat_tu: '',
    lan_su_dung: buildEmptyPhoiTron(),
    tong_nhua_tron: null,
    hinh_anh: '',
    hinh_anh_public_id: ''
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

async function uploadMixingLineImage(imageDataUrl: string) {
  const res = await fetch('/api/cloudinary/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, folder: 'bao_cao_phoi_tron' })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Không thể upload ảnh lên Cloudinary.');
  return { imageUrl: data.url as string, imagePublicId: data.publicId as string };
}

const modalInputClass =
  'h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

function newReportForm(): Omit<MixingReport, 'id' | 'created_at'> {
  return {
    ca: '',
    ngay: todayIso(),
    gio: nowTimeValue(),
    chi_nhanh: 'Đà Nẵng',
    ma_may: '',
    ten_may: '',
    nhan_su: '',
    so_phieu: '',
    ky_hieu: 'QT-16-BM02',
    so_lan: 3,
    thuc_te_su_dung: null,
    ghi_chu: '',
    hinh_anh_theo_lan: {},
    chi_tiet: []
  };
}

function roundColumnLabel(roundIndex: number) {
  return mixingRoundColumnLabel(roundIndex);
}

function roundSectionLabel(roundIndex: number, totalRounds: number) {
  if (totalRounds === 1) return 'KL mẻ';
  return `KL mẻ ${roundIndex + 1}`;
}

function MixingRoundItemFormModal({
  open,
  roundLabel,
  draft,
  materials,
  batchWeight,
  isEditing,
  errorMessage,
  onClose,
  onChange,
  onSave
}: {
  open: boolean;
  roundLabel: string;
  draft: MixingRoundItem;
  materials: MaterialOption[];
  batchWeight: number | null;
  isEditing: boolean;
  errorMessage?: string;
  onClose: () => void;
  onChange: (patch: Partial<MixingRoundItem>) => void;
  onSave: (item: MixingRoundItem) => void;
}) {
  const [soLuongText, setSoLuongText] = useState('');
  const [percentText, setPercentText] = useState('');

  useEffect(() => {
    if (open) {
      setPercentText(quantityInputText(draft.ti_le_phan_tram));
      setSoLuongText(quantityInputText(draft.so_luong));
    }
  }, [open, draft.so_luong, draft.ti_le_phan_tram]);

  useEffect(() => {
    if (!open) return;
    const pct = parseOptionalNumber(percentText);
    const kg = calcNormQuantityFromPercent(batchWeight, pct);
    if (kg !== null) setSoLuongText(String(kg));
  }, [open, percentText, batchWeight]);

  const pickMaterial = (code: string) => {
    if (!code) {
      onChange({ ma_nvl: '', ten_vat_tu: '', don_vi: 'kg' });
      return;
    }
    const material = materials.find(item => item.code === code);
    if (!material) return;
    onChange({
      ma_nvl: material.code,
      ten_vat_tu: material.name,
      don_vi: material.unit || 'kg'
    });
  };

  const handleSave = () => {
    const ti_le_phan_tram = parseOptionalNumber(percentText);
    const autoKg = calcNormQuantityFromPercent(batchWeight, ti_le_phan_tram);
    onSave({
      ...draft,
      ti_le_phan_tram,
      so_luong: autoKg ?? parseOptionalNumber(soLuongText)
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
          <div>
            <h4 className="text-base font-black text-zinc-950">
              {isEditing ? 'Sửa vật tư' : 'Thêm vật tư'} · {roundLabel}
            </h4>
            <p className="mt-1 text-sm font-medium text-zinc-500">Nhập mã NVL, % và khối lượng 1 mẻ để tự tính KL</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-4 sm:px-5">
          {errorMessage && (
            <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {errorMessage}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã NVL</span>
              <select
                value={draft.ma_nvl}
                onChange={e => pickMaterial(e.target.value)}
                className={modalInputClass}
              >
                <option value="">Chọn mã NVL...</option>
                {materials.map(material => (
                  <option key={material.code} value={material.code}>
                    {material.code} · {material.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tên vật tư</span>
              <input
                value={draft.ten_vat_tu}
                readOnly={Boolean(draft.ma_nvl)}
                onChange={e => onChange({ ten_vat_tu: e.target.value })}
                className={`${modalInputClass}${draft.ma_nvl ? ' bg-zinc-50 text-zinc-600' : ''}`}
                placeholder={draft.ma_nvl ? '' : 'Tự điền theo mã NVL'}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">ĐVT</span>
              <input
                value={draft.don_vi}
                onChange={e => onChange({ don_vi: e.target.value })}
                className={modalInputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tỷ lệ %</span>
              <input
                value={percentText}
                onChange={e => setPercentText(e.target.value)}
                className={modalInputClass}
                inputMode="decimal"
                placeholder="VD: 60"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Khối lượng (kg)</span>
              <input
                value={soLuongText}
                onChange={e => setSoLuongText(e.target.value)}
                className={`${modalInputClass}${batchWeight && percentText ? ' bg-emerald-50 font-black text-emerald-800' : ''}`}
                inputMode="decimal"
                placeholder={batchWeight ? 'Tự tính theo %' : 'VD: 1500'}
                readOnly={Boolean(batchWeight && parseOptionalNumber(percentText))}
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-4 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-sm font-extrabold text-white transition hover:bg-[#b30d1c]"
          >
            <Save className="h-4 w-4" />
            {isEditing ? 'Cập nhật' : 'Thêm dòng'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MixingLineFormModal({
  open,
  draft,
  materials,
  isEditing,
  errorMessage,
  onClose,
  onChange,
  onSave
}: {
  open: boolean;
  draft: MixingReportLine;
  materials: MaterialOption[];
  isEditing: boolean;
  errorMessage?: string;
  onClose: () => void;
  onChange: (patch: Partial<MixingReportLine>) => void;
  onSave: (patch?: Partial<MixingReportLine>) => void;
}) {
  const [roundItemModalOpen, setRoundItemModalOpen] = useState(false);
  const [roundItemDraft, setRoundItemDraft] = useState<MixingRoundItem>(emptyRoundItem());
  const [roundItemModalError, setRoundItemModalError] = useState('');
  const [editingRoundKey, setEditingRoundKey] = useState<RoundKey | null>(null);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

  const tongTron = sumMixingRounds(draft.lan_su_dung);
  const roundCount = visibleRoundCount(draft.lan_su_dung);
  const activeRounds = ROUND_KEYS.slice(0, roundCount);

  const closeRoundItemModal = () => {
    setRoundItemModalOpen(false);
    setEditingRoundKey(null);
    setEditingRowIndex(null);
    setRoundItemModalError('');
  };

  const openAddRoundItem = (roundKey: RoundKey) => {
    setEditingRoundKey(roundKey);
    setEditingRowIndex(null);
    setRoundItemDraft(emptyRoundItem());
    setRoundItemModalError('');
    setRoundItemModalOpen(true);
  };

  const openEditRoundItem = (roundKey: RoundKey, rowIndex: number) => {
    const item = getRoundItems(draft.lan_su_dung, roundKey)[rowIndex];
    if (!item) return;
    setEditingRoundKey(roundKey);
    setEditingRowIndex(rowIndex);
    setRoundItemDraft({ ...item });
    setRoundItemModalError('');
    setRoundItemModalOpen(true);
  };

  const saveRoundItemDraft = (item: MixingRoundItem) => {
    if (!editingRoundKey) return;
    if (!item.ma_nvl.trim() && !item.ten_vat_tu.trim()) {
      setRoundItemModalError('Vui lòng chọn mã NVL.');
      return;
    }

    const batchWeight = getRoundBatchWeight(draft.lan_su_dung, editingRoundKey);
    const savedItem = applyPercentToRoundItem(item, batchWeight);

    const items = [...getRoundItems(draft.lan_su_dung, editingRoundKey)];
    if (editingRowIndex === null) {
      items.push({ ...savedItem });
    } else {
      items[editingRowIndex] = { ...savedItem };
    }

    const lan_su_dung = { ...draft.lan_su_dung, [editingRoundKey]: items };
    onChange({ lan_su_dung, tong_nhua_tron: sumMixingRounds(lan_su_dung) });
    closeRoundItemModal();
  };

  const removeRoundItem = (roundKey: RoundKey, rowIndex: number) => {
    const items = getRoundItems(draft.lan_su_dung, roundKey).filter((_, index) => index !== rowIndex);
    const lan_su_dung = { ...draft.lan_su_dung, [roundKey]: items };
    onChange({ lan_su_dung, tong_nhua_tron: sumMixingRounds(lan_su_dung) });
  };

  const addNextRoundSection = () => {
    const next = addNextRound(draft.lan_su_dung);
    if (!next) return;
    onChange({ lan_su_dung: next });
  };

  if (!open) return null;

  const editingRoundLabel =
    editingRoundKey !== null
      ? roundSectionLabel(ROUND_KEYS.indexOf(editingRoundKey), roundCount)
      : '';

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
          <div>
            <h3 className="text-lg font-black text-zinc-950">
              {isEditing ? 'Sửa dòng vật tư' : 'Thêm dòng vật tư'}
            </h3>
            <p className="mt-1 text-sm font-medium text-zinc-500">
              Nhập định mức từng lần: mã NVL, %, khối lượng 1 mẻ — hệ thống tự tính KL
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {errorMessage && (
            <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {errorMessage}
            </p>
          )}

          <p className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-500">Phối trộn</p>
          <div className="space-y-4">
            {activeRounds.map((roundKey, roundIndex) => {
              const items = getRoundItems(draft.lan_su_dung, roundKey);
              const batchWeight = getRoundBatchWeight(draft.lan_su_dung, roundKey);
              const batchWeightText =
                batchWeight !== null && batchWeight !== undefined ? String(batchWeight) : '';
              return (
                <div key={roundKey} className="overflow-hidden rounded-xl border border-zinc-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2">
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-700">
                      {roundSectionLabel(roundIndex, roundCount)}
                    </p>
                    <label className="flex items-center gap-2 text-xs font-bold text-zinc-700">
                      KL 1 mẻ (kg)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={batchWeightText}
                        onChange={e => {
                          const lan_su_dung = setRoundBatchWeight(draft.lan_su_dung, roundKey, e.target.value);
                          onChange({ lan_su_dung, tong_nhua_tron: sumMixingRounds(lan_su_dung) });
                        }}
                        className="h-8 w-28 rounded-lg border border-zinc-200 bg-white px-2 text-sm font-black outline-none focus:border-[#ef1b2d]"
                        placeholder="0"
                      />
                    </label>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-[10px] uppercase tracking-wider text-white">
                        <tr>
                          <th className="px-2 py-2 font-black">Mã NVL</th>
                          <th className="px-2 py-2 font-black">%</th>
                          <th className="px-2 py-2 font-black">KL (kg)</th>
                          <th className="px-2 py-2 text-center font-black">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-6 text-center font-semibold text-zinc-400">
                              Chưa có định mức. Bấm &quot;Thêm dòng&quot; để nhập mã NVL và %.
                            </td>
                          </tr>
                        ) : (
                          items.map((item, rowIndex) => (
                          <tr key={`${roundKey}-${rowIndex}`}>
                            <td className="px-2 py-2 font-mono font-semibold text-zinc-700">{item.ma_nvl || '-'}</td>
                            <td className="px-2 py-2 font-mono font-semibold text-zinc-700">
                              {formatOptionalNumber(item.ti_le_phan_tram) || '-'}
                            </td>
                            <td className="px-2 py-2 font-mono font-bold text-emerald-800">
                              {formatOptionalNumber(item.so_luong) || '-'}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditRoundItem(roundKey, rowIndex)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                                  title="Sửa dòng"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeRoundItem(roundKey, rowIndex)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50"
                                  title="Xóa dòng"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )))}
                        <tr>
                          <td colSpan={4} className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => openAddRoundItem(roundKey)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-[#ef1b2d]/40 bg-red-50/50 px-3 text-[11px] font-extrabold text-[#ef1b2d] transition hover:bg-red-50"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Thêm dòng
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {roundCount < 5 && (
              <button
                type="button"
                onClick={addNextRoundSection}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs font-extrabold text-zinc-700 transition hover:border-[#ef1b2d]/40 hover:bg-red-50/40 hover:text-[#ef1b2d]"
              >
                <Plus className="h-4 w-4" />
                Thêm KL mẻ ({roundSectionLabel(roundCount, roundCount + 1)})
              </button>
            )}
          </div>

          <div className="mt-4">
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tổng trộn</span>
              <input
                value={formatOptionalNumber(tongTron)}
                readOnly
                className={`${modalInputClass} bg-emerald-50 font-black text-emerald-700`}
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-4 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onSave()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-sm font-extrabold text-white transition hover:bg-[#b30d1c]"
          >
            <Save className="h-4 w-4" />
            {isEditing ? 'Cập nhật dòng' : 'Thêm vào bảng'}
          </button>
        </div>
      </div>
    </div>

    <MixingRoundItemFormModal
      open={roundItemModalOpen}
      roundLabel={editingRoundLabel}
      draft={roundItemDraft}
      materials={materials}
      batchWeight={editingRoundKey ? getRoundBatchWeight(draft.lan_su_dung, editingRoundKey) : null}
      isEditing={editingRowIndex !== null}
      errorMessage={roundItemModalError}
      onClose={closeRoundItemModal}
      onChange={patch => {
        setRoundItemModalError('');
        setRoundItemDraft(prev => ({ ...prev, ...patch }));
      }}
      onSave={saveRoundItemDraft}
    />
    </>
  );
}

export default function MixingReportForm({
  onBack,
  onOpenList,
  modalMode = false,
  open = true,
  onClose,
  onSaved,
  initialMachine,
  onInitialMachineConsumed
}: {
  onBack?: () => void;
  onOpenList?: () => void;
  modalMode?: boolean;
  open?: boolean;
  onClose?: () => void;
  onSaved?: () => void | Promise<void>;
  initialMachine?: { id: string; code: string; name: string } | null;
  onInitialMachineConsumed?: () => void;
}) {
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [productionOrders, setProductionOrders] = useState<MixingProductionOrder[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<MixingCatalogProduct[]>([]);
  const [shiftSettings, setShiftSettings] = useState<ShiftSetting[]>([]);
  const [activeRoundCount, setActiveRoundCount] = useState(0);
  const [roundBatchWeightDrafts, setRoundBatchWeightDrafts] = useState<Partial<Record<RoundKey, string>>>({});
  const [productionAutofillRoundKey, setProductionAutofillRoundKey] = useState<RoundKey | null>(null);
  const [roundItemModal, setRoundItemModal] = useState<{
    roundKey: RoundKey;
    edit?: { lineIndex: number; itemIndex: number };
    draft: MixingRoundItem;
    error: string;
  } | null>(null);
  const [form, setForm] = useState(newReportForm());
  const [nhanSuManual, setNhanSuManual] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [lineDraft, setLineDraft] = useState<MixingReportLine>(emptyLine(1));
  const [lineModalError, setLineModalError] = useState('');
  const [uploadingRoundKey, setUploadingRoundKey] = useState<RoundKey | null>(null);

  const loadReferenceData = async () => {
    const [machineRes, materialRes, productionRes, productRes, settingRes] = await Promise.all([
      fetch('/api/danh-sach-may'),
      fetch('/api/kho-nvl'),
      fetch('/api/lenh-sx'),
      fetch('/api/san-pham?format=table'),
      fetch('/api/cai-dat')
    ]);
    const machineData = await machineRes.json().catch(() => ({}));
    const materialData = await materialRes.json().catch(() => ({}));
    const productionData = await productionRes.json().catch(() => ({}));
    const productData = await productRes.json().catch(() => ({}));
    const settingData = await settingRes.json().catch(() => ({}));
    if (!machineRes.ok) throw new Error(machineData.error || 'Không thể tải danh sách máy.');
    if (!materialRes.ok) throw new Error(materialData.error || 'Không thể tải kho NVL.');
    if (!productionRes.ok) throw new Error(productionData.error || 'Không thể tải lệnh sản xuất.');

    const machineRows = Array.isArray(machineData.machines) ? machineData.machines : [];
    setMachines(
      machineRows.map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ''),
        code: String(row.ma_may ?? row.code ?? '').trim(),
        name: String(row.ten_may ?? row.name ?? '').trim(),
        branch: String(row.chi_nhanh ?? row.branch ?? '').trim()
      }))
    );

    const materialRows = Array.isArray(materialData.materials) ? materialData.materials : [];
    setMaterials(
      materialRows
        .map((row: Record<string, unknown>) => ({
          code: String(row.ma_npl ?? '').trim(),
          name: String(row.ten_npl ?? '').trim(),
          unit: String(row.don_vi ?? 'kg').trim() || 'kg'
        }))
        .filter(item => item.code || item.name)
    );

    setProductionOrders(normalizeMixingProductionOrders(productionData));
    if (productRes.ok) setCatalogProducts(normalizeMixingCatalogProducts(productData));
    if (settingRes.ok) setShiftSettings(normalizeShiftSettings(settingData));
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError('');
      try {
        await loadReferenceData();
        if (cancelled) return;
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Không thể tải dữ liệu.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const shiftOptions = useMemo(() => getProductionShiftOptions(shiftSettings), [shiftSettings]);

  useEffect(() => {
    if (nhanSuManual || !form.ca.trim()) return;
    if (!form.ma_may.trim() && !form.ten_may.trim()) return;

    const staff = resolveStaffFromProductionOrders(
      productionOrders,
      form.ngay,
      form.ca,
      form.ma_may,
      form.ten_may,
      machines
    );
    if (!staff) return;

    setForm(prev => (prev.nhan_su === staff ? prev : { ...prev, nhan_su: staff }));
  }, [form.ca, form.ma_may, form.ten_may, form.ngay, productionOrders, machines, nhanSuManual]);

  const computedLines = useMemo(
    () =>
      form.chi_tiet.map(line => ({
        ...line,
        tong_nhua_tron: sumMixingRounds(line.lan_su_dung)
      })),
    [form.chi_tiet]
  );

  const expandedLineCount = useMemo(
    () => normalizeChiTietLines(form.chi_tiet).length,
    [form.chi_tiet]
  );

  useEffect(() => {
    if (expandedLineCount === form.chi_tiet.length) return;
    setForm(prev => ({
      ...prev,
      chi_tiet: normalizeChiTietLines(prev.chi_tiet)
    }));
  }, [expandedLineCount, form.chi_tiet.length]);

  const computedActualUsage = useMemo(
    () => round2(computedLines.reduce((sum, line) => sum + (line.tong_nhua_tron ?? 0), 0)),
    [computedLines]
  );

  const pickMachine = (machineId: string) => {
    const machine = machines.find(item => item.id === machineId);
    if (!machine) return;
    setNhanSuManual(false);
    setForm(prev => ({
      ...prev,
      ma_may: machine.code,
      ten_may: machine.name,
      chi_nhanh: machine.branch || prev.chi_nhanh
    }));
  };

  useEffect(() => {
    if (!initialMachine || machines.length === 0) return;
    const machine =
      machines.find(item => item.id === initialMachine.id) ??
      machines.find(item => item.code === initialMachine.code) ??
      machines.find(item => item.name === initialMachine.name);
    if (!machine) return;
    pickMachine(machine.id);
    onInitialMachineConsumed?.();
  }, [initialMachine, machines, onInitialMachineConsumed]);

  const pickShift = (ca: string) => {
    setNhanSuManual(false);
    setForm(prev => ({ ...prev, ca }));
  };

  const handleDateChange = (ngay: string) => {
    setNhanSuManual(false);
    setForm(prev => ({
      ...prev,
      ngay,
      nhan_su: ''
    }));
  };

  const displayedRoundCount = useMemo(() => {
    const fromLines = computedLines.reduce(
      (max, line) => Math.max(max, visibleRoundCount(line.lan_su_dung)),
      0
    );
    return Math.min(5, Math.max(activeRoundCount, fromLines));
  }, [activeRoundCount, computedLines]);

  useEffect(() => {
    const fromLines = form.chi_tiet.reduce(
      (max, line) => Math.max(max, visibleRoundCount(line.lan_su_dung)),
      0
    );
    if (fromLines > activeRoundCount) {
      setActiveRoundCount(fromLines);
    }
  }, [form.chi_tiet, activeRoundCount]);

  const addRound = () => {
    if (activeRoundCount >= 5) return;
    const next = activeRoundCount + 1;
    setActiveRoundCount(next);
    setForm(prev => ({ ...prev, so_lan: Math.max(prev.so_lan, next) }));
  };

  const resolveRoundBatchWeight = (
    chi_tiet: MixingReportLine[],
    roundKey: RoundKey,
    drafts: Partial<Record<RoundKey, string>> = roundBatchWeightDrafts
  ) => {
    const fromLines = getRoundBatchWeightFromLines(chi_tiet, roundKey);
    if (fromLines !== null) return fromLines;
    const draft = drafts[roundKey];
    if (draft !== undefined && draft.trim()) {
      return parseBatchWeightInput(draft);
    }
    return null;
  };

  const getRoundBatchWeightInputValue = (roundKey: RoundKey) => {
    if (roundBatchWeightDrafts[roundKey] !== undefined) {
      return roundBatchWeightDrafts[roundKey] ?? '';
    }
    const fromLines = getRoundBatchWeightFromLines(form.chi_tiet, roundKey);
    return fromLines !== null ? String(fromLines) : '';
  };

  const handleRoundBatchWeightChange = (roundKey: RoundKey, value: string) => {
    setRoundBatchWeightDrafts(prev => ({ ...prev, [roundKey]: value }));
    setForm(prev => ({
      ...prev,
      chi_tiet:
        prev.chi_tiet.length > 0
          ? setRoundBatchWeightOnLines(prev.chi_tiet, roundKey, value)
          : prev.chi_tiet
    }));
  };

  const openProductionOrderAutofill = (roundKey: RoundKey) => {
    setMessage('');
    if (!form.ma_may.trim() && !form.ten_may.trim()) {
      setError('Vui lòng chọn máy ở phần thông tin phía trên trước khi lấy NVL theo Lệnh sản xuất.');
      return;
    }
    setError('');
    setProductionAutofillRoundKey(roundKey);
  };

  const openRoundMaterialModal = (roundKey: RoundKey, edit?: { lineIndex: number; itemIndex: number }) => {
    const existing =
      edit &&
      form.chi_tiet[edit.lineIndex] &&
      getRoundItems(form.chi_tiet[edit.lineIndex].lan_su_dung, roundKey)[edit.itemIndex];
    setRoundItemModal({
      roundKey,
      edit,
      draft: existing ? { ...existing } : emptyRoundItem(),
      error: ''
    });
  };

  const saveRoundMaterialModal = (item: MixingRoundItem) => {
    if (!roundItemModal) return;
    if (!item.ma_nvl.trim() && !item.ten_vat_tu.trim()) {
      setRoundItemModal(prev => (prev ? { ...prev, error: 'Vui lòng chọn mã NVL.' } : prev));
      return;
    }
    setForm(prev => ({
      ...prev,
      chi_tiet: upsertMaterialInRound(
        prev.chi_tiet,
        roundItemModal.roundKey,
        item,
        roundItemModal.edit,
        resolveRoundBatchWeight(prev.chi_tiet, roundItemModal.roundKey)
      )
    }));
    setRoundItemModal(null);
  };

  const applyProductionOrderAutofill = (items: MixingRoundItem[]) => {
    if (!productionAutofillRoundKey) return;
    if (items.length === 0) {
      setError(
        'Sản phẩm đã chọn chưa có định mức NPL (% phối trộn). Vui lòng khai báo định mức trong danh mục sản phẩm trước.'
      );
      setProductionAutofillRoundKey(null);
      return;
    }
    const roundKey = productionAutofillRoundKey;
    setForm(prev => ({
      ...prev,
      chi_tiet: applyMixingRoundAutofill(
        prev.chi_tiet,
        roundKey,
        items,
        resolveRoundBatchWeight(prev.chi_tiet, roundKey)
      )
    }));
    setMessage(`Đã điền ${items.length} NVL vào ${roundColumnLabel(ROUND_KEYS.indexOf(roundKey))}.`);
    setError('');
    setProductionAutofillRoundKey(null);
  };

  const openEditLineModal = (index: number) => {
    const line = computedLines[index];
    if (!line) return;
    setEditingLineIndex(index);
    setLineDraft({
      ...line,
      lan_su_dung: normalizePhoiTron(line.lan_su_dung),
      tong_nhua_tron: sumMixingRounds(line.lan_su_dung)
    });
    setLineModalError('');
    setLineModalOpen(true);
  };

  const closeLineModal = () => {
    setLineModalOpen(false);
    setEditingLineIndex(null);
    setLineModalError('');
  };

  const saveLineDraft = (patch?: Partial<MixingReportLine>) => {
    const current = { ...lineDraft, ...patch };
    if (!hasPhoiTronMaterial(current.lan_su_dung)) {
      setLineModalError('Vui lòng chọn mã NVL trong bảng phối trộn.');
      return;
    }

    const { ma_nvl, ten_vat_tu } = deriveLineMaterial(current.lan_su_dung);
    const savedLine: MixingReportLine = {
      ...current,
      ma_nvl,
      ten_vat_tu,
      tong_nhua_tron: sumMixingRounds(current.lan_su_dung)
    };
    const normalizedLines = normalizeChiTietLines(
      editingLineIndex === null
        ? [...form.chi_tiet, savedLine]
        : form.chi_tiet.map((line, index) => (index === editingLineIndex ? savedLine : line))
    );
    const nextSoLan = Math.max(
      form.so_lan || 1,
      visibleRoundCount(savedLine.lan_su_dung),
      ...normalizedLines.map(line => visibleRoundCount(line.lan_su_dung))
    );

    setForm(prev => ({
      ...prev,
      so_lan: Math.min(5, nextSoLan),
      chi_tiet: normalizedLines
    }));

    closeLineModal();
  };

  const removeLine = (index: number) => {
    setForm(prev => ({
      ...prev,
      chi_tiet: prev.chi_tiet
        .filter((_, lineIndex) => lineIndex !== index)
        .map((line, lineIndex) => ({ ...line, stt: lineIndex + 1 }))
    }));
  };

  const getRoundPhotos = (roundKey: RoundKey) => form.hinh_anh_theo_lan?.[roundKey] ?? [];

  const removeRoundPhoto = (roundKey: RoundKey, photoIndex: number) => {
    setForm(prev => ({
      ...prev,
      hinh_anh_theo_lan: {
        ...prev.hinh_anh_theo_lan,
        [roundKey]: (prev.hinh_anh_theo_lan?.[roundKey] ?? []).filter((_, index) => index !== photoIndex)
      }
    }));
  };

  const processRoundPhotoFiles = async (files: FileList | File[], roundKey: RoundKey) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setUploadingRoundKey(roundKey);
    setError('');
    try {
      const uploadedPhotos: MixingRoundPhoto[] = [];
      let usedLocalFallback = false;
      for (const file of fileList) {
        const dataUrl = await fileToDataUrl(file);
        try {
          const uploaded = await uploadMixingLineImage(dataUrl);
          if (!uploaded.imageUrl) {
            throw new Error('Upload ảnh không trả về URL.');
          }
          uploadedPhotos.push({ url: uploaded.imageUrl, public_id: uploaded.imagePublicId });
        } catch {
          uploadedPhotos.push({ url: dataUrl });
          usedLocalFallback = true;
        }
      }
      setForm(prev => ({
        ...prev,
        hinh_anh_theo_lan: {
          ...prev.hinh_anh_theo_lan,
          [roundKey]: [...(prev.hinh_anh_theo_lan?.[roundKey] ?? []), ...uploadedPhotos]
        }
      }));
      setMessage(
        usedLocalFallback
          ? `Đã thêm ${uploadedPhotos.length} ảnh vào ${roundColumnLabel(ROUND_KEYS.indexOf(roundKey))} (lưu tạm trên máy — Cloudinary chưa sẵn sàng).`
          : `Đã thêm ${uploadedPhotos.length} ảnh vào ${roundColumnLabel(ROUND_KEYS.indexOf(roundKey))}.`
      );
    } catch (err: any) {
      setError(err.message || 'Không thể đọc file ảnh.');
    } finally {
      setUploadingRoundKey(null);
    }
  };

  const handleRoundPhotoFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
    roundKey: RoundKey
  ) => {
    const files = event.target.files;
    event.target.value = '';
    if (!files?.length) return;
    await processRoundPhotoFiles(files, roundKey);
  };

  const pickRoundPhotos = (roundKey: RoundKey) => {
    if (uploadingRoundKey === roundKey) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.addEventListener(
      'change',
      () => {
        const files = input.files;
        if (files?.length) {
          void processRoundPhotoFiles(files, roundKey);
        }
        input.remove();
      },
      { once: true }
    );
    input.click();
  };

  const resetForm = () => {
    setNhanSuManual(false);
    setActiveRoundCount(0);
    setRoundBatchWeightDrafts({});
    setForm(newReportForm());
    setMessage('');
    setError('');
  };

  const handleSave = async () => {
    if (!form.ca.trim()) {
      setError('Vui lòng chọn ca từ lệnh sản xuất.');
      return;
    }
    if (!form.ngay.trim()) {
      setError('Vui lòng chọn ngày.');
      return;
    }
    if (!form.ma_may.trim() && !form.ten_may.trim()) {
      setError('Vui lòng chọn máy.');
      return;
    }

    const payload = {
      ...form,
      so_lan: displayedRoundCount || 1,
      thuc_te_su_dung: computedActualUsage,
      chi_tiet: normalizeChiTietLines(
        computedLines.filter(line => line.ma_nvl.trim() || line.ten_vat_tu.trim())
      )
    };

    if (payload.chi_tiet.length === 0) {
      setError('Vui lòng thêm ít nhất một lần trộn và nhập NVL.');
      return;
    }

    const missingPhotoRound = ROUND_KEYS.slice(0, displayedRoundCount).find((roundKey, roundIndex) => {
      const hasNvl = listRoundMaterialEntries(form.chi_tiet, roundKey).length > 0;
      const hasPhoto = (form.hinh_anh_theo_lan?.[roundKey]?.length ?? 0) > 0;
      return hasNvl && !hasPhoto;
    });
    if (missingPhotoRound) {
      const roundIndex = ROUND_KEYS.indexOf(missingPhotoRound);
      setError(`Vui lòng chụp ít nhất một ảnh cho ${roundColumnLabel(roundIndex)}.`);
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/bao-cao-phoi-tron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu báo cáo phối trộn.');

      resetForm();
      if (modalMode) {
        await onSaved?.();
        onClose?.();
      } else {
        setMessage('Đã lưu báo cáo phối trộn.');
      }
    } catch (err: any) {
      setError(err.message || 'Không thể lưu báo cáo phối trộn.');
    } finally {
      setIsSaving(false);
    }
  };

  if (modalMode && !open) return null;

  const headerFields = (
    <div
      className={`grid grid-cols-2 gap-3 bg-zinc-50 p-4 md:grid-cols-4 lg:grid-cols-8${modalMode ? '' : ' border-t border-zinc-100'}`}
    >
      <label className="space-y-1">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
          <CalendarDays className="h-3.5 w-3.5 text-[#ef1b2d]" /> Ngày
        </span>
        <input type="date" value={form.ngay} onChange={e => handleDateChange(e.target.value)} className={inputClass} />
      </label>
      <label className="space-y-1">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
          <Clock3 className="h-3.5 w-3.5 text-[#ef1b2d]" /> Giờ
        </span>
        <input type="time" value={form.gio} onChange={e => setForm(prev => ({ ...prev, gio: e.target.value }))} className={inputClass} />
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Ca sản xuất</span>
        <select value={form.ca} onChange={e => pickShift(e.target.value)} className={inputClass}>
          <option value="">Chọn ca sản xuất...</option>
          {shiftOptions.map(shift => (
            <option key={shift.value} value={shift.value}>
              {shift.label}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Chi nhánh</span>
        <input value={form.chi_nhanh} onChange={e => setForm(prev => ({ ...prev, chi_nhanh: e.target.value }))} className={inputClass} />
      </label>
      <label className="space-y-1 lg:col-span-2">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
          <Cpu className="h-3.5 w-3.5 text-[#ef1b2d]" /> Máy
        </span>
        <select
          value={machines.find(machine => machine.code === form.ma_may)?.id ?? ''}
          onChange={e => pickMachine(e.target.value)}
          className={inputClass}
        >
          <option value="">Chọn máy...</option>
          {machines.map(machine => (
            <option key={machine.id} value={machine.id}>
              {machine.code} · {machine.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 lg:col-span-2">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
          <Users className="h-3.5 w-3.5 text-[#ef1b2d]" /> Nhân sự
        </span>
        <input
          value={form.nhan_su}
          onChange={e => {
            setNhanSuManual(true);
            setForm(prev => ({ ...prev, nhan_su: e.target.value }));
          }}
          className={inputClass}
          placeholder="Tự điền theo Ca + Máy từ lệnh SX"
        />
      </label>
    </div>
  );

  const formBody = (
    <>
      {!modalMode && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b-4 border-[#ef1b2d] bg-white p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <img src={vietNhatLogoUrl} alt="Viet Nhat IPT" className="h-14 w-auto max-w-[190px] object-contain" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-[#ef1b2d]">Bảng trộn vật tư</p>
                  <h2 className="text-lg font-black uppercase tracking-tight text-zinc-950">
                    Báo cáo phối trộn
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-zinc-500">
                    Nhật ký sản xuất kiêm phiếu giao ca · QT-16-BM02
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onOpenList && (
                  <button
                    type="button"
                    onClick={onOpenList}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Danh sách
                  </button>
                )}
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Quay lại
                  </button>
                )}
              </div>
            </div>
          </div>
          {headerFields}
        </section>
      )}

      {modalMode && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {headerFields}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}
      {message && !modalMode && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
          <div>
            <p className="text-sm font-black text-zinc-950">Bảng trộn vật tư</p>
            <p className="text-xs font-semibold text-zinc-500">
              Bấm Thêm dòng để tạo Lần 1, Lần 2... · trong mỗi lần chọn NVL theo Lệnh sản xuất
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addRound}
              disabled={activeRoundCount >= 5}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Thêm dòng
            </button>
          </div>
        </div>

        {displayedRoundCount > 0 ? (
          <div className="flex flex-col lg:flex-row lg:items-start">
            <div className="relative z-10 min-w-0 flex-1 space-y-3 border-b border-zinc-100 p-4 lg:border-b-0">
            {ROUND_KEYS.slice(0, displayedRoundCount).map((roundKey, roundIndex) => {
              const entries = listRoundMaterialEntries(form.chi_tiet, roundKey);
              return (
                <div key={roundKey} className="relative rounded-xl border border-zinc-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2">
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-700">
                      {roundColumnLabel(roundIndex)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-zinc-700">
                        KL 1 mẻ (kg)
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getRoundBatchWeightInputValue(roundKey)}
                          onChange={event => handleRoundBatchWeightChange(roundKey, event.target.value)}
                          className="h-8 w-28 rounded-lg border border-zinc-200 bg-white px-2 text-sm font-black outline-none focus:border-[#ef1b2d]"
                          placeholder="0"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => openProductionOrderAutofill(roundKey)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-extrabold text-emerald-800 transition hover:bg-emerald-100"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        NVL theo Lệnh sản xuất
                      </button>
                      <button
                        type="button"
                        onClick={() => openRoundMaterialModal(roundKey)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-[#ef1b2d]/40 bg-red-50/50 px-3 text-[11px] font-extrabold text-[#ef1b2d] transition hover:bg-red-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Thêm NVL
                      </button>
                    </div>
                  </div>
                  {entries.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs font-semibold text-zinc-400">
                      Chưa có NVL trong {roundColumnLabel(roundIndex).toLowerCase()}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-zinc-950 text-[10px] uppercase tracking-wider text-white">
                          <tr>
                            <th className="px-2 py-2 font-black">Mã NVL</th>
                            <th className="px-2 py-2 font-black">Tên vật tư</th>
                            <th className="px-2 py-2 font-black">%</th>
                            <th className="px-2 py-2 font-black">KL (kg)</th>
                            <th className="px-2 py-2 text-center font-black">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {entries.map(entry => (
                            <tr key={`${roundKey}-${entry.lineIndex}-${entry.itemIndex}`}>
                              <td className="px-2 py-2 font-mono font-semibold text-zinc-700">
                                {entry.item.ma_nvl || '-'}
                              </td>
                              <td className="px-2 py-2 text-zinc-800">{entry.item.ten_vat_tu || '-'}</td>
                              <td className="px-2 py-2 font-mono font-semibold text-zinc-700">
                                {formatOptionalNumber(entry.item.ti_le_phan_tram) || '-'}
                              </td>
                              <td className="px-2 py-2 font-mono font-bold text-emerald-800">
                                {formatOptionalNumber(entry.item.so_luong) || '-'}
                              </td>
                              <td className="px-2 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openRoundMaterialModal(roundKey, {
                                        lineIndex: entry.lineIndex,
                                        itemIndex: entry.itemIndex
                                      })
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                                    title="Sửa NVL"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setForm(prev => ({
                                        ...prev,
                                        chi_tiet: removeMaterialFromRound(
                                          prev.chi_tiet,
                                          roundKey,
                                          entry.lineIndex,
                                          entry.itemIndex
                                        )
                                      }))
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50"
                                    title="Xóa NVL"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="relative z-20 border-t border-zinc-100 bg-zinc-50/50 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                      Ảnh xác nhận {roundColumnLabel(roundIndex).toLowerCase()}
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={uploadingRoundKey === roundKey}
                        onChange={event => handleRoundPhotoFile(event, roundKey)}
                        className="min-w-0 flex-1 rounded-lg border border-dashed border-[#ef1b2d]/35 bg-white px-2 py-2 text-[11px] font-semibold text-zinc-600 file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#ef1b2d] file:px-3 file:py-1.5 file:text-[10px] file:font-extrabold file:text-white hover:bg-red-50/40 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => pickRoundPhotos(roundKey)}
                        disabled={uploadingRoundKey === roundKey}
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#ef1b2d]/30 bg-red-50 px-3 text-[11px] font-extrabold text-[#ef1b2d] transition hover:bg-red-100 disabled:opacity-60"
                      >
                        {uploadingRoundKey === roundKey ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="h-3.5 w-3.5" />
                        )}
                        Thêm ảnh
                      </button>
                    </div>
                    {getRoundPhotos(roundKey).length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {getRoundPhotos(roundKey).map((photo, photoIndex) => (
                          <div
                            key={`${roundKey}-photo-${photoIndex}`}
                            className="group relative h-14 w-14 overflow-hidden rounded-lg border border-zinc-200 bg-white"
                          >
                            <a href={photo.url} target="_blank" rel="noreferrer" title="Xem ảnh">
                              <img src={photo.url} alt={`Ảnh ${roundIndex + 1}`} className="h-full w-full object-cover" />
                            </a>
                            <button
                              type="button"
                              onClick={() => removeRoundPhoto(roundKey, photoIndex)}
                              className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-950/75 text-white opacity-0 transition group-hover:opacity-100"
                              title="Xóa ảnh"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[11px] font-semibold text-zinc-400">
                        Chọn file bằng ô &quot;Chọn tệp&quot; hoặc bấm Thêm ảnh · có thể chọn nhiều ảnh.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            </div>

            {computedLines.length > 0 ? (
              <aside className="w-full shrink-0 border-t border-zinc-200 bg-zinc-50/60 lg:w-[min(100%,420px)] lg:border-l lg:border-t-0">
                <div className="border-b border-zinc-200 bg-white px-3 py-2.5">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-800">Bảng tổng</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-zinc-500">
                    Tổng hợp theo NVL
                  </p>
                </div>
                <div className="max-h-[min(60vh,520px)] overflow-auto overscroll-contain">
                  <table className="w-full min-w-[320px] text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-zinc-950 text-[10px] uppercase tracking-wider text-white">
                      <tr>
                        <th className="px-2 py-2 font-black">Mã NVL</th>
                        <th className="px-2 py-2 font-black">Tên vật tư</th>
                        {ROUND_KEYS.slice(0, displayedRoundCount).map((_, roundIndex) => (
                          <th
                            key={`summary-head-lan-${roundIndex}`}
                            className="min-w-[72px] whitespace-nowrap px-2 py-2 text-right font-black"
                          >
                            L{roundIndex + 1}
                          </th>
                        ))}
                        <th className="min-w-[72px] whitespace-nowrap px-2 py-2 text-right font-black">Tổng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/80 bg-white">
                      {computedLines.map((line, index) => (
                        <tr key={`mix-summary-${line.ma_nvl}-${index}`} className="align-top hover:bg-red-50/20">
                          <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] font-semibold text-zinc-700">
                            {line.ma_nvl || '-'}
                          </td>
                          <td className="max-w-[120px] truncate px-2 py-2 text-[11px] text-zinc-800" title={line.ten_vat_tu}>
                            {line.ten_vat_tu || '-'}
                          </td>
                          {ROUND_KEYS.slice(0, displayedRoundCount).map(roundKey => (
                            <td
                              key={roundKey}
                              className="whitespace-nowrap px-2 py-2 text-right font-mono text-[11px] text-zinc-700"
                            >
                              {formatOptionalNumber(sumRoundQuantity(line.lan_su_dung, roundKey)) || '-'}
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-[11px] font-black text-[#ef1b2d]">
                            {formatOptionalNumber(line.tong_nhua_tron) || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 border-t border-zinc-200 bg-white p-3">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-700">
                    Thực tế sử dụng:{' '}
                    <span className="font-black text-[#ef1b2d]">{formatNumber(computedActualUsage, 2)} kg</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700"
                    >
                      Làm mới
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:opacity-60"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Lưu báo cáo
                    </button>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        ) : null}

        {computedLines.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="text-sm font-bold text-zinc-500">
              Thực tế sử dụng: <span className="font-black text-zinc-400">0 kg</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700"
              >
                Làm mới
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu báo cáo
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <MixingLineFormModal
        open={lineModalOpen}
        draft={lineDraft}
        materials={materials}
        isEditing={editingLineIndex !== null}
        errorMessage={lineModalError}
        onClose={closeLineModal}
        onChange={patch => {
          setLineModalError('');
          setLineDraft(prev => ({ ...prev, ...patch }));
        }}
        onSave={saveLineDraft}
      />

      <MixingRoundItemFormModal
        open={Boolean(roundItemModal)}
        roundLabel={
          roundItemModal ? roundColumnLabel(ROUND_KEYS.indexOf(roundItemModal.roundKey)) : ''
        }
        draft={roundItemModal?.draft ?? emptyRoundItem()}
        materials={materials}
        batchWeight={
          roundItemModal ? resolveRoundBatchWeight(form.chi_tiet, roundItemModal.roundKey) : null
        }
        isEditing={Boolean(roundItemModal?.edit)}
        errorMessage={roundItemModal?.error}
        onClose={() => setRoundItemModal(null)}
        onChange={patch => {
          setRoundItemModal(prev =>
            prev ? { ...prev, error: '', draft: { ...prev.draft, ...patch } } : prev
          );
        }}
        onSave={saveRoundMaterialModal}
      />

      {typeof document !== 'undefined' &&
        createPortal(
          <MixingProductionOrderAutofillModal
            open={productionAutofillRoundKey !== null}
            roundLabel={
              productionAutofillRoundKey
                ? roundColumnLabel(ROUND_KEYS.indexOf(productionAutofillRoundKey))
                : ''
            }
            orders={productionOrders}
            catalogProducts={catalogProducts}
            materials={materials}
            filters={{
              ngay: form.ngay,
              ca: form.ca,
              maMay: form.ma_may,
              tenMay: form.ten_may
            }}
            onClose={() => setProductionAutofillRoundKey(null)}
            onApply={applyProductionOrderAutofill}
          />,
          document.body
        )}
    </>
  );

  if (modalMode) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-zinc-100 shadow-2xl sm:rounded-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:px-5">
            <div>
              <h3 className="text-lg font-black text-zinc-950">Thêm báo cáo phối trộn</h3>
              <p className="mt-1 text-sm font-medium text-zinc-500">
                Nhật ký sản xuất kiêm phiếu giao ca · QT-16-BM02
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">{formBody}</div>
        </div>
      </div>
    );
  }

  return <div className="space-y-4 pb-24">{formBody}</div>;
}
