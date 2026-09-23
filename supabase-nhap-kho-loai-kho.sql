-- nhap_kho.loai_kho theo mã kho mới (quan_ly_kho.ma_kho):
-- kho_thanh_pham | kho_cat_le | kho_tai_che (thay cho thanh_pham/cat_le/tai_che).
-- Phiếu XN giữ loai_kho='san_pham' (nhóm nghiệp vụ, dùng chung báo cáo/tồn).
-- Chạy an toàn khi chạy lại. Chạy trên DB chính (he-thong).
-- Chạy supabase-quan-ly-kho-ma-kho.sql trước cũng được, không bắt buộc.

-- Đúng kho trước (theo ten_kho), mã cũ sau — để dòng ten cắt lẻ nhưng loai cũ không bị gán nhầm TP.
update public.nhap_kho set loai_kho = 'kho_cat_le'
where ten_kho ilike '%cắt lẻ%' or ten_kho ilike '%cat le%';

update public.nhap_kho set loai_kho = 'kho_tai_che'
where ten_kho ilike '%tái chế%' or ten_kho ilike '%tai che%';

update public.nhap_kho set loai_kho = 'kho_hang_hong'
where ten_kho ilike '%hàng hỏng%' or ten_kho ilike '%hang hong%';

update public.nhap_kho set loai_kho = 'kho_thanh_pham'
where loai_kho = 'thanh_pham';

update public.nhap_kho set loai_kho = 'kho_cat_le'
where loai_kho = 'cat_le';

update public.nhap_kho set loai_kho = 'kho_tai_che'
where loai_kho = 'tai_che';

select loai_kho, count(*) as so_dong from public.nhap_kho group by loai_kho order by loai_kho;
