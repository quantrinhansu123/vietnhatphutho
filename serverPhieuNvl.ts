/**
 * Sổ NVL có kiểm soát: header `phieu_nhap_kho_nvl` + dòng `nhap_kho_nvl` (nhập/xuất dùng chung qua loai_phieu).
 * Trạng thái nháp → đã duyệt → hủy. Duyệt/hủy gọi hàm SQL duyet_phieu_nvl / huy_phieu_nvl.
 * Không ràng buộc cặp mã luồng — chỉ là nhãn do người dùng chọn. SQL: supabase-phieu-nvl-kiem-soat.sql
 */
import type { Express, Response } from 'express';

type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

export type PhieuNvlDeps = {
  openPg: () => Promise<PgClientLike | null>;
};

const LOAI_PHIEU = new Set(['nhap', 'xuat']);
const LOAI_SP_CHAY = new Set(['dac', 'song', 'rong']);
const TRANG_THAI = new Set(['nhap', 'da_duyet', 'huy']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function txt(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s ? s : null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

type HeaderInput = {
  loai_phieu: 'nhap' | 'xuat';
  ngay_phieu: string;
  dot_so: string | null;
  ca: string | null;
  may: string | null;
  loai_sp_chay: string | null;
  kho_nguon: string | null;
  kho_dich: string | null;
  ma_luong: string | null;
  phieu_goc_id: string | null;
  nguoi_lap: string | null;
  ly_do: string | null;
  ghi_chu: string | null;
};

type LineInput = {
  id_danh_muc: string | null;
  ma_nvl: string;
  ten_nvl: string | null;
  ten_sx: string | null;
  don_vi: string | null;
  ten_kho: string;
  so_luong: number;
  gia: number | null;
  trong_luong_kg: number | null;
  phan_loai_nvl: string | null;
  ma_luong: string | null;
  id_dong_nhap_nguon: string | null;
  cp_phu: unknown;
};

function parseBody(body: any): { header?: HeaderInput; lines?: LineInput[]; error?: string } {
  const loai = String(body?.loai_phieu ?? '').trim();
  if (!LOAI_PHIEU.has(loai)) return { error: 'Loại phiếu phải là nhập hoặc xuất.' };
  const ngay = String(body?.ngay_phieu ?? '').slice(0, 10);
  if (!validIsoDate(ngay)) return { error: 'Ngày phiếu không hợp lệ (YYYY-MM-DD).' };
  const loaiSp = txt(body?.loai_sp_chay);
  if (loaiSp && !LOAI_SP_CHAY.has(loaiSp)) return { error: 'Loại SP chạy phải là Đặc, Sóng hoặc Rỗng.' };

  const khoNguon = txt(body?.kho_nguon);
  const khoDich = txt(body?.kho_dich);
  if (loai === 'nhap' && !khoDich) return { error: 'Phiếu nhập phải chọn kho nhập.' };
  if (loai === 'xuat' && !khoNguon) return { error: 'Phiếu xuất phải chọn kho xuất.' };
  if (khoNguon && khoDich && khoNguon.toLowerCase() === khoDich.toLowerCase()) {
    return { error: 'Kho nguồn và kho đích không được trùng nhau.' };
  }

  const rawLines: any[] = Array.isArray(body?.lines) ? body.lines : [];
  if (rawLines.length === 0) return { error: 'Phiếu chưa có dòng NVL.' };

  const defaultKho = loai === 'nhap' ? khoDich : khoNguon;
  const lines: LineInput[] = [];
  for (let i = 0; i < rawLines.length; i += 1) {
    const l = rawLines[i];
    const ma = txt(l?.ma_nvl);
    const sl = num(l?.so_luong);
    if (!ma) return { error: `Dòng ${i + 1}: thiếu mã NVL.` };
    if (sl === null || sl <= 0) return { error: `Dòng ${i + 1}: số lượng phải lớn hơn 0.` };
    const kho = txt(l?.ten_kho) || defaultKho;
    if (!kho) return { error: `Dòng ${i + 1}: thiếu kho.` };
    lines.push({
      id_danh_muc: txt(l?.id_danh_muc),
      ma_nvl: ma,
      ten_nvl: txt(l?.ten_nvl),
      ten_sx: txt(l?.ten_sx),
      don_vi: txt(l?.don_vi),
      ten_kho: kho,
      so_luong: sl,
      gia: num(l?.gia),
      trong_luong_kg: num(l?.trong_luong_kg),
      phan_loai_nvl: txt(l?.phan_loai_nvl),
      ma_luong: txt(l?.ma_luong) || txt(body?.ma_luong),
      id_dong_nhap_nguon: txt(l?.id_dong_nhap_nguon),
      cp_phu: Array.isArray(l?.cp_phu) ? l.cp_phu : null
    });
  }

  return {
    header: {
      loai_phieu: loai as 'nhap' | 'xuat',
      ngay_phieu: ngay,
      dot_so: txt(body?.dot_so),
      ca: txt(body?.ca),
      may: txt(body?.may),
      loai_sp_chay: loaiSp,
      kho_nguon: khoNguon,
      kho_dich: khoDich,
      ma_luong: txt(body?.ma_luong),
      phieu_goc_id: txt(body?.phieu_goc_id),
      nguoi_lap: txt(body?.nguoi_lap),
      ly_do: txt(body?.ly_do),
      ghi_chu: txt(body?.ghi_chu)
    },
    lines
  };
}

function totals(lines: LineInput[]) {
  let soLuong = 0;
  let kg = 0;
  let giaTri = 0;
  for (const l of lines) {
    soLuong += l.so_luong;
    kg += l.trong_luong_kg ?? 0;
    giaTri += l.so_luong * (l.gia ?? 0);
  }
  return { soLuong, kg, giaTri };
}

async function nextMaPhieu(pg: PgClientLike, loai: 'nhap' | 'xuat', ngay: string): Promise<string> {
  const prefix = `${loai === 'nhap' ? 'NK' : 'XK'}-${ngay.slice(2, 4)}${ngay.slice(5, 7)}${ngay.slice(8, 10)}-`;
  const r = await pg.query(
    `select ma_phieu from public.phieu_nhap_kho_nvl where ma_phieu like $1 order by ma_phieu desc limit 1`,
    [`${prefix}%`]
  );
  const last = String(r.rows[0]?.ma_phieu ?? '');
  const seq = last ? Number(last.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(seq + 1).padStart(3, '0')}`;
}

async function insertLines(pg: PgClientLike, maPhieu: string, nguoiLap: string | null, lines: LineInput[]) {
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    await pg.query(
      `insert into public.nhap_kho_nvl
        (phieu_nk, stt, id_danh_muc, ma_nvl, ten_nvl, ten_sx, don_vi, ten_kho, so_luong, gia, thanh_tien,
         trong_luong_kg, phan_loai_nvl, ma_luong, id_dong_nhap_nguon, cp_phu, nguoi_lap)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17)`,
      [
        maPhieu, i + 1, l.id_danh_muc, l.ma_nvl, l.ten_nvl, l.ten_sx, l.don_vi, l.ten_kho, l.so_luong, l.gia,
        l.gia === null ? null : l.so_luong * l.gia, l.trong_luong_kg, l.phan_loai_nvl, l.ma_luong,
        l.id_dong_nhap_nguon, l.cp_phu === null ? null : JSON.stringify(l.cp_phu), nguoiLap
      ]
    );
  }
}

function fail(res: Response, err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  // Lỗi nghiệp vụ từ trigger/hàm SQL (tiếng Việt) trả 400; còn lại 500.
  const business = /Phiếu|Vượt tồn|Không hủy|Không tìm thấy|chưa có/i.test(message);
  return res.status(business ? 400 : 500).json({ error: message || fallback });
}

export function registerPhieuNvlRoutes(app: Express, deps: PhieuNvlDeps) {
  const withPg = async <T>(res: Response, fn: (pg: PgClientLike) => Promise<T>): Promise<T | undefined> => {
    const pg = await deps.openPg();
    if (!pg) {
      res.status(503).json({ error: 'Chưa cấu hình kết nối Postgres (SUPABASE_DB_URL).' });
      return undefined;
    }
    try {
      return await fn(pg);
    } finally {
      await pg.end().catch(() => undefined);
    }
  };

  // ---- Danh mục mã luồng ----
  app.get('/api/ma-luong-nvl', async (_req, res) => {
    try {
      await withPg(res, async pg => {
        const r = await pg.query(`select * from public.ma_luong_nvl order by ma`);
        res.json({ records: r.rows, total: r.rows.length });
      });
    } catch (err) {
      fail(res, err, 'Không tải được mã luồng.');
    }
  });

  app.post('/api/ma-luong-nvl', async (req, res) => {
    const ma = String(req.body?.ma ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,20}$/.test(ma)) return res.status(400).json({ error: 'Mã luồng gồm 2–20 ký tự chữ/số.' });
    try {
      await withPg(res, async pg => {
        const r = await pg.query(
          `insert into public.ma_luong_nvl (ma, ten, kho_mac_dinh, phan_loai, ghi_chu, hoat_dong)
           values ($1,$2,$3,$4,$5,coalesce($6,true))
           on conflict (ma) do update set ten = excluded.ten, kho_mac_dinh = excluded.kho_mac_dinh,
             phan_loai = excluded.phan_loai, ghi_chu = excluded.ghi_chu, hoat_dong = excluded.hoat_dong
           returning *`,
          [ma, String(req.body?.ten ?? '').trim(), txt(req.body?.kho_mac_dinh), txt(req.body?.phan_loai),
           txt(req.body?.ghi_chu), typeof req.body?.hoat_dong === 'boolean' ? req.body.hoat_dong : null]
        );
        res.json({ record: r.rows[0] });
      });
    } catch (err) {
      fail(res, err, 'Không lưu được mã luồng.');
    }
  });

  // ---- Tồn ----
  app.get('/api/phieu-nvl/ton', async (req, res) => {
    const kho = txt(req.query.ten_kho);
    try {
      await withPg(res, async pg => {
        const r = await pg.query(
          `select * from public.v_ton_kho_nvl where ($1::text is null or ten_kho = $1) order by ten_kho, ma_nvl, ten_sx`,
          [kho]
        );
        res.json({ records: r.rows, total: r.rows.length });
      });
    } catch (err) {
      fail(res, err, 'Không tải được tồn NVL.');
    }
  });

  // ---- Luồng giữa các kho: phiếu đã duyệt có đủ kho nguồn và kho đích ----
  // Xuất = phiếu xuất "xuất đến kho", Nhận = phiếu nhập "nhập từ kho". Chênh lệch = hàng đã xuất nhưng kho đích chưa nhận.
  app.get('/api/phieu-nvl/luong-kho', async (req, res) => {
    const from = txt(req.query.from);
    const to = txt(req.query.to);
    if ((from && !validIsoDate(from)) || (to && !validIsoDate(to))) {
      return res.status(400).json({ error: 'Từ/đến ngày không hợp lệ.' });
    }
    try {
      await withPg(res, async pg => {
        const r = await pg.query(
          `select kho_nguon, kho_dich, loai_phieu, count(*)::int as so_phieu,
                  coalesce(sum(so_luong), 0) as tong_sl, coalesce(sum(trong_luong), 0) as tong_kg
           from public.phieu_nhap_kho_nvl
           where trang_thai = 'da_duyet' and kho_nguon is not null and kho_dich is not null
             and ($1::date is null or ngay_phieu >= $1) and ($2::date is null or ngay_phieu <= $2)
           group by kho_nguon, kho_dich, loai_phieu
           order by kho_nguon, kho_dich`,
          [from, to]
        );
        res.json({ records: r.rows, total: r.rows.length });
      });
    } catch (err) {
      fail(res, err, 'Không tải được luồng giữa các kho.');
    }
  });

  // ---- Danh sách phiếu (kèm dòng) ----
  app.get('/api/phieu-nvl', async (req, res) => {
    const from = txt(req.query.from);
    const to = txt(req.query.to);
    const loai = txt(req.query.loai_phieu);
    const tt = txt(req.query.trang_thai);
    if ((from && !validIsoDate(from)) || (to && !validIsoDate(to))) {
      return res.status(400).json({ error: 'Từ/đến ngày không hợp lệ.' });
    }
    if (loai && !LOAI_PHIEU.has(loai)) return res.status(400).json({ error: 'Loại phiếu không hợp lệ.' });
    if (tt && !TRANG_THAI.has(tt)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
    try {
      await withPg(res, async pg => {
        const r = await pg.query(
          `select p.*, coalesce((
              select jsonb_agg(to_jsonb(d) order by d.stt nulls last, d.ma_nvl)
              from public.nhap_kho_nvl d where d.phieu_nk = p.ma_phieu), '[]'::jsonb) as lines
           from public.phieu_nhap_kho_nvl p
           where ($1::date is null or p.ngay_phieu >= $1) and ($2::date is null or p.ngay_phieu <= $2)
             and ($3::text is null or p.loai_phieu = $3) and ($4::text is null or p.trang_thai = $4)
           order by p.ngay_phieu desc nulls last, p.ma_phieu desc
           limit 500`,
          [from, to, loai, tt]
        );
        res.json({ records: r.rows, total: r.rows.length });
      });
    } catch (err) {
      fail(res, err, 'Không tải được danh sách phiếu NVL.');
    }
  });

  // ---- Tạo nháp ----
  app.post('/api/phieu-nvl', async (req, res) => {
    const parsed = parseBody(req.body);
    if (!parsed.header || !parsed.lines) return res.status(400).json({ error: parsed.error });
    const { header: h, lines } = parsed;
    const t = totals(lines);
    try {
      await withPg(res, async pg => {
        await pg.query('begin');
        try {
          const ma = await nextMaPhieu(pg, h.loai_phieu, h.ngay_phieu);
          const kho = h.loai_phieu === 'nhap' ? h.kho_dich : h.kho_nguon;
          const r = await pg.query(
            `insert into public.phieu_nhap_kho_nvl
              (ma_phieu, loai_phieu, ngay_phieu, dot_so, ca, may, loai_sp_chay, kho, kho_nguon, kho_dich, ma_luong,
               phieu_goc_id, nguoi_lap, ly_do, ghi_chu, so_luong, trong_luong, gia_tri, log)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb) returning *`,
            [ma, h.loai_phieu, h.ngay_phieu, h.dot_so, h.ca, h.may, h.loai_sp_chay, kho, h.kho_nguon, h.kho_dich,
             h.ma_luong, h.phieu_goc_id, h.nguoi_lap, h.ly_do, h.ghi_chu, t.soLuong, t.kg, t.giaTri,
             JSON.stringify([{ hanh_dong: 'tao', nguoi: h.nguoi_lap, luc: new Date().toISOString() }])]
          );
          await insertLines(pg, ma, h.nguoi_lap, lines);
          await pg.query('commit');
          res.status(201).json({ record: r.rows[0] });
        } catch (e) {
          await pg.query('rollback').catch(() => undefined);
          throw e;
        }
      });
    } catch (err) {
      fail(res, err, 'Không tạo được phiếu NVL.');
    }
  });

  // ---- Sửa nháp: thay toàn bộ dòng ----
  app.put('/api/phieu-nvl/:id', async (req, res) => {
    const parsed = parseBody(req.body);
    if (!parsed.header || !parsed.lines) return res.status(400).json({ error: parsed.error });
    const { header: h, lines } = parsed;
    const t = totals(lines);
    try {
      await withPg(res, async pg => {
        await pg.query('begin');
        try {
          const cur = await pg.query(`select * from public.phieu_nhap_kho_nvl where id = $1 for update`, [req.params.id]);
          const row = cur.rows[0];
          if (!row) {
            await pg.query('rollback');
            return res.status(404).json({ error: 'Không tìm thấy phiếu.' });
          }
          if (row.trang_thai !== 'nhap') {
            await pg.query('rollback');
            return res.status(400).json({ error: `Phiếu ${row.ma_phieu} đã ${row.trang_thai} — không sửa được.` });
          }
          if (row.loai_phieu !== h.loai_phieu) {
            await pg.query('rollback');
            return res.status(400).json({ error: 'Không đổi loại phiếu khi sửa.' });
          }
          const ma = String(row.ma_phieu);
          await pg.query(`delete from public.nhap_kho_nvl where phieu_nk = $1`, [ma]);
          const kho = h.loai_phieu === 'nhap' ? h.kho_dich : h.kho_nguon;
          const r = await pg.query(
            `update public.phieu_nhap_kho_nvl set ngay_phieu=$2, dot_so=$3, ca=$4, may=$5, loai_sp_chay=$6, kho=$7,
               kho_nguon=$8, kho_dich=$9, ma_luong=$10, phieu_goc_id=$11, nguoi_lap=$12, ly_do=$13, ghi_chu=$14,
               so_luong=$15, trong_luong=$16, gia_tri=$17,
               log = log || jsonb_build_array(jsonb_build_object('hanh_dong','sua','nguoi',$12::text,'luc',now()))
             where id=$1 returning *`,
            [req.params.id, h.ngay_phieu, h.dot_so, h.ca, h.may, h.loai_sp_chay, kho, h.kho_nguon, h.kho_dich,
             h.ma_luong, h.phieu_goc_id, h.nguoi_lap, h.ly_do, h.ghi_chu, t.soLuong, t.kg, t.giaTri]
          );
          await insertLines(pg, ma, h.nguoi_lap, lines);
          await pg.query('commit');
          res.json({ record: r.rows[0] });
        } catch (e) {
          await pg.query('rollback').catch(() => undefined);
          throw e;
        }
      });
    } catch (err) {
      fail(res, err, 'Không sửa được phiếu NVL.');
    }
  });

  // ---- Duyệt / hủy (logic nằm trong hàm SQL) ----
  app.post('/api/phieu-nvl/:id/duyet', async (req, res) => {
    const nguoi = txt(req.body?.nguoi) || 'không rõ';
    try {
      await withPg(res, async pg => {
        await pg.query(`select public.duyet_phieu_nvl($1::uuid, $2)`, [req.params.id, nguoi]);
        res.json({ ok: true });
      });
    } catch (err) {
      fail(res, err, 'Không duyệt được phiếu.');
    }
  });

  app.post('/api/phieu-nvl/:id/huy', async (req, res) => {
    const nguoi = txt(req.body?.nguoi) || 'không rõ';
    const lyDo = txt(req.body?.ly_do);
    if (!lyDo) return res.status(400).json({ error: 'Cần nhập lý do hủy.' });
    try {
      await withPg(res, async pg => {
        await pg.query(`select public.huy_phieu_nvl($1::uuid, $2, $3)`, [req.params.id, nguoi, lyDo]);
        res.json({ ok: true });
      });
    } catch (err) {
      fail(res, err, 'Không hủy được phiếu.');
    }
  });
}
