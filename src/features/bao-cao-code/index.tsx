import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  ImageOff,
  Images,
  Rows2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import thongKeNvlBeforeImg from './assets/thong-ke-nvl-truoc.png';
import thongKeNvlAfterOverviewImg from './assets/thong-ke-nvl-sau-tong-quan.png';
import thongKeNvlAfterMovementsImg from './assets/thong-ke-nvl-sau-chung-tu.png';
import thongKeNvlAfterBalanceImg from './assets/thong-ke-nvl-sau-ton-su-dung.png';
import thongKeNvlDotTonImg from './assets/thong-ke-nvl-dot-ton.png';
import thongKeNvlDoiChieuMayImg from './assets/thong-ke-nvl-doi-chieu-may.png';
import nvlGiaDropdownImg from './assets/nvl-gia-dropdown.png';
import ptdmDoiSoatImg from './assets/ptdm-doi-soat.png';
import ptdmInA4Img from './assets/ptdm-in-a4.png';

type Status = 'Chờ nghiệm thu' | 'Còn việc';
type CompareLayout = 'side-by-side' | 'stacked';

interface EvidenceImage {
  id: string;
  src: string;
  alt: string;
  stage: 'Trước khi sửa' | 'Sau khi sửa';
  viewLabel?: string;
  sourceBadge: string;
  isSampleData?: boolean;
  caption: string;
  dimensions: string;
}

interface ReportEntry {
  date: string;
  title: string;
  request: string;
  delivery: string;
  verification: string;
  status: Status;
  defaultOpen?: boolean;
  evidence?: {
    before?: EvidenceImage;
    after?: EvidenceImage[];
    note?: string;
  };
  missingEvidenceReason?: string;
}

