import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';

interface MachineCell {
  maMay: string;
  tenMay: string;
  nhanSu: Array<{ name: string; dispatch?: string }>;
}

interface LichRow {
  khungGio: string;
  tenCa: string;
  maCa?: string;
  machines: MachineCell[];
}

interface ScheduleNote {
  id: string;
  ngay_lam_viec: string;
  ma_may: string;
  may: string;
  ca_lam_viec: string;
  ghi_chu: string;
  created_at?: string;
  updated_at?: string;
}

interface ScheduleData {
  ngay: string;
  ca_list: Array<{ ten_cai_dat?: string; ma_cai_dat?: string; khung_gio?: string }>;
  may_list: Array<{ id?: string | number; ma_may?: string; ten_may?: string }>;
  may_list_hien_thi?: Array<{ id?: string | number; ma_may?: string; ten_may?: string }>;
  lich: LichRow[];
  ghi_chu_chi_tiet?: ScheduleNote[];
  ghi_chu_chung?: {
    id: string;
    ngay_lam_viec: string;
    ghi_chu: string;
    created_at?: string;
    updated_at?: string;
  } | null;
}

interface Props {
  ngay: string;
  isOpen: boolean;
  onClose: () => void;
}

interface NoteDraft {
  key: string;
  maMay: string;
  caLamViec: string;
  ghiChu: string;
}

const emptyNoteDraft = (): NoteDraft => ({
  key: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  maMay: '',
  caLamViec: '',
  ghiChu: ''
});

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : dateStr;
}

function normalizeScheduleNote(value: unknown): ScheduleNote | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = String(record.id ?? '').trim();
  const ngay_lam_viec = String(record.ngay_lam_viec ?? record.ngayLamViec ?? '').trim().slice(0, 10);
  const ma_may = String(record.ma_may ?? record.maMay ?? '').trim();
  const may = String(record.may ?? record.ten_may ?? record.tenMay ?? '').trim();
  const ca_lam_viec = String(record.ca_lam_viec ?? record.caLamViec ?? record.ca ?? '').trim();
  const ghi_chu = String(record.ghi_chu ?? record.ghiChu ?? record.note ?? '').trim();
  if (!id || !ngay_lam_viec || !ma_may || !ca_lam_viec || !ghi_chu) return null;
  return {
    id,
    ngay_lam_viec,
    ma_may,
    may,
    ca_lam_viec,
    ghi_chu,
    created_at: String(record.created_at ?? record.createdAt ?? '').trim() || undefined,
    updated_at: String(record.updated_at ?? record.updatedAt ?? '').trim() || undefined
  };
}

function noteCellKey(maMay: unknown, ca: unknown) {
  return `${String(maMay ?? '').trim()}||${String(ca ?? '').trim()}`;
}

function machineLabel(machine: { ma_may?: string; ten_may?: string }) {
  return String(machine.ten_may ?? machine.ma_may ?? '').trim();
}

function shiftValue(shift: { ten_cai_dat?: string; ma_cai_dat?: string }) {
  return String(shift.ten_cai_dat ?? shift.ma_cai_dat ?? '').trim();
}

function shiftAliases(shift: { ten_cai_dat?: string; ma_cai_dat?: string }) {
  return [shift.ten_cai_dat, shift.ma_cai_dat].map(value => String(value ?? '').trim()).filter(Boolean);
}

function shiftLabel(shift: { ten_cai_dat?: string; ma_cai_dat?: string; khung_gio?: string }) {
  const base = String(shift.ten_cai_dat ?? shift.ma_cai_dat ?? '').trim();
  const range = String(shift.khung_gio ?? '').trim();
  return range ? `${base} · ${range}` : base;
}

