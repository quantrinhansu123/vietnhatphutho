import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { NVL_PROCESS_RECIPES } from '../xuat-nhap-tong-hop/nvlProcessRecipes';
import { LOAI_SAN_XUAT_LABEL } from '../xuat-nhap-tong-hop/model';

type Props = {
  onBack: () => void;
  onOpenForm?: () => void;
};

type GuideStep = {
  id: string;
  title: string;
  body: string;
  tip?: string;
  target: string;
};

const FORM_STEPS: GuideStep[] = [
  {
    id: 'menu',
    title: 'Vào menu Kho',
    body: 'Nhà máy → Kho → «Xuất nhập kho NVL». Đây là form lập phiếu nhập/xuất NVL hiện tại.',
    tip: 'Có thêm «NVL theo đợt–máy» và «Hướng dẫn nhập NVL».',
    target: 'nav-card'
  },
  {
    id: 'wizard',
    title: 'Chọn quy trình gợi ý',
    body: 'Trên form, chọn một trong 7 quy trình (băm, tạo hạt, trộn màu, mua ngoài, xuất SX, nhập lại, nhập phế) rồi chọn bước — hệ thống điền sẵn loại phiếu / mã / kho.',
    tip: 'Vẫn kiểm tra số lượng–giá rồi Lưu từng phiếu; không tự sinh cả chuỗi.',
    target: 'wizard'
  },
  {
    id: 'tab-nhap',
    title: 'Phiếu nhập hoặc xuất',
    body: 'Chọn Phiếu nhập hoặc Phiếu xuất. Quy trình gợi ý sẽ tự chọn đúng loại theo bước.',
    target: 'tab-nhap'
  },
  {
    id: 'loai-sx',
    title: `Chọn ${LOAI_SAN_XUAT_LABEL}`,
    body: `Với phiếu liên quan máy: bắt buộc ${LOAI_SAN_XUAT_LABEL} (Đặc / Sóng / Rỗng). Không còn đích «phân xưởng». Máy Sóng 1 chạy đặc vs sóng phân biệt bằng ô này.`,
    target: 'loai-sx'
  },
  {
    id: 'ca-dot',
    title: 'Ca + Đợt',
    body: 'Ca không bắt buộc. Phiếu SX (xuất máy / nhập lại / phế / băm–tạo hạt) cần Đợt 1–10.',
    target: 'ca-dot'
  },
  {
    id: 'lines',
    title: 'Dòng NVL',
    body: 'Nhập: chọn Kho nhập (Chính / Phụ / PC) + mã + SL + giá. Xuất: chọn Xuất từ + máy đích. Phế: SX01→PC, SX06→NVL Chính.',
    tip: 'Nhập lại: bấm «Gợi ý kho nhập từ phiếu xuất cùng đợt–máy».',
    target: 'lines'
  },
  {
    id: 'luu',
    title: 'Lưu · In · Bước kế',
    body: 'Lưu phiếu → chuyển bước tiếp theo nếu còn. In từ Danh sách. Chuyển kho PC→Chính/Phụ dùng menu Chuyển kho.',
    target: 'luu'
  }
];

function Spot({
  active,
  children,
  className = ''
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {children}
      {active ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1 z-10 rounded-xl ring-[3px] ring-[#ef1b2d] ring-offset-2 ring-offset-white animate-pulse"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-2 -top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[#ef1b2d] text-[11px] font-black text-white shadow-md"
          >
            !
          </span>
        </>
      ) : null}
    </div>
  );
}

