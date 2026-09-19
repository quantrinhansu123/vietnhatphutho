import React from 'react';
import { buildNoteLines, fmtInt } from './aggregate';
import type { ChiPhiDienRow } from './types';

interface ChiPhiDienSheetProps {
  title?: string;
  rows: ChiPhiDienRow[];
  tongTienDien: number;
  tongThanhPham: number;
  tbDongKg: number;
  prevDongKg?: Record<string, number>;
  /** Nhãn mốc so sánh đầy đủ, vd "năm 2025" (rỗng = không có số liệu so sánh). */
  prevLabel?: string;
}

/** Bảng phiếu "CHI PHÍ TIỀN ĐIỆN" kiểu như mẫu giấy (header xanh lá + dòng đỏ diễn giải). */
export function ChiPhiDienSheet({
  title = 'CHI PHÍ TIỀN ĐIỆN',
  rows,
  tongTienDien,
  tongThanhPham,
  tbDongKg,
  prevDongKg = {},
  prevLabel = ''
}: ChiPhiDienSheetProps) {
  const notes = buildNoteLines(rows, prevDongKg, prevLabel);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <h3 className="px-3 py-2.5 text-center text-sm font-black uppercase tracking-wide text-slate-900">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#8bc34a] text-slate-900">
              <th className="border border-[#689f38] px-3 py-2 font-bold">Máy</th>
              <th className="border border-[#689f38] px-3 py-2 font-bold">Tiền Điện</th>
              <th className="border border-[#689f38] px-3 py-2 font-bold">Thành Phẩm</th>
              <th className="border border-[#689f38] px-3 py-2 font-bold">Đồng/Kg</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                  Chưa có loại máy nào được chọn.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.loai_may} className="hover:bg-slate-50/60">
                  <td className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-900">
                    {row.loai_may}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                    {fmtInt(row.tien_dien)}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                    {fmtInt(row.thanh_pham)}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                    {fmtInt(row.dong_kg)}
                  </td>
                </tr>
              ))
            )}
            <tr className="bg-white">
              <td colSpan={2} className="border border-slate-300 px-3 py-2 text-center font-black text-red-600">
                TB/SL
              </td>
              <td className="border border-slate-300 px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                {fmtInt(tongThanhPham)}
              </td>
              <td className="border border-slate-300 px-3 py-2 text-right font-black tabular-nums text-red-600">
                {fmtInt(tbDongKg)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {notes.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-200 px-3 py-3 text-[13px] font-semibold leading-relaxed text-red-600">
          {notes.map(note => {
            const diffText =
              note.diff === null || !note.prevLabel
                ? ''
                : note.diff > 0
                  ? ` tăng ${fmtInt(note.diff)}đ so với ${note.prevLabel}`
                  : note.diff < 0
                    ? ` giảm ${fmtInt(Math.abs(note.diff))}đ so với ${note.prevLabel}`
                    : ` không đổi so với ${note.prevLabel}`;
            return (
              <p key={note.loai}>
                - SP {note.loai} chi phí điện là {fmtInt(note.dongKg)}đ/kg{diffText}
                {note.ghiChu ? <span> ( {note.ghiChu} )</span> : null}
              </p>
            );
          })}
        </div>
      )}
      {/* Giữ tổng tiền điện hiển thị rõ khi cần đối chiếu (không có trong mẫu giấy). */}
      <p className="sr-only">Tổng tiền điện: {fmtInt(tongTienDien)}đ</p>
    </div>
  );
}

export default ChiPhiDienSheet;
