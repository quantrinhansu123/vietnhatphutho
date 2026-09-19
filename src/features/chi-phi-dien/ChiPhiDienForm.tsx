import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Save,
  RotateCcw,
  CheckSquare,
  Square,
  Zap,
  AlertCircle,
  Loader2,
  Calendar
} from 'lucide-react';
import type { ChiPhiDienRecord } from './types';
import { YearPickerVi } from './YearPickerVi';
import { ChiPhiDienSheet } from './ChiPhiDienSheet';
import {
  calcDongKg,
  fmtInt,
  monthRangeOf,
  parseNumLoose,
  pickYearComparison,
  sumThanhPhamByLoai
} from './aggregate';

interface ChiPhiDienFormProps {
  initialRecord?: ChiPhiDienRecord | null;
  loaiOptions: string[];
  machineTypeIndex: Map<string, string>;
  currentUser?: any;
  onSave: (recordData: Partial<ChiPhiDienRecord>) => Promise<void>;
  onCancel: () => void;
}

export function ChiPhiDienForm({
  initialRecord,
  loaiOptions,
  machineTypeIndex,
  currentUser,
  onSave,
  onCancel
}: ChiPhiDienFormProps) {
  const isEditing = Boolean(initialRecord?.id);

  const [nam, setNam] = useState(() => initialRecord?.nam || new Date().getFullYear());

  const [tenBaoCao, setTenBaoCao] = useState(
    () => initialRecord?.ten_bao_cao || `Chi phí điện Năm ${nam}`
  );
  const [nguoiLap, setNguoiLap] = useState(
    () => initialRecord?.nguoi_lap || currentUser?.name || currentUser?.username || ''
  );
  const [ghiChuChung, setGhiChuChung] = useState(() => initialRecord?.ghi_chu || '');

  const [selectedLoai, setSelectedLoai] = useState<string[]>(() => {
    if (initialRecord?.loai_may_list && initialRecord.loai_may_list.length > 0) {
      return initialRecord.loai_may_list;
    }
    return [];
  });

  const [tienDien, setTienDien] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const row of initialRecord?.chi_tiet?.rows || []) {
      map[row.loai_may] = Number(row.tien_dien) || 0;
    }
    return map;
  });
  const [thanhPhamOverride, setThanhPhamOverride] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const row of initialRecord?.chi_tiet?.rows || []) {
      map[row.loai_may] = Number(row.thanh_pham) || 0;
    }
    return map;
  });
  const [rowGhiChu, setRowGhiChu] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const row of initialRecord?.chi_tiet?.rows || []) {
      map[row.loai_may] = String(row.ghi_chu || '');
    }
    return map;
  });

  const [autoThanhPham, setAutoThanhPham] = useState<Record<string, number>>({});
  const [soTronCount, setSoTronCount] = useState(0);
  const [loadingSoTron, setLoadingSoTron] = useState(false);
  const [prevDongKg, setPrevDongKg] = useState<Record<string, number>>({});
  const [prevLabel, setPrevLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isEditing) {
      setTenBaoCao(`Chi phí điện Năm ${nam}`);
    }
  }, [nam, isEditing]);

  // Thành phẩm cả năm: gộp sổ trộn 12 tháng (sổ trộn lưu theo máy → gom theo Loại/Nhóm).
  const fetchSoTronYear = useCallback(async (y: number) => {
    setLoadingSoTron(true);
    setErrorMsg('');
    try {
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) => {
          const { from, to } = monthRangeOf(i + 1, y);
          return fetch(
            `/api/so-tron?tu_ngay=${encodeURIComponent(from)}&den_ngay=${encodeURIComponent(to)}&limit=1000`
          )
            .then(res => res.json().catch(() => ({ reports: [] })))
            .then(data => (Array.isArray(data.reports) ? data.reports : []));
        })
      );
      const seen = new Set<string>();
      const reports: Array<Record<string, unknown>> = [];
      for (const list of results) {
        for (const report of list) {
          const id = String((report as Record<string, unknown>).id ?? '');
          if (id && seen.has(id)) continue;
          if (id) seen.add(id);
          reports.push(report as Record<string, unknown>);
        }
      }
      setSoTronCount(reports.length);
      setAutoThanhPham(sumThanhPhamByLoai(reports, machineTypeIndex));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi khi tải sổ trộn để tổng hợp thành phẩm.');
      setAutoThanhPham({});
      setSoTronCount(0);
    } finally {
      setLoadingSoTron(false);
    }
  }, [machineTypeIndex]);

  useEffect(() => {
    fetchSoTronYear(nam);
  }, [nam, fetchSoTronYear]);

  // Mốc so sánh: bản ghi năm gần nhất trước năm đang xét (so với năm trước).
  useEffect(() => {
    let alive = true;
    const loadPrev = async () => {
      try {
        const res = await fetch('/api/chi-phi-dien');
        const data = await res.json().catch(() => ({ items: [] }));
        const items = Array.isArray(data.items) ? data.items : [];
        const best = pickYearComparison(items, nam, initialRecord?.id ?? null);
        if (!alive) return;
        if (best) {
          setPrevDongKg(best.dongKg);
          setPrevLabel(`năm ${best.nam}`);
        } else {
          setPrevDongKg({});
          setPrevLabel('');
        }
      } catch {
        if (alive) {
          setPrevDongKg({});
          setPrevLabel('');
        }
      }
    };
    loadPrev();
    return () => {
      alive = false;
    };
  }, [nam, initialRecord?.id]);

  const rows = useMemo(() => {
    return selectedLoai.map(loai => {
      const tien = Number(tienDien[loai]) || 0;
      const sp = thanhPhamOverride[loai] ?? autoThanhPham[loai] ?? 0;
      return {
        loai_may: loai,
        tien_dien: tien,
        thanh_pham: Number(sp) || 0,
        dong_kg: calcDongKg(tien, Number(sp) || 0),
        ghi_chu: rowGhiChu[loai] ?? ''
      };
    });
  }, [selectedLoai, tienDien, thanhPhamOverride, autoThanhPham, rowGhiChu]);

  const tongTienDien = useMemo(() => rows.reduce((s, r) => s + r.tien_dien, 0), [rows]);
  const tongThanhPham = useMemo(() => rows.reduce((s, r) => s + r.thanh_pham, 0), [rows]);
  const tbDongKg = useMemo(() => calcDongKg(tongTienDien, tongThanhPham), [tongTienDien, tongThanhPham]);

  const toggleLoai = (loai: string) => {
    setSelectedLoai(prev => (prev.includes(loai) ? prev.filter(l => l !== loai) : [...prev, loai]));
  };

  const layLaiThanhPham = () => {
    // Bỏ các sửa tay, dùng lại số sổ trộn vừa tổng hợp.
    setThanhPhamOverride({ ...autoThanhPham });
  };

  const handleSave = async () => {
    if (selectedLoai.length === 0) {
      alert('Vui lòng chọn ít nhất một loại/nhóm máy.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        id: initialRecord?.id,
        thang: 0,
        nam,
        ten_bao_cao: tenBaoCao.trim() || `Chi phí điện Năm ${nam}`,
        loai_may_list: selectedLoai,
        tong_tien_dien: Math.round(tongTienDien),
        tong_thanh_pham: Math.round(tongThanhPham * 100) / 100,
        tb_dong_kg: tbDongKg,
        chi_tiet: {
          ky: 'nam',
          thang: 0,
          nam,
          rows,
          tong_tien_dien: Math.round(tongTienDien),
          tong_thanh_pham: Math.round(tongThanhPham * 100) / 100,
          tb_dong_kg: tbDongKg,
          prev_thang: 0,
          prev_nam: null,
          prev_dong_kg: prevDongKg
        },
        ghi_chu: ghiChuChung.trim(),
        nguoi_lap: nguoiLap.trim()
      });
    } catch (err: any) {
      alert(err?.message || 'Có lỗi xảy ra khi lưu chi phí điện.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              {isEditing ? 'Chỉnh sửa chi phí điện' : 'Thêm mới chi phí điện'}
            </h1>
            <p className="text-[11px] text-slate-500">
              Thành phẩm tự tổng hợp từ sổ trộn cả năm theo loại/nhóm máy
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchSoTronYear(nam)}
            disabled={loadingSoTron}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            title="Tổng hợp lại thành phẩm từ sổ trộn của năm đang chọn"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loadingSoTron ? 'animate-spin' : ''}`} />
            Lấy lại từ sổ trộn
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || loadingSoTron}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white shadow transition hover:bg-brand-700 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Lưu chi phí điện
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          1. Năm tính & loại máy
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <YearPickerVi
            nam={nam}
            onChange={y => setNam(y)}
            label="Chọn Năm (*)"
          />
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Tên bảng chi phí</label>
            <input
              type="text"
              value={tenBaoCao}
              onChange={e => setTenBaoCao(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Người lập</label>
            <input
              type="text"
              value={nguoiLap}
              onChange={e => setNguoiLap(e.target.value)}
              placeholder="Họ tên người lập"
              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Zap className="h-3.5 w-3.5 text-brand-600" />
              <span>Chọn loại/nhóm máy (*):</span>
              <span className="font-bold text-brand-600">
                ({selectedLoai.length} / {loaiOptions.length} loại đã chọn)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedLoai([...loaiOptions])}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
              >
                Chọn tất cả
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setSelectedLoai([])}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline"
              >
                Bỏ chọn tất cả
              </button>
            </div>
          </div>
          {loaiOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
              Chưa tải được Loại/Nhóm từ danh sách máy. Kiểm tra lại danh mục máy.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {loaiOptions.map(loai => {
                const isSelected = selectedLoai.includes(loai);
                return (
                  <button
                    key={loai}
                    type="button"
                    onClick={() => toggleLoai(loai)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/80 font-bold text-brand-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-brand-600" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    <span className="truncate" title={loai}>
                      {loai}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Calendar className="h-3.5 w-3.5" />
            {loadingSoTron ? (
              'Đang tổng hợp thành phẩm từ sổ trộn...'
            ) : (
              <>
                Đã tổng hợp từ <strong>{soTronCount} phiếu sổ trộn</strong> năm {nam}.
                Thành phẩm mỗi loại có thể sửa tay nếu thiếu phiếu.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            2. Nhập tiền điện & thành phẩm theo loại máy
          </h2>
          <button
            type="button"
            onClick={layLaiThanhPham}
            className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            Đặt lại thành phẩm theo sổ trộn
          </button>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
            Chưa chọn loại máy nào. Hãy chọn ít nhất một loại/nhóm máy ở mục 1.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <tr>
                  <th className="px-3.5 py-2.5">Loại máy</th>
                  <th className="px-3.5 py-2.5 text-right">Tiền điện (đ)</th>
                  <th className="px-3.5 py-2.5 text-right">Thành phẩm (kg)</th>
                  <th className="px-3.5 py-2.5 text-right">Đồng/Kg</th>
                  <th className="px-3.5 py-2.5">Diễn giải (trong ngoặc)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(row => (
                  <tr key={row.loai_may} className="transition hover:bg-slate-50/70">
                    <td className="px-3.5 py-2.5 font-bold text-slate-900">{row.loai_may}</td>
                    <td className="px-3.5 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={tienDien[row.loai_may] ?? 0}
                        onChange={e =>
                          setTienDien(prev => ({
                            ...prev,
                            [row.loai_may]: parseNumLoose(e.target.value)
                          }))
                        }
                        className="h-8 w-36 rounded border border-slate-300 px-2 py-1 text-right text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={thanhPhamOverride[row.loai_may] ?? autoThanhPham[row.loai_may] ?? 0}
                        onChange={e =>
                          setThanhPhamOverride(prev => ({
                            ...prev,
                            [row.loai_may]: parseNumLoose(e.target.value)
                          }))
                        }
                        className="h-8 w-32 rounded border border-slate-300 px-2 py-1 text-right text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none"
                        title={`Sổ trộn tự tổng hợp: ${fmtInt(autoThanhPham[row.loai_may] ?? 0)} kg`}
                      />
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        Sổ trộn: {fmtInt(autoThanhPham[row.loai_may] ?? 0)} kg
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-sm font-extrabold text-slate-900">
                      {fmtInt(row.dong_kg)}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <input
                        type="text"
                        value={rowGhiChu[row.loai_may] ?? ''}
                        onChange={e =>
                          setRowGhiChu(prev => ({ ...prev, [row.loai_may]: e.target.value }))
                        }
                        placeholder="vd: trong năm thay khuôn 2 lần"
                        className="h-8 w-full min-w-[200px] rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-brand-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-100/80 font-bold text-slate-900">
                <tr>
                  <td className="px-3.5 py-2.5 text-right uppercase">TB/SL:</td>
                  <td className="px-3.5 py-2.5 text-right text-sm">{fmtInt(tongTienDien)} đ</td>
                  <td className="px-3.5 py-2.5 text-right text-sm">{fmtInt(tongThanhPham)} kg</td>
                  <td className="px-3.5 py-2.5 text-right text-sm text-red-600">{fmtInt(tbDongKg)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          3. Xem trước phiếu chi phí tiền điện
        </h2>
        <ChiPhiDienSheet
          title={`CHI PHÍ TIỀN ĐIỆN NĂM ${nam}`}
          rows={rows}
          tongTienDien={tongTienDien}
          tongThanhPham={tongThanhPham}
          tbDongKg={tbDongKg}
          prevDongKg={prevDongKg}
          prevLabel={prevLabel}
        />
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Ghi chú chung của bảng chi phí
          </label>
          <textarea
            rows={2}
            value={ghiChuChung}
            onChange={e => setGhiChuChung(e.target.value)}
            placeholder="Ghi chú thêm nếu có..."
            className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      </div>
    </div>
  );
}

export default ChiPhiDienForm;
