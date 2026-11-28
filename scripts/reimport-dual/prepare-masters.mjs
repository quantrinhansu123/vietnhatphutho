import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const DIR = 'outputs/reimport-dual-20261123';
const read = async (p) => JSON.parse(await readFile(`${DIR}/${p}`, 'utf8'));

const txt = (v) => (v == null ? '' : String(v));
const blank = (v) => v == null || txt(v).trim() === '';
const token = (v) => (blank(v) ? null : txt(v).trim());
const unit = (v) =>
  /cuộn/iu.test(txt(v)) && !/tấm/iu.test(txt(v)) ? 'Cuộn' : /tấm/iu.test(txt(v)) ? 'Tấm' : txt(v).trim();
const nkey = (v) => Number(txt(v).replace(/m\s*$/iu, '').replace(',', '.')) || 0;
const identity = (p) => [p.ma_amis, p.ten_sp, p.ten_san_xuat].join('\u0000');

function parseDisplayNumber(w, ctx) {
  if (w == null || String(w).trim() === '') return null;
  const s = String(w).trim().replace(/\s+/g, '').replace(/,/g, '');
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`Invalid display number ${ctx}: ${JSON.stringify(w)}`);
  return n;
}

function uuid(namespace, key) {
  const hex = createHash('sha256').update(`${namespace}\0${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function parseDoDaiTamFromDinhMuc(dinhMucKg) {
  if (!dinhMucKg) return null;
  const m = String(dinhMucKg).match(/\/\s*(\d+(?:[.,]\d+)?)\s*m?/iu);
  return m ? `${String(m[1]).replace(',', '.')}m` : null;
}

function stripTenGoc(raw, nhom) {
  const cleaned = txt(raw)
    .replace(/^(?:NHỰA\s+SÓNG|Tấm\s+nhựa\s+rỗng|Tấm\s+nhựa\s+đặc)\s*[-–—]?\s*/iu, '')
    .trim();
  return cleaned || null;
}

const CONV_FIELDS = [
  'kho_tam_rong_m',
  'kho_tam_dai_m',
  'kho_cuon_rong_m',
  'kho_cuon_dai_m',
  'dien_tich_m2',
  'trong_luong_kg_m_dai',
  'trong_luong_kg_m2',
  'trong_luong_kg_tam',
  'trong_luong_kg_cuon'
];

async function prepareRegion({
  prefix,
  sourceFile,
  sourceSheet,
  mien,
  namespace,
  actor,
  groupCol,
  maps,
  skipHiddenYellow,
  oldProducts,
  otherRegionIds
}) {
  const values = await read(`${prefix}-values.json`);
  const meta = await read(`${prefix}-row-meta.json`);
  const displayCells = await read(`${prefix}-display-cells.json`);
  const sourceBytes = await readFile(`${DIR}/${sourceFile}`);
  const digest = createHash('sha256').update(sourceBytes).digest('hex');
  const batchId = `${actor.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')}-${digest.slice(0, 12)}`;
  const stamp = new Date().toISOString();
  const metaByRow = new Map(meta.map((m) => [m.row, m]));
  const used = new Set();
  const records = [];
  const duplicates = [];
  const grouped = new Map();
  const excluded = { hidden: 0, yellowVisible: 0, noIdentity: 0 };
  const warnings = [];

  const maxRow = values.length;
  for (let rowIndex = 1; rowIndex < maxRow; rowIndex++) {
    const n = rowIndex + 1; // 1-based excel row
    const r = values[rowIndex];
    if (!r) continue;
    const m = metaByRow.get(n);
    if (skipHiddenYellow && m) {
      if (m.hidden) {
        excluded.hidden++;
        continue;
      }
      if (m.yellow) {
        excluded.yellowVisible++;
        continue;
      }
    }
    const ma = token(r[maps.ma]);
    const tenSp = token(r[maps.tenSp]);
    const tenSx = token(r[maps.tenSx]);
    if (!ma || !tenSp || !tenSx) {
      excluded.noIdentity++;
      continue;
    }
    const nhom = token(r[groupCol]);
    if (!nhom || !/^TP;\s*PX (Sóng|Đặc|Rỗng)$/iu.test(nhom)) {
      // Skip NVL / non-finished-good rows in master sheets
      excluded.noIdentity++;
      continue;
    }
    if (/zem/iu.test(tenSx) && /Sóng/iu.test(nhom) && !/ZEM/i.test(tenSx)) {
      // soft: prior MB blocked lowercase zem in composed name; keep as warning only if needed
    }

    const conversion = {};
    for (const [field, col] of Object.entries(maps.conversion)) {
      let w = null;
      if (col != null) {
        // Prefer display cell map by address
        const colLetterIndex = col;
        const addr =
          (colLetterIndex < 26
            ? String.fromCharCode(65 + colLetterIndex)
            : String.fromCharCode(64 + Math.floor(colLetterIndex / 26)) +
              String.fromCharCode(65 + (colLetterIndex % 26))) + n;
        // robust encode:
        const encode = (c0, row1) => {
          let x = c0 + 1;
          let s = '';
          while (x > 0) {
            const rem = (x - 1) % 26;
            s = String.fromCharCode(65 + rem) + s;
            x = Math.floor((x - 1) / 26);
          }
          return s + row1;
        };
        const cell = displayCells[encode(col, n)];
        if (cell) {
          if (cell.w == null || String(cell.w).trim() === '') {
            // Conversion fields must have on-screen text; blank/zero raw is ok as null
            if (Number.isFinite(cell.v) && cell.v !== 0) {
              throw new Error(`${prefix} row ${n} ${field}: numeric cell missing display w (v=${cell.v})`);
            }
            w = null;
          } else {
            w = cell.w;
          }
        } else {
          w = r[col];
        }
      }
      conversion[field] = parseDisplayNumber(w, `${prefix} r${n} ${field}`);
      if (conversion[field] != null && conversion[field] < 0) {
        throw new Error(`${prefix} negative conversion ${field} row ${n}`);
      }
    }

    // MN missing sheet-width conversion column — use Khổ rộng (m) only when it has display text
    if (conversion.kho_tam_rong_m == null && maps.fallbackKhoTamRong != null) {
      const encode = (c0, row1) => {
        let x = c0 + 1;
        let s = '';
        while (x > 0) {
          const rem = (x - 1) % 26;
          s = String.fromCharCode(65 + rem) + s;
          x = Math.floor((x - 1) / 26);
        }
        return s + row1;
      };
      const cell = displayCells[encode(maps.fallbackKhoTamRong, n)];
      if (cell?.w != null && String(cell.w).trim() !== '') {
        conversion.kho_tam_rong_m = parseDisplayNumber(cell.w, `${prefix} r${n} fallback kho_tam_rong`);
      }
    }

    const dinhMucKg = token(r[maps.dinhMucKg]);
    const doDaiTam =
      maps.doDaiTam != null ? token(r[maps.doDaiTam]) : parseDoDaiTamFromDinhMuc(dinhMucKg);

    const product = {
      ma_sp: ma,
      ma_amis: ma,
      ma_amis_cu: ma,
      ten_sp: tenSp,
      ten_san_xuat: tenSx,
      nhom_vthh: nhom,
      don_vi: unit(r[maps.donVi]),
      mien,
      ten_goc: stripTenGoc(r[maps.tenGoc], nhom) || (/phẳng/iu.test(txt(r[maps.songPhang])) ? 'SÓNG PHẲNG' : null),
      so_song: blank(r[maps.soSong]) ? null : txt(Number(txt(r[maps.soSong]).replace(',', '.'))),
      zem: token(r[maps.zem]),
      hang_phe: token(r[maps.hangPhe]),
      mang: token(r[maps.mang]),
      tcmb: !blank(r[maps.tcmb]) && !/^(false|0)$/i.test(txt(r[maps.tcmb])),
      do_li: token(r[maps.doLi]),
      do_li_dm: token(r[maps.doLiDm]),
      dinh_muc_kg: dinhMucKg,
      do_dai_tam_tieu_chuan: doDaiTam,
      kho_rong: token(r[maps.khoRong]),
      do_dai_m: token(r[maps.doDaiM]),
      mau: token(r[maps.mau]),
      gia_re: token(r[maps.giaRe]),
      tcmn: token(r[maps.tcmn]),
      ty_le_hao_hut:
        maps.tyLe != null && !blank(r[maps.tyLe]) ? Number(String(r[maps.tyLe]).replace(',', '.')) : null,
      updated_by_username: actor,
      updated_by_name: batchId,
      updated_at: stamp
    };

    const key = identity(product);
    const prev = grouped.get(key);
    if (prev) {
      if (JSON.stringify(prev.conversion) !== JSON.stringify(conversion)) {
        throw new Error(`${prefix} conflicting duplicate at row ${n} vs ${prev.sourceRows[0]}`);
      }
      prev.sourceRows.push(n);
      duplicates.push({ row: n, firstRow: prev.sourceRows[0] });
      continue;
    }

    let candidates = oldProducts.filter(
      (p) =>
        p.ma_amis === product.ma_amis &&
        p.ten_sp === product.ten_sp &&
        nkey(p.do_dai_m) === nkey(product.do_dai_m) &&
        nkey(p.kho_rong) === nkey(product.kho_rong) &&
        txt(p.mang) === txt(product.mang) &&
        !used.has(p.id)
    );
    const exact = oldProducts.filter((p) => identity(p) === key && !used.has(p.id));
    if (exact.length === 1) candidates = exact;
    const prior = candidates.length === 1 ? candidates[0] : null;
    product.id = prior?.id || uuid(namespace, key);
    if (otherRegionIds.has(product.id)) throw new Error(`${prefix} ID collision with other region ${product.id}`);
    if (used.has(product.id)) throw new Error(`${prefix} ID reused ${product.id}`);
    used.add(product.id);

    if (prior) {
      product.ma_sp = prior.ma_sp;
      product.created_at = prior.created_at;
      product.created_by_username = prior.created_by_username;
      product.created_by_name = prior.created_by_name;
      product.ton_dau_ky = prior.ton_dau_ky;
      product.so_luong_ton_toi_thieu = prior.so_luong_ton_toi_thieu;
      product.mo_ta = prior.mo_ta;
      if (product.ty_le_hao_hut == null) product.ty_le_hao_hut = prior.ty_le_hao_hut ?? null;
    } else {
      product.created_at = stamp;
      product.created_by_username = actor;
      product.created_by_name = batchId;
      product.ton_dau_ky = null;
      product.so_luong_ton_toi_thieu = null;
      product.mo_ta = null;
    }

    const record = { product, conversion, sourceRows: [n], reusedId: Boolean(prior) };
    grouped.set(key, record);
    records.push(record);
  }

  const prepared = {
    batchId,
    sourceFile,
    sourceSheet,
    sourceSha256: digest,
    precision: 'Excel on-screen display (cell.w only); no raw float; no numFmt rounding',
    mien,
    excluded,
    duplicates,
    warnings,
    records
  };
  await writeFile(`${DIR}/prepared-${prefix}.json`, JSON.stringify(prepared));
  return {
    prefix,
    batchId,
    records: records.length,
    reusedIds: records.filter((r) => r.reusedId).length,
    duplicates: duplicates.length,
    excluded,
    groups: Object.fromEntries(
      [...new Set(records.map((r) => r.product.nhom_vthh))].map((g) => [
        g,
        records.filter((r) => r.product.nhom_vthh === g).length
      ])
    )
  };
}

const beforeProducts = await read('before-san_pham.json');
const beforeMb = await read('before-san_pham_mb.json');
const beforeMn = await read('before-san_pham_mn.json');
const oldMb = beforeProducts.filter((p) => p.mien === 'Miền Bắc');
const oldMn = beforeProducts.filter((p) => p.mien === 'Miền Nam');
// Prefer regional snapshots for identity reuse when available
const mbPool = beforeMb.length ? beforeMb : oldMb;
const mnPool = beforeMn.length ? beforeMn : oldMn;

const mbSummary = await prepareRegion({
  prefix: 'mb',
  sourceFile: 'master-mb.xlsx',
  sourceSheet: 'V01_Thay_doi_DM_QUY_DOI_SP ',
  mien: 'Miền Bắc',
  namespace: 'master-mb-v2',
  actor: 'master-data-import-mb',
  groupCol: 15,
  skipHiddenYellow: true,
  oldProducts: mbPool,
  otherRegionIds: new Set(mnPool.map((p) => p.id)),
  maps: {
    ma: 0,
    tenSp: 1,
    tenSx: 3,
    donVi: 5,
    conversion: {
      kho_tam_rong_m: 6,
      kho_tam_dai_m: 7,
      kho_cuon_rong_m: 8,
      kho_cuon_dai_m: 9,
      dien_tich_m2: 10,
      trong_luong_kg_m_dai: 11,
      trong_luong_kg_m2: 12,
      trong_luong_kg_tam: 13,
      trong_luong_kg_cuon: 14
    },
    tyLe: 26,
    tenGoc: 32,
    soSong: 33,
    zem: 34,
    hangPhe: 35,
    mang: 36,
    tcmb: 37,
    doLi: 38,
    doLiDm: 39,
    dinhMucKg: 40,
    doDaiTam: 41,
    khoRong: 42,
    doDaiM: 43,
    mau: 44,
    giaRe: 45,
    tcmn: 46,
    songPhang: 48
  }
});

const mnSummary = await prepareRegion({
  prefix: 'mn',
  sourceFile: 'master-mn.xlsx',
  sourceSheet: 'V01_sản phẩm miền nam',
  mien: 'Miền Nam',
  namespace: 'master-mn-v1',
  actor: 'master-data-import-mn',
  groupCol: 4,
  // MN sheet uses gold fills widely — do not exclude by yellow; only hidden rows
  skipHiddenYellow: false,
  oldProducts: mnPool,
  otherRegionIds: new Set([
    ...mbPool.map((p) => p.id),
    ...(await read('prepared-mb.json')).records.map((r) => r.product.id)
  ]),
  maps: {
    ma: 0,
    tenSp: 1,
    tenSx: 3,
    donVi: 5,
    conversion: {
      // MN sheet lacks khổ tấm rộng in conversion block; start with dài at col 6
      kho_tam_rong_m: null,
      kho_tam_dai_m: 6,
      kho_cuon_rong_m: 7,
      kho_cuon_dai_m: 8,
      dien_tich_m2: 9,
      trong_luong_kg_m_dai: 10,
      trong_luong_kg_m2: 11,
      trong_luong_kg_tam: 12,
      trong_luong_kg_cuon: 13
    },
    fallbackKhoTamRong: 23, // Khổ rộng (m); else will try cuộn rộng via second pass if needed
    tyLe: null,
    tenGoc: 14,
    soSong: 15,
    zem: 16,
    hangPhe: 17,
    mang: 18,
    tcmb: 19,
    doLi: 20,
    doLiDm: 21,
    dinhMucKg: 22,
    doDaiTam: null,
    khoRong: 23,
    doDaiM: 24,
    mau: 25,
    giaRe: 26,
    tcmn: 27,
    songPhang: 29
  }
});

// If MN still missing kho_tam_rong, fill from cuộn rộng display
const preparedMn = await read('prepared-mn.json');
let filledFromCuon = 0;
for (const rec of preparedMn.records) {
  if (rec.conversion.kho_tam_rong_m == null) {
    const row = rec.sourceRows[0];
    const values = await read('mn-values.json');
    const displayCells = await read('mn-display-cells.json');
    const encode = (c0, row1) => {
      let x = c0 + 1;
      let s = '';
      while (x > 0) {
        const rem = (x - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        x = Math.floor((x - 1) / 26);
      }
      return s + row1;
    };
    const cell = displayCells[encode(7, row)];
    const n = parseDisplayNumber(cell?.w ?? values[row - 1]?.[7], `mn fallback cuon rong r${row}`);
    if (n != null) {
      rec.conversion.kho_tam_rong_m = n;
      filledFromCuon++;
    }
  }
}
await writeFile(`${DIR}/prepared-mn.json`, JSON.stringify(preparedMn));

await writeFile(
  `${DIR}/prepare-summary.json`,
  JSON.stringify({ mb: mbSummary, mn: mnSummary, mnFilledKhoTamRongFromCuon: filledFromCuon }, null, 2)
);
console.log(JSON.stringify({ mb: mbSummary, mn: mnSummary, mnFilledKhoTamRongFromCuon: filledFromCuon }, null, 2));
