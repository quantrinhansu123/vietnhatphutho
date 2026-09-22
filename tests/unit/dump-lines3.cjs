const fs = require('fs');
const lines = fs.readFileSync('src/utils/soTronPrevShiftTon.ts', 'utf8').split('\n');
// dong 118 (index 117): const maNvl = str(line.ma_nvl).toLowerCase();
const target = lines[117];
console.log(JSON.stringify(target));
const idx = target.indexOf('line.');
const seg = target.slice(idx, idx + 15);
console.log('segment:', JSON.stringify(seg));
console.log('codes:', [...seg].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' '));
// doi chieu: quet toan file tim ky tu Cyrillic/Greek/Homoglyph pho bien
const src = lines.join('\n');
const suspicious = [...src].filter(c => {
  const cp = c.codePointAt(0);
  return (cp >= 0x400 && cp <= 0x4ff) || (cp >= 0x370 && cp <= 0x3ff) || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfeff;
});
console.log('suspicious count:', suspicious.length, suspicious.map(c => 'U+' + c.codePointAt(0).toString(16)).join(' '));
