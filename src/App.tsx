import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { 
  ProductionReport, ShiftInfo, ProductEntry, MaterialBatches 
} from './types';
import { computeReportMetrics, formatNumber } from './utils';
import ShiftInfoForm from './components/ShiftInfoForm';
import ProductEntryForm from './components/ProductEntryForm';
import MaterialsForm from './components/MaterialsForm';
import WasteForm from './components/WasteForm';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import WeighingShiftSummary from './components/WeighingShiftSummary';
import { AppTab, pathFromTab, tabFromPath } from './routes';
import vietNhatLogoUrl from '../logovietnhat_1.png';
import { 
  FilePlus2, BarChart3, Layers, Wifi, WifiOff, 
  HelpCircle, CheckCircle, Smartphone, MapPin, 
  ChevronRight, ChevronLeft, Save, Sparkles, Loader2, Menu, History, UsersRound,
  Building2, UserPlus, Search, MoreVertical, ShieldCheck, BriefcaseBusiness, Package, Cpu, Plus, Boxes
} from 'lucide-react';

const STORAGE_DRAFT_KEY = 'factory_report_draft_v1';
const STORAGE_OFFLINE_KEY = 'factory_reports_offline_queue';

function VietNhatLogo() {
  return (
    <img
      src={vietNhatLogoUrl}
      alt="Viet Nhat IPT"
      className="brand-logo h-12 w-auto max-w-[190px] object-contain"
    />
  );
}

interface HrMember {
  id: string;
  code?: string;
  name: string;
  role: string;
  position?: string;
  shift: string;
  status: string;
}

interface HrDepartment {
  id: string;
  name: string;
  lead: string;
  members: HrMember[];
}

interface HrBranch {
  id: string;
  name: string;
  shortName: string;
  departments: HrDepartment[];
}

function normalizeHrBranches(data: unknown): HrBranch[] {
  if (!data || typeof data !== 'object') return [];
  const branches = (data as { branches?: unknown }).branches;
  if (!Array.isArray(branches)) return [];

  return branches
    .map((branch): HrBranch | null => {
      if (!branch || typeof branch !== 'object') return null;
      const record = branch as Record<string, unknown>;
      const departments = Array.isArray(record.departments) ? record.departments : [];
      const normalizedDepartments = departments
        .map((department): HrDepartment | null => {
          if (!department || typeof department !== 'object') return null;
          const departmentRecord = department as Record<string, unknown>;
          const members = Array.isArray(departmentRecord.members) ? departmentRecord.members : [];

          return {
            id: String(departmentRecord.id ?? departmentRecord.name ?? ''),
            name: String(departmentRecord.name ?? 'Chưa phân phòng ban'),
            lead: String(departmentRecord.lead ?? 'Chưa phân công'),
            members: members
              .map((member): HrMember | null => {
                if (!member || typeof member !== 'object') return null;
                const memberRecord = member as Record<string, unknown>;
                const name = String(memberRecord.name ?? '').trim();
                if (!name) return null;

                return {
                  id: String(memberRecord.id ?? memberRecord.code ?? name),
                  code: String(memberRecord.code ?? '').trim() || undefined,
                  name,
                  role: String(memberRecord.role ?? 'Nhân sự'),
                  position: String(memberRecord.position ?? '').trim() || undefined,
                  shift: String(memberRecord.shift ?? 'Theo phân công'),
                  status: String(memberRecord.status ?? 'Đang làm')
                };
              })
              .filter((member): member is HrMember => Boolean(member))
          };
        })
        .filter((department): department is HrDepartment => Boolean(department));

      return {
        id: String(record.id ?? record.name ?? ''),
        name: String(record.name ?? 'Chưa phân chi nhánh'),
        shortName: String(record.shortName ?? record.name ?? 'Chi nhánh'),
        departments: normalizedDepartments
      };
    })
    .filter((branch): branch is HrBranch => Boolean(branch));
}

interface ProductRow {
  id: string;
  code: string;
  newCode: string;
  name: string;
  nature: string;
  group: string;
  unit: string;
  stock: string;
  minStock: string;
  origin: string;
  description: string;
}

function normalizeProducts(data: unknown): ProductRow[] {
  if (!data || typeof data !== 'object') return [];
  const products = (data as { products?: unknown }).products;
  if (!Array.isArray(products)) return [];

  return products
    .map((item): ProductRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = String(record.ma_sp ?? record.code ?? '').trim();
      const name = String(record.ten_sp ?? record.name ?? '').trim();
      if (!code && !name) return null;

      return {
        id: code || name,
        code,
        newCode: String(record.ma_sp_moi ?? '').trim(),
        name,
        nature: String(record.tinh_chat ?? '').trim() || 'Chưa phân loại',
        group: String(record.nhom_vthh ?? '').trim() || 'Chưa nhóm',
        unit: String(record.don_vi ?? '').trim() || '-',
        stock: record.sl_ton === null || record.sl_ton === undefined ? '-' : String(record.sl_ton),
        minStock:
          record.so_luong_ton_toi_thieu === null || record.so_luong_ton_toi_thieu === undefined
            ? '-'
            : String(record.so_luong_ton_toi_thieu),
        origin: String(record.nguon_goc ?? '').trim() || '-',
        description: String(record.mo_ta ?? '').trim()
      };
    })
    .filter((product): product is ProductRow => Boolean(product));
}

