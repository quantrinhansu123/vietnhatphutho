import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  ChevronLeft,
  ClipboardCheck,
  Clock3,
  Cpu,
  ImagePlus,
  Loader2,
  Printer,
  Save,
  Trash2
} from 'lucide-react';
import vietNhatLogoUrl from '../../logovietnhat_1.png';
import { formatNumber } from '../utils';
import { AcceptanceReportPrintBatch, buildAcceptancePrintSlips } from './AcceptanceReportPrintSheet';

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

const inputClass =
  'h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

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

function formatProductLabel(productCode: string, productName: string) {
  if (productCode && productName && productCode !== productName) {
    return `${productCode} · ${productName}`;
  }
  return productName || productCode;
}

function resolveMachineFromRef(ref: string, machines: MachineOption[]) {
  const trimmed = ref.trim();
  if (!trimmed) return { ma_may: '', ten_may: '', machineRef: '' };

  const linked =
    machines.find(machine => machine.code === trimmed) ??
    machines.find(machine => machine.name === trimmed) ??
    machines.find(machine => `${machine.code} · ${machine.name}` === trimmed) ??
    null;

  if (linked) {
    return { ma_may: linked.code, ten_may: linked.name, machineRef: trimmed };
  }

  return { ma_may: trimmed, ten_may: trimmed, machineRef: trimmed };
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

function normalizeReportFromApi(record: Record<string, unknown>): AcceptanceReport {
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

function newReportForm() {
  return {
    ngay: todayIso(),
    ca: '',
    lan: '1',
    gio: nowTimeValue(),
    ma_may: '',
    ten_may: '',
    machineRef: '',
    mat_hang: '',
    don_vi: '',
    so_luong: '',
    hinh_anh: '',
    hinh_anh_public_id: '',
    imagePreview: ''
  };
}

export default function AcceptanceReportForm({ onBack }: { onBack: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrderOption[]>([]);
  const [reports, setReports] = useState<AcceptanceReport[]>([]);
  const [filterDate, setFilterDate] = useState(todayIso());
  const [form, setForm] = useState(newReportForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pendingPrint, setPendingPrint] = useState(false);

  const printSlips = useMemo(() => buildAcceptancePrintSlips(reports), [reports]);

  useEffect(() => {
    if (!pendingPrint || printSlips.length === 0) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPendingPrint(false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [pendingPrint, printSlips]);

  const handlePrint = () => {
    if (printSlips.length === 0) {
      setError('Chưa có báo cáo nghiệm thu để in trong ngày này.');
      return;
    }
    setError('');
    setPendingPrint(true);
  };

  const loadReports = async (ngay = filterDate) => {
    const res = await fetch(`/api/bao-cao-nghiem-thu?ngay=${encodeURIComponent(ngay)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Không thể tải báo cáo nghiệm thu.');
    const list = Array.isArray(data.reports) ? data.reports : [];
    setReports(list.map((item: Record<string, unknown>) => normalizeReportFromApi(item)));
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [machineRes, productionRes] = await Promise.all([
          fetch('/api/danh-sach-may'),
          fetch('/api/lenh-sx'),
          loadReports(filterDate)
        ]);
        const machineData = await machineRes.json().catch(() => ({}));
        const productionData = await productionRes.json().catch(() => ({}));
        if (!machineRes.ok) throw new Error(machineData.error || 'Không thể tải danh sách máy.');
        if (!productionRes.ok) throw new Error(productionData.error || 'Không thể tải lệnh sản xuất.');
        if (cancelled) return;

        setMachines(normalizeMachines(machineData));
        setProductionOrders(normalizeProductionOrders(productionData));
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Không thể tải dữ liệu.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadReports(filterDate).catch(err => setError(err.message || 'Không thể tải báo cáo.'));
  }, [filterDate]);

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

  const machineOptions = useMemo(() => {
    const refs = ordersForSelectedDay
      .filter(order => !form.ca || shiftMatches(order.shift, form.ca))
      .map(order => order.machine)
      .filter(machine => machine && machine !== '-');

    const uniqueRefs = [...new Set(refs)];
    return uniqueRefs
      .map(ref => {
        const resolved = resolveMachineFromRef(ref, machines);
        return {
          value: ref,
          label:
            resolved.ma_may && resolved.ten_may && resolved.ma_may !== resolved.ten_may
              ? `${resolved.ma_may} · ${resolved.ten_may}`
              : resolved.ten_may || resolved.ma_may || ref
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [ordersForSelectedDay, form.ca, machines]);

  const productOptions = useMemo(() => {
    if (!form.ca || !form.machineRef) return [];

    const items = ordersForSelectedDay
      .filter(
        order =>
          shiftMatches(order.shift, form.ca) &&
          machineMatches(order.machine, form.ma_may, form.ten_may, form.machineRef)
      )
      .map(order => ({
        label: formatProductLabel(order.productCode, order.productName),
        unit: order.unit
      }))
      .filter(item => item.label && item.label !== '-');

    const byLabel = new Map<string, string>();
    items.forEach(item => {
      if (!byLabel.has(item.label)) {
        byLabel.set(item.label, item.unit);
      }
    });

    return [...byLabel.entries()]
      .map(([label, unit]) => ({ label, unit }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [ordersForSelectedDay, form.ca, form.ma_may, form.ten_may, form.machineRef]);

  const handleDateChange = (ngay: string) => {
    setForm(prev => ({
      ...prev,
      ngay,
      ca: '',
      ma_may: '',
      ten_may: '',
      machineRef: '',
      mat_hang: '',
      don_vi: ''
    }));
  };

  const handleShiftChange = (ca: string) => {
    setForm(prev => ({
      ...prev,
      ca,
      ma_may: '',
      ten_may: '',
      machineRef: '',
      mat_hang: '',
      don_vi: ''
    }));
  };

  const handleMachineChange = (machineRef: string) => {
    const resolved = resolveMachineFromRef(machineRef, machines);
    setForm(prev => ({
      ...prev,
      machineRef,
      ma_may: resolved.ma_may,
      ten_may: resolved.ten_may,
      mat_hang: '',
      don_vi: ''
    }));
  };

  const handleProductChange = (mat_hang: string) => {
    const match = productOptions.find(option => option.label === mat_hang);
    setForm(prev => ({
      ...prev,
      mat_hang,
      don_vi: match?.unit || ''
    }));
  };

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
    const machineRef = report.ma_may || report.ten_may;
    setEditingId(report.id);
    setForm({
      ngay: report.ngay || todayIso(),
      ca: report.ca,
      lan: report.lan || '1',
      gio: report.gio || nowTimeValue(),
      ma_may: report.ma_may,
      ten_may: report.ten_may,
      machineRef,
      mat_hang: report.mat_hang,
      don_vi: report.don_vi,
      so_luong: report.so_luong === null ? '' : String(report.so_luong),
      hinh_anh: report.hinh_anh,
      hinh_anh_public_id: report.hinh_anh_public_id || '',
      imagePreview: report.hinh_anh
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!form.ngay.trim()) {
      setError('Vui lòng chọn ngày.');
      return;
    }
    if (!form.ca.trim()) {
      setError('Vui lòng chọn ca.');
      return;
    }
    if (!form.ma_may.trim() && !form.ten_may.trim()) {
      setError('Vui lòng chọn máy từ lệnh sản xuất.');
      return;
    }
    if (!form.lan.trim()) {
      setError('Vui lòng nhập lần nghiệm thu.');
      return;
    }
    if (!form.mat_hang.trim()) {
      setError('Vui lòng chọn mặt hàng.');
      return;
    }
    const soLuong = Number(String(form.so_luong).replace(',', '.'));
    if (!Number.isFinite(soLuong) || soLuong <= 0) {
      setError('Số lượng phải lớn hơn 0.');
      return;
    }
    if (!form.hinh_anh.trim()) {
      setError('Vui lòng chụp hoặc tải ảnh nghiệm thu.');
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');

    const payload = {
      ngay: form.ngay,
      ca: form.ca,
      lan: form.lan,
      gio: form.gio,
      ma_may: form.ma_may,
      ten_may: form.ten_may,
      mat_hang: form.mat_hang,
      don_vi: form.don_vi,
      so_luong: soLuong,
      hinh_anh: form.hinh_anh,
      hinh_anh_public_id: form.hinh_anh_public_id
    };

    try {
      const res = await fetch(
        editingId ? `/api/bao-cao-nghiem-thu/${editingId}` : '/api/bao-cao-nghiem-thu',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu báo cáo nghiệm thu.');

      setMessage(editingId ? 'Đã cập nhật báo cáo nghiệm thu.' : 'Đã lưu báo cáo nghiệm thu.');
      resetForm();
      await loadReports(filterDate);
    } catch (err: any) {
      setError(err.message || 'Không thể lưu báo cáo nghiệm thu.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa báo cáo nghiệm thu này?')) return;
    try {
      const res = await fetch(`/api/bao-cao-nghiem-thu/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa báo cáo.');
      if (editingId === id) resetForm();
      await loadReports(filterDate);
    } catch (err: any) {
      setError(err.message || 'Không thể xóa báo cáo.');
    }
  };

  const machineSelectValue =
    machineOptions.find(option => option.value === form.machineRef)?.value ??
    (form.machineRef || '');

  return (
    <div className="space-y-4 pb-24">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b-4 border-[#ef1b2d] bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <img src={vietNhatLogoUrl} alt="Viet Nhat IPT" className="h-14 w-auto max-w-[190px] object-contain" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#ef1b2d]">Kiểm tra chất lượng</p>
                <h2 className="text-lg font-black uppercase tracking-tight text-zinc-950">Báo cáo nghiệm thu</h2>
                <p className="mt-1 text-xs font-semibold text-zinc-500">
                  Ca, máy và mặt hàng lấy từ lệnh sản xuất trong ngày
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Quay lại
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 bg-zinc-50 p-4 md:grid-cols-3 lg:grid-cols-6">
          <label className="space-y-1">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
              <CalendarDays className="h-3.5 w-3.5 text-[#ef1b2d]" /> Ngày
            </span>
            <input type="date" value={form.ngay} onChange={e => handleDateChange(e.target.value)} className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Ca</span>
            <select value={form.ca} onChange={e => handleShiftChange(e.target.value)} className={inputClass}>
              <option value="">Chọn ca từ lệnh SX...</option>
              {shiftOptions.map(shift => (
                <option key={shift} value={shift}>
                  {shift}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
              <Cpu className="h-3.5 w-3.5 text-[#ef1b2d]" /> Máy
            </span>
            <select
              value={machineSelectValue}
              onChange={e => handleMachineChange(e.target.value)}
              className={inputClass}
              disabled={!form.ca}
            >
              <option value="">{form.ca ? 'Chọn máy từ lệnh SX...' : 'Chọn ca trước'}</option>
              {machineOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Lần</span>
            <input
              value={form.lan}
              onChange={e => setForm(prev => ({ ...prev, lan: e.target.value }))}
              className={inputClass}
              placeholder="VD: 1"
            />
          </label>
          <label className="space-y-1">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
              <Clock3 className="h-3.5 w-3.5 text-[#ef1b2d]" /> Giờ
            </span>
            <input
              type="time"
              value={form.gio}
              onChange={e => setForm(prev => ({ ...prev, gio: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Mặt hàng</span>
            <select
              value={form.mat_hang}
              onChange={e => handleProductChange(e.target.value)}
              className={inputClass}
              disabled={!form.machineRef}
            >
              <option value="">
                {form.machineRef ? 'Chọn mặt hàng từ lệnh SX...' : 'Chọn máy trước'}
              </option>
              {productOptions.map(item => (
                <option key={item.label} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Đơn vị</span>
            <input value={form.don_vi} readOnly className={`${inputClass} bg-zinc-50 text-zinc-600`} placeholder="Tự điền từ lệnh SX" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Số lượng</span>
            <input
              value={form.so_luong}
              onChange={e => setForm(prev => ({ ...prev, so_luong: e.target.value }))}
              className={inputClass}
              inputMode="decimal"
              placeholder="0"
            />
          </label>
          <div className="space-y-1 lg:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Hình ảnh</span>
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
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {isUploading ? 'Đang tải ảnh...' : 'Chụp / chọn ảnh'}
              </button>
              {form.imagePreview && (
                <a
                  href={form.imagePreview}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-zinc-200"
                >
                  <img src={form.imagePreview} alt="Xem trước" className="h-full w-full object-cover" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 bg-white px-4 py-3">
          <button type="button" onClick={resetForm} className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700">
            Làm mới
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingId ? 'Cập nhật' : 'Lưu báo cáo'}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-700" />
            <p className="text-sm font-black text-zinc-950">Báo cáo đã lưu</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={reports.length === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              In phiếu
            </button>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-600">
              Ngày
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className={inputClass} />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-black">Ảnh</th>
                <th className="px-3 py-2 font-black">Ngày</th>
                <th className="px-3 py-2 font-black">Ca</th>
                <th className="px-3 py-2 font-black">Máy</th>
                <th className="px-3 py-2 font-black">Lần</th>
                <th className="px-3 py-2 font-black">Giờ</th>
                <th className="px-3 py-2 font-black">Mặt hàng</th>
                <th className="px-3 py-2 font-black">ĐVT</th>
                <th className="px-3 py-2 font-black">SL</th>
                <th className="px-3 py-2 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center font-bold text-zinc-400">
                    Chưa có báo cáo trong ngày này.
                  </td>
                </tr>
              ) : (
                reports.map(report => (
                  <tr key={report.id} className="hover:bg-emerald-50/40">
                    <td className="px-3 py-2">
                      {report.hinh_anh ? (
                        <a href={report.hinh_anh} target="_blank" rel="noreferrer" className="block h-10 w-10 overflow-hidden rounded-lg border border-zinc-200">
                          <img src={report.hinh_anh} alt="Nghiệm thu" className="h-full w-full object-cover" />
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-zinc-700">{report.ngay || '-'}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-800">{report.ca || '-'}</td>
                    <td className="px-3 py-2 text-zinc-700">{report.ten_may || report.ma_may || '-'}</td>
                    <td className="px-3 py-2 font-bold text-zinc-700">{report.lan || '-'}</td>
                    <td className="px-3 py-2 font-mono text-zinc-600">{report.gio || '-'}</td>
                    <td className="px-3 py-2 text-zinc-700">{report.mat_hang || '-'}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-600">{report.don_vi || '-'}</td>
                    <td className="px-3 py-2 font-mono font-bold text-emerald-700">
                      {report.so_luong === null ? '-' : formatNumber(report.so_luong, 2)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(report)}
                          className="rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-black text-zinc-700 hover:bg-zinc-50"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(report.id)}
                          className="rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-black text-rose-700 hover:bg-rose-50"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {pendingPrint &&
        printSlips.length > 0 &&
        createPortal(<AcceptanceReportPrintBatch slips={printSlips} />, document.body)}
    </div>
  );
}

export function normalizeAcceptanceReports(data: unknown): AcceptanceReport[] {
  if (!data || typeof data !== 'object') return [];
  const rows = (data as { reports?: unknown }).reports;
  if (!Array.isArray(rows)) return [];
  return rows.map((item: Record<string, unknown>) => normalizeReportFromApi(item));
}
