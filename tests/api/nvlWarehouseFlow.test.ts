/**
 * API integration test for NVL. Run explicitly with a known API URL and writes enabled.
 * Cancellation restores stock; canceled slips and their reversal rows remain as audit history,
 * so all created codes carry the API-TEST marker for filtering.
 */
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOAI_XUAT_MAY_PTDM,
  LOAI_XUAT_MAY,
  LOAI_XUAT_PHAN_XUONG,
  LOAI_XUAT_TRA_NCC,
  LOAI_XUAT_PHE_BAM,
  LOAI_XUAT_PHE_CAI,
  LOAI_XUAT_KHAC
} from '../../src/features/xuat-nhap-tong-hop/model';

type RecordRow = Record<string, unknown>;
const base = (process.env.NVL_API_BASE_URL || '').replace(/\/$/, '');
const allowWrites = process.env.NVL_API_TEST_ALLOW_WRITES === '1';
const keepData = process.env.NVL_API_TEST_KEEP_DATA === '1';
const marker = `API-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const codeList = Array.from({ length: 10 }, (_, index) => `${marker}-${String(index + 1).padStart(2, '0')}`);
const createdSlipIds: string[] = [];

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  const body = await response.json().catch(() => ({})) as RecordRow;
  if (!response.ok) throw new Error(`${init?.method || 'GET'} ${path}: HTTP ${response.status} ${String(body.error || '')}`);
  return body;
}

function rows(data: RecordRow, key: string): RecordRow[] {
  return Array.isArray(data[key]) ? data[key] as RecordRow[] : [];
}

async function cleanup() {
  const failures: string[] = [];
  for (const id of [...createdSlipIds].reverse()) {
    try {
      await requestJson(`/api/xuat-nhap-tong-hop/${encodeURIComponent(id)}/huy`, { method: 'POST', body: '{}' });
    } catch (error) {
      failures.push(`Hủy phiếu ${id}: ${String(error)}`);
    }
  }
  if (failures.length === 0) {
    try {
      const catalogData = await requestJson('/api/kho-nvl');
      const testRows = rows(catalogData, 'materials').filter(row => codeList.includes(String(row.ma_npl || '')) && row.id);
      for (const row of testRows) {
        const response = await fetch(`${base}/api/kho-nvl/${encodeURIComponent(String(row.id))}`, { method: 'DELETE' });
        if (!response.ok) failures.push(`Xóa danh mục test ${row.ma_npl}: HTTP ${response.status}`);
      }
    } catch (error) {
      failures.push(`Dọn danh mục NVL test: ${String(error)}`);
    }
  }
  if (failures.length) throw new Error(`Dọn dữ liệu test chưa hoàn tất:\n${failures.join('\n')}`);
}

after(async () => {
  if (allowWrites && base && !keepData) await cleanup();
});

describe('API nhập/xuất NVL với 10 mã × 4 đơn giá', () => {
  it('nhập 40 lớp giá và xuất qua đủ 7 loại', { timeout: 180_000 }, async (context) => {
    if (!allowWrites || !base) {
      context.skip('Cần chủ động đặt NVL_API_TEST_ALLOW_WRITES=1 và NVL_API_BASE_URL trỏ tới API đã xác nhận.');
      return;
    }

    const warehouseData = await requestJson('/api/quan-ly-kho');
    assert.equal(warehouseData.source, 'supabase', 'API test chỉ chạy khi kết nối Supabase');
    const warehouse = rows(warehouseData, 'records').find(row => /kho nvl chính/i.test(String(row.ten_kho || '')));
    const transferWarehouse = rows(warehouseData, 'records').find(row => /kho nvl phụ/i.test(String(row.ten_kho || '')));
    assert.ok(warehouse, 'API test cần Kho NVL chính');
    assert.ok(transferWarehouse, 'API test cần Kho NVL phụ');
    const warehouseName = String(warehouse.ten_kho);
    const otherWarehouseName = String(transferWarehouse.ten_kho);

    const machineData = await requestJson('/api/danh-sach-may');
    const machines = rows(machineData, 'machines');
    const machine = (pattern: RegExp) => machines.find(row => pattern.test(`${row.ma_may || ''} ${row.ten_may || ''}`));
    const mixingMachine = machine(/máy đặc 1/i) || machines[0];
    const crushingMachine = machine(/máy băm/i) || machines[0];
    const pelletMachine = machine(/tạo hạt/i) || machines[0];
    assert.ok(mixingMachine && crushingMachine && pelletMachine, 'API test cần danh mục máy');

    const supplierData = await requestJson('/api/nha-cung-cap');
    const supplier = rows(supplierData, 'suppliers')[0];
    assert.ok(supplier, 'API test cần ít nhất một nhà cung cấp');
    const supplierId = String(supplier.ma_nha_cung_cap || supplier.id || supplier.ten_nha_cung_cap);
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const inboundLines = codeList.flatMap((code, productIndex) =>
      [1, 2, 3, 4].map(priceIndex => ({
        ma_hang: code,
        ten_hang: `NVL API test ${productIndex + 1}`,
        ten_nvl_sx: `API test ${marker}`,
        don_vi: 'kg',
        so_luong: 20,
        don_gia: priceIndex * 1000,
        kho_dong: warehouseName,
        phan_loai_nvl: 'nvl_chinh'
      }))
    );
    const inbound = await requestJson('/api/xuat-nhap-tong-hop', {
      method: 'POST',
      body: JSON.stringify({
        ma_phieu_chung: `${marker}-IN`, loai: 'nhap', ngay: today, ca: 'HC',
        loai_nhap: 'NVL mua ngoài', ly_do: marker, lines: inboundLines
      })
    });
    const inboundId = String((inbound.record as RecordRow | undefined)?.id || '');
    assert.ok(inboundId, 'API nhập phải trả về id phiếu');
    createdSlipIds.push(inboundId);

    for (const code of codeList) {
      const lotData = await requestJson(`/api/phieu-xuat-kho/lo-ton?ma_npl=${encodeURIComponent(code)}`);
      const lots = rows(lotData, 'lots');
      assert.equal(lots.length, 4, `${code} phải có đúng 4 lô/đơn giá sau nhập`);
      assert.deepEqual(lots.map(lot => Number(lot.don_gia)).sort((a, b) => a - b), [1000, 2000, 3000, 4000]);
    }
    if (keepData) {
      console.log(`Giữ dữ liệu kiểm tra: ${marker}; mã=${codeList.join(',')}; kho=${warehouseName}; ngày=${today}`);
    }

    const exportCases = [
      { kind: LOAI_XUAT_MAY_PTDM, destKind: 'may', destId: String(mixingMachine.ma_may) },
      { kind: LOAI_XUAT_MAY, destKind: 'may', destId: String(mixingMachine.ma_may) },
      { kind: LOAI_XUAT_PHAN_XUONG, destKind: 'phan_xuong', destId: 'Đặc' },
      { kind: LOAI_XUAT_TRA_NCC, destKind: 'ncc', destId: supplierId },
      { kind: LOAI_XUAT_PHE_BAM, destKind: 'may', destId: String(pelletMachine.ma_may) },
      { kind: LOAI_XUAT_PHE_CAI, destKind: 'may', destId: String(crushingMachine.ma_may) },
      { kind: LOAI_XUAT_KHAC, destKind: 'kho', destId: otherWarehouseName }
    ];
    for (const [index, item] of exportCases.entries()) {
      const code = codeList[index];
      const lotData = await requestJson(`/api/phieu-xuat-kho/lo-ton?ma_npl=${encodeURIComponent(code)}`);
      const lot = rows(lotData, 'lots').find(row => Number(row.don_gia) === (index % 4 + 1) * 1000);
      assert.ok(lot, `${code} cần lô đúng giá trước khi xuất`);
      const outgoing = await requestJson('/api/xuat-nhap-tong-hop', {
        method: 'POST',
        body: JSON.stringify({
          ma_phieu_chung: `${marker}-OUT-${index + 1}`, loai: 'xuat', ngay: today, ca: 'HC',
          loai_xuat: item.kind, dot_so: '1', ly_do: marker,
          lines: [{
            ma_hang: code, ten_hang: `NVL API test ${index + 1}`, ten_nvl_sx: `API test ${marker}`,
            don_vi: 'kg', so_luong: 1, don_gia: Number(lot.don_gia),
            src_loai: 'kho', src_id: warehouseName,
            dich_dong_loai: item.destKind, dich_dong_id: item.destId,
            id_dong_nhap_nguon: lot.id, ma_phieu_nhap_nguon: lot.ma_phieu
          }]
        })
      });
      const outgoingId = String((outgoing.record as RecordRow | undefined)?.id || '');
      assert.ok(outgoingId, `API phải lưu loại xuất: ${item.kind}`);
      createdSlipIds.push(outgoingId);
    }

    const catalogData = await requestJson(`/api/kho-nvl?ten_kho=${encodeURIComponent(warehouseName)}`);
    const catalogRows = rows(catalogData, 'materials');
    assert.equal(codeList.filter(code => catalogRows.some(row => String(row.ma_npl) === code)).length, 10,
      'API nhập phải tạo/ghép 10 mã danh mục test');
  });
});
