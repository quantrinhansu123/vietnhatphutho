export type ProductConversion = {
  id: number;
  sanPhamId: string;
  maSp: string;
  maAmis: string;
  tenSp: string;
  donViSanPham: string;
  donViTinh: string;
  khoTamRongM: number | null;
  khoTamDaiM: number | null;
  khoCuonRongM: number | null;
  khoCuonDaiM: number | null;
  dienTichM2: number | null;
  trongLuongKgMDai: number | null;
  trongLuongKgM2: number | null;
  trongLuongKgTam: number | null;
  trongLuongKgCuon: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductOption = {
  id: string;
  code: string;
  amisCode: string;
  name: string;
  unit: string;
};

export type ProductConversionInput = {
  productId: string;
  sheetWidthM: string;
  sheetLengthM: string;
  rollWidthM: string;
  rollLengthM: string;
  areaM2: string;
  kgPerLinearM: string;
  kgPerM2: string;
  kgPerSheet: string;
  kgPerRoll: string;
};

export const EMPTY_CONVERSION_INPUT: ProductConversionInput = {
  productId: '', sheetWidthM: '', sheetLengthM: '', rollWidthM: '',
  rollLengthM: '', areaM2: '', kgPerLinearM: '', kgPerM2: '', kgPerSheet: '', kgPerRoll: ''
};

