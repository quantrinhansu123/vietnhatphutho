export interface ShiftInfo {
  machineId: string;
  shiftName: string;
  operatorName: string;
  assistantName: string;
}

export interface ProductDefinition {
  code: string;
  name: string;
  normWeight: number; // kg per roll
}

export interface ProductEntry {
  productCode: string;
  rolls: number;
  actualWeight: number; // actual weight in kg
}

export interface MaterialBatches {
  virginPlastic: number[];   // kg for batch 1, 2, 3...
  recycledPlastic: number[]; // kg for batch 1, 2, 3...
  brightenerPowder: number[];// kg for batch 1, 2, 3...
  dispersionOil: number[];   // kg for batch 1, 2, 3...
  otherAdditives: number[];  // kg for batch 1, 2, 3...
}

export interface ProductionReport {
  id: string;
  date: string; // YYYY-MM-DD
  shiftInfo: ShiftInfo;
  productEntry: ProductEntry;
  materials: MaterialBatches;
  wasteWeight: number; // kg of waste
  notes?: string;
  createdAt: string; // ISO string
}

export interface ComputedReportMetrics {
  totalVirginPlastic: number;
  totalRecycledPlastic: number;
  totalPlastic: number;
  virginPercent: number;
  recycledPercent: number;
  
  totalBrightener: number;
  totalDispersionOil: number;
  totalOtherAdditives: number;
  totalMaterials: number;

  expectedProductWeight: number; // rolls * normWeight
  actualProductWeight: number;
  
  // Variance = Net raw plastic mixed - Net actual product weight
  varianceWeight: number;
  variancePercent: number;
  
  status: 'optimal' | 'warning' | 'error';
  statusMessage: string;
}

export const STANDARD_PRODUCTS: ProductDefinition[] = [
  { code: 'PE-LD100', name: 'Nhựa PE Màng mỏng (Túi PE Thường)', normWeight: 25.0 },
  { code: 'PE-HD200', name: 'Nhựa HDPE Chịu Lực (Bao đóng gói)', normWeight: 50.0 },
  { code: 'PP-Y101', name: 'Nhựa PP Sợi Trơn (Vận hành máy bao)', normWeight: 40.0 },
  { code: 'PP-M300', name: 'Nhựa PP Màng Ghép (Ứng dụng nilon cán)', normWeight: 30.0 },
  { code: 'LLDPE-F5', name: 'Nhựa LLDPE Màng Co (Định lượng chuẩn)', normWeight: 15.0 },
  { code: 'RECYCLE-G1', name: 'Nhựa Tái Chế Màu Xám Đại Trà', normWeight: 45.0 }
];

export const STANDARD_MACHINES = [
  'MÁY SX-01 (Đùn PE)',
  'MÁY SX-02 (Đùn PE)',
  'MÁY SX-03 (Dệt PP)',
  'MÁY SX-04 (Cán màng LLDPE)',
  'MÁY SX-05 (Tráng màng PP)'
];

export const STANDARD_SHIFTS = [
  'Ca Ngày (06:00 - 18:00) SG1',
  'Ca Đêm (18:00 - 06:00) SG2',
  'Ca 12C1 (08:00 - 20:00)',
  'Ca 12C2 (20:00 - 08:00)',
  'Ca 8A (06:00 - 14:00)',
  'Ca 8B (14:00 - 22:00)'
];

export const MATERIAL_LABELS: Record<keyof MaterialBatches, { label: string; unit: string; isPlastic: boolean }> = {
  virginPlastic: { label: 'Nhựa Nguyên Sinh (Virgin PP/PE)', unit: 'kg', isPlastic: true },
  recycledPlastic: { label: 'Nhựa Tái Chế (Recycled Plastic)', unit: 'kg', isPlastic: true },
  brightenerPowder: { label: 'Bột Tăng Trắng (Brightener)', unit: 'kg', isPlastic: false },
  dispersionOil: { label: 'Dầu Phân Tán (Dispersion)', unit: 'kg', isPlastic: false },
  otherAdditives: { label: 'Phụ Gia Khác (Other Additives)', unit: 'kg', isPlastic: false }
};
