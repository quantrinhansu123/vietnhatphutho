const fs = require('fs');
const lines = fs.readFileSync('src/utils/soTronPrevShiftTon.ts', 'utf8').split('\n');
for (let i = 109; i <= 121; i += 1) {
  const line = lines[i];
  const codes = [...line].map(c => c.codePointAt(0)).join(',');
  console.log(`line ${i + 1}: ${JSON.stringify(line)}`);
  if (/[^\x09\x0a\x0d\x20-\x7e\u00c0-\u1ef9]/.test(line)) {
    console.log('  NON-STANDARD CHARS:', codes);
  }
}
