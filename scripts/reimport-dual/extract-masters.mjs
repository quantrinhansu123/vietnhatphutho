import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import XLSX from 'xlsx';

const execFileAsync = promisify(execFile);
const DIR = 'outputs/reimport-dual-20261123';

async function unzipXlsx(xlsxPath, destDir) {
  await rm(destDir, { recursive: true, force: true });
  await mkdir(destDir, { recursive: true });
  const zipPath = path.join(destDir, 'pack.zip');
  await copyFile(xlsxPath, zipPath);
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${path.join(destDir, 'out').replace(/'/g, "''")}' -Force`
  ]);
}

function parseYellowFillIndexes(stylesXml) {
  const fills = [...stylesXml.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((m) => m[1]);
  const yellow = new Set();
  fills.forEach((fill, index) => {
    const fg = fill.match(/<fgColor[^>]*>/);
    if (!fg) return;
    const rgb = fg[0].match(/rgb="([A-Fa-f0-9]{6,8})"/i)?.[1]?.toUpperCase();
    const theme = fg[0].match(/theme="(\d+)"/)?.[1];
    // Common Excel yellow highlight variants used in prior MB meta
    // Only pure highlight yellow. Gold/peach table fills (FFD966, FCE5CD) are NOT exclusions.
    if (rgb && /(?:FFFF00|FFEB9C|FFF2CC|FFFF99)$/.test(rgb)) yellow.add(index);
    // theme-based yellow-ish fills seen in prior imports — keep conservative: only explicit rgb yellows
    void theme;
  });
  return { fillsCount: fills.length, yellowFillIndexes: yellow };
}

function parseCellXfs(stylesXml) {
  const block = stylesXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] || '';
  return [...block.matchAll(/<xf\b([^>]*)\/>|<xf\b([^>]*)>/g)].map((m) => {
    const attrs = m[1] || m[2] || '';
    const fillId = Number(attrs.match(/fillId="(\d+)"/)?.[1] ?? 0);
    return { fillId };
  });
}

function parseRowMeta(sheetXml, yellowFillIndexes, cellXfs) {
  const meta = [];
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^/]*)\/>/g;
  let match;
  while ((match = rowRe.exec(sheetXml))) {
    const attrs = match[1] || match[3] || '';
    const inner = match[2] || '';
    const row = Number(attrs.match(/\br="(\d+)"/)?.[1]);
    if (!row) continue;
    const hidden = /\bhidden="1"/.test(attrs);
    let yellow = false;
    for (const cell of inner.matchAll(/<c\b([^>]*)>/g)) {
      const style = Number(cell[1].match(/\bs="(\d+)"/)?.[1]);
      if (!Number.isFinite(style) || !cellXfs[style]) continue;
      if (yellowFillIndexes.has(cellXfs[style].fillId)) {
        yellow = true;
        break;
      }
    }
    meta.push({ row, hidden, yellow });
  }
  return meta;
}

function encodeCell(col0, row1) {
  let n = col0 + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s + row1;
}

function extractSheet(xlsxPath, sheetName, label) {
  const wb = XLSX.readFile(xlsxPath, { cellNF: true, cellText: true });
  if (!wb.SheetNames.includes(sheetName)) {
    throw new Error(`Missing sheet ${sheetName} in ${xlsxPath}. Have: ${wb.SheetNames.join(' | ')}`);
  }
  const ws = wb.Sheets[sheetName];
  const ref = ws['!ref'];
  if (!ref) throw new Error(`Empty sheet ${sheetName}`);
  const range = XLSX.utils.decode_range(ref);
  const values = [];
  const displayCells = {};
  const missingW = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = encodeCell(c, r + 1);
      const cell = ws[addr];
      if (!cell) {
        row.push(null);
        continue;
      }
      if (cell.t === 'n' || typeof cell.v === 'number') {
        const w = cell.w == null ? null : String(cell.w);
        displayCells[addr] = { v: cell.v, w, z: cell.z || null, t: cell.t };
        if (w == null || w.trim() === '') {
          // blank formatted number — treat as null later; only flag if v is finite non-empty intent
          if (Number.isFinite(cell.v) && cell.v !== 0) missingW.push(addr);
        }
        // Store DISPLAY string into values matrix for conversion columns path
        row.push(w != null && w.trim() !== '' ? w : null);
      } else if (cell.t === 's' || typeof cell.v === 'string') {
        row.push(cell.w != null ? String(cell.w) : String(cell.v ?? ''));
      } else if (cell.t === 'b') {
        row.push(cell.v ? 'TRUE' : 'FALSE');
      } else {
        row.push(cell.w != null ? String(cell.w) : cell.v == null ? null : String(cell.v));
      }
    }
    values.push(row);
  }

  return { sheetName, label, values, displayCells, missingW, range };
}

async function extractWithMeta(xlsxPath, sheetName, label, prefix) {
  const extracted = extractSheet(xlsxPath, sheetName, label);
  const unzipDir = path.join(DIR, `_${prefix}_unzip`);
  await unzipXlsx(xlsxPath, unzipDir);
  const stylesXml = await readFile(path.join(unzipDir, 'out', 'xl', 'styles.xml'), 'utf8');
  const workbookXml = await readFile(path.join(unzipDir, 'out', 'xl', 'workbook.xml'), 'utf8');
  const relsXml = await readFile(path.join(unzipDir, 'out', 'xl', '_rels', 'workbook.xml.rels'), 'utf8');
  const sheets = [...workbookXml.matchAll(/<sheet\b[^>]*>/g)].map((m) => {
    const name = m[0].match(/name="([^"]+)"/)?.[1];
    const rid = m[0].match(/r:id="([^"]+)"/)?.[1];
    return { name, rid };
  });
  const target = sheets.find((s) => s.name === sheetName);
  if (!target) throw new Error(`Sheet ${sheetName} not in workbook.xml`);
  const targetPath = relsXml.match(new RegExp(`Id="${target.rid}"[^>]*Target="([^"]+)"`))?.[1];
  if (!targetPath) throw new Error(`No rel for ${target.rid}`);
  const sheetXml = await readFile(path.join(unzipDir, 'out', 'xl', targetPath.replace(/^\//, '')), 'utf8');
  const { yellowFillIndexes, fillsCount } = parseYellowFillIndexes(stylesXml);
  const cellXfs = parseCellXfs(stylesXml);
  const rowMeta = parseRowMeta(sheetXml, yellowFillIndexes, cellXfs);

  await writeFile(path.join(DIR, `${prefix}-values.json`), JSON.stringify(extracted.values));
  await writeFile(path.join(DIR, `${prefix}-display-cells.json`), JSON.stringify(extracted.displayCells));
  await writeFile(path.join(DIR, `${prefix}-row-meta.json`), JSON.stringify(rowMeta));
  await writeFile(
    path.join(DIR, `${prefix}-extract-summary.json`),
    JSON.stringify(
      {
        sheetName,
        rows: extracted.values.length,
        displayCells: Object.keys(extracted.displayCells).length,
        missingW: extracted.missingW,
        fillsCount,
        yellowFillIndexes: [...yellowFillIndexes],
        rowMeta: {
          total: rowMeta.length,
          hidden: rowMeta.filter((r) => r.hidden).length,
          yellow: rowMeta.filter((r) => r.yellow).length,
          hiddenOrYellow: rowMeta.filter((r) => r.hidden || r.yellow).length
        }
      },
      null,
      2
    )
  );
  return {
    label,
    rows: extracted.values.length,
    displayCells: Object.keys(extracted.displayCells).length,
    missingW: extracted.missingW.length,
    rowMeta: {
      total: rowMeta.length,
      hidden: rowMeta.filter((r) => r.hidden).length,
      yellow: rowMeta.filter((r) => r.yellow).length
    }
  };
}

await mkdir(DIR, { recursive: true });
const mb = await extractWithMeta(
  path.join(DIR, 'master-mb.xlsx'),
  'V01_Thay_doi_DM_QUY_DOI_SP ',
  'mb',
  'mb'
);
const mn = await extractWithMeta(
  path.join(DIR, 'master-mn.xlsx'),
  'V01_sản phẩm miền nam',
  'mn',
  'mn'
);

// Spot-check: compare w vs v for a few MB conversion cells
const display = JSON.parse(await readFile(path.join(DIR, 'mb-display-cells.json'), 'utf8'));
const spot = ['L45', 'N45', 'K45', 'G45', 'L100'].map((addr) => {
  const cell = display[addr];
  return cell
    ? { addr, w: cell.w, v: cell.v, sameAsRaw: String(cell.v) === String(cell.w), z: cell.z }
    : { addr, missing: true };
});
await writeFile(path.join(DIR, 'display-spotcheck.json'), JSON.stringify({ mb: spot }, null, 2));
console.log(JSON.stringify({ mb, mn, spot }, null, 2));
