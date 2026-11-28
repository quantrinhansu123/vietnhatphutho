import { readFile } from 'node:fs/promises';

const DIR = 'outputs/reimport-dual-20261123';
const sheet = await readFile(`${DIR}/_mb_unzip/out/xl/worksheets/sheet1.xml`, 'utf8');
const hidden1 = [...sheet.matchAll(/\bhidden="1"/g)].length;
const hiddenTrue = [...sheet.matchAll(/\bhidden="true"/g)].length;
const rowTags = [...sheet.matchAll(/<row\b/g)].length;
const sampleHidden = [...sheet.matchAll(/<row\b[^>]*hidden[^>]*>/g)].slice(0, 5).map((m) => m[0]);
const styles = await readFile(`${DIR}/_mb_unzip/out/xl/styles.xml`, 'utf8');
const fills = [...styles.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((m, i) => ({ i, body: m[1].slice(0, 180) }));
const mnMissing = JSON.parse(await readFile(`${DIR}/mn-extract-summary.json`, 'utf8')).missingW;
const display = JSON.parse(await readFile(`${DIR}/mn-display-cells.json`, 'utf8'));
console.log(JSON.stringify({
  rowTags,
  hidden1,
  hiddenTrue,
  sampleHidden,
  fills: fills.slice(0, 15),
  mnMissing,
  mnMissingCells: mnMissing.map((a) => display[a])
}, null, 2));
