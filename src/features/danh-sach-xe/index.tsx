import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  Gauge,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Search,
  Trash2,
  Truck,
  X
} from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { normalizeHrBranches } from '../_shared/hr';
import { VehicleDeliveryRequestsView, VehicleExpensesView, VehicleKmLogsView, VehicleLogsView } from './VehicleOperations';
type Vehicle = {
  id: string;
  loai_xe: string;
  bien_so_xe: string;
  ma_tai_xe: string;
  tai_xe_phu_trach: string;
  trang_thai: string;
  ghi_chu: string;
};

type DriverOption = {
  code: string;
  name: string;
};

type DriverReconciliation = {
  id: string;
  nam: number;
  thang: number;
  ma_nhan_su: string;
  ten_tai_xe: string;
  xe_id: string;
  loai_xe_di: string;
  bien_so_xe: string;
  tong_cong_quy_doi: number;
  so_chuyen_di: number;
  tong_km_thuc_te: number;
  tien_thuong_luat: number;
  tien_thuong_chuyen: number;
  thuong_doanh_so: number;
  doanh_so: number;
  ghi_chu: string;
};

type VehicleForm = Omit<Vehicle, 'id'>;
type ReconciliationForm = Omit<DriverReconciliation, 'id'>;

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1;

const emptyVehicleForm = (): VehicleForm => ({
  loai_xe: '',
  bien_so_xe: '',
  ma_tai_xe: '',
  tai_xe_phu_trach: '',
  trang_thai: 'Đang sử dụng',
  ghi_chu: ''
});

