import React from 'react';
import {
  FilePlus2, Layers, History, UsersRound, Building2, BriefcaseBusiness, Package, Cpu, Boxes,
  ClipboardList, Settings, Factory, LayoutDashboard, FlaskConical, ArrowDownToLine, Scale,
  CalendarDays, ChevronRight, ChevronLeft, ClipboardCheck, PackageX, BarChart3
} from 'lucide-react';
import type { AppTab } from '../routes';
import { pathFromTab } from '../routes';
import MachineDowntimeIcon from '../components/icons/MachineDowntimeIcon';

export type MenuCardConfig = {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tab: AppTab;
};

export const MAIN_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Bảng điều khiển',
    desc: 'Nhân sự, đơn hàng, sản phẩm và danh sách máy trên một màn hình.',
    icon: LayoutDashboard,
    tab: 'control-board'
  },
  {
    title: 'Báo cáo sản xuất',
    desc: 'Phiếu cân ca, phối trộn, sản lượng và các báo cáo theo ca.',
    icon: Factory,
    tab: 'production-reports'
  },
  {
    title: 'HCNS',
    desc: 'Nhân sự và các tham số cài đặt vận hành hệ thống.',
    icon: UsersRound,
    tab: 'hcns'
  },
  {
    title: 'Kinh doanh',
    desc: 'Danh sách khách hàng phục vụ lập và tra cứu đơn.',
    icon: BriefcaseBusiness,
    tab: 'business'
  },
  {
    title: 'Đơn hàng',
    desc: 'Theo dõi mã đơn, khách hàng, mã hàng và lệnh sản xuất.',
    icon: ClipboardList,
    tab: 'orders'
  },
  {
    title: 'Nhà máy',
    desc: 'Theo dõi lệnh sản xuất và kế hoạch sản xuất.',
    icon: Factory,
    tab: 'factory'
  },
  {
    title: 'Quản lý CSVC',
    desc: 'Kho NVL, sản phẩm, máy móc và phiếu xuất nhập kho.',
    icon: Building2,
    tab: 'facility-management'
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
  }
];

export const PRODUCTION_REPORT_MENU_ITEMS: MenuCardConfig[] = [
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
    tab: 'report-lists'
  }
];

export const FACILITY_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Kho NVL',
    desc: 'Quản lý nguyên phụ liệu, trọng lượng, khổ cuộn và tồn nhập xuất.',
    icon: Boxes,
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
    tab: 'warehouse-slip'
  },
  {
    title: 'Lịch sử xuất nhập kho',
    desc: 'Tra cứu phiếu đã lưu, lọc theo loại và ngày.',
    icon: History,
    tab: 'warehouse-history'
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
  }
];

export const HCNS_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Nhân sự',
    desc: 'Quản lý danh sách nhân viên, chi nhánh, bộ phận và ca làm việc.',
    icon: UsersRound,
    tab: 'hr'
  },
  {
    title: 'Cài đặt',
    desc: 'Xem tham số cấu hình và giá trị mặc định của hệ thống.',
    icon: Settings,
    tab: 'settings'
  }
];

export const BUSINESS_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Khách hàng',
    desc: 'Xem danh sách khách hàng phục vụ lập và tra cứu đơn hàng.',
    icon: BriefcaseBusiness,
    tab: 'customers'
  }
];

export const FACTORY_MENU_ITEMS: MenuCardConfig[] = [
  {
    title: 'Lệnh sản xuất',
    desc: 'Xem danh sách lệnh SX, mã hàng, trạng thái và kế hoạch sản xuất.',
    icon: Factory,
    tab: 'production-orders'
  },
  {
    title: 'Kế hoạch SX theo ngày',
    desc: 'Tra cứu snapshot kế hoạch sản xuất đã lưu, lọc theo ngày hoặc khoảng thời gian.',
    icon: CalendarDays,
    tab: 'production-plan-history'
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
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white">
                <Icon className="h-[18px] w-[18px]" />
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
      { label: 'Bảng điều khiển', tab: 'control-board' },
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
    children: [
      { label: 'Nhân sự', tab: 'hr' },
      { label: 'Cài đặt', tab: 'settings' }
    ]
  },
  {
    title: 'Kinh doanh',
    icon: BriefcaseBusiness,
    tab: 'business',
    children: [{ label: 'Khách hàng', tab: 'customers' }]
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
      { label: 'Lệnh sản xuất', tab: 'production-orders' },
      { label: 'Kế hoạch SX', tab: 'production-plan-history' }
    ]
  },
  {
    title: 'Phân tích',
    icon: BarChart3,
    tab: 'dashboard',
    children: []
  }
];

export const TAB_TITLE_MAP: Record<string, { group: string; sub: string }> = {
  'menu': { group: 'Trang chủ', sub: 'Chọn chức năng' },
  'control-board': { group: 'Sản xuất', sub: 'Bảng điều khiển' },
  'report-forms': { group: 'Sản xuất', sub: 'Nhập báo cáo' },
  'form': { group: 'Sản xuất', sub: 'Nhập báo cáo' },
  'report-lists': { group: 'Sản xuất', sub: 'Xem báo cáo' },
  'acceptance-report-list': { group: 'Sản xuất', sub: 'DS phiếu nghiệm thu' },
  'weighing-summary': { group: 'Sản xuất', sub: 'Bảng báo cáo Cân' },
  'weighing-summary-list': { group: 'Sản xuất', sub: 'DS phiếu cân' },
  'damaged-goods-report': { group: 'Sản xuất', sub: 'Báo cáo hàng hư' },
  'damaged-goods-report-list': { group: 'Sản xuất', sub: 'DS báo cáo hàng hư' },
  'mixing-report': { group: 'Sản xuất', sub: 'Báo cáo trộn' },
  'mixing-report-list': { group: 'Sản xuất', sub: 'DS phiếu trộn' },
  'machine-nvl-report': { group: 'Sản xuất', sub: 'Báo cáo máy-NVL' },
  'machine-nvl-report-list': { group: 'CSVC & Kho', sub: 'Báo cáo tồn máy' },
  'acceptance-report': { group: 'Sản xuất', sub: 'Phiếu nghiệm thu' },
  'machine-downtime-report': { group: 'Sản xuất', sub: 'Báo cáo máy dừng' },
  'machine-downtime-list': { group: 'Sản xuất', sub: 'DS máy dừng' },
  'production-plan-history': { group: 'Sản xuất', sub: 'Kế hoạch SX' },
  'materials': { group: 'CSVC & Kho', sub: 'Kho NVL' },
  'materials-inventory': { group: 'CSVC & Kho', sub: 'Kho NVL' },
  'products': { group: 'CSVC & Kho', sub: 'Sản phẩm' },
  'machines': { group: 'CSVC & Kho', sub: 'Danh sách máy' },
  'warehouse-slip': { group: 'CSVC & Kho', sub: 'Phiếu xuất nhập kho' },
  'warehouse-history': { group: 'CSVC & Kho', sub: 'Lịch sử XNK' },
  'settings': { group: 'HCNS', sub: 'Cài đặt' },
  'hr': { group: 'HCNS', sub: 'Nhân sự' },
  'orders': { group: 'Đơn hàng', sub: 'Quản lý đơn' },
  'customers': { group: 'Kinh doanh', sub: 'Khách hàng' },
  'production-orders': { group: 'Nhà máy', sub: 'Lệnh sản xuất' },
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
  const canSee = (tab: AppTab) => fullAccess || (allowedTabs?.has(tab) ?? false);
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
