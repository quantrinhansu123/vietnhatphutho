// Quet ky tu la (Cyrillic, zero-width, fullwidth...) trong cac file da sua.
// Tieng Viet hop le (Latin Extended) KHONG bi bao.
const fs = require('fs');
const files = [
  'src/utils/soTronPrevShiftTon.ts',
  'src/features/phieu-xuat-nhap-kho/nvlSlipLogic.ts',
  'src/features/phieu-xuat-nhap-kho/index.tsx',
  'server.ts',
  'tests/e2e/module1-phieu-nvl.spec.ts',
  'tests/unit/nvlSlipLogic.test.ts',
  'supabase-phieu-xuat-nhap-kho-module1.sql',
  'playwright.config.ts'
];
const risky = /[\u0400-\u04FF\u0370-\u03FF\u200B-\u200F\uFEFF\uFF00-\uFFEF\u00A0\u2010-\u2015\u2212]/g;
let bad = 0;
for (const f of files) {
  let src;
  try {
    src = fs.readFileSync(f, 'utf8');
  } catch { console.log('SKIP (missing):', f); continue; }
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    let m;
    risky.lastIndex = 0;
    while ((m = risky.exec(line)) !== null) {
      bad += 1;
      const ch = m[0];
      console.log(`${f}:${i + 1} col ${m.index} U+${ch.codePointAt(0).toString(16).toUpperCase()} ctx=${JSON.stringify(line.slice(Math.max(0, m.index - 25), m.index + 25))}`);
    }
  });
}
console.log(bad === 0 ? 'CLEAN: khong co ky tu la' : `FOUND ${bad} ky tu la`);
