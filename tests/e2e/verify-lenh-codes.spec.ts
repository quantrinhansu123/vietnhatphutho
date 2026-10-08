import { expect, test } from '@playwright/test';

const APP = 'http://127.0.0.1:3001';

test('verify lệnh cắt: mã/tên theo quy cách, không ghép lặp', async ({ page }) => {
  test.setTimeout(180000);
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
  await page.getByRole('button', { name: /tạo mới/i }).first().click();
  await page.getByRole('button', { name: /tự điền từ đơn hàng/i }).click();
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/mã đơn, khách, mã hàng/i).fill('PW-DAC-01');
  await page.waitForTimeout(1500);
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.waitForTimeout(1000);
  await page.locator('input[type="checkbox"]').nth(2).check();
  await page.getByRole('button', { name: /điền vào lệnh/i }).click();
  await page.waitForTimeout(1500);

  // Nhập Tổng KG để đủ điều kiện Xem (PW thiếu kg danh mục).
  await page.getByPlaceholder('Tổng KG').fill('99.2');
  await page.getByRole('button', { name: /^xem$/i }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/lenh-detail-codes.png' });

  // Xuất giữ mã gốc; Cắt ghép 1 lần duy nhất (Còn lại-dư dùng chung mã cắt).
  const cutCount = await page.locator('text=PW-DAC-01-1.2li-12m').count();
  expect(cutCount >= 1 && cutCount <= 2).toBeTruthy();
  // Tên ghép của đơn còn nguyên khi chưa sửa quy cách (dòng Cắt + Còn lại-dư).
  await expect(page.locator('text=Tấm nhựa đặc đặc 1.2li*1.22m - 1.2li - 12m')).not.toHaveCount(0);

  // Sửa DÀI 12 → 10 rồi Xem lại: mã/tên phải theo số mới, không dồn 12m-10.
  await page.locator('input[value="12"]').first().fill('10');
  await page.waitForTimeout(1000);
  // Bỏ xác nhận cũ (Ẩn) rồi Xem lại với số mới.
  await page.getByRole('button', { name: /^ẩn$/i }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /^xem$/i }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/lenh-detail-edited.png' });
  await expect(page.locator('text=PW-DAC-01-1.2li-10m')).not.toHaveCount(0);
  await expect(page.locator('text=PW-DAC-01-1.2li-20m')).not.toHaveCount(0);
  await expect(page.locator('text=12m-10')).toHaveCount(0);
  await expect(page.locator('text=Tấm nhựa đặc đặc 1.2li*1.22m - 1.2li - 12m')).toHaveCount(0);
});
