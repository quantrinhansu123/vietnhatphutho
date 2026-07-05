/**
 * Trích xuất lại feature modules từ monolith bằng marker function/interface.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const src = fs.readFileSync(path.join(ROOT, 'src/App.monolith.backup.tsx'), 'utf8');
const lines = src.split('\n');

function lineIndex(marker) {
  const i = lines.findIndex(l => l.startsWith(marker));
  if (i < 0) throw new Error(`Marker not found: ${marker}`);
  return i;
}

function extractByMarkers(startMarker, endMarker) {
  const start = lineIndex(startMarker);
  const end = endMarker ? lineIndex(endMarker) : lines.length;
  return lines.slice(start, end).join('\n');
}

function exportify(code) {
  return code
    .replace(/^function /gm, 'export function ')
    .replace(/^interface /gm, 'export interface ')
    .replace(/^type /gm, 'export type ')
    .replace(/^const BACK_TAB_MAP/gm, 'export const BACK_TAB_MAP')
    .replace(/^const MAIN_MENU/gm, 'export const MAIN_MENU')
    .replace(/^const REPORT_/gm, 'export const REPORT_')
    .replace(/^const PRODUCTION_/gm, 'export const PRODUCTION_')
    .replace(/^const FACILITY_/gm, 'export const FACILITY_')
    .replace(/^const HCNS_/gm, 'export const HCNS_')
    .replace(/^const BUSINESS_/gm, 'export const BUSINESS_')
    .replace(/^const FACTORY_/gm, 'export const FACTORY_')
    .replace(/^const PRIMARY_/gm, 'export const PRIMARY_')
    .replace(/^const TAB_TITLE_/gm, 'export const TAB_TITLE_')
    .replace(/^const ORDER_/gm, 'export const ORDER_')
    .replace(/^const STORAGE_ORDER/gm, 'export const STORAGE_ORDER')
    .replace(/^const orderFieldClass/gm, 'export const orderFieldClass')
    .replace(/^const SETTING_/gm, 'export const SETTING_')
    .replace(/^const MACHINE_NVL_/gm, 'export const MACHINE_NVL_')
    .replace(/^const PRODUCTION_ORDER_/gm, 'export const PRODUCTION_ORDER_')
    .replace(/^const productFieldClass/gm, 'export const productFieldClass')
    .replace(/export export /g, 'export ');
}

const FEATURE_HEADER = `import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage } from '../_shared/recordHelpers';
`;

function writeFeature(rel, extraImports, startMarker, endMarker) {
  const body = exportify(extractByMarkers(startMarker, endMarker));
  const out = `${FEATURE_HEADER}${extraImports ? extraImports + '\n' : ''}\n${body}\n`;
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, out);
  console.log('OK', rel, startMarker, '->', endMarker || 'EOF');
}

// san-pham types/helpers
const sanPhamTypes = exportify(extractByMarkers('interface ProductRow', 'const productFieldClass'));
fs.writeFileSync(path.join(ROOT, 'src/features/san-pham/types.ts'), `import { parsePercentInput } from '../../utils';
import type { BulkProductNplComponentsExcelRow, ProductNplComponentsExcelRow } from '../../utils/productNplComponentsExcel';

${sanPhamTypes}
${exportify(extractByMarkers('function normalizeProductCodeKey', 'function ProductNplItemFormModal'))}
`);

fs.writeFileSync(path.join(ROOT, 'src/features/san-pham/productFieldClass.ts'), exportify(extractByMarkers('const productFieldClass', 'function BackButton')));

writeFeature('src/features/san-pham/index.tsx', `import { productFieldClass } from './productFieldClass';
import type { ProductRow, ProductNplItem, MaterialOption } from './types';
import { normalizeProducts, normalizeProductCodeKey, parseProductNplItems, productNplItemsToJson, formatProductNplSummary, excelRowsToProductNplItems, bulkExcelRowsToProductMap, productNplAmountTypeLabel, formatProductNplAmount } from './types';
import { downloadBulkProductNplComponentsTemplate, downloadProductNplComponentsTemplate, parseBulkProductNplComponentsExcel, parseProductNplComponentsExcel } from '../../utils/productNplComponentsExcel';`, 'type ProductViewTab', 'interface MachineRow');

writeFeature('src/features/danh-sach-may/index.tsx', '', 'interface MachineRow', 'interface MaterialRow');
writeFeature('src/features/kho-nvl/index.tsx', `import { downloadBulkOpeningStockTemplate, parseBulkOpeningStockExcel } from '../../utils/bulkOpeningStockExcel';
import { downloadBulkMaterialTotalWeightTemplate, parseBulkMaterialTotalWeightExcel } from '../../utils/bulkMaterialTotalWeightExcel';
import { productFieldClass } from '../san-pham/productFieldClass';`, 'interface MaterialRow', 'type WarehouseSlipType');

writeFeature('src/features/phieu-xuat-nhap-kho/index.tsx', `import WarehouseSlipPrintModal from '../../components/WarehouseSlipPrintModal';
import { STORAGE_WAREHOUSE_SLIP_DRAFT_KEY } from '../_shared/storage';`, 'type WarehouseSlipType', 'const ORDER_TYPE_OPTIONS');

writeFeature('src/features/khach-hang/index.tsx', '', 'interface StaffOption', 'function normalizeOrderProducts');

writeFeature('src/features/_shared/orderHelpers.ts', `import { normalizeProducts } from '../san-pham/types';`, 'const ORDER_TYPE_OPTIONS', 'function SearchableSelect');

// SearchableSelect standalone
const searchableBody = exportify(extractByMarkers('function SearchableSelect', 'const MACHINE_NVL_REPORT_TABS'));
fs.writeFileSync(path.join(ROOT, 'src/components/shared/SearchableSelect.tsx'), `import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Loader2, Search } from 'lucide-react';

${searchableBody}
`);

writeFeature('src/features/bao-cao-may-nvl-ton/index.tsx', `import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { MachineNvlPrintBatch } from '../../components/MachineNvlPrintSheet';
import { normalizeMachineNvlReports } from '../../utils/machineNvlReports';
import type { MachineNvlReportKind, MachineNvlSavedReport } from '../../utils/machineNvlReports';`, 'const MACHINE_NVL_REPORT_TABS', 'function SearchableProductCodeField');

const spcBody = exportify(extractByMarkers('function SearchableProductCodeField', 'interface ProductionOrderRow'));
fs.writeFileSync(path.join(ROOT, 'src/components/shared/SearchableProductCodeField.tsx'), `import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { ProductRow } from '../../features/san-pham/types';

${spcBody}
`);

writeFeature('src/features/ke-hoach-san-xuat/index.tsx', `import { SearchableSelect, SimpleSelect } from '../../components/shared/SearchableSelect';
import { SearchableProductCodeField } from '../../components/shared/SearchableProductCodeField';
import ProductionPlanNvlPrintSheet from '../../components/ProductionPlanNvlPrintSheet';
import { getProductionShiftOptions } from '../../utils/shiftSettings';`, 'interface ProductionOrderRow', 'function ProductionOrdersPanel');

writeFeature('src/features/lenh-sx/index.tsx', `import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { getProductionShiftOptions } from '../../utils/shiftSettings';`, 'function ProductionOrdersPanel', 'interface OrderProductLine');

writeFeature('src/features/don-hang/index.tsx', `import { SearchableSelect, SimpleSelect } from '../../components/shared/SearchableSelect';
import { ORDER_TYPE_OPTIONS, ORDER_STATUS_OPTIONS, orderFieldClass, normalizeOrderProducts, findOrderProductByCode, readUnitSuggestions, saveUnitSuggestion } from '../_shared/orderHelpers';`, 'interface OrderProductLine', 'interface SettingRow');

writeFeature('src/features/cai-dat-thoi-gian/index.tsx', '', 'interface SettingRow', 'function DashboardWindow');
writeFeature('src/features/dashboard/index.tsx', `import AnalyticsDashboard from '../../components/AnalyticsDashboard';
import type { ProductionReport } from '../../types';`, 'function DashboardWindow', 'function ControlBoardPanel');
writeFeature('src/features/control-board/index.tsx', `import ControlBoardShiftSummaryTable from '../../components/ControlBoardShiftSummaryTable';
import { buildControlBoardShiftSummary, defaultShiftSummaryDateRange } from '../../utils/controlBoardShiftSummary';`, 'function ControlBoardPanel', 'function HumanResourcesPanel');
writeFeature('src/features/nhan-su/index.tsx', `import type { HrBranch } from '../_shared/hr';
import { normalizeHrBranches } from '../_shared/hr';`, 'function HumanResourcesPanel', 'type MenuCardConfig');

console.log('Marker-based re-extract done');