const entries: ReportEntry[] = [
  {
    date: '2026-11-28',
    title: 'Giao diện Thống kê NVL',
    request: 'Gom bộ lọc, làm rõ bốn chỉ số và bỏ các dòng chú thích.',
    delivery: 'Gom bộ lọc và Xem / Excel, giản lược cả bốn tab, đưa Nhập, Xuất, Sử dụng và Tồn cuối lên đầu trang.',
    verification: 'Build và 6/6 kiểm thử đạt. Cần xem lại báo cáo trên màn hình rộng và hẹp sau khi đăng nhập.',
    status: 'Chờ nghiệm thu',
    defaultOpen: true,
    evidence: {
      before: {
        id: 'thong-ke-nvl-before',
        src: thongKeNvlBeforeImg,
        alt: 'Ảnh trước khi sửa giao diện Thống kê NVL (/thong-ke-nvl) do người dùng cung cấp',
        stage: 'Trước khi sửa',
        viewLabel: 'Màn hình cũ',
        sourceBadge: 'Ảnh người dùng cung cấp',
        caption: 'Ảnh chụp màn hình /thong-ke-nvl cũ do người dùng cung cấp (đã cắt thanh trình duyệt và thanh tác vụ).',
        dimensions: '1790×828',
      },
      after: [
        {
          id: 'thong-ke-nvl-after-overview',
          src: thongKeNvlAfterOverviewImg,
          alt: 'Ảnh sau khi sửa giao diện Thống kê NVL tab Tổng quan với dữ liệu mẫu',
          stage: 'Sau khi sửa',
          viewLabel: 'Tổng quan',
          sourceBadge: 'Ảnh dữ liệu mẫu',
          isSampleData: true,
          caption:
            'Chụp bằng Orca browser từ component thật ThongKeNvlPanel trong môi trường kiểm thử cô lập với dữ liệu mẫu (trang chạy thật yêu cầu đăng nhập).',
          dimensions: '1440×666',
        },
        {
          id: 'thong-ke-nvl-after-movements',
          src: thongKeNvlAfterMovementsImg,
          alt: 'Ảnh sau khi sửa giao diện Thống kê NVL tab Chứng từ nhập–xuất với dữ liệu mẫu',
          stage: 'Sau khi sửa',
          viewLabel: 'Chứng từ nhập–xuất',
          sourceBadge: 'Ảnh dữ liệu mẫu',
          isSampleData: true,
          caption:
            'Tab Chứng từ nhập–xuất chụp bằng Orca browser từ giao diện thật với dữ liệu mẫu cô lập (cùng tỷ lệ màn hình 1440×666).',
          dimensions: '1440×666',
        },
        {
          id: 'thong-ke-nvl-after-balance',
          src: thongKeNvlAfterBalanceImg,
          alt: 'Ảnh sau khi sửa giao diện Thống kê NVL tab Tồn & sử dụng với dữ liệu mẫu',
          stage: 'Sau khi sửa',
          viewLabel: 'Tồn & sử dụng',
          sourceBadge: 'Ảnh dữ liệu mẫu',
          isSampleData: true,
          caption:
            'Tab Tồn & sử dụng chụp bằng Orca browser từ giao diện thật với dữ liệu mẫu cô lập (cùng tỷ lệ màn hình 1440×666).',
          dimensions: '1440×666',
        },
      ],
      note: 'Ảnh trước là giao diện cũ do người dùng gửi; các ảnh sau chụp từ giao diện hiện tại bằng dữ liệu mẫu cô lập do màn hình chạy thật yêu cầu đăng nhập.',
    },
  },
  {
    date: '2026-11-27',
    title: 'Thống kê nhập, xuất và tồn NVL',
    request: 'Theo dõi theo kỳ, đợt, máy và kho.',
    delivery:
      'Tổng hợp chứng từ và số sử dụng từ Sổ trộn; khi lọc đợt tính tồn từ chứng từ liên kết đợt (chưa trừ sổ vì sổ không gắn đợt); tab Kiểm tra theo máy đối chiếu tồn sổ với phần còn theo cấp/nhập lại.',
    verification:
      'Unit test công thức tồn, tồn theo đợt và đối chiếu vật lý đạt. Đã chụp ảnh minh chứng UI với dữ liệu mẫu cô lập cho tab Tồn & sử dụng (lọc đợt) và tab Kiểm tra theo máy; sổ trộn vẫn chưa gắn đợt nên sử dụng theo đợt chưa trừ được.',
    status: 'Chờ nghiệm thu',
    evidence: {
      after: [
        {
          id: 'thong-ke-nvl-dot-ton',
          src: thongKeNvlDotTonImg,
          alt: 'Ảnh sau khi sửa Thống kê NVL tab Tồn & sử dụng khi lọc theo Đợt với dữ liệu mẫu',
          stage: 'Sau khi sửa',
          viewLabel: 'Tồn & sử dụng (lọc đợt)',
          sourceBadge: 'Ảnh dữ liệu mẫu',
          isSampleData: true,
          caption:
            'Tab Tồn & sử dụng khi lọc theo Đợt 1: hiển thị thông báo và cột Sử dụng ghi «Chưa trừ (lọc đợt)», tính Tồn cuối = Tồn đầu + Nhập − Xuất (chụp bằng Orca browser từ ThongKeNvlPanel với dữ liệu mẫu cô lập).',
          dimensions: '1440×666',
        },
        {
          id: 'thong-ke-nvl-doi-chieu-may',
          src: thongKeNvlDoiChieuMayImg,
          alt: 'Ảnh sau khi sửa Thống kê NVL tab Kiểm tra theo máy đối chiếu Tồn sổ, Còn theo cấp và Chênh lệch với dữ liệu mẫu',
          stage: 'Sau khi sửa',
          viewLabel: 'Kiểm tra theo máy',
          sourceBadge: 'Ảnh dữ liệu mẫu',
          isSampleData: true,
          caption:
            'Tab Kiểm tra theo máy (MachineStockTab) hiển thị cột Tồn sổ, Còn theo cấp (Đã cấp − Đã nhập lại), Chênh và chi tiết kho đã cấp · đơn giá (chụp bằng Orca browser với dữ liệu mẫu cô lập).',
          dimensions: '1440×666',
        },
      ],
      note: 'Ảnh chụp bằng Orca browser từ component thật với dữ liệu mẫu cô lập (không ghi/đọc DB chính; chưa có ảnh chụp màn hình trước khi sửa).',
    },
  },
  {
    date: '2026-11-27',
    title: 'Danh mục, lô và phiếu nhập xuất NVL',
    request: 'Tạo mã mua ngoài, theo dõi giá nhập và xuất theo lô.',
    delivery:
      'Luồng mã mua ngoài và lô tồn giữ nguyên; bộ chọn giá cũ tách từng lần nhập theo ngày + diễn giải + giá (API trả lots); cùng mã khác giá vẫn hiện riêng.',
    verification:
      'Unit test tách lịch sử giá/ngày/diễn giải đạt. Đã chụp ảnh minh chứng dropdown giá NVL với dữ liệu mẫu cô lập. Kiểm thử ghi chứng từ đầy đủ trên DB thử nghiệm vẫn cần chạy opt-in `NVL_API_TEST_ALLOW_WRITES=1` (không ghi DB chính trong phiên này).',
    status: 'Chờ nghiệm thu',
    evidence: {
      after: [
        {
          id: 'nvl-gia-dropdown',
          src: nvlGiaDropdownImg,
          alt: 'Ảnh sau khi sửa dropdown giá NVL tách theo ngày và diễn giải trên form Phiếu nhập xuất NVL với dữ liệu mẫu',
          stage: 'Sau khi sửa',
          viewLabel: 'Dropdown giá NVL (lots)',
          sourceBadge: 'Ảnh dữ liệu mẫu',
          isSampleData: true,
          caption:
            'Bộ chọn giá NvlPriceSelect trên form Phiếu nhập xuất NVL tách riêng từng lần nhập theo đơn giá · ngày phiếu · diễn giải (cùng mã NVL có cùng hoặc khác đơn giá đều hiển thị riêng từng đợt nhập; chụp bằng Orca browser với dữ liệu mẫu cô lập).',
          dimensions: '1440×666',
        },
      ],
      note: 'Ảnh chụp bằng Orca browser từ component thật TongHopPanel / NvlPriceSelect với dữ liệu mẫu cô lập (không ghi dữ liệu thử lên DB chính; chưa có ảnh trước khi sửa).',
    },
  },
  {
    date: '2026-11-27',
    title: 'Phiếu trộn định mức và đối soát lệnh',
    request: 'Sắp xếp nhóm sản phẩm, đối soát số lượng và chỉnh bản in.',
    delivery:
      'Đối soát số lượng theo khóa dòng lệnh bền vững (không phụ thuộc STT); lưu order_quantities; bản in đặt khổ A4 ngang.',
    verification:
      'Unit test định danh dòng (STT đổi không đổi khóa), đối soát đa lệnh và cấu trúc toPrintDoc + CSS A4 landscape đạt. Đã chụp ảnh minh chứng đối soát SL trên form và bản xem trước in A4 ngang với dữ liệu mẫu cô lập.',
    status: 'Chờ nghiệm thu',
    evidence: {
      after: [
        {
          id: 'ptdm-doi-soat',
          src: ptdmDoiSoatImg,
          alt: 'Ảnh sau khi sửa đối soát số lượng lệnh sản xuất trên form Phiếu trộn định mức với dữ liệu mẫu',
          stage: 'Sau khi sửa',
          viewLabel: 'Đối soát SL trên form',
          sourceBadge: 'Ảnh dữ liệu mẫu',
          isSampleData: true,
          caption:
            'Form Sửa phiếu trộn định mức (MixingNormMaterialsTab) gắn nhiều lệnh SX cùng máy, hiển thị dòng trạng thái đối soát «Đủ số lượng theo lệnh sản xuất.» và chi tiết hao hụt / SL quy đổi theo từng dòng lệnh (chụp bằng Orca browser với dữ liệu mẫu cô lập).',
          dimensions: '1440×666',
        },
        {
          id: 'ptdm-in-a4',
          src: ptdmInA4Img,
          alt: 'Ảnh sau khi sửa xem trước bản in A4 ngang của Phiếu tỷ lệ trộn định mức với dữ liệu mẫu',
          stage: 'Sau khi sửa',
          viewLabel: 'Xem trước / in A4 ngang',
          sourceBadge: 'Ảnh dữ liệu mẫu',
          isSampleData: true,
          caption:
            'Bản xem trước / in Phiếu tỷ lệ trộn định mức (MixingNormRatioPrintSheet) bố cục khổ A4 ngang theo CSS @page mixing-norm-ratio-page { size: A4 landscape } (chụp bằng Orca browser với dữ liệu mẫu cô lập).',
          dimensions: '1440×666',
        },
      ],
      note: 'Ảnh chụp bằng Orca browser từ component thật MixingNormMaterialsTab & MixingNormRatioPrintSheet với dữ liệu mẫu cô lập (chưa có ảnh trước khi sửa).',
    },
  },
];

function formatDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function ScreenshotCard({
  image,
  onZoom,
  headerActions,
}: {
  image: EvidenceImage;
  onZoom: () => void;
  headerActions?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${
              image.stage === 'Trước khi sửa'
                ? 'bg-slate-200 text-slate-800'
                : 'bg-emerald-100 text-emerald-900'
            }`}
          >
            {image.stage}
          </span>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              image.isSampleData
                ? 'bg-amber-100 text-amber-900'
                : 'bg-sky-100 text-sky-900'
            }`}
          >
            {image.sourceBadge}
          </span>
          <span className="text-[11px] tabular-nums text-slate-500">{image.dimensions}</span>
        </div>
        <button
          type="button"
          onClick={onZoom}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <ZoomIn className="h-3.5 w-3.5" />
          Phóng to
        </button>
      </div>

      {headerActions ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
          {headerActions}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onZoom}
        aria-label={`Phóng to: ${image.stage}${image.viewLabel ? ` (${image.viewLabel})` : ''}`}
        className="group relative block w-full cursor-zoom-in overflow-hidden bg-white text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-600"
      >
        {failed ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-rose-700">
            <ImageOff className="h-5 w-5" />
            <span>Không tải được ảnh minh họa.</span>
          </div>
        ) : (
          <>
            <img
              src={image.src}
              alt={image.alt}
              loading="lazy"
              onError={() => setFailed(true)}
              className="block h-auto w-full object-contain transition duration-200 group-hover:scale-[1.01]"
            />
            <span className="pointer-events-none absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-slate-900/75 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <ZoomIn className="h-3 w-3" />
              Xem lớn
            </span>
          </>
        )}
      </button>

      <figcaption className="border-t border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
        {image.caption}
      </figcaption>
    </figure>
  );
}