const emptyReconciliationForm = (): ReconciliationForm => ({
  nam: currentYear,
  thang: currentMonth,
  ma_nhan_su: '',
  ten_tai_xe: '',
  xe_id: '',
  loai_xe_di: '',
  bien_so_xe: '',
  tong_cong_quy_doi: 0,
  so_chuyen_di: 0,
  tong_km_thuc_te: 0,
  tien_thuong_luat: 0,
  tien_thuong_chuyen: 0,
  thuong_doanh_so: 0,
  doanh_so: 0,
  ghi_chu: ''
});

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeVehicles(data: unknown): Vehicle[] {
  const rows = data && typeof data === 'object' && Array.isArray((data as { vehicles?: unknown }).vehicles)
    ? (data as { vehicles: unknown[] }).vehicles
    : [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .map(row => ({
      id: text(row.id),
      loai_xe: text(row.loai_xe),
      bien_so_xe: text(row.bien_so_xe),
      ma_tai_xe: text(row.ma_tai_xe),
      tai_xe_phu_trach: text(row.tai_xe_phu_trach),
      trang_thai: text(row.trang_thai) || 'Đang sử dụng',
      ghi_chu: text(row.ghi_chu)
    }));
}

function normalizeReconciliationRows(data: unknown): DriverReconciliation[] {
  const rows = data && typeof data === 'object' && Array.isArray((data as { rows?: unknown }).rows)
    ? (data as { rows: unknown[] }).rows
    : [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .map(row => ({
      id: text(row.id),
      nam: numberValue(row.nam),
      thang: numberValue(row.thang),
      ma_nhan_su: text(row.ma_nhan_su),
      ten_tai_xe: text(row.ten_tai_xe),
      xe_id: text(row.xe_id),
      loai_xe_di: text(row.loai_xe_di),
      bien_so_xe: text(row.bien_so_xe),
      tong_cong_quy_doi: numberValue(row.tong_cong_quy_doi),
      so_chuyen_di: numberValue(row.so_chuyen_di),
      tong_km_thuc_te: numberValue(row.tong_km_thuc_te),
      tien_thuong_luat: numberValue(row.tien_thuong_luat),
      tien_thuong_chuyen: numberValue(row.tien_thuong_chuyen),
      thuong_doanh_so: numberValue(row.thuong_doanh_so),
      doanh_so: numberValue(row.doanh_so),
      ghi_chu: text(row.ghi_chu)
    }));
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits }).format(value || 0);
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value || 0)} đ`;
}

async function readJsonResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Không thể xử lý yêu cầu.');
  }
  return data;
}

export function VehiclesPanel({
  onBack,
  currentUser
}: {
  onBack: () => void;
  currentUser?: { id: string; name: string } | null;
}) {
  const [activeView, setActiveView] = useState<'vehicles' | 'reconciliation' | 'delivery' | 'expenses' | 'logs' | 'km_log'>('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rows, setRows] = useState<DriverReconciliation[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [staff, setStaff] = useState<DriverOption[]>([]);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [error, setError] = useState('');
  const [vehicleWarning, setVehicleWarning] = useState('');
  const [rowWarning, setRowWarning] = useState('');
  const [vehicleModal, setVehicleModal] = useState<{ mode: 'create' | 'edit'; vehicle?: Vehicle } | null>(null);
  const [rowModal, setRowModal] = useState<{ mode: 'create' | 'edit'; row?: DriverReconciliation } | null>(null);

  const loadVehicles = useCallback(async () => {
    setIsLoadingVehicles(true);
    setError('');
    try {
      const data = await readJsonResponse(await fetch('/api/danh-sach-xe'));
      setVehicles(normalizeVehicles(data));
      setVehicleWarning(text(data.warning));
    } catch (loadError: any) {
      setVehicles([]);
      setError(loadError.message || 'Không thể tải danh sách xe.');
    } finally {
      setIsLoadingVehicles(false);
    }
  }, []);

  const loadRows = useCallback(async () => {
    setIsLoadingRows(true);
    setError('');
    try {
      const params = new URLSearchParams({ nam: String(year), thang: String(month) });
      const data = await readJsonResponse(await fetch(`/api/doi-chieu-lai-xe?${params.toString()}`));
      setRows(normalizeReconciliationRows(data));
      setRowWarning(text(data.warning));
    } catch (loadError: any) {
      setRows([]);
      setError(loadError.message || 'Không thể tải bảng đối chiếu lái xe.');
    } finally {
      setIsLoadingRows(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadVehicles();
    void (async () => {
      try {
        const data = await readJsonResponse(await fetch('/api/nhan-su?format=groups&scope=all'));
        const people = normalizeHrBranches(data)
          .flatMap(branch =>
            branch.departments.flatMap(department =>
              department.members.map(member => ({ member, departmentName: department.name }))
            )
          );
        const allOptions = people.map(({ member }) => ({ code: member.code || '', name: member.name }));
        setStaff(
          [...new Map(allOptions.map(person => [`${person.code}|${person.name}`, person])).values()]
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        );
        const options = people
          .filter(({ member, departmentName }) =>
            /lái xe|tài xế|lai xe|tai xe/i.test(`${departmentName} ${member.role} ${member.position || ''}`)
          )
          .map(({ member }) => ({ code: member.code || '', name: member.name }));
        setDrivers(
          [...new Map(options.map(driver => [`${driver.code}|${driver.name}`, driver])).values()]
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        );
      } catch {
        setDrivers([]);
        setStaff([]);
      }
    })();
  }, [loadVehicles]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return vehicles;
    return vehicles.filter(vehicle =>
      `${vehicle.id} ${vehicle.loai_xe} ${vehicle.bien_so_xe} ${vehicle.tai_xe_phu_trach} ${vehicle.trang_thai}`
        .toLowerCase()
        .includes(query)
    );
  }, [search, vehicles]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          tong_cong_quy_doi: sum.tong_cong_quy_doi + row.tong_cong_quy_doi,
          so_chuyen_di: sum.so_chuyen_di + row.so_chuyen_di,
          tong_km_thuc_te: sum.tong_km_thuc_te + row.tong_km_thuc_te,
          tien_thuong_luat: sum.tien_thuong_luat + row.tien_thuong_luat,
          tien_thuong_chuyen: sum.tien_thuong_chuyen + row.tien_thuong_chuyen,
          thuong_doanh_so: sum.thuong_doanh_so + row.thuong_doanh_so,
          doanh_so: sum.doanh_so + row.doanh_so
        }),
        {
          tong_cong_quy_doi: 0,
          so_chuyen_di: 0,
          tong_km_thuc_te: 0,
          tien_thuong_luat: 0,
          tien_thuong_chuyen: 0,
          thuong_doanh_so: 0,
          doanh_so: 0
        }
      ),
    [rows]
  );

  const deleteVehicle = async (vehicle: Vehicle) => {
    if (!window.confirm(`Xóa xe ${vehicle.bien_so_xe}?`)) return;
    try {
      await readJsonResponse(await fetch(`/api/danh-sach-xe/${encodeURIComponent(vehicle.id)}`, { method: 'DELETE' }));
      await loadVehicles();
    } catch (deleteError: any) {
      setError(deleteError.message || 'Không thể xóa xe.');
    }
  };

  const deleteRow = async (row: DriverReconciliation) => {
    if (!window.confirm(`Xóa dòng đối chiếu của ${row.ten_tai_xe}?`)) return;
    try {
      await readJsonResponse(await fetch(`/api/doi-chieu-lai-xe/${encodeURIComponent(row.id)}`, { method: 'DELETE' }));
      await loadRows();
    } catch (deleteError: any) {
      setError(deleteError.message || 'Không thể xóa dòng đối chiếu.');
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1680px] space-y-3">
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <BackButton onClick={onBack} />
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-bold text-slate-900">Quản lý xe & lái xe</h2>
              <p className="text-[11px] font-medium text-slate-500">Danh mục, chi phí, nhật ký và đối chiếu lái xe</p>
            </div>
          </div>
          {activeView === 'vehicles' && (
            <button
              type="button"
              onClick={() => setVehicleModal({ mode: 'create' })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-extrabold text-white transition hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" />
              Thêm xe
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:grid-cols-4 sm:w-[760px]">
          <button
            type="button"
            onClick={() => setActiveView('vehicles')}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-extrabold transition ${
              activeView === 'vehicles' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="h-4 w-4" />
            Danh sách xe
          </button>
          <button
            type="button"
            onClick={() => setActiveView('delivery')}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-extrabold transition ${
              activeView === 'delivery' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            Yêu cầu xuất hàng
          </button>
          <button
            type="button"
            onClick={() => setActiveView('expenses')}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-extrabold transition ${
              activeView === 'expenses' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ReceiptText className="h-4 w-4" />
            Chi phí xe
          </button>
          <button
            type="button"
            onClick={() => setActiveView('logs')}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-extrabold transition ${
              activeView === 'logs' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Gauge className="h-4 w-4" />
            Nhật ký KM xe
          </button>
        </div>
      </section>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {(activeView === 'vehicles' ? vehicleWarning : activeView === 'reconciliation' ? rowWarning : '') && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          {activeView === 'vehicles' ? vehicleWarning : rowWarning}
        </p>
      )}

      {activeView === 'vehicles' ? (
        <>
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 sm:max-w-md">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Tìm biển số, loại xe, tài xế..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
              />
            </label>
            <span className="text-xs font-bold text-slate-500">{filteredVehicles.length} xe</span>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 font-black">ID</th>
                    <th className="px-3 py-2.5 font-black">Loại xe</th>
                    <th className="px-3 py-2.5 font-black">BSX</th>
                    <th className="px-3 py-2.5 font-black">Tài xế phụ trách</th>
                    <th className="px-3 py-2.5 font-black">Trạng thái</th>
                    <th className="px-3 py-2.5 font-black">Ghi chú</th>
                    <th className="px-3 py-2.5 text-center font-black">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVehicles.map(vehicle => (
                    <tr key={vehicle.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-mono text-slate-500">{vehicle.id}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-800">{vehicle.loai_xe || '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-sm font-black text-brand-700">{vehicle.bien_so_xe}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700">
                        {vehicle.tai_xe_phu_trach || 'Chưa phân công'}
                        {vehicle.ma_tai_xe && <span className="ml-1 text-[10px] text-slate-400">({vehicle.ma_tai_xe})</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
                          vehicle.trang_thai === 'Đang sử dụng'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {vehicle.trang_thai}
                        </span>
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2.5 text-slate-500" title={vehicle.ghi_chu}>
                        {vehicle.ghi_chu || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-center gap-1">
                          <IconButton label="Sửa" onClick={() => setVehicleModal({ mode: 'edit', vehicle })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton label="Xóa" danger onClick={() => void deleteVehicle(vehicle)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 md:hidden">
              {filteredVehicles.map(vehicle => (
                <article key={vehicle.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-base font-black text-brand-700">{vehicle.bien_so_xe}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-700">{vehicle.loai_xe}</p>
                    </div>
                    <div className="flex gap-1">
                      <IconButton label="Sửa" onClick={() => setVehicleModal({ mode: 'edit', vehicle })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton label="Xóa" danger onClick={() => void deleteVehicle(vehicle)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-600">Tài xế: {vehicle.tai_xe_phu_trach || 'Chưa phân công'}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{vehicle.trang_thai} · ID {vehicle.id}</p>
                </article>
              ))}
            </div>
            {!isLoadingVehicles && filteredVehicles.length === 0 && <EmptyState text="Chưa có xe phù hợp bộ lọc." />}
            {isLoadingVehicles && <LoadingState text="Đang tải danh sách xe..." />}
          </section>
        </>
      ) : activeView === 'reconciliation' ? (
        <>
          <section className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Năm</span>
              <input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={event => setYear(Number(event.target.value) || currentYear)}
                className="block h-10 w-28 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-brand-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tháng</span>
              <select
                value={month}
                onChange={event => setMonth(Number(event.target.value))}
                className="block h-10 w-32 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-brand-400"
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map(value => (
                  <option key={value} value={value}>Tháng {value}</option>
                ))}
              </select>
            </label>
            <span className="ml-auto text-xs font-bold text-slate-500">{rows.length} dòng đối chiếu</span>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <p className="border-b border-slate-100 bg-sky-50 px-3 py-2 text-[10px] font-bold text-sky-700 md:hidden">
              Vuốt ngang bảng để xem đầy đủ các chỉ tiêu.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1540px] text-left text-[11px]">
                <thead className="bg-slate-100 text-[9px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2.5 py-2.5 font-black">Năm</th>
                    <th className="px-2.5 py-2.5 font-black">Tháng</th>
                    <th className="px-2.5 py-2.5 font-black">Tên NV</th>
                    <th className="px-2.5 py-2.5 font-black">Loại xe đi</th>
                    <th className="px-2.5 py-2.5 text-right font-black">Công quy đổi</th>
                    <th className="px-2.5 py-2.5 text-right font-black">Số chuyến</th>
                    <th className="px-2.5 py-2.5 text-right font-black">KM thực tế</th>
                    <th className="px-2.5 py-2.5 text-right font-black">Thưởng luật</th>
                    <th className="px-2.5 py-2.5 text-right font-black">Thưởng chuyến</th>
                    <th className="px-2.5 py-2.5 text-right font-black">Thưởng doanh số</th>
                    <th className="px-2.5 py-2.5 text-right font-black">Doanh số</th>
                    <th className="px-2.5 py-2.5 text-center font-black">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-2.5 py-2.5">{row.nam}</td>
                      <td className="px-2.5 py-2.5">Tháng {row.thang}</td>
                      <td className="px-2.5 py-2.5 font-bold text-slate-800">
                        {row.ten_tai_xe}
                        {row.ma_nhan_su && <span className="ml-1 text-[9px] text-slate-400">({row.ma_nhan_su})</span>}
                      </td>
                      <td className="px-2.5 py-2.5 font-semibold">
                        {row.loai_xe_di || '—'}
                        {row.bien_so_xe && <span className="ml-1 font-mono text-brand-700">· {row.bien_so_xe}</span>}
                      </td>
                      <td className="px-2.5 py-2.5 text-right">{formatNumber(row.tong_cong_quy_doi)}</td>
                      <td className="px-2.5 py-2.5 text-right">{formatNumber(row.so_chuyen_di)}</td>
                      <td className="px-2.5 py-2.5 text-right">{formatNumber(row.tong_km_thuc_te)}</td>
                      <td className="px-2.5 py-2.5 text-right text-violet-700">{formatMoney(row.tien_thuong_luat)}</td>
                      <td className="px-2.5 py-2.5 text-right text-violet-700">{formatMoney(row.tien_thuong_chuyen)}</td>
                      <td className="px-2.5 py-2.5 text-right text-violet-700">{formatMoney(row.thuong_doanh_so)}</td>
                      <td className="px-2.5 py-2.5 text-right font-bold text-emerald-700">{formatMoney(row.doanh_so)}</td>
                      <td className="px-2.5 py-2.5">
                        <div className="flex justify-center gap-1">
                          <IconButton label="Sửa" onClick={() => setRowModal({ mode: 'edit', row })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton label="Xóa" danger onClick={() => void deleteRow(row)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 0 && (
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-black text-slate-800">
                    <tr>
                      <td colSpan={4} className="px-2.5 py-3 text-right uppercase">Tổng</td>
                      <td className="px-2.5 py-3 text-right">{formatNumber(totals.tong_cong_quy_doi)}</td>
                      <td className="px-2.5 py-3 text-right">{formatNumber(totals.so_chuyen_di)}</td>
                      <td className="px-2.5 py-3 text-right">{formatNumber(totals.tong_km_thuc_te)}</td>
                      <td className="px-2.5 py-3 text-right">{formatMoney(totals.tien_thuong_luat)}</td>
                      <td className="px-2.5 py-3 text-right">{formatMoney(totals.tien_thuong_chuyen)}</td>
                      <td className="px-2.5 py-3 text-right">{formatMoney(totals.thuong_doanh_so)}</td>
                      <td className="px-2.5 py-3 text-right text-emerald-700">{formatMoney(totals.doanh_so)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {!isLoadingRows && rows.length === 0 && <EmptyState text={`Chưa có dữ liệu đối chiếu tháng ${month}/${year}.`} />}
            {isLoadingRows && <LoadingState text="Đang tải bảng đối chiếu..." />}
          </section>
        </>
      ) : activeView === 'delivery' ? (
        <VehicleDeliveryRequestsView vehicles={vehicles} staff={staff} />
      ) : activeView === 'expenses' ? (
        <VehicleExpensesView vehicles={vehicles} staff={staff} currentUser={currentUser} />
      ) : activeView === 'km_log' ? (
        <VehicleKmLogsView vehicles={vehicles} staff={staff} />
      ) : (
        <VehicleLogsView vehicles={vehicles} staff={staff} />
      )}

      {vehicleModal && (
        <VehicleModal
          initial={vehicleModal.vehicle}
          drivers={drivers}
          vehicleTypeOptions={vehicles.map(vehicle => vehicle.loai_xe)}
          onClose={() => setVehicleModal(null)}
          onSaved={async () => {
            setVehicleModal(null);
            await loadVehicles();
          }}
        />
      )}
      {rowModal && (
        <ReconciliationModal
          initial={rowModal.row}
          vehicles={vehicles}
          drivers={drivers}
          defaultYear={year}
          defaultMonth={month}
          onClose={() => setRowModal(null)}
          onSaved={async () => {
            setRowModal(null);
            await loadRows();
          }}
        />
      )}
    </div>
  );
}

function IconButton({
  label,
  danger = false,
  onClick,
  children
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
        danger
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function LoadingState({ text: label }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm font-bold text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyState({ text: label }: { text: string }) {
  return <div className="px-4 py-10 text-center text-sm font-bold text-slate-400">{label}</div>;
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
      <div className="flex max-h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">{title}</h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        <div className="shrink-0 border-t border-slate-200 px-4 py-3">{footer}</div>
      </div>
    </div>
  );
}

const DEFAULT_VEHICLE_TYPE_OPTIONS = [
  'Xe tải 1.4T',
  'Xe tải 2.5T',
  'Xe tải 3.5T',
  'Xe tải 5T',
  'Xe van',
  'Xe bán tải',
  'Xe container'
];

const splitAssignedDrivers = (value: string) =>
  value.split(/\s*[,;\n]\s*/).map(item => item.trim()).filter(Boolean);

function MultiDriverSelect({ drivers, selectedCodes, selectedNames, onChange }: {
  drivers: DriverOption[];
  selectedCodes: string;
  selectedNames: string;
  onChange: (drivers: DriverOption[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const codes = splitAssignedDrivers(selectedCodes);
  const names = splitAssignedDrivers(selectedNames);
  const options = useMemo(() => {
    const result = [...drivers];
    names.forEach((name, index) => {
      const code = codes[index] || '';
      if (!result.some(driver => (code && driver.code === code) || (!code && driver.name === name))) result.push({ code, name });
    });
    return result;
  }, [drivers, selectedCodes, selectedNames]);
  const selected = options.filter(driver => (driver.code && codes.includes(driver.code)) || names.includes(driver.name));
  const normalizedQuery = query.trim().toLocaleLowerCase('vi');
  const filtered = options.filter(driver => `${driver.code} ${driver.name}`.toLocaleLowerCase('vi').includes(normalizedQuery));

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const toggle = (driver: DriverOption) => {
    const isSelected = selected.some(item => driver.code ? item.code === driver.code : item.name === driver.name);
    onChange(isSelected
      ? selected.filter(item => driver.code ? item.code !== driver.code : item.name !== driver.name)
      : [...selected, driver]);
  };

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setIsOpen(open => !open)} className={`${inputClass} flex items-center justify-between gap-2 text-left`} aria-haspopup="listbox" aria-expanded={isOpen}>
        <span className={selected.length ? 'truncate text-slate-900' : 'text-slate-400'}>{selected.length ? selected.map(driver => driver.name).join(', ') : 'Chưa phân công'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 p-2"><div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={query} onChange={event => setQuery(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 pl-8 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" placeholder="Gõ mã hoặc tên tài xế..." />
        </div></div>
        <div className="max-h-52 overflow-y-auto p-1" role="listbox" aria-multiselectable="true">
          {filtered.length ? filtered.map(driver => {
            const checked = selected.some(item => driver.code ? item.code === driver.code : item.name === driver.name);
            return <button type="button" key={`${driver.code}-${driver.name}`} onClick={() => toggle(driver)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-50" role="option" aria-selected={checked}>
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 bg-white'}`}>{checked && <Check className="h-3 w-3" strokeWidth={3} />}</span>
              <span className="min-w-0 truncate">{driver.code && <span className="mr-1.5 font-bold text-slate-500">{driver.code}</span>}{driver.name}</span>
            </button>;
          }) : <p className="px-3 py-4 text-center text-xs text-slate-500">Không tìm thấy tài xế</p>}
        </div>
        {selected.length > 0 && <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs">
          <span className="font-semibold text-slate-500">Đã chọn {selected.length} tài xế</span>
          <button type="button" onClick={() => onChange([])} className="font-bold text-rose-600 hover:text-rose-700">Bỏ chọn tất cả</button>
        </div>}
      </div>}
    </div>
  );
}

