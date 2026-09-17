import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Cpu,
  Edit2,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  X
} from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import {
  findMachineByRef,
  machineSelectValue,
  normalizeMachines,
  type MachineRow
} from '../danh-sach-may';
import { StaffSelect } from './StaffSelect';
import { SoTronDatePicker, formatNgayVN } from '../so-tron/SoTronDatePicker';
import { TimePicker24h } from '../../components/shared/TimePicker24h';
import { getTieuChuanContent } from './types';
import { getProductionShiftOptions, normalizeShiftSettings } from '../../utils/shiftSettings';
import { STANDARD_SHIFTS } from '../../types';
import {
  type SoGiaoCaMmtbRecord,
  type DongTieuChuan,
  type DongCheDoChayRow,
  type DongSanPhamRow,
  COT_THAY_MANG,
  COT_KHU_KHUON,
  defaultDongTieuChuan,
  DEFAULT_TIEU_CHUAN_SP_NOTE
} from './types';
import { printSoGiaoCaMmtbSlip, printSoGiaoCaMmtbList } from './print';
import { SoGiaoCaMmtbPreviewModal } from './SoGiaoCaMmtbPreviewModal';
export type { SoGiaoCaMmtbRecord } from './types';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createEmptyCheDoRow(stt: number): DongCheDoChayRow {
  const thay_mang: Record<string, string> = {};
  COT_THAY_MANG.forEach(c => { thay_mang[c] = ''; });
  const khu_khuon: Record<string, string> = {};
  COT_KHU_KHUON.forEach(c => { khu_khuon[c] = ''; });

  return {
    key: uid(),
    stt,
    thoi_gian_kiem_tra: '',
    toc_do_bom: '',
    toc_do_lo: '',
    do_day: '',
    chieu_rong: '',
    chieu_dai: '',
    thay_mang_note: '',
    thay_mang,
    khu_khuon,
    lo_ep_quang: { tren: '', giua: '', duoi: '' },
    ghi_chu: ''
  };
}

export function createEmptySpRow(stt: number): DongSanPhamRow {
  return {
    key: uid(),
    stt,
    gio_kiem_tra: '',
    mau_sac: '',
    do_day: '',
    chieu_rong: '',
    chieu_dai: '',
    trong_luong: '',
    so_seri: '',
    ket_qua: 'Đạt'
  };
}

export function createDefaultRecord(): SoGiaoCaMmtbRecord {
  return {
    id: '',
    chi_nhanh: 'Phú Thọ',
    ngay: getTodayString(),
    ma_may: '',
    ten_may: '',
    ca: 'Ca 1',
    ma_lenh_sx: '',
    ten_san_pham: '',
    quy_cach: '',
    truong_ca: '',
    nguoi_kiem_tra: '',
    dong_tieu_chuan: defaultDongTieuChuan(),
    bang_che_do_chay: [createEmptyCheDoRow(1), createEmptyCheDoRow(2)],
    bang_san_pham: [createEmptySpRow(1), createEmptySpRow(2), createEmptySpRow(3)],
    ghi_chu_tieu_chuan_sp: DEFAULT_TIEU_CHUAN_SP_NOTE,
    chu_ky: {
      truong_ca: '',
      nguoi_kiem_tra: ''
    }
  };
}

// =========================================================================
// PANEL NHẬP LIỆU SỔ GIAO CA MMTB
// =========================================================================

interface SoGiaoCaMmtbPanelProps {
  onBack?: () => void;
  onOpenList?: () => void;
  editRecord?: SoGiaoCaMmtbRecord | null;
  onEditConsumed?: () => void;
}

