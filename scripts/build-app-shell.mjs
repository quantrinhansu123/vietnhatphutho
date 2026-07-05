/**
 * Tạo App.tsx mới (shell) từ phần còn lại của monolith + import features.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const backup = path.join(ROOT, 'src/App.monolith.backup.tsx');
const source = fs.existsSync(backup)
  ? backup
  : path.join(ROOT, 'src/App.tsx');
const lines = fs.readFileSync(source, 'utf8').split('\n');

const shellImports = `import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ProductionReport, ShiftInfo, ProductEntry, MaterialBatches, STANDARD_SHIFTS
} from './types';
import { computeReportMetrics } from './utils';
import ShiftInfoForm from './components/ShiftInfoForm';
import ProductEntryForm from './components/ProductEntryForm';
import MaterialsForm from './components/MaterialsForm';
import WasteForm from './components/WasteForm';
import WeighingShiftSummary, {
  buildWeighingEditPending,
  normalizeWeighingRecords,
  type WeighingPendingAdd
} from './components/WeighingShiftSummary';
import WeighingReportForm from './components/WeighingReportForm';
import { DAMAGED_GOODS_SLIP_CONFIG } from './lib/weighingSlipConfig';
import MixingReportForm from './components/MixingReportForm';
import MixingReportListView from './components/MixingReportListView';
import MachineNvlReportListView from './components/MachineNvlReportListView';
import AcceptanceReportForm, { normalizeAcceptanceReports, type AcceptanceReport } from './components/AcceptanceReportForm';
import AcceptanceReportListView from './components/AcceptanceReportListView';
import ControlBoardShiftSummaryTable from './components/ControlBoardShiftSummaryTable';
import { buildControlBoardShiftSummary, collectShiftSummaryStaffOptions, defaultShiftSummaryDateRange, type ShiftSummaryWarehouseMovement } from './utils/controlBoardShiftSummary';
import { normalizeMachineNvlReports, type MachineNvlSavedReport } from './utils/machineNvlReports';
import { getProductionShiftOptions, normalizeShiftSettings } from './utils/shiftSettings';
import { normalizeMixingReport } from './lib/mixingReportModel';
import type { MixingReport } from './components/MixingReportForm';
import MachineDowntimeReportPanel from './components/MachineDowntimeReportPanel';
import { AppTab, pathFromTab, tabFromPath, isWeighingFormPath, isWeighingListPath } from './routes';
import {
  FilePlus2, BarChart3, CheckCircle, Sparkles, Loader2, Menu, Search, Save, ChevronRight, ChevronLeft
} from 'lucide-react';

import { readCachedReports, STORAGE_DRAFT_KEY, STORAGE_OFFLINE_KEY, STORAGE_REPORTS_CACHE_KEY } from './features/_shared/storage';
import { VietNhatLogo } from './components/layout/Logo';
import { HomeNavButton, MobileBackNavButton, BACK_TAB_MAP } from './components/layout/NavButtons';
import {
  MenuCardGrid, MenuPageHeader, SubNav, MAIN_MENU_ITEMS,
  REPORT_FORM_MENU_ITEMS, PRODUCTION_REPORT_MENU_ITEMS, FACILITY_MENU_ITEMS,
  REPORT_LIST_MENU_ITEMS, HCNS_MENU_ITEMS, BUSINESS_MENU_ITEMS, FACTORY_MENU_ITEMS,
  getActivePageMeta
} from './app/menus';
import { ProductsPanel } from './features/san-pham';
import { MachinesPanel } from './features/danh-sach-may';
import { MaterialsInventoryPanel } from './features/kho-nvl';
import { WarehouseSlipPanel, WarehouseHistoryPanel } from './features/phieu-xuat-nhap-kho';
import { CustomersPanel } from './features/khach-hang';
import { OrdersPanel } from './features/don-hang';
import { ProductionOrdersPanel } from './features/lenh-sx';
import { ProductionPlanHistoryPanel } from './features/ke-hoach-san-xuat';
import { SettingsPanel } from './features/cai-dat-thoi-gian';
import { DashboardWindow } from './features/dashboard';
import { ControlBoardPanel } from './features/control-board';
import { HumanResourcesPanel } from './features/nhan-su';
import { MachineNvlReportPanel } from './features/bao-cao-may-nvl-ton';
`;

// DEFAULT_REPORT + App component from monolith (line 16938+)
const tail = lines.slice(16936).join('\n');

fs.writeFileSync(path.join(ROOT, 'src/App.tsx'), `${shellImports}\n${tail}\n`);
console.log('Wrote src/App.tsx shell');
