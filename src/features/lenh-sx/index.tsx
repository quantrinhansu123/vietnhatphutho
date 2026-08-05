import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage } from '../_shared/recordHelpers';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { getProductionShiftOptions } from '../../utils/shiftSettings';
import {
  FilterCombobox,
  MultiSelectFilter,
  TableToolbar,
  TableSearchInput,
  TableDateFilter,
  TableShell,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableEmptyRow,
  StatusBadge
} from '../../components/shared/table';
import {
  AddProductionOrderModal,
  EditProductionOrderModal,
  formatProductionOrderDate,
  formatProductionOrderProductsSummary,
  getProductionOrderProductLines,
  normalizeProductionOrders,
  PRODUCTION_ORDER_STATUS_OPTIONS,
  ProductionOrderPrintSheet,
  ProductionOrderViewModal,
  useProductionOrderPrint,
  type ProductionOrderRow
} from '../ke-hoach-san-xuat';
import { normalizeOrders } from '../don-hang';
import { normalizeProducts } from '../san-pham';
import type { ProductRow } from '../san-pham/types';
import { normalizeMachines, type MachineRow } from '../danh-sach-may';
import type { OrderRow } from '../_shared/orderRecordHelpers';
import { useTabAccess } from '../../app/useTabAccess';
import {
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Trash2
} from 'lucide-react';

