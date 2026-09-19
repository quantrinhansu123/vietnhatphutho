import React from 'react';
import type { ChiPhiBaoDuongRecord } from './types';
import { fmtMoney } from './types';

export interface SheetCompareRow {
  label: string;
  sua: number;
  vat: number;
  tone: 'red' | 'lime' | 'blue' | 'slate';
}

interface ChiPhiBaoDuongSheetProps {
  thang: number;
  nam: number;
  rows: ChiPhiBaoDuongRecord[];
  prevRows?: ChiPhiBaoDuongRecord[];
  prevThang?: number;
  prevNam?: number;
  /** Các dòng so sánh bổ sung (cùng kỳ năm trước, lũy kế năm...). */
  compareRows?: SheetCompareRow[];
}

function renderNote(text: string): React.ReactNode {
  const lines = String(text || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return <span className="text-slate-300">-</span>;
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => (
        <div key={i} className="leading-snug">
          {line.startsWith('-') ? line : `- ${line}`}
        </div>
      ))}
    </div>
  );
}

const TONE_CLASS: Record<SheetCompareRow['tone'], string> = {
  red: 'bg-red-50/60 font-bold text-red-700',
  lime: 'bg-lime-200/70 font-bold text-slate-900',
  blue: 'bg-sky-100/70 font-bold text-sky-900',
  slate: 'bg-slate-100 font-bold text-slate-700'
};

export function ChiPhiBaoDuongSheet({
  thang,
  nam,
  rows,
  prevRows = [],
  prevThang,
  prevNam,
  compareRows = []
}: ChiPhiBaoDuongSheetProps) {
  const sorted = [...rows].sort((a, b) => {
    const aExtra = a.ma_may === 'CHUNG_CTY' ? 1 : 0;
    const bExtra = b.ma_may === 'CHUNG_CTY' ? 1 : 0;
    if (aExtra !== bExtra) return aExtra - bExtra;
    return String(a.ten_may || a.ma_may).localeCompare(String(b.ten_may || b.ma_may), 'vi');
  });
  const totalSua = sorted.reduce((s, r) => s + (Number(r.chi_phi_sua_chua) || 0), 0);
  const totalVatTu = sorted.reduce((s, r) => s + (Number(r.chi_phi_vat_tu) || 0), 0);
  const prevSua = prevRows.reduce((s, r) => s + (Number(r.chi_phi_sua_chua) || 0), 0);
  const prevVatTu = prevRows.reduce((s, r) => s + (Number(r.chi_phi_vat_tu) || 0), 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-300 bg-slate-50 px-4 py-3 text-center">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-slate-900">
          Chi phí sửa chữa, bảo dưỡng &amp; vật tư sử dụng Tháng {thang}/{nam}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs text-slate-700">
          <thead>
            <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-800">
              <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left">
                Máy
              </th>
              <th colSpan={2} className="border border-slate-300 px-3 py-2 text-center">
                Chi Phí Sửa Chữa
              </th>
              <th colSpan={2} className="border border-slate-300 px-3 py-2 text-center">
                Vật Tư Sử Dụng
              </th>
            </tr>
            <tr className="bg-slate-50 text-[11px] font-bold text-slate-700">
              <th className="border border-slate-300 px-3 py-1.5 text-right">Chi Phí</th>
              <th className="border border-slate-300 px-3 py-1.5 text-left">Ghi Chú</th>
              <th className="border border-slate-300 px-3 py-1.5 text-right">Chi Phí</th>
              <th className="border border-slate-300 px-3 py-1.5 text-left">Ghi Chú</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-slate-200 px-3 py-6 text-center text-slate-400">
                  Tháng {thang}/{nam} chưa có dữ liệu. Bấm “Thêm mới” để nhập từng máy.
                </td>
              </tr>
            ) : (
              sorted.map(r => (
                <tr key={r.id} className="align-top transition hover:bg-slate-50/70">
                  <td className="border border-slate-200 px-3 py-2 font-bold text-slate-900">
                    {r.ten_may || r.ma_may}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right font-bold">
                    {Number(r.chi_phi_sua_chua) > 0 ? fmtMoney(Number(r.chi_phi_sua_chua)) : '-'}
                  </td>
                  <td className="border border-slate-200 px-3 py-2">{renderNote(r.sua_chua_ghi_chu)}</td>
                  <td className="border border-slate-200 px-3 py-2 text-right font-bold">
                    {Number(r.chi_phi_vat_tu) > 0 ? fmtMoney(Number(r.chi_phi_vat_tu)) : '-'}
                  </td>
                  <td className="border border-slate-200 px-3 py-2">{renderNote(r.vat_tu_ghi_chu)}</td>
                </tr>
              ))
            )}
            <tr className="bg-red-50/60 font-bold text-red-700">
              <td className="border border-slate-300 px-3 py-2">Tổng T{thang}/{nam}</td>
              <td className="border border-slate-300 px-3 py-2 text-right">{fmtMoney(totalSua)}</td>
              <td className="border border-slate-300 px-3 py-2" />
              <td className="border border-slate-300 px-3 py-2 text-right">{fmtMoney(totalVatTu)}</td>
              <td className="border border-slate-300 px-3 py-2" />
            </tr>
            {prevThang && prevNam ? (
              <tr className="bg-lime-200/70 font-bold text-slate-900">
                <td className="border border-slate-300 px-3 py-2">
                  Tổng T{prevThang}/{prevNam}
                </td>
                <td className="border border-slate-300 px-3 py-2 text-right">{fmtMoney(prevSua)}</td>
                <td className="border border-slate-300 px-3 py-2" />
                <td className="border border-slate-300 px-3 py-2 text-right">{fmtMoney(prevVatTu)}</td>
                <td className="border border-slate-300 px-3 py-2" />
              </tr>
            ) : null}
            {compareRows.map(row => (
              <tr key={row.label} className={TONE_CLASS[row.tone]}>
                <td className="border border-slate-300 px-3 py-2">{row.label}</td>
                <td className="border border-slate-300 px-3 py-2 text-right">{fmtMoney(row.sua)}</td>
                <td className="border border-slate-300 px-3 py-2" />
                <td className="border border-slate-300 px-3 py-2 text-right">{fmtMoney(row.vat)}</td>
                <td className="border border-slate-300 px-3 py-2" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ChiPhiBaoDuongSheet;
