import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

test('CSS bản in PTĐM đặt khổ A4 ngang', () => {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
  assert.match(css, /@page mixing-norm-ratio-page\s*\{\s*size:\s*A4 landscape;/);
  assert.match(css, /page:\s*mixing-norm-ratio-page;/);
});

test('toPrintDoc ưu tiên ngày phiếu lưu sẵn (không phụ thuộc import PNG)', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/MixingNormRatioPrintSheet.tsx'),
    'utf8'
  );
  assert.match(source, /ngay:\s*row\.ngay\s*\|\|\s*localTodayIso\(\)/);
  assert.match(source, /function localTodayIso/);
});
