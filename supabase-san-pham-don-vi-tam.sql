-- Chuan hoa don_vi: gia tri ghep "CUỐN, TẤM" (va bien the) => 'Tấm'
-- Bang: public.san_pham — cot: don_vi
-- Chay trong Supabase SQL Editor.

-- Preview
select id, ma_sp, ten_sp, don_vi
from public.san_pham
where don_vi is not null
  and (
    trim(don_vi) ilike 'cuốn, tấm'
    or trim(don_vi) ilike 'cuon, tam'
    or trim(don_vi) ilike 'cuộn, tấm'
    or regexp_replace(
      lower(
        translate(
          trim(don_vi),
          'ÁÀẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÉÈẺẼẸÊỀẾỂỄỆÍÌỈĨỊÓÒỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÚÙỦŨỤƯỪỨỬỮỰÝỲỶỸỴĐáàảãạăằắẳẵặâầấẩẫậéèẻẽẹêềếểễệíìỉĩịóòỏõọôồốổỗộơờớởỡợúùủũụưừứửữựýỳỷỹỵđ',
          'AAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYDaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
        )
      ),
      '\s+',
      '',
      'g'
    ) in ('cuon,tam', 'cuon,tam')
  );

-- Cap nhat: "CUỐN, TẤM" / "CUON, TAM" / "Cuộn, Tấm" ... => Tấm
update public.san_pham
set don_vi = 'Tấm'
where don_vi is not null
  and regexp_replace(
    lower(
      translate(
        trim(don_vi),
        'ÁÀẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÉÈẺẼẸÊỀẾỂỄỆÍÌỈĨỊÓÒỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÚÙỦŨỤƯỪỨỬỮỰÝỲỶỸỴĐáàảãạăằắẳẵặâầấẩẫậéèẻẽẹêềếểễệíìỉĩịóòỏõọôồốổỗộơờớởỡợúùủũụưừứửữựýỳỷỹỵđ',
        'AAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYDaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
      )
    ),
    '\s+',
    '',
    'g'
  ) = 'cuon,tam';

-- Kiem tra
select don_vi, count(*) as so_dong
from public.san_pham
group by don_vi
order by so_dong desc;
