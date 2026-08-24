import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';

type InventoryAlert = {
  id: number;
  san_pham_id: string;
  ma_amis: string;
  ten_sp: string;
  ten_san_xuat: string;
  ton_kho: number;
  ton_kho_toi_thieu: number;
  ton_kho_toi_da: number;
  thang: number;
  nam: number;
};

type ApiResponse = {
  items?: InventoryAlert[];
  total?: number;
  source?: string;
  thang: number;
  nam: number;
  error?: string;
};

export function InventoryAlertPanel({ onBack }: { onBack: () => void }) {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [thang, setThang] = useState(0);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/canh-bao-ton-kho');
      const data: ApiResponse = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tải dữ liệu cảnh báo tồn kho.');
      setAlerts(data.items || []);
      setThang(data.thang);
    } catch (e: any) {
      setError(e.message || 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mx-auto w-full max-w-none space-y-4">
  
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="bg-white p-4 text-slate-700">
          <h1 className="text-lg font-black text-zinc-900 sm:text-xl">
            Danh sách các sản phẩm sắp hết tồn trong tháng {thang}
          </h1>
        </div>
      </section>

      {error && (
        <div className="mx-0 rounded-lg bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card p-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        </section>
      ) : alerts.length === 0 ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <p className="mt-3 text-sm font-semibold text-zinc-600">
            Không có sản phẩm nào sắp hết tồn kho.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3">Mã AMIS</th>
                <th className="border-b border-slate-200 px-4 py-3">Tên sản phẩm</th>
                <th className="border-b border-slate-200 px-4 py-3">Tên sản xuất</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">Tồn kho</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">Tồn kho tối thiểu</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-black text-rose-600">{alert.ma_amis || '-'}</td>
                  <td className="px-4 py-3">{alert.ten_sp || '-'}</td>
                  <td className="px-4 py-3">{alert.ten_san_xuat || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-600">
                    {alert.ton_kho}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {alert.ton_kho_toi_thieu}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
