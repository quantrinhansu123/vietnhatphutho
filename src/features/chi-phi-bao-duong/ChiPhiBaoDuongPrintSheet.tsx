import React from 'react';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from '../../components/layout/constants';
import type { ChiPhiBaoDuongRecord } from './types';

interface ChiPhiBaoDuongPrintSheetProps {
  thang: number;
  nam: number;
  rows: ChiPhiBaoDuongRecord[];
  prevRows?: ChiPhiBaoDuongRecord[];
  prevThang?: number;
  prevNam?: number;
}

function money(n: number): string {
  return (Number(n) || 0).toLocaleString('vi-VN');
}

function NoteLines({ text }: { text: string }) {
  const lines = String(text || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return <span>-</span>;
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line.startsWith('-') ? line : `- ${line}`}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  );
}

/** Tờ in tổng hợp tháng — dùng chung CSS in dot-san-xuat của repo. */
export function ChiPhiBaoDuongPrintSheet({
  thang,
  nam,
  rows,
  prevRows = [],
  prevThang,
  prevNam
}: ChiPhiBaoDuongPrintSheetProps) {
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
  const printDate = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="dot-san-xuat-print-sheet">
      <div className="dot-san-xuat-print-doc">
        <div className="dot-san-xuat-print-header">
          <div className="dot-san-xuat-print-brand">
            <img src={vietNhatLogoUrl} alt="Việt Nhật" className="dot-san-xuat-print-logo" />
            <div>
              <p className="dot-san-xuat-print-company-name">{PRINT_COMPANY_NAME}</p>
              <p className="dot-san-xuat-print-project-name">Nhà máy — QC: Chi phí bảo dưỡng</p>
            </div>
          </div>
          <h1 className="dot-san-xuat-print-title">
            CHI PHÍ SỬA CHỮA, BẢO DƯỠNG &amp; VẬT TƯ SỬ DỤNG THÁNG {thang}/{nam}
          </h1>
          <div className="dot-san-xuat-print-meta">
            <p>
              <strong>Tháng tổng hợp:</strong> Tháng {thang}/{nam}
            </p>
            <p>
              <strong>Số máy:</strong> {sorted.length} máy
            </p>
            <p>
              <strong>Ngày in:</strong> {printDate}
            </p>
          </div>
        </div>

        <table className="dot-san-xuat-print-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '13%' }}>
                Máy
              </th>
              <th colSpan={2}>Chi phí sửa chữa</th>
              <th colSpan={2}>Vật tư sử dụng</th>
            </tr>
            <tr>
              <th style={{ width: '13%' }}>Chi phí</th>
              <th>Ghi chú</th>
              <th style={{ width: '13%' }}>Chi phí</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="dot-san-xuat-print-center">
                  Tháng {thang}/{nam} chưa có dữ liệu.
                </td>
              </tr>
            ) : (
              sorted.map(r => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.ten_may || r.ma_may}</strong>
                  </td>
                  <td className="dot-san-xuat-print-right">
                    <strong>
                      {Number(r.chi_phi_sua_chua) > 0 ? money(Number(r.chi_phi_sua_chua)) : '-'}
                    </strong>
                  </td>
                  <td>
                    <NoteLines text={r.sua_chua_ghi_chu} />
                  </td>
                  <td className="dot-san-xuat-print-right">
                    <strong>
                      {Number(r.chi_phi_vat_tu) > 0 ? money(Number(r.chi_phi_vat_tu)) : '-'}
                    </strong>
                  </td>
                  <td>
                    <NoteLines text={r.vat_tu_ghi_chu} />
                  </td>
                </tr>
              ))
            )}
            <tr className="dot-san-xuat-print-total">
              <td>
                Tổng T{thang}/{nam}
              </td>
              <td className="dot-san-xuat-print-right">{money(totalSua)}</td>
              <td />
              <td className="dot-san-xuat-print-right">{money(totalVatTu)}</td>
              <td />
            </tr>
            {prevThang && prevNam ? (
              <tr className="dot-san-xuat-print-highlight">
                <td>
                  Tổng T{prevThang}/{prevNam}
                </td>
                <td className="dot-san-xuat-print-right">{money(prevSua)}</td>
                <td />
                <td className="dot-san-xuat-print-right">{money(prevVatTu)}</td>
                <td />
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="dot-san-xuat-print-signatures">
          <div>
            <p>Người lập</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Quản đốc</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Kế toán</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Giám đốc</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChiPhiBaoDuongPrintSheet;
