/**
 * API quản trị schema + dữ liệu bảng public (menu Data).
 * Identifier whitelist; DDL có confirm; không nhận SQL thô từ client.
 */
import type { Express, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const ALLOWED_TYPES = new Set([
  'text',
  'uuid',
  'boolean',
  'integer',
  'bigint',
  'numeric',
  'double precision',
  'date',
  'timestamptz',
  'jsonb'
]);

const BLOCKED_TABLES = new Set([
  'schema_migrations',
  'supabase_migrations',
  'spatial_ref_sys'
]);

type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

export type DataAdminDeps = {
  supabase: SupabaseClient | null;
  /** Mở kết nối Postgres tạm; caller phải end(). */
  openPg: () => Promise<PgClientLike | null>;
  /** URL project + service key — fallback catalog qua PostgREST OpenAPI khi chưa có PG. */
  supabaseUrl?: string | null;
  serviceKey?: string | null;
};

type SchemaSource = 'postgres' | 'rest';

function isMissingPgConfig(error: unknown): boolean {
  return error instanceof Error && /Chưa cấu hình kết nối Postgres/i.test(error.message);
}

function getRestAuth(deps: DataAdminDeps): { url: string; key: string } {
  const url = String(deps.supabaseUrl || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(
    deps.serviceKey || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || ''
  ).trim();
  if (!url || !key) {
    throw new Error('Thiếu SUPABASE_URL hoặc service key để đọc schema qua REST.');
  }
  return { url, key };
}

async function fetchOpenApiSchema(deps: DataAdminDeps): Promise<Record<string, unknown>> {
  const { url, key } = getRestAuth(deps);
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/openapi+json'
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Không đọc được OpenAPI PostgREST (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

function mapOpenApiType(prop: Record<string, unknown>): { dataType: string; udtName: string } {
  const format = String(prop.format || '').toLowerCase();
  const type = String(prop.type || '').toLowerCase();
  if (format === 'uuid') return { dataType: 'uuid', udtName: 'uuid' };
  if (format === 'date') return { dataType: 'date', udtName: 'date' };
  if (format === 'timestamp with time zone' || format === 'timestamptz') {
    return { dataType: 'timestamp with time zone', udtName: 'timestamptz' };
  }
  if (format === 'double precision' || format === 'float8') {
    return { dataType: 'double precision', udtName: 'float8' };
  }
  if (type === 'integer') return { dataType: 'integer', udtName: 'int4' };
  if (type === 'number') return { dataType: 'numeric', udtName: 'numeric' };
  if (type === 'boolean') return { dataType: 'boolean', udtName: 'bool' };
  if (type === 'object' || format === 'jsonb') return { dataType: 'jsonb', udtName: 'jsonb' };
  if (type === 'array') return { dataType: 'ARRAY', udtName: '_text' };
  return { dataType: type || 'text', udtName: type || 'text' };
}

async function listPublicTablesViaRest(deps: DataAdminDeps) {
  const schema = await fetchOpenApiSchema(deps);
  const definitions = (schema.definitions || {}) as Record<string, Record<string, unknown>>;
  return Object.keys(definitions)
    .filter(name => IDENT_RE.test(name) && !BLOCKED_TABLES.has(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map(name => {
      const def = definitions[name] || {};
      const properties = (def.properties || {}) as Record<string, unknown>;
      return {
        name,
        estimatedRows: 0,
        columnCount: Object.keys(properties).length
      };
    });
}

async function listColumnsViaRest(deps: DataAdminDeps, table: string) {
  const schema = await fetchOpenApiSchema(deps);
  const definitions = (schema.definitions || {}) as Record<string, Record<string, unknown>>;
  const def = definitions[table];
  if (!def) {
    throw new Error(`Không tìm thấy bảng public.${table}`);
  }
  const properties = (def.properties || {}) as Record<string, Record<string, unknown>>;
  const required = new Set(
    Array.isArray(def.required) ? def.required.map(item => String(item)) : []
  );
  let ordinal = 0;
  return Object.entries(properties).map(([name, prop]) => {
    ordinal += 1;
    const mapped = mapOpenApiType(prop || {});
    const description = String(prop.description || '');
    const isPrimaryKey = /primary key/i.test(description);
    return {
      name,
      dataType: mapped.dataType,
      udtName: mapped.udtName,
      isNullable: !required.has(name) && !isPrimaryKey,
      columnDefault: null,
      ordinalPosition: ordinal,
      isPrimaryKey
    };
  });
}

function quoteIdent(name: string): string {
  if (!IDENT_RE.test(name)) {
    throw new Error(`Tên không hợp lệ: ${name}`);
  }
  return `"${name}"`;
}

function assertTableName(name: string): string {
  const table = String(name || '').trim();
  if (!IDENT_RE.test(table) || BLOCKED_TABLES.has(table.toLowerCase())) {
    throw new Error('Tên bảng không hợp lệ.');
  }
  return table;
}

function assertColumnName(name: string): string {
  const column = String(name || '').trim();
  if (!IDENT_RE.test(column)) {
    const shown = column || '(trống)';
    throw new Error(
      `Tên cột không hợp lệ: "${shown}". Chỉ dùng a-z, A-Z, 0-9, dấu _ và phải bắt đầu bằng chữ hoặc _.`
    );
  }
  return column;
}

function assertType(raw: string): string {
  const type = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error(`Kiểu không được phép: ${raw}. Cho phép: ${[...ALLOWED_TYPES].join(', ')}`);
  }
  return type;
}

async function withPg<T>(openPg: DataAdminDeps['openPg'], fn: (client: PgClientLike) => Promise<T>): Promise<T> {
  const client = await openPg();
  if (!client) {
    throw new Error(
      'Chưa cấu hình kết nối Postgres (SUPABASE_DB_URL hoặc SUPABASE_DB_PASSWORD + SUPABASE_URL).'
    );
  }
  try {
    return await fn(client);
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

async function listPublicTables(client: PgClientLike) {
  const result = await client.query(
    `
    SELECT
      c.relname AS name,
      COALESCE(s.n_live_tup, 0)::bigint AS estimated_rows,
      (
        SELECT COUNT(*)::int
        FROM information_schema.columns col
        WHERE col.table_schema = 'public' AND col.table_name = c.relname
      ) AS column_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE 'pg_%'
    ORDER BY c.relname
    `
  );
  return result.rows.map(row => ({
    name: String(row.name),
    estimatedRows: Number(row.estimated_rows || 0),
    columnCount: Number(row.column_count || 0)
  }));
}

async function listColumns(client: PgClientLike, table: string) {
  const result = await client.query(
    `
    SELECT
      col.column_name AS name,
      col.data_type AS data_type,
      col.udt_name AS udt_name,
      col.is_nullable AS is_nullable,
      col.column_default AS column_default,
      col.ordinal_position AS ordinal_position,
      CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_pk
    FROM information_schema.columns col
    LEFT JOIN (
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
    ) pk ON pk.column_name = col.column_name
    WHERE col.table_schema = 'public' AND col.table_name = $1
    ORDER BY col.ordinal_position
    `,
    [table]
  );
  return result.rows.map(row => ({
    name: String(row.name),
    dataType: String(row.data_type || ''),
    udtName: String(row.udt_name || ''),
    isNullable: String(row.is_nullable || '') === 'YES',
    columnDefault: row.column_default == null ? null : String(row.column_default),
    ordinalPosition: Number(row.ordinal_position || 0),
    isPrimaryKey: Boolean(row.is_pk)
  }));
}

async function ensureTableExists(client: PgClientLike, table: string) {
  const result = await client.query(
    `
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = $1
    LIMIT 1
    `,
    [table]
  );
  if (result.rows.length === 0) {
    throw new Error(`Không tìm thấy bảng public.${table}`);
  }
}

function sendError(res: Response, error: unknown, fallback = 'Lỗi Data Admin.') {
  const message = error instanceof Error ? error.message : fallback;
  const status =
    /không hợp lệ|không được phép|không tìm thấy|phải khớp|confirm/i.test(message) ? 400 : 500;
  res.status(status).json({ error: message });
}

export function registerDataAdminRoutes(app: Express, deps: DataAdminDeps) {
  const { supabase, openPg } = deps;

  app.get('/api/data/tables', async (_req, res) => {
    try {
      let tables;
      let source: SchemaSource = 'postgres';
      try {
        tables = await withPg(openPg, listPublicTables);
      } catch (error) {
        if (!isMissingPgConfig(error)) throw error;
        tables = await listPublicTablesViaRest(deps);
        source = 'rest';
      }
      res.json({ tables, source, ddlEnabled: source === 'postgres' });
    } catch (error) {
      sendError(res, error, 'Không tải được danh sách bảng.');
    }
  });

  app.post('/api/data/tables', async (req, res) => {
    try {
      const name = assertTableName(String(req.body?.name || ''));
      const columnsInput = Array.isArray(req.body?.columns) ? req.body.columns : [];
      const normalizedCols = columnsInput
        .map(raw => ({
          name: String((raw as { name?: string })?.name || '').trim(),
          type: String((raw as { type?: string })?.type || 'text'),
          nullable: Boolean((raw as { nullable?: boolean })?.nullable),
          primaryKey: Boolean((raw as { primaryKey?: boolean })?.primaryKey)
        }))
        .filter(col => col.name.length > 0);
      if (normalizedCols.length === 0) {
        throw new Error('Cần ít nhất 1 cột.');
      }
      const parts: string[] = [];
      let hasPk = false;
      const seen = new Set<string>();
      for (const raw of normalizedCols) {
        const col = assertColumnName(raw.name);
        if (seen.has(col.toLowerCase())) {
          throw new Error(`Trùng tên cột: "${col}".`);
        }
        seen.add(col.toLowerCase());
        const type = assertType(raw.type);
        const nullable = raw.nullable;
        const isPk = raw.primaryKey;
        if (isPk) hasPk = true;
        parts.push(
          `${quoteIdent(col)} ${type}${isPk ? ' PRIMARY KEY' : ''}${nullable || isPk ? '' : ' NOT NULL'}`
        );
      }
      if (!hasPk) {
        if (seen.has('id')) {
          throw new Error(
            'Chưa chọn PK. Hệ thống muốn tự thêm cột id, nhưng bạn đã có cột "id" — hãy tick PK cho cột id, hoặc đổi tên cột id.'
          );
        }
        parts.unshift(`${quoteIdent('id')} uuid PRIMARY KEY DEFAULT gen_random_uuid()`);
      }
      const sql = `CREATE TABLE ${quoteIdent(name)} (${parts.join(', ')})`;
      await withPg(openPg, async client => {
        await client.query(sql);
      });
      res.status(201).json({ ok: true, name });
    } catch (error) {
      sendError(res, error, 'Không tạo được bảng.');
    }
  });

  app.delete('/api/data/tables/:table', async (req, res) => {
    try {
      const table = assertTableName(req.params.table);
      const confirmName = String(req.body?.confirmName || '').trim();
      if (confirmName !== table) {
        throw new Error('confirmName phải khớp tên bảng để xóa.');
      }
      await withPg(openPg, async client => {
        await ensureTableExists(client, table);
        await client.query(`DROP TABLE ${quoteIdent(table)} CASCADE`);
      });
      res.json({ ok: true, name: table });
    } catch (error) {
      sendError(res, error, 'Không xóa được bảng.');
    }
  });

  app.get('/api/data/tables/:table/columns', async (req, res) => {
    try {
      const table = assertTableName(req.params.table);
      let columns;
      let source: SchemaSource = 'postgres';
      try {
        columns = await withPg(openPg, async client => {
          await ensureTableExists(client, table);
          return listColumns(client, table);
        });
      } catch (error) {
        if (!isMissingPgConfig(error)) throw error;
        columns = await listColumnsViaRest(deps, table);
        source = 'rest';
      }
      res.json({ table, columns, source, ddlEnabled: source === 'postgres' });
    } catch (error) {
      sendError(res, error, 'Không tải được cột.');
    }
  });

  app.post('/api/data/tables/:table/columns', async (req, res) => {
    try {
      const table = assertTableName(req.params.table);
      const column = assertColumnName(String(req.body?.name || ''));
      const type = assertType(String(req.body?.type || 'text'));
      const nullable = req.body?.nullable !== false;
      await withPg(openPg, async client => {
        await ensureTableExists(client, table);
        await client.query(
          `ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(column)} ${type}${
            nullable ? '' : ' NOT NULL'
          }`
        );
      });
      res.status(201).json({ ok: true, table, column });
    } catch (error) {
      sendError(res, error, 'Không thêm được cột.');
    }
  });

  app.patch('/api/data/tables/:table/columns/:column', async (req, res) => {
    try {
      const table = assertTableName(req.params.table);
      const column = assertColumnName(req.params.column);
      const newNameRaw = String(req.body?.newName || '').trim();
      const newTypeRaw = String(req.body?.type || '').trim();
      const setNullable = req.body?.nullable;

      await withPg(openPg, async client => {
        await ensureTableExists(client, table);
        if (newNameRaw && newNameRaw !== column) {
          const newName = assertColumnName(newNameRaw);
          await client.query(
            `ALTER TABLE ${quoteIdent(table)} RENAME COLUMN ${quoteIdent(column)} TO ${quoteIdent(newName)}`
          );
        }
        const targetCol = newNameRaw && newNameRaw !== column ? assertColumnName(newNameRaw) : column;
        if (newTypeRaw) {
          const type = assertType(newTypeRaw);
          await client.query(
            `ALTER TABLE ${quoteIdent(table)} ALTER COLUMN ${quoteIdent(targetCol)} TYPE ${type} USING ${quoteIdent(
              targetCol
            )}::${type}`
          );
        }
        if (setNullable === true) {
          await client.query(
            `ALTER TABLE ${quoteIdent(table)} ALTER COLUMN ${quoteIdent(targetCol)} DROP NOT NULL`
          );
        } else if (setNullable === false) {
          await client.query(
            `ALTER TABLE ${quoteIdent(table)} ALTER COLUMN ${quoteIdent(targetCol)} SET NOT NULL`
          );
        }
      });
      res.json({ ok: true, table });
    } catch (error) {
      sendError(res, error, 'Không sửa được cột.');
    }
  });

  app.delete('/api/data/tables/:table/columns/:column', async (req, res) => {
    try {
      const table = assertTableName(req.params.table);
      const column = assertColumnName(req.params.column);
      const confirmName = String(req.body?.confirmName || '').trim();
      if (confirmName !== column) {
        throw new Error('confirmName phải khớp tên cột để xóa.');
      }
      await withPg(openPg, async client => {
        await ensureTableExists(client, table);
        await client.query(
          `ALTER TABLE ${quoteIdent(table)} DROP COLUMN ${quoteIdent(column)} CASCADE`
        );
      });
      res.json({ ok: true, table, column });
    } catch (error) {
      sendError(res, error, 'Không xóa được cột.');
    }
  });

  app.get('/api/data/tables/:table/rows', async (req, res) => {
    try {
      const table = assertTableName(req.params.table);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const filterColumnRaw = String(req.query.column || '').trim();
      const filterColumn = filterColumnRaw ? assertColumnName(filterColumnRaw) : '';
      const valuesRaw = Array.isArray(req.query.values)
        ? req.query.values.map(item => String(item))
        : String(req.query.values || '')
            .split('\u001f')
            .flatMap(part => part.split(','))
            .map(item => item.trim())
            .filter(Boolean);
      // Client gửi values dạng JSON array khi có ký tự đặc biệt.
      let filterValues: unknown[] = valuesRaw;
      const valuesJson = String(req.query.valuesJson || '').trim();
      if (valuesJson) {
        try {
          const parsed = JSON.parse(valuesJson);
          if (Array.isArray(parsed)) filterValues = parsed;
        } catch {
          // giữ valuesRaw
        }
      }

      try {
        await withPg(openPg, async client => {
          await ensureTableExists(client, table);
        });
      } catch (error) {
        if (!isMissingPgConfig(error)) throw error;
      }

      if (!supabase) {
        throw new Error('Supabase chưa được cấu hình.');
      }

      let query = supabase.from(table).select('*', { count: 'exact' });
      if (filterColumn && filterValues.length > 0) {
        const hasNull = filterValues.some(value => value === null || value === '__null__');
        const concrete = filterValues.filter(value => value !== null && value !== '__null__');
        const formatInItem = (value: unknown) => {
          if (typeof value === 'number' || typeof value === 'boolean') return String(value);
          const text = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          return `"${text}"`;
        };
        if (hasNull && concrete.length > 0) {
          query = query.or(
            `${filterColumn}.is.null,${filterColumn}.in.(${concrete.map(formatInItem).join(',')})`
          );
        } else if (hasNull) {
          query = query.is(filterColumn, null);
        } else {
          query = query.in(filterColumn, concrete as Array<string | number | boolean>);
        }
      }

      const result = await query.range(offset, offset + limit - 1);
      if (result.error) throw new Error(result.error.message);
      res.json({
        table,
        rows: result.data || [],
        count: result.count ?? (result.data || []).length,
        limit,
        offset,
        filter: filterColumn
          ? { column: filterColumn, values: filterValues }
          : null
      });
    } catch (error) {
      sendError(res, error, 'Không tải được dữ liệu.');
    }
  });

  /** Giá trị phân biệt của 1 cột — dùng cho bộ lọc checkbox (gõ để tìm). */
  app.get('/api/data/tables/:table/distinct', async (req, res) => {
    try {
      const table = assertTableName(req.params.table);
      const column = assertColumnName(String(req.query.column || '').trim());
      const q = String(req.query.q || '').trim().toLowerCase();
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));

      try {
        await withPg(openPg, async client => {
          await ensureTableExists(client, table);
        });
      } catch (error) {
        if (!isMissingPgConfig(error)) throw error;
      }

      if (!supabase) throw new Error('Supabase chưa được cấu hình.');

      const result = await supabase.from(table).select(column).limit(Math.min(2000, limit * 10));
      if (result.error) throw new Error(result.error.message);

      const seen = new Set<string>();
      const values: Array<{ value: unknown; label: string }> = [];
      for (const row of result.data || []) {
        const raw = (row as Record<string, unknown>)[column];
        const key = raw == null ? '__null__' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
        if (seen.has(key)) continue;
        seen.add(key);
        const label = raw == null ? '(null)' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
        if (q && !label.toLowerCase().includes(q)) continue;
        values.push({ value: raw == null ? '__null__' : raw, label });
        if (values.length >= limit) break;
      }
      values.sort((a, b) => a.label.localeCompare(b.label, 'vi'));
      res.json({ table, column, values, count: values.length });
    } catch (error) {
      sendError(res, error, 'Không tải được giá trị cột.');
    }
  });

  app.post('/api/data/tables/:table/rows', async (req, res) => {
    try {
      const table = assertTableName(req.params.table);
      const values =
        req.body?.values && typeof req.body.values === 'object'
          ? (req.body.values as Record<string, unknown>)
          : {};
      await withPg(openPg, async client => ensureTableExists(client, table));
      if (!supabase) throw new Error('Supabase chưa được cấu hình.');
      const result = await supabase.from(table).insert(values).select('*').single();
      if (result.error) throw new Error(result.error.message);
      res.status(201).json({ row: result.data });
    } catch (error) {
      sendError(res, error, 'Không thêm được dòng.');
    }
  });

  app.patch('/api/data/tables/:table/rows', async (req, res) => {
    try {
      const table = assertTableName(req.params.table);
      const match =
        req.body?.match && typeof req.body.match === 'object'
          ? (req.body.match as Record<string, unknown>)
          : {};
      const values =
        req.body?.values && typeof req.body.values === 'object'
          ? (req.body.values as Record<string, unknown>)
          : {};
      if (Object.keys(match).length === 0) {
        throw new Error('Thiếu khóa match để cập nhật.');
      }
      await withPg(openPg, async client => ensureTableExists(client, table));
      if (!supabase) throw new Error('Supabase chưa được cấu hình.');
      let query = supabase.from(table).update(values);
      for (const [key, value] of Object.entries(match)) {
        assertColumnName(key);
        query = query.eq(key, value as string | number | boolean);
      }
      const result = await query.select('*');
      if (result.error) throw new Error(result.error.message);
      res.json({ rows: result.data || [] });
    } catch (error) {
      sendError(res, error, 'Không cập nhật được dòng.');
    }
  });

  app.delete('/api/data/tables/:table/rows', async (req, res) => {
    try {
      const table = assertTableName(req.params.table);
      const match =
        req.body?.match && typeof req.body.match === 'object'
          ? (req.body.match as Record<string, unknown>)
          : {};
      if (Object.keys(match).length === 0) {
        throw new Error('Thiếu khóa match để xóa.');
      }
      await withPg(openPg, async client => ensureTableExists(client, table));
      if (!supabase) throw new Error('Supabase chưa được cấu hình.');
      let query = supabase.from(table).delete();
      for (const [key, value] of Object.entries(match)) {
        assertColumnName(key);
        query = query.eq(key, value as string | number | boolean);
      }
      const result = await query.select('*');
      if (result.error) throw new Error(result.error.message);
      res.json({ rows: result.data || [] });
    } catch (error) {
      sendError(res, error, 'Không xóa được dòng.');
    }
  });

}
