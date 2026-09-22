const fs = require('fs');
const src = fs.readFileSync('tests/unit/debug-sotron-slot.mjs', 'utf8');
const idx = src.indexOf('ton_cuoi_ca');
const window_ = src.slice(Math.max(0, idx - 120), idx + 40);
console.log(JSON.stringify(window_));
console.log('codes around ma_npl:', [...window_].map(c => c.codePointAt(0).toString(16)).join(' '));
