import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { ChiPhiDienList } from './ChiPhiDienList';
import { ChiPhiDienForm } from './ChiPhiDienForm';
import { ChiPhiDienSheet } from './ChiPhiDienSheet';
import type { ChiPhiDienRecord } from './types';
import { buildMachineTypeIndex, collectLoaiMayOptions, fmtInt, isYearlyRecord } from './aggregate';
import { normalizeMachines } from '../danh-sach-may';

interface ChiPhiDienPanelProps {
  onBack: () => void;
  currentUser?: any;
}

export function ChiPhiDienPanel({ onBack, currentUser }: ChiPhiDienPanelProps) {
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit' | 'view'>('list');
  const [selectedRecord, setSelectedRecord] = useState<ChiPhiDienRecord | null>(null);

  const [filterNam, setFilterNam] = useState(() => new Date().getFullYear());
  const [filterLoai, setFilterLoai] = useState('');

  const [machineTypeIndex, setMachineTypeIndex] = useState<Map<string, string>>(new Map());
  const [loaiOptions, setLoaiOptions] = useState<string[]>([]);

  const [records, setRecords] = useState<ChiPhiDienRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Danh mục máy → Loại/Nhóm (sổ trộn chỉ lưu theo máy).
  useEffect(() => {
    let alive = true;
    fetch('/api/danh-sach-may')
      .then(res => res.json().catch(() => ({})))
      .then(data => {
        if (!alive) return;
        const machines = normalizeMachines(data);
        setMachineTypeIndex(buildMachineTypeIndex(machines));
        setLoaiOptions(collectLoaiMayOptions(machines));
      })
      .catch(() => {
        if (alive) {
          setMachineTypeIndex(new Map());
          setLoaiOptions([]);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadRecords = useCallback(async (nam: number) => {
    setLoadingRecords(true);
    try {
      const params = new URLSearchParams();
      if (nam) params.set('nam', String(nam));
      const res = await fetch(`/api/chi-phi-dien?${params.toString()}`);
      const data = await res.json().catch(() => ({ items: [] }));
      const items = Array.isArray(data.items) ? data.items : [];
      // Chỉ hiện bản ghi định giá theo năm (bỏ các bản ghi cũ tính theo tháng).
      setRecords(items.filter((item: ChiPhiDienRecord) => isYearlyRecord(item)));
    } catch (err) {
      console.error('Error loading chi phi dien records:', err);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    loadRecords(filterNam);
  }, [filterNam, loadRecords]);

  const handleFilterChange = (nam: number, loai: string) => {
    setFilterNam(nam);
    setFilterLoai(loai);
  };

  const handleSaveRecord = async (recordData: Partial<ChiPhiDienRecord>) => {
    const isUpdate = Boolean(recordData.id);
    const url = isUpdate
      ? `/api/chi-phi-dien/${encodeURIComponent(recordData.id!)}`
      : '/api/chi-phi-dien';
    const method = isUpdate ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recordData)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không thể lưu bảng chi phí điện.');
    }

    loadRecords(filterNam);
    setViewMode('list');
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/chi-phi-dien/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Lỗi khi xóa bảng chi phí điện.');
      }
      loadRecords(filterNam);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa bảng chi phí điện.');
    }
  };

  const viewDetail = useMemo(() => {
    if (!selectedRecord?.chi_tiet) return null;
    const detail = selectedRecord.chi_tiet;
    const prevNam = detail.prev_nam ?? null;
    return {
      rows: Array.isArray(detail.rows) ? detail.rows : [],
      tongTienDien: Number(selectedRecord.tong_tien_dien) || 0,
      tongThanhPham: Number(selectedRecord.tong_thanh_pham) || 0,
      tbDongKg: Number(selectedRecord.tb_dong_kg) || 0,
      prevDongKg: detail.prev_dong_kg || {},
      prevLabel: prevNam ? `năm ${prevNam}` : ''
    };
  }, [selectedRecord]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
        <div className="flex items-center gap-3">
          <BackButton onClick={viewMode === 'list' ? onBack : () => setViewMode('list')} />
          <div>
            <h1 className="font-display text-base font-semibold tracking-tight text-slate-900">
              Chi phí điện
            </h1>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
              Tiền điện và thành phẩm từ sổ trộn theo năm và loại/nhóm máy
            </p>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <ChiPhiDienList
          records={records}
          loaiOptions={loaiOptions}
          loading={loadingRecords}
          filterNam={filterNam}
          filterLoai={filterLoai}
          onFilterChange={handleFilterChange}
          onRefresh={() => loadRecords(filterNam)}
          onAddNew={() => {
            setSelectedRecord(null);
            setViewMode('create');
          }}
          onEdit={record => {
            setSelectedRecord(record);
            setViewMode('edit');
          }}
          onView={record => {
            setSelectedRecord(record);
            setViewMode('view');
          }}
          onDelete={handleDelete}
        />
      ) : viewMode === 'view' && selectedRecord && viewDetail ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Quay lại
              </button>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {selectedRecord.ten_bao_cao || `Chi phí điện Năm ${selectedRecord.nam}`}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Năm {selectedRecord.nam}
                  {selectedRecord.nguoi_lap ? ` · Người lập: ${selectedRecord.nguoi_lap}` : ''}
                  {selectedRecord.created_at
                    ? ` · Ngày tạo: ${new Date(selectedRecord.created_at).toLocaleDateString('vi-VN')}`
                    : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white shadow transition hover:bg-brand-700 active:scale-95"
            >
              Chỉnh sửa
            </button>
          </div>
          <ChiPhiDienSheet
            title={`CHI PHÍ TIỀN ĐIỆN NĂM ${selectedRecord.nam}`}
            rows={viewDetail.rows}
            tongTienDien={viewDetail.tongTienDien}
            tongThanhPham={viewDetail.tongThanhPham}
            tbDongKg={viewDetail.tbDongKg}
            prevDongKg={viewDetail.prevDongKg}
            prevLabel={viewDetail.prevLabel}
          />
          {selectedRecord.ghi_chu && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm">
              <span className="font-bold text-slate-800">Ghi chú chung: </span>
              {selectedRecord.ghi_chu}
            </div>
          )}
          <p className="text-[11px] text-slate-400">
            Tổng tiền điện: {fmtInt(viewDetail.tongTienDien)}đ · Tổng thành phẩm:{' '}
            {fmtInt(viewDetail.tongThanhPham)} kg
          </p>
        </div>
      ) : (
        <ChiPhiDienForm
          initialRecord={selectedRecord}
          loaiOptions={loaiOptions}
          machineTypeIndex={machineTypeIndex}
          currentUser={currentUser}
          onSave={handleSaveRecord}
          onCancel={() => setViewMode('list')}
        />
      )}
    </div>
  );
}

export default ChiPhiDienPanel;
