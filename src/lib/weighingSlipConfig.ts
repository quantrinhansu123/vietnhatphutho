export type WeighingSlipConfig = {
  apiBasePath: string;
  weigherStorageKey: string;
  backLabel: string;
  summaryTitle: string;
  summarySubtitle: string;
  printTitle: string;
};

export const DEFAULT_WEIGHING_SLIP_CONFIG: WeighingSlipConfig = {
  apiBasePath: '/api/phieu-can-dinh-ki',
  weigherStorageKey: 'weighing-current-weigher',
  backLabel: 'Quay lại Phiếu cân ca',
  summaryTitle: 'Tổng hợp báo cáo cân',
  summarySubtitle: 'Theo dõi phiếu cân theo từng ca sản xuất',
  printTitle: 'PHIẾU CÂN CA'
};

export const DAMAGED_GOODS_SLIP_CONFIG: WeighingSlipConfig = {
  apiBasePath: '/api/bao-cao-hang-hong',
  weigherStorageKey: 'damaged-goods-current-weigher',
  backLabel: 'Quay lại Báo cáo hàng hỏng',
  summaryTitle: 'Tổng hợp báo cáo hàng hỏng',
  summarySubtitle: 'Theo dõi phiếu hàng hỏng theo từng ca sản xuất',
  printTitle: 'BÁO CÁO HÀNG HỎNG'
};
