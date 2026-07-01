export type AppTab = 'menu' | 'production-reports' | 'report-forms' | 'report-lists' | 'facility-management' | 'hcns' | 'business' | 'factory' | 'control-board' | 'form' | 'weighing-summary' | 'mixing-report' | 'mixing-report-list' | 'machine-nvl-report' | 'machine-downtime-report' | 'machine-downtime-list' | 'acceptance-report' | 'acceptance-report-list' | 'hr' | 'products' | 'machines' | 'materials' | 'warehouse-slip' | 'warehouse-history' | 'orders' | 'customers' | 'production-orders' | 'production-plan-history' | 'settings' | 'dashboard';

export const TAB_ROUTES: Record<AppTab, string> = {
  menu: '/',
  'production-reports': '/bao-cao-san-xuat',
  'report-forms': '/phieu-bao-cao',
  'report-lists': '/danh-sach-bao-cao',
  'facility-management': '/quan-ly-csvc',
  hcns: '/hcns',
  business: '/kinh-doanh',
  factory: '/nha-may',
  'control-board': '/bang-dieu-khien',
  form: '/nhap-bao-cao',
  'weighing-summary': '/tong-hop-ca',
  'mixing-report': '/bao-cao-phoi-tron',
  'mixing-report-list': '/danh-sach-bao-cao-phoi-tron',
  'machine-nvl-report': '/bao-cao-may-nvl-ton',
  'machine-downtime-report': '/phieu-bao-dung-may',
  'machine-downtime-list': '/danh-sach-bao-cao-dung-may',
  'acceptance-report': '/bao-cao-san-luong',
  'acceptance-report-list': '/danh-sach-bao-cao-san-luong',
  hr: '/nhan-su',
  products: '/san-pham',
  machines: '/danh-sach-may',
  materials: '/kho-nvl',
  'warehouse-slip': '/phieu-xuat-nhap-kho',
  'warehouse-history': '/lich-su-xuat-nhap-kho',
  orders: '/don-hang',
  customers: '/khach-hang',
  'production-orders': '/lenh-san-xuat',
  'production-plan-history': '/ke-hoach-san-xuat',
  settings: '/cai-dat',
  dashboard: '/phan-tich'
};

const PATH_TO_TAB = new Map<string, AppTab>(
  Object.entries(TAB_ROUTES).map(([tab, path]) => [path, tab as AppTab])
);

PATH_TO_TAB.set('/bao-cao-nghiem-thu', 'acceptance-report');
PATH_TO_TAB.set('/menu', 'menu');
PATH_TO_TAB.set('/bao-cao-can', 'weighing-summary');
PATH_TO_TAB.set('/nguyen-phu-lieu', 'materials');

export function tabFromPath(pathname: string): AppTab {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return PATH_TO_TAB.get(normalized) ?? 'menu';
}

export function pathFromTab(tab: AppTab): string {
  return TAB_ROUTES[tab];
}
