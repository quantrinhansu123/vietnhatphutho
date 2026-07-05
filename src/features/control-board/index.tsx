import React, { useState, useEffect, useMemo } from 'react';
import { formatNumber } from '../../utils';
import type { AppTab } from '../../routes';
import ControlBoardShiftSummaryTable from '../../components/ControlBoardShiftSummaryTable';
import { buildControlBoardShiftSummary, defaultShiftSummaryDateRange, collectShiftSummaryStaffOptions } from '../../utils/controlBoardShiftSummary';
import { normalizeAcceptanceReports, type AcceptanceReport } from '../../components/AcceptanceReportForm';
import { normalizeMixingReport } from '../../lib/mixingReportModel';
import type { MixingReport } from '../../components/MixingReportForm';
import {
  buildWeighingEditPending,
  normalizeWeighingRecords,
  type WeighingPendingAdd,
  type WeighingRecord
} from '../../components/WeighingShiftSummary';
import { normalizeMachineNvlReports, type MachineNvlSavedReport } from '../../utils/machineNvlReports';
import { DashboardWindow } from '../dashboard';
import { normalizeMachines, type MachineRow } from '../danh-sach-may';
import { normalizeOrders, getOrderProductLines, formatOrderProductsSummary, type OrderRow } from '../don-hang';
import { normalizeProducts } from '../san-pham';
import type { ProductRow } from '../san-pham/types';
import { normalizeMaterialsInventory, type MaterialRow } from '../kho-nvl';
import {
  normalizeWarehouseMovements,
  mapWarehouseMovementsForShiftSummary,
  type WarehouseMovementRow
} from '../phieu-xuat-nhap-kho';
import type { HrBranch } from '../_shared/hr';
import { normalizeHrBranches } from '../_shared/hr';
import {
  flattenHrMembers,
  splitProductionOrderStaffNames,
  parseProductionOrderFilterDate
} from '../cai-dat-thoi-gian';
import {
  normalizeProductionOrders,
  mapProductionOrderSettings,
  resolveProductionOrderMachine,
  formatProductionOrderShiftLabel,
  compareProductionOrderPriority,
  useProductionOrderPrint,
  AddProductionOrderModal,
  ProductionOrderViewModal,
  EditProductionOrderModal,
  ProductionPlanModal,
  ProductionOrderPrintSheet,
  ProductionOrderBatchPrintSheets,
  buildProductionOrderMaterialProposal,
  parseProductionOrderQuantity,
  fetchProductPrintData,
  resolveProductionOrderMachineLabel,
  type ProductionOrderRow,
  type ProductionOrderLookupSetting,
  type PrintableProductionOrder
} from '../ke-hoach-san-xuat';
import {
  Factory,
  ClipboardCheck,
  UsersRound,
  ClipboardList,
  Cpu,
  Eye,
  Pencil,
  Trash2,
  Printer,
  Loader2
} from 'lucide-react';

