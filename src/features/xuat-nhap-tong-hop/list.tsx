import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import WarehouseSlipPrintModal, { type WarehouseSlipPrintData } from '../../components/WarehouseSlipPrintModal';
import {
  formatTongHopDate,
  isNvlWarehouseName,
  queueTongHopEdit,
  type TongHopHeader,
  type TongHopMode
} from './model';

type Filter = 'all' | TongHopMode;

function statusLabel(status: string) {
  if (status === 'huy') return 'Đã hủy';
  if (status === 'hoan_thanh') return 'Đã ghi sổ';
  return status || '—';
}

function slipsFromRecord(row: TongHopHeader): WarehouseSlipPrintData[] {
  const detail = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const line of detail) {
    const key = String(line.kho_dong_ten || line.nguon_dong_ten || line.nguon_dong_id || row.kho_dich || 'Phiếu');
    groups.set(key, [...(groups.get(key) || []), line]);
  }
  return [...groups.entries()].map(([name, groupLines], index) => ({
    slipCode: `${row.ma_phieu_chung}-${index + 1}`,
    slipType: row.loai,
    warehouseKind: isNvlWarehouseName(name) || row.dich_loai === 'may' ? 'nvl' : 'san_pham',
    slipDate: formatTongHopDate(String(row.ngay || '').slice(0, 10)),
    reason: row.ly_do || (row.loai === 'nhap' ? row.loai_nhap || '' : row.loai_xuat || ''),
    note: row.ghi_chu || '',
    createdBy: row.nguoi_lap || '',
    deliverer: row.nguoi_giao || '',
    warehouseLocation: row.dia_diem || '',
    totalAmount: groupLines.reduce((sum, line) => sum + (Number(line.thanh_tien) || 0), 0),
    shift: row.ca || '',
    machine: row.dich_loai === 'may' ? row.dich_id || '' : '',
    warehouseName: name,
    useWarehouseNameInTitle: true,
    isTemporary: false,
    lines: groupLines.map(line => ({
      code: String(line.ma_hang || ''),
      name: String(line.ten_hang || ''),
      unit: String(line.don_vi || ''),
      quantity: Number(line.so_luong) || 0,
      unitPrice: Number(line.don_gia) || 0,
      lineAmount: Number(line.thanh_tien) || 0,
      weightKg: Number(String(line.quy_doi_kg ?? '')) || null
    }))
  }));
}

export function TongHopListPanel({
  onBack,
  onCreate,
  onEdit
}: {
  onBack: () => void;
  onCreate: () => void;
  onEdit: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [records, setRecords] = useState<TongHopHeader[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [printSlips, setPrintSlips] = useState<WarehouseSlipPrintData[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const query = filter === 'all' ? '' : `?loai=${filter}`;
      const res = await fetch(`/api/xuat-nhap-tong-hop${query}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Không tải được danh sách.');
        setRecords([]);
        return;
      }
      setError('');
      setRecords(Array.isArray(data.records) ? data.records : []);
    };
    void load();
  }, [filter, info]);

  async function cancelRecord(row: TongHopHeader) {
    if (!window.confirm(`Hủy ${row.ma_phieu_chung}? Hệ thống sinh phiếu đảo.`)) return;
    const res = await fetch(`/api/xuat-nhap-tong-hop/${row.id}/huy`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Không hủy được.');
      return;
    }
    setInfo(`Đã hủy ${row.ma_phieu_chung}.`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-xs font-extrabold text-[#ef1b2d]">← Kho</button>
        <h1 className="text-sm font-black uppercase tracking-wide text-zinc-950">Danh sách nhập xuất tổng hợp</h1>
        <button type="button" onClick={onCreate} className="text-xs font-extrabold text-[#ef1b2d]">Tạo phiếu</button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {([
            ['all', 'Tất cả'],
            ['nhap', 'Phiếu nhập'],
            ['xuat', 'Phiếu xuất']
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`flex h-9 items-center justify-center rounded-lg border px-2 text-xs font-extrabold transition ${
                filter === value
                  ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      {info ? <p className="text-sm font-semibold text-emerald-700">{info}</p> : null}

      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-[860px] w-full text-xs">
          <thead>
            <tr className="bg-[#ef1b2d] text-left text-white">
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Nguồn</th>
              <th className="px-3 py-2">Đích</th>
              <th className="px-3 py-2">Ca</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {records.map(row => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-semibold">{row.ma_phieu_chung}</td>
                <td className="px-3 py-2">{row.loai === 'nhap' ? 'Nhập' : 'Xuất'}</td>
                <td className="px-3 py-2">{formatTongHopDate(String(row.ngay || '').slice(0, 10))}</td>
                <td className="px-3 py-2">{row.nguon_id || '—'}</td>
                <td className="px-3 py-2">{row.kho_dich || row.dich_id || '—'}</td>
                <td className="px-3 py-2">{row.ca || '—'}</td>
                <td className="px-3 py-2">{statusLabel(row.trang_thai)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setPrintSlips(slipsFromRecord(row))} className="text-slate-600" aria-label="In phiếu">
                      <Printer className="h-4 w-4" />
                    </button>
                    {row.trang_thai !== 'huy' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            queueTongHopEdit(row);
                            onEdit();
                          }}
                          className="text-xs font-extrabold text-[#ef1b2d]"
                        >
                          Sửa
                        </button>
                        <button type="button" onClick={() => void cancelRecord(row)} className="text-sm font-semibold text-rose-600">Hủy</button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Chưa có phiếu.</td></tr> : null}
          </tbody>
        </table>
      </section>

      <WarehouseSlipPrintModal open={Boolean(printSlips)} slips={printSlips} onClose={() => setPrintSlips(null)} />
    </div>
  );
}
