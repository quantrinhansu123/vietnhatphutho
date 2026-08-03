import React from 'react';
import { Icon as IconifyIcon } from '@iconify/react';
import type { IconifyIcon as IconifyIconData } from '@iconify/types';
import gear3d from '@iconify-icons/fluent-emoji/gear';
import barChart3d from '@iconify-icons/fluent-emoji/bar-chart';
import people3d from '@iconify-icons/fluent-emoji/busts-in-silhouette';
import briefcase3d from '@iconify-icons/fluent-emoji/briefcase';
import factory3d from '@iconify-icons/fluent-emoji/factory';
import deliveryTruck3d from '@iconify-icons/fluent-emoji/delivery-truck';
import manager3d from '@iconify-icons/fluent-emoji/man-office-worker';
import shield3d from '@iconify-icons/fluent-emoji/shield';
import worker3d from '@iconify-icons/fluent-emoji/factory-worker';
import warehouse3d from '@iconify-icons/fluent-emoji/package';
import inventory3d from '@iconify-icons/fluent-emoji/card-file-box';
import warehouseSlip3d from '@iconify-icons/fluent-emoji/inbox-tray';
import warehouseHistory3d from '@iconify-icons/fluent-emoji/open-file-folder';
import facility3d from '@iconify-icons/fluent-emoji/office-building';
import reportEntry3d from '@iconify-icons/fluent-emoji/memo';
import reportList3d from '@iconify-icons/fluent-emoji/clipboard';
import {
  FilePlus2, Layers, History, UsersRound, Building2, BriefcaseBusiness, Package, Cpu, Boxes,
  ClipboardList, Factory, LayoutDashboard, FlaskConical, ArrowDownToLine, Scale, Settings,
  CalendarDays, ChevronRight, ChevronLeft, ClipboardCheck, PackageX, BarChart3, Activity, Truck,
  ArrowRight, ArrowDown, ShieldCheck, UserRound, Warehouse
} from 'lucide-react';
import type { AppTab } from '../routes';
import { pathFromTab } from '../routes';
import MachineDowntimeIcon from '../components/icons/MachineDowntimeIcon';

export type MenuCardConfig = {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  icon3d?: IconifyIconData;
  tab: AppTab;
};

export const MAIN_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Cài đặt',
    desc: 'Cấu hình hệ thống và phân quyền xem menu theo phòng ban, vị trí.',
    icon: Settings,
    icon3d: gear3d,
    tab: 'settings'
  },
  {
    title: 'Báo cáo tổng hợp',
    desc: 'Nhân sự, đơn hàng, sản phẩm và danh sách máy trên một màn hình.',
    icon: LayoutDashboard,
    icon3d: barChart3d,
    tab: 'control-board'
  },
  {
    title: 'HCNS',
    desc: 'Quản lý nhân sự, chi nhánh, bộ phận và ca làm việc.',
    icon: UsersRound,
    icon3d: people3d,
    tab: 'hcns'
  },
  {
    title: 'Kinh doanh',
    desc: 'Danh sách khách hàng phục vụ lập và tra cứu đơn.',
    icon: BriefcaseBusiness,
    icon3d: briefcase3d,
    tab: 'business'
  },
  {
    title: 'Nhà máy',
    desc: 'Báo cáo sản xuất, CSVC, lệnh và kế hoạch sản xuất.',
    icon: Factory,
    icon3d: factory3d,
    tab: 'factory'
  },
  {
    title: 'Vận chuyển',
    desc: 'Quản lý xe, chi phí, nhật ký, đối chiếu lái xe và quy chế.',
    icon: Truck,
    icon3d: deliveryTruck3d,
    tab: 'vehicles'
  }
];

export function MenuPageHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
      <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{desc}</p>
    </div>
  );
}

export const REPORT_FORM_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Báo cáo tồn',
    desc: 'Theo dõi NVL tồn theo từng máy và ca sản xuất.',
    icon: Boxes,
    tab: 'machine-nvl-report'
  },
  {
    title: 'Trộn nguyên vật liệu',
    desc: 'Nhập bảng trộn vật tư theo ca, máy và lần phối trộn.',
    icon: FlaskConical,
    tab: 'mixing-report'
  },
  {
    title: 'Phiếu cân',
    desc: 'Lập phiếu cân, ghi nhận khối lượng và xem tổng hợp theo ca.',
    icon: Scale,
    tab: 'weighing-summary'
  },
  {
    title: 'Phiếu báo dừng máy',
    desc: 'Ghi nhận thời gian dừng, lý do và số cuộn ảnh hưởng theo ca.',
    icon: MachineDowntimeIcon,
    tab: 'machine-downtime-report'
  },
  {
    title: 'Nhật ký chạy máy',
    desc: 'Thợ chính ghi mỗi 2 giờ: tốc độ, nhiệt độ, cuộn ra và hiệu suất ca.',
    icon: Activity,
    tab: 'machine-run-log'
  },
  {
    title: 'Báo cáo hàng hỏng',
    desc: 'Lập phiếu hàng hỏng với các cột và chức năng giống phiếu cân ca.',
    icon: PackageX,
    tab: 'damaged-goods-report'
  },
  {
    title: 'Báo cáo sản lượng',
    desc: 'Ghi nhận mặt hàng, số lượng và ảnh sản lượng theo ca.',
    icon: ClipboardCheck,
    tab: 'acceptance-report'
  },
  {
    title: 'Báo cáo kiểm kho',
    desc: 'Quét mã SP bằng máy BT-A700 / camera và lưu vào bảng kiểm kho.',
    icon: ClipboardList,
    tab: 'kiem-kho'
  }
];

export const PRODUCTION_REPORT_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Nhập báo cáo',
    desc: 'Mở các phiếu nhập báo cáo theo ca sản xuất.',
    icon: FilePlus2,
    icon3d: reportEntry3d,
    tab: 'report-forms'
  },
  {
    title: 'Xem báo cáo',
    desc: 'Mở danh sách phiếu cân, phối trộn và báo cáo sản lượng đã lưu.',
    icon: ClipboardList,
    tab: 'report-lists'
  }
];

export const FACILITY_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Kho NVL',
    desc: 'Quản lý nguyên phụ liệu, trọng lượng, khổ cuộn và tồn nhập xuất.',
    icon: Boxes,
    icon3d: inventory3d,
    tab: 'materials'
  },
  {
    title: 'Sản phẩm',
    desc: 'Xem danh mục mã hàng, nhóm VTHH, đơn vị và tồn kho.',
    icon: Package,
    tab: 'products'
  },
  {
    title: 'Danh sách máy',
    desc: 'Quản lý danh sách máy móc, tình trạng và thông tin vận hành.',
    icon: Cpu,
    tab: 'machines'
  },
  {
    title: 'Lệnh sản xuất',
    desc: 'Xem danh sách lệnh SX, mã hàng, trạng thái và kế hoạch sản xuất.',
    icon: Factory,
    tab: 'production-orders'
  },
  {
    title: 'Phiếu xuất nhập kho',
    desc: 'Lập phiếu nhập hoặc xuất NVL theo từng mã NPL.',
    icon: ArrowDownToLine,
    icon3d: warehouseSlip3d,
    tab: 'warehouse-slip'
  },
  {
    title: 'Lịch sử xuất nhập kho',
    desc: 'Tra cứu phiếu đã lưu, lọc theo loại và ngày.',
    icon: History,
    tab: 'warehouse-history'
  },
  {
    title: 'Quản lý kho',
    desc: 'Danh mục kho: tên kho, vị trí, tên vị trí và người phụ trách.',
    icon: Warehouse,
    tab: 'quan-ly-kho'
  }
];

export const REPORT_LIST_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Danh sách báo cáo tồn',
    desc: 'Xem báo cáo NVL tồn theo từng máy và ca sản xuất.',
    icon: Boxes,
    tab: 'machine-nvl-report-list'
  },
  {
    title: 'Danh sách trộn nguyên vật liệu',
    desc: 'Lấy danh sách báo cáo phối trộn đã lưu theo ngày, ca và máy.',
    icon: Layers,
    tab: 'mixing-report-list'
  },
  {
    title: 'Phiếu cân ca',
    desc: 'Xem danh sách phiếu cân và cộng dồn theo ca.',
    icon: History,
    tab: 'weighing-summary-list'
  },
  {
    title: 'Cân tự động',
    desc: 'Xem dữ liệu cân tự động (can_tu_dong); bấm ảnh để mở modal.',
    icon: Scale,
    tab: 'can-tu-dong'
  },
  {
    title: 'Báo cáo kiểm kho',
    desc: 'Nhập và xem các dòng kiểm kho đã quét mã SP.',
    icon: ClipboardList,
    tab: 'kiem-kho'
  },
  {
    title: 'Danh sách báo cáo hàng hỏng',
    desc: 'Xem, sửa và in các phiếu hàng hỏng đã lưu theo ngày, ca và máy.',
    icon: PackageX,
    tab: 'damaged-goods-report-list'
  },
  {
    title: 'Danh sách báo cáo sản lượng',
    desc: 'Xem, sửa và in các phiếu báo cáo sản lượng đã lưu.',
    icon: ClipboardList,
    tab: 'acceptance-report-list'
  },
  {
    title: 'Danh sách phiếu nhập kho thành phẩm',
    desc: 'Tra cứu các phiếu nhập kho thành phẩm đã lưu.',
    icon: ArrowDownToLine,
    tab: 'warehouse-history'
  },
  {
    title: 'Danh sách báo cáo dừng máy',
    desc: 'Xem các phiếu báo dừng máy đã lưu và lịch sử gần nhất.',
    icon: MachineDowntimeIcon,
    tab: 'machine-downtime-list'
  },
  {
    title: 'Danh sách nhật ký chạy máy',
    desc: 'Xem các nhật ký chạy máy BM-SX-11 đã lưu và in lại.',
    icon: Activity,
    tab: 'machine-run-log-list'
  }
];

export const HCNS_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Nhân sự',
    desc: 'Quản lý danh sách nhân viên, chi nhánh, bộ phận và ca làm việc.',
    icon: UsersRound,
    tab: 'hr'
  }
];

export const BUSINESS_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Đơn hàng',
    desc: 'Theo dõi mã đơn, khách hàng, mã hàng và lệnh sản xuất.',
    icon: ClipboardList,
    tab: 'orders'
  },
  {
    title: 'Khách hàng',
    desc: 'Xem danh sách khách hàng phục vụ lập và tra cứu đơn hàng.',
    icon: BriefcaseBusiness,
    tab: 'customers'
  },
  {
    title: 'Lệnh xuất hàng',
    desc: 'Tạo lệnh xuất hàng cho khách hàng, chọn khách từ danh mục.',
    icon: Truck,
    tab: 'shipping-orders'
  }
];

export const FACTORY_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Quản Đốc',
    desc: 'Theo dõi lệnh SX, kế hoạch và báo cáo tổng hợp nhà máy.',
    icon: BriefcaseBusiness,
    icon3d: manager3d,
    tab: 'factory-quan-doc'
  },
  {
    title: 'QC',
    desc: 'Quản lý chất lượng: sản lượng, hàng hỏng và phiếu cân ca.',
    icon: ShieldCheck,
    icon3d: shield3d,
    tab: 'factory-qc'
  },
  {
    title: 'Công nhân',
    desc: 'Nhập và xem báo cáo sản xuất theo ca làm việc.',
    icon: UserRound,
    icon3d: worker3d,
    tab: 'factory-cong-nhan'
  },
  {
    title: 'Kho',
    desc: 'Kho NVL, phiếu xuất nhập và lịch sử xuất nhập kho.',
    icon: Warehouse,
    icon3d: warehouse3d,
    tab: 'factory-kho'
  },
  {
    title: 'Quản lý CSVC',
    desc: 'Kho NVL, sản phẩm, máy móc và phiếu xuất nhập kho.',
    icon: Building2,
    icon3d: facility3d,
    tab: 'facility-management'
  }
];

export const FACTORY_QUAN_DOC_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Báo cáo tổng hợp',
    desc: 'Nhân sự, đơn hàng, sản phẩm và danh sách máy trên một màn hình.',
    icon: LayoutDashboard,
    tab: 'control-board'
  },
  {
    title: 'Lệnh sản xuất',
    desc: 'Xem danh sách lệnh SX, mã hàng, trạng thái và kế hoạch sản xuất.',
    icon: Factory,
    tab: 'production-orders'
  },
  {
    title: 'Kế hoạch sản xuất',
    desc: 'Tra cứu snapshot kế hoạch sản xuất đã lưu, lọc theo ngày hoặc khoảng thời gian.',
    icon: CalendarDays,
    tab: 'production-plan-history'
  },
  {
    title: 'Báo cáo sản xuất',
    desc: 'Phiếu cân ca, phối trộn, sản lượng và các báo cáo theo ca.',
    icon: BarChart3,
    tab: 'production-reports'
  }
];

export const FACTORY_QC_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Danh sách báo cáo sản lượng',
    desc: 'Xem, sửa và in các phiếu báo cáo sản lượng đã lưu.',
    icon: ClipboardList,
    tab: 'acceptance-report-list'
  },
  {
    title: 'Danh sách báo cáo hàng hỏng',
    desc: 'Xem, sửa và in các phiếu hàng hỏng đã lưu theo ngày, ca và máy.',
    icon: PackageX,
    tab: 'damaged-goods-report-list'
  },
  {
    title: 'Phiếu cân ca',
    desc: 'Xem danh sách phiếu cân và cộng dồn theo ca.',
    icon: History,
    tab: 'weighing-summary-list'
  },
  {
    title: 'Cân tự động',
    desc: 'Xem dữ liệu cân tự động (can_tu_dong); bấm ảnh để mở modal.',
    icon: Scale,
    tab: 'can-tu-dong'
  },
  {
    title: 'Báo cáo kiểm kho',
    desc: 'Quét mã SP bằng máy BT-A700 và lưu kiểm kho.',
    icon: ClipboardList,
    tab: 'kiem-kho'
  },
  {
    title: 'Báo cáo tổng hợp',
    desc: 'Đối chiếu chất lượng theo lệnh SX và ca sản xuất.',
    icon: LayoutDashboard,
    tab: 'control-board'
  }
];

export const FACTORY_CONG_NHAN_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Nhập báo cáo',
    desc: 'Mở các phiếu nhập báo cáo theo ca sản xuất.',
    icon: FilePlus2,
    tab: 'report-forms'
  },
  {
    title: 'Xem báo cáo',
    desc: 'Mở danh sách phiếu cân, phối trộn và báo cáo sản lượng đã lưu.',
    icon: ClipboardList,
    icon3d: reportList3d,
    tab: 'report-lists'
  },
  {
    title: 'Lệnh sản xuất',
    desc: 'Xem danh sách lệnh SX phục vụ ca làm việc.',
    icon: Factory,
    icon3d: factory3d,
    tab: 'production-orders'
  }
];

export const FACTORY_KHO_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Quản lý kho',
    desc: 'Danh mục kho: tên kho, vị trí, tên vị trí và người phụ trách.',
    icon: Warehouse,
    tab: 'quan-ly-kho'
  },
  {
    title: 'Kho NVL',
    desc: 'Quản lý nguyên phụ liệu, trọng lượng, khổ cuộn và tồn nhập xuất.',
    icon: Boxes,
    icon3d: inventory3d,
    tab: 'materials'
  },
  {
    title: 'Kho SP',
    desc: 'Danh mục sản phẩm, mã hàng, đơn vị và tồn kho.',
    icon: Package,
    tab: 'products'
  },
  {
    title: 'Phiếu xuất nhập kho',
    desc: 'Lập phiếu nhập hoặc xuất NVL theo từng mã NPL.',
    icon: ArrowDownToLine,
    icon3d: warehouseSlip3d,
    tab: 'warehouse-slip'
  },
  {
    title: 'Lịch sử xuất nhập kho',
    desc: 'Tra cứu phiếu đã lưu, lọc theo loại và ngày.',
    icon: History,
    icon3d: warehouseHistory3d,
    tab: 'warehouse-history'
  },
  {
    title: 'Báo cáo kiểm kho',
    desc: 'Quét mã SP bằng máy BT-A700 / camera và lưu kiểm kho.',
    icon: ClipboardList,
    tab: 'kiem-kho'
  }
];