export function ControlBoardPanel({
  onNavigate,
  onMachineReport,
  onEditWeighing
}: {
  onNavigate: (tab: AppTab) => void;
  onMachineReport: (machine: MachineRow, type: 'mixing' | 'nvl') => void;
  onEditWeighing?: (pending: WeighingPendingAdd) => void;
}) {
  const [staffBranches, setStaffBranches] = useState<HrBranch[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrderRow[]>([]);
  const [productionOrderSettings, setProductionOrderSettings] = useState<ProductionOrderLookupSetting[]>([]);
  const [acceptanceReports, setAcceptanceReports] = useState<AcceptanceReport[]>([]);
  const [shiftSummaryAcceptanceReports, setShiftSummaryAcceptanceReports] = useState<AcceptanceReport[]>([]);
  const [mixingReports, setMixingReports] = useState<MixingReport[]>([]);
  const [weighingRecords, setWeighingRecords] = useState<WeighingRecord[]>([]);
  const [machineNvlReports, setMachineNvlReports] = useState<MachineNvlSavedReport[]>([]);
  const [shiftSummaryWarehouseMovements, setShiftSummaryWarehouseMovements] = useState<WarehouseMovementRow[]>([]);
  const defaultShiftSummaryRange = defaultShiftSummaryDateRange(14);
  const [shiftSummaryDateFrom, setShiftSummaryDateFrom] = useState(defaultShiftSummaryRange.from);
  const [shiftSummaryDateTo, setShiftSummaryDateTo] = useState(defaultShiftSummaryRange.to);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [machineSearch, setMachineSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [productionOrderSearch, setProductionOrderSearch] = useState('');
  const [productionOrderDateFrom, setProductionOrderDateFrom] = useState('');
  const [productionOrderDateTo, setProductionOrderDateTo] = useState('');
  const [productionOrderShiftFilter, setProductionOrderShiftFilter] = useState('all');
  const [productionOrderStaffFilters, setProductionOrderStaffFilters] = useState<Set<string>>(() => new Set());
  const [acceptanceReportSearch, setAcceptanceReportSearch] = useState('');
  const [showAddProductionOrder, setShowAddProductionOrder] = useState(false);
  const [showProductionPlan, setShowProductionPlan] = useState(false);
  const [viewingProductionOrder, setViewingProductionOrder] = useState<ProductionOrderRow | null>(null);
  const [editingProductionOrder, setEditingProductionOrder] = useState<ProductionOrderRow | null>(null);
  const [deletingProductionOrderId, setDeletingProductionOrderId] = useState('');
  const [deletingAcceptanceReportId, setDeletingAcceptanceReportId] = useState('');
  const [selectedProductionOrderIds, setSelectedProductionOrderIds] = useState<string[]>([]);
  const [printingBatchOrders, setPrintingBatchOrders] = useState<PrintableProductionOrder[]>([]);
  const [pendingBatchPrint, setPendingBatchPrint] = useState(false);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);
  const { printingOrder, printingMaterials, printingProduct, printingMachineLabel, shiftSettings, isLoadingPrint, printProductionOrder } = useProductionOrderPrint();

  const loadBoard = async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const summaryFrom = shiftSummaryDateFrom || defaultShiftSummaryRange.from;
      const summaryTo = shiftSummaryDateTo || defaultShiftSummaryRange.to;
      const [staffRes, orderRes, productRes, machineRes, materialRes, productionRes, settingRes, acceptanceRes, shiftSummaryAcceptanceRes, mixingRes, weighingRes, machineNvlRes, warehouseMovementRes] =
        await Promise.all([
        fetch('/api/nhan-su?format=groups'),
        fetch('/api/don-hang'),
        fetch('/api/san-pham?format=table'),
        fetch('/api/danh-sach-may'),
        fetch('/api/kho-nvl'),
        fetch('/api/lenh-sx'),
        fetch('/api/cai-dat'),
        fetch('/api/bao-cao-nghiem-thu?limit=30'),
        fetch(
          `/api/bao-cao-nghiem-thu?tu_ngay=${encodeURIComponent(summaryFrom)}&den_ngay=${encodeURIComponent(summaryTo)}`
        ),
        fetch(`/api/bao-cao-phoi-tron?tu_ngay=${encodeURIComponent(summaryFrom)}&den_ngay=${encodeURIComponent(summaryTo)}`),
        fetch(`/api/phieu-can-dinh-ki?from=${encodeURIComponent(summaryFrom)}&to=${encodeURIComponent(summaryTo)}`),
        fetch('/api/bao-cao-may-nvl-ton?limit=300'),
        fetch(
          `/api/phieu-xuat-nhap-kho?loai_kho=nvl&from=${encodeURIComponent(summaryFrom)}&to=${encodeURIComponent(summaryTo)}`
        )
      ]);

      const staffData = await staffRes.json().catch(() => ({}));
      const orderData = await orderRes.json().catch(() => ({}));
      const productData = await productRes.json().catch(() => ({}));
      const machineData = await machineRes.json().catch(() => ({}));
      const materialData = await materialRes.json().catch(() => ({}));
      const productionData = await productionRes.json().catch(() => ({}));
      const settingData = await settingRes.json().catch(() => ({}));
      const acceptanceData = await acceptanceRes.json().catch(() => ({}));
      const shiftSummaryAcceptanceData = await shiftSummaryAcceptanceRes.json().catch(() => ({}));
      const mixingData = await mixingRes.json().catch(() => ({}));
      const weighingData = await weighingRes.json().catch(() => ([]));
      const machineNvlData = await machineNvlRes.json().catch(() => ({}));
      const warehouseMovementData = await warehouseMovementRes.json().catch(() => ({}));

      if (!staffRes.ok) throw new Error(staffData.error || 'Không thể tải nhân sự.');
      if (!orderRes.ok) throw new Error(orderData.error || 'Không thể tải đơn hàng.');
      if (!productRes.ok) throw new Error(productData.error || 'Không thể tải sản phẩm.');
      if (!machineRes.ok) throw new Error(machineData.error || 'Không thể tải danh sách máy.');
      if (!materialRes.ok) throw new Error(materialData.error || 'Không thể tải kho NVL.');
      if (!productionRes.ok) throw new Error(productionData.error || 'Không thể tải lệnh sản xuất.');

      setStaffBranches(normalizeHrBranches(staffData));
      setOrders(normalizeOrders(orderData));
      setProducts(normalizeProducts(productData));
      setMachines(normalizeMachines(machineData));
      setMaterials(normalizeMaterialsInventory(materialData));
      setProductionOrders(normalizeProductionOrders(productionData));
      setProductionOrderSettings(settingRes.ok ? mapProductionOrderSettings(settingData) : []);
      if (acceptanceRes.ok) {
        setAcceptanceReports(normalizeAcceptanceReports(acceptanceData));
      } else {
        setAcceptanceReports([]);
      }

      if (shiftSummaryAcceptanceRes.ok) {
        setShiftSummaryAcceptanceReports(normalizeAcceptanceReports(shiftSummaryAcceptanceData));
      } else {
        setShiftSummaryAcceptanceReports([]);
      }

      if (mixingRes.ok) {
        const mixingList = Array.isArray(mixingData.reports) ? mixingData.reports : [];
        setMixingReports(mixingList.map((item: Record<string, unknown>) => normalizeMixingReport(item)));
      } else {
        setMixingReports([]);
      }

      if (weighingRes.ok) {
        setWeighingRecords(normalizeWeighingRecords(weighingData));
      } else {
        setWeighingRecords([]);
      }

      if (machineNvlRes.ok) {
        setMachineNvlReports(normalizeMachineNvlReports(machineNvlData));
      } else {
        setMachineNvlReports([]);
      }

      if (warehouseMovementRes.ok) {
        setShiftSummaryWarehouseMovements(normalizeWarehouseMovements(warehouseMovementData));
      } else {
        setShiftSummaryWarehouseMovements([]);
      }

      const usingLocalFallback = [machineData, staffData, orderData, materialData, productionData].some(
        payload => payload && typeof payload === 'object' && (payload as { source?: string }).source === 'local'
      );
      if (usingLocalFallback) {
        setLoadError(
          'Chưa kết nối Supabase — dữ liệu đang rỗng. Kiểm tra file .env (SUPABASE_URL, SUPABASE_SERVICE_KEY) rồi khởi động lại server: npm run dev.'
        );
      }
    } catch (error: any) {
      setStaffBranches([]);
      setOrders([]);
      setProducts([]);
      setMachines([]);
      setMaterials([]);
      setProductionOrders([]);
      setProductionOrderSettings([]);
      setAcceptanceReports([]);
      setShiftSummaryAcceptanceReports([]);
      setMixingReports([]);
      setWeighingRecords([]);
      setMachineNvlReports([]);
      setShiftSummaryWarehouseMovements([]);
      setLoadError(error.message || 'Không thể tải dữ liệu bảng điều khiển.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, [shiftSummaryDateFrom, shiftSummaryDateTo]);

  const shiftSummaryWarehouseMovementRefs = useMemo(
    () => mapWarehouseMovementsForShiftSummary(shiftSummaryWarehouseMovements),
    [shiftSummaryWarehouseMovements]
  );

  const shiftSummaryRows = useMemo(
    () =>
      buildControlBoardShiftSummary({
        shiftSettings: productionOrderSettings,
        productionOrders,
        products: products.map(product => ({ code: product.code, totalWeight: product.totalWeight })),
        acceptanceReports: shiftSummaryAcceptanceReports,
        warehouseMovements: shiftSummaryWarehouseMovementRefs,
        weighingRecords,
        machineNvlReports,
        dateFrom: shiftSummaryDateFrom,
        dateTo: shiftSummaryDateTo
      }),
    [
      productionOrderSettings,
      productionOrders,
      products,
      shiftSummaryAcceptanceReports,
      shiftSummaryWarehouseMovementRefs,
      weighingRecords,
      machineNvlReports,
      shiftSummaryDateFrom,
      shiftSummaryDateTo
    ]
  );

  const shiftSummaryFilterSources = useMemo(
    () => ({
      shiftSettings: productionOrderSettings,
      productionOrders: productionOrders.map(order => ({
        startDate: order.startDate,
        shift: order.shift,
        staff: order.staff
      })),
      mixingReports: mixingReports.map(report => ({
        ngay: report.ngay,
        ca: report.ca,
        nhan_su: report.nhan_su
      })),
      warehouseMovements: shiftSummaryWarehouseMovementRefs.map(movement => ({
        slipDate: movement.slipDate,
        shift: movement.shift,
        createdBy: movement.createdBy
      })),
      machineNvlReports: machineNvlReports.map(report => ({
        ngay: report.ngay,
        ca: report.ca,
        nhanSu: report.nhanSu
      })),
      weighingRecords: weighingRecords.map(record => ({
        productionDate: record.productionDate,
        reportDate: record.reportDate,
        shiftName: record.shiftName,
        worker1: record.worker1,
        worker2: record.worker2
      }))
    }),
    [productionOrderSettings, productionOrders, mixingReports, shiftSummaryWarehouseMovementRefs, machineNvlReports, weighingRecords]
  );

  const shiftSummaryShiftOptions = useMemo(() => {
    const fromSettings = productionOrderSettings
      .filter(setting => setting.loaiCaiDat === 'Thời gian')
      .map(setting => setting.name || setting.code)
      .filter(value => value && value !== '-');

    const fromRows = shiftSummaryRows.map(row => row.ca).filter(Boolean);
    return [...new Set(fromSettings.length > 0 ? fromSettings : fromRows)].sort((a, b) =>
      a.localeCompare(b, 'vi', { numeric: true })
    );
  }, [productionOrderSettings, shiftSummaryRows]);

  const shiftSummaryStaffOptions = useMemo(
    () => collectShiftSummaryStaffOptions(shiftSummaryFilterSources),
    [shiftSummaryFilterSources]
  );

  const handleDeleteWeighingRecord = async (recordId: string | number) => {
    const res = await fetch(`/api/phieu-can-dinh-ki/${recordId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Không thể xóa dòng cân.');
    }
    await loadBoard();
  };

  const handleDeleteWeighingRecords = async (recordIds: Array<string | number>) => {
    for (const recordId of recordIds) {
      const res = await fetch(`/api/phieu-can-dinh-ki/${recordId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa dòng cân.');
      }
    }
    await loadBoard();
  };

  const handleDeleteWarehouseSlip = async (slipCode: string) => {
    const res = await fetch(`/api/phieu-xuat-nhap-kho/slip/${encodeURIComponent(slipCode)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Không thể xóa phiếu xuất nhập kho.');
    }
    await loadBoard();
  };

  const handleDeleteWarehouseSlips = async (slipCodes: string[]) => {
    const uniqueIds = Array.from(new Set(slipCodes.filter(Boolean)));
    for (const slipCode of uniqueIds) {
      const res = await fetch(`/api/phieu-xuat-nhap-kho/slip/${encodeURIComponent(slipCode)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa phiếu xuất nhập kho.');
      }
    }
    await loadBoard();
  };

  const handleDeleteMixingReport = async (reportId: string) => {
    const res = await fetch(`/api/bao-cao-phoi-tron/${reportId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Không thể xóa báo cáo phối trộn.');
    }
    await loadBoard();
  };

  const handleDeleteMixingReports = async (reportIds: string[]) => {
    const uniqueIds = Array.from(new Set(reportIds.filter(Boolean)));
    for (const reportId of uniqueIds) {
      const res = await fetch(`/api/bao-cao-phoi-tron/${reportId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa báo cáo phối trộn.');
      }
    }
    await loadBoard();
  };

  const handleDeleteMachineNvlReport = async (reportId: string) => {
    const res = await fetch(`/api/bao-cao-may-nvl-ton/${encodeURIComponent(reportId)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Không thể xóa báo cáo tồn NVL đầu ca.');
    }
    await loadBoard();
  };

  const handleDeleteMachineNvlReports = async (reportIds: string[]) => {
    const uniqueIds = Array.from(new Set(reportIds.filter(Boolean)));
    for (const reportId of uniqueIds) {
      const res = await fetch(`/api/bao-cao-may-nvl-ton/${encodeURIComponent(reportId)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa báo cáo tồn NVL đầu ca.');
      }
    }
    await loadBoard();
  };

  const handleEditWeighingRecord = (recordId: string | number) => {
    const record = weighingRecords.find(item => item.id === recordId);
    if (!record || !onEditWeighing) return;
    onEditWeighing(buildWeighingEditPending(record, weighingRecords));
  };

  const shiftSummaryDetailSources = useMemo(
    () => ({
      shiftSettings: productionOrderSettings,
      productionOrders: productionOrders.map(order => ({
        code: order.code,
        startDate: order.startDate,
        shift: order.shift,
        productCode: order.productCode,
        productName: order.productName,
        quantity: order.quantity,
        unit: order.unit,
        products: order.products
      })),
      products: products.map(product => ({ code: product.code, totalWeight: product.totalWeight })),
      acceptanceReports: shiftSummaryAcceptanceReports,
      warehouseMovements: shiftSummaryWarehouseMovementRefs,
      weighingRecords,
      machineNvlReports
    }),
    [
      productionOrderSettings,
      productionOrders,
      products,
      shiftSummaryAcceptanceReports,
      shiftSummaryWarehouseMovementRefs,
      weighingRecords,
      machineNvlReports
    ]
  );

  const staffMembers = useMemo(() => flattenHrMembers(staffBranches), [staffBranches]);
  const staffQuery = staffSearch.trim().toLowerCase();
  const filteredStaff = useMemo(() => {
    if (!staffQuery) return staffMembers;
    return staffMembers.filter(member =>
      `${member.name} ${member.role} ${member.shift} ${member.status}`.toLowerCase().includes(staffQuery)
    );
  }, [staffMembers, staffQuery]);

  const orderQuery = orderSearch.trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    if (!orderQuery) return orders;
    return orders.filter(order =>
      `${order.orderCode} ${formatOrderProductsSummary(getOrderProductLines(order))} ${order.customer} ${order.status} ${order.stockQuantity}`
        .toLowerCase()
        .includes(orderQuery)
    );
  }, [orders, orderQuery]);

  const productQuery = productSearch.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    if (!productQuery) return products;
    return products.filter(product =>
      `${product.code} ${product.name} ${product.group} ${product.nature}`.toLowerCase().includes(productQuery)
    );
  }, [products, productQuery]);

  const machineQuery = machineSearch.trim().toLowerCase();
  const filteredMachines = useMemo(() => {
    if (!machineQuery) return machines;
    return machines.filter(machine =>
      `${machine.code} ${machine.name} ${machine.type} ${machine.branch} ${machine.location} ${machine.status}`
        .toLowerCase()
        .includes(machineQuery)
    );
  }, [machines, machineQuery]);

  const materialQuery = materialSearch.trim().toLowerCase();
  const filteredMaterials = useMemo(() => {
    if (!materialQuery) return materials;
    return materials.filter(material =>
      `${material.code} ${material.name} ${material.unit}`.toLowerCase().includes(materialQuery)
    );
  }, [materials, materialQuery]);

  const productionOrderQuery = productionOrderSearch.trim().toLowerCase();
  const productionOrderShiftOptions = useMemo(() => {
    const fromTimeSettings = productionOrderSettings
      .filter(setting => setting.loaiCaiDat === 'Thời gian')
      .map(setting => setting.name || setting.code)
      .filter(value => value && value !== '-');

    const fallbackFromOrders = productionOrders
      .map(row => (row.shift && row.shift !== '-' ? row.shift : 'Chưa phân ca'))
      .filter(Boolean);

    return [...new Set(fromTimeSettings.length > 0 ? fromTimeSettings : fallbackFromOrders)].sort((a, b) =>
      a.localeCompare(b, 'vi', { numeric: true })
    );
  }, [productionOrderSettings, productionOrders]);
  const productionOrderStaffOptions = useMemo(() => {
    return [
      ...new Set(productionOrders.flatMap(row => splitProductionOrderStaffNames(row.staff)))
    ].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [productionOrders]);
  const recentProductionOrders = useMemo(() => {
    const sorted = [...productionOrders].sort(compareProductionOrderPriority);

    return sorted.filter(row =>
      {
        const matchesSearch =
          !productionOrderQuery ||
          `${row.code} ${row.name} ${row.productCode} ${row.productName} ${row.customer} ${row.orderRef} ${row.status} ${row.machine} ${row.position} ${resolveProductionOrderMachine(row, machines)} ${row.shift} ${row.staff}`
            .toLowerCase()
            .includes(productionOrderQuery);
        const rowDate = parseProductionOrderFilterDate(row.startDate);
        const matchesDateFrom = !productionOrderDateFrom || (rowDate && rowDate >= productionOrderDateFrom);
        const matchesDateTo = !productionOrderDateTo || (rowDate && rowDate <= productionOrderDateTo);
        const rowShift = row.shift && row.shift !== '-' ? row.shift : 'Chưa phân ca';
        const matchesShift = productionOrderShiftFilter === 'all' || rowShift === productionOrderShiftFilter;
        const rowStaff = splitProductionOrderStaffNames(row.staff);
        const matchesStaff =
          productionOrderStaffFilters.size === 0 ||
          rowStaff.some(name => productionOrderStaffFilters.has(name));

        return matchesSearch && matchesDateFrom && matchesDateTo && matchesShift && matchesStaff;
      }
    );
  }, [
    productionOrders,
    productionOrderQuery,
    productionOrderDateFrom,
    productionOrderDateTo,
    productionOrderShiftFilter,
    productionOrderStaffFilters,
    machines
  ]);

  const acceptanceReportQuery = acceptanceReportSearch.trim().toLowerCase();
  const filteredAcceptanceReports = useMemo(() => {
    if (!acceptanceReportQuery) return acceptanceReports;
    return acceptanceReports.filter(report =>
      `${report.ngay} ${report.ca} ${report.lan} ${report.gio} ${report.ma_may} ${report.ten_may} ${report.mat_hang} ${report.don_vi} ${report.so_luong ?? ''}`
        .toLowerCase()
        .includes(acceptanceReportQuery)
    );
  }, [acceptanceReports, acceptanceReportQuery]);
  const totalAcceptanceRolls = useMemo(
    () =>
      acceptanceReports.reduce((sum, report) => {
        const unit = String(report.don_vi || '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        if (unit !== 'cuon') return sum;
        return sum + (report.so_luong ?? 0);
      }, 0),
    [acceptanceReports]
  );

  const previewLimit = 12;
  const sidePreviewLimit = 6;
  const productionPreviewLimit = 20;
  const visibleProductionOrders = recentProductionOrders.slice(0, productionPreviewLimit);
  const selectedProductionOrdersForPlan = useMemo(
    () => productionOrders.filter(row => selectedProductionOrderIds.includes(row.id)),
    [productionOrders, selectedProductionOrderIds]
  );
  const selectedVisibleProductionOrderIds = visibleProductionOrders
    .map(row => row.id)
    .filter(id => selectedProductionOrderIds.includes(id));
  const allVisibleProductionOrdersSelected =
    visibleProductionOrders.length > 0 && selectedVisibleProductionOrderIds.length === visibleProductionOrders.length;
  const hasAnyVisibleProductionOrderSelected = selectedVisibleProductionOrderIds.length > 0;

  useEffect(() => {
    setSelectedProductionOrderIds(prev => prev.filter(id => productionOrders.some(row => row.id === id)));
  }, [productionOrders]);

  const handleDeleteProductionOrder = async (row: ProductionOrderRow) => {
    const label = row.code || row.name || 'lệnh SX';
    if (!window.confirm(`Xóa ${label}?`)) return;

    setDeletingProductionOrderId(row.id);
    try {
      const res = await fetch(`/api/lenh-sx/${row.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa lệnh sản xuất.');
      }
      if (viewingProductionOrder?.id === row.id) setViewingProductionOrder(null);
      if (editingProductionOrder?.id === row.id) setEditingProductionOrder(null);
      await loadBoard();
    } catch (error: any) {
      window.alert(error.message || 'Không thể xóa lệnh sản xuất.');
    } finally {
      setDeletingProductionOrderId('');
    }
  };

  const handleDeleteAcceptanceReport = async (report: AcceptanceReport) => {
    const label = report.mat_hang || report.ten_may || 'báo cáo sản lượng';
    if (!window.confirm(`Xóa ${label}?`)) return;

    setDeletingAcceptanceReportId(report.id);
    try {
      const res = await fetch(`/api/bao-cao-nghiem-thu/${report.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa báo cáo sản lượng.');
      }
      await loadBoard();
    } catch (error: any) {
      window.alert(error.message || 'Không thể xóa báo cáo sản lượng.');
    } finally {
      setDeletingAcceptanceReportId('');
    }
  };

  const toggleProductionOrderSelection = (orderId: string) => {
    setSelectedProductionOrderIds(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleSelectAllVisibleProductionOrders = () => {
    setSelectedProductionOrderIds(prev => {
      const visibleIds = visibleProductionOrders.map(row => row.id);
      if (visibleIds.length === 0) return prev;
      if (allVisibleProductionOrdersSelected) {
        return prev.filter(id => !visibleIds.includes(id));
      }
      return [...new Set([...prev, ...visibleIds])];
    });
  };

  const toggleProductionOrderStaffFilter = (staffName: string) => {
    setProductionOrderStaffFilters(prev => {
      const next = new Set(prev);
      if (next.has(staffName)) {
        next.delete(staffName);
      } else {
        next.add(staffName);
      }
      return next;
    });
  };

  const clearProductionOrderFilters = () => {
    setProductionOrderDateFrom('');
    setProductionOrderDateTo('');
    setProductionOrderShiftFilter('all');
    setProductionOrderStaffFilters(new Set());
  };

  const handlePrintSelectedProductionOrders = async () => {
    const rowsToPrint = visibleProductionOrders.filter(row => selectedProductionOrderIds.includes(row.id));
    if (rowsToPrint.length === 0) return;

    setIsBatchPrinting(true);
    try {
      const printableItems = await Promise.all(
        rowsToPrint.map(async order => {
          const [{ items, product }, machineLabel] = await Promise.all([
            fetchProductPrintData(order.productCode),
            resolveProductionOrderMachineLabel(order.machine)
          ]);
          const orderQuantity = parseProductionOrderQuantity(order.quantity);
          return {
            order,
            materials: buildProductionOrderMaterialProposal(orderQuantity, items, product),
            machineLabel,
            product
          };
        })
      );
      setPrintingBatchOrders(printableItems);
      setPendingBatchPrint(true);
    } catch (error) {
      console.error('Không thể in nhiều lệnh SX:', error);
      window.alert('Không thể tải dữ liệu để in các lệnh SX đã chọn.');
    } finally {
      setIsBatchPrinting(false);
    }
  };

  useEffect(() => {
    if (!pendingBatchPrint || printingBatchOrders.length === 0) return;

    const timer = window.setTimeout(() => {
      window.print();
      setPendingBatchPrint(false);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [pendingBatchPrint, printingBatchOrders]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintingBatchOrders([]);
      setPendingBatchPrint(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1880px] space-y-3 sm:space-y-4">
      {loadError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {loadError}
        </p>
      )}

      <ControlBoardShiftSummaryTable
        rows={shiftSummaryRows}
        isLoading={isLoading}
        dateFrom={shiftSummaryDateFrom}
        dateTo={shiftSummaryDateTo}
        onDateFromChange={setShiftSummaryDateFrom}
        onDateToChange={setShiftSummaryDateTo}
        detailSources={shiftSummaryDetailSources}
        filterSources={shiftSummaryFilterSources}
        shiftOptions={shiftSummaryShiftOptions}
        staffOptions={shiftSummaryStaffOptions}
        onEditWeighingRecord={onEditWeighing ? handleEditWeighingRecord : undefined}
        onDeleteWeighingRecord={handleDeleteWeighingRecord}
        onDeleteWeighingRecords={handleDeleteWeighingRecords}
        onDeleteWarehouseSlip={handleDeleteWarehouseSlip}
        onDeleteWarehouseSlips={handleDeleteWarehouseSlips}
        onDeleteMachineNvlReport={handleDeleteMachineNvlReport}
        onDeleteMachineNvlReports={handleDeleteMachineNvlReports}
      />

      <div className="grid grid-cols-1 gap-4">
        <DashboardWindow
          title="Lệnh sản xuất"
          subtitle="Các dòng lệnh mới nhất từ bảng lenh_sx"
          icon={Factory}
          accentClass="bg-gradient-to-r from-emerald-900 to-emerald-700"
          count={productionOrders.length}
          countLabel="Lệnh"
          search={productionOrderSearch}
          onSearchChange={setProductionOrderSearch}
          isLoading={isLoading}
          error=""
          onOpen={async () => {
            if (selectedProductionOrdersForPlan.length === 0) return;
            await loadBoard();
            setShowProductionPlan(true);
          }}
          openLabel={`Tạo Kế hoạch SX${selectedProductionOrdersForPlan.length > 0 ? ` (${selectedProductionOrdersForPlan.length})` : ''}`}
          disabled={selectedProductionOrdersForPlan.length === 0}
          secondaryAction={{
            label: 'Thêm mới',
            onClick: () => setShowAddProductionOrder(true)
          }}
          tertiaryAction={{
            label: `In lệnh${selectedProductionOrderIds.length > 0 ? ` (${selectedProductionOrderIds.length})` : ''}`,
            onClick: handlePrintSelectedProductionOrders,
            disabled: !hasAnyVisibleProductionOrderSelected,
            loading: isBatchPrinting
          }}
        >
          <div className="border-b border-zinc-100 bg-white p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_1.2fr_auto]">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Từ ngày</span>
                <input
                  type="date"
                  value={productionOrderDateFrom}
                  onChange={event => setProductionOrderDateFrom(event.target.value)}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-[#ef1b2d]/10"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Tới ngày</span>
                <input
                  type="date"
                  value={productionOrderDateTo}
                  onChange={event => setProductionOrderDateTo(event.target.value)}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-[#ef1b2d]/10"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Ca</span>
                <select
                  value={productionOrderShiftFilter}
                  onChange={event => setProductionOrderShiftFilter(event.target.value)}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-[#ef1b2d]/10"
                >
                  <option value="all">Tất cả ca</option>
                  {productionOrderShiftOptions.map(shift => (
                    <option key={shift} value={shift}>
                      {formatProductionOrderShiftLabel(shift, productionOrderSettings)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={clearProductionOrderFilters}
                  className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-700 transition hover:bg-zinc-100"
                >
                  Xóa lọc
                </button>
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Nhân sự</span>
                <span className="text-[10px] font-bold text-zinc-400">
                  Hiển thị {recentProductionOrders.length}/{productionOrders.length} lệnh
                </span>
              </div>
              {productionOrderStaffOptions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-400">
                  Chưa có nhân sự trong lệnh SX.
                </p>
              ) : (
                <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                  {productionOrderStaffOptions.map(staffName => {
                    const checked = productionOrderStaffFilters.has(staffName);
                    return (
                      <label
                        key={staffName}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                          checked
                            ? 'border-[#ef1b2d]/30 bg-red-50 text-[#b30d1c]'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProductionOrderStaffFilter(staffName)}
                          className="h-3.5 w-3.5 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                        />
                        {staffName}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="sticky top-0 bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-center font-black">
                  <input
                    type="checkbox"
                    checked={allVisibleProductionOrdersSelected}
                    onChange={toggleSelectAllVisibleProductionOrders}
                    aria-label="Chọn tất cả lệnh SX đang hiển thị"
                    className="h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                  />
                </th>
                <th className="px-3 py-2 font-black">Ưu tiên</th>
                <th className="px-3 py-2 font-black">Mã lệnh</th>
                <th className="px-3 py-2 font-black">Mã hàng</th>
                <th className="px-3 py-2 font-black">Tên hàng</th>
                <th className="px-3 py-2 font-black">SL</th>
                <th className="px-3 py-2 font-black">Trạng thái</th>
                <th className="px-3 py-2 font-black">Máy</th>
                <th className="px-3 py-2 font-black">Đơn hàng</th>
                <th className="px-3 py-2 font-black">Bắt đầu</th>
                  <th className="px-3 py-2 text-center font-black">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visibleProductionOrders.map(row => (
                  <tr key={row.id} className="hover:bg-emerald-50/50">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedProductionOrderIds.includes(row.id)}
                      onChange={() => toggleProductionOrderSelection(row.id)}
                      aria-label={`Chọn ${row.code || row.name}`}
                      className="h-4 w-4 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                    />
                  </td>
                  <td className="px-3 py-2 font-black text-emerald-700">{row.priority > 0 ? row.priority : '-'}</td>
                  <td className="px-3 py-2 font-black text-zinc-950">{row.code || '-'}</td>
                  <td className="px-3 py-2 font-semibold text-zinc-700">{row.productCode || '-'}</td>
                  <td className="px-3 py-2 font-semibold text-zinc-800">{row.productName || '-'}</td>
                  <td className="px-3 py-2 font-mono font-bold text-zinc-700">{row.quantity}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-semibold text-zinc-700">{resolveProductionOrderMachine(row, machines)}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-600">{row.orderRef}</td>
                    <td className="px-3 py-2 font-mono text-[11px] font-bold text-zinc-600">{row.startDate}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingProductionOrder(row)}
                          title="Xem chi tiết"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProductionOrder(row)}
                          title="Sửa lệnh SX"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProductionOrder(row)}
                          disabled={deletingProductionOrderId === row.id}
                          title="Xóa lệnh SX"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingProductionOrderId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => printProductionOrder(row)}
                          disabled={isLoadingPrint}
                        title="In lệnh SX"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && recentProductionOrders.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center font-bold text-zinc-400">
                    Chưa có lệnh SX. Tạo lệnh từ trang Đơn hàng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </DashboardWindow>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardWindow
          title="Báo cáo sản lượng"
          subtitle="Ghi nhận mặt hàng, số lượng và ảnh sản lượng theo ca"
          icon={ClipboardCheck}
          accentClass="bg-gradient-to-r from-sky-900 to-sky-700"
          count={acceptanceReports.length}
          countLabel="Báo cáo"
          summaryExtra={
            <>
              Tổng cuộn: <span className="text-white">{isLoading ? '...' : formatNumber(totalAcceptanceRolls, 0)}</span>
            </>
          }
          search={acceptanceReportSearch}
          onSearchChange={setAcceptanceReportSearch}
          isLoading={isLoading}
          error=""
          onOpen={() => onNavigate('acceptance-report')}
          openLabel="Thêm mới"
          compact
        >
          <table className="w-full table-fixed text-left text-[11px]">
            <thead className="sticky top-0 bg-zinc-100 text-[9px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="w-12 px-2 py-1.5 font-black">Ảnh</th>
                <th className="w-[28%] px-2 py-1.5 font-black">Ngày</th>
                <th className="px-2 py-1.5 font-black">Mặt hàng</th>
                <th className="w-16 px-2 py-1.5 text-right font-black">SL</th>
                <th className="w-10 px-1 py-1.5 text-center font-black"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredAcceptanceReports.slice(0, sidePreviewLimit).map(report => (
                <tr key={report.id} className="hover:bg-sky-50/50">
                  <td className="px-2 py-1.5">
                    {report.hinh_anh ? (
                      <a
                        href={report.hinh_anh}
                        target="_blank"
                        rel="noreferrer"
                        className="block h-8 w-8 overflow-hidden rounded-md border border-zinc-200"
                      >
                        <img src={report.hinh_anh} alt="Sản lượng" className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <p className="truncate font-mono text-[10px] font-bold text-zinc-700">{report.ngay || '-'}</p>
                    <p className="truncate text-[9px] font-semibold text-zinc-500">
                      {report.ca || '-'} · Lần {report.lan || '-'}
                    </p>
                  </td>
                  <td className="px-2 py-1.5">
                    <p className="truncate font-semibold text-zinc-800">{report.mat_hang || '-'}</p>
                    <p className="truncate text-[9px] font-semibold text-zinc-500">
                      {report.ten_may || report.ma_may || '-'} · {report.gio || '-'}
                    </p>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold text-emerald-700">
                    {report.so_luong === null ? '-' : formatNumber(report.so_luong, 2)}
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteAcceptanceReport(report)}
                      disabled={deletingAcceptanceReportId === report.id}
                      title="Xóa báo cáo"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingAcceptanceReportId === report.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredAcceptanceReports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-[10px] font-bold text-zinc-400">
                    Chưa có báo cáo sản lượng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DashboardWindow>

        <DashboardWindow
          title="Nhân sự"
          subtitle="Danh sách thợ máy, phụ máy theo ca"
          icon={UsersRound}
          accentClass="bg-gradient-to-r from-zinc-950 to-zinc-800"
          count={staffMembers.length}
          countLabel="NV"
          search={staffSearch}
          onSearchChange={setStaffSearch}
          isLoading={isLoading}
          error=""
          onOpen={() => onNavigate('hr')}
          openLabel="Mở"
          compact
        >
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-zinc-100 text-[9px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-2 py-1.5 font-black">Tên</th>
                <th className="px-2 py-1.5 font-black">Ca</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredStaff.slice(0, sidePreviewLimit).map(member => (
                <tr key={member.id} className="hover:bg-red-50/50">
                  <td className="px-2 py-1.5 font-bold text-zinc-900">{member.name}</td>
                  <td className="px-2 py-1.5 text-zinc-600">{member.shift}</td>
                </tr>
              ))}
              {!isLoading && filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-2 py-4 text-center text-[10px] font-bold text-zinc-400">Không có nhân sự.</td>
                </tr>
              )}
            </tbody>
          </table>
        </DashboardWindow>

        <DashboardWindow
          title="Đơn hàng"
          subtitle="Mã đơn, hàng hóa, số lượng và trạng thái"
          icon={ClipboardList}
          accentClass="bg-gradient-to-r from-[#ef1b2d] to-[#b30d1c]"
          count={orders.length}
          countLabel="Đơn"
          search={orderSearch}
          onSearchChange={setOrderSearch}
          isLoading={isLoading}
          error=""
          onOpen={() => onNavigate('orders')}
          openLabel="Mở Đơn hàng"
        >
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-black">Mã đơn</th>
                <th className="px-3 py-2 font-black">Hàng</th>
                <th className="px-3 py-2 font-black">Số lượng</th>
                <th className="px-3 py-2 font-black">Số lượng tồn</th>
                <th className="px-3 py-2 font-black">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredOrders.slice(0, previewLimit).map(order => (
                <tr key={order.id} className="hover:bg-red-50/50">
                  <td className="px-3 py-2 font-bold text-zinc-900">{order.orderCode || '-'}</td>
                  <td className="px-3 py-2 text-zinc-700">{formatOrderProductsSummary(getOrderProductLines(order))}</td>
                  <td className="px-3 py-2 font-mono font-bold text-zinc-700">{order.quantity}</td>
                  <td className="px-3 py-2 font-mono font-bold text-zinc-700">{order.stockQuantity}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800">
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center font-bold text-zinc-400">Không có đơn hàng.</td>
                </tr>
              )}
            </tbody>
          </table>
        </DashboardWindow>

        <DashboardWindow
          title="Danh sách máy"
          subtitle="Ảnh máy, mã, tên và trạng thái vận hành"
          icon={Cpu}
          accentClass="bg-gradient-to-r from-emerald-900 to-emerald-700"
          count={machines.length}
          countLabel="Máy"
          search={machineSearch}
          onSearchChange={setMachineSearch}
          isLoading={isLoading}
          error=""
          onOpen={() => onNavigate('machines')}
          openLabel="Mở"
          compact
        >
          <div className="grid grid-cols-1 gap-1.5 p-0.5">
            {filteredMachines.slice(0, sidePreviewLimit).map(machine => (
              <div
                key={machine.id}
                className="flex flex-col gap-2 overflow-hidden rounded-lg border border-zinc-200 bg-white p-2 transition hover:border-[#ef1b2d]/30 sm:flex-row sm:items-center sm:gap-2 sm:p-1.5"
              >
                <div className="flex min-w-0 flex-1 gap-2">
                {machine.imageUrl ? (
                  <a
                    href={machine.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-12 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-100"
                  >
                    <img
                      src={machine.imageUrl}
                      alt={`Ảnh ${machine.name || machine.code}`}
                      className="h-full w-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-zinc-50 text-zinc-400">
                    <Cpu className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[9px] font-black uppercase tracking-wider text-zinc-400">
                    {machine.code || '-'}
                  </p>
                  <p className="truncate text-[11px] font-black text-zinc-900">{machine.name || '-'}</p>
                  <span className="inline-block rounded-full border border-[#ef1b2d]/20 bg-red-50 px-1.5 py-0.5 text-[9px] font-black text-[#ef1b2d]">
                    {machine.status}
                  </span>
                </div>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-1 sm:flex sm:flex-col">
                  <button
                    type="button"
                    onClick={() => onMachineReport(machine, 'nvl')}
                    className="rounded-md border border-emerald-500/50 bg-emerald-700 px-2 py-1.5 text-[9px] font-extrabold leading-tight text-white transition hover:bg-emerald-800 sm:py-1"
                  >
                    <span className="sm:hidden">NVL tồn</span>
                    <span className="hidden sm:inline">Báo cáo NVL tồn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMachineReport(machine, 'mixing')}
                    className="rounded-md border border-emerald-500/50 bg-emerald-700 px-2 py-1.5 text-[9px] font-extrabold leading-tight text-white transition hover:bg-emerald-800 sm:py-1"
                  >
                    <span className="sm:hidden">Phối trộn</span>
                    <span className="hidden sm:inline">Báo cáo phối trộn</span>
                  </button>
                </div>
              </div>
            ))}
            {!isLoading && filteredMachines.length === 0 && (
              <div className="py-6 text-center text-[10px] font-bold text-zinc-400">Không có máy.</div>
            )}
          </div>
        </DashboardWindow>
      </div>

      <AddProductionOrderModal
        open={showAddProductionOrder}
        onClose={() => setShowAddProductionOrder(false)}
        onCreated={loadBoard}
      />

      <ProductionOrderViewModal
        row={viewingProductionOrder}
        onClose={() => setViewingProductionOrder(null)}
      />

      <EditProductionOrderModal
        open={Boolean(editingProductionOrder)}
        row={editingProductionOrder}
        orders={orders}
        productionOrders={productionOrders}
        catalogProducts={products}
        machines={machines}
        onClose={() => setEditingProductionOrder(null)}
        onSaved={loadBoard}
      />

      <ProductionPlanModal
        open={showProductionPlan}
        onClose={() => setShowProductionPlan(false)}
        onSaved={loadBoard}
        onOpenWarehouseSlip={() => onNavigate('warehouse-slip')}
        productionOrders={selectedProductionOrdersForPlan}
        machines={machines}
      />

      {printingOrder && (
        <ProductionOrderPrintSheet
          order={printingOrder}
          materials={printingMaterials}
          machineLabel={printingMachineLabel}
          product={printingProduct}
          shiftSettings={shiftSettings}
        />
      )}

      {printingBatchOrders.length > 0 && (
        <ProductionOrderBatchPrintSheets items={printingBatchOrders} shiftSettings={productionOrderSettings} />
      )}
    </div>
  );
}

