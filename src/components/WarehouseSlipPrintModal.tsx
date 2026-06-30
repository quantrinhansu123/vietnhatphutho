import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer, X } from 'lucide-react';
import vietNhatLogoUrl from '../../logovietnhat_1.png';
import { formatMoney, formatNumber } from '../utils';

const PRINT_COMPANY_NAME = 'CÔNG TY TNHH VIỆT NHẬT IPT';

export type WarehouseSlipPrintLine = {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
};

export type WarehouseSlipPrintData = {
  slipCode: string;
  slipType: 'nhap' | 'xuat';
  warehouseKind: 'nvl' | 'san_pham';
  slipDate: string;
  reason: string;
  note: string;
  createdBy: string;
  totalAmount: number;
  lines: WarehouseSlipPrintLine[];
};

function slipTypeTitle(data: WarehouseSlipPrintData) {
  const action = data.slipType === 'nhap' ? 'NHẬP KHO' : 'XUẤT KHO';
  const warehouse = data.warehouseKind === 'san_pham' ? 'SẢN PHẨM' : 'NVL';
  return `PHIẾU ${action} ${warehouse}`;
}

function codeColumnLabel(kind: WarehouseSlipPrintData['warehouseKind']) {
  return kind === 'san_pham' ? 'Mã SP' : 'Mã NPL';
}

function nameColumnLabel(kind: WarehouseSlipPrintData['warehouseKind']) {
  return kind === 'san_pham' ? 'Tên SP' : 'Tên NVL';
}

function formatSlipDate(value: string) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function WarehouseSlipPrintSheet({ data }: { data: WarehouseSlipPrintData }) {
  const printDate = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="warehouse-slip-print-sheet">
      <div className="warehouse-slip-print-doc">
        <header className="warehouse-slip-print-header">
          <div className="warehouse-slip-print-brand">
            <img src={vietNhatLogoUrl} alt={PRINT_COMPANY_NAME} className="warehouse-slip-print-logo" />
            <div className="warehouse-slip-print-company">
              <p className="warehouse-slip-print-company-name">{PRINT_COMPANY_NAME}</p>
              <p className="warehouse-slip-print-company-branch">Chi nhánh Đà Nẵng</p>
            </div>
          </div>
          <h1 className="warehouse-slip-print-title">{slipTypeTitle(data)}</h1>
        </header>

        <div className="warehouse-slip-print-meta">
          <p>
            <strong>Số phiếu:</strong> {data.slipCode || '-'}
          </p>
          <p>
            <strong>Ngày phiếu:</strong> {formatSlipDate(data.slipDate)}
          </p>
          <p>
            <strong>Người lập:</strong> {data.createdBy || '-'}
          </p>
          <p>
            <strong>Lý do:</strong> {data.reason || '-'}
          </p>
          {data.note ? (
            <p>
              <strong>Ghi chú:</strong> {data.note}
            </p>
          ) : null}
          <p>
            <strong>Ngày in:</strong> {printDate}
          </p>
        </div>

        <table className="warehouse-slip-print-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>{codeColumnLabel(data.warehouseKind)}</th>
              <th>{nameColumnLabel(data.warehouseKind)}</th>
              <th>ĐVT</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line, index) => (
              <tr key={`${line.code}-${index}`}>
                <td className="warehouse-slip-print-center">{index + 1}</td>
                <td>{line.code || '-'}</td>
                <td>{line.name || '-'}</td>
                <td className="warehouse-slip-print-center">{line.unit || '-'}</td>
                <td className="warehouse-slip-print-right">{formatNumber(line.quantity, 2)}</td>
                <td className="warehouse-slip-print-right">{formatMoney(line.unitPrice, 0)} đ</td>
                <td className="warehouse-slip-print-right">{formatMoney(line.lineAmount, 0)} đ</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} className="warehouse-slip-print-total-label">
                Tổng cộng
              </td>
              <td className="warehouse-slip-print-right warehouse-slip-print-total-value">
                {formatMoney(data.totalAmount, 0)} đ
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="warehouse-slip-print-signatures">
          <div>
            <p>Người lập phiếu</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Thủ kho</p>
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

export default function WarehouseSlipPrintModal({
  open,
  data,
  autoPrint = false,
  onClose
}: {
  open: boolean;
  data: WarehouseSlipPrintData | null;
  autoPrint?: boolean;
  onClose: () => void;
}) {
  const [pendingPrint, setPendingPrint] = useState(false);

  useEffect(() => {
    if (!open) setPendingPrint(false);
  }, [open]);

  useEffect(() => {
    if (!open || !autoPrint || !data) return;
    setPendingPrint(true);
  }, [open, autoPrint, data]);

  useEffect(() => {
    if (!pendingPrint || !data) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPendingPrint(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [pendingPrint, data]);

  if (!open || !data) {
    return pendingPrint && data
      ? createPortal(
          <div className="warehouse-slip-print-batch">
            <WarehouseSlipPrintSheet data={data} />
          </div>,
          document.body
        )
      : null;
  }

  return (
    <>
      {pendingPrint &&
        createPortal(
          <div className="warehouse-slip-print-batch">
            <WarehouseSlipPrintSheet data={data} />
          </div>,
          document.body
        )}

    <div className="warehouse-slip-print-modal fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="warehouse-slip-print-modal-chrome flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
          <div>
            <h3 className="text-lg font-black text-zinc-950">Mẫu in phiếu xuất nhập kho</h3>
            <p className="mt-1 text-sm font-medium text-zinc-500">
              {data.slipCode} · {slipTypeTitle(data)}
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

        <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-100 px-4 py-4 sm:px-5">
          <div className="warehouse-slip-print-preview mx-auto max-w-[210mm] rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <WarehouseSlipPrintSheet data={data} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-4 py-4 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => setPendingPrint(true)}
            disabled={pendingPrint}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-sm font-extrabold text-white transition hover:bg-[#b30d1c] disabled:opacity-60"
          >
            {pendingPrint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            In phiếu
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
