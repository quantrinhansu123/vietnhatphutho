import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus, Printer, Save, Trash2, X, Check, FileText } from 'lucide-react';
import { vietNhatLogoUrl } from '../../components/layout/constants';
import {
  type PhieuGiaoCaHeader,
  type PhieuGiaoCaVatTuRow,
  type PhieuGiaoCaThanhPhamRow,
  type PhieuGiaoCaHangLoiRow,
  type PhieuGiaoCaInput,
  formatSlipNumber,
  parseSlipNumber,
  printPhieuGiaoCaSlip
} from './printPhieuGiaoCa';
import type { SoTronSavedReport } from './index';
import {
  auxiliaryNormWeightIndex,
  formatNormWeight,
  lookupAuxiliaryNormWeight
} from './dinhMucVatTu';

interface Props {
  open: boolean;
  report: SoTronSavedReport | null;
  onClose: () => void;
  onSaved?: (updated: SoTronSavedReport) => void;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function num(val: unknown): number {
  return parseSlipNumber(val);
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function fmt(val: number): string {
  if (!Number.isFinite(val) || val === 0) return '';
  return formatSlipNumber(val);
}

function round1(val: number): number {
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

const SU_CO_MAU = [
  { ten: 'Đổi màu', gio: 0.5 },
  { ten: 'Đổi khổ', gio: 1 }
] as const;

type SuCoRow = { key: string; ten: string; lan: string };

function gioSuCo(ten: string, lan: string): string {
  const hit = SU_CO_MAU.find(item => item.ten === ten);
  const times = num(lan);
  if (!hit || !(times > 0)) return '';
  const hours = round1(hit.gio * times);
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
}

function composeSuCo(rows: SuCoRow[], note: string): string {
  const lines = rows
    .filter(row => row.ten && num(row.lan) > 0)
    .map(row => `${row.ten} — ${String(row.lan).trim()} lần — ${gioSuCo(row.ten, row.lan)} giờ`);
  return [...lines, note.trim()].filter(Boolean).join('\n');
}

function parseSuCo(text: string): { rows: SuCoRow[]; note: string } {
  const rows: SuCoRow[] = [];
  const notes: string[] = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^(.+?)\s+—\s+(\d+(?:[.,]\d+)?)\s+lần\s+—\s+.+$/);
    const ten = match?.[1]?.trim() || '';
    if (match && SU_CO_MAU.some(item => item.ten === ten)) {
      rows.push({ key: uid(), ten, lan: match[2] });
    } else if (line.trim()) {
      notes.push(line);
    }
  }
  return { rows, note: notes.join('\n') };
}

export function PhieuGiaoCaModal({ open, report, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<'all' | 'p1' | 'p2'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Draft state
  const [header, setHeader] = useState<PhieuGiaoCaHeader>({
    tieuDeMay: '',
    kyHieu: 'BM02',
    lanBanHanh: '02',
    ngayHieuLuc: '14/4/2022',
    gioTu: '6',
    gioDen: '18',
    ngay: '',
    soPhieu: '',
    nguoiThucHien: '',
    tenMay: ''
  });

  const [vatTuRows, setVatTuRows] = useState<PhieuGiaoCaVatTuRow[]>([]);
  const [giaoCaNote, setGiaoCaNote] = useState('');
  const [thanhPhamRows, setThanhPhamRows] = useState<PhieuGiaoCaThanhPhamRow[]>([]);
  const [hangLoiRows, setHangLoiRows] = useState<PhieuGiaoCaHangLoiRow[]>([]);
  const [suCoLuuY, setSuCoLuuY] = useState('');
  const [suCoRows, setSuCoRows] = useState<SuCoRow[]>([]);
  const [chuKy, setChuKy] = useState({
    thuKhoVatTu: '',
    truongCa: '',
    thuKhoThanhPham: '',
    keHoachSanXuat: ''
  });

  // Khởi tạo dữ liệu khi mở report
  useEffect(() => {
    if (!report || !open) return;

    const tenMay = report.ten_may || report.ma_may || 'SÓNG 2';
    const isShift2 = report.ca.includes('2') || report.ca.toLowerCase().includes('đêm') || report.ca.includes('18');

    setHeader({
      tieuDeMay: tenMay.toUpperCase(),
      kyHieu: 'BM02',
      lanBanHanh: '02',
      ngayHieuLuc: '14/4/2022',
      gioTu: isShift2 ? '18' : '6',
      gioDen: isShift2 ? '6' : '18',
      ngay: report.ngay || new Date().toISOString().slice(0, 10),
      soPhieu: report.ca ? (report.ca.match(/\d+/) ? report.ca.match(/\d+/)![0] : '01') : '01',
      nguoiThucHien: report.nhan_su || '',
      tenMay: tenMay
    });

    // Bảng vật tư: ghép từ bang_nvl và bang_ban_giao
    const banGiaoMap = new Map<string, (typeof report.bang_ban_giao)[0]>();
    (report.bang_ban_giao || []).forEach(bg => {
      const key = str(bg.material_id) || str(bg.ma_nvl);
      if (key) banGiaoMap.set(key, bg);
      if (bg.ma_nvl) banGiaoMap.set(bg.ma_nvl, bg);
    });

    // Định mức vật tư được điền sau từ tổng trọng lượng NVL phụ của phiếu trộn định mức.
    // Tạm giữ giá trị đã lưu để vẫn hiện nếu chưa tải được phiếu định mức.
    const combinedVatTu: PhieuGiaoCaVatTuRow[] = (report.bang_nvl || []).map(nvl => {
      const bg = banGiaoMap.get(nvl.material_id) || banGiaoMap.get(nvl.ma_nvl);
      const dmRaw = str((nvl as { dinh_muc?: unknown }).dinh_muc);
      const dm = dmRaw ? formatSlipNumber(dmRaw) : '';

      const lanArr = Array.from({ length: 10 }, (_, i) => {
        const val = nvl.lan?.[i];
        return val !== undefined && val !== null && num(val) !== 0 ? formatSlipNumber(val) : '';
      });

      const tonDau = bg?.ton_dau_ca !== undefined && num(bg.ton_dau_ca) !== 0 ? formatSlipNumber(bg.ton_dau_ca) : '';
      const layKho = bg?.lay_trong_kho !== undefined && num(bg.lay_trong_kho) !== 0 ? formatSlipNumber(bg.lay_trong_kho) : '';
      const tongSd = round2(lanArr.reduce((s, v) => s + num(v), 0));
      const tonCuoi = round1(num(tonDau) + num(layKho) - tongSd);

      return {
        key: uid(),
        material_id: nvl.material_id || '',
        ma_nvl: nvl.ma_nvl || '',
        ten_nvl: nvl.ten_nvl || '',
        ten_nvl_sx: nvl.ten_nvl_sx || '',
        dvt: nvl.dvt || 'Kg',
        dinh_muc: dm,
        ton_dau_ca: tonDau,
        lay_trong_kho: layKho,
        lan: lanArr,
        tong_su_dung: tongSd,
        ton_cuoi_ca: tonCuoi
      };
    });

    // Thêm các vật tư chỉ có trong bang_ban_giao mà chưa có trong bang_nvl
    (report.bang_ban_giao || []).forEach(bg => {
      const exists = combinedVatTu.some(
        v =>
          (v.material_id && bg.material_id && v.material_id === bg.material_id) ||
          (v.ma_nvl && bg.ma_nvl && v.ma_nvl === bg.ma_nvl)
      );
      if (!exists && (bg.ma_nvl || bg.ten_nvl)) {
        const tonDau = bg.ton_dau_ca ? String(bg.ton_dau_ca) : '';
        const layKho = bg.lay_trong_kho ? String(bg.lay_trong_kho) : '';
        const tongSd = bg.tong_su_dung || 0;
        const tonCuoi = round1(num(tonDau) + num(layKho) - tongSd);
        combinedVatTu.push({
          key: uid(),
          material_id: bg.material_id || '',
          ma_nvl: bg.ma_nvl || '',
          ten_nvl: bg.ten_nvl || '',
          ten_nvl_sx: bg.ten_nvl_sx || '',
          dvt: 'Kg',
          dinh_muc: '',
          ton_dau_ca: tonDau,
          lay_trong_kho: layKho,
          lan: Array(10).fill(''),
          tong_su_dung: tongSd,
          ton_cuoi_ca: tonCuoi
        });
      }
    });

    setVatTuRows(combinedVatTu);

    // Thành phẩm
    const tpList: PhieuGiaoCaThanhPhamRow[] = (report.bang_san_pham || []).map(sp => {
      const sl = str(sp.so_luong);
      const dm = str(sp.dinh_muc) || str((sp as { kg_1_sp?: unknown }).kg_1_sp);
      let tl = str(sp.trong_luong);
      if (!tl && sl && dm) {
        tl = fmt(round2(num(sl) * num(dm)));
      }
      return {
        key: uid(),
        ma_sp: sp.ma_sp || '',
        ten_sp: sp.ten_sp || '',
        dinh_muc: dm,
        lan_1: '',
        lan_2: '',
        lan_3: '',
        so_luong: sl,
        trong_luong: tl,
        ghi_chu: sp.ghi_chu || ''
      };
    });
    setThanhPhamRows(tpList);

    // Hàng lỗi
    const hlList: PhieuGiaoCaHangLoiRow[] = (report.bang_hang_loi || []).map(hl => ({
      key: uid(),
      ten_loi: hl.ten_loi || '',
      dvt: 'Kg',
      so_luong: str(hl.so_luong)
    }));
    setHangLoiRows(hlList);

    // Ghi chú / sự cố
    const parsedSuCo = parseSuCo(report.ghi_chu || '');
    setSuCoRows(parsedSuCo.rows);
    setSuCoLuuY(parsedSuCo.note);
    setGiaoCaNote('');
    setSaveSuccess(false);
    setErrorMessage('');
  }, [report, open]);

  // Định mức vật tư = Tổng trọng lượng (kg) từng NVL trên phiếu trộn định mức của lệnh SX.
  useEffect(() => {
    if (!open || !report) return;
    const codes = (report.lenh_sx || []).map(item => str(item.ma_lenh)).filter(Boolean);
    if (codes.length === 0) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/bang-tron-vat-tu-dinh-muc?ma_lenh_sx=${encodeURIComponent(codes.join(','))}&limit=200`
        );
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok) return;
        const records = Array.isArray(data?.records) ? data.records : [];
        const index = auxiliaryNormWeightIndex(records);
        const phuKeys = new Set(
          index.lines
            .filter(item => item.source === 'phu')
            .flatMap(item => [item.materialId, item.code].map(value => str(value).toLowerCase()).filter(Boolean))
        );
        const isPhuRow = (materialId: string, ma: string) => {
          const id = str(materialId).toLowerCase();
          const code = str(ma).toLowerCase();
          return (id && phuKeys.has(id)) || (code && phuKeys.has(code));
        };
        setVatTuRows(prev =>
          prev
            .filter(row => !isPhuRow(row.material_id || '', row.ma_nvl))
            .map(row => {
              const formatted = formatNormWeight(
                lookupAuxiliaryNormWeight(index, row.material_id, row.ma_nvl)
              );
              if (!formatted) return row;
              return { ...row, dinh_muc: formatted };
            })
        );
      } catch {
        /* giữ định mức đã lưu */
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, report]);

  // Handler cập nhật bảng vật tư
  const updateVatTuRow = (index: number, patch: Partial<PhieuGiaoCaVatTuRow>) => {
    setVatTuRows(prev =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, ...patch };

        // Recalculate tong_su_dung và ton_cuoi_ca
        const tongSd = round2(updated.lan.reduce((sum, v) => sum + num(v), 0));
        const tonCuoi = round1(num(updated.ton_dau_ca) + num(updated.lay_trong_kho) - tongSd);
        return {
          ...updated,
          tong_su_dung: tongSd,
          ton_cuoi_ca: tonCuoi
        };
      })
    );
  };

  const updateVatTuLan = (rowIndex: number, lanIndex: number, val: string) => {
    setVatTuRows(prev =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;
        const nextLan = [...row.lan];
        nextLan[lanIndex] = val;
        const tongSd = round2(nextLan.reduce((sum, v) => sum + num(v), 0));
        const tonCuoi = round1(num(row.ton_dau_ca) + num(row.lay_trong_kho) - tongSd);
        return {
          ...row,
          lan: nextLan,
          tong_su_dung: tongSd,
          ton_cuoi_ca: tonCuoi
        };
      })
    );
  };

  const addVatTuRow = () => {
    setVatTuRows(prev => [
      ...prev,
      {
        key: uid(),
        material_id: '',
        ma_nvl: '',
        ten_nvl: '',
        ten_nvl_sx: '',
        dvt: 'Kg',
        dinh_muc: '',
        ton_dau_ca: '',
        lay_trong_kho: '',
        lan: Array(10).fill(''),
        tong_su_dung: 0,
        ton_cuoi_ca: 0
      }
    ]);
  };

  const removeVatTuRow = (index: number) => {
    setVatTuRows(prev => prev.filter((_, i) => i !== index));
  };

  // Thành phẩm chỉ xem trên phiếu giao ca — sửa tại sổ trộn.

  // Handler hàng lỗi
  const updateHangLoiRow = (index: number, patch: Partial<PhieuGiaoCaHangLoiRow>) => {
    setHangLoiRows(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addHangLoiRow = () => {
    setHangLoiRows(prev => [
      ...prev,
      {
        key: uid(),
        ten_loi: '',
        dvt: 'Kg',
        so_luong: ''
      }
    ]);
  };

  const removeHangLoiRow = (index: number) => {
    setHangLoiRows(prev => prev.filter((_, i) => i !== index));
  };

  // Tính tổng sử dụng vật tư
  const tongCongSuDungVatTu = useMemo(() => {
    return round2(vatTuRows.reduce((sum, r) => sum + r.tong_su_dung, 0));
  }, [vatTuRows]);

  // Tính tổng thành phẩm
  const tongNhapKhoThanhPham = useMemo(() => {
    return round2(thanhPhamRows.reduce((sum, r) => sum + num(r.so_luong), 0));
  }, [thanhPhamRows]);

  const tongTrongLuongThanhPham = useMemo(() => {
    return round2(thanhPhamRows.reduce((sum, r) => sum + num(r.trong_luong), 0));
  }, [thanhPhamRows]);

  // Tính tổng hàng lỗi
  const tongHangLoi = useMemo(() => {
    return round2(hangLoiRows.reduce((sum, r) => sum + num(r.so_luong), 0));
  }, [hangLoiRows]);

  // Đối tượng in
  const currentPrintInput: PhieuGiaoCaInput = useMemo(
    () => ({
      header,
      vatTu: vatTuRows,
      giaoCaNote,
      thanhPham: thanhPhamRows,
      hangLoi: hangLoiRows,
      suCoLuuY: composeSuCo(suCoRows, suCoLuuY),
      chuKy
    }),
    [header, vatTuRows, giaoCaNote, thanhPhamRows, hangLoiRows, suCoLuuY, suCoRows, chuKy]
  );

  // Lưu dữ liệu vào CSDL
  const handleSave = async (andPrint = false): Promise<boolean> => {
    if (!report) return false;
    setIsSaving(true);
    setErrorMessage('');
    setSaveSuccess(false);

    try {
      // Map ngược lại bang_nvl và bang_ban_giao — giữ material_id / lenh_sx gốc khi khớp.
      const origNvlByKey = new Map<string, (typeof report.bang_nvl)[0]>();
      for (const nvl of report.bang_nvl || []) {
        const k = str(nvl.material_id) || str(nvl.ma_nvl);
        if (k) origNvlByKey.set(k.toLowerCase(), nvl);
        if (nvl.ma_nvl) origNvlByKey.set(str(nvl.ma_nvl).toLowerCase(), nvl);
      }

      const nextBangNvl = vatTuRows.map(r => {
        const key = (str(r.material_id) || str(r.ma_nvl)).toLowerCase();
        const orig = key ? origNvlByKey.get(key) : undefined;
        return {
          material_id: r.material_id || orig?.material_id || '',
          ma_nvl: r.ma_nvl,
          ten_nvl: r.ten_nvl,
          ten_nvl_sx: r.ten_nvl_sx || '',
          dvt: r.dvt,
          dinh_muc: str(r.dinh_muc),
          lan: r.lan.map(v => num(v)),
          tong: r.tong_su_dung,
          lenh_sx: Array.isArray(orig?.lenh_sx) ? orig!.lenh_sx : ([] as string[])
        };
      });

      const nextBangBanGiao = vatTuRows
        .filter(r => str(r.ma_nvl) || str(r.ten_nvl))
        .map(r => ({
          material_id: r.material_id || '',
          ma_nvl: r.ma_nvl,
          ten_nvl: r.ten_nvl,
          ten_nvl_sx: r.ten_nvl_sx || '',
          lay_trong_kho: num(r.lay_trong_kho),
          ton_dau_ca: num(r.ton_dau_ca),
          tong_su_dung: r.tong_su_dung,
          ton_cuoi_ca: r.ton_cuoi_ca
        }));

      // Thành phẩm: chỉ đọc từ sổ trộn — không ghi đè khi lưu phiếu giao ca.
      // Giữ nguyên snapshot quy đổi 1 SP (kg/m2/m dài) đã lưu trong sổ trộn.
      const nextBangSanPham = (report.bang_san_pham || []).map(sp => {
        const conv = sp as {
          san_pham_id?: unknown;
          kg_1_sp?: unknown;
          m2_1_sp?: unknown;
          m_dai_1_sp?: unknown;
          nguon_quy_doi?: unknown;
        };
        const numOrUndefined = (value: unknown) => {
          const parsed = Number(String(value ?? '').trim().replace(',', '.'));
          return Number.isFinite(parsed) && parsed > 0
            ? Math.round((parsed + Number.EPSILON) * 100) / 100
            : undefined;
        };
        const kg = numOrUndefined(conv.kg_1_sp);
        const m2 = numOrUndefined(conv.m2_1_sp);
        const mDai = numOrUndefined(conv.m_dai_1_sp);
        return {
          ma_lenh_sx: sp.ma_lenh_sx || '',
          ...(str(conv.san_pham_id) ? { san_pham_id: str(conv.san_pham_id) } : {}),
          ma_sp: sp.ma_sp || '',
          ten_sp: sp.ten_sp || '',
          mang: (sp as { mang?: string }).mang || '',
          so_luong: str(sp.so_luong),
          dinh_muc: str(sp.dinh_muc),
          trong_luong: str(sp.trong_luong),
          ...(kg !== undefined ? { kg_1_sp: kg } : {}),
          ...(m2 !== undefined ? { m2_1_sp: m2 } : {}),
          ...(mDai !== undefined ? { m_dai_1_sp: mDai } : {}),
          ...(str(conv.nguon_quy_doi) && (kg !== undefined || m2 !== undefined || mDai !== undefined)
            ? { nguon_quy_doi: str(conv.nguon_quy_doi) }
            : {}),
          ghi_chu: sp.ghi_chu || ''
        };
      });

      const nextBangHangLoi = hangLoiRows.map(r => ({
        ten_loi: r.ten_loi,
        so_luong: str(r.so_luong)
      }));

      const payload = {
        chi_nhanh: report.chi_nhanh || 'Phú Thọ',
        ngay: header.ngay || report.ngay,
        ma_may: report.ma_may,
        ten_may: header.tenMay || report.ten_may,
        ca: report.ca,
        nhan_su: header.nguoiThucHien || report.nhan_su,
        nhan_su_chi_tiet: report.nhan_su_chi_tiet || [],
        lenh_sx: report.lenh_sx || [],
        coi_tron_mau: report.coi_tron_mau || [],
        bang_nvl: nextBangNvl,
        bang_san_pham: nextBangSanPham,
        bang_hang_loi: nextBangHangLoi,
        bang_ban_giao: nextBangBanGiao,
        tong_nvl: Math.round((nextBangBanGiao.reduce((s, l) => s + (Number(l.tong_su_dung) || 0), 0) + Number.EPSILON) * 100) / 100,
        tong_nhap_nvl: Math.round((nextBangBanGiao.reduce((s, l) => s + (Number(l.lay_trong_kho) || 0), 0) + Number.EPSILON) * 100) / 100,
        tong_sp_co_mang: Number((report as unknown as Record<string, unknown>).tong_sp_co_mang) || 0,
        tong_sp_khong_mang: Number((report as unknown as Record<string, unknown>).tong_sp_khong_mang) || 0,
        tong_loi_hong: Number((report as unknown as Record<string, unknown>).tong_loi_hong) || 0,
        chi_tieu_phan_tram: Number((report as unknown as Record<string, unknown>).chi_tieu_phan_tram) || 0,
        ghi_chu: composeSuCo(suCoRows, suCoLuuY)
      };

      const res = await fetch(`/api/so-tron/${encodeURIComponent(report.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || 'Không thể lưu phiếu giao ca.');
      }

      setSaveSuccess(true);
      if (onSaved && resData.report) {
        onSaved(resData.report);
      }

      if (andPrint) {
        setTimeout(() => {
          printPhieuGiaoCaSlip(currentPrintInput);
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

  if (!open || !report) return null;

  const inputStyle =
    'box-border h-8 w-full bg-transparent border-0 px-1 py-0 text-[16px] leading-8 text-black outline-none focus:bg-indigo-50/50';
  const numInputStyle =
    'box-border h-8 w-full max-w-full bg-transparent px-0.5 py-0 text-right text-[16px] font-semibold leading-8 text-black tabular-nums outline-none';
  const centerInputStyle = `${inputStyle} text-center`;
  const readOnlyCell =
    'block h-8 w-full max-w-full truncate px-1 py-0 text-[16px] leading-8 text-black';
  const numReadStyle =
    'px-0.5 text-right text-[16px] font-semibold leading-8 text-black tabular-nums';
  const slipTableClass =
    'w-full table-fixed border-collapse border border-slate-800 text-center text-[16px] leading-none text-black [&_tbody_tr]:h-9 [&_tbody_td]:h-9 [&_tbody_td]:box-border [&_tbody_td]:overflow-hidden [&_tbody_td]:text-ellipsis [&_tbody_td]:whitespace-nowrap [&_tbody_td]:p-0 [&_tbody_td]:align-middle [&_th]:box-border [&_th]:px-1 [&_th]:py-1 [&_th]:align-middle [&_th]:text-[16px] [&_th]:leading-tight [&_th]:text-black';
  const paperFontStyle = { fontFamily: '"Times New Roman", Times, serif' } as const;

  const dateParts = (() => {
    const m = String(header.ngay || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? { d: m[3], m: m[2], y: m[1] } : { d: '', m: '', y: '' };
  })();

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-2 sm:p-4">
      {/* Top Navbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-2.5 text-white shadow-xl backdrop-blur">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-100">Xem &amp; Sửa Phiếu giao ca (Nhật ký sản xuất)</h3>
            <p className="text-[11px] text-slate-400">
              Máy: <b className="text-white">{header.tenMay || report.ten_may}</b> · Ca:{' '}
              <b className="text-white">{report.ca}</b> · Ngày: <b className="text-white">{header.ngay}</b>
            </p>
          </div>
        </div>

        {/* Chuyển trang xem */}
        <div className="flex items-center rounded-lg bg-slate-800 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`rounded-md px-3 py-1 transition ${activeTab === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
          >
            Cả 2 trang
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('p1')}
            className={`rounded-md px-3 py-1 transition ${activeTab === 'p1' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
          >
            Trang 1 (Vật tư)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('p2')}
            className={`rounded-md px-3 py-1 transition ${activeTab === 'p2' ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
          >
            Trang 2 (Thành phẩm)
          </button>
        </div>

        {/* Nút thao tác */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => printPhieuGiaoCaSlip(currentPrintInput)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
          >
            <Printer className="h-4 w-4" /> In phiếu
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave(false)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition shadow-sm"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow-sm"
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

      {/* Thông báo lỗi / thành công */}
      {errorMessage && (
        <div className="mx-auto mt-2 w-full max-w-[1180px] rounded-lg border border-rose-500 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300">
          {errorMessage}
        </div>
      )}
      {saveSuccess && (
        <div className="mx-auto mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300">
          <Check className="h-4 w-4" /> Đã lưu thành công dữ liệu phiếu giao ca.
        </div>
      )}

      {/* VÙNG HIỂN THỊ CÁC TỜ PHIẾU GIẤY (CHUẨN FORM ẢNH 1 & 2) */}
      <div className="mx-auto my-4 flex w-full max-w-[1680px] flex-col gap-6">
        
        {/* ===================== TRANG 1: ẢNH 1 (I. VẬT TƯ) ===================== */}
        {(activeTab === 'all' || activeTab === 'p1') && (
          <div className="relative rounded-sm border border-slate-300 bg-white p-5 text-slate-900 shadow-2xl sm:p-6" style={paperFontStyle}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              Trang 1 / 2 — Nhật ký vật tư &amp; sử dụng (Ảnh 1)
            </div>

            {/* Header Trang 1 */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-900 pb-3">
              <div className="w-[25%]">
                {vietNhatLogoUrl ? (
                  <img src={vietNhatLogoUrl} alt="Logo" className="max-h-12 max-w-[140px] object-contain" />
                ) : (
                  <span className="font-bold">VIỆT NHẬT IPT</span>
                )}
              </div>

              <div className="flex-1 text-center">
                <input
                  type="text"
                  value={header.tieuDeMay}
                  onChange={e => setHeader(h => ({ ...h, tieuDeMay: e.target.value }))}
                  className="w-full text-center text-sm sm:text-base font-black tracking-wider uppercase outline-none focus:bg-indigo-50/50"
                  placeholder="SÓNG 2"
                />
                <div className="text-xs sm:text-sm font-bold tracking-tight">NHẬT KÝ SẢN XUẤT KIÊM PHIẾU GIAO CA</div>
              </div>

              <div className="w-[25%] flex justify-end">
                <div className="border border-slate-800 p-1.5 text-[9px] leading-tight">
                  <div>
                    Ký hiệu:{' '}
                    <input
                      value={header.kyHieu}
                      onChange={e => setHeader(h => ({ ...h, kyHieu: e.target.value }))}
                      className="w-14 border-b border-slate-400 text-center font-bold outline-none"
                    />
                  </div>
                  <div>
                    Lần ban hành:{' '}
                    <input
                      value={header.lanBanHanh}
                      onChange={e => setHeader(h => ({ ...h, lanBanHanh: e.target.value }))}
                      className="w-8 border-b border-slate-400 text-center font-bold outline-none"
                    />
                  </div>
                  <div>
                    Ngày hiệu lực:{' '}
                    <input
                      value={header.ngayHieuLuc}
                      onChange={e => setHeader(h => ({ ...h, ngayHieuLuc: e.target.value }))}
                      className="w-16 border-b border-slate-400 text-center font-bold outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Meta bar */}
            <div className="mt-2.5 space-y-1 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-1">
                  <span>Ca sản xuất từ:</span>
                  <input
                    value={header.gioTu}
                    onChange={e => setHeader(h => ({ ...h, gioTu: e.target.value }))}
                    className="w-10 border-b border-dotted border-slate-600 text-center font-bold outline-none"
                  />
                  <span>H Đến</span>
                  <input
                    value={header.gioDen}
                    onChange={e => setHeader(h => ({ ...h, gioDen: e.target.value }))}
                    className="w-10 border-b border-dotted border-slate-600 text-center font-bold outline-none"
                  />
                  <span>H ngày</span>
                  <span className="font-bold underline px-1">{dateParts.d}</span>
                  <span>Tháng</span>
                  <span className="font-bold underline px-1">{dateParts.m}</span>
                  <span>Năm</span>
                  <span className="font-bold underline px-1">{dateParts.y}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span>Số phiếu:</span>
                  <input
                    value={header.soPhieu}
                    onChange={e => setHeader(h => ({ ...h, soPhieu: e.target.value }))}
                    className="w-20 border-b border-dotted border-slate-600 text-center font-bold outline-none"
                    placeholder="01"
                  />
                  <span>/ {dateParts.y}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex flex-1 items-baseline gap-1 mr-4">
                  <span>Người thực hiện:</span>
                  <input
                    value={header.nguoiThucHien}
                    onChange={e => setHeader(h => ({ ...h, nguoiThucHien: e.target.value }))}
                    className="flex-1 border-b border-dotted border-slate-600 font-bold outline-none px-1"
                    placeholder="Quy, E Dung, Hằng, Oanh..."
                  />
                </div>
                <div className="flex items-baseline gap-1">
                  <span>Máy:</span>
                  <input
                    value={header.tenMay}
                    onChange={e => setHeader(h => ({ ...h, tenMay: e.target.value }))}
                    className="w-28 border-b border-dotted border-slate-600 text-center font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* BẢNG I: VẬT TƯ */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-bold uppercase tracking-wide">I. VẬT TƯ</h4>
                <button
                  type="button"
                  onClick={addVatTuRow}
                  className="flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-3 w-3" /> Thêm dòng vật tư
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className={slipTableClass} style={{ minWidth: 1560 }}>
                  <colgroup>
                    <col style={{ width: 88 }} />
                    <col style={{ width: 220 }} />
                    <col style={{ width: 48 }} />
                    <col style={{ width: 76 }} />
                    <col style={{ width: 76 }} />
                    <col style={{ width: 76 }} />
                    {Array.from({ length: 10 }, (_, i) => (
                      <col key={i} style={{ width: 76 }} />
                    ))}
                    <col style={{ width: 76 }} />
                    <col style={{ width: 76 }} />
                    <col style={{ width: 32 }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-100 text-black">
                      <th rowSpan={2} className="border border-slate-800">Mã VT</th>
                      <th rowSpan={2} className="border border-slate-800">
                        Tên vật tư (Kế hoạch chi tiết kể vật tư cần sử dụng, mã vật tư và định mức sử dụng (Kg))
                      </th>
                      <th rowSpan={2} className="border border-slate-800">ĐVT</th>
                      <th rowSpan={2} className="border border-slate-800">Định mức vật tư</th>
                      <th rowSpan={2} className="border border-slate-800">Tồn đầu ca</th>
                      <th rowSpan={2} className="border border-slate-800">Lấy kho</th>
                      <th colSpan={10} className="border border-slate-800">SỬ DỤNG</th>
                      <th rowSpan={2} className="border border-slate-800">Tổng SD</th>
                      <th rowSpan={2} className="border border-slate-800">Tồn cuối</th>
                      <th rowSpan={2} className="border border-slate-800 no-print" />
                    </tr>
                    <tr className="bg-slate-100 text-black">
                      {Array.from({ length: 10 }, (_, i) => (
                        <th key={i} className="border border-slate-800">
                          L{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vatTuRows.length === 0 && (
                      <tr>
                        <td colSpan={19} className="border border-slate-800 p-4 text-center text-slate-400 italic">
                          Chưa có dữ liệu vật tư. Hãy bấm "Thêm dòng vật tư".
                        </td>
                      </tr>
                    )}
                    {vatTuRows.map((row, ri) => (
                      <tr key={row.key} className="h-9 hover:bg-slate-50/80" style={{ height: 36 }}>
                        <td className="border border-slate-800 p-0.5">
                          <input
                            value={row.ma_nvl}
                            onChange={e => updateVatTuRow(ri, { ma_nvl: e.target.value })}
                            className={centerInputStyle}
                          />
                        </td>
                        <td className="border border-slate-800 p-0.5">
                          <input
                            value={row.ten_nvl_sx || row.ten_nvl}
                            onChange={e =>
                              updateVatTuRow(ri, row.ten_nvl_sx ? { ten_nvl_sx: e.target.value } : { ten_nvl: e.target.value })
                            }
                            className={`${inputStyle} font-semibold text-black`}
                            style={{ color: '#000', fontSize: 16 }}
                            placeholder="Tên sản xuất"
                          />
                        </td>
                        <td className="border border-slate-800 p-0.5">
                          <input
                            value={row.dvt}
                            onChange={e => updateVatTuRow(ri, { dvt: e.target.value })}
                            className={centerInputStyle}
                          />
                        </td>
                        <td className="border border-slate-800 p-0.5">
                          <input
                            title="Tổng trọng lượng (kg) của NVL trên phiếu trộn định mức"
                            value={formatSlipNumber(row.dinh_muc)}
                            onChange={e => updateVatTuRow(ri, { dinh_muc: e.target.value })}
                            className={numInputStyle}
                          />
                        </td>
                        <td className="border border-slate-800 p-0.5">
                          <input
                            inputMode="decimal"
                            value={formatSlipNumber(row.ton_dau_ca)}
                            onChange={e => updateVatTuRow(ri, { ton_dau_ca: e.target.value })}
                            className={numInputStyle}
                          />
                        </td>
                        <td className="border border-slate-800 p-0.5">
                          <input
                            inputMode="decimal"
                            value={formatSlipNumber(row.lay_trong_kho)}
                            onChange={e => updateVatTuRow(ri, { lay_trong_kho: e.target.value })}
                            className={numInputStyle}
                          />
                        </td>
                        {row.lan.map((cellVal, li) => (
                          <td key={li} className="border border-slate-800 p-0.5">
                            <input
                              inputMode="decimal"
                              value={formatSlipNumber(cellVal)}
                              onChange={e => updateVatTuLan(ri, li, e.target.value)}
                              className={numInputStyle}
                            />
                          </td>
                        ))}
                        <td className={`border border-slate-800 ${numReadStyle}`}>
                          {row.tong_su_dung > 0 ? fmt(row.tong_su_dung) : '\u00a0'}
                        </td>
                        <td className={`border border-slate-800 ${numReadStyle}`}>
                          {fmt(row.ton_cuoi_ca) || '\u00a0'}
                        </td>
                        <td className="border border-slate-800 p-0.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeVatTuRow(ri)}
                            className="text-slate-400 hover:text-rose-600"
                            title="Xóa dòng"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {Array.from({ length: Math.max(0, 30 - vatTuRows.length) }, (_, i) => (
                      <tr key={`vt-blank-${i}`} className="h-9" style={{ height: 36 }} aria-hidden>
                        {Array.from({ length: 19 }, (_, ci) => (
                          <td key={ci} className="h-9 border border-slate-800" style={{ height: 36 }}>{'\u00a0'}</td>
                        ))}
                      </tr>
                    ))}

                    {/* Dòng tổng */}
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={6} className="border border-slate-800 p-1 text-right pr-2">
                        Cộng tổng sử dụng:
                      </td>
                      <td colSpan={10} className={`border border-slate-800 pr-2 ${numReadStyle}`}>
                        {tongCongSuDungVatTu > 0 ? fmt(tongCongSuDungVatTu) : '\u00a0'}
                      </td>
                      <td className={`border border-slate-800 ${numReadStyle}`}>
                        {tongCongSuDungVatTu > 0 ? fmt(tongCongSuDungVatTu) : '\u00a0'}
                      </td>
                      <td className="border border-slate-800 p-1"></td>
                      <td className="border border-slate-800"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Dòng bàn giao dưới bảng */}
              <div className="mt-2.5 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span>Giao ca:</span>
                  <input
                    value={giaoCaNote}
                    onChange={e => setGiaoCaNote(e.target.value)}
                    className="w-48 border-b border-dotted border-slate-700 px-1 text-xs outline-none"
                    placeholder="VD: 652 kg..."
                  />
                </div>
                <div>
                  Tổng sử dụng: <span className="text-[16px] font-semibold tabular-nums text-black">{fmt(tongCongSuDungVatTu)} kg</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TRANG 2: ẢNH 2 (THÀNH PHẨM, HÀNG LỖI, SỰ CỐ, CHỮ KÝ) ===================== */}
        {(activeTab === 'all' || activeTab === 'p2') && (
          <div className="relative rounded-sm border border-slate-300 bg-white p-5 text-slate-900 shadow-2xl sm:p-6" style={paperFontStyle}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              Trang 2 / 2 — Thành phẩm, Hàng lỗi hỏng, Sự cố &amp; Chữ ký (Ảnh 2)
            </div>

            <div className="mt-2 grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
              
              {/* CỘT TRÁI: BẢNG II. THÀNH PHẨM — chỉ xem, sửa ở sổ trộn */}
              <div className="lg:col-span-8">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wide">II. THÀNH PHẨM</h4>
                  <span className="text-[10px] text-slate-500 italic">Chỉ xem — sửa tại sổ trộn</span>
                </div>

                <div className="overflow-x-auto">
                  <table className={slipTableClass} style={{ minWidth: 860 }}>
                    <colgroup>
                      <col style={{ width: 90 }} />
                      <col style={{ width: 240 }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 100 }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-100 text-black">
                        <th rowSpan={2} className="border border-slate-800">Mã TP</th>
                        <th rowSpan={2} className="border border-slate-800">
                          THÀNH PHẨM (Kế hoạch sản xuất liệt kê các thành phẩm trừ khi dự kiến...)
                        </th>
                        <th rowSpan={2} className="border border-slate-800">TL định mức / tấm (Kg)</th>
                        <th colSpan={3} className="border border-slate-800">TP Nhập kho</th>
                        <th rowSpan={2} className="border border-slate-800">Tổng nhập</th>
                        <th rowSpan={2} className="border border-slate-800">Tổng TL (Kg)</th>
                      </tr>
                      <tr className="bg-slate-100 text-black">
                        <th className="border border-slate-800">Lần 1</th>
                        <th className="border border-slate-800">Lần 2</th>
                        <th className="border border-slate-800">Lần 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {thanhPhamRows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="border border-slate-800 p-4 text-center text-slate-400 italic">
                            Chưa có dữ liệu thành phẩm trên sổ trộn.
                          </td>
                        </tr>
                      )}
                      {thanhPhamRows.map(row => (
                        <tr key={row.key} className="h-9 bg-slate-50/40" style={{ height: 36 }}>
                          <td className="border border-slate-800 p-0.5">
                            <span className={`${readOnlyCell} text-center`}>{row.ma_sp}</span>
                          </td>
                          <td className="border border-slate-800 p-0.5">
                            <span className={`${readOnlyCell} text-left font-semibold`} style={{ color: '#000', fontSize: 16 }}>{row.ten_sp}</span>
                          </td>
                          <td className="border border-slate-800 p-0.5">
                            <span className={numReadStyle}>{formatSlipNumber(row.dinh_muc)}</span>
                          </td>
                          <td className="border border-slate-800 p-0.5">
                            <span className={numReadStyle}>{formatSlipNumber(row.lan_1)}</span>
                          </td>
                          <td className="border border-slate-800 p-0.5">
                            <span className={numReadStyle}>{formatSlipNumber(row.lan_2)}</span>
                          </td>
                          <td className="border border-slate-800 p-0.5">
                            <span className={numReadStyle}>{formatSlipNumber(row.lan_3)}</span>
                          </td>
                          <td className="border border-slate-800 p-0.5">
                            <span className={numReadStyle}>{formatSlipNumber(row.so_luong)}</span>
                          </td>
                          <td className="border border-slate-800 p-0.5">
                            <span className={numReadStyle}>{formatSlipNumber(row.trong_luong)}</span>
                          </td>
                        </tr>
                      ))}
                      {Array.from({ length: Math.max(0, 30 - thanhPhamRows.length) }, (_, i) => (
                        <tr key={`tp-blank-${i}`} className="h-9" style={{ height: 36 }} aria-hidden>
                          {Array.from({ length: 8 }, (_, ci) => (
                            <td key={ci} className="h-9 border border-slate-800" style={{ height: 36 }}>{'\u00a0'}</td>
                          ))}
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={6} className="border border-slate-800 p-1 text-right pr-2">
                          Cộng:
                        </td>
                        <td className={`border border-slate-800 ${numReadStyle}`}>
                          {tongNhapKhoThanhPham > 0 ? fmt(tongNhapKhoThanhPham) : '\u00a0'}
                        </td>
                        <td className={`border border-slate-800 ${numReadStyle}`}>
                          {tongTrongLuongThanhPham > 0 ? fmt(tongTrongLuongThanhPham) : '\u00a0'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CỘT PHẢI: BẢNG III. HÀNG LỖI/PHẾ & IV. SỰ CỐ SẢN XUẤT */}
              <div className="lg:col-span-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold uppercase tracking-wide">III. HÀNG LỖI HỎNG/PHẾ</h4>
                    <button
                      type="button"
                      onClick={addHangLoiRow}
                      className="flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Plus className="h-3 w-3" /> Thêm lỗi
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                  <table className={slipTableClass}>
                    <thead>
                      <tr className="bg-slate-100 text-black">
                        <th className="border border-slate-800 p-1 w-[55%]">TÊN LỖI/PHẾ</th>
                        <th className="border border-slate-800 p-1 w-[15%]">ĐVT</th>
                        <th className="border border-slate-800 p-1">SỐ LƯỢNG</th>
                        <th className="border border-slate-800 p-0.5 w-[8%]" />
                      </tr>
                    </thead>
                    <tbody>
                      {hangLoiRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="border border-slate-800 p-3 text-center text-slate-400 italic">
                            Không có hàng lỗi hỏng / phế.
                          </td>
                        </tr>
                      )}
                      {hangLoiRows.map((row, ri) => (
                        <tr key={row.key} className="h-9 hover:bg-slate-50/80" style={{ height: 36 }}>
                          <td className="border border-slate-800 p-0.5">
                            <input
                              value={row.ten_loi}
                              onChange={e => updateHangLoiRow(ri, { ten_loi: e.target.value })}
                              className={inputStyle}
                              placeholder="Băm 02 (DM)..."
                            />
                          </td>
                          <td className="border border-slate-800 p-0.5">
                            <input
                              value={row.dvt}
                              onChange={e => updateHangLoiRow(ri, { dvt: e.target.value })}
                              className={centerInputStyle}
                            />
                          </td>
                          <td className="border border-slate-800 p-0.5">
                            <input
                              inputMode="decimal"
                              value={formatSlipNumber(row.so_luong)}
                              onChange={e => updateHangLoiRow(ri, { so_luong: e.target.value })}
                              className={numInputStyle}
                              placeholder="708"
                            />
                          </td>
                          <td className="border border-slate-800 p-0.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeHangLoiRow(ri)}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {Array.from({ length: Math.max(0, 7 - hangLoiRows.length) }, (_, i) => (
                        <tr key={`hl-blank-${i}`} className="h-9" style={{ height: 36 }} aria-hidden>
                          {Array.from({ length: 4 }, (_, ci) => (
                            <td key={ci} className="h-9 border border-slate-800" style={{ height: 36 }}>{'\u00a0'}</td>
                          ))}
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={2} className="border border-slate-800 p-1 text-right pr-2">
                          Cộng:
                        </td>
                        <td className={`border border-slate-800 ${numReadStyle}`}>
                          {tongHangLoi > 0 ? fmt(tongHangLoi) : '\u00a0'}
                        </td>
                        <td className="border border-slate-800"></td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </div>

                {/* Bảng IV: Sự cố */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wide">IV. SỰ CỐ SẢN XUẤT / LƯU Ý KHÁC</h4>
                    <button
                      type="button"
                      onClick={() => setSuCoRows(rows => [...rows, { key: uid(), ten: 'Đổi màu', lan: '1' }])}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3 w-3" /> Thêm sự cố
                    </button>
                  </div>
                  <table className="mb-2 w-full border-collapse text-[16px] text-black">
                    <thead>
                      <tr className="bg-slate-100 text-black">
                        <th className="border border-slate-800 px-1 py-1 text-left">Sự cố</th>
                        <th className="border border-slate-800 px-1 py-1 w-[72px]">Số lần</th>
                        <th className="border border-slate-800 px-1 py-1 w-[72px]">Số giờ</th>
                        <th className="border border-slate-800 w-[28px]" />
                      </tr>
                    </thead>
                    <tbody>
                      {suCoRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="border border-slate-800 px-2 py-2 text-center text-slate-400 italic">
                            Chưa có sự cố. Bấm Thêm sự cố.
                          </td>
                        </tr>
                      )}
                      {suCoRows.map((row, index) => (
                        <tr key={row.key}>
                          <td className="border border-slate-800 p-0.5">
                            <select
                              value={row.ten}
                              onChange={e => setSuCoRows(rows => rows.map((item, i) => (i === index ? { ...item, ten: e.target.value } : item)))}
                              className="w-full bg-transparent px-1 py-1 text-[16px] font-semibold text-black outline-none"
                            >
                              {SU_CO_MAU.map(item => (
                                <option key={item.ten} value={item.ten}>
                                  {item.ten} — {item.gio}h
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border border-slate-800 p-0.5">
                            <input
                              inputMode="decimal"
                              value={row.lan}
                              onChange={e => setSuCoRows(rows => rows.map((item, i) => (i === index ? { ...item, lan: e.target.value } : item)))}
                              className="w-full bg-transparent px-1 py-1 text-center text-[16px] font-bold text-black outline-none"
                            />
                          </td>
                          <td className="border border-slate-800 px-1 text-center text-[16px] font-bold tabular-nums text-black">
                            {gioSuCo(row.ten, row.lan)}
                          </td>
                          <td className="border border-slate-800 text-center">
                            <button
                              type="button"
                              onClick={() => setSuCoRows(rows => rows.filter((_, i) => i !== index))}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="mx-auto h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <textarea
                    rows={4}
                    value={suCoLuuY}
                    onChange={e => setSuCoLuuY(e.target.value)}
                    className="w-full rounded border border-slate-800 bg-slate-50/50 p-2 text-xs leading-relaxed outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    placeholder="Ghi chú thêm..."
                  />
                </div>
              </div>

            </div>

            {/* 4 Khối chữ ký ở chân trang 2 */}
            <div className="mt-8 grid grid-cols-4 gap-3 border-t border-slate-300 pt-4 text-center break-inside-avoid">
              <div>
                <div className="text-xs font-bold">Thủ kho vật tư</div>
                <div className="text-[10.5px] italic text-slate-500">(Ký, họ tên)</div>
                <div className="h-12" />
                <input
                  value={chuKy.thuKhoVatTu}
                  onChange={e => setChuKy(c => ({ ...c, thuKhoVatTu: e.target.value }))}
                  className="w-full border-b border-dotted border-slate-400 text-center text-xs font-bold outline-none"
                  placeholder="Họ tên"
                />
              </div>

              <div>
                <div className="text-xs font-bold">Trưởng ca sản xuất</div>
                <div className="text-[10.5px] italic text-slate-500">(Giao ca sau - Ký, họ tên)</div>
                <div className="h-12" />
                <input
                  value={chuKy.truongCa}
                  onChange={e => setChuKy(c => ({ ...c, truongCa: e.target.value }))}
                  className="w-full border-b border-dotted border-slate-400 text-center text-xs font-bold outline-none"
                  placeholder="Họ tên"
                />
              </div>

              <div>
                <div className="text-xs font-bold">Thủ kho thành phẩm</div>
                <div className="text-[10.5px] italic text-slate-500">(Ký, họ tên)</div>
                <div className="h-12" />
                <input
                  value={chuKy.thuKhoThanhPham}
                  onChange={e => setChuKy(c => ({ ...c, thuKhoThanhPham: e.target.value }))}
                  className="w-full border-b border-dotted border-slate-400 text-center text-xs font-bold outline-none"
                  placeholder="Họ tên"
                />
              </div>

              <div>
                <div className="text-xs font-bold">Kế hoạch sản xuất</div>
                <div className="text-[10.5px] italic text-slate-500">(Ký, họ tên)</div>
                <div className="h-12" />
                <input
                  value={chuKy.keHoachSanXuat}
                  onChange={e => setChuKy(c => ({ ...c, keHoachSanXuat: e.target.value }))}
                  className="w-full border-b border-dotted border-slate-400 text-center text-xs font-bold outline-none"
                  placeholder="Họ tên"
                />
              </div>
            </div>

          </div>
        )}

      </div>
    </div>,
    document.body
  );
}
export default PhieuGiaoCaModal;