function VehicleModal({
  initial,
  drivers,
  vehicleTypeOptions = [],
  onClose,
  onSaved
}: {
  initial?: Vehicle;
  drivers: DriverOption[];
  vehicleTypeOptions?: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<VehicleForm>(initial ? { ...initial } : emptyVehicleForm());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const loaiXeSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const value of [...vehicleTypeOptions, ...DEFAULT_VEHICLE_TYPE_OPTIONS]) {
      const trimmed = String(value || '').trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(trimmed);
    }
    return options.sort((a, b) => a.localeCompare(b, 'vi'));
  }, [vehicleTypeOptions]);

  const save = async () => {
    if (!form.loai_xe.trim() || !form.bien_so_xe.trim()) {
      setError('Vui lòng nhập loại xe và biển số xe.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const endpoint = initial ? `/api/danh-sach-xe/${encodeURIComponent(initial.id)}` : '/api/danh-sach-xe';
      await readJsonResponse(await fetch(endpoint, {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      }));
      await onSaved();
    } catch (saveError: any) {
      setError(saveError.message || 'Không thể lưu xe.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      title={initial ? 'Sửa thông tin xe' : 'Thêm xe mới'}
      subtitle="Dữ liệu gốc dùng cho phân công và đối chiếu lái xe"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">Huỷ</button>
          <button type="button" onClick={() => void save()} disabled={isSaving} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-extrabold text-white disabled:opacity-60">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Đang lưu...' : 'Lưu xe'}
          </button>
        </div>
      }
    >
      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Loại xe *">
          <input
            list="vehicle-type-suggestions"
            value={form.loai_xe}
            onChange={event => setForm(prev => ({ ...prev, loai_xe: event.target.value }))}
            className={inputClass}
            placeholder="Chọn hoặc nhập loại xe"
            autoComplete="off"
          />
          <datalist id="vehicle-type-suggestions">
            {loaiXeSuggestions.map(type => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </Field>
        <Field label="Biển số xe (BSX) *">
          <input value={form.bien_so_xe} onChange={event => setForm(prev => ({ ...prev, bien_so_xe: event.target.value.toUpperCase() }))} className={`${inputClass} font-mono`} placeholder="VD: 51D-251.05" />
        </Field>
        <Field label="Tài xế phụ trách">
          <MultiDriverSelect
            drivers={drivers}
            selectedCodes={form.ma_tai_xe}
            selectedNames={form.tai_xe_phu_trach}
            onChange={selected => setForm(prev => ({
              ...prev,
              ma_tai_xe: selected.map(driver => driver.code).join(', '),
              tai_xe_phu_trach: selected.map(driver => driver.name).join(', ')
            }))}
          />
        </Field>
        <Field label="Trạng thái">
          <select value={form.trang_thai} onChange={event => setForm(prev => ({ ...prev, trang_thai: event.target.value }))} className={inputClass}>
            {['Đang sử dụng', 'Bảo dưỡng', 'Tạm ngưng', 'Thanh lý'].map(status => <option key={status}>{status}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Ghi chú">
            <textarea value={form.ghi_chu} onChange={event => setForm(prev => ({ ...prev, ghi_chu: event.target.value }))} className={`${inputClass} min-h-20 py-2`} />
          </Field>
        </div>
      </div>
    </ModalShell>
  );
}

const numericFields: Array<{ key: keyof ReconciliationForm; label: string; money?: boolean }> = [
  { key: 'tong_cong_quy_doi', label: 'Tổng số công quy đổi' },
  { key: 'so_chuyen_di', label: 'Số chuyến đi' },
  { key: 'tong_km_thuc_te', label: 'Tổng KM thực tế' },
  { key: 'tien_thuong_luat', label: 'Thưởng luật (250đ/km)', money: true },
  { key: 'tien_thuong_chuyen', label: 'Tiền thưởng chuyến', money: true },
  { key: 'thuong_doanh_so', label: 'Thưởng doanh số', money: true },
  { key: 'doanh_so', label: 'Doanh số', money: true }
];

function ReconciliationModal({
  initial,
  vehicles,
  drivers,
  defaultYear,
  defaultMonth,
  onClose,
  onSaved
}: {
  initial?: DriverReconciliation;
  vehicles: Vehicle[];
  drivers: DriverOption[];
  defaultYear: number;
  defaultMonth: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<ReconciliationForm>(
    initial ? { ...initial } : { ...emptyReconciliationForm(), nam: defaultYear, thang: defaultMonth }
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.ten_tai_xe.trim()) {
      setError('Vui lòng chọn tài xế.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const endpoint = initial ? `/api/doi-chieu-lai-xe/${encodeURIComponent(initial.id)}` : '/api/doi-chieu-lai-xe';
      await readJsonResponse(await fetch(endpoint, {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      }));
      await onSaved();
    } catch (saveError: any) {
      setError(saveError.message || 'Không thể lưu dòng đối chiếu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      title={initial ? 'Sửa dòng đối chiếu' : 'Thêm dòng đối chiếu'}
      subtitle="Theo cấu trúc BẢNG ĐỐI CHIẾU LÁI XE của khách"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">Huỷ</button>
          <button type="button" onClick={() => void save()} disabled={isSaving} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-extrabold text-white disabled:opacity-60">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Đang lưu...' : 'Lưu đối chiếu'}
          </button>
        </div>
      }
    >
      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Năm">
          <input type="number" min={2000} max={2100} value={form.nam} onChange={event => setForm(prev => ({ ...prev, nam: Number(event.target.value) }))} className={inputClass} />
        </Field>
        <Field label="Tháng">
          <select value={form.thang} onChange={event => setForm(prev => ({ ...prev, thang: Number(event.target.value) }))} className={inputClass}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map(value => <option key={value} value={value}>Tháng {value}</option>)}
          </select>
        </Field>
        <Field label="Tên tài xế *">
          <select
            value={`${form.ma_nhan_su}|${form.ten_tai_xe}`}
            onChange={event => {
              const selected = drivers.find(driver => `${driver.code}|${driver.name}` === event.target.value);
              setForm(prev => ({ ...prev, ma_nhan_su: selected?.code || '', ten_tai_xe: selected?.name || '' }));
            }}
            className={inputClass}
          >
            <option value="|">Chọn tài xế</option>
            {drivers.map(driver => <option key={`${driver.code}-${driver.name}`} value={`${driver.code}|${driver.name}`}>{driver.code ? `${driver.code} · ` : ''}{driver.name}</option>)}
          </select>
        </Field>
        <Field label="Loại xe đi">
          <select
            value={form.xe_id}
            onChange={event => {
              const vehicle = vehicles.find(item => item.id === event.target.value);
              setForm(prev => ({
                ...prev,
                xe_id: vehicle?.id || '',
                loai_xe_di: vehicle?.loai_xe || '',
                bien_so_xe: vehicle?.bien_so_xe || ''
              }));
            }}
            className={inputClass}
          >
            <option value="">Chọn xe</option>
            {vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.loai_xe} · {vehicle.bien_so_xe}</option>)}
          </select>
        </Field>
        {numericFields.map(field => (
          <label key={field.key} className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{field.label}</span>
            <input
              type="number"
              min={0}
              step={field.money ? 1000 : 0.5}
              value={Number(form[field.key]) || 0}
              onChange={event => setForm(prev => ({ ...prev, [field.key]: Number(event.target.value) || 0 }))}
              className={`${inputClass} text-right`}
            />
          </label>
        ))}
        <div className="sm:col-span-2">
          <Field label="Ghi chú">
            <textarea value={form.ghi_chu} onChange={event => setForm(prev => ({ ...prev, ghi_chu: event.target.value }))} className={`${inputClass} min-h-20 py-2`} />
          </Field>
        </div>
      </div>
    </ModalShell>
  );
}

const inputClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
