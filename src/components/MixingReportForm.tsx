import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Clock3,
  Cpu,
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

export type MixingRoundItem = {
  ma_nvl: string;
  ten_vat_tu: string;
  don_vi: string;
  so_luong: number | null;
  ti_le_phan_tram: number | null;
};

export type MixingPhoiTron = {
  so_lan?: number;
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
  ton_cuoi_ca: number | null;
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
  chi_tiet: MixingReportLine[];
  created_at?: string;
};

const ROUND_KEYS = ['lan_1', 'lan_2', 'lan_3', 'lan_4', 'lan_5'] as const;
type RoundKey = (typeof ROUND_KEYS)[number];

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

interface ProductionOrderOption {
  shift: string;
  staff: string;
  machine: string;
  startDate: string;
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

function normalizeProductionOrders(data: unknown): ProductionOrderOption[] {
  if (!data || typeof data !== 'object') return [];
  const rows = (data as { productionOrders?: unknown }).productionOrders;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((item): ProductionOrderOption | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const shift = String(record.ca ?? record.shift ?? '').trim();
      const staff = String(record.nhan_su ?? record.cong_nhan ?? record.staff ?? '').trim();
      const machine = String(record.may ?? record.ma_may ?? record.ten_may ?? record.machine ?? '').trim();
      const startDate = extractIsoDate(
        String(record.ngay_gio_bat_dau ?? record.ngay_bat_dau ?? record.ngay_san_xuat ?? record.start_date ?? '')
      );
      if (!shift && !staff && !machine && !startDate) return null;
      return { shift, staff, machine, startDate };
    })
    .filter((row): row is ProductionOrderOption => Boolean(row));
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

  const linked = machines.find(
    machine =>
      machine.code === machineCode ||
      machine.name === machineName ||
      machine.code === ref ||
      machine.name === ref
  );
  if (linked) {
    candidates.add(normalizeKey(linked.code));
    candidates.add(normalizeKey(linked.name));
  }

  const refKey = normalizeKey(ref);
  return [...candidates].some(key => key && (key === refKey || key.includes(refKey) || refKey.includes(key)));
}

