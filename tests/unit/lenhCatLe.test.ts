/**
 * Unit test lệnh cắt lẻ — chạy: npx tsx --test tests/unit/lenhCatLe.test.ts
 * Chuỗi kiểm thử theo nghiệp vụ: tấm 20m -> 12m, sau đó 12m -> 10m.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatLePrintSlips, buildCatLeSanPhamLine, catDisplayName, computeCatLe, extractTemSuffix, resolveOriginMaCu, suggestCatLePlan, type CatLeMother } from '../../src/features/lenh-cat-le/logic';

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

describe('lenh-cat-le — sóng chỉ có mét dài', () => {
  it('cắt 6M xuống 2m thì tên chỉ còn 2m, không chèn khổ 1m', () => {
    const song: CatLeMother = {
      ...mother20m,
      tenSp: 'NHỰA SÓNG TRẮNG - NP2 - 11 SÓNG 5KG - 6M - Giá rẻ',
      doDayM: '',
      doDaiM: '6m',
      doLi: '',
      doLiDm: '',
      a1: 6,
      l1: 6,
      tenGoc: 'NHỰA SÓNG TRẮNG - NP2 - 11 SÓNG 5KG'
    };
    const r = computeCatLe(song, { w2: 1, l2: 2, qty: 1, pieces: 3 });
    assert.equal(r.tenSpCon, 'NHỰA SÓNG TRẮNG - NP2 - 11 SÓNG 5KG - 2m - Giá rẻ');
    assert.doesNotMatch(r.tenSpCon, /1m/);
  });
});

describe('lenh-cat-le — tấm 20m cắt 12m (chỉ đổi dài)', () => {
  it('TP 12m + thừa 8m, tên giữ do_li, bảo toàn kg', () => {
    const r = computeCatLe(mother20m, { w2: 1.22, l2: 12, qty: 1 });
    assert.equal(r.kieuCat, 'cat_tam');
    assert.equal(r.mDaiCon, 12);
    assert.equal(r.kgCon, 6);
    assert.equal(r.mDaiThua, 8);
    assert.equal(r.kgThua, 4);
    assert.equal(r.diTaiChe, false);
    // Tên TP đổi m dài, giữ độ li + khổ rộng.
    assert.match(r.tenSpCon, /0\.8li/);
    assert.match(r.tenSpCon, /1\.22m/);
    assert.match(r.tenSpCon, /12m/);
    assert.match(r.tenSpThua, /8m/);
  });
});

describe('lenh-cat-le — chuỗi: 12m cắt tiếp 10m', () => {
  it('lấy TP làm nguồn, thừa 2m đúng ngưỡng (không tái chế)', () => {
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

  it('thừa dưới 2m vẫn nhập lại kho cắt lẻ', () => {
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
    assert.equal(r.diTaiChe, false);
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
  it('hạ cả khổ lẫn m dài: khổ còn lại = nguồn − khổ cắt, tên có mo_ta_tem', () => {
    const mother = { ...mother20m, moTaTem: '(Dán Tem 2.5li) Màu Hồng MVCC Dán Tem 2 Đầu' };
    const r = computeCatLe(mother, { w2: 1, l2: 12, qty: 1 });
    assert.equal(r.kieuCat, 'ca_hai');
    assert.equal(r.doDayMCon, '1m');
    assert.equal(r.doDayMThua, '0.22m');
    assert.equal(r.mDaiThua, 20);
    assert.equal(r.m2Thua, 4.4);
    assert.equal(r.doDayMThua2, '1m');
    assert.equal(r.mDaiThua2, 8);
    assert.equal(r.m2Thua2, 8);
    assert.match(r.tenSpCon, /Dán Tem 2 Đầu$/);
    assert.match(r.tenSpThua, /0\.22m/);
    assert.match(r.tenSpThua, /Dán Tem 2 Đầu$/);
    assert.match(r.tenSpThua2 || '', /1m/);
    assert.match(r.tenSpThua2 || '', /8m/);
  });
  it('hạ cả 2 chiều: tấm 2.1m x 5.8m cắt 1.1m x 4.8m sinh đủ thừa 1m x 5.8m VÀ 1.1m x 1m', () => {
    const motherRong: CatLeMother = {
      maSp: 'ECR05-10li-5.8m',
      tenSp: 'Tấm nhựa rỗng Economic màu trà 10li x 2.1m x 5.8m',
      donVi: 'Tấm',
      kg1: 15,
      a1: 12.18, // 2.1 x 5.8
      l1: 5.8,
      tenGoc: 'Tấm nhựa rỗng màu trà - ECO',
      doLi: '10li',
      doLiDm: '',
      doDayM: '2.1m',
      doDaiM: '5.8m',
      mang: '',
      hangPhe: '',
      maAmis: 'ECR05-10li-5.8m'
    };
    const r = computeCatLe(motherRong, { w2: 1.1, l2: 4.8, qty: 5 });
    assert.equal(r.kieuCat, 'ca_hai');
    // Thành phẩm: 1.1m x 4.8m
    assert.equal(r.doDayMCon, '1.1m');
    assert.equal(r.doDaiMCon, '4.8m');
    assert.equal(r.m2Con, 5.28);
    // Thừa 1: 1m x 5.8m (dải dọc)
    assert.equal(r.doDayMThua, '1m');
    assert.equal(r.doDaiMThua, '5.8m');
    assert.equal(r.m2Thua, 5.8);
    // Thừa 2: 1.1m x 1m (phần đuôi chiều dài của dải 1.1m)
    assert.equal(r.doDayMThua2, '1.1m');
    assert.equal(r.doDaiMThua2, '1m');
    assert.equal(r.m2Thua2, 1.1);
    // Bảo toàn diện tích: 5.28 + 5.8 + 1.1 = 12.18
    assert.equal(Math.round((r.m2Con + r.m2Thua + (r.m2Thua2 || 0)) * 100) / 100, 12.18);
    // Bảo toàn kg:
    assert.equal(Math.round((r.kgCon + r.kgThua + (r.kgThua2 || 0)) * 100) / 100, 15);

    // Kiểm tra buildCatLeSanPhamLine sinh san_pham_cat_3
    const line = buildCatLeSanPhamLine({
      mother: motherRong,
      qty: 5,
      w2: 1.1,
      l2: 4.8
    });
    assert.ok(line.san_pham_cat_2, 'Có thừa 1');
    assert.ok(line.san_pham_cat_3, 'Có thừa 2');
    assert.equal(line.san_pham_cat_2?.do_day_m, '1m');
    assert.equal(line.san_pham_cat_2?.do_dai_m, '5.8m');
    assert.equal(line.san_pham_cat_3?.do_day_m, '1.1m');
    assert.equal(line.san_pham_cat_3?.do_dai_m, '1m');
    assert.match(line.san_pham_cat_3?.ma_amis || '', /1m/);
  });
  it('thiếu kg nguồn mà không cân tay thì chặn', () => {
    const noKg: CatLeMother = { ...mother20m, kg1: 0 };
    assert.throws(() => computeCatLe(noKg, { w2: 1.22, l2: 12, qty: 1 }), /cân/);
  });
  it('cân tay được chấp nhận và thừa = nguồn - cân', () => {
    const noKg: CatLeMother = { ...mother20m, kg1: 0 };
    const r = computeCatLe(noKg, { w2: 1.22, l2: 12, qty: 1, kgCanThucTe: 5.5 });
    assert.equal(r.kgCon, 5.5);
    assert.equal(r.tuCanTay, true);
  });
});

describe('lenh-cat-le — tên theo độ li, khổ rộng, m dài', () => {
  it('đổi độ li thì tên đích đổi độ li, giữ khổ, phần còn lại giữ nguồn', () => {
    const r = computeCatLe(mother20m, { w2: 1.22, l2: 12, qty: 1, doLiMoi: '0.4' });
    assert.match(r.tenSpCon, /0\.4li/);
    assert.equal(r.doDayMCon, '1.22m');
    assert.match(r.tenSpCon, /1\.22m/);
    assert.match(r.tenSpCon, /12m/);
    assert.match(r.tenSpThua, /0\.8li/);
    assert.match(r.tenSpThua, /1\.22m/);
    assert.match(r.tenSpThua, /8m/);
    assert.equal(r.kgCon, 3);
    assert.equal(r.kgThua, 4);
  });

  it('một lệnh nhiều SP lưu id nguồn và phần thừa dưới 2m vẫn về kho cắt lẻ', () => {
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
    assert.equal(line.di_tai_che, false);
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
      ['PX-1', 'PN-1', 'PN-2']
    );
    assert.equal(slips[0].slipType, 'xuat');
    assert.equal(slips[0].warehouseName, 'Kho cắt lẻ');
    assert.equal(slips[1].warehouseName, 'Kho cắt lẻ');
    assert.match(slips[0].note, /sản phẩm chuẩn bị cắt/);
    assert.equal(slips[2].slipType, 'nhap');
    assert.equal(slips[2].warehouseName, 'Kho cắt lẻ');
    assert.match(slips[2].note, /còn lại/);
    assert.equal(slips.some(slip => slip.slipType === 'xuat' && /tái chế/i.test(slip.reason + slip.note)), false);
    const preview = buildCatLePrintSlips({ ma_lenh: 'CL-1', ngay_cat: '2026-09-23', san_pham: [line] }, { preview: true });
    assert.deepEqual(
      preview.map(slip => slip.slipType),
      ['xuat', 'nhap', 'nhap']
    );
    assert.ok(preview.every(slip => slip.slipCode === 'Chưa sinh'));
    assert.equal(preview[2].warehouseName, 'Kho cắt lẻ');
  });
});

describe('lenh-cat-le — hiển thị mo_ta_tem ở cột cắt', () => {
  const tem = '(Dán Tem 2.5li) Màu Hồng MVCC Dán Tem 2 Đầu';
  it('nối mo_ta_tem của nguồn khi tên cắt chưa có', () => {
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

describe('lenh-cat-le — SL nguồn từ SL thành phẩm, hạ khổ, hạ li', () => {
  it('hạ khổ một nửa thì 1 nguồn ra 2 TP, cần 3 TP thì xuất 2 nguồn', () => {
    const plan = suggestCatLePlan(mother20m, { w2: 0.61, l2: 20, desiredConQty: 3 });
    assert.equal(plan.kieuCat, 'xe_kho');
    assert.equal(plan.pieces, 2);
    assert.equal(plan.mothers, 2);
    assert.equal(plan.actualCons, 4);
  });

  it('chỉ hạ li thì 1 nguồn ra 1 TP, SL nguồn bằng SL thành phẩm', () => {
    const plan = suggestCatLePlan(mother20m, { w2: 1.22, l2: 20, desiredConQty: 3, doLiMoi: '0.4' });
    assert.equal(plan.kieuCat, 'doi_li');
    assert.equal(plan.pieces, 1);
    assert.equal(plan.mothers, 3);
  });

  it('cắt ngắn 10m từ nguồn 20m, cần 3 TP thì xuất 2 nguồn', () => {
    const plan = suggestCatLePlan(mother20m, { w2: 1.22, l2: 10, desiredConQty: 3 });
    assert.equal(plan.kieuCat, 'cat_tam');
    assert.equal(plan.pieces, 2);
    assert.equal(plan.mothers, 2);
  });
});

describe('lenh-cat-le — dòng từ đơn fill thẳng (không bắt hạ)', () => {
  it('quy cách giữ nguyên thì chặn khi không có cờ', () => {
    assert.throws(() => computeCatLe(mother20m, { w2: 1.22, l2: 20, qty: 1 }), /không có gì để cắt/);
    assert.throws(
      () => suggestCatLePlan(mother20m, { w2: 1.22, l2: 20, desiredConQty: 2 }),
      /không có gì để cắt/
    );
  });
  it('có cờ allowIdentical thì cho qua, cắt = nguồn, không thừa', () => {
    const r = computeCatLe(mother20m, { w2: 1.22, l2: 20, qty: 2 }, { allowIdentical: true });
    assert.equal(r.tenSpCon, mother20m.tenSp);
    assert.equal(r.mDaiCon, 20);
    assert.equal(r.kgCon, 10);
    assert.equal(r.m2Con, 24.4);
    assert.equal(r.tenSpThua, '');
    assert.equal(r.pieces, 1);
  });
  it('builder với allowIdentical không sinh mã mới khi không đổi', () => {
    const line = buildCatLeSanPhamLine({
      mother: { ...mother20m, maSp: 'PW-X', maAmis: 'PW-X' },
      qty: 2,
      w2: 1.22,
      l2: 20,
      allowIdentical: true
    });
    assert.equal(line.san_pham_cat_1.ten_sp, mother20m.tenSp);
    assert.equal(String(line.san_pham_cat_1.ma_amis || ''), '');
    assert.equal(line.san_pham_cat_2, null);
  });
  it('giữ nguyên quy cách vẫn hiện mã đủ viết tắt từ tên sản xuất', () => {
    const line = buildCatLeSanPhamLine({
      mother: {
        ...mother20m,
        maSp: 'STD06-0.8li*1.22m',
        maAmis: 'STD06-0.8li*1.22m',
        tenSp: 'Tấm nhựa đặc màu TRẮNG 8ZEM - 1.22m',
        doLiDm: '',
        doDaiM: '30m',
        l1: 30,
        a1: 36.6,
        mang: 'ECO',
        hangPhe: 'hàng tiêu chuẩn'
      },
      qty: 5,
      w2: 1.22,
      l2: 30,
      allowIdentical: true,
      nhomVthh: 'TP; PX Đặc',
      tenSanXuat: 'Tấm nhựa đặc màu TRẮNG 8ZEM - 1.22m - 30m hàng tiêu chuẩn - ECO'
    });
    assert.equal(line.san_pham_cat_1.ma_amis, 'STD06-TR-8ZEM-0.8li*1.22m-TC-ECO-30m');
    assert.equal(line.san_pham_cat_1.ma_amis_cu, 'STD06-0.8li*1.22m');
  });
});

describe('lenh-cat-le — ma_amis_cu quy về mã gốc đã lưu', () => {
  it('ưu tiên mã cũ đã lưu, không có thì lấy mã nguồn', () => {
    assert.equal(resolveOriginMaCu('PW-DAC-01', 'PW-DAC-01-1.2li-12m'), 'PW-DAC-01');
    assert.equal(resolveOriginMaCu('', 'PW-DAC-01'), 'PW-DAC-01');
    assert.equal(resolveOriginMaCu(null, 'PW-DAC-01'), 'PW-DAC-01');
  });

  it('cắt chuỗi từ biến thể vẫn gán mã cũ về gốc', () => {
    const chainMother: CatLeMother = {
      ...mother20m,
      maSp: 'PW-DAC-01-1.2li-12m',
      maAmis: 'PW-DAC-01-1.2li-12m',
      doDaiM: '12m',
      a1: 14.64,
      l1: 12,
      kg1: 6
    };
    const line = buildCatLeSanPhamLine({
      mother: chainMother,
      qty: 1,
      w2: 1.22,
      l2: 10,
      originMaCu: 'PW-DAC-01'
    });
    assert.equal(line.san_pham_cat_1.ma_amis_cu, 'PW-DAC-01');
    assert.equal(line.san_pham_cat_2?.ma_amis_cu, 'PW-DAC-01');
    assert.notEqual(line.san_pham_cat_1.ma_amis, 'PW-DAC-01-1.2li-12m');
  });

  it('không truyền origin thì mã cũ là mã nguồn (như cũ)', () => {
    const line = buildCatLeSanPhamLine({ mother: { ...mother20m, maSp: 'PW-DAC-01', maAmis: 'PW-DAC-01' }, qty: 1, w2: 1.22, l2: 10 });
    assert.equal(line.san_pham_cat_1.ma_amis_cu, 'PW-DAC-01');
  });

  it('hạ li thật thì mã mới theo li mới, ĐM thừa kế không đè', () => {
    const rong: CatLeMother = {
      maSp: 'PW-CASE-RONG01',
      maAmis: 'PW-CASE-RONG01',
      tenSp: 'Tấm nhựa rỗng chuẩn 4li khổ 1.22m dài 30m (PW)',
      tenGoc: 'Tấm nhựa rỗng chuẩn',
      donVi: 'Cuộn',
      doLi: '4li',
      doLiDm: '(đm 4 li)',
      doDayM: '1.22m',
      doDaiM: '30m',
      mang: '',
      hangPhe: '',
      kg1: 165.432,
      a1: 36.6,
      l1: 30
    };
    const line = buildCatLeSanPhamLine({ mother: rong, qty: 5, w2: 1.22, l2: 30, doLiMoi: '3li', nhomVthh: 'TP; PX Rỗng' });
    const code = String(line.san_pham_cat_1.ma_amis || '');
    assert.match(code, /3li/);
    assert.doesNotMatch(code, /4li/);
    assert.equal(line.san_pham_cat_1.ma_amis_cu, 'PW-CASE-RONG01');
  });

  it('không hạ li thì ĐM thừa kế vẫn lên mã (như cũ)', () => {
    const dac: CatLeMother = {
      maSp: 'PW-DAC-01',
      maAmis: 'PW-DAC-01',
      tenSp: 'Tấm nhựa đặc đặc 1.2li khổ 1.22m dài 30m (PW)',
      tenGoc: 'Tấm nhựa đặc đặc',
      donVi: 'Cuộn',
      doLi: '1.2li',
      doLiDm: '(đm 1.2 li)',
      doDayM: '1.22m',
      doDaiM: '30m',
      mang: '',
      hangPhe: '',
      kg1: 49.6,
      a1: 36.6,
      l1: 30
    };
    const line = buildCatLeSanPhamLine({ mother: dac, qty: 5, w2: 1.22, l2: 12, nhomVthh: 'TP; PX Đặc' });
    assert.equal(line.san_pham_cat_1.ma_amis, 'PW-DAC-01-1.2li*1.22m-TC-12m');
  });
});
