import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage } from '../_shared/recordHelpers';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { getProductionShiftOptions } from '../../utils/shiftSettings';
import {
  AddProductionOrderModal,
  formatProductionOrderProductsSummary,
  getProductionOrderProductLines,
  normalizeProductionOrders,
  ProductionOrderPrintSheet,
  ProductionOrderViewModal,
  useProductionOrderPrint,
  type ProductionOrderRow
} from '../ke-hoach-san-xuat';
import { Eye, Plus, Printer, Search } from 'lucide-react';

export function ProductionOrdersPanel({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<ProductionOrderRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [viewingRow, setViewingRow] = useState<ProductionOrderRow | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const { printingOrder, printingMaterials, printingProduct, printingProductCatalog, printingMachineLabel, shiftSettings, isLoadingPrint, printProductionOrder } = useProductionOrderPrint();

  const loadProductionOrders = async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const res = await fetch('/api/lenh-sx');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải lệnh sản xuất từ Supabase.');
      }

      setRows(normalizeProductionOrders(data));
    } catch (error: any) {
      setRows([]);
      setLoadError(error.message || 'Không thể tải lệnh sản xuất từ Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProductionOrders();
  }, []);

  const statusFilters = useMemo(() => {
    const statuses = rows
      .map(row => row.status)
      .filter((status): status is string => status !== '-' && status.length > 0);
    return ['all', ...[...new Set(statuses)].sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [rows]);

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const matchesStatus = selectedStatus === 'all' || row.status === selectedStatus;
      const matchesSearch =
        !normalizedSearch ||
        `${row.code} ${row.name} ${row.productCode} ${row.productName} ${formatProductionOrderProductsSummary(row)} ${row.customer} ${row.orderRef} ${row.machine} ${row.status} ${row.note}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [normalizedSearch, rows, selectedStatus]);

  const activeCount = rows.filter(row => /đang|cho|chờ|active|sx/i.test(row.status)).length;
  const totalQuantity = rows.reduce((sum, row) => {
    const value = Number(row.quantity);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="bg-white p-3 text-slate-700 border-b border-slate-200">
          <div className="flex items-start justify-end gap-3">
            <div className="hidden">
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Kế hoạch & điều phối</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Lệnh sản xuất</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase lenh_sx.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>

            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Lệnh SX', rows.length],
              ['Đang / chờ SX', activeCount],
              ['Tổng SL', formatNumber(totalQuantity)]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="block font-bold text-zinc-400">{label}</span>
                <span className="mt-1 block text-xl font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {statusFilters.map(status => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedStatus === status
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {status === 'all' ? 'Tất cả' : status}
            </button>
          ))}
          {isLoading && (
            <div className="flex h-11 shrink-0 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-500">
              Đang tải Supabase...
            </div>
          )}
        </div>

        <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 lg:mt-0 lg:w-[420px]">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Tìm mã lệnh, hàng, khách, đơn hàng..."
            disabled={isLoading}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {loadError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {loadError}
          </p>
        )}
      </section>

      <AddProductionOrderModal
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        onCreated={loadProductionOrders}
      />

      <ProductionOrderViewModal row={viewingRow} onClose={() => setViewingRow(null)} />

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1480px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã lệnh</th>
                <th className="px-4 py-3 font-black">Tên lệnh</th>
                <th className="px-4 py-3 font-black">Mã hàng</th>
                <th className="px-4 py-3 font-black">Tên hàng</th>
                <th className="px-4 py-3 font-black">SL</th>
                <th className="px-4 py-3 font-black">Đơn vị</th>
                <th className="w-32 min-w-32 whitespace-nowrap px-4 py-3 font-black">
                  Trạng thái
                </th>
                <th className="px-4 py-3 font-black">Khách hàng</th>
                <th className="px-4 py-3 font-black">Đơn hàng</th>
                <th className="px-4 py-3 font-black">Bắt đầu</th>
                <th className="px-4 py-3 font-black">Kết thúc</th>
                <th className="px-4 py-3 font-black">Máy</th>
                <th className="px-4 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRows.map(row => (
                <tr key={row.id} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{row.code || '-'}</td>
                  <td className="px-4 py-3 font-black text-zinc-950">{row.name || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">
                    {getProductionOrderProductLines(row)
                      .map(product => product.productCode || '-')
                      .join(' | ') || '-'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-800">
                    {getProductionOrderProductLines(row)
                      .map(product => product.productName || '-')
                      .join(' | ') || '-'}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">
                    {getProductionOrderProductLines(row)
                      .map(product => product.quantity || '-')
                      .join(' | ') || '-'}
                  </td>
                  <td className="px-4 py-3 font-bold text-zinc-700">
                    {getProductionOrderProductLines(row)
                      .map(product => product.unit || '-')
                      .join(' | ') || '-'}
                  </td>
                  <td className="w-32 min-w-32 whitespace-nowrap px-4 py-3">
                    <span className="inline-flex whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{row.customer}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{row.orderRef}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-zinc-600">{row.startDate}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-zinc-600">{row.endDate}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{row.machine}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewingRow(row)}
                        title="Xem chi tiết"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => printProductionOrder(row)}
                        disabled={isLoadingPrint}
                        title="In lệnh SX"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Bảng lenh_sx chưa có dữ liệu hoặc không có lệnh phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {printingOrder && (
        <ProductionOrderPrintSheet
          order={printingOrder}
          materials={printingMaterials}
          machineLabel={printingMachineLabel}
          product={printingProduct}
          productCatalog={printingProductCatalog}
          shiftSettings={shiftSettings}
        />
      )}
    </div>
  );
}

