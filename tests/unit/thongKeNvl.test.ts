/**
 * Unit test thống kê NVL: npx tsx --test tests/unit/thongKeNvl.test.ts
 * Logic lọc đa máy/kho (không cần server).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPartyAliasKind,
  collectLineParties,
  collectLineTokens,
  foldPartyKey,
  matchPartyFilter,
  matchTokenFilter
} from '../../src/features/thong-ke-nvl/index.tsx';

const setOf = (...keys: string[]) => new Set(keys.map(foldPartyKey));

describe('thong-ke-nvl — foldPartyKey', () => {
  it('khớp không phân biệt dấu và hoa thường', () => {
    assert.equal(foldPartyKey('Kho NVL Chính'), foldPartyKey('kho nvl chinh'));
    assert.equal(foldPartyKey('M12C1'), foldPartyKey('m12c1'));
  });
});

describe('thong-ke-nvl — collectLineParties', () => {
  it('gom kho dòng + máy đích header của phiếu xuất', () => {
    const slip = {
      id: '1',
      ma_phieu_chung: 'PX-1',
      loai: 'xuat',
      ngay: '2026-10-01',
      kho_dich: '',
      nguon_loai: null,
      nguon_id: null,
      dich_loai: 'may',
      dich_id: 'M12C1',
      loai_nhap: null,
      loai_xuat: 'Xuất khác',
      trang_thai: '',
      chi_tiet: []
    };
    const line = { ma_hang: 'NVL-A', kho_dong_ten: 'Kho NVL Chính', may: '' };
    const parties = collectLineParties(slip, line);
    assert.ok(parties.khos.some(k => foldPartyKey(k) === foldPartyKey('Kho NVL Chính')));
    assert.ok(parties.mays.some(m => foldPartyKey(m) === foldPartyKey('M12C1')));
  });

  it('gom máy nguồn dòng của phiếu nhập lại từ máy', () => {
    const slip = {
      id: '2',
      ma_phieu_chung: 'PN-1',
      loai: 'nhap',
      ngay: '2026-10-02',
      kho_dich: 'Kho NVL Phụ',
      nguon_loai: 'may',
      nguon_id: 'M08',
      dich_loai: null,
      dich_id: null,
      loai_nhap: 'Nhập lại từ máy cuối đợt',
      loai_xuat: null,
      trang_thai: '',
      chi_tiet: []
    };
    const line = { ma_hang: 'NVL-B', kho_dong_ten: 'Kho NVL Phụ' };
    const parties = collectLineParties(slip, line);
    assert.ok(parties.mays.some(m => foldPartyKey(m) === foldPartyKey('M08')));
    assert.ok(parties.khos.some(k => foldPartyKey(k) === foldPartyKey('Kho NVL Phụ')));
  });
});

describe('thong-ke-nvl — matchTokenFilter (theo giá trị)', () => {
  const alias = buildPartyAliasKind(
    [{ id: 'MAY01', label: 'MAY01 — Máy Đặc 1' }],
    [{ id: 'Kho NVL Chính', label: 'Kho NVL Chính' }]
  );

  it('nhận máy ghi bằng tên máy thay vì mã', () => {
    const tokens = ['Kho NVL Chính', 'Máy Đặc 1'];
    assert.equal(matchTokenFilter(tokens, setOf('MAY01', 'Máy Đặc 1'), new Set(), alias), true);
  });

  it('nhận máy ghi trong cột kho (biến thể legacy)', () => {
    const tokens = ['MAY01'];
    assert.equal(matchTokenFilter(tokens, setOf('MAY01'), new Set(), alias), true);
  });

  it('loại dòng không liên quan máy đã chọn', () => {
    const tokens = ['Kho NVL Phụ', 'M08'];
    assert.equal(matchTokenFilter(tokens, setOf('MAY01'), new Set(), alias), false);
  });

  it('OR: khớp máy dù kho khác đã chọn', () => {
    const tokens = ['Kho NVL Phụ', 'MAY01'];
    assert.equal(matchTokenFilter(tokens, setOf('MAY01'), setOf('Kho NVL Chính'), alias), true);
  });

  it('OR: khớp kho dù máy khác đã chọn', () => {
    const tokens = ['Kho NVL Chính', 'M08'];
    assert.equal(matchTokenFilter(tokens, setOf('MAY01'), setOf('Kho NVL Chính'), alias), true);
  });

  it('OR: không khớp bên nào thì loại', () => {
    const tokens = ['Kho NVL Phụ', 'M08'];
    assert.equal(matchTokenFilter(tokens, setOf('MAY01'), setOf('Kho NVL Chính'), alias), false);
  });

  it('collectLineTokens gom đủ định danh và bỏ số liệu', () => {
    const slip = {
      id: '1',
      ma_phieu_chung: 'PX-1',
      loai: 'xuat',
      ngay: '2026-10-01',
      kho_dich: '',
      nguon_loai: null,
      nguon_id: null,
      dich_loai: 'may',
      dich_id: 'MAY01',
      loai_nhap: null,
      loai_xuat: 'Xuất khác',
      trang_thai: '',
      chi_tiet: []
    };
    const line = { ma_hang: 'NVL-A', ten_hang: 'Hạt', so_luong: 5, kho_dong_ten: 'Kho NVL Chính' };
    const tokens = collectLineTokens(slip, line);
    assert.ok(tokens.includes('MAY01'));
    assert.ok(tokens.includes('Kho NVL Chính'));
    assert.ok(!tokens.includes('NVL-A'));
    assert.equal(matchTokenFilter(tokens, setOf('MAY01'), setOf('Kho NVL Chính'), alias), true);
  });
});

describe('thong-ke-nvl — matchPartyFilter', () => {
  it('trống cả hai = tất cả', () => {
    const parties = { khos: ['Kho A'], mays: ['M1'] };
    assert.equal(matchPartyFilter(parties, new Set(), new Set()), true);
  });

  it('chọn máy thì dòng khác máy bị loại', () => {
    const parties = { khos: ['Kho NVL Chính'], mays: ['M12C1'] };
    assert.equal(matchPartyFilter(parties, setOf('M12C1'), new Set()), true);
    assert.equal(matchPartyFilter(parties, setOf('M08'), new Set()), false);
  });

  it('chọn cả máy và kho thì phải khớp cả hai', () => {
    const parties = { khos: ['Kho NVL Chính'], mays: ['M12C1'] };
    assert.equal(matchPartyFilter(parties, setOf('M12C1'), setOf('Kho NVL Chính')), true);
    assert.equal(matchPartyFilter(parties, setOf('M12C1'), setOf('Kho NVL Phụ')), false);
    assert.equal(matchPartyFilter(parties, setOf('M08'), setOf('Kho NVL Chính')), false);
  });
});