export function LichLamViecPrintModal({ ngay, isOpen, onClose }: Props) {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generalNote, setGeneralNote] = useState('');
  const [generalNoteId, setGeneralNoteId] = useState('');
  const [generalNoteSaving, setGeneralNoteSaving] = useState(false);
  const [generalNoteMessage, setGeneralNoteMessage] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<NoteDraft[]>([emptyNoteDraft()]);
  const [editingNoteId, setEditingNoteId] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');

  const fetchSchedule = useCallback(async (): Promise<ScheduleData> => {
    const res = await fetch(`/api/lich-lam-viec?ngay=${encodeURIComponent(ngay)}`);
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.error || 'Lỗi khi tải dữ liệu lịch làm việc.');
    }
    return {
      ...result,
      ghi_chu_chi_tiet: Array.isArray(result.ghi_chu_chi_tiet)
        ? result.ghi_chu_chi_tiet.map(normalizeScheduleNote).filter((item): item is ScheduleNote => Boolean(item))
        : []
    } as ScheduleData;
  }, [ngay]);

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError('');
      setNoteError('');
      setGeneralNote('');
      setGeneralNoteId('');
      setGeneralNoteMessage('');
      setShowNoteForm(false);
      setNoteDrafts([emptyNoteDraft()]);
      setEditingNoteId('');
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await fetchSchedule();
        if (!cancelled) {
          setData(result);
          setGeneralNote(result.ghi_chu_chung?.ghi_chu || '');
          setGeneralNoteId(result.ghi_chu_chung?.id || '');
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Lỗi khi tải dữ liệu lịch làm việc.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchSchedule, isOpen]);

  const machineList = data?.may_list ?? [];
  const displayMachineList = data?.may_list_hien_thi ?? machineList;
  const shiftList = data?.ca_list ?? [];
  const notes = data?.ghi_chu_chi_tiet ?? [];
  const hasSchedule = Boolean(data && displayMachineList.length > 0 && data.ca_list && data.ca_list.length > 0);

  const machineOptions = useMemo(() => {
    return machineList
      .map(machine => ({
        value: String(machine.ma_may ?? '').trim(),
        label: machineLabel(machine)
      }))
      .filter(option => Boolean(option.value));
  }, [machineList]);

  const shiftOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ value: string; label: string; aliases: string[] }> = [];
    for (const shift of shiftList) {
      const value = shiftValue(shift);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push({ value, label: shiftLabel(shift), aliases: shiftAliases(shift) });
    }
    return out;
  }, [shiftList]);

  const canonicalShift = useCallback(
    (ca: string) => {
      const normalized = String(ca || '').trim();
      if (!normalized) return '';
      const match = shiftOptions.find(
        shift => shift.value === normalized || shift.aliases.includes(normalized)
      );
      return match?.value || normalized;
    },
    [shiftOptions]
  );

  const machineNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const machine of machineList) {
      const code = String(machine.ma_may ?? '').trim();
      if (!code) continue;
      map.set(code, machineLabel(machine) || code);
    }
    return map;
  }, [machineList]);

  const shiftNameByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const shift of shiftOptions) {
      map.set(shift.value, shift.label);
      for (const alias of shift.aliases) map.set(alias, shift.label);
    }
    return map;
  }, [shiftOptions]);

  const notesByCell = useMemo(() => {
    const map = new Map<string, ScheduleNote[]>();
    for (const note of notes) {
      const key = noteCellKey(note.ma_may, canonicalShift(note.ca_lam_viec));
      const list = map.get(key) ?? [];
      list.push(note);
      map.set(key, list);
    }
    return map;
  }, [canonicalShift, notes]);

  useEffect(() => {
    if (!isOpen || !showNoteForm || !data) return;
    setNoteDrafts(prev => prev.map(draft => ({
      ...draft,
      maMay: draft.maMay && machineOptions.some(option => option.value === draft.maMay)
        ? draft.maMay
        : machineOptions[0]?.value || '',
      caLamViec: draft.caLamViec && shiftOptions.some(shift => shift.value === draft.caLamViec)
        ? draft.caLamViec
        : shiftOptions[0]?.value || ''
    })));
  }, [data, isOpen, machineOptions, shiftOptions, showNoteForm]);

  const updateNoteDraft = (key: string, patch: Partial<NoteDraft>) => {
    setNoteDrafts(prev => prev.map(draft => (draft.key === key ? { ...draft, ...patch } : draft)));
  };

  const handleAddNote = async (draft: NoteDraft) => {
    const selectedShift = canonicalShift(draft.caLamViec).trim();
    if (!data?.ngay && !ngay) return;
    if (!draft.maMay) {
      setNoteError('Vui lòng chọn máy.');
      return;
    }
    if (!selectedShift) {
      setNoteError('Vui lòng chọn ca.');
      return;
    }
    if (!draft.ghiChu.trim()) {
      setNoteError('Vui lòng nhập nội dung ghi chú.');
      return;
    }

    const selectedMachine = machineList.find(machine => String(machine.ma_may ?? '').trim() === draft.maMay);
    if (!selectedMachine) {
      setNoteError('Máy được chọn không còn tồn tại trong dữ liệu hiện tại.');
      return;
    }

    setNoteSaving(true);
    setNoteError('');
    try {
      const res = await fetch(
        editingNoteId
          ? `/api/phan-cong-nhan-su/ghi-chu/${encodeURIComponent(editingNoteId)}`
          : '/api/phan-cong-nhan-su/ghi-chu',
        {
        method: editingNoteId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngay_lam_viec: data?.ngay || ngay,
          ma_may: draft.maMay,
          may: machineLabel(selectedMachine),
          ca_lam_viec: selectedShift,
          ghi_chu: draft.ghiChu.trim()
        })
        }
      );
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || (editingNoteId ? 'Không cập nhật được ghi chú.' : 'Không lưu được ghi chú.'));
      const saved = normalizeScheduleNote(result.note) || {
        id: editingNoteId || `local-${Date.now()}`,
        ngay_lam_viec: data?.ngay || ngay,
        ma_may: draft.maMay,
        may: machineLabel(selectedMachine),
        ca_lam_viec: selectedShift,
        ghi_chu: draft.ghiChu.trim()
      };
      setData(prev => {
        if (!prev) return prev;
        const current = prev.ghi_chu_chi_tiet ?? [];
        return {
          ...prev,
          ghi_chu_chi_tiet: editingNoteId
            ? current.map(note => (note.id === editingNoteId ? saved : note))
            : [...current, saved]
        };
      });
      setNoteDrafts(prev => editingNoteId
        ? [emptyNoteDraft()]
        : prev.map(item => (item.key === draft.key ? { ...item, ghiChu: '' } : item)));
      setEditingNoteId('');
      setShowNoteForm(true);
    } catch (err: any) {
      setNoteError(err?.message || 'Không lưu được ghi chú.');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleEditNote = (note: ScheduleNote) => {
    setNoteError('');
    setEditingNoteId(note.id);
    setNoteDrafts([{
      key: `edit-${note.id}`,
      maMay: note.ma_may,
      caLamViec: canonicalShift(note.ca_lam_viec),
      ghiChu: note.ghi_chu
    }]);
    setShowNoteForm(true);
  };

  const handleSaveGeneralNote = async () => {
    const value = generalNote.trim();
    if (!value) {
      setGeneralNoteMessage('Vui lòng nhập nội dung ghi chú chung.');
      return;
    }
    setGeneralNoteSaving(true);
    setGeneralNoteMessage('');
    try {
      const res = await fetch('/api/phan-cong-nhan-su/ghi-chu-chung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ngay_lam_viec: data?.ngay || ngay, ghi_chu: value })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Không lưu được ghi chú chung.');
      setGeneralNoteId(String(result.note?.id || ''));
      setGeneralNote(value);
      setGeneralNoteMessage('Đã lưu ghi chú chung.');
    } catch (err: any) {
      setGeneralNoteMessage(err?.message || 'Không lưu được ghi chú chung.');
    } finally {
      setGeneralNoteSaving(false);
    }
  };

  const handleDeleteGeneralNote = async () => {
    if (!generalNoteId) {
      setGeneralNote('');
      return;
    }
    if (!window.confirm('Xóa ghi chú chung của ngày này?')) return;
    setGeneralNoteSaving(true);
    setGeneralNoteMessage('');
    try {
      const res = await fetch(`/api/phan-cong-nhan-su/ghi-chu-chung/${encodeURIComponent(generalNoteId)}`, {
        method: 'DELETE'
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Không xóa được ghi chú chung.');
      setGeneralNote('');
      setGeneralNoteId('');
      setGeneralNoteMessage('Đã xóa ghi chú chung.');
    } catch (err: any) {
      setGeneralNoteMessage(err?.message || 'Không xóa được ghi chú chung.');
    } finally {
      setGeneralNoteSaving(false);
    }
  };

  const handleDeleteNote = async (note: ScheduleNote) => {
    if (!window.confirm('Xóa ghi chú này?')) return;
    try {
      const res = await fetch(`/api/phan-cong-nhan-su/ghi-chu/${encodeURIComponent(note.id)}`, {
        method: 'DELETE'
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Không xóa được ghi chú.');
      setData(prev =>
        prev
          ? {
              ...prev,
              ghi_chu_chi_tiet: (prev.ghi_chu_chi_tiet ?? []).filter(item => item.id !== note.id)
            }
          : prev
      );
      if (editingNoteId === note.id) {
        setEditingNoteId('');
        setNoteDrafts([emptyNoteDraft()]);
      }
    } catch (err: any) {
      setNoteError(err?.message || 'Không xóa được ghi chú.');
    }
  };

  const handlePrint = () => {
    const element = document.getElementById('lich-lam-viec-print-area');
    if (!element) return;
    const win = window.open('', '', 'width=1200,height=800');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Lịch làm việc ${formatDate(data?.ngay || ngay)}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 8mm; color: #111; }
        h1 { font-size: 16px; text-align: center; margin: 4px 0; }
        h2 { font-size: 13px; font-weight: normal; text-align: center; margin: 2px 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; table-layout: fixed; }
        th, td { border: 1px solid #333; padding: 3px 4px; text-align: left; vertical-align: top; word-wrap: break-word; }
        th { background: #f0f0f0; font-weight: bold; }
        .schedule-time-col { width: 11%; font-size: 11px; white-space: nowrap; }
        .schedule-shift-col { width: 10%; font-size: 11px; white-space: nowrap; }
        .note-cell { white-space: pre-line; font-style: normal; color: inherit; }
        .footer-note { background: #ffeb3b; font-size: 35px; padding: 8px 4px; font-weight: bold; text-align: center; vertical-align: middle; }
        .schedule-note-item { white-space: pre-line; font-size: 14px; line-height: 1.25; margin-top: 2px; }
        .schedule-note-item:first-child { margin-top: 0; }
      </style></head><body>${element.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
            Xem trước &amp; in lịch làm việc - {formatDate(ngay)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <label className="mb-4 block space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
              Ghi chú chung cho ngày hôm đó
            </span>
            <textarea
              value={generalNote}
              onChange={e => setGeneralNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
              placeholder="VD: Đổi ca đầu giờ, ưu tiên xử lý lô A"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveGeneralNote()}
                  disabled={generalNoteSaving}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white hover:bg-[#b30d1c] disabled:opacity-50"
                >
                  {generalNoteSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Lưu ghi chú chung
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteGeneralNote()}
                  disabled={generalNoteSaving || (!generalNoteId && !generalNote)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa
                </button>
              </div>
              {generalNoteMessage ? (
                <span className="text-xs font-bold text-zinc-600">{generalNoteMessage}</span>
              ) : null}
            </div>
          </label>

          <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Ghi chú theo máy / ca</p>
                <p className="text-xs font-semibold text-zinc-500">
                  Bấm Thêm mới, chọn máy và ca, rồi lưu vào hệ thống. Có thể thêm nhiều ghi chú.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNoteError('');
                  setShowNoteForm(prev => !prev);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-extrabold text-zinc-700 hover:bg-zinc-50"
              >
                <Plus className="h-4 w-4" />
                {showNoteForm ? 'Ẩn form' : 'Thêm mới ghi chú'}
              </button>
            </div>

            {showNoteForm ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {!editingNoteId ? (
                  <div className="flex justify-end sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => setNoteDrafts(prev => {
                        const last = prev[prev.length - 1];
                        const next = emptyNoteDraft();
                        return [...prev, {
                          ...next,
                          maMay: last?.maMay || machineOptions[0]?.value || '',
                          caLamViec: last?.caLamViec || shiftOptions[0]?.value || ''
                        }];
                      })}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-extrabold text-violet-700 hover:bg-violet-100"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm mới
                    </button>
                  </div>
                ) : null}
                {noteDrafts.map(draft => (
                  <div key={draft.key} className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:col-span-2 sm:grid-cols-2">
                    <div className="flex items-center justify-between sm:col-span-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Ghi chú mới</span>
                      <button
                        type="button"
                        onClick={() => setNoteDrafts(prev => {
                          const next = prev.filter(item => item.key !== draft.key);
                          return next.length > 0 ? next : [emptyNoteDraft()];
                        })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                        title="Xóa khung ghi chú này"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Máy</span>
                  <select
                    value={draft.maMay}
                    onChange={e => updateNoteDraft(draft.key, { maMay: e.target.value })}
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                  >
                    {machineOptions.length === 0 ? (
                      <option value="">Không có máy</option>
                    ) : (
                      machineOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Ca</span>
                  <select
                    value={draft.caLamViec}
                    onChange={e => updateNoteDraft(draft.key, { caLamViec: e.target.value })}
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                  >
                    {shiftOptions.length === 0 ? (
                      <option value="">Không có ca</option>
                    ) : (
                      shiftOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Nội dung ghi chú</span>
                  <textarea
                    value={draft.ghiChu}
                    onChange={e => updateNoteDraft(draft.key, { ghiChu: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                    placeholder="Ví dụ: kiểm tra dầu, đổi người hỗ trợ, ưu tiên lô X"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAddNote(draft)}
                      disabled={noteSaving || machineOptions.length === 0 || shiftOptions.length === 0}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white hover:bg-[#b30d1c] disabled:opacity-50"
                    >
                      {noteSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {editingNoteId ? 'Cập nhật ghi chú' : 'Lưu ghi chú'}
                    </button>
                    {editingNoteId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId('');
                          setNoteDrafts([emptyNoteDraft()]);
                          setNoteError('');
                        }}
                        className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                      >
                        Hủy sửa
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => updateNoteDraft(draft.key, { ghiChu: '' })}
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                    >
                      Xóa nội dung
                    </button>
                  </div>
                  {noteError ? <p className="text-xs font-bold text-rose-600">{noteError}</p> : null}
                </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Danh sách ghi chú đã lưu</h4>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-black text-zinc-500">{notes.length}</span>
              </div>
              {notes.length === 0 ? (
                <p className="text-sm font-semibold text-zinc-500">Chưa có ghi chú chi tiết cho ngày này.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {notes.map(note => (
                    <div key={note.id} className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                            {machineNameByCode.get(note.ma_may) || note.may || note.ma_may}
                            <span className="text-amber-500">
                              {' '}
                              · {shiftNameByValue.get(note.ca_lam_viec) || note.ca_lam_viec}
                            </span>
                          </p>
                          <p className="whitespace-pre-line text-sm font-semibold text-zinc-800">{note.ghi_chu}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditNote(note)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-700 hover:bg-amber-100"
                            title="Sửa ghi chú"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteNote(note)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                            title="Xóa ghi chú"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p>
          ) : !hasSchedule ? (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center text-sm font-bold text-zinc-500">
              Không có dữ liệu lịch làm việc cho ngày {formatDate(data?.ngay || ngay)}.
            </p>
          ) : (
            <div id="lich-lam-viec-print-area" style={{ fontFamily: 'Arial, sans-serif' }}>
              <h1>LỊCH LÀM VIỆC THEO NGÀY CÁC TỔ</h1>
              <h2>NGÀY {formatDate(data?.ngay || ngay)}</h2>
              <div className="overflow-x-auto border border-zinc-300">
                <table className="w-full border-collapse" style={{ fontSize: 16 }}>
                  <thead>
                    <tr className="bg-zinc-100">
                      <th className="schedule-time-col border border-zinc-300 px-2 py-2 text-left font-bold">Khung Giờ</th>
                      <th className="schedule-shift-col border border-zinc-300 px-2 py-2 text-left font-bold">Ca SX</th>
                      {displayMachineList.map((may, i) => (
                        <th key={may.ma_may || may.id || i} className="border border-zinc-300 px-2 py-2 text-left font-bold">
                          {machineLabel(may)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.lich ?? []).map((row, idx) => (
                      <tr key={idx}>
                        <td className="schedule-time-col border border-zinc-300 px-2 py-2 font-medium">{row.khungGio}</td>
                        <td className="schedule-shift-col border border-zinc-300 px-2 py-2">{row.tenCa}</td>
                        {row.machines.map((cell, midx) => {
                          const employeeNames = cell.nhanSu.map(p => p.name);
                          const dispatched = cell.nhanSu.filter(p => p.dispatch);
                          const cellNotes =
                            notesByCell.get(noteCellKey(cell.maMay, canonicalShift(row.tenCa))) ??
                            notesByCell.get(noteCellKey(cell.maMay, canonicalShift(row.maCa || ''))) ??
                            [];
                          return (
                            <td key={midx} className="border border-zinc-300 px-2 py-2 align-top">
                              {cell.nhanSu.length === 0 && cellNotes.length === 0 ? (
                                <span className="text-zinc-400">-</span>
                              ) : (
                                <div className="space-y-1">
                                  {employeeNames.length > 0 ? <div>{employeeNames.join(', ')}</div> : null}
                                  {dispatched.map((p, pidx) => (
                                    <div key={`dispatch-${pidx}`} className="note-cell italic text-zinc-600" style={{ whiteSpace: 'pre-line' }}>
                                      {p.dispatch}
                                    </div>
                                  ))}
                                  {cellNotes.map(note => (
                                    <div key={note.id} className="schedule-note-item">
                                      ({note.ghi_chu})
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {generalNote.trim() ? (
                      <tr>
                        <td className="footer-note border border-zinc-300 px-2 py-2 text-center font-bold" style={{ backgroundColor: '#ffeb3b', fontSize: 35, textAlign: 'center' }} colSpan={displayMachineList.length + 2}>
                          {generalNote.trim()}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!hasSchedule}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white hover:bg-[#b30d1c] disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            In lịch làm việc
          </button>
        </div>
      </div>
    </div>
  );
}