export function SoGiaoCaMmtbPanel({
  onBack,
  onOpenList,
  editRecord,
  onEditConsumed
}: SoGiaoCaMmtbPanelProps) {
  const [record, setRecord] = useState<SoGiaoCaMmtbRecord>(createDefaultRecord);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [shiftOptions, setShiftOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Load master data (máy, ca)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setIsLoadingMaster(true);
      try {
        const [machineRes, settingRes] = await Promise.all([
          fetch('/api/danh-sach-may'),
          fetch('/api/cai-dat')
        ]);
        const [machineData, settingData] = await Promise.all([
          machineRes.json().catch(() => ({})),
          settingRes.json().catch(() => ({}))
        ]);

        if (!alive) return;

        if (machineRes.ok) {
          const list = normalizeMachines(machineData).filter(
            m => !m.branch || m.branch === '-' || /phú thọ/i.test(m.branch)
          );
          setMachines(list.length > 0 ? list : normalizeMachines(machineData));
        }

        if (settingRes.ok) {
          const options = getProductionShiftOptions(normalizeShiftSettings(settingData));
          setShiftOptions(options.length > 0 ? options : STANDARD_SHIFTS.map(s => ({ value: s, label: s })));
        } else {
          setShiftOptions(STANDARD_SHIFTS.map(s => ({ value: s, label: s })));
        }


      } catch (err) {
        console.error('Lỗi tải danh mục:', err);
      } finally {
        if (alive) setIsLoadingMaster(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, []);

  // Khi có editRecord truyền vào từ list view
  useEffect(() => {
    if (editRecord) {
      setRecord(JSON.parse(JSON.stringify(editRecord)));
      onEditConsumed?.();
    }
  }, [editRecord, onEditConsumed]);

  // Options máy cho SearchableSelect
  const machineOptions = useMemo(() => {
    return machines.map(m => ({
      value: m.code || m.id,
      label: machineSelectValue(m)
    }));
  }, [machines]);

  const handleSelectMachine = (code: string) => {
    const found = findMachineByRef(machines, code);
    setRecord(prev => ({
      ...prev,
      ma_may: found?.code || code,
      ten_may: found?.name || code
    }));
  };

  // Cập nhật dòng tiêu chuẩn (người dùng tự do nhập)
  const updateDongTieuChuan = (patch: Partial<DongTieuChuan>) => {
    setRecord(prev => ({
      ...prev,
      dong_tieu_chuan: {
        ...prev.dong_tieu_chuan,
        ...patch
      }
    }));
  };

  // Cập nhật bảng chế độ chạy
  const updateCheDoRow = (idx: number, patch: Partial<DongCheDoChayRow>) => {
    setRecord(prev => {
      const next = [...prev.bang_che_do_chay];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, bang_che_do_chay: next };
    });
  };

  const addCheDoRow = () => {
    setRecord(prev => ({
      ...prev,
      bang_che_do_chay: [
        ...prev.bang_che_do_chay,
        createEmptyCheDoRow(prev.bang_che_do_chay.length + 1)
      ]
    }));
  };

  const removeCheDoRow = (idx: number) => {
    setRecord(prev => ({
      ...prev,
      bang_che_do_chay: prev.bang_che_do_chay
        .filter((_, i) => i !== idx)
        .map((r, i) => ({ ...r, stt: i + 1 }))
    }));
  };

  // Cập nhật bảng sản phẩm
  const updateSpRow = (idx: number, patch: Partial<DongSanPhamRow>) => {
    setRecord(prev => {
      const next = [...prev.bang_san_pham];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, bang_san_pham: next };
    });
  };

  const addSpRow = () => {
    setRecord(prev => ({
      ...prev,
      bang_san_pham: [
        ...prev.bang_san_pham,
        createEmptySpRow(prev.bang_san_pham.length + 1)
      ]
    }));
  };

  const removeSpRow = (idx: number) => {
    setRecord(prev => ({
      ...prev,
      bang_san_pham: prev.bang_san_pham
        .filter((_, i) => i !== idx)
        .map((r, i) => ({ ...r, stt: i + 1 }))
    }));
  };

  // Lưu sổ giao ca MMTB
  const handleSave = async (andPrint = false): Promise<boolean> => {
    if (!record.ngay) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ngày giao ca.' });
      return false;
    }
    if (!record.ma_may) {
      setMessage({ type: 'error', text: 'Vui lòng chọn máy sản xuất.' });
      return false;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const isUpdate = Boolean(record.id);
      const url = isUpdate
        ? `/api/so-giao-ca-mmtb/${encodeURIComponent(record.id)}`
        : '/api/so-giao-ca-mmtb';
      const method = isUpdate ? 'PUT' : 'POST';

      const payload = {
        ...record,
        chu_ky: {
          truong_ca: record.truong_ca,
          nguoi_kiem_tra: record.nguoi_kiem_tra
        }
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi lưu sổ giao ca MMTB');
      }

      const savedRecord = data.record || { ...payload, id: data.id || record.id };
      setRecord(savedRecord);
      setMessage({
        type: 'success',
        text: isUpdate ? 'Đã cập nhật sổ giao ca thành công!' : 'Đã tạo mới sổ giao ca thành công!'
      });

      if (andPrint) {
        setTimeout(() => {
          printSoGiaoCaMmtbSlip(savedRecord);
        }, 200);
      }

      return true;
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Lỗi kết nối máy chủ.' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetForm = () => {
    if (window.confirm('Bạn có chắc muốn làm mới toàn bộ biểu mẫu?')) {
      setRecord(createDefaultRecord());
      setMessage(null);
    }
  };

  const tc = record.dong_tieu_chuan;

  return (
    <div className="min-h-screen bg-slate-50/75 p-4 sm:p-6 pb-24">
      {/* Header điều hướng */}
      <div className="mx-auto max-w-7xl mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[14px] font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              SỔ GIAO CA MÁY MÓC THIẾT BỊ (MMTB)
            </h1>
            <p className="text-[14px] text-slate-500">
              Bảng theo dõi chế độ chạy máy & chất lượng hàng ngày (Trưởng ca / Công nhân)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenList && (
            <button
              type="button"
              onClick={onOpenList}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Danh sách sổ giao ca
            </button>
          )}

          <button
            type="button"
            onClick={handleResetForm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Làm mới
          </button>

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[14px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 shadow-sm transition"
          >
            <Eye className="w-4 h-4 text-indigo-600" />
            Xem & In
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(false)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[14px] font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50 transition"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {record.id ? 'Cập nhật' : 'Lưu'}
          </button>
        </div>
      </div>

      {/* Thông báo */}
      {message && (
        <div
          className={`mx-auto max-w-7xl mb-4 p-3 rounded-lg text-[14px] font-medium flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BỘ LỌC CHỌN: NGÀY, MÁY, CA */}
      <div className="mx-auto max-w-7xl bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[14px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              1. Chọn Ngày:
            </label>
            <SoTronDatePicker
              value={record.ngay}
              onChange={ngay => setRecord(prev => ({ ...prev, ngay }))}
              placeholder="Chọn ngày"
            />
          </div>

          <div>
            <label className="text-[14px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              2. Chọn Máy:
            </label>
            <SearchableSelect
              options={machineOptions}
              getLabel={item => (item as { label: string }).label}
              getValue={item => (item as { value: string }).value}
              value={record.ma_may}
              onChange={handleSelectMachine}
              placeholder="-- Chọn máy --"
              inputClassName="w-full text-[14px] border border-slate-300 rounded-lg px-2.5 py-1.5"
            />
          </div>

          <div>
            <label className="text-[14px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              3. Chọn Ca:
            </label>
            <select
              value={record.ca}
              onChange={e => setRecord(prev => ({ ...prev, ca: e.target.value }))}
              className="w-full text-[14px] font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
            >
              {shiftOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Trưởng ca và Người kiểm tra */}
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[13px] font-medium text-slate-600 mb-1">Trưởng ca:</label>
            <StaffSelect kind="production" value={record.truong_ca} onChange={value => setRecord(prev => ({ ...prev, truong_ca: value }))} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-slate-600 mb-1">Người kiểm tra:</label>
            <StaffSelect kind="inspector" value={record.nguoi_kiem_tra} onChange={value => setRecord(prev => ({ ...prev, nguoi_kiem_tra: value }))} />
          </div>
        </div>
      </div>

      {/* BIỂU MẪU MÔ PHỎNG GIẤY IN A4 */}
      <div className="mx-auto max-w-7xl bg-white border border-slate-300 rounded-xl shadow p-4 sm:p-5 space-y-6">
        {/* Header form */}
        <div className="border-b border-slate-200 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-center md:text-left">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-wider text-slate-600">
              CÔNG TY CỔ PHẦN SX & TM VIỆT NHẬT PHÚ THỌ
            </div>
            <div className="text-[14px] sm:text-[14px] font-black uppercase text-slate-900 mt-0.5">
              BẢNG THEO DÕI CHẾ ĐỘ CHẠY MÁY & CHẤT LƯỢNG HÀNG NGÀY
            </div>
            <div className="text-[13px] text-slate-400 italic">Mã biểu mẫu: BM-SX-07</div>
          </div>

          <div className="text-[14px] bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-left grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <span className="text-slate-500">Ngày:</span>{' '}
              <span className="font-semibold text-slate-800">{formatNgayVN(record.ngay) || '---'}</span>
            </div>
            <div>
              <span className="text-slate-500">Ca:</span>{' '}
              <span className="font-semibold text-slate-800">{record.ca || '---'}</span>
            </div>
            <div>
              <span className="text-slate-500">Máy:</span>{' '}
              <span className="font-semibold text-slate-800">{record.ten_may || record.ma_may || '---'}</span>
            </div>
          </div>
        </div>

        {/* PHẦN 1: BẢNG CHẾ ĐỘ CHẠY MÁY */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              I. Chế độ chạy máy & Nhiệt độ
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                ⭐ Dòng Tiêu Chuẩn do người dùng tự nhập
              </span>
              <button
                type="button"
                onClick={addCheDoRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[14px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm giờ KT
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-400 rounded">
            <table className="w-full min-w-[1400px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
                  <th rowSpan={2} className="border-r border-slate-300 px-1 py-1 text-center w-8">
                    STT
                  </th>
                  <th rowSpan={2} className="border-r border-slate-300 px-1 py-1 text-center w-28">
                    Thời gian
                    <br />
                    <span className="text-[13px] font-normal text-slate-500">(24h)</span>
                  </th>
                  <th rowSpan={2} className="border-r border-slate-300 px-1 py-1 text-center w-14">
                    Bơm
                    <br />
                    <span className="text-[13px] font-normal text-slate-500">(v/p)</span>
                  </th>
                  <th rowSpan={2} className="border-r border-slate-300 px-1 py-1 text-center w-14">
                    Lô
                    <br />
                    <span className="text-[13px] font-normal text-slate-500">(v/p)</span>
                  </th>
                  <th colSpan={3} className="border-r border-slate-300 px-1 py-0.5 text-center bg-amber-50 text-amber-800">
                    Kích thước SP
                  </th>
                  <th colSpan={COT_THAY_MANG.length} className="border-r border-slate-300 px-1 py-0.5 text-center bg-sky-50 text-sky-800">
                    Nhiệt độ thay màng
                  </th>
                  <th colSpan={COT_KHU_KHUON.length} className="border-r border-slate-300 px-1 py-0.5 text-center bg-emerald-50 text-emerald-800">
                    Nhiệt độ khu khuôn
                  </th>
                  <th colSpan={3} className="border-r border-slate-300 px-1 py-0.5 text-center bg-violet-50 text-violet-800">
                    Lô ép quang
                  </th>
                  <th rowSpan={2} className="border-r border-slate-300 px-1 py-1 text-center w-20">
                    Ghi chú
                  </th>
                  <th rowSpan={2} className="px-1 py-1 text-center w-8">
                    Xóa
                  </th>
                </tr>
                <tr className="bg-slate-100 text-[13px] text-slate-600 border-b border-slate-300">
                  <th className="border-r border-slate-300 px-1 py-0.5 text-center min-w-[70px] bg-amber-50/50">
                    Độ dày
                  </th>
                  <th className="border-r border-slate-300 px-1 py-0.5 text-center min-w-[70px] bg-amber-50/50">
                    Chiều rộng
                  </th>
                  <th className="border-r border-slate-300 px-1 py-0.5 text-center min-w-[70px] bg-amber-50/50">
                    Chiều dài
                  </th>
                  {COT_THAY_MANG.map(c => (
                    <th key={c} className="border-r border-slate-300 px-1 py-0.5 text-center min-w-[28px] bg-sky-50/50">
                      {c}
                    </th>
                  ))}
                  {COT_KHU_KHUON.map(c => (
                    <th key={c} className="border-r border-slate-300 px-1 py-0.5 text-center min-w-[28px] bg-emerald-50/50">
                      {c}
                    </th>
                  ))}
                  <th className="border-r border-slate-300 px-1 py-0.5 text-center min-w-[28px] bg-violet-50/50">Trên</th>
                  <th className="border-r border-slate-300 px-1 py-0.5 text-center min-w-[28px] bg-violet-50/50">Giữa</th>
                  <th className="border-r border-slate-300 px-1 py-0.5 text-center min-w-[28px] bg-violet-50/50">Dưới</th>
                </tr>
              </thead>
              <tbody>
                {/* DÒNG TIÊU CHUẨN: NGƯỜI DÙNG TỰ NHẬP */}
                <tr className="bg-amber-100/70 font-semibold border-b border-slate-400">
                  <td colSpan={2} className="border-r border-slate-400 px-2 py-1 text-center text-amber-900 font-bold">
                    Tiêu Chuẩn
                  </td>
                  <td colSpan={32} className="border-r border-slate-400 p-0">
                    <textarea value={getTieuChuanContent(tc)} onChange={e => updateDongTieuChuan({ noi_dung: e.target.value })} aria-label="Tiêu chuẩn từ Bơm đến Lô ép quang (gồm kích thước SP)" rows={2} className="w-full bg-transparent px-2 py-1 text-[13px] outline-none focus:bg-white" />
                  </td>
                  <td className="border-r border-slate-400 p-0">
                    <input
                      type="text"
                      value={tc.ghi_chu}
                      onChange={e => updateDongTieuChuan({ ghi_chu: e.target.value })}
                      placeholder="Ghi chú TC"
                      className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-white"
                    />
                  </td>
                  <td className="text-center text-slate-400 text-[13px] italic">TC</td>
                </tr>

                {/* CÁC DÒNG THEO DÕI THỰC TẾ */}
                {record.bang_che_do_chay.map((row, idx) => (
                  <tr key={row.key} className="border-b border-slate-300 hover:bg-slate-50/70">
                    <td className="border-r border-slate-300 px-1 py-1 text-center font-medium text-slate-600">
                      {row.stt}
                    </td>
                    <td className="border-r border-slate-300 p-0">
                      <div className="flex justify-center px-0.5 py-0.5">
                        <TimePicker24h
                          value={row.thoi_gian_kiem_tra}
                          onChange={v => updateCheDoRow(idx, { thoi_gian_kiem_tra: v })}
                          className="bg-transparent px-0.5 py-1 text-center text-[13px] outline-none cursor-pointer rounded hover:bg-indigo-50 focus:bg-indigo-50"
                          aria-label="Thời gian kiểm tra (24h)"
                        />
                      </div>
                    </td>
                    <td className="border-r border-slate-300 p-0">
                      <input
                        type="text"
                        value={row.toc_do_bom}
                        onChange={e => updateCheDoRow(idx, { toc_do_bom: e.target.value })}
                        placeholder="--"
                        className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                      />
                    </td>
                    <td className="border-r border-slate-300 p-0">
                      <input
                        type="text"
                        value={row.toc_do_lo}
                        onChange={e => updateCheDoRow(idx, { toc_do_lo: e.target.value })}
                        placeholder="--"
                        className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                      />
                    </td>
                    <td className="border-r border-slate-300 p-0">
                      <input
                        type="text"
                        value={row.do_day || ''}
                        onChange={e => updateCheDoRow(idx, { do_day: e.target.value })}
                        placeholder="--"
                        className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                      />
                    </td>
                    <td className="border-r border-slate-300 p-0">
                      <input
                        type="text"
                        value={row.chieu_rong || ''}
                        onChange={e => updateCheDoRow(idx, { chieu_rong: e.target.value })}
                        placeholder="--"
                        className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                      />
                    </td>
                    <td className="border-r border-slate-300 p-0">
                      <input
                        type="text"
                        value={row.chieu_dai || ''}
                        onChange={e => updateCheDoRow(idx, { chieu_dai: e.target.value })}
                        placeholder="--"
                        className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                      />
                    </td>
                    {COT_THAY_MANG.map(c => (
                      <td key={c} className="border-r border-slate-300 p-0">
                        <input
                          type="text"
                          value={row.thay_mang?.[c] || ''}
                          onChange={e =>
                            updateCheDoRow(idx, {
                              thay_mang: { ...row.thay_mang, [c]: e.target.value }
                            })
                          }
                          placeholder="--"
                          className="w-full bg-transparent px-0.5 py-1 text-center text-[13px] outline-none focus:bg-indigo-50"
                        />
                      </td>
                    ))}
                    {COT_KHU_KHUON.map(c => (
                      <td key={c} className="border-r border-slate-300 p-0">
                        <input
                          type="text"
                          value={row.khu_khuon?.[c] || ''}
                          onChange={e =>
                            updateCheDoRow(idx, {
                              khu_khuon: { ...row.khu_khuon, [c]: e.target.value }
                            })
                          }
                          placeholder="--"
                          className="w-full bg-transparent px-0.5 py-1 text-center text-[13px] outline-none focus:bg-indigo-50"
                        />
                      </td>
                    ))}
                    <td className="border-r border-slate-300 p-0">
                      <input
                        type="text"
                        value={row.lo_ep_quang?.tren || ''}
                        onChange={e =>
                          updateCheDoRow(idx, {
                            lo_ep_quang: { ...row.lo_ep_quang, tren: e.target.value }
                          })
                        }
                        placeholder="--"
                        className="w-full bg-transparent px-0.5 py-1 text-center text-[13px] outline-none focus:bg-indigo-50"
                      />
                    </td>
                    <td className="border-r border-slate-300 p-0">
                      <input
                        type="text"
                        value={row.lo_ep_quang?.giua || ''}
                        onChange={e =>
                          updateCheDoRow(idx, {
                            lo_ep_quang: { ...row.lo_ep_quang, giua: e.target.value }
                          })
                        }
                        placeholder="--"
                        className="w-full bg-transparent px-0.5 py-1 text-center text-[13px] outline-none focus:bg-indigo-50"
                      />
                    </td>
                    <td className="border-r border-slate-300 p-0">
                      <input
                        type="text"
                        value={row.lo_ep_quang?.duoi || ''}
                        onChange={e =>
                          updateCheDoRow(idx, {
                            lo_ep_quang: { ...row.lo_ep_quang, duoi: e.target.value }
                          })
                        }
                        placeholder="--"
                        className="w-full bg-transparent px-0.5 py-1 text-center text-[13px] outline-none focus:bg-indigo-50"
                      />
                    </td>
                    <td className="border-r border-slate-300 p-0">
                      <input
                        type="text"
                        value={row.ghi_chu || ''}
                        onChange={e => updateCheDoRow(idx, { ghi_chu: e.target.value })}
                        placeholder="Ghi chú"
                        className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                      />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeCheDoRow(idx)}
                        className="text-slate-400 hover:text-rose-600 transition"
                        title="Xóa dòng này"
                      >
                        <Trash2 className="w-3.5 h-3.5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PHẦN 2: BẢNG SẢN PHẨM & TIÊU CHUẨN */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Cột tiêu chuẩn sản phẩm */}
          <div className="lg:col-span-1 bg-slate-50 border border-slate-300 rounded-lg p-3">
            <h3 className="text-[14px] font-bold text-slate-800 uppercase mb-2 flex items-center justify-between">
              <span>II. Tiêu chuẩn kiểm tra SP</span>
              <span className="text-[13px] font-normal text-indigo-600 lowercase">(cho phép chỉnh sửa)</span>
            </h3>
            <textarea
              rows={8}
              value={record.ghi_chu_tieu_chuan_sp}
              onChange={e => setRecord(prev => ({ ...prev, ghi_chu_tieu_chuan_sp: e.target.value }))}
              placeholder="Nhập tiêu chuẩn kiểm tra sản phẩm..."
              className="w-full text-[14px] font-mono border border-slate-200 rounded p-2 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none leading-relaxed"
            />
          </div>

          {/* Cột bảng mẫu kiểm tra sản phẩm */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[14px] font-bold text-slate-800 uppercase">
                Bảng theo dõi chất lượng mẫu sản phẩm
              </h3>
              <button
                type="button"
                onClick={addSpRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[14px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm dòng SP
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-300 rounded">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300 text-center">
                    <th className="border-r border-slate-300 px-1 py-1 w-8">STT</th>
                    <th className="border-r border-slate-300 px-1 py-1 w-28">Giờ KT (24h)</th>
                    <th className="border-r border-slate-300 px-1 py-1">Màu sắc</th>
                    <th className="border-r border-slate-300 px-1 py-1">Độ dày</th>
                    <th className="border-r border-slate-300 px-1 py-1">Chiều rộng</th>
                    <th className="border-r border-slate-300 px-1 py-1">Chiều dài</th>
                    <th className="border-r border-slate-300 px-1 py-1">Trọng lượng</th>
                    <th className="border-r border-slate-300 px-1 py-1">Số seri</th>
                    <th className="border-r border-slate-300 px-1 py-1 w-16">Kết quả</th>
                    <th className="px-1 py-1 w-8">Xóa</th>
                  </tr>
                </thead>
                <tbody>
                  {record.bang_san_pham.map((row, idx) => (
                    <tr key={row.key} className="border-b border-slate-300 hover:bg-slate-50/70">
                      <td className="border-r border-slate-300 px-1 py-1 text-center font-medium text-slate-600">
                        {row.stt}
                      </td>
                      <td className="border-r border-slate-300 p-0">
                        <div className="flex justify-center px-0.5 py-0.5">
                          <TimePicker24h
                            value={row.gio_kiem_tra}
                            onChange={v => updateSpRow(idx, { gio_kiem_tra: v })}
                            className="bg-transparent px-0.5 py-1 text-center text-[13px] outline-none cursor-pointer rounded hover:bg-indigo-50 focus:bg-indigo-50"
                            aria-label="Giờ kiểm tra (24h)"
                          />
                        </div>
                      </td>
                      <td className="border-r border-slate-300 p-0">
                        <input
                          type="text"
                          value={row.mau_sac}
                          onChange={e => updateSpRow(idx, { mau_sac: e.target.value })}
                          placeholder="Màu sắc"
                          className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                        />
                      </td>
                      <td className="border-r border-slate-300 p-0">
                        <input
                          type="text"
                          value={row.do_day}
                          onChange={e => updateSpRow(idx, { do_day: e.target.value })}
                          placeholder="Độ dày"
                          className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                        />
                      </td>
                      <td className="border-r border-slate-300 p-0">
                        <input
                          type="text"
                          value={row.chieu_rong}
                          onChange={e => updateSpRow(idx, { chieu_rong: e.target.value })}
                          placeholder="Chiều rộng"
                          className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                        />
                      </td>
                      <td className="border-r border-slate-300 p-0">
                        <input
                          type="text"
                          value={row.chieu_dai}
                          onChange={e => updateSpRow(idx, { chieu_dai: e.target.value })}
                          placeholder="Chiều dài"
                          className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                        />
                      </td>
                      <td className="border-r border-slate-300 p-0">
                        <input
                          type="text"
                          value={row.trong_luong}
                          onChange={e => updateSpRow(idx, { trong_luong: e.target.value })}
                          placeholder="Trọng lượng"
                          className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                        />
                      </td>
                      <td className="border-r border-slate-300 p-0">
                        <input
                          type="text"
                          value={row.so_seri}
                          onChange={e => updateSpRow(idx, { so_seri: e.target.value })}
                          placeholder="Số seri"
                          className="w-full bg-transparent px-1 py-1 text-center text-[14px] outline-none focus:bg-indigo-50"
                        />
                      </td>
                      <td className="border-r border-slate-300 p-0">
                        <select
                          value={row.ket_qua}
                          onChange={e => updateSpRow(idx, { ket_qua: e.target.value })}
                          className={`w-full bg-transparent px-1 py-1 text-center text-[14px] font-semibold outline-none ${
                            row.ket_qua === 'Đạt' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          <option value="Đạt">Đạt</option>
                          <option value="K.Đạt">K.Đạt</option>
                          <option value="Chờ XL">Chờ XL</option>
                        </select>
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeSpRow(idx)}
                          className="text-slate-400 hover:text-rose-600 transition"
                          title="Xóa dòng này"
                        >
                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* PHẦN 3: KÝ TÊN */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-2 text-center text-[14px]">
          <div>
            <div className="font-bold uppercase text-slate-800">TRƯỞNG CA</div>
            <div className="text-[13px] text-slate-400 italic mb-10">(Ký, ghi rõ họ tên)</div>
            <div className="font-semibold text-slate-800">{record.truong_ca || '................................'}</div>
          </div>
          <div>
            <div className="font-bold uppercase text-slate-800">NGƯỜI KIỂM TRA</div>
            <div className="text-[13px] text-slate-400 italic mb-10">(Ký, ghi rõ họ tên)</div>
            <div className="font-semibold text-slate-800">{record.nguoi_kiem_tra || '................................'}</div>
          </div>
        </div>

        {/* Thanh nút lưu phía dưới */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[14px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition shadow-sm"
          >
            <Eye className="w-4 h-4 text-indigo-600" />
            Xem trước & In
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[14px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Lưu & In ngay
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(false)}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-[14px] font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow transition disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {record.id ? 'Lưu thay đổi' : 'Lưu sổ giao ca'}
          </button>
        </div>
      </div>

      {/* MODAL XEM TRƯỚC VÀ IN */}
      {previewOpen && (
        <SoGiaoCaMmtbPreviewModal
          open={previewOpen}
          record={record}
          onClose={() => setPreviewOpen(false)}
          onSaved={updated => {
            setRecord(updated);
            setMessage({ type: 'success', text: 'Đã lưu sổ giao ca MMTB!' });
          }}
        />
      )}
    </div>
  );
}

// =========================================================================
// LIST VIEW: DANH SÁCH SỔ GIAO CA MMTB
// =========================================================================

interface SoGiaoCaMmtbListViewProps {
  onBack?: () => void;
  onCreate?: () => void;
  onEdit?: (record: SoGiaoCaMmtbRecord) => void;
}

export function SoGiaoCaMmtbListView({ onBack, onCreate, onEdit }: SoGiaoCaMmtbListViewProps) {
  const [records, setRecords] = useState<SoGiaoCaMmtbRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [previewRecord, setPreviewRecord] = useState<SoGiaoCaMmtbRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/so-giao-ca-mmtb?limit=150');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi tải danh sách sổ giao ca.');
      }
      setRecords(Array.isArray(data) ? data : data.records || []);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Danh mục máy từ database (giống ô Chọn Máy ở form nhập).
  useEffect(() => {
    let alive = true;
    fetch('/api/danh-sach-may')
      .then(async res => {
        if (!res.ok) throw new Error('bad');
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        const list = normalizeMachines(data).filter(
          m => !m.branch || m.branch === '-' || /phú thọ/i.test(m.branch)
        );
        setMachines(list.length > 0 ? list : normalizeMachines(data));
      })
      .catch(() => {
        if (alive) setMachines([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const machineOptions = useMemo(() => {
    return machines.map(m => ({
      value: m.code || m.id,
      label: machineSelectValue(m)
    }));
  }, [machines]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sổ giao ca này không?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/so-giao-ca-mmtb/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Không thể xóa bản ghi.');
      }
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (filterDate && r.ngay !== filterDate) return false;
      if (filterMachine && r.ma_may !== filterMachine) return false;
      if (filterShift && r.ca !== filterShift) return false;
      return true;
    });
  }, [records, filterDate, filterMachine, filterShift]);

  // Vào trang danh sách KHÔNG hiển thị gì — chỉ khi chọn ngày mới hiện sổ của ngày đó.
  const hasDateFilter = Boolean(filterDate);

  const handlePrintList = () => {
    if (!hasDateFilter || filteredRecords.length === 0) return;
    printSoGiaoCaMmtbList(filteredRecords, {
      ngay: filterDate,
      may: machineOptions.find(o => o.value === filterMachine)?.label || filterMachine,
      ca: filterShift
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/75 p-4 sm:p-6 pb-24">
      <div className="mx-auto max-w-7xl mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[14px] font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              DANH SÁCH SỔ GIAO CA MMTB
            </h1>
            <p className="text-[14px] text-slate-500">
              Tra cứu, xem trước, in và quản lý sổ giao ca máy móc thiết bị
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          <button
            type="button"
            onClick={handlePrintList}
            disabled={!hasDateFilter || filteredRecords.length === 0 || isLoading}
            title="In danh sách đang lọc khổ ngang A4"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            In danh sách
          </button>

          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[14px] font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Lập sổ giao ca mới
            </button>
          )}
        </div>
      </div>

      {/* Bộ lọc tra cứu */}
      <div className="mx-auto max-w-7xl bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[13px] font-semibold text-slate-600 mb-1">Lọc theo ngày:</label>
            <SoTronDatePicker value={filterDate} onChange={setFilterDate} placeholder="Tất cả ngày" />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-slate-600 mb-1">Mã / Tên máy:</label>
            <SearchableSelect
              options={machineOptions}
              getLabel={item => (item as { label: string }).label}
              getValue={item => (item as { value: string }).value}
              value={filterMachine}
              onChange={setFilterMachine}
              placeholder="-- Tất cả máy --"
              inputClassName="w-full text-[14px] border border-slate-300 rounded-lg px-2.5 py-1.5"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-slate-600 mb-1">Lọc theo ca:</label>
            <select
              value={filterShift}
              onChange={e => setFilterShift(e.target.value)}
              className="w-full text-[14px] border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500 bg-white"
            >
              <option value="">-- Tất cả ca --</option>
              <option value="Ca 1">Ca 1</option>
              <option value="Ca 2">Ca 2</option>
              <option value="Ca 3">Ca 3</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bảng danh sách */}
      <div className="mx-auto max-w-7xl bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-[14px]">Đang tải danh sách sổ giao ca...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-[14px]">{error}</div>
        ) : !hasDateFilter ? (
          <div className="p-12 text-center text-slate-400 text-[14px] flex flex-col items-center gap-2">
            <Calendar className="w-6 h-6 text-slate-300" />
            <span>Chọn ngày để xem danh sách sổ giao ca MMTB.</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-[14px]">
            Ngày {formatNgayVN(filterDate)} chưa có sổ giao ca nào phù hợp.
          </div>
        ) : (
          <div>
            <div className="px-3 py-2 border-b border-slate-200 text-[13px] font-semibold text-slate-600">
              Ngày {formatNgayVN(filterDate)}: {filteredRecords.length} sổ giao ca
            </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[14px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="px-3 py-2.5 w-12 text-center">STT</th>
                  <th className="px-3 py-2.5 w-24">Ngày</th>
                  <th className="px-3 py-2.5 w-20">Ca</th>
                  <th className="px-3 py-2.5 w-32">Máy</th>
                  <th className="px-3 py-2.5 w-28">Trưởng ca</th>
                  <th className="px-3 py-2.5 w-28 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-3 py-2.5 text-center text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{formatNgayVN(r.ngay) || '---'}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block px-2 py-0.5 rounded text-[13px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {r.ca}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{r.ten_may || r.ma_may}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r.truong_ca || '---'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewRecord(r)}
                          title="Xem & In"
                          className="p-1 rounded text-indigo-600 hover:bg-indigo-50 transition"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(r)}
                            title="Chỉnh sửa"
                            className="p-1 rounded text-amber-600 hover:bg-amber-50 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={deletingId === r.id}
                          onClick={() => handleDelete(r.id)}
                          title="Xóa"
                          className="p-1 rounded text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                        >
                          {deletingId === r.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>

      {/* MODAL XEM & IN TRỰC TIẾP TỪ DANH SÁCH */}
      {previewRecord && (
        <SoGiaoCaMmtbPreviewModal
          open={Boolean(previewRecord)}
          record={previewRecord}
          onClose={() => setPreviewRecord(null)}
          onSaved={updated => {
            setRecords(prev => prev.map(item => (item.id === updated.id ? updated : item)));
            setPreviewRecord(updated);
          }}
        />
      )}
    </div>
  );
}
