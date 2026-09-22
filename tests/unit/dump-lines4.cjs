const fs = require('fs');
const src = fs.readFileSync('src/utils/soTronPrevShiftTon.ts', 'utf8');
// tim moi vi tri 'ma' + '_' + 'nvl'-like
const re = /ma_.{0,2}vl/g;
let m;
while ((m = re.exec(src)) !== null) {
  const start = Math.max(0, m.index - 30);
  const seg = src.slice(m.index, m.index + 8);
  const lineNo = src.slice(0, m.index).split('\n').length;
  console.log(`line ${lineNo}:`, JSON.stringify(seg), 'codes:', [...seg].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' '));
}