export function HuongDanNhapNvlPanel({ onBack, onOpenForm }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [processFocus, setProcessFocus] = useState(0);
  const step = FORM_STEPS[stepIndex];
  const progress = useMemo(() => ((stepIndex + 1) / FORM_STEPS.length) * 100, [stepIndex]);
  const recipe = NVL_PROCESS_RECIPES[processFocus] || NVL_PROCESS_RECIPES[0];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        setStepIndex(i => Math.min(FORM_STEPS.length - 1, i + 1));
      } else if (event.key === 'ArrowLeft') {
        setStepIndex(i => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (index: number) => setStepIndex(Math.max(0, Math.min(FORM_STEPS.length - 1, index)));

  return (
    <div className="mx-auto max-w-6xl space-y-3 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-xs font-extrabold text-[#ef1b2d]">
          ← Kho
        </button>
        <h1 className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-950">
          <BookOpen className="h-4 w-4 text-[#ef1b2d]" />
          Hướng dẫn quy trình NVL
        </h1>
        {onOpenForm ? (
          <button
            type="button"
            onClick={onOpenForm}
            className="inline-flex items-center gap-1 text-xs font-extrabold text-[#ef1b2d]"
          >
            Mở form thật <ExternalLink className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="w-16" />
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-black text-zinc-800">
            Bước form {stepIndex + 1}/{FORM_STEPS.length}: {step.title}
          </p>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-[#ef1b2d] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-sm font-semibold leading-relaxed text-zinc-700">{step.body}</p>
        {step.tip ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900">
            Gợi ý: {step.tip}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => go(stepIndex - 1)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 px-3 text-xs font-extrabold text-zinc-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Trước
          </button>
          <button
            type="button"
            disabled={stepIndex >= FORM_STEPS.length - 1}
            onClick={() => go(stepIndex + 1)}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white disabled:opacity-40"
          >
            Tiếp <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
            <p className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">Bước form</p>
            <ol className="space-y-1">
              {FORM_STEPS.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => go(index)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold ${
                      index === stepIndex ? 'bg-red-50 text-[#ef1b2d] ring-1 ring-[#ef1b2d]/40' : 'text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                        index === stepIndex ? 'bg-[#ef1b2d] text-white' : 'bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                    {item.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
            <p className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">7 quy trình</p>
            <ol className="max-h-72 space-y-1 overflow-y-auto">
              {NVL_PROCESS_RECIPES.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setProcessFocus(index)}
                    className={`w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-bold ${
                      index === processFocus ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <div className="space-y-3">
          <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <p className="text-sm font-black text-zinc-950">{recipe.title}</p>
            <p className="mt-1 text-[12px] font-semibold text-zinc-600">{recipe.summary}</p>
            <ol className="mt-3 space-y-2">
              {recipe.steps.map((s, i) => (
                <li key={s.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <p className="text-[11px] font-extrabold text-[#ef1b2d]">
                    Bước {i + 1}. {s.title}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-zinc-700">{s.description}</p>
                  {s.loaiPhieu ? (
                    <p className="mt-1 text-[10px] font-bold text-zinc-500">Loại phiếu: {s.loaiPhieu}</p>
                  ) : null}
                  {s.lines?.length ? (
                    <p className="mt-0.5 text-[10px] font-semibold text-zinc-500">
                      Mã/kho: {s.lines.map(l => [l.ma, l.maDich && `→${l.maDich}`, l.kho].filter(Boolean).join(' ')).join(' · ')}
                    </p>
                  ) : null}
                  {s.note ? <p className="mt-1 text-[10px] font-semibold text-amber-800">{s.note}</p> : null}
                </li>
              ))}
            </ol>
          </section>

          <div className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
              Giao diện mẫu — khoanh đỏ = bước form đang xem
            </p>
            <Spot active={step.target === 'nav-card'}>
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <p className="text-[10px] font-black uppercase text-zinc-400">Kho</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border-2 border-[#ef1b2d] bg-red-50 px-2 py-2 text-[11px] font-extrabold text-[#ef1b2d]">
                    Xuất nhập kho NVL
                  </div>
                  <div className="rounded-lg border border-zinc-200 px-2 py-2 text-[11px] font-bold text-zinc-500">
                    NVL theo đợt–máy
                  </div>
                  <div className="rounded-lg border border-zinc-200 px-2 py-2 text-[11px] font-bold text-zinc-500">
                    Hướng dẫn
                  </div>
                </div>
              </div>
            </Spot>
            <Spot active={step.target === 'wizard'}>
              <div className="rounded-xl border border-[#ef1b2d]/30 bg-red-50/50 p-3 text-[11px] font-bold text-zinc-700">
                Quy trình: {recipe.title} · Bước: {recipe.steps[0]?.title}
              </div>
            </Spot>
            <Spot active={step.target === 'tab-nhap'}>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex h-9 items-center justify-center rounded-lg border border-[#ef1b2d] bg-red-50 text-xs font-extrabold text-[#ef1b2d]">
                  Phiếu nhập
                </div>
                <div className="flex h-9 items-center justify-center rounded-lg border border-zinc-200 text-xs font-extrabold text-zinc-500">
                  Phiếu xuất
                </div>
              </div>
            </Spot>
            <Spot active={step.target === 'loai-sx'}>
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-bold">
                {LOAI_SAN_XUAT_LABEL}: Đặc | Sóng | Rỗng
              </div>
            </Spot>
            <Spot active={step.target === 'ca-dot'}>
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-bold">
                Ca không bắt buộc · Đợt 1–10
              </div>
            </Spot>
            <Spot active={step.target === 'lines'}>
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-semibold text-zinc-600">
                Lưới dòng: Kho nhập / Mã / Tên SX / SL / Giá (hoặc Xuất từ + máy)
              </div>
            </Spot>
            <Spot active={step.target === 'luu'}>
              <div className="flex gap-2">
                <span className="rounded-lg border border-[#ef1b2d] px-3 py-2 text-xs font-extrabold text-[#ef1b2d]">
                  Xem trước
                </span>
                <span className="rounded-lg bg-[#ef1b2d] px-3 py-2 text-xs font-extrabold text-white">Lưu phiếu</span>
              </div>
            </Spot>
          </div>
        </div>
      </div>
    </div>
  );
}
