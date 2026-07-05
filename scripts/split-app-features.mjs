/**
 * Tách App.tsx thành src/features/* theo bảng Supabase.
 * Chạy: node scripts/split-app-features.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const appPath = path.join(ROOT, 'src/App.monolith.backup.tsx');
const backupPath = path.join(ROOT, 'src/App.monolith.backup.tsx');
if (!fs.existsSync(appPath)) {
  fs.copyFileSync(path.join(ROOT, 'src/App.tsx'), appPath);
  console.log('Created backup from App.tsx');
}
const appLines = fs.readFileSync(appPath, 'utf8').split('\n');

const baseImports = appLines.slice(0, 79).join('\n');

function fixPaths(imports, prefix) {
  return imports.replace(/from '\.\//g, `from '${prefix}`);
}

function slice(ranges) {
  const parts = ranges.map(([start, end]) => appLines.slice(start - 1, end).join('\n'));
  return parts.join('\n\n');
}

function addExports(code, names) {
  let out = code;
  for (const name of names) {
    out = out.replace(new RegExp(`(^|\n)(function ${name}\\()`, 'gm'), '$1export function $2');
    out = out.replace(new RegExp(`(^|\n)(interface ${name}\\b)`, 'gm'), '$1export interface $2');
    out = out.replace(new RegExp(`(^|\n)(type ${name} =)`, 'gm'), '$1export type $2');
    out = out.replace(new RegExp(`(^|\n)(const ${name} =)`, 'gm'), '$1export const $2');
  }
  return out
    .replace(/export const const /g, 'export const ')
    .replace(/export function function /g, 'export function ')
    .replace(/export interface interface /g, 'export interface ')
    .replace(/export type type /g, 'export type ');
}

const SHARED_IMPORTS = `${baseImports}
import { BackButton, HomeNavButton, MobileBackNavButton, BACK_TAB_MAP } from '../components/layout/NavButtons';
import { VietNhatLogo, PRINT_COMPANY_NAME } from '../components/layout/Logo';
import { pickText, fileToDataUrl, uploadImage } from '../features/_shared/recordHelpers';
import { productFieldClass } from '../features/san-pham/productFieldClass';
import type { ProductRow, MaterialOption } from '../features/san-pham/types';
import { normalizeProducts, normalizeProductCodeKey } from '../features/san-pham/types';
`;

const FEATURE_IMPORTS = `${fixPaths(baseImports, '../../')}
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage } from '../_shared/recordHelpers';
`;

function writeFeature(relPath, header, body, exportNames) {
  const fullPath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const code = addExports(body, exportNames);
  const content = header.trim() ? `${header.trim()}\n\n${code}\n` : `${code}\n`;
  fs.writeFileSync(fullPath, content);
  console.log('Wrote', relPath);
}

// --- _shared ---
writeFeature(
  'src/features/_shared/storage.ts',
  `import type { ProductionReport } from '../../types';`,
  slice([[80, 92]]),
  ['STORAGE_DRAFT_KEY', 'STORAGE_OFFLINE_KEY', 'STORAGE_REPORTS_CACHE_KEY', 'STORAGE_WAREHOUSE_SLIP_DRAFT_KEY', 'readCachedReports']
);

writeFeature(
  'src/components/layout/Logo.tsx',
  `import React from 'react';
import vietNhatLogoNewUrl from '../../../logo-new.png';`,
  slice([[94, 102]]).replace(/vietNhatLogoUrl/g, 'vietNhatLogoNewUrl'),
  ['VietNhatLogo']
);

writeFeature(
  'src/components/layout/constants.ts',
  '',
  slice([[104, 104]]),
  ['PRINT_COMPANY_NAME']
);

writeFeature(
  'src/features/_shared/hr.ts',
  '',
  slice([[107, 181]]),
  ['HrMember', 'HrDepartment', 'HrBranch', 'normalizeHrBranches']
);

writeFeature(
  'src/components/layout/NavButtons.tsx',
  `${fixPaths(baseImports, '../../')}
import { pathFromTab } from '../../routes';`,
  slice([[418, 511]]),
  ['BackButton', 'HomeNavButton', 'MobileBackNavButton', 'BACK_TAB_MAP']
);

writeFeature(
  'src/features/_shared/recordHelpers.ts',
  '',
  slice([[2428, 2464]]),
  ['pickText', 'fileToDataUrl', 'uploadImage']
);

// san-pham types + helpers (without modals/panel - split in index)
writeFeature(
  'src/features/san-pham/productFieldClass.ts',
  '',
  slice([[415, 416]]),
  ['productFieldClass']
);

writeFeature(
  'src/features/san-pham/types.ts',
  `${baseImports}
import { parsePercentInput } from '../../utils';
import type { BulkProductNplComponentsExcelRow, ProductNplComponentsExcelRow } from '../../utils/productNplComponentsExcel';`,
  slice([[183, 413], [780, 784], [1277, 1327]]),
  [
    'ProductRow', 'ProductNplItem', 'ProductNplAmountType', 'MaterialOption',
    'normalizeProductCodeKey', 'normalizeProducts', 'parseProductNplItems',
    'productNplItemsToJson', 'formatProductNplSummary', 'roundNplNumber',
    'resolveProductNplAmountType', 'productNplAmountTypeLabel', 'formatProductNplAmount',
    'excelRowsToProductNplItems', 'bulkExcelRowsToProductMap'
  ]
);

writeFeature(
  'src/features/san-pham/index.tsx',
  `${FEATURE_IMPORTS}
import { productFieldClass } from './productFieldClass';
import type { ProductRow, ProductNplItem, MaterialOption, ProductNplAmountType } from './types';
import {
  normalizeProducts, normalizeProductCodeKey, parseProductNplItems, productNplItemsToJson,
  formatProductNplSummary, excelRowsToProductNplItems, bulkExcelRowsToProductMap,
  productNplAmountTypeLabel, formatProductNplAmount
} from './types';
import {
  downloadBulkProductNplComponentsTemplate, downloadProductNplComponentsTemplate,
  parseBulkProductNplComponentsExcel, parseProductNplComponentsExcel
} from '../../utils/productNplComponentsExcel';`,
  slice([[540, 2410]]),
  ['ProductsPanel', 'ProductViewModal', 'ProductEditModal', 'ProductNplItemFormModal']
);

writeFeature(
  'src/features/danh-sach-may/index.tsx',
  `${FEATURE_IMPORTS}
import { pickText, fileToDataUrl, uploadImage } from '../_shared/recordHelpers';`,
  slice([[2416, 2427], [2465, 3210]]),
  ['MachinesPanel', 'MachineRow', 'normalizeMachines']
);

writeFeature(
  'src/features/kho-nvl/index.tsx',
  `${FEATURE_IMPORTS}
import {
  downloadBulkOpeningStockTemplate, parseBulkOpeningStockExcel
} from '../../utils/bulkOpeningStockExcel';
import {
  downloadBulkMaterialTotalWeightTemplate, parseBulkMaterialTotalWeightExcel
} from '../../utils/bulkMaterialTotalWeightExcel';
import { productFieldClass } from '../san-pham/productFieldClass';`,
  slice([[3212, 4904]]),
  ['MaterialsInventoryPanel', 'MaterialRow', 'MaterialViewModal', 'BulkOpeningStockModal', 'BulkMaterialTotalWeightModal']
);

writeFeature(
  'src/features/phieu-xuat-nhap-kho/index.tsx',
  `${FEATURE_IMPORTS}
import WarehouseSlipPrintModal from '../../components/WarehouseSlipPrintModal';
import { STORAGE_WAREHOUSE_SLIP_DRAFT_KEY } from '../_shared/storage';`,
  slice([[4906, 6484]]),
  ['WarehouseSlipPanel', 'WarehouseHistoryPanel']
);

writeFeature(
  'src/features/khach-hang/index.tsx',
  `${FEATURE_IMPORTS}`,
  slice([[6493, 6711]]),
  ['CustomersPanel', 'CustomerOption', 'StaffOption']
);

writeFeature(
  'src/features/_shared/orderHelpers.ts',
  `import { normalizeProducts } from '../san-pham/types';
import type { ProductRow } from '../san-pham/types';`,
  slice([[6486, 6491], [6713, 6769]]),
  ['ORDER_TYPE_OPTIONS', 'ORDER_STATUS_DEFAULT', 'ORDER_STATUS_OPTIONS', 'STORAGE_ORDER_UNIT_KEY', 'orderFieldClass', 'normalizeOrderProducts', 'findOrderProductByCode', 'readUnitSuggestions', 'saveUnitSuggestion']
);

writeFeature(
  'src/components/shared/SearchableSelect.tsx',
  `import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Loader2, Search } from 'lucide-react';`,
  slice([[6771, 7027]]),
  ['SearchableSelect', 'SimpleSelect']
);

writeFeature(
  'src/components/shared/SearchableProductCodeField.tsx',
  `import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { ProductRow } from '../../features/san-pham/types';`,
  slice([[8047, 8123]]),
  ['SearchableProductCodeField']
);

writeFeature(
  'src/features/bao-cao-may-nvl-ton/index.tsx',
  `${FEATURE_IMPORTS}
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { MachineNvlPrintBatch } from '../../components/MachineNvlPrintSheet';
import { normalizeMachineNvlReports } from '../../utils/machineNvlReports';
import type { MachineNvlReportKind, MachineNvlSavedReport } from '../../utils/machineNvlReports';`,
  slice([[7029, 8045]]),
  ['MachineNvlReportPanel']
);

writeFeature(
  'src/features/ke-hoach-san-xuat/index.tsx',
  `${FEATURE_IMPORTS}
import { SearchableSelect, SimpleSelect } from '../../components/shared/SearchableSelect';
import { SearchableProductCodeField } from '../../components/shared/SearchableProductCodeField';
import ProductionPlanNvlPrintSheet from '../../components/ProductionPlanNvlPrintSheet';
import { getProductionShiftOptions } from '../../utils/shiftSettings';`,
  slice([[8125, 12741]]),
  [
    'ProductionPlanHistoryPanel', 'ProductionPlanModal', 'ProductionPlanPrintSheet',
    'ProductionPlanMaterialAccountingModal', 'ProductionPlanQrPrintModal'
  ]
);

writeFeature(
  'src/features/lenh-sx/index.tsx',
  `${FEATURE_IMPORTS}
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { getProductionShiftOptions } from '../../utils/shiftSettings';`,
  slice([[12743, 13263]]),
  ['ProductionOrdersPanel', 'AddProductionOrderModal', 'ProductionOrderViewModal', 'EditProductionOrderModal']
);

writeFeature(
  'src/features/don-hang/index.tsx',
  `${FEATURE_IMPORTS}
import { SearchableSelect, SimpleSelect } from '../../components/shared/SearchableSelect';
import {
  ORDER_TYPE_OPTIONS, ORDER_STATUS_OPTIONS, orderFieldClass,
  normalizeOrderProducts, findOrderProductByCode, readUnitSuggestions, saveUnitSuggestion
} from '../_shared/orderHelpers';`,
  slice([[13107, 14022]]),
  ['OrdersPanel', 'OrderRow']
);

writeFeature(
  'src/features/cai-dat-thoi-gian/index.tsx',
  `${FEATURE_IMPORTS}`,
  slice([[14012, 14680]]),
  ['SettingsPanel', 'SettingRow', 'normalizeSettings']
);

writeFeature(
  'src/features/dashboard/index.tsx',
  `${fixPaths(baseImports, '../../')}
import AnalyticsDashboard from '../../components/AnalyticsDashboard';
import type { ProductionReport } from '../../types';`,
  slice([[14682, 14836]]),
  ['DashboardWindow']
);

writeFeature(
  'src/features/control-board/index.tsx',
  `${FEATURE_IMPORTS}
import ControlBoardShiftSummaryTable from '../../components/ControlBoardShiftSummaryTable';
import { buildControlBoardShiftSummary, defaultShiftSummaryDateRange } from '../../utils/controlBoardShiftSummary';
import { ProductsPanel } from '../san-pham';
import { OrdersPanel } from '../don-hang';
import { ProductionOrdersPanel } from '../lenh-sx';
import { MachinesPanel } from '../danh-sach-may';
import { MaterialsInventoryPanel } from '../kho-nvl';
import { HumanResourcesPanel } from '../nhan-su';`,
  slice([[14838, 16023]]),
  ['ControlBoardPanel']
);

writeFeature(
  'src/features/nhan-su/index.tsx',
  `${FEATURE_IMPORTS}
import type { HrBranch } from '../_shared/hr';
import { normalizeHrBranches } from '../_shared/hr';`,
  slice([[16025, 16502]]),
  ['HumanResourcesPanel', 'AddStaffModal']
);

writeFeature(
  'src/app/menus.tsx',
  `${fixPaths(baseImports, '../')}
import type { AppTab } from '../routes';
import { pathFromTab } from '../routes';
import MachineDowntimeIcon from '../components/icons/MachineDowntimeIcon';`,
  slice([[16503, 16935]]),
  [
    'MenuCardGrid', 'MenuPageHeader', 'SubNav', 'MAIN_MENU_ITEMS',
    'REPORT_FORM_MENU_ITEMS', 'PRODUCTION_REPORT_MENU_ITEMS', 'FACILITY_MENU_ITEMS',
    'REPORT_LIST_MENU_ITEMS', 'HCNS_MENU_ITEMS', 'BUSINESS_MENU_ITEMS', 'FACTORY_MENU_ITEMS',
    'PRIMARY_NAV_GROUPS', 'TAB_TITLE_MAP', 'getActivePageMeta', 'MenuCardConfig'
  ]
);

// Barrel exports
const barrel = `export { ProductsPanel } from './san-pham';
export { MachinesPanel } from './danh-sach-may';
export { MaterialsInventoryPanel } from './kho-nvl';
export { WarehouseSlipPanel, WarehouseHistoryPanel } from './phieu-xuat-nhap-kho';
export { CustomersPanel } from './khach-hang';
export { OrdersPanel } from './don-hang';
export { ProductionOrdersPanel } from './lenh-sx';
export { ProductionPlanHistoryPanel } from './ke-hoach-san-xuat';
export { SettingsPanel } from './cai-dat-thoi-gian';
export { DashboardWindow } from './dashboard';
export { ControlBoardPanel } from './control-board';
export { HumanResourcesPanel } from './nhan-su';
export { MachineNvlReportPanel } from './bao-cao-may-nvl-ton';
`;
fs.writeFileSync(path.join(ROOT, 'src/features/index.ts'), barrel);

console.log('Done. Next: node scripts/build-app-shell.mjs');
