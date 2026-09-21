import { StaffSelect } from './StaffSelect';
import { SoTronDatePicker } from '../so-tron/SoTronDatePicker';
import { TimePicker24h } from '../../components/shared/TimePicker24h';
import { getTieuChuanContent } from './types';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, FileText, Loader2, Plus, Printer, Save, Trash2, X } from 'lucide-react';
import {
  type SoGiaoCaMmtbRecord,
  type DongCheDoChayRow,
  type DongSanPhamRow,
  COT_THAY_MANG,
  COT_KHU_KHUON
} from './types';
import { printSoGiaoCaMmtbSlip } from './print';

interface Props {
  open: boolean;
  record: SoGiaoCaMmtbRecord;
  onClose: () => void;
  onSaved?: (updated: SoGiaoCaMmtbRecord) => void;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function SoGiaoCaMmtbPreviewModal({ open, record, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<SoGiaoCaMmtbRecord>(() => JSON.parse(JSON.stringify(record)));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [overlayEl, setOverlayEl] = useState<HTMLDivElement | null>(null);

  if (!open) return null;

  const updateHeader = (patch: Partial<SoGiaoCaMmtbRecord>) => {
    setDraft(d => ({ ...d, ...patch }));
  };

  const updateDongTieuChuan = (patch: Partial<SoGiaoCaMmtbRecord['dong_tieu_chuan']>) => {
    setDraft(d => ({
      ...d,
      dong_tieu_chuan: {
        ...d.dong_tieu_chuan,
        ...patch
      }
    }));
  };

  const updateCheDoRow = (idx: number, patch: Partial<DongCheDoChayRow>) => {
    setDraft(d => {
      const next = [...d.bang_che_do_chay];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, bang_che_do_chay: next };
    });
  };

  const addCheDoRow = () => {
    setDraft(d => {
      const newRow: DongCheDoChayRow = {
        key: uid(),
        stt: d.bang_che_do_chay.length + 1,
        thoi_gian_kiem_tra: '',
        toc_do_bom: '',
        toc_do_lo: '',
        do_day: '',
        chieu_rong: '',
        chieu_dai: '',
        thay_mang_note: '',
        thay_mang: {},
        khu_khuon: {},
        lo_ep_quang: { tren: '', giua: '', duoi: '' },
        ghi_chu: ''
      };
      return { ...d, bang_che_do_chay: [...d.bang_che_do_chay, newRow] };
    });
  };

  const removeCheDoRow = (idx: number) => {
    setDraft(d => ({
      ...d,
      bang_che_do_chay: d.bang_che_do_chay.filter((_, i) => i !== idx)
    }));
  };

  const updateSpRow = (idx: number, patch: Partial<DongSanPhamRow>) => {
    setDraft(d => {
      const next = [...d.bang_san_pham];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, bang_san_pham: next };
    });
  };

  const addSpRow = () => {
    setDraft(d => {
      const newRow: DongSanPhamRow = {
        key: uid(),
        stt: d.bang_san_pham.length + 1,
        gio_kiem_tra: '',
        mau_sac: '',
        do_day: '',
        chieu_rong: '',
        chieu_dai: '',
        trong_luong: '',
        so_seri: '',
        ket_qua: 'Đạt'
      };
      return { ...d, bang_san_pham: [...d.bang_san_pham, newRow] };
    });
  };

  const removeSpRow = (idx: number) => {
    setDraft(d => ({
      ...d,
      bang_san_pham: d.bang_san_pham.filter((_, i) => i !== idx)
    }));
  };

  const handleSave = async (andPrint = false): Promise<boolean> => {
    setIsSaving(true);
    setErrorMessage('');
    setSaveSuccess(false);

    try {
      const isUpdate = Boolean(draft.id);
      const url = isUpdate
        ? `/api/so-giao-ca-mmtb/${encodeURIComponent(draft.id)}`
        : '/api/so-giao-ca-mmtb';
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || 'Không thể lưu sổ giao ca MMTB.');
      }

      const savedRecord = resData.record || draft;
      setDraft(savedRecord);
      setSaveSuccess(true);
      onSaved?.(savedRecord);

      if (andPrint) {
        setTimeout(() => {
          printSoGiaoCaMmtbSlip(savedRecord);
        }, 150);
      }

