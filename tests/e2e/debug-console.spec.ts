import { test, expect } from '@playwright/test';

test('debug ton dau', async ({ page }) => {
  page.on('pageerror', err => console.log('[pageerror]', String(err).slice(0, 300)));
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[ton-dau-debug]')) console.log(text.slice(0, 500));
  });
  await page.goto('/');
  await page.waitForTimeout(4000);
  const userInput = page.locator('input[autocomplete="username"]');
  if ((await userInput.count()) > 0) {
    await userInput.fill('itvietnhat2026@gmail.com');
    await page.locator('input[autocomplete="current-password"]').fill('123456');
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await page.waitForTimeout(3000);
  }
  await page.route('**/api/quan-ly-kho*', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [{ ten_kho: 'Kho NVL Chính' }] }) })
  );
  await page.route('**/api/cai-dat*', r =>
    r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ settings: [
        { ma_cai_dat: 'HC1', ten_cai_dat: 'HC1', loai_cai_dat: 'Thời gian', loai_ca: 'Ca8H', thu_tu: 1 },
        { ma_cai_dat: 'HC2', ten_cai_dat: 'HC2', loai_cai_dat: 'Thời gian', loai_ca: 'Ca8H', thu_tu: 2 },
        { ma_cai_dat: 'HC3', ten_cai_dat: 'HC3', loai_cai_dat: 'Thời gian', loai_ca: 'Ca8H', thu_tu: 3 }
      ] })
    })
  );
  await page.route('**/api/kho-nvl*', r =>
    r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ materials: [
        { ma_npl: 'NPL-001', ten_npl: 'Hạt nhựa A', ten_nvl_sx: 'Hạt A SX', don_vi: 'kg', phan_loai: 'nvl_chinh' }
      ] })
    })
  );
  await page.route('**/api/lenh-sx*', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ orders: [] }) })
  );
  await page.route('**/api/danh-sach-may*', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ machines: [{ id: 'm1', ma_may: 'M1', ten_may: 'Máy 1' }] }) })
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  console.log('todayIso:', todayIso);
  const t0 = Date.now();
  const stamp = (m: string) => console.log(`[t+${((Date.now() - t0) / 1000).toFixed(1)}s]`, m);
  await page.route('**/api/so-tron*', r => {
    stamp(`[so-tron request] ${r.request().url()}`);
    return r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ reports: [
        { id: 's1', ngay: todayIso, ca: 'HC1', ma_may: 'M1', ten_may: 'Máy 1',
          bang_ban_giao: [{ material_id: '', ma_nvl: 'NPL-001', ton_cuoi_ca: 55 }] }
      ] })
    });
  });
  await page.route('**/api/nhan-su*', r => r.abort());
  await page.goto('/phieu-xuat-nhap-kho');
  await expect(page.locator('[data-warehouse-slip-form]')).toBeVisible({ timeout: 20000 });
  const form = page.locator('[data-warehouse-slip-form]');
  await form.getByRole('button', { name: 'Xuất kho', exact: true }).click();
  await form.locator('button', { hasText: 'Chọn tên kho' }).click();
  await page.locator('button', { hasText: 'Kho NVL Chính' }).click();
  await page.locator('button', { hasText: 'Chọn máy' }).click();
  await page.locator('button', { hasText: 'M1 - Máy 1' }).click();
  stamp('machine selected');
  await page.locator('label', { hasText: /^HC2$/ }).click();
  stamp('HC2 selected');
  await page.waitForTimeout(2000);
  stamp('after 2s wait');
  const codeInput = page.locator('input[placeholder=""]').first();
  await codeInput.click();
  await codeInput.fill('NPL-001');
  await page.locator('button', { hasText: 'NPL-001 · Hạt nhựa A' }).click();
  stamp('code selected');
  stamp(`code input value now: ${await codeInput.inputValue().catch(() => 'ERR')}`);
  await page.waitForTimeout(3000);
  const val = await page.getByPlaceholder('Tồn ĐC').inputValue().catch(() => 'ERR');
  stamp(`tonDC value: ${JSON.stringify(val)}`);
});
