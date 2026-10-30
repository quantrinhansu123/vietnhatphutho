-- Nhật ký thao tác sản phẩm: ai tạo / ai sửa / sửa gì.
-- Chạy trên Supabase SQL Editor (DB chính).

create table if not exists public.san_pham_audit_log (
  id bigserial primary key,
  san_pham_id uuid,
  ma_sp text,
  ma_amis text,
  ten_sp text,
  action text not null check (action in ('create', 'update', 'delete', 'import_create', 'import_update')),
  actor_id text,
  actor_username text,
  actor_name text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists san_pham_audit_log_san_pham_id_idx
  on public.san_pham_audit_log (san_pham_id, created_at desc);

create index if not exists san_pham_audit_log_created_at_idx
  on public.san_pham_audit_log (created_at desc);

create index if not exists san_pham_audit_log_actor_username_idx
  on public.san_pham_audit_log (actor_username);

comment on table public.san_pham_audit_log is 'Log tạo/sửa/xóa san_pham: actor + changes jsonb {field:{old,new}}.';
comment on column public.san_pham_audit_log.changes is 'Với update: map field -> {old,new}. Với create/delete: snapshot các field chính.';

-- Denormalize nhanh trên dòng SP (tuỳ chọn — UI danh sách).
alter table public.san_pham
  add column if not exists created_by_username text,
  add column if not exists created_by_name text,
  add column if not exists updated_by_username text,
  add column if not exists updated_by_name text,
  add column if not exists updated_at timestamptz;

comment on column public.san_pham.created_by_username is 'Tài khoản tạo (denormalize từ audit).';
comment on column public.san_pham.updated_by_username is 'Tài khoản sửa gần nhất (denormalize từ audit).';

select 'OK - san_pham_audit_log + cột created_by/updated_by trên san_pham.' as result;
