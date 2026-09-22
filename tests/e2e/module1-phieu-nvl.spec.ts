/**
 * E2E Module 1 — Phieu nhap / xuat NVL + chup anh.
 * Chay: npx playwright test tests/e2e/module1-phieu-nvl.spec.ts
 * Login dung fallback admin offline (itvietnhat2026@gmail.com / 123456),
 * API kho/ca/vat-tu duoc stub de test UI khong phu thuoc backend.
 */
import { test, expect, type Page } from '@playwright/test';

const ADMIN_USER = 'itvietnhat2026@gmail.com';
const ADMIN_PASS = '123456';

async function stubModule1Apis(page: Page) {
  await page.route('**/api/quan-ly-kho*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ records: [{ ten_kho: 'Kho NVL Chính' }] })
    })
  );
  await page.route('**/api/cai-dat*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        settings: [
          { ma_cai_dat: 'HC1', ten_cai_dat: 'HC1', loai_cai_dat: 'Thời gian', loai_ca: 'Ca8H', thu_tu: 1 },
          { ma_cai_dat: 'HC2', ten_cai_dat: 'HC2', loai_cai_dat: 'Thời gian', loai_ca: 'Ca8H', thu_tu: 2 },
          { ma_cai_dat: 'HC3', ten_cai_dat: 'HC3', loai_cai_dat: 'Thời gian', loai_ca: 'Ca8H', thu_tu: 3 },
          { ma_cai_dat: '12C1', ten_cai_dat: '12C1', loai_cai_dat: 'Thời gian', loai_ca: 'Ca12H', thu_tu: 1 },
          { ma_cai_dat: '12C2', ten_cai_dat: '12C2', loai_cai_dat: 'Thời gian', loai_ca: 'Ca12H', thu_tu: 2 }
        ]
      })
    })
  );
  await page.route('**/api/kho-nvl*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        materials: [
          {
            ma_npl: 'NPL-001',
            ten_npl: 'Hạt nhựa A',
            ten_nvl_sx: 'Hạt A SX',
            don_vi: 'kg',
            phan_loai: 'nvl_chinh',
            tong_trong_luong: 25
          },
          {
            ma_npl: 'NPL-002',
            ten_npl: 'Mực in B',
            ten_nvl_sx: 'Mực B SX',
            don_vi: 'kg',
            phan_loai: 'nvl_phu',
            nhom_vat_tu_phu: 'Mực In'
          }
        ]
      })
    })
  );
  await page.route('**/api/lenh-sx*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ orders: [] }) })
  );
  await page.route('**/api/danh-sach-may*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ machines: [{ id: 'm1', ma_may: 'M1', ten_may: 'Máy 1' }] })
    })
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  await page.route('**/api/so-tron*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reports: [
          {
            id: 'so-tron-stub-1',
            ngay: todayIso,
            ca: 'HC1',
            ma_may: 'M1',
            ten_may: 'Máy 1',
            bang_ban_giao: [
              { material_id: '', ma_nvl: 'NPL-001', ten_nvl: 'Hạt nhựa A', ton_cuoi_ca: 55 }
            ]
          }
        ]
      })
    })
  );
  await page.route('**/api/nhan-su*', route => route.abort());
}

async function loginAsAdmin(page: Page) {
  await page.goto('/');
  const userInput = page.locator('input[autocomplete="username"]');
  if ((await userInput.count()) === 0) return;
  await userInput.fill(ADMIN_USER);
  await page.locator('input[autocomplete="current-password"]').fill(ADMIN_PASS);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await expect(page.locator('input[autocomplete="username"]')).toHaveCount(0, { timeout: 20000 });
}

async function openWarehouseSlip(page: Page) {
  await stubModule1Apis(page);
  await page.goto('/phieu-xuat-nhap-kho');
  await expect(page.locator('[data-warehouse-slip-form]')).toBeVisible({ timeout: 20000 });
}

async function chooseTestWarehouse(page: Page) {
  const form = page.locator('[data-warehouse-slip-form]');
  await form.locator('button', { hasText: 'Chọn tên kho' }).click();
  await page.locator('button', { hasText: 'Kho NVL Chính' }).click();
  await expect(form.getByText('Loại: Kho NVL')).toBeVisible();
}

