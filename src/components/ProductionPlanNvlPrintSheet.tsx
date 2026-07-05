import React from 'react';
import vietNhatLogoUrl from '../../logovietnhat_1.png';
import { formatNumber } from '../utils';

const PRINT_COMPANY_NAME = 'CÔNG TY VIỆT NHẬT – ĐÀ NẴNG';

export type ProductionPlanNvlPrintMaterial = {
  code: string;
  name: string;
  unit: string;
  totalQuantity: number;
};

export type ProductionPlanNvlPrintShiftGroup = {
  shift: string;
  orderCount: number;
  orderCodes: string[];
  lines: ProductionPlanNvlPrintMaterial[];
};

function formatPrintDate(iso: string) {
  if (!iso) return '-';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function formatPrintQuantity(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return formatNumber(value, 2);
}

export default function ProductionPlanNvlPrintSheet({
  planDate,
  planNote,
  shiftGroups
}: {
  planDate: string;
  planNote: string;
  shiftGroups: ProductionPlanNvlPrintShiftGroup[];
}) {
  const totalMaterialKinds = new Set(
    shiftGroups.flatMap(group => group.lines.map(line => `${line.code}__${line.unit}`))
  ).size;

  return (
    <div className="production-plan-nvl-print-sheet">
      <div className="production-plan-print-doc">
        <header className="production-plan-print-header">
          <div className="production-plan-print-brand">
            <img src={vietNhatLogoUrl} alt={PRINT_COMPANY_NAME} className="production-plan-print-logo" />
            <div className="production-plan-print-company">
              <p className="production-plan-print-company-name">{PRINT_COMPANY_NAME}</p>
            </div>
          </div>
          <div className="production-plan-print-title-wrap">
            <h1>PHIẾU TỔNG HỢP NVL KẾ HOẠCH SẢN XUẤT</h1>
          </div>
          <p className="production-plan-print-date">Ngày: {formatPrintDate(planDate)}</p>
        </header>

        <table className="production-plan-nvl-print-meta-table">
          <tbody>
            <tr>
              <th>Ngày kế hoạch</th>
              <td>{formatPrintDate(planDate)}</td>
              <th>Số ca</th>
              <td>{shiftGroups.length}</td>
            </tr>
            <tr>
              <th>Số lệnh SX</th>
              <td>{shiftGroups.reduce((sum, group) => sum + group.orderCount, 0)}</td>
              <th>Số mã NVL</th>
              <td>{totalMaterialKinds}</td>
            </tr>
            {planNote.trim() ? (
              <tr>
                <th>Ghi chú</th>
                <td colSpan={3}>{planNote.trim()}</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {shiftGroups.length === 0 ? (
          <p className="production-plan-nvl-print-empty">Chưa có NVL để in theo kế hoạch này.</p>
        ) : (
          shiftGroups.map(group => {
            const shiftTotal = group.lines.reduce((sum, line) => sum + line.totalQuantity, 0);

            return (
              <section key={group.shift} className="production-plan-nvl-print-shift-block">
                <h2 className="production-plan-nvl-print-shift-title">
                  Ca {group.shift}
                  <span>
                    · {group.orderCount} lệnh SX
                    {group.orderCodes.length > 0 ? ` · ${group.orderCodes.join(', ')}` : ''}
                  </span>
                </h2>

                <table className="production-plan-nvl-print-table">
                  <colgroup>
                    <col className="production-plan-nvl-print-col-stt" />
                    <col className="production-plan-nvl-print-col-code" />
                    <col className="production-plan-nvl-print-col-name" />
                    <col className="production-plan-nvl-print-col-unit" />
                    <col className="production-plan-nvl-print-col-qty" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Mã NVL</th>
                      <th>Tên NVL</th>
                      <th>ĐVT</th>
                      <th>Tổng định mức</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.lines.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="production-plan-print-center">
                          Ca này chưa có NVL.
                        </td>
                      </tr>
                    ) : (
                      group.lines.map((line, index) => (
                        <tr key={`${group.shift}-${line.code}-${line.unit}-${index}`}>
                          <td className="production-plan-print-center">{index + 1}</td>
                          <td className="production-plan-nvl-print-code">{line.code || '-'}</td>
                          <td>{line.name || line.code || '-'}</td>
                          <td className="production-plan-print-center">{line.unit || '-'}</td>
                          <td className="production-plan-nvl-print-qty">{formatPrintQuantity(line.totalQuantity)}</td>
                        </tr>
                      ))
                    )}
                    {group.lines.length > 0 ? (
                      <tr className="production-plan-nvl-print-total-row">
                        <td colSpan={4} className="production-plan-nvl-print-qty">
                          Tổng cộng ca {group.shift}
                        </td>
                        <td className="production-plan-nvl-print-qty">{formatPrintQuantity(shiftTotal)}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>
            );
          })
        )}

        <div className="production-plan-print-signatures">
          <div>
            <p>Người lập phiếu</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Thủ kho / Người nhận</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
