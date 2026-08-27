import React, { useEffect, useState } from 'react';
import { Loader2, Printer, X } from 'lucide-react';

interface MachineCell {
  tenMay: string;
  nhanSu: Array<{ name: string; dispatch?: string }>;
}
interface LichRow {
  khungGio: string;
  tenCa: string;
  machines: MachineCell[];
}
interface ScheduleData {
  ngay: string;
  ca_list: any[];
  may_list: Array<{ id?: string | number; ma_may?: string; ten_may?: string }>;
  lich: LichRow[];
}

interface Props {
  ngay: string;
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : dateStr;
}

export function LichLamViecPrintModal({ ngay, isOpen, onClose }: Props) {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError('');
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/lich-lam-viec?ngay=${encodeURIComponent(ngay)}`);
        const result = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(result.error || 'Lỗi khi tải dữ liệu lịch làm việc.');
          return;
        }
        setData(result);
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
  }, [ngay, isOpen]);

  if (!isOpen) return null;

  const machineList = data?.may_list ?? [];
  const hasSchedule = Boolean(data && data.ca_list && data.ca_list.length > 0);
  const colCount = machineList.length + 2;

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
        .note-cell { white-space: pre-line; font-style: italic; color: #444; }
        .footer-note { font-size: 11px; padding: 6px 4px; font-weight: bold; }
      </style></head><body>${element.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
            Xem trước &amp; in lịch làm việc — {formatDate(ngay)}
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
              Ghi chú (hiển thị ở dòng cuối phiếu in — không phụ thuộc ca/máy)
            </span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
              placeholder="VD: Đổi ca đầu giờ, ưu tiên xử lý lô A"
            />
          </label>

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
                      {machineList.map((may, i) => (
                        <th key={may.ma_may || may.id || i} className="border border-zinc-300 px-2 py-2 text-left font-bold">
                          {may.ten_may}
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
                          return (
                            <td key={midx} className="border border-zinc-300 px-2 py-2 align-top">
                              {cell.nhanSu.length === 0 ? (
                                <span className="text-zinc-400">-</span>
                              ) : (
                                <div className="space-y-0.5">
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
                    {note.trim() ? (
                      <tr>
                        <td className="footer-note border border-zinc-300 px-2 py-2 font-bold" colSpan={colCount}>
                          Ghi chú: {note.trim()}
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