export function ProductionOrdersPanel({
  onBack,
  canCreate: canCreateOverride,
  canEdit: canEditOverride,
  canDelete: canDeleteOverride
}: {
  onBack: () => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const tabAccess = useTabAccess('production-orders');
  const canCreate = canCreateOverride ?? tabAccess.canCreate;
  const canEdit = canEditOverride ?? tabAccess.canEdit;
  const canDelete = canDeleteOverride ?? tabAccess.canDelete;
  const [rows, setRows] = useState<ProductionOrderRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [viewingRow, setViewingRow] = useState<ProductionOrderRow | null>(null);
  const [editingRow, setEditingRow] = useState<ProductionOrderRow | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductRow[]>([]);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionMenu, setActionMenu] = useState<{
    row: ProductionOrderRow;
    x: number;
    y: number;
  } | null>(null);
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

  const openEditModal = async (row: ProductionOrderRow) => {
    if (!canEdit) return;
    setIsLoadingEdit(true);
    setActionMessage('');
    try {
      const [orderRes, productRes, machineRes] = await Promise.all([
        fetch('/api/don-hang'),
        fetch('/api/san-pham?format=table'),
        fetch('/api/danh-sach-may')
      ]);
      const [orderData, productData, machineData] = await Promise.all([
        orderRes.json().catch(() => ({})),
        productRes.json().catch(() => ({})),
        machineRes.json().catch(() => ({}))
      ]);
      if (!orderRes.ok || !productRes.ok || !machineRes.ok) {
        throw new Error('Không thể tải dữ liệu để sửa lệnh sản xuất.');
      }
      setOrders(normalizeOrders(orderData));
      setCatalogProducts(normalizeProducts(productData));
      setMachines(normalizeMachines(machineData));
      setEditingRow(row);
    } catch (error: any) {
      setActionMessage(error.message || 'Không thể mở form sửa lệnh sản xuất.');
    } finally {
      setIsLoadingEdit(false);
    }
  };

  const deleteProductionOrder = async (row: ProductionOrderRow) => {
    if (!window.confirm(`Bạn có chắc muốn xóa lệnh sản xuất ${row.code || row.name}?`)) return;

    setDeletingId(row.id);
    setActionMessage('');
    try {
      const res = await fetch(`/api/lenh-sx/${row.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa lệnh sản xuất.');
      await loadProductionOrders();
      setActionMessage(data.warning || 'Đã xóa lệnh sản xuất.');
    } catch (error: any) {
      setActionMessage(error.message || 'Không thể xóa lệnh sản xuất.');
    } finally {
      setDeletingId(null);
    }
  };

  const machineFilters = useMemo(() => {
    const machines = rows
      .map(row => row.machine)
      .filter((machine): machine is string => Boolean(machine) && machine !== '-');
    return [...new Set(machines)].sort((a, b) => String(a).localeCompare(String(b), 'vi'));
  }, [rows]);

  // Định dạng dd/mm/yyyy hiển thị trên bảng -> mốc thời gian để so sánh khoảng ngày.
  const parseDisplayDate = (value: string): number | null => {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    const time = new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    return Number.isFinite(time) ? time : null;
  };

  const hasActiveFilters =
    selectedStatus !== 'all' || selectedMachines.length > 0 || Boolean(dateFrom) || Boolean(dateTo) || Boolean(searchText);

  const resetFilters = () => {
    setSelectedStatus('all');
    setSelectedMachines([]);
    setDateFrom('');
    setDateTo('');
    setSearchText('');
  };

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTime = dateTo ? new Date(dateTo).getTime() : null;

    return rows
      .filter(row => {
        const matchesStatus = selectedStatus === 'all' || row.status === selectedStatus;
        const matchesMachine = selectedMachines.length === 0 || selectedMachines.includes(row.machine);
        const rowStartTime = parseDisplayDate(row.startDate);
        const matchesFrom = !fromTime || (rowStartTime !== null && rowStartTime >= fromTime);
        const matchesTo = !toTime || (rowStartTime !== null && rowStartTime <= toTime);
        const matchesSearch =
          !normalizedSearch ||
          `${row.code} ${row.name} ${row.productCode} ${row.productName} ${formatProductionOrderProductsSummary(row)} ${row.customer} ${row.orderRef} ${row.machine} ${row.status} ${row.note}`
            .toLowerCase()
            .includes(normalizedSearch);
        return matchesStatus && matchesMachine && matchesFrom && matchesTo && matchesSearch;
      })
      // Bản ghi tạo mới nhất đứng trước; dữ liệu không có created_at được đặt sau cùng.
      .sort((left, right) => {
        const leftTime = Date.parse(left.createdAt);
        const rightTime = Date.parse(right.createdAt);
        const leftValid = Number.isFinite(leftTime);
        const rightValid = Number.isFinite(rightTime);
        if (leftValid && rightValid) {
          return sortOrder === 'newest' ? rightTime - leftTime : leftTime - rightTime;
        }
        if (leftValid) return -1;
        if (rightValid) return 1;
        return left.id.localeCompare(right.id, 'vi');
      });
  }, [normalizedSearch, rows, selectedStatus, selectedMachines, dateFrom, dateTo, sortOrder]);

  const activeCount = rows.filter(row => /đang|cho|chờ|active|sx/i.test(row.status)).length;
  const totalQuantity = rows.reduce((sum, row) => {
    const value = Number(row.quantity);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  const dateGroups = useMemo(() => {
    const map = new Map<string, ProductionOrderRow[]>();
    filteredRows.forEach(row => {
      const date = formatProductionOrderDate(row.createdAt) || 'Chưa có ngày';
      const list = map.get(date) ?? [];
      list.push(row);
      map.set(date, list);
    });
    return [...map.entries()].map(([date, groupRows]) => ({
      date,
      rows: groupRows,
      totalQuantity: groupRows.reduce((sum, row) => {
        const value = Number(row.quantity);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0)
    }));
  }, [filteredRows]);

  return (
    <div className="mx-auto w-full max-w-none space-y-4">
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
              {canCreate ? (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
                >
                  <Plus className="h-4 w-4" />
                  Thêm mới
                </button>
              ) : null}

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

      <TableToolbar
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
        loadError={loadError}
        actionMessage={actionMessage}
      >
        <TableSearchInput
          value={searchText}
          onChange={setSearchText}
          placeholder="Tìm mã lệnh, hàng, khách, đơn hàng..."
          disabled={isLoading}
        />

        <FilterCombobox
          label="Trạng thái"
          options={PRODUCTION_ORDER_STATUS_OPTIONS}
          value={selectedStatus}
          onChange={setSelectedStatus}
          searchPlaceholder="Tìm trạng thái..."
          compact
        />

        <MultiSelectFilter
          label="Máy"
          allLabel="Tất cả máy"
          searchPlaceholder="Tìm máy..."
          emptyLabel="Không tìm thấy máy"
          options={machineFilters}
          values={selectedMachines}
          onChange={setSelectedMachines}
        />

        <TableDateFilter label="Từ ngày" value={dateFrom} onChange={setDateFrom} />
        <TableDateFilter label="Đến ngày" value={dateTo} onChange={setDateTo} />

        <FilterCombobox
          label="Sắp xếp"
          options={['newest', 'oldest']}
          value={sortOrder}
          onChange={value => setSortOrder(value as 'newest' | 'oldest')}
          searchPlaceholder="Tìm kiểu sắp xếp..."
          includeAll={false}
          compact
          searchable={false}
          alignDropdown="right"
          dropdownWidth="w-full"
          formatOption={value => (value === 'newest' ? 'Mới nhất' : 'Cũ nhất')}
        />
      </TableToolbar>

      <AddProductionOrderModal
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        onCreated={loadProductionOrders}
      />

      <ProductionOrderViewModal row={viewingRow} onClose={() => setViewingRow(null)} />

      <EditProductionOrderModal
        open={Boolean(editingRow)}
        row={editingRow}
        orders={orders}
        productionOrders={rows}
        catalogProducts={catalogProducts}
        machines={machines}
        onClose={() => setEditingRow(null)}
        onSaved={loadProductionOrders}
      />

      {!isLoading && dateGroups.length === 0 ? (
        <TableShell minWidthClassName="min-w-0">
          <TableBody>
            <TableEmptyRow colSpan={11}>
              Bảng lenh_sx chưa có dữ liệu hoặc không có lệnh phù hợp bộ lọc.
            </TableEmptyRow>
          </TableBody>
        </TableShell>
      ) : (
        <div className="space-y-3">
          {dateGroups.map(group => (
            <div key={group.date} className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-100/90 px-3 py-2 sm:px-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Ngày</span>
                  <span className="font-mono text-sm font-black text-zinc-900">{group.date}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-500 ring-1 ring-zinc-200">
                    {group.rows.length} lệnh
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Tổng SL ngày</p>
                  <p className="font-mono text-sm font-black text-emerald-800">{formatNumber(group.totalQuantity)}</p>
                </div>
              </div>
              <div className="hover-scrollbar max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-sm">
                  <colgroup>
                    <col className="w-[6%]" /><col className="w-[5%]" /><col className="w-[9%]" />
                    <col className="w-[32%]" /><col className="w-[9%]" /><col className="w-[6%]" />
                    <col className="w-[7%]" /><col className="w-[9%]" /><col className="w-[5%]" />
                    <col className="w-[7%]" /><col className="w-[5%]" />
                  </colgroup>
                  <TableHead>
                    <TableHeadCell>Mã lệnh</TableHeadCell>
                    <TableHeadCell>Ca</TableHeadCell>
                    <TableHeadCell>Mã hàng</TableHeadCell>
                    <TableHeadCell>Tên hàng</TableHeadCell>
                    <TableHeadCell className="w-32 min-w-32 whitespace-nowrap">Trạng thái</TableHeadCell>
                    <TableHeadCell>Khách hàng</TableHeadCell>
                    <TableHeadCell>Đơn hàng</TableHeadCell>
                    <TableHeadCell>Bắt đầu</TableHeadCell>
                    <TableHeadCell>Kết thúc</TableHeadCell>
                    <TableHeadCell>Máy</TableHeadCell>
                    <TableHeadCell align="center">Thao tác</TableHeadCell>
                  </TableHead>
                  <TableBody>
                    {group.rows.map(row => (
                      <React.Fragment key={row.id}>
                      <TableRow>
                        <td className="px-4 py-3 font-black text-zinc-950">{row.code || '-'}</td>
                        <td className="px-4 py-3 text-zinc-700">{row.shift || '-'}</td>
                        <td className="px-4 py-3 text-zinc-700">
                          {getProductionOrderProductLines(row)
                            .map(product => product.productCode || '-')
                            .join(' | ') || '-'}
                        </td>
                        <td className="px-4 py-3 text-zinc-800">
                          {getProductionOrderProductLines(row)
                            .map(product => product.productName || '-')
                            .join(' | ') || '-'}
                        </td>
                        <td className="w-32 min-w-32 whitespace-nowrap px-4 py-3">
                          <StatusBadge label={row.status} color="amber" />
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{row.customer}</td>
                        <td className="px-4 py-3 text-zinc-600">{row.orderRef}</td>
                        <td className="px-4 py-3 text-zinc-600">{row.startDate}</td>
                        <td className="px-4 py-3 text-zinc-600">{row.endDate}</td>
                        <td className="px-4 py-3 text-zinc-600">{row.machine}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              setActionMenu(current => current?.row.id === row.id
                                ? null
                                : { row, x: rect.right, y: rect.bottom });
                            }}
                            title="Thao tác"
                            aria-label={`Thao tác cho ${row.code || 'lệnh sản xuất'}`}
                            aria-expanded={actionMenu?.row.id === row.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {actionMenu && createPortal(
        <div
          className="fixed z-50 w-44 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl"
          style={{ left: Math.max(8, actionMenu.x - 176), top: actionMenu.y + 6 }}
          role="menu"
        >
          <button type="button" role="menuitem" onClick={() => { setViewingRow(actionMenu.row); setActionMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
            <Eye className="h-4 w-4" /> Xem chi tiết
          </button>
          <button type="button" role="menuitem" onClick={() => { printProductionOrder(actionMenu.row); setActionMenu(null); }} disabled={isLoadingPrint} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Printer className="h-4 w-4" /> In lệnh SX
          </button>
          {canEdit && <button type="button" role="menuitem" onClick={() => { openEditModal(actionMenu.row); setActionMenu(null); }} disabled={isLoadingEdit} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Pencil className="h-4 w-4" /> Sửa lệnh SX
          </button>}
          {canDelete && <button type="button" role="menuitem" onClick={() => { deleteProductionOrder(actionMenu.row); setActionMenu(null); }} disabled={deletingId === actionMenu.row.id} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Xóa lệnh SX
          </button>}
        </div>,
        document.body
      )}

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