test.describe('Module 1 — phieu nhap / xuat NVL', () => {
  test('phieu nhap: loai nhap + ten SX + them NVL chinh/phu tu kho', async ({ page }) => {
    await loginAsAdmin(page);
    await openWarehouseSlip(page);
    const form = page.locator('[data-warehouse-slip-form]');
    await form.getByRole('button', { name: 'Nhập kho', exact: true }).click();
    await chooseTestWarehouse(page);

    // Loai nhap kho + khong can May + cot Ten san xuat (khong con o snapshot / text Tên SX:).
    await expect(page.getByPlaceholder('Chọn hoặc tự nhập...')).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^Máy$/ })).toHaveCount(0);
    await expect(page.getByText('Tên sản xuất', { exact: true }).first()).toBeVisible();
    await expect(page.locator('input[placeholder="Tên SX (snapshot vào phiếu)"]')).toHaveCount(0);
    await expect(page.getByText('Tên SX:')).toHaveCount(0);

    // Them NVL chinh → dong chinh co combobox load tu kho_nvl (loc dung phan loai).
    await page.locator('button', { hasText: 'Thêm NVL chính' }).click();
    await expect(page.getByText('Nguyên vật liệu chính')).toBeVisible();
    const codeInput = page.locator('input[placeholder=""]').first();
    await codeInput.click();
    await codeInput.fill('NPL-001');
    await expect(page.locator('button', { hasText: 'NPL-001 · Hạt nhựa A' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'NPL-002' })).toHaveCount(0);
    await page.locator('button', { hasText: 'NPL-001 · Hạt nhựa A' }).click();
    await expect(page.getByDisplayValue('Hạt nhựa A')).toBeVisible();
    await expect(page.getByDisplayValue('Hạt A SX')).toBeVisible();

    // Them NVL phu → nam duoi dong chinh (so sanh thu tu DOM 2 header nhom).
    await page.locator('button', { hasText: 'Thêm NVL phụ' }).click();
    await expect(page.getByText('Nguyên vật liệu phụ')).toBeVisible();
    const groupOrder = await page
      .locator('div')
      .filter({ hasText: /^Nguyên vật liệu (chính|phụ)$/ })
      .allInnerTexts();
    const compact = groupOrder.map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const chinhFirst = compact.findIndex(t => t === 'Nguyên vật liệu chính');
    const phuFirst = compact.findIndex(t => t === 'Nguyên vật liệu phụ');
    expect(chinhFirst).toBeGreaterThanOrEqual(0);
    expect(phuFirst).toBeGreaterThan(chinhFirst);
    await page.screenshot({ path: 'test-results/module1-phieu-nhap.png', fullPage: true });
  });

  test('phieu xuat: multi-ca checkbox, khong hien Ton cuoi', async ({ page }) => {
    await loginAsAdmin(page);
    await openWarehouseSlip(page);
    const form = page.locator('[data-warehouse-slip-form]');
    await form.getByRole('button', { name: 'Xuất kho', exact: true }).click();
    await chooseTestWarehouse(page);

    // Ca la checkbox chon nhieu (khong con radio chon 1), khong hien Ton cuoi.
    await expect(page.locator('div', { hasText: 'cùng Loại ca' }).last()).toBeVisible();
    await expect(page.locator('input[name="warehouse-slip-shift"]')).toHaveCount(0);
    await page.locator('label', { hasText: /^HC1$/ }).click();
    await page.locator('label', { hasText: /^HC2$/ }).click();
    await expect(page.getByText(/Đã chọn:.*HC1.*HC2/)).toBeVisible();
    await expect(page.getByText(/Tồn cuối:/)).toHaveCount(0);
    await page.screenshot({ path: 'test-results/module1-phieu-xuat.png', fullPage: true });
  });

  test('phieu xuat: chon Ngay + Ca truoc → Ton dau ca tu so tron', async ({ page }) => {
    await loginAsAdmin(page);
    await openWarehouseSlip(page);
    const form = page.locator('[data-warehouse-slip-form]');
    await form.getByRole('button', { name: 'Xuất kho', exact: true }).click();
    await chooseTestWarehouse(page);

    // Chon may + ca form HC2 → tung dong co Ngay/Ca truoc mac dinh (hom nay + HC1).
    await page.locator('button', { hasText: 'Chọn máy' }).click();
    await page.locator('button', { hasText: 'M1 - Máy 1' }).click();
    await page.locator('label', { hasText: /^HC2$/ }).click();

    // Nhap ma NVL → Ton dau ca tu dong lay ton cuoi so tron (55).
    const codeInput = page.locator('input[placeholder=""]').first();
    await codeInput.click();
    await codeInput.fill('NPL-001');
    await page.locator('button', { hasText: 'NPL-001 · Hạt nhựa A' }).click();
    await expect(page.getByLabel('Ca trước sổ trộn').first()).toHaveValue('HC1');
    await expect(page.getByPlaceholder('Tồn ĐC')).toHaveValue('55', { timeout: 20000 });
    await expect(page.getByDisplayValue('Hạt A SX')).toBeVisible();

    // Doi Ca truoc cua dong sang HC2 (khong co so tron) → ton dau giu / khong doi tu dong.
    await page.getByLabel('Ca trước sổ trộn').first().selectOption('HC2');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/module1-phieu-xuat-ton-dau.png', fullPage: true });
  });

  test('phieu xuat: chan ca khac loai khi luu', async ({ page }) => {
    await loginAsAdmin(page);
    await openWarehouseSlip(page);
    const form = page.locator('[data-warehouse-slip-form]');
    await form.getByRole('button', { name: 'Xuất kho', exact: true }).click();
    await chooseTestWarehouse(page);

    // Chon 2 ca khac loai_ca: HC1 (Ca8H) + 12C1 (Ca12H).
    await page.locator('label', { hasText: /^HC1$/ }).click();
    await page.locator('label', { hasText: /^12C1$/ }).click();
    await page.getByRole('button', { name: /lưu phiếu/i }).click();
    await expect(page.locator('p', { hasText: 'Chỉ được chọn các ca' }).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/module1-phieu-xuat-chan-ca.png', fullPage: true });
  });
});
