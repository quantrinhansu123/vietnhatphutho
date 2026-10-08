import { expect, test } from '@playwright/test';

const APP = 'http://127.0.0.1:3001';

test('chụp ảnh menu Kho và trang Tồn kho', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(`${APP}/`);
  const userInput = page.locator('input[autocomplete="username"]');
  if ((await userInput.count()) > 0) {
    await userInput.fill('itvietnhat2026@gmail.com');
    await page.locator('input[autocomplete="current-password"]').fill('123456');
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page.getByRole('button', { name: /đăng nhập/i })).toHaveCount(0, { timeout: 20000 });
  }
  await page.waitForTimeout(2000);

  // 1. Menu Kho (trang factory-kho liệt kê các card chức năng).
  await page.goto(`${APP}/nha-may/kho`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/menu-kho.png', fullPage: false });

  // 2. Trang Tồn kho.
  await page.goto(`${APP}/ton-kho`);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'test-results/trang-ton-kho.png', fullPage: false });
});