      return true;
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi lưu dữ liệu.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const cellInputClass =
    'w-full bg-transparent px-0.5 py-0.5 text-center text-[13px] text-slate-800 outline-none hover:bg-indigo-50/40 focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-400';
  const thClass = 'border border-slate-700 bg-slate-100 p-0.5 text-[13px] font-bold text-center';
  const tdClass = 'border border-slate-700 p-0 text-center text-[13px]';
  // Font giấy = đúng font phiếu in (Times New Roman đủ dấu tiếng Việt).
  // Không dùng font-serif mặc định (Georgia/Cambria thiếu dấu → dấu bị rời).
  const PAPER_FONT_FAMILY = '"Times New Roman", Times, serif';

  const tc = draft.dong_tieu_chuan;

  return createPortal(
    <div ref={setOverlayEl} className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-2 sm:p-4">
      {/* Top Navbar */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-2.5 text-white shadow-xl backdrop-blur">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Xem &amp; Sửa Sổ giao ca MMTB (Bảng theo dõi chế độ chạy máy &amp; chất lượng hàng ngày)
            </h3>
            <p className="text-[13px] text-slate-400">
              Máy: <b className="text-white">{draft.ten_may || draft.ma_may}</b> · Ca:{' '}
              <b className="text-white">{draft.ca}</b> · Ngày: <b className="text-white">{draft.ngay}</b>
            </p>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => printSoGiaoCaMmtbSlip(draft)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[14px] font-bold text-slate-200 hover:bg-slate-700 transition"
          >
            <Printer className="h-4 w-4" /> In phiếu
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave(false)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[14px] font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition shadow-sm"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[14px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow-sm"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Lưu &amp; In
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mx-auto mt-2 w-full max-w-[1280px] rounded-lg border border-rose-500 bg-rose-500/10 px-4 py-2 text-[14px] font-semibold text-rose-300">
          {errorMessage}
        </div>
      )}
      {saveSuccess && (
        <div className="mx-auto mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-500/10 px-4 py-2 text-[14px] font-semibold text-emerald-300">
          <Check className="h-4 w-4" /> Đã lưu thành công sổ giao ca MMTB.
        </div>
      )}

      {/* KHỔ GIẤY IN A4 LANDSCAPE (NGANG) */}
      <div className="mx-auto my-4 w-full max-w-[1280px] rounded-sm border border-slate-300 bg-white p-5 sm:p-7 text-slate-900 shadow-2xl overflow-x-auto" style={{ fontFamily: PAPER_FONT_FAMILY }}>
        <div className="min-w-[1350px]">
          
          {/* Tiêu đề chính */}
          <div className="text-center font-bold text-[14px] uppercase tracking-wide mb-2">
            BẢNG THEO DÕI CHẾ ĐỘ CHẠY MÁY &amp; CHẤT LƯỢNG HÀNG NGÀY
          </div>

          {/* Dòng metadata */}
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 pb-2 mb-2 text-[14px]">
            <div>
              NGÀY:{' '}
              <span className="inline-block min-w-[170px] align-middle">
                <SoTronDatePicker value={draft.ngay} onChange={v => updateHeader({ ngay: v })} placeholder="Chọn ngày" />
              </span>
            </div>
            <div>
              CA SX:{' '}
              <input
                value={draft.ca}
                onChange={e => updateHeader({ ca: e.target.value })}
                className="w-16 text-center font-bold border-b border-dotted border-slate-600 outline-none px-1"
                placeholder="Ca 1..."
              />
            </div>
            <div>
              MÁY:{' '}
              <input
                value={draft.ten_may || draft.ma_may}
                onChange={e => updateHeader({ ten_may: e.target.value })}
                className="w-28 text-center font-bold border-b border-dotted border-slate-600 outline-none px-1"
              />
            </div>
            <div>
              Trưởng ca:{' '}
              <StaffSelect kind="production" value={draft.truong_ca} onChange={value => updateHeader({ truong_ca: value })} dropdownParent={overlayEl} />
            </div>
          </div>

