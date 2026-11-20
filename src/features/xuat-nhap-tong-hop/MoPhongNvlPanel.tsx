import React, { useMemo, useState } from 'react';
import { Beaker, ChevronLeft, Package, Factory, Warehouse, Clock3, Truck } from 'lucide-react';
import { LOAI_NHAP_OPTIONS, LOAI_XUAT_OPTIONS, LOAI_SAN_XUAT_OPTIONS } from './model';
import { NVL_PROCESS_RECIPES, listNvlProcessOptions } from './nvlProcessRecipes';

type Props = {
  onBack: () => void;
  onOpenForm?: () => void;
};

const MOCK_KHO = [
  { ten: 'Kho NVL Chính', ma: 'KNVL01', vaiTro: 'Nhập / xuất NVL chính' },
  { ten: 'Kho NVL Phụ', ma: 'KNVL02', vaiTro: 'Nhập / xuất NVL phụ' },
  { ten: 'Kho PC', ma: 'KPC01', vaiTro: 'Phế cái / TP băm / tạo hạt' }
];

const MOCK_MAY = [
  { ma: 'BAM01', ten: 'Máy băm 1', loaiSx: 'Đặc / Sóng' },
  { ma: 'THAT01', ten: 'Máy tạo hạt 1', loaiSx: 'Đặc' },
  { ma: 'SONG01', ten: 'Máy Sóng 1', loaiSx: 'Đặc hoặc Sóng' },
  { ma: 'RONG01', ten: 'Máy Rỗng 1', loaiSx: 'Rỗng' }
];

const MOCK_NVL = [
  { ma: 'MN01', ten: 'Phế cái mua ngoài', kho: 'Kho PC', gia: '12.000.000' },
  { ma: 'SX01', ten: 'Phế sản xuất', kho: 'Kho PC', gia: '8.500.000' },
  { ma: 'MN05', ten: 'Thành phẩm băm', kho: 'Kho PC', gia: '11.200.000' },
  { ma: 'SX02', ten: 'TP băm từ SX01', kho: 'Kho PC', gia: '9.800.000' },
  { ma: 'MN06', ten: 'Hạt màu', kho: 'Kho NVL Chính', gia: '15.000.000' },
  { ma: 'SX06', ten: 'Phế sóng/rỗng', kho: 'Kho NVL Chính', gia: '7.200.000' }
];

const MOCK_CA = ['Ca 1', 'Ca 2', 'Ca 3', 'Ca hành chính'];
const MOCK_NCC = [
  { ma: 'NCC01', ten: 'Công ty ABC Nhựa' },
  { ma: 'NCC02', ten: 'Công ty XYZ Vật tư' }
];

const MOCK_TON_LO = [
  { ma: 'MN01', kho: 'Kho PC', gia: '12.000.000', ton: '1.250,500', ngay: '18/11/2026' },
  { ma: 'MN01', kho: 'Kho PC', gia: '11.800.000', ton: '420,000', ngay: '15/11/2026' },
  { ma: 'SX01', kho: 'Kho PC', gia: '8.500.000', ton: '680,250', ngay: '19/11/2026' },
  { ma: 'SX06', kho: 'Kho NVL Chính', gia: '7.200.000', ton: '310,000', ngay: '17/11/2026' }
];

type SectionId = 'kho' | 'may' | 'nvl' | 'ca' | 'ncc' | 'loai' | 'quytrinh' | 'ton';