function ProductsPanel({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set());
  const [qrImages, setQrImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      setIsLoadingProducts(true);
      setProductError('');

      try {
        const res = await fetch('/api/san-pham?format=table');
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải sản phẩm từ Supabase.');
        }

        if (!cancelled) {
          setProducts(normalizeProducts(data));
        }
      } catch (error: any) {
        if (!cancelled) {
          setProducts([]);
          setProductError(error.message || 'Không thể tải sản phẩm từ Supabase.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProducts(false);
        }
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const productGroups = useMemo(
    () => ['all', ...Array.from(new Set(products.map(product => product.group))).sort((a, b) => a.localeCompare(b, 'vi'))],
    [products]
  );
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesGroup = selectedGroup === 'all' || product.group === selectedGroup;
      const matchesSearch =
        !normalizedSearch ||
        `${product.code} ${product.newCode} ${product.name} ${product.nature} ${product.group} ${product.origin}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesGroup && matchesSearch;
    });
  }, [normalizedSearch, products, selectedGroup]);

  const natureCount = new Set(products.map(product => product.nature)).size;
  const unitCount = new Set(products.map(product => product.unit).filter(Boolean)).size;
  const selectedProducts = useMemo(
    () => products.filter(product => selectedProductIds.has(product.id)),
    [products, selectedProductIds]
  );
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(product => selectedProductIds.has(product.id));

  useEffect(() => {
    let cancelled = false;

    const generateQrImages = async () => {
      const nextEntries = await Promise.all(
        products
          .filter(product => product.code)
          .map(async product => {
            const url = await QRCode.toDataURL(product.code, {
              errorCorrectionLevel: 'H',
              margin: 1,
              width: 160,
              color: {
                dark: '#111111',
                light: '#ffffff'
              }
            });
            return [product.id, url] as const;
          })
      );

      if (!cancelled) {
        setQrImages(Object.fromEntries(nextEntries));
      }
    };

    if (products.length > 0) {
      generateQrImages();
    } else {
      setQrImages({});
    }

    return () => {
      cancelled = true;
    };
  }, [products]);

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleFilteredProducts = () => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredProducts.forEach(product => next.delete(product.id));
      } else {
        filteredProducts.forEach(product => next.add(product.id));
      }
      return next;
    });
  };

  const handlePrintSelectedQr = () => {
    if (selectedProducts.length === 0) return;
    window.print();
  };

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Danh mục sản phẩm</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Sản phẩm</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase san_pham.
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:border-[#ef1b2d] hover:bg-[#ef1b2d]"
            >
              Menu
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Sản phẩm', products.length],
              ['Nhóm VTHH', productGroups.length > 0 ? productGroups.length - 1 : 0],
              ['Đơn vị', unitCount || natureCount]
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
          {productGroups.map(group => (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(group)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedGroup === group
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {group === 'all' ? 'Tất cả' : group}
            </button>
          ))}
          {isLoadingProducts && (
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
            placeholder="Tìm mã, tên, nhóm, nguồn gốc..."
            disabled={isLoadingProducts || products.length === 0}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {productError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {productError}
          </p>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm">
        <div>
          <p className="text-sm font-black text-zinc-950">In mã QR sản phẩm</p>
          <p className="mt-0.5 text-xs font-semibold text-zinc-500">
            Đã chọn {selectedProducts.length} dòng. Nội dung QR là mã sản phẩm.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleFilteredProducts}
            disabled={filteredProducts.length === 0}
            className="h-10 rounded-xl border border-zinc-200 px-3 text-xs font-black text-zinc-700 transition hover:border-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allFilteredSelected ? 'Bỏ chọn bộ lọc' : 'Chọn các dòng đang lọc'}
          </button>
          <button
            type="button"
            onClick={handlePrintSelectedQr}
            disabled={selectedProducts.length === 0}
            className="h-10 rounded-xl bg-[#ef1b2d] px-4 text-xs font-black text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            In QR đã chọn
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1320px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleFilteredProducts}
                    className="h-4 w-4 accent-[#ef1b2d]"
                    aria-label="Chọn tất cả sản phẩm đang lọc"
                  />
                </th>
                <th className="px-4 py-3 font-black">Mã SP</th>
                <th className="px-4 py-3 font-black">Mã QR</th>
                <th className="px-4 py-3 font-black">Mã mới</th>
                <th className="px-4 py-3 font-black">Tên sản phẩm</th>
                <th className="px-4 py-3 font-black">Tính chất</th>
                <th className="px-4 py-3 font-black">Nhóm</th>
                <th className="px-4 py-3 font-black">Đơn vị</th>
                <th className="px-4 py-3 font-black">Tồn</th>
                <th className="px-4 py-3 font-black">Tồn tối thiểu</th>
                <th className="px-4 py-3 font-black">Nguồn gốc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredProducts.map(product => (
                <tr key={`${product.code}-${product.name}`} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.has(product.id)}
                      onChange={() => toggleProduct(product.id)}
                      className="h-4 w-4 accent-[#ef1b2d]"
                      aria-label={`Chọn in QR ${product.code}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-black text-zinc-950">{product.code || '-'}</td>
                  <td className="px-4 py-3">
                    {qrImages[product.id] ? (
                      <div className="relative h-16 w-16 rounded-lg border border-zinc-200 bg-white p-1">
                        <img src={qrImages[product.id]} alt={`QR ${product.code}`} className="h-full w-full" />
                        <span className="absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded bg-white p-0.5 shadow-sm">
                          <img src={vietNhatLogoUrl} alt="Logo Viet Nhat" className="max-h-full max-w-full object-contain" />
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-zinc-300">Đang tạo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{product.newCode || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="font-black text-zinc-950">{product.name || '-'}</div>
                    {product.description && (
                      <div className="mt-0.5 max-w-sm truncate text-xs font-semibold text-zinc-400">{product.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#ef1b2d]/20 bg-red-50 px-2.5 py-1 text-xs font-black text-[#ef1b2d]">
                      {product.nature}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-zinc-700">{product.group}</td>
                  <td className="px-4 py-3 font-bold text-zinc-700">{product.unit}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{product.stock}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{product.minStock}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{product.origin}</td>
                </tr>
              ))}

              {!isLoadingProducts && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Không có sản phẩm phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="qr-print-sheet">
        <div className="qr-print-page">
          {selectedProducts.map(product => (
            <div key={`print-${product.id}`} className="qr-print-card">
              <div className="qr-print-code">
                {qrImages[product.id] && <img src={qrImages[product.id]} alt={`QR ${product.code}`} />}
                <span>
                  <img src={vietNhatLogoUrl} alt="Logo Viet Nhat" />
                </span>
              </div>
              <div className="qr-print-meta">
                <strong>{product.code || '-'}</strong>
                <p>{product.name || '-'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface MachineRow {
  id: string;
  code: string;
  name: string;
  type: string;
  branch: string;
  location: string;
  status: string;
  note: string;
}

function pickText(record: Record<string, unknown>, keys: string[], fallback = '-') {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return fallback;
}

function normalizeMachines(data: unknown): MachineRow[] {
  if (!data || typeof data !== 'object') return [];
  const machines = (data as { machines?: unknown }).machines;
  if (!Array.isArray(machines)) return [];

  return machines
    .map((item): MachineRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = pickText(record, ['ma_may', 'ma_so_may', 'machine_code', 'code', 'id'], '');
      const name = pickText(record, ['ten_may', 'may', 'machine_name', 'name'], '');
      if (!code && !name) return null;

      return {
        id: pickText(record, ['id'], code || name),
        code,
        name,
        type: pickText(record, ['loai_may', 'nhom_may', 'type', 'category'], 'Chưa phân loại'),
        branch: pickText(record, ['chi_nhanh', 'co_so', 'branch'], '-'),
        location: pickText(record, ['vi_tri', 'khu_vuc', 'location', 'line'], '-'),
        status: pickText(record, ['trang_thai', 'status', 'tinh_trang'], 'Đang dùng'),
        note: pickText(record, ['ghi_chu', 'mo_ta', 'note', 'description'], '')
      };
    })
    .filter((machine): machine is MachineRow => Boolean(machine));
}

function MachinesPanel({ onBack }: { onBack: () => void }) {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [isLoadingMachines, setIsLoadingMachines] = useState(true);
  const [machineError, setMachineError] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSavingMachine, setIsSavingMachine] = useState(false);
  const [addError, setAddError] = useState('');
  const [newMachine, setNewMachine] = useState({
    code: '',
    name: '',
    type: '',
    branch: 'Đà Nẵng',
    location: '',
    status: 'Đang dùng',
    note: ''
  });

  const loadMachines = async () => {
    setIsLoadingMachines(true);
    setMachineError('');

    try {
      const res = await fetch('/api/danh-sach-may');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải danh sách máy từ Supabase.');
      }

      setMachines(normalizeMachines(data));
    } catch (error: any) {
      setMachines([]);
      setMachineError(error.message || 'Không thể tải danh sách máy từ Supabase.');
    } finally {
      setIsLoadingMachines(false);
    }
  };

  useEffect(() => {
    loadMachines();
  }, []);

  const handleAddMachine = async () => {
    if (!newMachine.code.trim() || !newMachine.name.trim()) {
      setAddError('Vui lòng nhập mã máy và tên máy.');
      return;
    }

    setIsSavingMachine(true);
    setAddError('');

    try {
      const res = await fetch('/api/danh-sach-may', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMachine)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể thêm máy mới.');
      }

      setIsAddOpen(false);
      setNewMachine({
        code: '',
        name: '',
        type: '',
        branch: 'Đà Nẵng',
        location: '',
        status: 'Đang dùng',
        note: ''
      });
      await loadMachines();
    } catch (error: any) {
      setAddError(error.message || 'Không thể thêm máy mới.');
    } finally {
      setIsSavingMachine(false);
    }
  };

  const machineTypes = useMemo(
    () => ['all', ...Array.from(new Set(machines.map(machine => machine.type))).sort((a, b) => a.localeCompare(b, 'vi'))],
    [machines]
  );
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredMachines = useMemo(() => {
    return machines.filter(machine => {
      const matchesType = selectedType === 'all' || machine.type === selectedType;
      const matchesSearch =
        !normalizedSearch ||
        `${machine.code} ${machine.name} ${machine.type} ${machine.branch} ${machine.location} ${machine.status}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesType && matchesSearch;
    });
  }, [machines, normalizedSearch, selectedType]);

  const branchCount = new Set(machines.map(machine => machine.branch).filter(branch => branch && branch !== '-')).size;
  const activeCount = machines.filter(machine => /đang|hoạt|active|dung|dùng/i.test(machine.status)).length;

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Thiết bị sản xuất</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Danh sách máy</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase danh_sach_may.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setAddError('');
                  setIsAddOpen(true);
                }}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>
              <button
                type="button"
                onClick={onBack}
                className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:border-[#ef1b2d] hover:bg-[#ef1b2d]"
              >
                Menu
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Máy', machines.length],
              ['Đang dùng', activeCount],
              ['Chi nhánh', branchCount]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="block font-bold text-zinc-400">{label}</span>
                <span className="mt-1 block text-xl font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Thêm máy mới</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">Ghi vào bảng danh_sach_may trên Supabase</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã máy *</span>
                <input
                  value={newMachine.code}
                  onChange={e => setNewMachine(prev => ({ ...prev, code: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                  placeholder="VD: MAY-01"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tên máy *</span>
                <input
                  value={newMachine.name}
                  onChange={e => setNewMachine(prev => ({ ...prev, name: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                  placeholder="VD: Máy đùn PE 01"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Loại/Nhóm</span>
                <input
                  value={newMachine.type}
                  onChange={e => setNewMachine(prev => ({ ...prev, type: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                  placeholder="VD: Đùn PE"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Chi nhánh</span>
                <input
                  value={newMachine.branch}
                  onChange={e => setNewMachine(prev => ({ ...prev, branch: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Vị trí</span>
                <input
                  value={newMachine.location}
                  onChange={e => setNewMachine(prev => ({ ...prev, location: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                  placeholder="VD: Khu A"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Trạng thái</span>
                <select
                  value={newMachine.status}
                  onChange={e => setNewMachine(prev => ({ ...prev, status: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                >
                  <option value="Đang dùng">Đang dùng</option>
                  <option value="Bảo trì">Bảo trì</option>
                  <option value="Ngừng">Ngừng</option>
                </select>
              </label>
              <label className="col-span-2 space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
                <input
                  value={newMachine.note}
                  onChange={e => setNewMachine(prev => ({ ...prev, note: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              {addError && (
                <p className="mr-auto text-xs font-bold text-rose-600">{addError}</p>
              )}
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddMachine}
                disabled={isSavingMachine}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingMachine ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSavingMachine ? 'Đang lưu...' : 'Lưu máy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {machineTypes.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedType === type
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {type === 'all' ? 'Tất cả' : type}
            </button>
          ))}
          {isLoadingMachines && (
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
            placeholder="Tìm mã máy, tên máy, vị trí..."
            disabled={isLoadingMachines}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {machineError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {machineError}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã máy</th>
                <th className="px-4 py-3 font-black">Tên máy</th>
                <th className="px-4 py-3 font-black">Loại/Nhóm</th>
                <th className="px-4 py-3 font-black">Chi nhánh</th>
                <th className="px-4 py-3 font-black">Vị trí</th>
                <th className="px-4 py-3 font-black">Trạng thái</th>
                <th className="px-4 py-3 font-black">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredMachines.map(machine => (
                <tr key={machine.id} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{machine.code || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-black text-zinc-950">
                      <Cpu className="h-4 w-4 text-[#ef1b2d]" />
                      {machine.name || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-zinc-700">{machine.type}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{machine.branch}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{machine.location}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#ef1b2d]/20 bg-red-50 px-2.5 py-1 text-xs font-black text-[#ef1b2d]">
                      {machine.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-500">{machine.note || '-'}</td>
                </tr>
              ))}

              {!isLoadingMachines && filteredMachines.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Bảng danh_sach_may chưa có dữ liệu hoặc không có máy phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

interface MaterialRow {
  id: string;
  code: string;
  name: string;
  unit: string;
  totalWeight: string;
  plasticWeight: string;
  bagWeight: string;
  coreWeight: string;
  rollWidth: string;
  unitLength: string;
  openingStock: string;
  inbound: string;
  outbound: string;
}

function formatCell(value: unknown) {
  return value === null || value === undefined || String(value).trim() === '' ? '-' : String(value);
}

function normalizeMaterialsInventory(data: unknown): MaterialRow[] {
  if (!data || typeof data !== 'object') return [];
  const materials = (data as { materials?: unknown }).materials;
  if (!Array.isArray(materials)) return [];

  return materials
    .map((item): MaterialRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = String(record.ma_npl ?? '').trim();
      const name = String(record.ten_npl ?? '').trim();
      if (!code && !name) return null;

      return {
        id: code || name,
        code,
        name,
        unit: formatCell(record.don_vi),
        totalWeight: formatCell(record.tong_trong_luong),
        plasticWeight: formatCell(record.trong_luong_nhua),
        bagWeight: formatCell(record.trong_luong_tui),
        coreWeight: formatCell(record.trong_luong_loi),
        rollWidth: formatCell(record.kho_cuon),
        unitLength: formatCell(record.chieu_dai_don_vi),
        openingStock: formatCell(record.ton_dau_ky),
        inbound: formatCell(record.nhap_trong_ky),
        outbound: formatCell(record.xuat_trong_ky)
      };
    })
    .filter((material): material is MaterialRow => Boolean(material));
}

function MaterialsInventoryPanel({ onBack }: { onBack: () => void }) {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [materialsError, setMaterialsError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadMaterials = async () => {
      setIsLoadingMaterials(true);
      setMaterialsError('');

      try {
        const res = await fetch('/api/kho-nvl');
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải nguyên phụ liệu từ Supabase.');
        }

        if (!cancelled) {
          setMaterials(normalizeMaterialsInventory(data));
        }
      } catch (error: any) {
        if (!cancelled) {
          setMaterials([]);
          setMaterialsError(error.message || 'Không thể tải nguyên phụ liệu từ Supabase.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMaterials(false);
        }
      }
    };

    loadMaterials();

    return () => {
      cancelled = true;
    };
  }, []);

  const units = useMemo(
    () => ['all', ...Array.from(new Set(materials.map(material => material.unit).filter(unit => unit !== '-'))).sort((a, b) => a.localeCompare(b, 'vi'))],
    [materials]
  );
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredMaterials = useMemo(() => {
    return materials.filter(material => {
      const matchesUnit = selectedUnit === 'all' || material.unit === selectedUnit;
      const matchesSearch =
        !normalizedSearch ||
        `${material.code} ${material.name} ${material.unit}`.toLowerCase().includes(normalizedSearch);
      return matchesUnit && matchesSearch;
    });
  }, [materials, normalizedSearch, selectedUnit]);

  const totalPlasticWeight = materials.reduce((sum, material) => {
    const value = Number(material.plasticWeight);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Kho vật tư</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Nguyên phụ liệu</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase kho_nvl.
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:border-[#ef1b2d] hover:bg-[#ef1b2d]"
            >
              Menu
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Mã NPL', materials.length],
              ['Đơn vị', units.length > 0 ? units.length - 1 : 0],
              ['Kg nhựa', formatNumber(totalPlasticWeight)]
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
          {units.map(unit => (
            <button
              key={unit}
              type="button"
              onClick={() => setSelectedUnit(unit)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedUnit === unit
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {unit === 'all' ? 'Tất cả' : unit}
            </button>
          ))}
          {isLoadingMaterials && (
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
            placeholder="Tìm mã NPL, tên nguyên phụ liệu..."
            disabled={isLoadingMaterials || materials.length === 0}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {materialsError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {materialsError}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã NPL</th>
                <th className="px-4 py-3 font-black">Tên nguyên phụ liệu</th>
                <th className="px-4 py-3 font-black">Đơn vị</th>
                <th className="px-4 py-3 font-black">Tổng kg</th>
                <th className="px-4 py-3 font-black">Kg nhựa</th>
                <th className="px-4 py-3 font-black">Kg túi</th>
                <th className="px-4 py-3 font-black">Kg lõi</th>
                <th className="px-4 py-3 font-black">Khổ cuộn</th>
                <th className="px-4 py-3 font-black">Dài ĐV</th>
                <th className="px-4 py-3 font-black">Tồn đầu</th>
                <th className="px-4 py-3 font-black">Nhập</th>
                <th className="px-4 py-3 font-black">Xuất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredMaterials.map(material => (
                <tr key={`${material.code}-${material.name}`} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{material.code || '-'}</td>
                  <td className="px-4 py-3 font-black text-zinc-950">{material.name || '-'}</td>
                  <td className="px-4 py-3 font-bold text-zinc-700">{material.unit}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.totalWeight}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#ef1b2d]/20 bg-red-50 px-2.5 py-1 text-xs font-black text-[#ef1b2d]">
                      {material.plasticWeight}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.bagWeight}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.coreWeight}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.rollWidth}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.unitLength}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.openingStock}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.inbound}</td>
                  <td className="px-4 py-3 font-mono font-bold text-zinc-700">{material.outbound}</td>
                </tr>
              ))}

              {!isLoadingMaterials && filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Không có nguyên phụ liệu phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function HumanResourcesPanel({ onBack }: { onBack: () => void }) {
  const [branches, setBranches] = useState<HrBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadStaffGroups = async () => {
      setIsLoadingStaff(true);
      setStaffError('');

      try {
        const res = await fetch('/api/nhan-su?format=groups&scope=all');
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải nhân sự từ Supabase.');
        }

        const nextBranches = normalizeHrBranches(data);
        if (!cancelled) {
          setBranches(nextBranches);
          setSelectedBranchId(prev => prev || nextBranches[0]?.id || '');
        }
      } catch (error: any) {
        if (!cancelled) {
          setBranches([]);
          setStaffError(error.message || 'Không thể tải nhân sự từ Supabase.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStaff(false);
        }
      }
    };

    loadStaffGroups();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBranch = branches.find(branch => branch.id === selectedBranchId) ?? branches[0];
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredDepartments = useMemo(() => {
    if (!selectedBranch) return [];
    if (!normalizedSearch) return selectedBranch.departments;

    return selectedBranch.departments
      .map(department => ({
        ...department,
        members: department.members.filter(member =>
          `${member.name} ${member.role} ${member.shift}`.toLowerCase().includes(normalizedSearch)
        )
      }))
      .filter(department =>
        department.name.toLowerCase().includes(normalizedSearch) ||
        department.lead.toLowerCase().includes(normalizedSearch) ||
        department.members.length > 0
      );
  }, [normalizedSearch, selectedBranch]);

  const totalDepartments = selectedBranch?.departments.length ?? 0;
  const totalMembers = selectedBranch?.departments.reduce((sum, department) => sum + department.members.length, 0) ?? 0;
  const activeMembers = selectedBranch?.departments.reduce(
    (sum, department) => sum + department.members.filter(member => member.status === 'Đang làm').length,
    0
  ) ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-950 bg-white shadow-sm">
        <div className="bg-zinc-950 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Quản lý nhân sự</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Chi nhánh & Phòng ban</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Theo dõi nhóm nhân sự theo từng chi nhánh, phòng ban và ca làm việc.
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:border-[#ef1b2d] hover:bg-[#ef1b2d]"
            >
              Menu
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Phòng ban', totalDepartments],
              ['Nhân sự', totalMembers],
              ['Đang làm', activeMembers]
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
          {branches.map(branch => (
            <button
              key={branch.id}
              type="button"
              onClick={() => setSelectedBranchId(branch.id)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedBranchId === branch.id
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {branch.shortName}
            </button>
          ))}
          {isLoadingStaff && (
            <div className="flex h-11 shrink-0 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-500">
              Đang tải Supabase...
            </div>
          )}
        </div>

        <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 lg:mt-0 lg:w-[360px]">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Tìm tên, chức vụ, ca làm..."
            disabled={isLoadingStaff || branches.length === 0}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {staffError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {staffError}
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {!isLoadingStaff && !staffError && branches.length === 0 && (
          <div className="rounded-2xl border-2 border-zinc-900/10 bg-white px-4 py-8 text-center text-sm font-bold text-zinc-500">
            Supabase chưa có dữ liệu nhân sự để hiển thị.
          </div>
        )}

        {filteredDepartments.map(department => (
          <article
            key={department.id}
            className="overflow-hidden rounded-xl border-2 border-zinc-900/10 bg-white shadow-sm"
          >
            <div className="flex items-start justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2">
              <div className="flex min-w-0 gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-[#ef1b2d]">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black leading-tight text-zinc-950">{department.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#ef1b2d]" />
                    <span className="truncate">Trưởng nhóm: {department.lead}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Thêm nhân sự vào ${department.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ef1b2d] text-white transition hover:bg-[#b30d1c]"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-zinc-100">
              {department.members.map(member => (
                <div key={`${department.id}-${member.name}`} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-xs font-black text-white">
                    {member.name.split(' ').slice(-1)[0].charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black leading-tight text-zinc-950">{member.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <BriefcaseBusiness className="h-3 w-3" />
                        {member.role}
                      </span>
                      <span className="rounded-full border border-zinc-200 px-1.5 py-0.5">{member.shift}</span>
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-black ${
                    member.status === 'Đang làm'
                      ? 'border-[#ef1b2d]/20 bg-red-50 text-[#ef1b2d]'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                  }`}>
                    {member.status}
                  </span>
                  <button type="button" className="h-7 w-7 shrink-0 rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-950">
                    <MoreVertical className="mx-auto h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {department.members.length === 0 && (
                <div className="px-4 py-5 text-center text-sm font-semibold text-zinc-500">
                  Không có nhân sự phù hợp bộ lọc.
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

const DEFAULT_REPORT: Omit<ProductionReport, 'id' | 'createdAt'> = {
  date: new Date().toISOString().split('T')[0],
  shiftInfo: {
    machineId: '',
    shiftName: '',
    operatorName: '',
    assistantName: ''
  },
  productEntry: {
    productCode: '',
    rolls: 0,
    actualWeight: 0
  },
  materials: {
    virginPlastic: [0],
    recycledPlastic: [0],
    brightenerPowder: [0],
    dispersionOil: [0],
    otherAdditives: [0]
  },
  wasteWeight: 0,
  notes: ''
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => tabFromPath(window.location.pathname));
  const [currentStep, setCurrentStep] = useState<number>(1); // 1: Shift & Product, 2: Materials, 3: Waste & Submit
  const [reportForm, setReportForm] = useState<Omit<ProductionReport, 'id' | 'createdAt'>>(DEFAULT_REPORT);
  const [reports, setReports] = useState<ProductionReport[]>([]);
  
  // App states
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [isFetchLoading, setIsFetchLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notifications, setNotifications] = useState<{ id: string; text: string; type: 'success' | 'error' | 'warning' }[]>([]);
  const [offlineReports, setOfflineReports] = useState<ProductionReport[]>([]);
  const navigateToTab = (tab: AppTab, options?: { replace?: boolean }) => {
    const path = pathFromTab(tab);

    if (window.location.pathname !== path) {
      if (options?.replace) {
        window.history.replaceState({ tab }, '', path);
      } else {
        window.history.pushState({ tab }, '', path);
      }
    }

    setActiveTab(tab);

    if (tab === 'dashboard') {
      fetchReports();
    }
  };

  const handleNavClick = (event: React.MouseEvent<HTMLAnchorElement>, tab: AppTab) => {
    event.preventDefault();
    navigateToTab(tab);
  };

  // 1. Fetch reports from Server DB
  const fetchReports = async () => {
    setIsFetchLoading(true);
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      } else {
        addNotification('Không thể lấy báo cáo từ máy chủ. Đang hiển thị bản lưu thiết bị.', 'warning');
      }
    } catch (err) {
      addNotification('Mất kết nối máy chủ dữ liệu. Kiểm tra sóng di động.', 'warning');
    } finally {
      setIsFetchLoading(false);
    }
  };

  // Sync / loading on mount
  useEffect(() => {
    fetchReports();

    // Check navigator online status
    const handleOnline = () => {
      setIsOnline(true);
      addNotification('Thiết bị trực tuyến bản ghi. Sẵn sàng đồng bộ!', 'success');
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      addNotification('Đã ngắt mạng kết nối. Đang kích hoạt lưu cục bộ.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handlePopState = () => {
      const tab = tabFromPath(window.location.pathname);
      setActiveTab(tab);
      if (tab === 'dashboard') {
        fetchReports();
      }
    };
    window.addEventListener('popstate', handlePopState);

    // Load draft from localStorage on start
    const cachedDraft = localStorage.getItem(STORAGE_DRAFT_KEY);
    if (cachedDraft) {
      try {
        setReportForm(JSON.parse(cachedDraft));
      } catch (e) {
        console.error('Lỗi khi phục hồi bản nháp:', e);
      }
    }

    // Load offline queue
    const cachedQueue = localStorage.getItem(STORAGE_OFFLINE_KEY);
    if (cachedQueue) {
      try {
        setOfflineReports(JSON.parse(cachedQueue));
      } catch (e) {
        console.error('Lỗi phục hồi hàng chờ ngoại tuyến:', e);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Sync draft to storage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(reportForm));
  }, [reportForm]);

  // Sync offline queue to storage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_OFFLINE_KEY, JSON.stringify(offlineReports));
  }, [offlineReports]);

  // Helper to add floating toast notifications
  const addNotification = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = `${Date.now()}`;
    setNotifications(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Submit a production report
  const handleSubmitReport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Complete form validation
    const { machineId, shiftName, operatorName, assistantName } = reportForm.shiftInfo;
    const { productCode, rolls, actualWeight } = reportForm.productEntry;
    
    if (!machineId || !shiftName || !operatorName || !assistantName) {
      addNotification('Vui lòng điền đầy đủ Thông tin Ca Trực ở Bước 1!', 'error');
      setCurrentStep(1);
      return;
    }
    if (!productCode || !rolls || !actualWeight) {
      addNotification('Vui lòng điền thông tin Thành Phẩm ở Bước 1!', 'error');
      setCurrentStep(1);
      return;
    }

    setIsSubmitLoading(true);

    try {
      if (isOnline) {
        // Send directly to Express Server API
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportForm)
        });

        if (res.ok) {
          const newRep = await res.json();
          addNotification('Lưu báo cáo lên database Đà Nẵng thành công!', 'success');
          // Update local list
          setReports(prev => [newRep, ...prev]);
          // Reset form draft
          handleResetForm();
        } else {
          // Server returned error, queue offline instead
          throw new Error('Server returned error status');
        }
      } else {
        // Offline capability fallback
        const offlineRep: ProductionReport = {
          ...reportForm,
          id: `rep_offline_${Date.now()}`,
          createdAt: new Date().toISOString()
        };
        setOfflineReports(prev => [offlineRep, ...prev]);
        addNotification('Mất sóng kho! Báo cáo đã lưu tạm tại LocalStorage trên máy dọn.', 'warning');
        // Reset form draft
        handleResetForm();
      }
    } catch (err) {
      // API error fallback
      const offlineRep: ProductionReport = {
        ...reportForm,
        id: `rep_offline_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      setOfflineReports(prev => [offlineRep, ...prev]);
      addNotification('Mất mạng kết nối. Đã lưu báo cáo dự phòng ngoại tuyến.', 'warning');
      handleResetForm();
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Synchronize queued offline reports once connection returns
  const syncOfflineQueue = async () => {
    const cachedQueue = localStorage.getItem(STORAGE_OFFLINE_KEY);
    if (!cachedQueue) return;
    
    try {
      const parsedQueue: ProductionReport[] = JSON.parse(cachedQueue);
      if (parsedQueue.length === 0) return;

      addNotification(`Đang tự động đồng bộ ${parsedQueue.length} báo cáo nộp tạm...`, 'success');

      for (const rep of parsedQueue) {
        // Stripe out id generated for offline identification so server assigns database order key
        const { id, ...cleanForm } = rep; 
        await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanForm)
        });
      }

      // Success, empty local table queue
      setOfflineReports([]);
      localStorage.setItem(STORAGE_OFFLINE_KEY, '[]');
      addNotification('Đồng bộ dữ liệu nộp tạm thành công!', 'success');
      // Reload main database
      fetchReports();
    } catch (e) {
      console.error('Không thể tự động đồng bộ báo cáo ngoại tuyến:', e);
    }
  };

  // Reset form helper
  const handleResetForm = () => {
    setReportForm(DEFAULT_REPORT);
    localStorage.removeItem(STORAGE_DRAFT_KEY);
    setCurrentStep(1);
    navigateToTab('menu', { replace: true });
  };

  // Reset Server Database (for demo and review testing)
  const handleResetDb = async () => {
    if (window.confirm('Vui lòng xác nhận khôi phục tất cả dữ liệu báo cáo về bản seeding mẫu?')) {
      try {
        const res = await fetch('/api/reports/reset', { method: 'POST' });
        if (res.ok) {
          const resJson = await res.json();
          setReports(resJson.data);
          addNotification('Khôi phục database mẫu Đà Nẵng thành công!', 'success');
        }
      } catch (e) {
        addNotification('Lỗi khi khôi phục database.', 'error');
      }
    }
  };

  // Wizard update handlers
  const updateShiftInfo = (updated: Partial<ShiftInfo>) => {
    setReportForm(prev => ({
      ...prev,
      shiftInfo: { ...prev.shiftInfo, ...updated }
    }));
  };

  const updateProductEntry = (updated: Partial<ProductEntry>) => {
    setReportForm(prev => ({
      ...prev,
      productEntry: { ...prev.productEntry, ...updated }
    }));
  };

  const updateMaterials = (updated: Partial<MaterialBatches>) => {
    setReportForm(prev => ({
      ...prev,
      materials: { ...prev.materials, ...updated }
    }));
  };

  const updateWasteAndNotes = (updates: { wasteWeight?: number; notes?: string }) => {
    setReportForm(prev => ({
      ...prev,
      ...updates
    }));
  };

  // Derived metrics for real-time stepper footer preview
  const activeMetrics = computeReportMetrics(reportForm);

  return (
    <div className={`h-[100dvh] overflow-hidden bg-[#151515] flex flex-col font-sans selection:bg-[#ef1b2d] selection:text-white ${
      activeTab === 'hr' || activeTab === 'products' || activeTab === 'machines' || activeTab === 'materials' ? 'sm:p-4' : 'sm:py-6 sm:px-4'
    }`} id="main-root-container">
      {/* Smartphone framework emulator on Wide Screens, fullscreen and intuitive on small touch screens */}
      <div className={`flex-1 min-h-0 w-full mx-auto bg-white sm:shadow-2xl overflow-hidden flex flex-col sm:border sm:border-zinc-800 ${
        activeTab === 'hr' || activeTab === 'products' || activeTab === 'machines' || activeTab === 'materials'
          ? 'max-w-none sm:rounded-2xl'
          : 'max-w-4xl sm:rounded-3xl'
      }`}>
        
        {/* Device Status Header / Bar */}
        <header className="sticky top-0 z-40 bg-white border-b-4 border-[#ef1b2d] px-4 py-3 shrink-0 flex items-center justify-between pt-safe">
          <div className="flex items-center gap-2">
            <VietNhatLogo />
          </div>

          {/* Network status and offline indicator pills */}
          <div className="flex items-center gap-1.5">
            {offlineReports.length > 0 && (
              <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full animate-pulse border border-rose-500/30">
                Tạm {offlineReports.length}
              </span>
            )}
            
            {isOnline ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <Wifi className="w-3.5 h-3.5" />
                Đồng bộ
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                <WifiOff className="w-3.5 h-3.5" />
                Ngoại tuyến
              </span>
            )}
          </div>
        </header>

        {/* Floating notifications / Toasts layout */}
        <div className="fixed top-14 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm mx-auto">
          <AnimatePresence>
            {notifications.map(n => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-3 rounded-xl border shadow-lg text-xs font-semibold flex items-start gap-2 backdrop-blur-md ${
                  n.type === 'success' 
                    ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' 
                    : n.type === 'error' 
                    ? 'bg-rose-950/90 border-rose-500/30 text-rose-200' 
                    : 'bg-amber-950/90 border-amber-500/30 text-amber-200'
                }`}
              >
                {n.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                <p className="flex-1 leading-relaxed">{n.text}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Main Content scrollable container viewport */}
        <main className="flex-1 min-h-0 overflow-y-auto bg-zinc-50 focus:outline-none p-4 md:p-6 pb-4" id="applet-viewport">
          <AnimatePresence mode="wait">
            {activeTab === 'menu' ? (
              <motion.div
                key="main-menu"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      title: 'Nhập báo cáo sản xuất',
                      desc: 'Ghi ca máy, mã hàng, nguyên liệu và phế phẩm.',
                      icon: FilePlus2,
                      action: () => navigateToTab('form')
                    },
                    {
                      title: 'Phiếu cân ca',
                      desc: 'Xem danh sách phiếu cân và cộng dồn theo ca.',
                      icon: History,
                      action: () => navigateToTab('weighing-summary')
                    },
                    {
                      title: 'Nhân sự',
                      desc: 'Quản lý thợ máy, phụ máy và phân công ca trực.',
                      icon: UsersRound,
                      action: () => navigateToTab('hr')
                    },
                    {
                      title: 'Sản phẩm',
                      desc: 'Xem danh mục mã hàng, nhóm VTHH, đơn vị và tồn kho.',
                      icon: Package,
                      action: () => navigateToTab('products')
                    },
                    {
                      title: 'Danh sách máy',
                      desc: 'Theo dõi mã máy, vị trí, loại máy và trạng thái vận hành.',
                      icon: Cpu,
                      action: () => navigateToTab('machines')
                    },
                    {
                      title: 'Nguyên phụ liệu',
                      desc: 'Xem kho NPL, trọng lượng, khổ cuộn và tồn nhập xuất.',
                      icon: Boxes,
                      action: () => navigateToTab('materials')
                    },
                    {
                      title: 'Phân tích & đối chiếu',
                      desc: 'Kiểm tra báo cáo đã lưu, biểu đồ và dữ liệu mẫu.',
                      icon: BarChart3,
                      action: () => navigateToTab('dashboard')
                    }
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.title}
                        type="button"
                        onClick={item.action}
                        className="group relative min-h-[128px] overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white p-4 text-left shadow-sm transition hover:border-[#ef1b2d] hover:shadow-[0_12px_32px_rgba(17,17,17,0.12)] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#ef1b2d]/25"
                      >
                        <span className="absolute inset-x-0 top-0 h-1 bg-zinc-900 transition group-hover:bg-[#ef1b2d]" />
                        <div className="flex items-start gap-3">
                          <span className="h-11 w-11 rounded-xl border border-zinc-800 bg-zinc-950 text-[#ef1b2d] flex items-center justify-center shrink-0 shadow-sm group-hover:border-[#ef1b2d] group-hover:bg-[#ef1b2d]/10 transition">
                            <Icon className="w-5 h-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-black leading-snug text-slate-900">{item.title}</span>
                            <span className="mt-1.5 block text-sm font-medium leading-5 text-slate-500">{item.desc}</span>
                          </span>
                          <ChevronRight className="mt-1 w-4 h-4 text-zinc-400 group-hover:text-[#ef1b2d] shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </section>
              </motion.div>
            ) : activeTab === 'form' ? (
              <motion.div
                key="form-stepper"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Visual Wizard Stepper Indicator */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider leading-none">BƯỚC</span>
                    <span className="text-lg font-black text-slate-800 leading-none">{currentStep}/3</span>
                  </div>
                  
                  {/* Visual segment progress lines */}
                  <div className="flex-1 mx-4 flex gap-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${currentStep >= 1 ? 'bg-emerald-500 w-1/3' : 'w-0'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${currentStep >= 2 ? 'bg-emerald-500 w-1/3' : 'w-0'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${currentStep >= 3 ? 'bg-emerald-500 w-1/3' : 'w-0'}`} />
                  </div>

                  <span className="text-[11px] font-bold text-slate-500 shrink-0">
                    {currentStep === 1 ? 'Thông tin & Mã hàng' : currentStep === 2 ? 'Phối trộn polymer' : 'Phế phẩm & Lưu'}
                  </span>
                </div>

                {/* Stepper Card Frame */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm min-h-[300px]">
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <ShiftInfoForm data={reportForm.shiftInfo} onChange={updateShiftInfo} />
                      <div className="pt-2 border-t border-slate-100">
                        <ProductEntryForm data={reportForm.productEntry} onChange={updateProductEntry} />
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <MaterialsForm data={reportForm.materials} onChange={updateMaterials} />
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <WasteForm 
                        wasteWeight={reportForm.wasteWeight} 
                        notes={reportForm.notes || ''} 
                        onChange={updateWasteAndNotes} 
                      />

                      {/* Final layout summary review before submission */}
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                          Tổng Hợp Kết Quả Báo Cáo
                        </h4>

                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-semibold py-1 border-b border-slate-800">
                          <div>Ca máy: <span className="text-slate-300 block">{reportForm.shiftInfo.machineId.split(' ')[0] || '--'}</span></div>
                          <div>Mã hàng: <span className="text-slate-300 block">{reportForm.productEntry.productCode || '--'}</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs py-1 border-b border-slate-800 font-mono">
                          <div>Polymer phối: <strong className="text-indigo-400 text-sm block">{formatNumber(activeMetrics.totalPlastic)} kg</strong></div>
                          <div>Thành phẩm: <strong className="text-emerald-400 text-sm block">{formatNumber(activeMetrics.actualProductWeight)} kg</strong></div>
                        </div>

                        {/* Variance result */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Phế phẩm: <strong className="text-rose-400">{formatNumber(reportForm.wasteWeight)} kg</strong></span>
                          <span>Tỉ lệ hao hụt: <strong className={`${
                            activeMetrics.status === 'optimal' ? 'text-emerald-400' : activeMetrics.status === 'warning' ? 'text-amber-400' : 'text-rose-400'
                          }`}>{formatNumber(activeMetrics.variancePercent)}%</strong></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submitting / Loader overlay */}
                {isSubmitLoading && (
                  <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="p-5 bg-white rounded-2xl shadow-xl flex items-center gap-3.5 text-slate-800 font-bold max-w-sm">
                      <Loader2 className="w-6 h-6 text-emerald-600 animate-spin shrink-0" />
                      <span>Đang mã hóa & đồng bộ dữ liệu Đà Nẵng...</span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : activeTab === 'weighing-summary' ? (
              <motion.div
                key="weighing-summary"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <WeighingShiftSummary />
              </motion.div>
            ) : activeTab === 'hr' ? (
              <motion.div
                key="human-resources"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <HumanResourcesPanel onBack={() => navigateToTab('menu')} />
              </motion.div>
            ) : activeTab === 'products' ? (
              <motion.div
                key="products"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <ProductsPanel onBack={() => navigateToTab('menu')} />
              </motion.div>
            ) : activeTab === 'machines' ? (
              <motion.div
                key="machines"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <MachinesPanel onBack={() => navigateToTab('menu')} />
              </motion.div>
            ) : activeTab === 'materials' ? (
              <motion.div
                key="materials"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <MaterialsInventoryPanel onBack={() => navigateToTab('menu')} />
              </motion.div>
            ) : (
              <motion.div
                key="dashboard-charts"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <AnalyticsDashboard 
                  reports={reports} 
                  onResetDb={handleResetDb} 
                  isLoading={isFetchLoading} 
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Dynamic STICKY Wizard Footer Bar for Form Inputs - locked at bottom, min height 44px layout */}
        {activeTab === 'form' && (
          <footer className="z-30 shrink-0 border-t border-slate-200 bg-white px-4 py-3.5 shadow-lg flex items-center justify-between" id="sticky-wizard-footer">
            <div className="flex-1 flex gap-3">
              {currentStep > 1 ? (
                <button
                  type="button"
                  id="wizard-prev-btn"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="h-12 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition font-bold text-sm text-slate-600 flex items-center justify-center gap-1 active:scale-95"
                  style={{ minHeight: '44px' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Quay lại</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Khôi phục bản ghi nháp hiện tại?')) {
                      setReportForm(DEFAULT_REPORT);
                      localStorage.removeItem(STORAGE_DRAFT_KEY);
                      addNotification('Đã xóa trắng nháp báo cáo!', 'success');
                    }
                  }}
                  className="h-12 px-4 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 transition font-bold text-xs text-slate-500 shrink-0 active:scale-95"
                  style={{ minHeight: '44px' }}
                >
                  Reset Nháp
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  id="wizard-next-btn"
                  onClick={() => {
                    // Quick validation for Step 1
                    if (currentStep === 1) {
                      const { machineId, shiftName, operatorName, assistantName } = reportForm.shiftInfo;
                      const { productCode, rolls, actualWeight } = reportForm.productEntry;
                      if (!machineId || !shiftName || !operatorName || !assistantName) {
                        addNotification('Thiếu! Hãy nhập đầy đủ thông tin Ca máy và thợ máy.', 'warning');
                        return;
                      }
                      if (!productCode || !rolls || !actualWeight) {
                        addNotification('Thiếu! Hãy chọn Mã SP, Số lượng cuộn đạt và Cân nặng.', 'warning');
                        return;
                      }
                    }
                    setCurrentStep(prev => prev + 1);
                  }}
                  className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-850 text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow"
                  style={{ minHeight: '44px' }}
                >
                  <span>Tiếp tục</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  id="save-report-submit-btn"
                  onClick={() => handleSubmitReport()}
                  className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-600/10"
                  style={{ minHeight: '44px' }}
                >
                  <Save className="w-4.5 h-4.5" />
                  <span>Nộp & Lưu báo cáo</span>
                </button>
              )}
            </div>
          </footer>
        )}

        <nav
          className="z-40 grid shrink-0 grid-cols-2 border-t border-zinc-200 bg-white text-center shadow-[0_-8px_24px_rgba(0,0,0,0.06)] sm:grid-cols-7 pb-safe"
          id="tab-navigation"
        >
          <a
            href={pathFromTab('menu')}
            id="tab-btn-menu"
            onClick={event => handleNavClick(event, 'menu')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'menu'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <Menu className="h-4 w-4" />
            Menu
          </a>

          <a
            href={pathFromTab('form')}
            id="tab-btn-form"
            onClick={event => handleNavClick(event, 'form')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'form'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <FilePlus2 className="h-4 w-4" />
            Nhập Báo Cáo
          </a>

          <a
            href={pathFromTab('weighing-summary')}
            id="tab-btn-weighing-summary"
            onClick={event => handleNavClick(event, 'weighing-summary')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'weighing-summary'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <Layers className="h-4 w-4" />
            Phiếu Cân Ca
          </a>

          <a
            href={pathFromTab('dashboard')}
            id="tab-btn-dashboard"
            onClick={event => handleNavClick(event, 'dashboard')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'dashboard'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <BarChart3 className="h-4 w-4" />
            Phân Tích
          </a>

          <a
            href={pathFromTab('products')}
            id="tab-btn-products"
            onClick={event => handleNavClick(event, 'products')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'products'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <Package className="h-4 w-4" />
            Sản Phẩm
          </a>

          <a
            href={pathFromTab('machines')}
            id="tab-btn-machines"
            onClick={event => handleNavClick(event, 'machines')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'machines'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <Cpu className="h-4 w-4" />
            Máy
          </a>

          <a
            href={pathFromTab('materials')}
            id="tab-btn-materials"
            onClick={event => handleNavClick(event, 'materials')}
            className={`flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wider transition sm:text-xs ${
              activeTab === 'materials'
                ? 'border-t-2 border-[#ef1b2d] bg-red-50/70 text-[#ef1b2d]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            style={{ minHeight: '52px' }}
          >
            <Boxes className="h-4 w-4" />
            NPL
          </a>
        </nav>
        
      </div>
    </div>
  );
}