function resolveStaffFromOrders(
  orders: ProductionOrderOption[],
  ngay: string,
  ca: string,
  maMay: string,
  tenMay: string,
  machines: MachineOption[]
) {
  const matched = orders.filter(order => {
    if (order.startDate && order.startDate !== ngay) return false;
    if (!shiftMatches(order.shift, ca)) return false;
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

function normalizePhoiTron(source: unknown): MixingPhoiTron {
  const record = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  const phoiTron: MixingPhoiTron = {};
  ROUND_KEYS.forEach(key => {
    const items = normalizeRoundItems(record[key]);
    if (items.length > 0) phoiTron[key] = items;
  });
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
    ton_cuoi_ca: null
  };
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
    chi_tiet: []
  };
}

function MixingRoundItemFormModal({
  open,
  roundLabel,
  draft,
  materials,
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
  isEditing: boolean;
  errorMessage?: string;
  onClose: () => void;
  onChange: (patch: Partial<MixingRoundItem>) => void;
  onSave: (item: MixingRoundItem) => void;
}) {
  const [soLuongText, setSoLuongText] = useState('');

  useEffect(() => {
    if (open) {
      setSoLuongText(quantityInputText(draft.so_luong));
    }
  }, [open, draft.so_luong]);

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
    onSave({
      ...draft,
      so_luong: parseOptionalNumber(soLuongText)
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
            <p className="mt-1 text-sm font-medium text-zinc-500">Nhập thông tin phối trộn</p>
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
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Số lượng</span>
              <input
                value={soLuongText}
                onChange={e => setSoLuongText(e.target.value)}
                className={modalInputClass}
                inputMode="decimal"
                placeholder="VD: 1500 hoặc 1.500"
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
  const [tonCuoiCaText, setTonCuoiCaText] = useState('');

  useEffect(() => {
    if (open) {
      setTonCuoiCaText(quantityInputText(draft.ton_cuoi_ca));
    }
  }, [open, draft.ton_cuoi_ca]);

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

    const items = [...getRoundItems(draft.lan_su_dung, editingRoundKey)];
    if (editingRowIndex === null) {
      items.push({ ...item });
    } else {
      items[editingRowIndex] = { ...item };
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
      ? `Lần ${ROUND_KEYS.indexOf(editingRoundKey) + 1}`
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
              Bấm <span className="font-bold">+ Thêm dòng</span> để mở form nhập vật tư từng lần
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
              return (
                <div key={roundKey} className="overflow-hidden rounded-xl border border-zinc-200">
                  <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-2">
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-700">Lần {roundIndex + 1}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-[10px] uppercase tracking-wider text-white">
                        <tr>
                          <th className="px-2 py-2 font-black">Mã NVL</th>
                          <th className="px-2 py-2 font-black">Tên vật tư</th>
                          <th className="px-2 py-2 font-black">ĐVT</th>
                          <th className="px-2 py-2 font-black">Số lượng</th>
                          <th className="px-2 py-2 text-center font-black">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center font-semibold text-zinc-400">
                              Chưa có vật tư. Bấm &quot;Thêm dòng&quot; để mở form nhập.
                            </td>
                          </tr>
                        ) : (
                          items.map((item, rowIndex) => (
                          <tr key={`${roundKey}-${rowIndex}`}>
                            <td className="px-2 py-2 font-mono font-semibold text-zinc-700">{item.ma_nvl || '-'}</td>
                            <td className="px-2 py-2 text-zinc-800">{item.ten_vat_tu || '-'}</td>
                            <td className="px-2 py-2 text-zinc-600">{item.don_vi || '-'}</td>
                            <td className="px-2 py-2 font-mono text-zinc-700">
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
                          <td colSpan={5} className="px-2 py-2">
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
                Thêm lần (Lần {roundCount + 1})
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tồn cuối ca</span>
              <input
                value={tonCuoiCaText}
                onChange={e => setTonCuoiCaText(e.target.value)}
                className={modalInputClass}
                inputMode="decimal"
                placeholder="VD: 1500 hoặc 1.500"
              />
            </label>
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
            onClick={() => {
              onSave({ ton_cuoi_ca: parseOptionalNumber(tonCuoiCaText) });
            }}
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
  onSaved
}: {
  onBack?: () => void;
  onOpenList?: () => void;
  modalMode?: boolean;
  open?: boolean;
  onClose?: () => void;
  onSaved?: () => void | Promise<void>;
}) {
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrderOption[]>([]);
  const [form, setForm] = useState(newReportForm());
  const [nhanSuManual, setNhanSuManual] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [lineDraft, setLineDraft] = useState<MixingReportLine>(emptyLine(1));
  const [lineModalError, setLineModalError] = useState('');

  const loadReferenceData = async () => {
    const [machineRes, materialRes, productionRes] = await Promise.all([
      fetch('/api/danh-sach-may'),
      fetch('/api/kho-nvl'),
      fetch('/api/lenh-sx')
    ]);
    const machineData = await machineRes.json().catch(() => ({}));
    const materialData = await materialRes.json().catch(() => ({}));
    const productionData = await productionRes.json().catch(() => ({}));
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

    setProductionOrders(normalizeProductionOrders(productionData));
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

  const shiftOptions = useMemo(() => {
    const shifts = productionOrders
      .filter(order => order.startDate === form.ngay)
      .map(order => order.shift)
      .filter(shift => shift && shift !== '-');

    return [...new Set(shifts)].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [productionOrders, form.ngay]);

  useEffect(() => {
    if (nhanSuManual || !form.ca.trim()) return;
    if (!form.ma_may.trim() && !form.ten_may.trim()) return;

    const staff = resolveStaffFromOrders(
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

  const pickShift = (ca: string) => {
    setNhanSuManual(false);
    setForm(prev => ({ ...prev, ca }));
  };

  const handleDateChange = (ngay: string) => {
    setNhanSuManual(false);
    const shiftsForDay = new Set(
      productionOrders
        .filter(order => order.startDate === ngay)
        .map(order => order.shift)
        .filter(shift => shift && shift !== '-')
    );
    setForm(prev => ({
      ...prev,
      ngay,
      ca: prev.ca && shiftsForDay.has(prev.ca) ? prev.ca : '',
      nhan_su: prev.ca && shiftsForDay.has(prev.ca) ? prev.nhan_su : ''
    }));
  };

  const activeRoundCount = useMemo(() => {
    const fromLines = computedLines.reduce(
      (max, line) => Math.max(max, visibleRoundCount(line.lan_su_dung)),
      1
    );
    if (lineModalOpen) {
      return Math.max(fromLines, visibleRoundCount(lineDraft.lan_su_dung));
    }
    return fromLines;
  }, [computedLines, lineModalOpen, lineDraft.lan_su_dung]);

  const openAddLineModal = () => {
    setEditingLineIndex(null);
    setLineDraft(emptyLine(form.chi_tiet.length + 1));
    setLineModalError('');
    setLineModalOpen(true);
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

    if (editingLineIndex === null) {
      setForm(prev => ({
        ...prev,
        chi_tiet: [...prev.chi_tiet, savedLine].map((line, index) => ({ ...line, stt: index + 1 }))
      }));
    } else {
      setForm(prev => ({
        ...prev,
        chi_tiet: prev.chi_tiet.map((line, index) =>
          index === editingLineIndex ? { ...savedLine, stt: index + 1 } : line
        )
      }));
    }

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

  const resetForm = () => {
    setNhanSuManual(false);
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
      so_lan: activeRoundCount,
      thuc_te_su_dung: computedActualUsage,
      chi_tiet: computedLines
        .filter(line => line.ma_nvl.trim() || line.ten_vat_tu.trim())
        .map((line, index) => ({ ...line, stt: index + 1 }))
    };

    if (payload.chi_tiet.length === 0) {
      setError('Vui lòng nhập ít nhất một dòng vật tư.');
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
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Ca</span>
        <select value={form.ca} onChange={e => pickShift(e.target.value)} className={inputClass}>
          <option value="">Chọn ca từ lệnh SX...</option>
          {shiftOptions.map(shift => (
            <option key={shift} value={shift}>
              {shift}
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

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
          <div>
            <p className="text-sm font-black text-zinc-950">Bảng trộn vật tư</p>
            <p className="text-xs font-semibold text-zinc-500">
              Phối trộn Lần 1 → Lần {activeRoundCount} · jsonb trong <code className="rounded bg-zinc-100 px-1">lan_su_dung</code>
            </p>
          </div>
          <button
            type="button"
            onClick={openAddLineModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
          >
            <Plus className="h-4 w-4" />
            Thêm dòng
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-xs">
            <thead className="bg-zinc-950 text-[10px] uppercase tracking-wider text-white">
              <tr>
                <th className="px-2 py-2 font-black">STT</th>
                <th className="px-2 py-2 font-black">Mã NVL</th>
                <th className="px-2 py-2 font-black">Tên vật tư</th>
                {ROUND_KEYS.slice(0, activeRoundCount).map((_, roundIndex) => (
                  <th key={`head-lan-${roundIndex}`} className="px-2 py-2 font-black">
                    Lần {roundIndex + 1}
                  </th>
                ))}
                <th className="px-2 py-2 font-black">Tổng trộn</th>
                <th className="px-2 py-2 font-black">Tồn cuối ca</th>
                <th className="px-2 py-2 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {computedLines.length === 0 ? (
                <tr>
                  <td colSpan={4 + activeRoundCount + 2} className="px-3 py-8 text-center font-bold text-zinc-400">
                    Chưa có dòng vật tư. Bấm &quot;Thêm dòng&quot; để mở form nhập.
                  </td>
                </tr>
              ) : (
                computedLines.map((line, index) => (
                <tr key={`mix-line-${index}`} className="align-top hover:bg-red-50/30">
                  <td className="px-2 py-2 font-bold text-zinc-600">{index + 1}</td>
                  <td className="px-2 py-2 font-mono font-semibold text-zinc-700">{line.ma_nvl || '-'}</td>
                  <td className="px-2 py-2 text-zinc-800">{line.ten_vat_tu || '-'}</td>
                  {ROUND_KEYS.slice(0, activeRoundCount).map(roundKey => (
                    <td key={roundKey} className="px-2 py-2 font-mono text-zinc-700">
                      {formatOptionalNumber(sumRoundQuantity(line.lan_su_dung, roundKey)) || '-'}
                    </td>
                  ))}
                  <td className="px-2 py-2 font-black text-emerald-700">
                    {formatOptionalNumber(line.tong_nhua_tron) || '-'}
                  </td>
                  <td className="px-2 py-2 font-mono text-zinc-700">{formatOptionalNumber(line.ton_cuoi_ca) || '-'}</td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditLineModal(index)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                        title="Sửa dòng"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50"
                        title="Xóa dòng"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50 px-4 py-3">
          <div className="text-sm font-bold text-zinc-700">
            Thực tế sử dụng (tổng trộn):{' '}
            <span className="font-black text-[#ef1b2d]">{formatNumber(computedActualUsage, 2)} kg</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={resetForm} className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700">
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
