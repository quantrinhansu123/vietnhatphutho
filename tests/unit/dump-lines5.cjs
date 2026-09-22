const fs = require('fs');
const lines = fs.readFileSync('src/utils/soTronPrevShiftTon.ts', 'utf8').split('\n');
// In full codepoints cho cac dong tu 110 toi het file (vung buildTonMap + ham moi + log tam)
for (let i = 109; i < lines.length; i += 1) {
  const line = lines[i];
  const nonAscii = [...line].map((c, j) => ({ c, j, cp: c.codePointAt(0) })).filter(x => x.cp > 127);
  if (nonAscii.length > 0) {
    console.log(`line ${i + 1}:`);
    for (const x of nonAscii) console.log(`  col ${x.j} ${JSON.stringify(x.c)} U+${x.cp.toString(16).toUpperCase()}`);
  }
}
console.log('done');
