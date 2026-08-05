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
import { useAccessControl } from '../../app/accessControl';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2
} from 'lucide-react';

function FilterCombobox({
  label,
  options,
  value,
  onChange,
  searchPlaceholder = 'Tìm kiếm...',
  includeAll = true,
  compact = false,
  formatOption = (option: string) => option,
  searchable = true,
  alignDropdown = 'left',
  dropdownWidth = 'w-64'
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  searchPlaceholder?: string;
  includeAll?: boolean;
  /** Chỉ hiển thị giá trị đang chọn trong ô, không thêm nhãn phía trước. */
  compact?: boolean;
  formatOption?: (option: string) => string;
  searchable?: boolean;
  alignDropdown?: 'left' | 'right';
  dropdownWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter(option => option.toLowerCase().includes(normalizedQuery))
    : options;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
          value !== 'all'
            ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
        }`}
      >
        <span className="whitespace-nowrap">
          {value === 'all' ? label : compact ? formatOption(value) : `${label}: ${formatOption(value)}`}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-[calc(100%+6px)] z-20 ${dropdownWidth} rounded-xl border border-zinc-200 bg-white p-2 shadow-lg ${
          alignDropdown === 'right' ? 'right-0' : 'left-0'
        }`}>
          {searchable && (
            <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5">
              <Search className="h-4 w-4 shrink-0 text-zinc-400" />
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
            </label>
          )}

          <div className={`${searchable ? 'mt-2' : ''} max-h-60 overflow-y-auto`}>
            {includeAll && <button
              type="button"
              onClick={() => {
                onChange('all');
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-red-50 ${
                value === 'all' ? 'font-black text-[#ef1b2d]' : 'font-semibold text-zinc-700'
              }`}
            >
              Tất cả
            </button>}
            {filteredOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`block w-full rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-red-50 ${
                  value === option ? 'font-black text-[#ef1b2d]' : 'font-semibold text-zinc-700'
                }`}
              >
                {formatOption(option)}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-2.5 py-2 text-sm font-medium text-zinc-400">Không tìm thấy kết quả</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MachineMultiFilter({
  options,
  values,
  onChange
}: {
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter(option => option.toLowerCase().includes(normalizedQuery))
    : options;
  const triggerLabel = values.length === 0 ? 'Máy' : values.length === 1 ? values[0] : `${values.length} máy`;

  const toggleMachine = (machine: string) => {
    onChange(values.includes(machine) ? values.filter(item => item !== machine) : [...values, machine]);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
          values.length > 0
            ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
        }`}
      >
        <span className="max-w-40 truncate whitespace-nowrap">{triggerLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-72 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Tìm máy..."
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
          </label>

          <div className="mt-2 max-h-64 overflow-y-auto">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-zinc-700 hover:bg-red-50">
              <input
                type="checkbox"
                checked={values.length === 0}
                onChange={() => onChange([])}
                className="h-4 w-4 accent-[#ef1b2d]"
              />
              Tất cả máy
            </label>
            {filteredOptions.map(machine => (
              <label
                key={machine}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-zinc-700 hover:bg-red-50"
              >
                <input
                  type="checkbox"
                  checked={values.includes(machine)}
                  onChange={() => toggleMachine(machine)}
                  className="h-4 w-4 accent-[#ef1b2d]"
                />
                <span className="min-w-0 flex-1 truncate">{machine}</span>
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-2.5 py-2 text-sm font-medium text-zinc-400">Không tìm thấy máy</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProductionOrdersPanel({
  onBack,
  canEdit: canEditOverride,
  canDelete: canDeleteOverride
}: {
  onBack: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const access = useAccessControl();
  const canEdit = canEditOverride ?? access.canEdit('production-orders');
  const canDelete = canDeleteOverride ?? access.canDelete('production-orders');
  const [rows, setRows] = useState<ProductionOrderRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredRows, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [normalizedSearch, selectedStatus, selectedMachines, dateFrom, dateTo, sortOrder, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const activeCount = rows.filter(row => /đang|cho|chờ|active|sx/i.test(row.status)).length;
  const totalQuantity = rows.reduce((sum, row) => {
    const value = Number(row.quantity);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

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

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
          <label className="flex h-11 min-w-[320px] flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              value={searchText}
              onChange={event => setSearchText(event.target.value)}
              placeholder="Tìm mã lệnh, hàng, khách, đơn hàng..."
              disabled={isLoading}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
          </label>

          <FilterCombobox
            label="Trạng thái"
            options={PRODUCTION_ORDER_STATUS_OPTIONS}
            value={selectedStatus}
            onChange={setSelectedStatus}
            searchPlaceholder="Tìm trạng thái..."
            compact
          />

          <MachineMultiFilter
            options={machineFilters}
            values={selectedMachines}
            onChange={setSelectedMachines}
          />

          <label className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700">
            <span className="shrink-0 text-xs font-bold uppercase text-zinc-400">Từ ngày</span>
            <input
              type="date"
              value={dateFrom}
              onChange={event => setDateFrom(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 focus:outline-none"
            />
          </label>

          <label className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700">
            <span className="shrink-0 text-xs font-bold uppercase text-zinc-400">Đến ngày</span>
            <input
              type="date"
              value={dateTo}
              onChange={event => setDateTo(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 focus:outline-none"
            />
          </label>

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

          {isLoading && (
            <div className="flex h-11 shrink-0 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-500">
              Đang tải...
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-black text-zinc-600 transition hover:border-[#ef1b2d] hover:text-[#ef1b2d]"
            >
              Xóa lọc
            </button>
          )}

        </div>

        {loadError && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {loadError}
          </p>
        )}
        {actionMessage && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            {actionMessage}
          </p>
        )}
      </section>

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

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="hover-scrollbar max-h-[70vh] overflow-auto">
          <table className="min-w-[1540px] w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã lệnh</th>
                <th className="px-4 py-3 font-black">Ngày tạo lệnh</th>
                <th className="px-4 py-3 font-black">Ca</th>
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
              {paginatedRows.map(row => (
                <tr key={row.id} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{row.code || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                    {formatProductionOrderDate(row.createdAt)}
                  </td>
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
                  <td className="px-4 py-3 font-mono text-zinc-700">
                    {getProductionOrderProductLines(row)
                      .map(product => product.quantity || '-')
                      .join(' | ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {getProductionOrderProductLines(row)
                      .map(product => product.unit || '-')
                      .join(' | ') || '-'}
                  </td>
                  <td className="w-32 min-w-32 whitespace-nowrap px-4 py-3">
                    <span className="inline-flex whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{row.customer}</td>
                  <td className="px-4 py-3 text-zinc-600">{row.orderRef}</td>
                  <td className="px-4 py-3 text-zinc-600">{row.startDate}</td>
                  <td className="px-4 py-3 text-zinc-600">{row.endDate}</td>
                  <td className="px-4 py-3 text-zinc-600">{row.machine}</td>
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
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          disabled={isLoadingEdit}
                          title="Sửa lệnh SX"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isLoadingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteProductionOrder(row)}
                          disabled={deletingId === row.id}
                          title="Xóa lệnh SX"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-zinc-500">
                    Bảng lenh_sx chưa có dữ liệu hoặc không có lệnh phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Tổng: <strong className="text-zinc-900">{filteredRows.length}</strong> bản ghi
            </span>
            <label className="flex items-center gap-2">
              <span>Hiển thị</span>
              <select
                value={pageSize}
                onChange={event => setPageSize(Number(event.target.value))}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-[#ef1b2d]/10"
              >
                {[10, 25, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span>/ trang</span>
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="Trang đầu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              title="Trang trước"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-[#d71932] px-3 font-black text-white">
              {currentPage}
            </span>
            <span className="px-1 font-semibold text-zinc-600">/ {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              title="Trang sau"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              title="Trang cuối"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
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
