import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Printer, Trash2, X } from 'lucide-react';

interface MachineCell {
  maMay: string;
  tenMay: string;
  nhanSu: Array<{ name: string; dispatch?: string }>;
}

interface LichRow {
  khungGio: string;
  tenCa: string;
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
}

interface Props {
  ngay: string;
  isOpen: boolean;
  onClose: () => void;
}

interface NoteDraft {
  maMay: string;
  caLamViec: string;
  ghiChu: string;
}

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
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteDraft, setNoteDraft] = useState<NoteDraft>({ maMay: '', caLamViec: '', ghiChu: '' });
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
      setShowNoteForm(false);
      setNoteDraft({ maMay: '', caLamViec: '', ghiChu: '' });
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await fetchSchedule();
        if (!cancelled) setData(result);
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
    const out: Array<{ value: string; label: string }> = [];
    for (const shift of shiftList) {
      const value = shiftValue(shift);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push({ value, label: shiftLabel(shift) });
    }
    return out;
  }, [shiftList]);

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
    }
    return map;
  }, [shiftOptions]);

  const notesByCell = useMemo(() => {
    const map = new Map<string, ScheduleNote[]>();
    for (const note of notes) {
      const key = noteCellKey(note.ma_may, note.ca_lam_viec);
      const list = map.get(key) ?? [];
      list.push(note);
      map.set(key, list);
    }
    return map;
  }, [notes]);

  useEffect(() => {
    if (!isOpen || !data) return;
    setNoteDraft(prev => {
      const nextMaMay =
        prev.maMay && machineList.some(machine => String(machine.ma_may ?? '').trim() === prev.maMay)
          ? prev.maMay
          : machineOptions[0]?.value || '';
      const nextCaLamViec =
        prev.caLamViec && shiftOptions.some(shift => shift.value === prev.caLamViec)
          ? prev.caLamViec
          : shiftOptions[0]?.value || '';
      if (prev.maMay === nextMaMay && prev.caLamViec === nextCaLamViec) return prev;
      return { ...prev, maMay: nextMaMay, caLamViec: nextCaLamViec };
    });
  }, [data, isOpen, machineList, machineOptions, shiftOptions]);

  const handleAddNote = async () => {
    if (!data?.ngay && !ngay) return;
    if (!noteDraft.maMay) {
      setNoteError('Vui lòng chọn máy.');
      return;
    }
    if (!noteDraft.caLamViec) {
      setNoteError('Vui lòng chọn ca.');
      return;
    }
    if (!noteDraft.ghiChu.trim()) {
      setNoteError('Vui lòng nhập nội dung ghi chú.');
      return;
    }

    const selectedMachine = machineList.find(machine => String(machine.ma_may ?? '').trim() === noteDraft.maMay);
    if (!selectedMachine) {
      setNoteError('Máy được chọn không còn tồn tại trong dữ liệu hiện tại.');
      return;
    }

    setNoteSaving(true);
    setNoteError('');
    try {
      const res = await fetch('/api/phan-cong-nhan-su/ghi-chu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngay_lam_viec: data?.ngay || ngay,
          ma_may: noteDraft.maMay,
          may: machineLabel(selectedMachine),
          ca_lam_viec: noteDraft.caLamViec,
          ghi_chu: noteDraft.ghiChu.trim()
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Không lưu được ghi chú.');
      const saved = normalizeScheduleNote(result.note) || {
        id: `local-${Date.now()}`,
        ngay_lam_viec: data?.ngay || ngay,
        ma_may: noteDraft.maMay,
        may: machineLabel(selectedMachine),
        ca_lam_viec: noteDraft.caLamViec,
        ghi_chu: noteDraft.ghiChu.trim()
      };
      setData(prev =>
        prev
          ? {
              ...prev,
              ghi_chu_chi_tiet: [...(prev.ghi_chu_chi_tiet ?? []), saved]
            }
          : prev
      );
      setNoteDraft(prev => ({ ...prev, ghiChu: '' }));
      setShowNoteForm(true);
    } catch (err: any) {
      setNoteError(err?.message || 'Không lưu được ghi chú.');
    } finally {
      setNoteSaving(false);
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
        table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
        th, td { border: 1px solid #333; padding: 3px 4px; text-align: left; vertical-align: top; word-wrap: break-word; }
        th { background: #f0f0f0; font-weight: bold; }
        .note-cell { white-space: pre-line; font-style: normal; color: inherit; }
        .footer-note { font-size: 11px; padding: 6px 4px; font-weight: bold; }
        .schedule-note-item { white-space: pre-line; font-size: 9px; line-height: 1.25; margin-top: 2px; }
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
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
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
          </label>

          <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Ghi chú theo máy / ca</p>
                <p className="text-xs font-semibold text-zinc-500">
                  Mỗi ghi chú được gắn cho một máy, một ca và một ngày.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNoteForm(prev => !prev)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-extrabold text-zinc-700 hover:bg-zinc-50"
              >
                <Plus className="h-4 w-4" />
                {showNoteForm ? 'Ẩn form' : 'Thêm ghi chú'}
              </button>
            </div>

            {showNoteForm ? (
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px]">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Máy</span>
                  <select
                    value={noteDraft.maMay}
                    onChange={e => setNoteDraft(prev => ({ ...prev, maMay: e.target.value }))}
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
                    value={noteDraft.caLamViec}
                    onChange={e => setNoteDraft(prev => ({ ...prev, caLamViec: e.target.value }))}
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

                <label className="space-y-1.5 lg:col-span-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Nội dung ghi chú</span>
                  <textarea
                    value={noteDraft.ghiChu}
                    onChange={e => setNoteDraft(prev => ({ ...prev, ghiChu: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                    placeholder="Ví dụ: kiểm tra dầu, đổi người hỗ trợ, ưu tiên lô X"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2 lg:col-span-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAddNote()}
                      disabled={noteSaving || machineOptions.length === 0 || shiftOptions.length === 0}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white hover:bg-[#b30d1c] disabled:opacity-50"
                    >
                      {noteSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Lưu ghi chú
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteDraft(prev => ({ ...prev, ghiChu: '' }))}
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                    >
                      Xóa nội dung
                    </button>
                  </div>
                  {noteError ? <p className="text-xs font-bold text-rose-600">{noteError}</p> : null}
                </div>
              </div>
            ) : null}

            <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Danh sách ghi chú chi tiết</h4>
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
                            <span className="text-amber-500"> · {shiftNameByValue.get(note.ca_lam_viec) || note.ca_lam_viec}</span>
                          </p>
                          <p className="whitespace-pre-line text-sm font-semibold text-zinc-800">{note.ghi_chu}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteNote(note)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                          title="Xóa ghi chú"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
                <table className="w-full border-collapse" style={{ fontSize: 11 }}>
                  <thead>
                    <tr className="bg-zinc-100">
                      <th className="border border-zinc-300 px-2 py-2 text-left font-bold">Khung Giờ</th>
                      <th className="border border-zinc-300 px-2 py-2 text-left font-bold">Ca SX</th>
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
                        <td className="border border-zinc-300 px-2 py-2 font-medium">{row.khungGio}</td>
                        <td className="border border-zinc-300 px-2 py-2">{row.tenCa}</td>
                        {row.machines.map((cell, midx) => {
                          const plain = cell.nhanSu.filter(p => !p.dispatch).map(p => p.name);
                          const dispatched = cell.nhanSu.filter(p => p.dispatch);
                          const cellNotes = notesByCell.get(noteCellKey(cell.maMay, row.tenCa)) ?? [];
                          return (
                            <td key={midx} className="border border-zinc-300 px-2 py-2 align-top">
                              {cell.nhanSu.length === 0 && cellNotes.length === 0 ? (
                                <span className="text-zinc-400">-</span>
                              ) : (
                                <div className="space-y-1">
                                  {cellNotes.length > 0
                                    ? cellNotes.map(note => (
                                        <div key={note.id} className="schedule-note-item">
                                          ({note.ghi_chu})
                                        </div>
                                      ))
                                    : null}
                                  {plain.length > 0 ? <div>{plain.join(', ')}</div> : null}
                                  {dispatched.map((p, pidx) => (
                                    <div key={pidx}>
                                      <span>{p.name}</span>{' '}
                                      <span className="note-cell italic text-zinc-600" style={{ whiteSpace: 'pre-line' }}>
                                        {p.dispatch}
                                      </span>
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
                        <td className="footer-note border border-zinc-300 px-2 py-2 font-bold" colSpan={displayMachineList.length + 2}>
                          Ghi chú: {generalNote.trim()}
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
