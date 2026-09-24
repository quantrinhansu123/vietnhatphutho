/**
 * Unit test lệnh cắt lẻ — chạy: npx tsx --test tests/unit/lenhCatLe.test.ts
 * Chuỗi kiểm thử theo nghiệp vụ: tấm 20m -> 12m, sau đó 12m -> 10m.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatLePrintSlips, buildCatLeSanPhamLine, catDisplayName, computeCatLe, extractTemSuffix, type CatLeMother } from '../../src/features/lenh-cat-le/logic';

const mother20m: CatLeMother = {
  maSp: 'SP-CAT',
  tenSp: 'Tấm Đặc - 0.8li - 1.22m - 20m',
  donVi: 'Tấm',
  kg1: 10,
  a1: 24.4, // 1.22 x 20
  l1: 20,
  tenGoc: 'Tấm Đặc',
  doLi: '0.8li',
  doLiDm: '(đm 0.75 li)',
  doDayM: '1.22m',
  doDaiM: '20m',
  mang: '',
  hangPhe: '',
  maAmis: ''
};

describe('lenh-cat-le — tấm 20m cắt 12m (chỉ đổi dài)', () => {
  it('con 12m + thừa 8m, tên giữ do_li, bảo toàn kg', () => {
    const r = computeCatLe(mother20m, { w2: 1.22, l2: 12, qty: 1 });
    assert.equal(r.kieuCat, 'cat_tam');
    assert.equal(r.mDaiCon, 12);
    assert.equal(r.kgCon, 6);
    assert.equal(r.mDaiThua, 8);
    assert.equal(r.kgThua, 4);
    assert.equal(r.diTaiChe, false);
    // Tên con đổi m dài, giữ độ li + khổ rộng.
    assert.match(r.tenSpCon, /0\.8li/);
    assert.match(r.tenSpCon, /1\.22m/);
    assert.match(r.tenSpCon, /12m/);
    assert.match(r.tenSpThua, /8m/);
  });
});

describe('lenh-cat-le — chuỗi: 12m cắt tiếp 10m', () => {
  it('lấy con làm mẹ, thừa 2m đúng ngưỡng (không tái chế)', () => {
    const first = computeCatLe(mother20m, { w2: 1.22, l2: 12, qty: 1 });
    const mother12m: CatLeMother = {
      ...mother20m,
      tenSp: first.tenSpCon,
      kg1: first.kgCon,
      a1: first.m2Con,
      l1: first.mDaiCon,
      doDaiM: '12m'
    };
    const second = computeCatLe(mother12m, { w2: 1.22, l2: 10, qty: 1 });
    assert.equal(second.kgCon, 5);
    assert.equal(second.mDaiThua, 2);
    assert.equal(second.diTaiChe, false);
    assert.match(second.tenSpThua, /2m/);
  });

  it('thừa dưới 2m thì đi tái chế', () => {
    const first = computeCatLe(mother20m, { w2: 1.22, l2: 12, qty: 1 });
    const mother12m: CatLeMother = {
      ...mother20m,
      tenSp: first.tenSpCon,
      kg1: first.kgCon,
      a1: first.m2Con,
      l1: first.mDaiCon,
      doDaiM: '12m'
    };
    const r = computeCatLe(mother12m, { w2: 1.22, l2: 11, qty: 1 });
    assert.equal(r.mDaiThua, 1);
    assert.equal(r.diTaiChe, true);
  });
});

describe('lenh-cat-le — xẻ khổ giữ dài', () => {
  it('rộng 2.1m xẻ 1m, dài giữ 30m', () => {
    const mother: CatLeMother = {
      ...mother20m,
      kg1: 31.5,
      a1: 63,
      l1: 30,
      doDayM: '2.1m',
      doDaiM: '30m'
    };
    const r = computeCatLe(mother, { w2: 1, l2: 30, qty: 1 });
    assert.equal(r.kieuCat, 'xe_kho');
    assert.equal(r.kgCon, 15);
    assert.equal(r.m2Con, 30);
    assert.equal(r.kgThua, 16.5);
    assert.match(r.tenSpCon, /1m/);
  });
});

describe('lenh-cat-le — validate', () => {
  it('hạ cả khổ lẫn m dài: khổ còn lại = mẹ − khổ cắt, tên có mo_ta_tem', () => {
    const mother = { ...mother20m, moTaTem: '(Dán Tem 2.5li) Màu Hồng MVCC Dán Tem 2 Đầu' };
    const r = computeCatLe(mother, { w2: 1, l2: 12, qty: 1 });
    assert.equal(r.kieuCat, 'ca_hai');
    assert.equal(r.doDayMCon, '1m');
    assert.equal(r.doDayMThua, '0.22m');
    assert.equal(r.mDaiThua, 20);
    assert.equal(r.m2Thua, 4.4);
    assert.match(r.tenSpCon, /Dán Tem 2 Đầu$/);
    assert.match(r.tenSpThua, /0\.22m/);
    assert.match(r.tenSpThua, /Dán Tem 2 Đầu$/);
  });
  it('thiếu kg mẹ mà không cân tay thì chặn', () => {
    const noKg: CatLeMother = { ...mother20m, kg1: 0 };
    assert.throws(() => computeCatLe(noKg, { w2: 1.22, l2: 12, qty: 1 }), /cân/);
  });
  it('cân tay được chấp nhận và thừa = mẹ - cân', () => {
    const noKg: CatLeMother = { ...mother20m, kg1: 0 };
    const r = computeCatLe(noKg, { w2: 1.22, l2: 12, qty: 1, kgCanThucTe: 5.5 });
    assert.equal(r.kgCon, 5.5);
    assert.equal(r.tuCanTay, true);
  });
});

describe('lenh-cat-le — tên theo độ li, khổ rộng, m dài', () => {
  it('đổi độ li thì tên đích đổi độ li và ghép lại do_day_m, phần còn lại giữ mẹ', () => {
    const r = computeCatLe(mother20m, { w2: 1.22, l2: 12, qty: 1, doLiMoi: '0.4' });
    assert.match(r.tenSpCon, /0\.4li/);
    assert.equal(r.doDayMCon, '0.4m');
    assert.match(r.tenSpCon, /0\.4m/);
    assert.doesNotMatch(r.tenSpCon, /1\.22m/);
    assert.match(r.tenSpCon, /12m/);
    assert.match(r.tenSpThua, /0\.8li/);
    assert.match(r.tenSpThua, /1\.22m/);
    assert.match(r.tenSpThua, /8m/);
    assert.equal(r.kgCon, 3);
    assert.equal(r.kgThua, 4);
  });

  it('một lệnh nhiều SP lưu id nguồn và cờ chuyển tái chế khi còn dưới 2m', () => {
    const line = buildCatLeSanPhamLine({
      idSanPhamTrongKho: '11111111-1111-1111-1111-111111111111',
      mother: mother20m,
      qty: 2,
      w2: 1.22,
      l2: 19,
      doLiMoi: null
    });
    assert.equal(line.san_pham_nguon.id_san_pham_trong_kho, '11111111-1111-1111-1111-111111111111');
    assert.equal(line.san_pham_nguon.ma_sp, 'SP-CAT');
    assert.equal(line.san_pham_cat_2?.m_dai, 1);
    assert.equal(line.di_tai_che, true);
    assert.match(line.san_pham_cat_1.ten_sp, /19m/);
    assert.match(line.san_pham_cat_2?.ten_sp || '', /1m/);
    assert.equal('ma_sp_me' in line, false);
    assert.equal('ten_sp_con' in line, false);
    const slips = buildCatLePrintSlips({
      ma_lenh: 'CL-1',
      ngay_cat: '2026-09-23',
      san_pham: [line],
      ma_phieu_xuat: 'PX-1',
      ma_phieu_nhap_tp: 'PN-1',
      ma_phieu_nhap_thua: 'PN-2',
      ma_phieu_chuyen_tai_che: 'CK-1',
      ma_phieu_xuat_tai_che: 'PX-2',
      ma_phieu_nhap_tai_che: 'PN-3'
    });
    assert.deepEqual(
      slips.map(slip => slip.slipCode),
      ['PX-1', 'PN-1', 'PN-3']
    );
    assert.equal(slips[0].slipType, 'xuat');
    assert.equal(slips[0].warehouseName, 'Kho cắt lẻ');
    assert.equal(slips[1].warehouseName, 'Kho thành phẩm');
    assert.match(slips[0].note, /sản phẩm chuẩn bị cắt/);
    assert.equal(slips[2].slipType, 'nhap');
    assert.match(slips[2].note, /tái chế|Kho tái chế/);
    assert.equal(slips.some(slip => slip.slipType === 'xuat' && /tái chế/i.test(slip.reason + slip.note)), false);
    const preview = buildCatLePrintSlips({ ma_lenh: 'CL-1', ngay_cat: '2026-09-23', san_pham: [line] }, { preview: true });
    assert.deepEqual(
      preview.map(slip => slip.slipType),
      ['xuat', 'nhap', 'nhap']
    );
    assert.ok(preview.every(slip => slip.slipCode === 'Chưa sinh'));
    assert.match(preview[2].warehouseName, /tái chế/i);
  });
});

describe('lenh-cat-le — hiển thị mo_ta_tem ở cột cắt', () => {
  const tem = '(Dán Tem 2.5li) Màu Hồng MVCC Dán Tem 2 Đầu';
  it('nối mo_ta_tem của mẹ khi tên cắt chưa có', () => {
    assert.equal(
      catDisplayName('Tấm nhựa đặc XDT - ECO - 10li - (đm 5 li) - 1m - 3m', tem),
      `Tấm nhựa đặc XDT - ECO - 10li - (đm 5 li) - 1m - 3m ${tem}`
    );
  });
  it('không nối lặp khi tên cắt đã có hậu tố', () => {
    const named = `Tấm nhựa đặc - 1m - 3m ${tem}`;
    assert.equal(catDisplayName(named, tem), named);
  });
  it('bản ghi cũ thiếu field: tách hậu tố từ tên nguồn', () => {
    const nguon = `Tấm nhựa đặc XDT - ECO - 10li - (đm 5 li) - 2.1m - 3m ${tem}`;
    assert.equal(extractTemSuffix(nguon), tem);
    assert.equal(
      catDisplayName('Tấm nhựa đặc XDT - ECO - 10li - (đm 5 li) - 1m - 3m', '', nguon),
      `Tấm nhựa đặc XDT - ECO - 10li - (đm 5 li) - 1m - 3m ${tem}`
    );
  });
  it('không có tem thì giữ nguyên tên', () => {
    assert.equal(extractTemSuffix('Tấm nhựa đặc - 0.8li - 1.22m - 20m'), '');
    assert.equal(catDisplayName('Tấm nhựa đặc - 1m - 3m', '', 'Tấm nhựa đặc - 2m - 3m'), 'Tấm nhựa đặc - 1m - 3m');
    assert.equal(catDisplayName('', tem), '');
  });
});
