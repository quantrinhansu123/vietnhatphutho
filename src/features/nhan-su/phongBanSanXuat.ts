/** Phòng ban sản xuất trên hồ sơ nhân sự. */
export const PHONG_BAN_SAN_XUAT = 'Phân xưởng sản xuất';

/** Chức vụ được chọn khi phòng ban là Phân xưởng sản xuất. */
export const CHUC_VU_PHAN_XUONG_SAN_XUAT = ['Nhân Viên', 'Trưởng Phòng', 'Trộn'] as const;

export type ChucVuPhanXuong = (typeof CHUC_VU_PHAN_XUONG_SAN_XUAT)[number];

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isPhongBanSanXuat(name: string) {
  return fold(name).includes('phan xuong san xuat');
}

export function isChucVuPhanXuong(value: string): value is ChucVuPhanXuong {
  return (CHUC_VU_PHAN_XUONG_SAN_XUAT as readonly string[]).includes(value.trim());
}
