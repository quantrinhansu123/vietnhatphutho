export type AppTab = 'menu' | 'form' | 'weighing-summary' | 'hr' | 'products' | 'machines' | 'materials' | 'dashboard';

export const TAB_ROUTES: Record<AppTab, string> = {
  menu: '/',
  form: '/nhap-bao-cao',
  'weighing-summary': '/tong-hop-ca',
  hr: '/nhan-su',
  products: '/san-pham',
  machines: '/danh-sach-may',
  materials: '/nguyen-phu-lieu',
  dashboard: '/phan-tich'
};

const PATH_TO_TAB = new Map<string, AppTab>(
  Object.entries(TAB_ROUTES).map(([tab, path]) => [path, tab as AppTab])
);

PATH_TO_TAB.set('/menu', 'menu');
PATH_TO_TAB.set('/bao-cao-can', 'weighing-summary');

export function tabFromPath(pathname: string): AppTab {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return PATH_TO_TAB.get(normalized) ?? 'menu';
}

export function pathFromTab(tab: AppTab): string {
  return TAB_ROUTES[tab];
}
