import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

type DispatchRecord = {
  id: string;
  ngay_lam_viec: string;
  ca: string;
  ma_lenh_sx: string;
  ma_nhan_su: string;
  vai_tro: string | null;
  may_goc: string;
  may_dieu_dong: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  ghi_chu?: string;
};

interface EditDispatchModalProps {
  isOpen: boolean;
  record: DispatchRecord | null;
  otherMachines: string[];
  onSubmit: (payload: Partial<DispatchRecord>) => Promise<void>;
  onCancel: () => void;
  staffMap: Map<string, string>;
}

export function EditDispatchModal({
  isOpen,
  record,
  otherMachines,
  onSubmit,
  onCancel,
  staffMap
}: EditDispatchModalProps) {
  const [mayDieuDong, setMayDieuDong] = useState('');
  const [thoiGianBatDau, setThoiGianBatDau] = useState('');
  const [thoiGianKetThuc, setThoiGianKetThuc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (record) {
      setMayDieuDong(record.may_dieu_dong);
      setThoiGianBatDau(record.thoi_gian_bat_dau.slice(0, 5));
      setThoiGianKetThuc(record.thoi_gian_ket_thuc.slice(0, 5));
      setError('');
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const personName = staffMap.get(record.personnel_id) || record.personnel_id || '-';

  const handleSubmit = async () => {
    if (!mayDieuDong || !thoiGianBatDau || !thoiGianKetThuc) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc.');
      return;
    }

    if (mayDieuDong === record.may_goc) {
      setError('Máy chuyển đến phải khác máy gốc.');
      return;
    }

    const startMins = timeToMinutes(thoiGianBatDau);
    const endMins = timeToMinutes(thoiGianKetThuc);
    if (startMins >= endMins) {
      setError('Giờ bắt đầu phải nhỏ hơn giờ kết thúc.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await onSubmit({
        may_dieu_dong: mayDieuDong,
        thoi_gian_bat_dau: thoiGianBatDau,
        thoi_gian_ket_thuc: thoiGianKetThuc
      });
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Sửa điều động nhân sự</h2>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-zinc-100 active:bg-zinc-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-4">
          {/* Readonly: Nhân sự */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Nhân sự</label>
            <div className="rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
              {personName} · {record.vai_tro || '-'}
            </div>
          </div>

          {/* Readonly: Máy gốc */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Máy gốc</label>
            <div className="rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
              {record.may_goc}
            </div>
          </div>

          {/* Editable: Máy chuyển đến */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">Máy chuyển đến *</label>
            {otherMachines.length === 0 ? (
              <div className="rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
                Không có máy khác
              </div>
            ) : (
              <select
                value={mayDieuDong}
                onChange={e => setMayDieuDong(e.target.value)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[#ef1b2d] focus:outline-none"
              >
                <option value="">-- Chọn --</option>
                {otherMachines.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Editable: Thời gian */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Bắt đầu *</label>
              <input
                type="time"
                value={thoiGianBatDau}
                onChange={e => setThoiGianBatDau(e.target.value)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[#ef1b2d] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Kết thúc *</label>
              <input
                type="time"
                value={thoiGianKetThuc}
                onChange={e => setThoiGianKetThuc(e.target.value)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[#ef1b2d] focus:outline-none"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2">
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || otherMachines.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-[#ef1b2d] px-4 py-2 text-sm font-medium text-white hover:bg-[#b30d1c] active:bg-[#8a0a15] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Đang lưu...' : 'Cập nhật'}
          </button>
        </div>
      </div>
    </div>
  );
}

function timeToMinutes(value: string): number {
  const [h, m] = String(value).split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}
