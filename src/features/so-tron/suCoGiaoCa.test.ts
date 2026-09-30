import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composeSuCo,
  gioSuCo,
  kgSuCo,
  parseSuCo,
  suCoOptionLabel,
  tongSuCo,
  SU_CO_MAU
} from './suCoGiaoCa.ts';

test('Đổi li (trừ giờ) làm tròn 1 số lẻ: 1 lần = 0.3, 2 lần = 0.7', () => {
  assert.equal(gioSuCo('Đổi li (trừ giờ)', '1'), '0.3');
  assert.equal(kgSuCo('Đổi li (trừ giờ)', '1'), '');
  assert.equal(gioSuCo('Đổi li (trừ giờ)', '2'), '0.7');
  assert.equal(suCoOptionLabel(SU_CO_MAU.find(item => item.ten === 'Đổi li (trừ giờ)')!), 'Đổi li (trừ giờ) — 20p');
});

test('Chuyển màu hàng mỏng 2 lần = 2 giờ, chuyển màu sang trắng 1 lần = 150 kg', () => {
  assert.equal(gioSuCo('Chuyển màu hàng mỏng', '2'), '2');
  assert.equal(kgSuCo('Chuyển màu hàng mỏng', '2'), '');
  assert.equal(gioSuCo('Chuyển hàng màu sang hàng trắng', '1'), '');
  assert.equal(kgSuCo('Chuyển hàng màu sang hàng trắng', '1'), '150');
  assert.equal(
    composeSuCo([{ key: 'a', ten: 'Chuyển màu hàng mỏng', lan: '2' }], ''),
    'Chuyển màu hàng mỏng — 2 lần — 2 giờ'
  );
  assert.equal(
    composeSuCo([{ key: 'b', ten: 'Chuyển hàng màu sang hàng trắng', lan: '1' }], ''),
    'Chuyển hàng màu sang hàng trắng — 1 lần — 150 kg'
  );
});

test('parseSuCo đọc format cũ và format mới, chữ ngoài danh mục vào ghi chú', () => {
  const parsed = parseSuCo(
    [
      'Đổi khổ — 1 lần — 1 giờ',
      'Chuyển hàng màu sang hàng trắng — 1 lần — 150 kg',
      'Đổi màu — 2 lần — 1 giờ',
      'Máy dừng giữa ca'
    ].join('\n')
  );
  assert.deepEqual(
    parsed.rows.map(row => row.ten),
    ['Đổi khổ', 'Chuyển hàng màu sang hàng trắng']
  );
  assert.equal(parsed.rows[0].lan, '1');
  assert.equal(parsed.note, 'Đổi màu — 2 lần — 1 giờ\nMáy dừng giữa ca');
  assert.equal(tongSuCo(parsed.rows).gio, 1);
  assert.equal(tongSuCo(parsed.rows).kg, 150);
});
