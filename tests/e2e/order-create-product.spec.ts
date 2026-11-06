import { expect, test } from '@playwright/test';

for (const scenario of ['create', 'reuse', 'read-error', 'save-error', 'south', 'cut', 'np', 'off'] as const) {
test(`tạo sản phẩm ngay trong đơn: ${scenario}`, async ({ page }) => {
  const original = {
    id: '00000000-0000-4000-8000-000000000001', ma_sp: 'SP-GOC', ma_amis: 'STD06-2li*2m',
    ten_sp: 'Tấm đặc', ten_san_xuat: 'NHỰA ĐẶC - STD - 2li - (đm 1.9 li) - 2m - 6m',
    ten_ghep: 'NHỰA ĐẶC - STD - 2li - (đm 1.9 li) - 2m - 6m',
    ten_goc: 'NHỰA ĐẶC', nhom_vthh: 'TP; PX Đặc', don_vi: 'Tấm',
    do_day_m: '2m', do_dai_m: '6m', do_li: '2li', do_li_dm: '(đm 1.9 li)', mang: 'STD'
  };
  if (scenario === 'np' || scenario === 'off') {
    original.ten_san_xuat = original.ten_san_xuat.replace('NHỰA ĐẶC -', `NHỰA ĐẶC - ${scenario === 'np' ? 'NP' : 'off'} -`);
    original.ten_ghep = original.ten_san_xuat;
  }
  const conversion = {
    id: 1, sanPhamId: original.id, khoTamRongM: 2, khoTamDaiM: 6, khoCuonRongM: 2,
    khoCuonDaiM: 30, dienTichM2: 60, trongLuongKgMDai: 2, trongLuongKgM2: 1,
    trongLuongKgTam: 12, trongLuongKgCuon: 60
  };
  let submitted: Record<string, any> | null = null;
  let readBack = false;
  const createdId = '00000000-0000-4000-8000-000000000002';
  await page.addInitScript(() => localStorage.setItem('vietnhat_auth_user_v1', JSON.stringify({
    id: 'test', username: 'test', name: 'Kiểm thử', role: 'admin', fullAccess: true
  })));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown = {};
    if (url.pathname === '/api/san-pham' && request.method() === 'POST') {
      submitted = request.postDataJSON();
      if (scenario === 'save-error') { await route.fulfill({ status: 500, json: { error: 'Không thể lưu quy đổi. Đã hoàn tác sản phẩm mới.' } }); return; }
      body = { success: true, reused: scenario === 'reuse', product: { id: createdId } };
    } else if (url.pathname === `/api/san-pham/${createdId}/with-conversions`) {
      readBack = true;
      if (scenario === 'read-error') { await route.fulfill({ status: 500, json: { error: 'Không thể đọc lại quy đổi đã lưu.' } }); return; }
      const p = submitted!;
      body = { product: { ...original, id: createdId, ma_sp: 'VAR-test', ma_amis: p.amisCode, ma_amis_cu: p.amisOldCode, ten_san_xuat: p.productionName, ten_ghep: p.tenGhep, do_day_m: p.doDayM, do_dai_m: p.doDaiM }, conversions: [{ ...conversion, id: 2, sanPhamId: createdId, khoTamRongM: 1, khoTamDaiM: 3, khoCuonRongM: 1, dienTichM2: 30, trongLuongKgMDai: 1, trongLuongKgTam: scenario === 'reuse' ? 7 : 3, trongLuongKgCuon: 30 }] };
    } else if (url.pathname === `/api/san-pham/${original.id}/with-conversions`) {
      body = { product: original, conversions: [conversion] };
    } else if (url.pathname === '/api/san-pham') body = { products: [original] };
    else if (url.pathname === '/api/bang-quy-doi-san-pham') body = { items: [conversion], total: 1 };
    else if (url.pathname === '/api/don-hang') body = { orders: [] };
    else if (url.pathname === '/api/nhan-su') body = [];
    else if (url.pathname === '/api/khach-hang') body = [];
    await route.fulfill({ json: body });
  });
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.goto('/don-hang');
  await page.getByRole('button', { name: 'Thêm mới', exact: true }).click();
  if (scenario === 'south' || scenario === 'cut' || scenario === 'np' || scenario === 'off') {
    await page.getByText('Loại đơn', { exact: true }).locator('..').getByRole('button').click();
    await page.getByRole('button', { name: scenario !== 'cut' ? 'Đơn miền nam' : 'Đơn cắt lẻ', exact: true }).click();
  }
  const code = page.getByPlaceholder('Tìm Mã AMIS').first();
  await code.fill('STD06');
  await page.getByRole('button', { name: /STD06-2li.*NHỰA ĐẶC/ }).click();
  await code.click();
  await page.getByPlaceholder('Ghi chú', { exact: true }).first().fill('Giữ ghi chú dòng');
  if (scenario === 'create') {
    await page.getByRole('button', { name: 'Nhân bản dòng bên dưới', exact: true }).click();
    await page.getByPlaceholder('Ghi chú', { exact: true }).nth(1).fill('Dòng khác đang chọn');
  }
  const createProductButton = page.getByRole('button', { name: 'Thêm sản phẩm', exact: true }).first();
  expect(await createProductButton.evaluate(button => button.nextElementSibling?.getAttribute('title'))).toBe('Thêm dòng giống sản phẩm này ở bên dưới');
  await createProductButton.click();
  await expect(page.getByRole('heading', { name: 'Thêm sản phẩm mới' })).toBeVisible();
  if (scenario === 'np' || scenario === 'off') {
    await expect(page.getByPlaceholder('Tìm hoặc nhập Mã AMIS')).toHaveValue(new RegExp(`\\b${scenario === 'np' ? 'NP' : 'NP2'}\\b`));
  }
  const modal = page.locator('div.fixed.z-\\[100\\]');
  await modal.getByText('Khổ rộng', { exact: false }).first().locator('..').locator('input').fill('1');
  await modal.getByText('Mét dài', { exact: true }).locator('..').locator('input').fill('3');
  await expect(modal.getByText('Trọng lượng (kg/Tấm)', { exact: true }).locator('..').locator('input')).toHaveValue('3');
  await modal.getByRole('button', { name: 'Thêm mới', exact: true }).click();
  if (scenario === 'save-error' || scenario === 'read-error') {
    await expect(modal.getByText(scenario === 'save-error' ? 'Không thể lưu quy đổi. Đã hoàn tác sản phẩm mới.' : 'Không thể đọc lại quy đổi đã lưu.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Thêm đơn hàng mới' })).toBeVisible();
    expect(browserErrors).toEqual([]);
    return;
  }
  if (scenario === 'reuse') {
    await expect(page.getByRole('heading', { name: 'Không thể tạo mới' })).toBeVisible();
    await expect(page.getByText(/Không tạo thêm bản ghi mới/)).toBeVisible();
    await page.getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Không thể tạo mới' })).toHaveCount(0);
    expect(submitted?.createOrReuse).toBe(true);
    expect(readBack).toBe(false);
    expect(browserErrors).toEqual([]);
    return;
  }
  await expect(page.getByRole('heading', { name: 'Thêm sản phẩm mới' })).toHaveCount(0);
  expect(submitted?.createOrReuse).toBe(true);
  if (scenario === 'np' || scenario === 'off') expect(submitted!.amisCode.match(/\bNP2?\b/gi)).toEqual([scenario === 'np' ? 'NP' : 'NP2']);
  expect(submitted?.conversions).toEqual([{
    sheetWidthM: '1', sheetLengthM: '3', rollWidthM: '1', rollLengthM: '30', areaM2: '30',
    kgPerLinearM: '1', kgPerM2: '1', kgPerSheet: '3', kgPerRoll: '30'
  }]);
  expect(readBack).toBe(true);
  await expect(code).toHaveValue(submitted!.amisCode);
  await expect(page.getByRole('heading', { name: 'Thêm đơn hàng mới' })).toBeVisible();
  await expect(page.getByPlaceholder('Ghi chú', { exact: true }).first()).toHaveValue('Giữ ghi chú dòng');
  if (scenario === 'create') {
    await expect(page.getByPlaceholder('Tìm Mã AMIS').nth(1)).toHaveValue(original.ma_amis);
    await expect(page.getByPlaceholder('Ghi chú', { exact: true }).nth(1)).toHaveValue('Dòng khác đang chọn');
  }
  if (scenario === 'south' || scenario === 'cut') {
    const savedCode = submitted!.amisCode;
    await page.getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click();
    await expect(page.getByPlaceholder('Tìm hoặc nhập Mã AMIS')).toHaveValue(savedCode);
    await modal.getByText('Mét dài', { exact: true }).locator('..').locator('input').fill('4');
    await expect(page.getByPlaceholder('Tìm hoặc nhập Mã AMIS')).toHaveValue(/4m/);
    await expect(page.getByPlaceholder('Tìm hoặc nhập Mã AMIS')).not.toHaveValue(/STD-STD|3m-4m/);
  }
  expect(browserErrors).toEqual([]);
});
}