export function MoPhongNvlPanel({ onBack, onOpenForm }: Props) {
  const [section, setSection] = useState<SectionId>('kho');
  const processOptions = useMemo(() => listNvlProcessOptions(), []);

  const tabs: Array<{ id: SectionId; label: string; icon: React.ReactNode }> = [
    { id: 'kho', label: 'Kho', icon: <Warehouse className="h-3.5 w-3.5" /> },
    { id: 'may', label: 'Máy', icon: <Factory className="h-3.5 w-3.5" /> },
    { id: 'nvl', label: 'Mã NVL', icon: <Package className="h-3.5 w-3.5" /> },
    { id: 'ca', label: 'Ca', icon: <Clock3 className="h-3.5 w-3.5" /> },
    { id: 'ncc', label: 'NCC', icon: <Truck className="h-3.5 w-3.5" /> },
    { id: 'loai', label: 'Loại phiếu', icon: <Beaker className="h-3.5 w-3.5" /> },
    { id: 'quytrinh', label: 'Quy trình', icon: <Beaker className="h-3.5 w-3.5" /> },
    { id: 'ton', label: 'Tồn lô', icon: <Package className="h-3.5 w-3.5" /> }
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-extrabold text-[#ef1b2d]">
            <ChevronLeft className="h-4 w-4" /> Quay lại
          </button>
          <h1 className="text-sm font-black uppercase tracking-wide text-zinc-950">Mô phỏng nguồn dữ liệu NVL</h1>
        </div>
        {onOpenForm ? (
          <button
            type="button"
            onClick={onOpenForm}
            className="rounded-lg bg-[#ef1b2d] px-3 py-2 text-xs font-extrabold text-white"
          >
            Mở form xuất nhập
          </button>
        ) : null}
      </div>

      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
        Đây là dữ liệu mẫu để hiểu nguồn form dùng: kho, máy, mã NVL, ca, NCC, loại phiếu, quy trình và tồn theo lô giá.
        Không ghi vào database thật.
      </p>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-extrabold ${
              section === tab.id
                ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
                : 'border-zinc-200 bg-white text-zinc-600'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {section === 'kho' ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <header className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-700">
            Kho (nguồn / kho nhập)
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-[#ef1b2d] text-left text-white">
                  <th className="px-3 py-2">Tên kho</th>
                  <th className="px-3 py-2">Mã</th>
                  <th className="px-3 py-2">Vai trò trên form</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_KHO.map(row => (
                  <tr key={row.ten} className="border-b border-zinc-100">
                    <td className="px-3 py-2 font-bold text-zinc-900">{row.ten}</td>
                    <td className="px-3 py-2 font-mono">{row.ma}</td>
                    <td className="px-3 py-2 text-zinc-600">{row.vaiTro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {section === 'may' ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <header className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-700">
            Máy (nguồn nhập / xuất đến)
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-[#ef1b2d] text-left text-white">
                  <th className="px-3 py-2">Mã máy</th>
                  <th className="px-3 py-2">Tên</th>
                  <th className="px-3 py-2">Loại sản xuất gợi ý</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_MAY.map(row => (
                  <tr key={row.ma} className="border-b border-zinc-100">
                    <td className="px-3 py-2 font-mono font-bold">{row.ma}</td>
                    <td className="px-3 py-2">{row.ten}</td>
                    <td className="px-3 py-2 text-zinc-600">{row.loaiSx}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-[11px] font-semibold text-zinc-500">
            Loại sản xuất trên form: {LOAI_SAN_XUAT_OPTIONS.join(' / ')}.
          </p>
        </section>
      ) : null}

      {section === 'nvl' ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <header className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-700">
            Mã NVL theo kho
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-[#ef1b2d] text-left text-white">
                  <th className="px-3 py-2">Mã</th>
                  <th className="px-3 py-2">Tên</th>
                  <th className="px-3 py-2">Kho</th>
                  <th className="px-3 py-2">Giá mẫu</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_NVL.map(row => (
                  <tr key={`${row.ma}-${row.kho}`} className="border-b border-zinc-100">
                    <td className="px-3 py-2 font-mono font-bold text-[#ef1b2d]">{row.ma}</td>
                    <td className="px-3 py-2">{row.ten}</td>
                    <td className="px-3 py-2">{row.kho}</td>
                    <td className="px-3 py-2 font-mono">{row.gia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {section === 'ca' ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-700">Ca (không bắt buộc)</p>
          <div className="flex flex-wrap gap-1.5">
            {MOCK_CA.map(ca => (
              <span key={ca} className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] font-bold text-zinc-700">
                {ca}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] font-semibold text-zinc-500">Nguồn thật lấy từ Cài đặt → Thời gian.</p>
        </section>
      ) : null}

      {section === 'ncc' ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <header className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-700">
            Nhà cung cấp
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-[#ef1b2d] text-left text-white">
                  <th className="px-3 py-2">Mã</th>
                  <th className="px-3 py-2">Tên</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_NCC.map(row => (
                  <tr key={row.ma} className="border-b border-zinc-100">
                    <td className="px-3 py-2 font-mono font-bold">{row.ma}</td>
                    <td className="px-3 py-2">{row.ten}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {section === 'loai' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-700">Loại nhập</p>
            <ul className="space-y-1">
              {LOAI_NHAP_OPTIONS.map(item => (
                <li key={item} className="rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700">
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-700">Loại xuất</p>
            <ul className="space-y-1">
              {LOAI_XUAT_OPTIONS.map(item => (
                <li key={item} className="rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {section === 'quytrinh' ? (
        <div className="space-y-2">
          {NVL_PROCESS_RECIPES.map(recipe => (
            <section key={recipe.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-black text-[#ef1b2d]">{recipe.title}</p>
              <p className="mt-1 text-[11px] font-semibold text-zinc-600">{recipe.summary}</p>
              <ol className="mt-2 space-y-1">
                {recipe.steps.map((step, index) => (
                  <li key={step.id} className="rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700">
                    <span className="font-black text-zinc-900">{index + 1}. {step.title}</span>
                    <span className="text-zinc-400"> · {step.mode === 'nhap' ? 'Phiếu nhập' : step.mode === 'xuat' ? 'Phiếu xuất' : 'Chuyển kho'}</span>
                    <div className="mt-0.5 font-medium text-zinc-500">{step.description}</div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <p className="text-[11px] font-semibold text-zinc-500">
            Trên form có {processOptions.length} quy trình gợi ý tương ứng.
          </p>
        </div>
      ) : null}

      {section === 'ton' ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <header className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-700">
            Tồn theo lô giá (mẫu)
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-[#ef1b2d] text-left text-white">
                  <th className="px-3 py-2">Mã</th>
                  <th className="px-3 py-2">Kho</th>
                  <th className="px-3 py-2">Giá</th>
                  <th className="px-3 py-2">Tồn còn</th>
                  <th className="px-3 py-2">Ngày nhập</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TON_LO.map(row => (
                  <tr key={`${row.ma}-${row.gia}-${row.ngay}`} className="border-b border-zinc-100">
                    <td className="px-3 py-2 font-mono font-bold">{row.ma}</td>
                    <td className="px-3 py-2">{row.kho}</td>
                    <td className="px-3 py-2 font-mono">{row.gia}</td>
                    <td className="px-3 py-2 font-mono text-emerald-800">{row.ton}</td>
                    <td className="px-3 py-2">{row.ngay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-[11px] font-semibold text-zinc-500">
            Khi xuất, form gắn lô theo nhập trước – xuất trước và số lượng.
          </p>
        </section>
      ) : null}
    </div>
  );
}