          {/* BẢNG 1: CHẾ ĐỘ CHẠY MÁY & ĐỒNG HỒ NHIỆT ĐỘ */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-bold uppercase text-slate-700">
                Chế độ chạy máy &amp; nhiệt độ
              </span>
              <button
                type="button"
                onClick={addCheDoRow}
                className="flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[13px] font-sans font-bold text-slate-700 hover:bg-slate-100"
              >
                <Plus className="h-3 w-3" /> Thêm lần kiểm tra
              </button>
            </div>

            <table className="w-full min-w-[1350px] border-collapse border border-slate-800 text-center">
              <thead>
                <tr>
                  <th rowSpan={2} className={`${thClass} w-[24px]`}>Stt</th>
                  <th rowSpan={2} className={`${thClass} w-[110px]`}>Thời gian kiểm tra (24h)</th>
                  <th rowSpan={2} className={`${thClass} w-[50px]`}>Tốc Độ Bơm Đ.Lượng</th>
                  <th rowSpan={2} className={`${thClass} w-[50px]`}>Tốc Độ Lô Ép Quang</th>
                  <th colSpan={3} className={`${thClass}`}>Kích Thước SP</th>
                  <th colSpan={9} className={`${thClass}`}>Đồng Hồ Báo Nhiệt Khu Vực Thay Màng</th>
                  <th colSpan={15} className={`${thClass}`}>Đồng Hồ Báo Nhiệt Khu Khuôn</th>
                  <th colSpan={3} className={`${thClass}`}>Đồng Hồ Báo Nhiệt Lô Ép Quang</th>
                  <th rowSpan={2} className={`${thClass} w-[50px]`}>Ghi chú</th>
                  <th rowSpan={2} className={`${thClass} w-[24px]`} />
                </tr>
                <tr>
                  <th className={`${thClass} w-[52px]`}>Độ Dày</th>
                  <th className={`${thClass} w-[60px]`}>Chiều Rộng</th>
                  <th className={`${thClass} w-[60px]`}>Chiều Dài</th>
                  {COT_THAY_MANG.map(c => (
                    <th key={c} className={`${thClass} w-[24px]`}>{c}</th>
                  ))}
                  {COT_KHU_KHUON.map(c => (
                    <th key={c} className={`${thClass} w-[24px]`}>{c}</th>
                  ))}
                  <th className={`${thClass} w-[26px]`}>Trên</th>
                  <th className={`${thClass} w-[26px]`}>Giữa</th>
                  <th className={`${thClass} w-[26px]`}>Dưới</th>
                </tr>

                {/* DÒNG TIÊU CHUẨN (DO NGƯỜI DÙNG NHẬP THEO CHỈ ĐẠO) */}
                <tr className="bg-amber-50/70 font-bold">
                  <td colSpan={2} className="border border-slate-700 p-0.5 text-left pl-1 font-bold text-[13px] text-amber-900">
                    Tiêu Chuẩn:
                  </td>
                  <td colSpan={32} className={tdClass}>
                    <textarea value={getTieuChuanContent(tc)} onChange={e => updateDongTieuChuan({ noi_dung: e.target.value })} aria-label="Tiêu chuẩn từ Bơm đến Lô ép quang (gồm kích thước SP)" rows={2} className={cellInputClass} />
                  </td>
                  <td className={tdClass}>
                    <input
                      value={tc.ghi_chu ?? ''}
                      onChange={e => updateDongTieuChuan({ ghi_chu: e.target.value })}
                      className={cellInputClass}
                      placeholder=""
                    />
                  </td>
                  <td className={tdClass} />
                </tr>
              </thead>
              <tbody>
                {draft.bang_che_do_chay.length === 0 && (
                  <tr>
                    <td colSpan={36} className="border border-slate-700 p-4 text-center text-slate-400 italic">
                      Chưa có dòng đo kiểm tra. Bấm "Thêm lần kiểm tra".
                    </td>
                  </tr>
                )}
                {draft.bang_che_do_chay.map((row, ri) => (
                  <tr key={row.key || ri} className="hover:bg-slate-50">
                    <td className={tdClass}>{ri + 1}</td>
                    <td className={tdClass}>
                      <div className="flex justify-center py-0.5">
                        <TimePicker24h
                          value={row.thoi_gian_kiem_tra}
                          onChange={v => updateCheDoRow(ri, { thoi_gian_kiem_tra: v })}
                          className="bg-transparent px-0.5 py-0.5 text-center text-[13px] text-slate-800 outline-none cursor-pointer rounded hover:bg-indigo-50/40 focus:bg-indigo-50"
                          aria-label="Thời gian kiểm tra (24h)"
                        />
                      </div>
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.toc_do_bom}
                        onChange={e => updateCheDoRow(ri, { toc_do_bom: e.target.value })}
                        className={cellInputClass}
                        placeholder="19"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.toc_do_lo}
                        onChange={e => updateCheDoRow(ri, { toc_do_lo: e.target.value })}
                        className={cellInputClass}
                        placeholder="0.760"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.do_day ?? ''}
                        onChange={e => updateCheDoRow(ri, { do_day: e.target.value })}
                        className={cellInputClass}
                        placeholder="--"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.chieu_rong ?? ''}
                        onChange={e => updateCheDoRow(ri, { chieu_rong: e.target.value })}
                        className={cellInputClass}
                        placeholder="--"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.chieu_dai ?? ''}
                        onChange={e => updateCheDoRow(ri, { chieu_dai: e.target.value })}
                        className={cellInputClass}
                        placeholder="--"
                      />
                    </td>
                    {/* Cột thay màng: có thể nhập quy cách như "3L x 2,1 x 30m" bao trùm hoặc từng cột */}
                    {row.thay_mang_note !== undefined && row.thay_mang_note !== '' ? (
                      <td colSpan={9} className={`${tdClass} px-1 text-center font-bold text-indigo-950`}>
                        <div className="flex items-center gap-1">
                          <input
                            value={row.thay_mang_note}
                            onChange={e => updateCheDoRow(ri, { thay_mang_note: e.target.value })}
                            className="w-full text-center font-bold text-[14px] bg-transparent outline-none"
                            placeholder="3L x 2,1 x 30m..."
                          />
                          <button
                            type="button"
                            onClick={() => updateCheDoRow(ri, { thay_mang_note: '' })}
                            className="text-[13px] text-slate-400 hover:text-slate-600 underline"
                            title="Chuyển sang 9 cột số"
                          >
                            Cột
                          </button>
                        </div>
                      </td>
                    ) : (
                      COT_THAY_MANG.map((c, ci) => (
                        <td key={c} className={tdClass}>
                          <input
                            value={row.thay_mang?.[c] ?? ''}
                            onChange={e =>
                              updateCheDoRow(ri, {
                                thay_mang: { ...row.thay_mang, [c]: e.target.value }
                              })
                            }
                            className={cellInputClass}
                          />
                          {ci === 0 && (
                            <button
                              type="button"
                              onClick={() => updateCheDoRow(ri, { thay_mang_note: '3L x 2,1 x 30m' })}
                              className="hidden hover:inline-block text-[13px] text-slate-300"
                              title="Gộp ghi quy cách"
                            >
                              Gộp
                            </button>
                          )}
                        </td>
                      ))
                    )}
                    {/* Khu khuôn 18..32 */}
                    {COT_KHU_KHUON.map(c => (
                      <td key={c} className={tdClass}>
                        <input
                          value={row.khu_khuon?.[c] ?? ''}
                          onChange={e =>
                            updateCheDoRow(ri, {
                              khu_khuon: { ...row.khu_khuon, [c]: e.target.value }
                            })
                          }
                          className={cellInputClass}
                        />
                      </td>
                    ))}
                    {/* Lô ép quang */}
                    <td className={tdClass}>
                      <input
                        value={row.lo_ep_quang?.tren ?? ''}
                        onChange={e =>
                          updateCheDoRow(ri, {
                            lo_ep_quang: { ...row.lo_ep_quang, tren: e.target.value }
                          })
                        }
                        className={cellInputClass}
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.lo_ep_quang?.giua ?? ''}
                        onChange={e =>
                          updateCheDoRow(ri, {
                            lo_ep_quang: { ...row.lo_ep_quang, giua: e.target.value }
                          })
                        }
                        className={cellInputClass}
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.lo_ep_quang?.duoi ?? ''}
                        onChange={e =>
                          updateCheDoRow(ri, {
                            lo_ep_quang: { ...row.lo_ep_quang, duoi: e.target.value }
                          })
                        }
                        className={cellInputClass}
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.ghi_chu ?? ''}
                        onChange={e => updateCheDoRow(ri, { ghi_chu: e.target.value })}
                        className={cellInputClass}
                      />
                    </td>
                    <td className="border border-slate-700 p-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeCheDoRow(ri)}
                        className="text-slate-400 hover:text-rose-600"
                        title="Xóa dòng"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* BẢNG 2: SẢN PHẨM */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-bold uppercase text-slate-700">
                SẢN PHẨM (Kiểm tra chất lượng)
              </span>
              <button
                type="button"
                onClick={addSpRow}
                className="flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[13px] font-sans font-bold text-slate-700 hover:bg-slate-100"
              >
                <Plus className="h-3 w-3" /> Thêm SP kiểm tra
              </button>
            </div>

            <table className="w-full border-collapse border border-slate-800 text-center">
              <thead>
                <tr>
                  <th rowSpan={2} className={`${thClass} w-[30px]`}>Stt</th>
                  <th rowSpan={2} className={`${thClass} w-[110px]`}>Giờ Kiểm Tra (24h)</th>
                  <th colSpan={7} className={`${thClass}`}>Tiêu Chuẩn SP</th>
                  <th rowSpan={2} className={`${thClass} w-[28px]`} />
                </tr>
                <tr>
                  <th className={`${thClass} w-[100px]`}>Màu Sắc</th>
                  <th className={`${thClass} w-[100px]`}>Độ Dày</th>
                  <th className={`${thClass} w-[110px]`}>Chiều Rộng</th>
                  <th className={`${thClass} w-[110px]`}>Chiều Dài</th>
                  <th className={`${thClass} w-[110px]`}>Trọng Lượng</th>
                  <th className={`${thClass} w-[90px]`}>Số seri</th>
                  <th className={`${thClass} w-[80px]`}>Kết Quả</th>
                </tr>
              </thead>
              <tbody>
                {draft.bang_san_pham.length === 0 && (
                  <tr>
                    <td colSpan={10} className="border border-slate-700 p-3 text-center text-slate-400 italic">
                      Chưa có dòng sản phẩm. Bấm "Thêm SP kiểm tra".
                    </td>
                  </tr>
                )}
                {draft.bang_san_pham.map((row, ri) => (
                  <tr key={row.key || ri} className="hover:bg-slate-50">
                    <td className={tdClass}>{ri + 1}</td>
                    <td className={tdClass}>
                      <div className="flex justify-center py-0.5">
                        <TimePicker24h
                          value={row.gio_kiem_tra}
                          onChange={v => updateSpRow(ri, { gio_kiem_tra: v })}
                          className="bg-transparent px-0.5 py-0.5 text-center text-[13px] text-slate-800 outline-none cursor-pointer rounded hover:bg-indigo-50/40 focus:bg-indigo-50"
                          aria-label="Giờ kiểm tra (24h)"
                        />
                      </div>
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.mau_sac}
                        onChange={e => updateSpRow(ri, { mau_sac: e.target.value })}
                        className={cellInputClass}
                        placeholder="06..."
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.do_day}
                        onChange={e => updateSpRow(ri, { do_day: e.target.value })}
                        className={cellInputClass}
                        placeholder="3L..."
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.chieu_rong}
                        onChange={e => updateSpRow(ri, { chieu_rong: e.target.value })}
                        className={cellInputClass}
                        placeholder="2,1m..."
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.chieu_dai}
                        onChange={e => updateSpRow(ri, { chieu_dai: e.target.value })}
                        className={cellInputClass}
                        placeholder="30m..."
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.trong_luong}
                        onChange={e => updateSpRow(ri, { trong_luong: e.target.value })}
                        className={`${cellInputClass} font-bold text-indigo-900`}
                        placeholder="211 kg..."
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.so_seri}
                        onChange={e => updateSpRow(ri, { so_seri: e.target.value })}
                        className={cellInputClass}
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        value={row.ket_qua}
                        onChange={e => updateSpRow(ri, { ket_qua: e.target.value })}
                        className={`${cellInputClass} font-bold text-emerald-700`}
                        placeholder="Đạt"
                      />
                    </td>
                    <td className="border border-slate-700 p-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeSpRow(ri)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FOOTER: Tiêu chuẩn kiểm tra & Chữ ký */}
          <div className="grid grid-cols-12 gap-4 border-t border-slate-300 pt-3">
            <div className="col-span-6 text-[14px] leading-relaxed">
              <span className="font-bold">Tiêu Chuẩn Kiểm Tra Sản Phẩm (cho phép sửa):</span>
              <textarea
                rows={4}
                value={draft.ghi_chu_tieu_chuan_sp}
                onChange={e => updateHeader({ ghi_chu_tieu_chuan_sp: e.target.value })}
                className="w-full mt-1 border border-slate-400 p-1.5 text-[14px] rounded bg-slate-50/50 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                placeholder="1: Màu sắc...&#10;2: Độ dày...&#10;3: Chiều rộng...&#10;4: Chiều dài...&#10;5: Trọng lượng..."
              />
            </div>

            <div className="col-span-6 flex justify-around gap-3 text-center text-[14px]">
              <div className="w-full max-w-[250px] min-w-0">
                <div className="font-bold">Trưởng ca</div>
                <div className="h-10" />
                <StaffSelect kind="production" value={draft.truong_ca} onChange={value => updateHeader({ truong_ca: value })} dropdownParent={overlayEl} />
              </div>

              <div className="w-full max-w-[250px] min-w-0">
                <div className="font-bold">Người kiểm tra</div>
                <div className="h-10" />
                <StaffSelect kind="inspector" value={draft.nguoi_kiem_tra} onChange={value => updateHeader({ nguoi_kiem_tra: value })} dropdownParent={overlayEl} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
export default SoGiaoCaMmtbPreviewModal;
