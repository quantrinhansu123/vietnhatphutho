import { useEffect, useMemo, useState } from 'react';
import { useTabAccess } from '../../app/useTabAccess';
import { FilterCombobox } from '../../components/shared/table';
import { MaterialsInventoryPanel } from '../kho-nvl';
import { ProductsPanel } from '../san-pham';
import { getCatalogCache } from './catalogCache';

export type InventoryCatalogKind = 'materials' | 'products';
export {
  invalidateCatalogCache,
  peekCatalogCache,
  hasFreshCatalogCache,
  getCatalogCache
} from './catalogCache';
export type { CatalogCacheKey } from './catalogCache';

export type InventoryBalanceRow = {
  ma: string;
  ten: string;
  don_vi: string;
  ten_kho: string;
  ton_dau_ky: number;
  nhap_trong_ky: number;
  xuat_trong_ky: number;
  ton_cuoi_ky: number;
};

export function normalizeWarehouseName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function warehouseCatalogKind(name: string): InventoryCatalogKind {
  const normalized = normalizeWarehouseName(name);
  return normalized.includes('san pham') || normalized.includes('thanh pham') || normalized.includes('hang hoa')
    ? 'products'
    : 'materials';
}

export function isDefaultWarehouse(name: string, kind: InventoryCatalogKind) {
  const normalized = normalizeWarehouseName(name);
  return kind === 'products'
    ? normalized === 'kho san pham' || normalized === 'kho thanh pham'
    : normalized === 'kho nvl' || normalized === 'kho nguyen vat lieu';
}

/** Khớp tên kho khi lọc danh mục: alias kho mặc định (SP↔thành phẩm, NVL↔nguyên vật liệu) + chưa gán kho. */
export function matchesWarehouseFilter(
  warehouse: string,
  warehouseFilter: string,
  options: { includeUnassigned?: boolean; skipFilter?: boolean } = {}
) {
  if (!warehouseFilter || options.skipFilter) return true;
  const value = String(warehouse ?? '').trim();
  const filter = String(warehouseFilter ?? '').trim();
  const isUnassigned = !value || value === '-';
  if (value === filter) return true;
  if (normalizeWarehouseName(value) === normalizeWarehouseName(filter)) return true;
  if (options.includeUnassigned && isUnassigned) return true;
  if (options.includeUnassigned) {
    const kind = warehouseCatalogKind(filter);
    if (isDefaultWarehouse(filter, kind) && isDefaultWarehouse(value, kind)) return true;
  }
  return false;
}

/**
 * Kho hàng: chọn kho rồi xem danh mục NVL/TP giống /kho-nvl và /san-pham
 * (danh sách + thêm/sửa/xóa), lọc theo tên kho đã chọn.
 */
export function InventoryCatalogPanel({ onBack }: { onBack: () => void }) {
  const materialsAccess = useTabAccess('materials');
  const productsAccess = useTabAccess('products');
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const names = await getCatalogCache('warehouses', async () => {
          const response = await fetch('/api/quan-ly-kho');
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Không thể tải danh sách kho.');
          const records: Array<{ ten_kho?: string }> = Array.isArray(data?.records) ? data.records : [];
          return Array.from(new Set(records.map(record => String(record.ten_kho ?? '').trim()).filter(Boolean)));
        });
        setWarehouses(names);
      } catch {
        setWarehouses([]);
      }
    };
    void loadWarehouses();
  }, []);

  const accessibleWarehouses = useMemo(
    () =>
      warehouses.filter(name => {
        const kind = warehouseCatalogKind(name);
        return kind === 'products' ? productsAccess.canView : materialsAccess.canView;
      }),
    [materialsAccess.canView, productsAccess.canView, warehouses]
  );

  const kind = selectedWarehouse
    ? warehouseCatalogKind(selectedWarehouse)
    : materialsAccess.canView
      ? 'materials'
      : 'products';

  useEffect(() => {
    if (!accessibleWarehouses.includes(selectedWarehouse)) {
      setSelectedWarehouse(accessibleWarehouses[0] || '');
    }
  }, [accessibleWarehouses, selectedWarehouse]);

  if (!materialsAccess.canView && !productsAccess.canView) return null;

  const warehousePicker = (
    <FilterCombobox
      label="Kho"
      options={accessibleWarehouses}
      value={selectedWarehouse}
      onChange={setSelectedWarehouse}
      formatOption={value => value}
      includeAll={false}
      searchPlaceholder="Tìm kho..."
    />
  );

  if (!selectedWarehouse) {
    return <div className="flex flex-wrap items-center gap-3">{warehousePicker}</div>;
  }

  if (kind === 'materials') {
    return (
      <MaterialsInventoryPanel
        onBack={onBack}
        warehouseFilter={selectedWarehouse}
        includeUnassigned
        topControls={warehousePicker}
      />
    );
  }

  return (
    <ProductsPanel
      onBack={onBack}
      warehouseFilter={selectedWarehouse}
      includeUnassigned
      topControls={warehousePicker}
    />
  );
}
