import { expect, test } from '@playwright/test';

const APP = 'http://127.0.0.1:3001';

test('verify modal tự điền hiện ten_ghep', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(`${APP}/`);
  const userInput = page.locator('input[autocomplete="username"]');
  if ((await userInput.count()) > 0) {
    await userInput.fill('itvietnhat2026@gmail.com');
    await page.locator('input[autocomplete="current-password"]').fill('123456');
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page.getByRole('button', { name: /đăng nhập/i })).toHaveCount(0, { timeout: 20000 });
  }
  await page.goto(`${APP}/lenh-cat-le`);
  await page.waitForTimeout(2000);
  const createBtn = page.getByRole('button', { name: /tạo mới/i });
  if ((await createBtn.count()) > 0) await createBtn.first().click();
  await page.getByRole('button', { name: /tự điền từ đơn hàng/i }).click();
  await page.waitForTimeout(2000);
  await page.getByPlaceholder(/mã đơn, khách, mã hàng/i).fill('PW-CATLE-DH01');
  await page.waitForTimeout(1500);
  await expect(page.getByText('PW-CATLE-DH01').first()).toBeVisible({ timeout: 15000 });
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.waitForTimeout(1500);
  await expect(page.locator('input[value*="12m"]').first()).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: 'test-results/tu-dien-ten-ghep.png' });
});