export function MenuCardGrid({
  items,
  onNavigate
}: {
  items: MenuCardConfig[];
  onNavigate: (tab: AppTab) => void;
}) {
  return (
    <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            type="button"
            onClick={() => onNavigate(item.tab)}
            className="group relative min-h-[80px] overflow-hidden rounded-xl bg-white border border-slate-200 p-3.5 md:p-4 text-left transition hover:border-brand-200 hover:shadow-elevated active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-brand-500/25"
          >
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition ${
                item.icon3d
                  ? 'bg-gradient-to-br from-white to-slate-100 shadow-sm ring-1 ring-slate-200/70 group-hover:scale-110'
                  : 'bg-brand-50 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'
              }`}>
                {item.icon3d ? (
                  <IconifyIcon icon={item.icon3d} className="h-8 w-8 drop-shadow-sm" />
                ) : (
                  <Icon className="h-[18px] w-[18px]" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold tracking-tight text-[13.5px] text-slate-900">{item.title}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500 line-clamp-2">{item.desc}</span>
              </span>
              <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-brand-500 group-hover:translate-x-0.5" />
            </div>
          </button>
        );
      })}
    </section>
  );
}

function MainMenuFlowCard({
  item,
  step,
  showStep = true,
  largeIcon = false,
  onNavigate
}: {
  item: MenuCardConfig;
  step: number;
  showStep?: boolean;
  largeIcon?: boolean;
  onNavigate: (tab: AppTab) => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.tab)}
      className="group relative z-10 min-h-[112px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-elevated active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-brand-500/25"
    >
      {showStep && (
        <span className="absolute right-4 top-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300 transition group-hover:text-brand-400">
          Bước {String(step).padStart(2, '0')}
        </span>
      )}
      <span className={`flex items-start ${largeIcon ? 'gap-4' : 'gap-3.5'} pt-2`}>
        <span className={`flex shrink-0 items-center justify-center transition ${
          largeIcon ? 'h-16 w-16 rounded-2xl' : 'h-11 w-11 rounded-xl'
        } ${
          item.icon3d
            ? 'bg-gradient-to-br from-white via-slate-50 to-slate-100 shadow-md ring-1 ring-slate-200/80 group-hover:scale-105'
            : 'bg-brand-50 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'
        }`}>
          {item.icon3d ? (
            <IconifyIcon
              icon={item.icon3d}
              className={largeIcon ? 'h-[52px] w-[52px] drop-shadow-md' : 'h-9 w-9 drop-shadow-sm'}
            />
          ) : (
            <Icon className={largeIcon ? 'h-8 w-8' : 'h-5 w-5'} strokeWidth={largeIcon ? 1.8 : 2} />
          )}
        </span>
        <span className="min-w-0 flex-1 pr-2">
          <span className="block font-display text-[14px] font-semibold tracking-tight text-slate-900">
            {item.title}
          </span>
          <span className="mt-1 block text-[11.5px] leading-snug text-slate-500 line-clamp-2">
            {item.desc}
          </span>
        </span>
        <ChevronRight className="mt-7 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
      </span>
    </button>
  );
}

function FlowArrow({ direction }: { direction: 'right' | 'left' | 'down' }) {
  if (direction === 'down') {
    return (
      <div className="flex items-center justify-center text-brand-400" aria-hidden="true">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 ring-4 ring-slate-50">
          <ArrowDown className="h-4 w-4" strokeWidth={2.5} />
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center text-brand-400" aria-hidden="true">
      <span className="h-px flex-1 bg-brand-200" />
      <ArrowRight
        className={`h-5 w-5 shrink-0 ${direction === 'left' ? 'rotate-180' : ''}`}
        strokeWidth={2.5}
      />
      <span className="h-px flex-1 bg-brand-200" />
    </div>
  );
}

export function MainMenuFlow({
  items,
  onNavigate
}: {
  items: MenuCardConfig[];
  onNavigate: (tab: AppTab) => void;
}) {
  if (items.length !== 6 && items.length !== 9) {
    return <MenuCardGrid items={items} onNavigate={onNavigate} />;
  }

  const isTwoRowFlow = items.length === 6;

  return (
    <>
      <div className="lg:hidden">
        <MenuCardGrid items={items} onNavigate={onNavigate} />
      </div>

      <section
        className={`relative hidden grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)_44px_minmax(0,1fr)] ${
          isTwoRowFlow ? 'grid-rows-[auto_40px_auto]' : 'grid-rows-[auto_40px_auto_40px_auto]'
        } lg:grid`}
        aria-label="Lưu đồ chức năng"
      >
        <div className="col-start-1 row-start-1"><MainMenuFlowCard item={items[0]} step={1} showStep={false} largeIcon onNavigate={onNavigate} /></div>
        <div className="col-start-2 row-start-1"><FlowArrow direction="right" /></div>
        <div className="col-start-3 row-start-1"><MainMenuFlowCard item={items[1]} step={2} showStep={false} largeIcon onNavigate={onNavigate} /></div>
        <div className="col-start-4 row-start-1"><FlowArrow direction="right" /></div>
        <div className="col-start-5 row-start-1"><MainMenuFlowCard item={items[2]} step={3} showStep={false} largeIcon onNavigate={onNavigate} /></div>

        <div className="col-start-5 row-start-2"><FlowArrow direction="down" /></div>

        <div className="col-start-1 row-start-3"><MainMenuFlowCard item={items[5]} step={6} showStep={false} largeIcon onNavigate={onNavigate} /></div>
        <div className="col-start-2 row-start-3"><FlowArrow direction="left" /></div>
        <div className="col-start-3 row-start-3"><MainMenuFlowCard item={items[4]} step={5} showStep={false} largeIcon onNavigate={onNavigate} /></div>
        <div className="col-start-4 row-start-3"><FlowArrow direction="left" /></div>
        <div className="col-start-5 row-start-3"><MainMenuFlowCard item={items[3]} step={4} showStep={false} largeIcon onNavigate={onNavigate} /></div>

        {!isTwoRowFlow && (
          <>
            <div className="col-start-1 row-start-4"><FlowArrow direction="down" /></div>
            <div className="col-start-1 row-start-5"><MainMenuFlowCard item={items[6]} step={7} showStep={false} largeIcon onNavigate={onNavigate} /></div>
            <div className="col-start-2 row-start-5"><FlowArrow direction="right" /></div>
            <div className="col-start-3 row-start-5"><MainMenuFlowCard item={items[7]} step={8} showStep={false} largeIcon onNavigate={onNavigate} /></div>
            <div className="col-start-4 row-start-5"><FlowArrow direction="right" /></div>
            <div className="col-start-5 row-start-5"><MainMenuFlowCard item={items[8]} step={9} showStep={false} largeIcon onNavigate={onNavigate} /></div>
          </>
        )}
      </section>
    </>
  );
}

export function FourStepMenuFlow({
  items,
  onNavigate
}: {
  items: MenuCardConfig[];
  onNavigate: (tab: AppTab) => void;
}) {
  if (items.length !== 4) {
    return <MenuCardGrid items={items} onNavigate={onNavigate} />;
  }

  return (
    <>
      <div className="lg:hidden">
        <MenuCardGrid items={items} onNavigate={onNavigate} />
      </div>
      <section
        className="relative hidden grid-cols-[minmax(0,1fr)_38px_minmax(0,1fr)_38px_minmax(0,1fr)_38px_minmax(0,1fr)] lg:grid"
        aria-label="Lưu đồ chức năng nhà máy"
      >
        {items.map((item, index) => (
          <React.Fragment key={item.tab}>
            <div style={{ gridColumnStart: index * 2 + 1 }}>
              <MainMenuFlowCard item={item} step={index + 1} onNavigate={onNavigate} />
            </div>
            {index < items.length - 1 && (
              <div style={{ gridColumnStart: index * 2 + 2 }}>
                <FlowArrow direction="right" />
              </div>
            )}
          </React.Fragment>
        ))}
      </section>
    </>
  );
}

export const PRIMARY_NAV_GROUPS: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tab: AppTab;
  children: { label: string; tab: AppTab }[];
}[] = [
  {
    title: 'Sản xuất',
    icon: Factory,
    tab: 'production-reports',
    children: [
      { label: 'Báo cáo tổng hợp', tab: 'control-board' },
      { label: 'Nhập báo cáo', tab: 'report-forms' },
      { label: 'Xem báo cáo', tab: 'report-lists' },
      { label: 'Tổng hợp cân ca', tab: 'weighing-summary' },
      { label: 'Kế hoạch SX', tab: 'production-plan-history' }
    ]
  },
  {
    title: 'CSVC & Kho',
    icon: Building2,
    tab: 'facility-management',
    children: [
      { label: 'Kho NVL', tab: 'materials' },
      { label: 'Sản phẩm', tab: 'products' },
      { label: 'Báo cáo tồn máy', tab: 'machine-nvl-report-list' },
      { label: 'Phiếu xuất nhập', tab: 'warehouse-slip' },
      { label: 'Lịch sử XNK', tab: 'warehouse-history' }
    ]
  },
  {
    title: 'HCNS',
    icon: UsersRound,
    tab: 'hcns',
    children: [{ label: 'Nhân sự', tab: 'hr' }]
  },
  {
    title: 'Kinh doanh',
    icon: BriefcaseBusiness,
    tab: 'business',
    children: [
      { label: 'Khách hàng', tab: 'customers' },
      { label: 'Lệnh xuất hàng', tab: 'shipping-orders' }
    ]
  },
  {
    title: 'Đơn hàng',
    icon: ClipboardList,
    tab: 'orders',
    children: []
  },
  {
    title: 'Nhà máy',
    icon: ClipboardList,
    tab: 'factory',
    children: [
      { label: 'Quản Đốc', tab: 'factory-quan-doc' },
      { label: 'QC', tab: 'factory-qc' },
      { label: 'Công nhân', tab: 'factory-cong-nhan' },
      { label: 'Kho', tab: 'factory-kho' },
      { label: 'Quản lý CSVC', tab: 'facility-management' }
    ]
  },
  {
    title: 'Phân tích',
    icon: BarChart3,
    tab: 'dashboard',
    children: []
  },
  {
    title: 'Cài đặt',
    icon: Settings,
    tab: 'settings',
    children: [{ label: 'Phân quyền & tham số', tab: 'settings' }]
  }
];

export const TAB_TITLE_MAP: Record<string, { group: string; sub: string }> = {
  'menu': { group: 'Trang chủ', sub: 'Chọn chức năng' },
  'control-board': { group: 'Sản xuất', sub: 'Báo cáo tổng hợp' },
  'report-forms': { group: 'Sản xuất', sub: 'Nhập báo cáo' },
  'form': { group: 'Sản xuất', sub: 'Nhập báo cáo' },
  'report-lists': { group: 'Sản xuất', sub: 'Xem báo cáo' },
  'acceptance-report-list': { group: 'Sản xuất', sub: 'DS phiếu nghiệm thu' },
  'weighing-summary': { group: 'Sản xuất', sub: 'Bảng báo cáo Cân' },
  'weighing-summary-list': { group: 'Sản xuất', sub: 'DS phiếu cân' },
  'can-tu-dong': { group: 'Sản xuất', sub: 'Cân tự động' },
  'kiem-kho': { group: 'Sản xuất', sub: 'Báo cáo kiểm kho' },
  'quan-ly-kho': { group: 'Nhà máy', sub: 'Quản lý kho' },
  'damaged-goods-report': { group: 'Sản xuất', sub: 'Báo cáo hàng hư' },
  'damaged-goods-report-list': { group: 'Sản xuất', sub: 'DS báo cáo hàng hư' },
  'mixing-report': { group: 'Sản xuất', sub: 'Báo cáo trộn' },
  'mixing-report-list': { group: 'Sản xuất', sub: 'DS phiếu trộn' },
  'machine-nvl-report': { group: 'Sản xuất', sub: 'Báo cáo máy-NVL' },
  'machine-nvl-report-list': { group: 'Nhà máy', sub: 'Báo cáo tồn máy' },
  'acceptance-report': { group: 'Sản xuất', sub: 'Phiếu nghiệm thu' },
  'machine-downtime-report': { group: 'Sản xuất', sub: 'Báo cáo máy dừng' },
  'machine-downtime-list': { group: 'Sản xuất', sub: 'DS máy dừng' },
  'machine-run-log': { group: 'Sản xuất', sub: 'Nhật ký chạy máy' },
  'machine-run-log-list': { group: 'Sản xuất', sub: 'DS nhật ký chạy máy' },
  'production-plan-history': { group: 'Sản xuất', sub: 'Kế hoạch SX' },
  'facility-management': { group: 'Nhà máy', sub: 'Quản lý CSVC' },
  'factory': { group: 'Nhà máy', sub: 'Chọn vai trò' },
  'materials': { group: 'Nhà máy', sub: 'Kho NVL' },
  'materials-inventory': { group: 'Nhà máy', sub: 'Kho NVL' },
  'products': { group: 'Nhà máy', sub: 'Kho SP' },
  'machines': { group: 'Nhà máy', sub: 'Danh sách máy' },
  'warehouse-slip': { group: 'Nhà máy', sub: 'Phiếu xuất nhập kho' },
  'warehouse-history': { group: 'Nhà máy', sub: 'Lịch sử XNK' },
  'settings': { group: 'Cài đặt', sub: 'Phân quyền & tham số' },
  'hr': { group: 'HCNS', sub: 'Nhân sự' },
  'vehicles': { group: 'Trang chủ', sub: 'Vận chuyển' },
  'orders': { group: 'Đơn hàng', sub: 'Quản lý đơn' },
  'customers': { group: 'Kinh doanh', sub: 'Khách hàng' },
  'shipping-orders': { group: 'Kinh doanh', sub: 'Lệnh xuất hàng' },
  'production-orders': { group: 'Nhà máy', sub: 'Lệnh sản xuất' },
  'factory-quan-doc': { group: 'Nhà máy', sub: 'Quản Đốc' },
  'factory-qc': { group: 'Nhà máy', sub: 'QC' },
  'factory-cong-nhan': { group: 'Nhà máy', sub: 'Công nhân' },
  'factory-kho': { group: 'Nhà máy', sub: 'Kho' },
  'dashboard': { group: 'Phân tích', sub: 'Dashboard' }
};

export function getActivePageMeta(tab: AppTab): { group: string; sub: string } {
  if (TAB_TITLE_MAP[tab]) return TAB_TITLE_MAP[tab];
  for (const group of PRIMARY_NAV_GROUPS) {
    if (group.tab === tab) return { group: group.title, sub: '' };
    const child = group.children.find(c => c.tab === tab);
    if (child) return { group: group.title, sub: child.label };
  }
  return { group: 'Trang chủ', sub: '' };
}

export function SubNav({
  activeTab,
  onNavigate,
  allowedTabs,
  fullAccess = true
}: {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  allowedTabs?: Set<string>;
  fullAccess?: boolean;
}) {
  const canSee = (tab: AppTab) => tab === 'settings' || fullAccess || (allowedTabs?.has(tab) ?? false);
  const visibleGroups = PRIMARY_NAV_GROUPS
    .map(group => ({
      ...group,
      children: group.children.filter(child => canSee(child.tab))
    }))
    .filter(group => canSee(group.tab) || group.children.length > 0);

  return (
    <nav className="rounded-xl bg-white border border-slate-100 p-2">
      <ul className="flex flex-col gap-0.5">
        {visibleGroups.map(group => {
          const Icon = group.icon;
          const isActiveGroup = activeTab === group.tab || group.children.some(c => c.tab === activeTab);
          const isExact = activeTab === group.tab;
          return (
            <li key={group.title}>
              <button
                type="button"
                onClick={() => onNavigate(group.tab)}
                className={`relative flex w-full items-center gap-2 rounded-lg pl-3 pr-2.5 py-2 text-left text-sm font-semibold transition ${
                  isExact
                    ? 'bg-slate-100 text-slate-900 font-bold'
                    : isActiveGroup
                    ? 'bg-slate-50 text-slate-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {isExact && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-500" aria-hidden />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1 truncate font-display font-semibold tracking-tight">{group.title}</span>
              </button>
              {isActiveGroup && group.children.length > 0 && (
                <ul className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l-2 border-slate-200 pl-2">
                  {group.children.map(child => (
                    <li key={child.tab}>
                      <button
                        type="button"
                        onClick={() => onNavigate(child.tab)}
                        className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold transition ${
                          activeTab === child.tab
                            ? 'bg-brand-50 text-brand-700 font-bold'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-brand-600'
                        }`}
                      >
                        {child.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