function EntryEvidenceSection({
  entry,
  onOpenLightbox,
}: {
  entry: ReportEntry;
  onOpenLightbox: (images: EvidenceImage[], index: number) => void;
}) {
  const [layout, setLayout] = useState<CompareLayout>('side-by-side');
  const [afterIndex, setAfterIndex] = useState(0);

  const beforeImage = entry.evidence?.before;
  const afterImages = entry.evidence?.after ?? [];

  if (!beforeImage && afterImages.length === 0) {
    return (
      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <ImageOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-700">Tình trạng ảnh: Chưa có ảnh trước / sau</p>
            <p>{entry.missingEvidenceReason || 'Hạng mục này chưa đính kèm ảnh đối chiếu.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const activeAfter = afterImages[afterIndex] ?? afterImages[0];
  const gallery: EvidenceImage[] = [
    ...(beforeImage ? [beforeImage] : []),
    ...afterImages,
  ];

  const openImage = (target: EvidenceImage) => {
    const idx = gallery.findIndex((item) => item.id === target.id);
    onOpenLightbox(gallery, idx >= 0 ? idx : 0);
  };

  return (
    <div className="space-y-3 border-t border-slate-100 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Images className="h-4 w-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">Ảnh trước và sau khi sửa</h2>
        </div>

        <div
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs"
          role="group"
          aria-label="Chế độ xem ảnh đối chiếu"
        >
          <button
            type="button"
            onClick={() => setLayout('side-by-side')}
            aria-pressed={layout === 'side-by-side'}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
              layout === 'side-by-side'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns2 className="h-3.5 w-3.5" />
            Cạnh nhau
          </button>
          <button
            type="button"
            onClick={() => setLayout('stacked')}
            aria-pressed={layout === 'stacked'}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
              layout === 'stacked'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Rows2 className="h-3.5 w-3.5" />
            Xếp dọc
          </button>
        </div>
      </div>

      {entry.evidence?.note ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {entry.evidence.note}
        </p>
      ) : null}

      <div
        className={
          layout === 'side-by-side'
            ? 'grid grid-cols-1 gap-4 lg:grid-cols-2'
            : 'grid grid-cols-1 gap-4'
        }
      >
        {beforeImage ? (
          <ScreenshotCard image={beforeImage} onZoom={() => openImage(beforeImage)} />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-xs text-slate-500">
            Chưa có ảnh trước khi sửa.
          </div>
        )}

        {activeAfter ? (
          <ScreenshotCard
            image={activeAfter}
            onZoom={() => openImage(activeAfter)}
            headerActions={
              afterImages.length > 1 ? (
                <>
                  <span className="text-[11px] font-medium text-slate-500">Màn hình sau:</span>
                  {afterImages.map((img, idx) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setAfterIndex(idx)}
                      aria-pressed={idx === afterIndex}
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold transition ${
                        idx === afterIndex
                          ? 'bg-red-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {img.viewLabel || `Ảnh ${idx + 1}`}
                    </button>
                  ))}
                </>
              ) : undefined
            }
          />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-xs text-slate-500">
            Chưa có ảnh sau khi sửa.
          </div>
        )}
      </div>
    </div>
  );
}

function ImageLightbox({
  images,
  index,
  onSelect,
  onClose,
}: {
  images: EvidenceImage[];
  index: number;
  onSelect: (nextIndex: number) => void;
  onClose: () => void;
}) {
  const [actualSize, setActualSize] = useState(false);
  const current = images[index];

  useEffect(() => {
    setActualSize(false);
  }, [index]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft' && images.length > 1) {
        onSelect((index - 1 + images.length) % images.length);
      } else if (event.key === 'ArrowRight' && images.length > 1) {
        onSelect((index + 1) % images.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, index, onClose, onSelect]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Xem phóng to ${current.stage}`}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-slate-800 bg-slate-900 px-3 py-2.5 text-white sm:px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-md px-2 py-0.5 font-bold ${
              current.stage === 'Trước khi sửa'
                ? 'bg-slate-700 text-slate-100'
                : 'bg-emerald-600 text-white'
            }`}
          >
            {current.stage}
          </span>
          {current.viewLabel ? (
            <span className="font-semibold text-slate-200">{current.viewLabel}</span>
          ) : null}
          <span
            className={`rounded-md px-2 py-0.5 font-semibold ${
              current.isSampleData
                ? 'bg-amber-500/20 text-amber-200'
                : 'bg-sky-500/20 text-sky-200'
            }`}
          >
            {current.sourceBadge}
          </span>
          <span className="tabular-nums text-slate-400">
            {index + 1} / {images.length} · {current.dimensions}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActualSize((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700"
          >
            {actualSize ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
            {actualSize ? 'Vừa khung' : 'Phóng 100%'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng xem ảnh"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
            Đóng
          </button>
        </div>
      </div>

      <div
        className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 items-center justify-center overflow-auto bg-slate-950/70 p-2 sm:p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={current.src}
          alt={current.alt}
          className={
            actualSize
              ? 'block max-w-none rounded-lg bg-white shadow-2xl'
              : 'block max-h-[72vh] max-w-full rounded-lg bg-white object-contain shadow-2xl'
          }
        />
      </div>

      <div
        className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-slate-300 sm:px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="min-w-0 flex-1 leading-relaxed">{current.caption}</p>
        {images.length > 1 ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect((index - 1 + images.length) % images.length)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-semibold text-white hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Ảnh trước
            </button>
            <button
              type="button"
              onClick={() => onSelect((index + 1) % images.length)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-semibold text-white hover:bg-slate-700"
            >
              Ảnh sau
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function BaoCaoCodePanel({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [openEntries, setOpenEntries] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(entries.filter((entry) => entry.defaultOpen).map((entry) => [entry.title, true])),
  );
  const [lightbox, setLightbox] = useState<{ images: EvidenceImage[]; index: number } | null>(null);

  const keyword = query.trim().toLocaleLowerCase('vi');
  const visible = entries.filter(
    (entry) =>
      (!status || entry.status === status) &&
      [entry.title, entry.request, entry.delivery, entry.verification].some((value) =>
        value.toLocaleLowerCase('vi').includes(keyword),
      ),
  );

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <button type="button" onClick={onBack} className="text-sm font-semibold text-red-700 hover:underline">
          ← Quản trị
        </button>
        <h1 className="text-xl font-bold text-slate-900">Báo cáo công việc code</h1>
      </header>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Tìm công việc
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Trạng thái
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">Tất cả</option>
            <option>Chờ nghiệm thu</option>
            <option>Còn việc</option>
          </select>
        </label>
      </div>
      <div className="space-y-3">
        {visible.map((entry) => {
          const hasImages = Boolean(entry.evidence?.before || entry.evidence?.after?.length);
          const isOpen = Boolean(openEntries[entry.title]);
          return (
            <details
              key={entry.title}
              open={isOpen}
              onToggle={(event) => {
                const nextOpen = event.currentTarget.open;
                setOpenEntries((prev) =>
                  Boolean(prev[entry.title]) === nextOpen ? prev : { ...prev, [entry.title]: nextOpen },
                );
              }}
              className="group/card rounded-xl border border-slate-200 bg-white"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm text-slate-700 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/card:rotate-90" />
                <time dateTime={entry.date} className="tabular-nums text-slate-500">
                  {formatDate(entry.date)}
                </time>
                <span className="font-semibold text-slate-900">{entry.title}</span>
                <span className="inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                  {entry.status}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    hasImages
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {hasImages ? (
                    <>
                      <Images className="h-3 w-3" />
                      Có ảnh trước / sau
                    </>
                  ) : (
                    <>
                      <ImageOff className="h-3 w-3" />
                      Chưa có ảnh
                    </>
                  )}
                </span>
              </summary>
              <dl className="grid gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-700 sm:grid-cols-[9rem_1fr]">
                <dt className="font-semibold">Yêu cầu</dt>
                <dd>{entry.request}</dd>
                <dt className="font-semibold">Đã thực hiện</dt>
                <dd>{entry.delivery}</dd>
                <dt className="font-semibold">Kiểm tra và tồn đọng</dt>
                <dd>{entry.verification}</dd>
              </dl>
              <EntryEvidenceSection
                entry={entry}
                onOpenLightbox={(images, index) => setLightbox({ images, index })}
              />
            </details>
          );
        })}
        {visible.length === 0 && (
          <p role="status" className="py-6 text-center text-sm text-slate-600">
            Không tìm thấy công việc.
          </p>
        )}
      </div>

      {lightbox ? (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onSelect={(index) => setLightbox((prev) => (prev ? { ...prev, index } : null))}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </section>
  );
}
