-- kho_nvl.loai_kho — mã kho (quan_ly_kho.ma_kho), nguồn thật để lọc NVL theo kho.
-- ten_kho giữ để hiển thị + tương thích cũ; đổi tên kho không vỡ tồn nhờ loai_kho.
-- Dùng khi chuyển kho / nhập / xuất cần biết NVL đang ở kho nào
-- (Kho NVL chính / Kho NVL phụ / Kho PC...).
-- Chạy an toàn khi chạy lại. Chạy trên DB chính (he-thong).

alter table public.kho_nvl
  add column if not exists loai_kho text;

create index if not exists kho_nvl_loai_kho_idx on public.kho_nvl (loai_kho);

comment on column public.kho_nvl.loai_kho is 'Mã kho (quan_ly_kho.ma_kho): kho_nvl, kho_nvl_chinh, kho_nvl_phu, kho_pc... Nguồn thật để lọc NVL theo kho.';

-- Backfill từ quan_ly_kho theo tên kho (khớp tuyệt đối; lệch tên thì server tự resolve lúc ghi).
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'quan_ly_kho'
  ) then
    update public.kho_nvl as k
    set loai_kho = q.ma_kho
    from public.quan_ly_kho as q
    where (k.loai_kho is null or btrim(k.loai_kho) = '')
      and q.ma_kho is not null and btrim(q.ma_kho) <> ''
      and btrim(k.ten_kho) <> ''
      and btrim(k.ten_kho) = btrim(q.ten_kho);
  end if;
end $$;

select loai_kho, count(*) as so_dong from public.kho_nvl group by loai_kho order by loai_kho;
