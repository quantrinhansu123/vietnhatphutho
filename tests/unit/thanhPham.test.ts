/**
 * Unit test kho thành phẩm — chạy: npx tsx --test tests/unit/thanhPham.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  thanhPhamMergeKey,
  mergeSoTronProductsByMaTen,
  computeThanhPhamLineAmount,
  recalcThanhPhamLineMetrics,
  computeThanhPhamPeriodBalances,
  aggregateNhapKhoProducts,
  mergeNhapKhoCatalogWithPeriodBalances,
  nhapKhoLoaiForKho,
  nhapKhoSeedMatchesKho,
  normalizeKhoLabel,
  normalizeLoaiKho,
  slugMaKho
} from '../../src/features/phieu-xuat-nhap-kho/thanhPham';

describe('thanhPham — merge key ma_sp + ten_sp', () => {
  it('phan biet cung ten khac ma', () => {
    assert.notEqual(thanhPhamMergeKey('A1', 'Tam song'), thanhPhamMergeKey('A2', 'Tam song'));
  });

  it('gop cung ma + ten (khong phan biet hoa thuong ten)', () => {
    const merged = mergeSoTronProductsByMaTen([
      { soTronId: '1', ma_sp: 'SP01', ten_sp: 'Tam Song', so_luong: 10, tong_m2: 20, tong_m_dai: 30, trong_luong: 40 },
      { soTronId: '2', ma_sp: 'SP01', ten_sp: 'tam song', so_luong: 5, tong_m2: 10, tong_m_dai: 15, trong_luong: 20 }
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].so_luong, 15);
    assert.equal(merged[0].tong_m2, 30);
    assert.equal(merged[0].tong_m_dai, 45);
    assert.equal(merged[0].trong_luong_kg, 60);
    assert.deepEqual(merged[0].so_tron_ids, ['1', '2']);
  });

  it('khong gop khac ma_sp', () => {
    const merged = mergeSoTronProductsByMaTen([
      { ma_sp: 'SP01', ten_sp: 'Tam', so_luong: 1 },
      { ma_sp: 'SP02', ten_sp: 'Tam', so_luong: 2 }
    ]);
    assert.equal(merged.length, 2);
  });
});

describe('thanhPham — thanh tien = SL thuc * gia', () => {
  it('tinh dung', () => {
    assert.equal(computeThanhPhamLineAmount(12.5, 1000), 12500);
  });

  it('recalc quy doi theo he so', () => {
    assert.deepEqual(
      recalcThanhPhamLineMetrics({ quantity: 4, kgPerUnit: 2.5, m2PerUnit: 1.2, mDaiPerUnit: 3 }),
      { weightKg: 10, m2: 4.8, mDai: 12 }
    );
  });
});

describe('thanhPham — ton ky', () => {
  it('ton dau = nhap - xuat truoc from', () => {
    const rows = computeThanhPhamPeriodBalances(
      [
        { ma_sp: 'SP01', ten_sp: 'A', loai_phieu: 'nhap', ngay_phieu: '2026-09-01', so_luong: 100, trong_luong_kg: 200, so_m2: 50, so_m_dai: 80 },
        { ma_sp: 'SP01', ten_sp: 'A', loai_phieu: 'xuat', ngay_phieu: '2026-09-05', so_luong: 20, trong_luong_kg: 40, so_m2: 10, so_m_dai: 16 },
        { ma_sp: 'SP01', ten_sp: 'A', loai_phieu: 'nhap', ngay_phieu: '2026-09-10', so_luong: 30, trong_luong_kg: 60, so_m2: 15, so_m_dai: 24 },
        { ma_sp: 'SP01', ten_sp: 'A', loai_phieu: 'xuat', ngay_phieu: '2026-09-12', so_luong: 10, trong_luong_kg: 20, so_m2: 5, so_m_dai: 8 }
      ],
      { from: '2026-09-10', to: '2026-09-30' }
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].ton_dau.sl, 80);
    assert.equal(rows[0].nhap.sl, 30);
    assert.equal(rows[0].xuat.sl, 10);
    assert.equal(rows[0].ton_cuoi.sl, 100);
    assert.equal(rows[0].ton_dau.kg, 160);
    assert.equal(rows[0].ton_cuoi.kg, 200);
  });
});

describe('thanhPham — danh muc nhap_kho + ton phieu', () => {
  it('gop nhap_kho theo ma + ten', () => {
    const catalog = aggregateNhapKhoProducts([
      { ma_sp: 'SP01', ten_sp: 'Tam Song', don_vi: 'Tam', ten_kho: 'Kho TP' },
      { ma_sp: 'SP01', ten_sp: 'tam song', don_vi: 'Tam', ten_kho: 'Kho TP' },
      { ma_sp: 'SP02', ten_sp: 'Tam', don_vi: 'Cuon', ten_kho: 'Kho TP' }
    ]);
    assert.equal(catalog.length, 2);
    assert.equal(catalog[0].ma_sp, 'SP01');
    assert.equal(catalog[1].ma_sp, 'SP02');
  });

  it('cung ma ten khac quy doi la hai dong', () => {
    const catalog = aggregateNhapKhoProducts([
      {
        ma_sp: 'SP01',
        ten_sp: 'A',
        don_vi: 'Tam',
        ten_kho: 'Kho TP',
        trong_luong_kg_mot_sp: 1.234567,
        so_m2_mot_sp: 0.5,
        so_m_dai_mot_sp: 2,
        created_at: '2026-09-10T00:00:00Z'
      },
      {
        ma_sp: 'SP01',
        ten_sp: 'A',
        don_vi: 'Tam',
        ten_kho: 'Kho TP',
        trong_luong_kg_mot_sp: 1,
        so_m2_mot_sp: 0.2,
        so_m_dai_mot_sp: 1,
        created_at: '2026-09-01T00:00:00Z'
      },
      {
        ma_sp: 'SP01',
        ten_sp: 'a',
        don_vi: 'Tam',
        ten_kho: 'Kho TP',
        trong_luong_kg_mot_sp: 1,
        so_m2_mot_sp: 0.2,
        so_m_dai_mot_sp: 1,
        created_at: '2026-09-02T00:00:00Z'
      }
    ]);
    assert.equal(catalog.length, 2);
    const heavy = catalog.find(row => row.trong_luong_kg_mot_sp === 1.234567);
    const light = catalog.find(row => row.trong_luong_kg_mot_sp === 1);
    assert.equal(heavy?.so_m2_mot_sp, 0.5);
    assert.equal(light?.so_m_dai_mot_sp, 1);
  });

  it('merge: SP trong nhap_kho khong co phieu van hien (so 0)', () => {
    const catalog = aggregateNhapKhoProducts([
      { ma_sp: 'SP01', ten_sp: 'A', don_vi: 'Tam', ten_kho: 'Kho TP' },
      { ma_sp: 'SP02', ten_sp: 'B', don_vi: 'Tam', ten_kho: 'Kho TP' }
    ]);
    const balances = computeThanhPhamPeriodBalances(
      [
        {
          ma_sp: 'SP01',
          ten_sp: 'A',
          ten_kho: '',
          loai_phieu: 'nhap',
          ngay_phieu: '2026-09-10',
          so_luong: 5,
          trong_luong_kg: 10
        }
      ],
      { from: '2026-09-01', to: '2026-09-30' }
    );
    const merged = mergeNhapKhoCatalogWithPeriodBalances(catalog, balances, { tenKho: 'Kho thành phẩm' });
    assert.equal(merged.length, 2);
    const sp01 = merged.find(r => r.ma_sp === 'SP01');
    const sp02 = merged.find(r => r.ma_sp === 'SP02');
    assert.equal(sp01?.nhap.sl, 5);
    assert.equal(sp01?.ton_cuoi.sl, 5);
    assert.equal(sp01?.ten_kho, 'Kho thành phẩm');
    assert.equal(sp02?.nhap.sl, 0);
    assert.equal(sp02?.ton_cuoi.sl, 0);
    assert.equal(sp02?.loai_kho, 'kho_thanh_pham');
  });

  it('ton tach theo quy doi 1 sp', () => {
    const catalog = aggregateNhapKhoProducts([
      {
        ma_sp: 'SP01',
        ten_sp: 'A',
        don_vi: 'Tam',
        ten_kho: 'Kho TP',
        trong_luong_kg_mot_sp: 2,
        so_m2_mot_sp: 1,
        so_m_dai_mot_sp: 4
      },
      {
        ma_sp: 'SP01',
        ten_sp: 'A',
        don_vi: 'Tam',
        ten_kho: 'Kho TP',
        trong_luong_kg_mot_sp: 3,
        so_m2_mot_sp: 1,
        so_m_dai_mot_sp: 4
      }
    ]);
    const movements = [
      {
        ma_sp: 'SP01',
        ten_sp: 'A',
        loai_phieu: 'nhap',
        ngay_phieu: '2026-09-10',
        so_luong: 10,
        trong_luong_kg: 20,
        so_m2: 10,
        so_m_dai: 40
      },
      {
        ma_sp: 'SP01',
        ten_sp: 'A',
        loai_phieu: 'nhap',
        ngay_phieu: '2026-09-11',
        so_luong: 5,
        trong_luong_kg: 15,
        so_m2: 5,
        so_m_dai: 20
      }
    ];
    const balances = computeThanhPhamPeriodBalances(movements, {
      from: '2026-09-01',
      to: '2026-09-30',
      catalog
    });
    const merged = mergeNhapKhoCatalogWithPeriodBalances(catalog, balances, { tenKho: 'Kho thành phẩm' });
    assert.equal(merged.length, 2);
    const kg2 = merged.find(row => row.trong_luong_kg_mot_sp === 2);
    const kg3 = merged.find(row => row.trong_luong_kg_mot_sp === 3);
    assert.equal(kg2?.nhap.sl, 10);
    assert.equal(kg2?.nhap.kg, 20);
    assert.equal(kg3?.nhap.sl, 5);
    assert.equal(kg3?.nhap.kg, 15);
  });
});

describe('thanhPham — mã kho từ quản lý kho (slug không dấu nối _)', () => {
  it('slugMaKho sinh mã ngầm', () => {
    assert.equal(slugMaKho('Kho cắt lẻ'), 'kho_cat_le');
    assert.equal(slugMaKho('Kho thành phẩm'), 'kho_thanh_pham');
    assert.equal(slugMaKho('Kho tái chế'), 'kho_tai_che');
    assert.equal(slugMaKho('  Kho  NVL   Phú-Thọ  '), 'kho_nvl_phu_tho');
    assert.equal(slugMaKho(''), '');
  });

  it('normalizeLoaiKho đổi mã cũ về mã mới', () => {
    assert.equal(normalizeLoaiKho('thanh_pham'), 'kho_thanh_pham');
    assert.equal(normalizeLoaiKho('cat_le'), 'kho_cat_le');
    assert.equal(normalizeLoaiKho('tai_che'), 'kho_tai_che');
    assert.equal(normalizeLoaiKho('kho_cat_le'), 'kho_cat_le');
  });

  it('nhapKhoLoaiForKho dự phòng bằng slug', () => {
    assert.equal(nhapKhoLoaiForKho('Kho thành phẩm'), 'kho_thanh_pham');
    assert.equal(nhapKhoLoaiForKho(''), 'kho_thanh_pham');
    assert.equal(nhapKhoLoaiForKho('Kho cắt lẻ'), 'kho_cat_le');
    assert.equal(nhapKhoLoaiForKho('Kho tái chế'), 'kho_tai_che');
  });

  it('normalizeKhoLabel khớp alias TP', () => {
    assert.equal(normalizeKhoLabel(''), 'Kho thành phẩm');
    assert.equal(normalizeKhoLabel('Kho sản phẩm'), 'Kho thành phẩm');
    assert.equal(normalizeKhoLabel('Kho cắt lẻ'), 'Kho cắt lẻ');
  });

  it('nhapKhoSeedMatchesKho khớp theo ten_kho hoặc mã kho', () => {
    // Khớp ten_kho (kể cả dòng cũ chưa backfill loai_kho).
    assert.equal(
      nhapKhoSeedMatchesKho({ ten_kho: 'Kho cắt lẻ', loai_kho: 'thanh_pham' }, 'Kho cắt lẻ'),
      true
    );
    // Khớp mã kho mới.
    assert.equal(
      nhapKhoSeedMatchesKho({ ten_kho: 'Kho cắt lẻ', loai_kho: 'kho_cat_le' }, 'Kho cắt lẻ'),
      true
    );
    // Mã cũ vẫn khớp nhờ chuẩn hóa.
    assert.equal(
      nhapKhoSeedMatchesKho({ ten_kho: 'Kho X', loai_kho: 'cat_le' }, 'Kho cắt lẻ'),
      true
    );
    // Dòng TP không lọt vào view cắt lẻ.
    assert.equal(
      nhapKhoSeedMatchesKho({ ten_kho: 'Kho thành phẩm', loai_kho: 'kho_thanh_pham' }, 'Kho cắt lẻ'),
      false
    );
    assert.equal(
      nhapKhoSeedMatchesKho({ ten_kho: '', loai_kho: 'kho_thanh_pham' }, 'Kho cắt lẻ'),
      false
    );
    // Dòng trống kho thuộc TP.
    assert.equal(
      nhapKhoSeedMatchesKho({ ten_kho: '', loai_kho: '' }, 'Kho thành phẩm'),
      true
    );
  });

  it('merge gắn mã kho theo kho hiển thị', () => {
    const catalog = aggregateNhapKhoProducts([
      { ma_sp: 'SP01', ten_sp: 'A', don_vi: 'Tam', ten_kho: 'Kho cắt lẻ', loai_kho: 'kho_cat_le' }
    ]);
    const merged = mergeNhapKhoCatalogWithPeriodBalances(catalog, [], { tenKho: 'Kho cắt lẻ' });
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.loai_kho, 'kho_cat_le');
    assert.equal(merged[0]?.ten_kho, 'Kho cắt lẻ');
  });
});
