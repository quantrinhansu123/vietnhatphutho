import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { VnCalendarPicker, parseDateStr, formatDateVN } from '../so-che-do-may';
import { TableToolbar } from '../../components/shared/table';
import {
  HANG_LOI_NHOM_OPTIONS,
  buildHangLoiReport,
  normalizeHangLoiRecords,
  shortNhomVthh,
  type HangLoiKhachHangRecord
} from './model';

const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500';

function firstDayOfMonth(today: string): string {
  const parsed = parseDateStr(today);
  if (!parsed) return today;
  const month = String(parsed.thang).padStart(2, '0');
  return `${parsed.nam}-${month}-01`;
}

function todayLocalISO(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

/** "hàng chạy 100% phế" → "hàng chạy 100% phế"; "(GIÁ RẺ)" → "hàng (GIÁ RẺ)"; rỗng → "chưa phân loại". */
function moTaPhanLoai(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return 'chưa phân loại';
  const stripped = raw.replace(/^hàng\s+/i, '');
  return `hàng ${stripped}`;
}

export function ThongKeHangLoiPanel({ onBack }: { onBack?: () => void }) {
  const [tuNgay, setTuNgay] = useState(() => firstDayOfMonth(todayLocalISO()));
  const [denNgay, setDenNgay] = useState(() => todayLocalISO());
  const [selectedNhom, setSelectedNhom] = useState<string[]>([...HANG_LOI_NHOM_OPTIONS]);
  const [records, setRecords] = useState<HangLoiKhachHangRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadRecords = useCallback(async () => {
    if (!parseDateStr(tuNgay) || !parseDateStr(denNgay)) {
      setLoadError('Vui lòng chọn Từ ngày và Đến ngày hợp lệ.');
      return;
    }
    if (tuNgay > denNgay) {
      setLoadError('Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.');
      return;
    }
    if (selectedNhom.length === 0) {
      setLoadError('Vui lòng chọn ít nhất một nhóm VTHH.');
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        nhom_vthh: selectedNhom.join(','),
        limit: '1000'
      });
      const res = await fetch(`/api/bao-cao-hang-loi-khach-hang?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể tải dữ liệu thống kê.');
      setRecords(normalizeHangLoiRecords(data));
    } catch (error: any) {
      setRecords([]);
      setLoadError(error.message || 'Không thể tải dữ liệu thống kê.');
    } finally {
      setIsLoading(false);
    }
  }, [tuNgay, denNgay, selectedNhom]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const toggleNhom = (nhom: string) => {
    setSelectedNhom(prev => (prev.includes(nhom) ? prev.filter(n => n !== nhom) : [...prev, nhom]));
  };

  const { rows, notes } = useMemo(() => buildHangLoiReport(records, selectedNhom), [records, selectedNhom]);

  /** Hàng hiển thị: dữ liệu đã gom + hàng 0 cho nhóm được chọn nhưng chưa phát sinh. */
  const displayRows = useMemo(() => {
    const out = [...rows];
    for (const nhom of selectedNhom) {
      if (!out.some(r => r.nhom_vthh === nhom)) {
        out.push({
          key: `${nhom}|||`,
          nhom_vthh: nhom,
          sp: shortNhomVthh(nhom),
          noi_dung: '',
          mb: 0,
          hcmMt: 0,
          congTy: 0,
          khac: 0
        });
      }
    }
    const orderOf = (nhom: string) => {
      const idx = HANG_LOI_NHOM_OPTIONS.indexOf(nhom as (typeof HANG_LOI_NHOM_OPTIONS)[number]);
      return idx === -1 ? 99 : idx;
    };
    return out.sort(
      (a, b) => orderOf(a.nhom_vthh) - orderOf(b.nhom_vthh) || a.noi_dung.localeCompare(b.noi_dung, 'vi')
    );
  }, [rows, selectedNhom]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {onBack && <BackButton onClick={onBack} />}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
            Thống kê hàng lỗi hỏng (Phát sinh ở khách hàng)
          </h2>
          <p className="text-xs font-semibold text-slate-500">
            Từ {formatDateVN(tuNgay)} đến {formatDateVN(denNgay)} — theo Nhóm VTHH.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <Printer className="h-4 w-4" />
          In báo cáo
        </button>
      </div>

      <TableToolbar>
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="w-44">
            <span className={labelClass}>Từ ngày</span>
            <VnCalendarPicker value={tuNgay} onChange={setTuNgay} />
          </div>
          <div className="w-44">
            <span className={labelClass}>Đến ngày</span>
            <VnCalendarPicker value={denNgay} onChange={setDenNgay} alignRight />
          </div>
          <div>
            <span className={labelClass}>Loại máy theo nhóm VTHH</span>
            <div className="flex flex-wrap gap-1.5">
              {HANG_LOI_NHOM_OPTIONS.map(nhom => {
                const active = selectedNhom.includes(nhom);
                return (
                  <button
                    key={nhom}
                    type="button"
                    onClick={() => toggleNhom(nhom)}
                    aria-pressed={active}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {shortNhomVthh(nhom)}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadRecords()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Xem
          </button>
        </div>
      </TableToolbar>

      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 print:hidden">
          {loadError}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-center">
          <caption className="border-b border-slate-300 py-2 text-base font-black text-slate-900">
            Phát Sinh Ở Khách Hàng
          </caption>
          <thead>
            <tr className="bg-[#d7e6a3] text-slate-900">
              <th rowSpan={2} className="w-28 border border-slate-400 px-2 py-2 text-sm font-black">
                SP
              </th>
              <th rowSpan={2} className="w-48 border border-slate-400 px-2 py-2 text-sm font-black">
                Nội Dung
              </th>
              <th colSpan={2} className="border border-slate-400 px-2 py-1 text-sm font-black">
                Tổng Số phát sinh
              </th>
              <th colSpan={2} className="border border-slate-400 px-2 py-1 text-sm font-black">
                Xử Lý
              </th>
            </tr>
            <tr className="bg-[#d7e6a3] text-slate-900">
              <th className="w-24 border border-slate-400 px-2 py-1 text-sm font-black">MB</th>
              <th className="w-24 border border-slate-400 px-2 py-1 text-sm font-black">HCM&amp;MT</th>
              <th className="w-28 border border-slate-400 px-2 py-1 text-sm font-black">Công Ty</th>
              <th className="w-28 border border-slate-400 px-2 py-1 text-sm font-black">Khác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="border border-slate-300 px-3 py-8 text-xs font-semibold text-slate-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                  Đang tải...
                </td>
              </tr>
            ) : (
              displayRows.map(row => (
                <tr key={row.key} className="text-slate-900">
                  <td className="border border-slate-400 px-2 py-2 font-serif text-lg font-black">{row.sp}</td>
                  <td className="border border-slate-400 px-2 py-2 text-left text-sm font-bold">
                    {row.noi_dung || ''}
                  </td>
                  <td className="border border-slate-400 px-2 py-2 text-lg font-black tabular-nums">{row.mb}</td>
                  <td className="border border-slate-400 px-2 py-2 text-lg font-black tabular-nums">{row.hcmMt}</td>
                  <td className="border border-slate-400 px-2 py-2 text-sm font-bold tabular-nums">
                    {row.congTy || ''}
                  </td>
                  <td className="border border-slate-400 px-2 py-2 text-sm font-bold tabular-nums">
                    {row.khac || ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-bold leading-relaxed">
        {notes.map(note => {
          if (note.total === 0) {
            return (
              <p key={note.nhom_vthh} className="text-[#1d6fd1]">
                - {note.sp} không có phát sinh
              </p>
            );
          }
          const byNoiDung = new Map<string, { total: number; items: typeof note.byContent }>();
          for (const entry of note.byContent) {
            const group = byNoiDung.get(entry.noi_dung) ?? { total: 0, items: [] };
            group.total += entry.count;
            group.items.push(entry);
            byNoiDung.set(entry.noi_dung, group);
          }
          return (
            <div key={note.nhom_vthh} className="space-y-0.5">
              {[...byNoiDung.entries()].map(([noiDung, group]) => (
                <React.Fragment key={noiDung}>
                  <p className="text-[#1d6fd1]">
                    - {note.sp} phát sinh lỗi khách hàng {group.total} phiếu {noiDung}
                  </p>
                  {group.items.map(entry => (
                    <p key={entry.phan_loai_hang} className="text-[#e01b1b]">
                      + {entry.count} phiếu {entry.noi_dung} {moTaPhanLoai(entry.phan_loai_hang)}
                    </p>
                  ))}
                </React.Fragment>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
