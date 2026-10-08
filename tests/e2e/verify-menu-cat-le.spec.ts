import { expect, test } from '@playwright/test';

const APP = 'http://127.0.0.1:3001';

test('verify menu Kho + Cắt lẻ', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(`${APP}/`);
  const userInput = page.locator('input[autocomplete="username"]');
  if ((await userInput.count()) > 0) {
    await userInput.fill('itvietnhat2026@gmail.com');
    await page.locator('input[autocomplete="current-password"]').fill('123456');
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page.getByRole('button', { name: /đăng nhập/i })).toHaveCount(0, { timeout: 20000 });
  }
  await page.goto(`${APP}/nha-may/kho`);
  await page.waitForTimeout(2500);
  await expect(page.getByText('Tồn kho', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Cắt lẻ', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/menu-kho-moi.png' });

  await page.getByText('Cắt lẻ', { exact: true }).first().click();
  await expect(page).toHaveURL(/\/cat-le/, { timeout: 15000 });
  await expect(page.getByText('Lệnh cắt lẻ', { exact: true })).toBeVisible();
  await expect(page.getByText('Báo cáo đơn cắt lẻ', { exact: true })).toBeVisible();
  await expect(page.getByText('Theo dõi cắt lẻ', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/menu-cat-le.png' });
});
