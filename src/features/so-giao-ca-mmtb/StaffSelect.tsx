import React, { useEffect, useMemo, useState } from 'react';
import { normalizeHrBranches } from '../_shared/hr';
import { Select2 } from '../../components/shared/Select2';

const key = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '_');

/** Phòng ban (cột `phong_ban` bảng `nhan_su`) cho từng vai trò. */
const DEPT_TRUONG_CA_KEY = key('PHÂN XƯỞNG SẢN XUẤT');
const DEPT_KIEM_TRA_KEY = key('Phòng điều Hành');

export function StaffSelect({ kind, value, onChange, dropdownParent }: {
  kind: 'production' | 'inspector'; value: string; onChange: (value: string) => void;
  /** Gắn dropdown vào phần tử này (modal xem trước) để không bị cắt bởi overflow / z-index. */
  dropdownParent?: HTMLElement | null;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(false);
    // format=list chỉ trả [{name}] (mất phòng ban) → dùng format=groups&scope=all
    // để có đủ phong_ban rồi lọc ở client theo yêu cầu:
    // Trưởng ca: phong_ban = 'PHÂN XƯỞNG SẢN XUẤT'
    // Người kiểm tra: phong_ban = 'Phòng điều Hành'
    fetch('/api/nhan-su?format=groups&scope=all').then(async res => {
      if (!res.ok) throw new Error('Không tải được nhân sự');
      const data = await res.json();
      const targetKey = kind === 'inspector' ? DEPT_KIEM_TRA_KEY : DEPT_TRUONG_CA_KEY;
      const matches = normalizeHrBranches(data).flatMap(b => b.departments.flatMap(d =>
        key(d.name || '') === targetKey ? d.members.map(m => m.name) : []
      ));
      if (active) {
        setNames([...new Set(matches)].sort((a, b) => a.localeCompare(b, 'vi')));
        setIsLoading(false);
      }
    }).catch(() => { if (active) { setLoadError(true); setIsLoading(false); } });
    return () => { active = false; };
  }, [kind]);

  const placeholder = isLoading
    ? 'Đang tải nhân sự...'
    : loadError
      ? 'Không tải được danh sách nhân sự'
      : names.length === 0
        ? 'Chưa có nhân sự phù hợp'
        : kind === 'production' ? 'Gõ để tìm Trưởng ca' : 'Gõ để tìm Người kiểm tra';

  const select2Options = useMemo(() => ({
    allowClear: true,
    minimumResultsForSearch: 0,
    placeholder,
    language: {
      noResults: () => 'Không tìm thấy nhân sự phù hợp.',
      searching: () => 'Đang tìm...'
    }
  }), [placeholder]);

  const refreshKey = useMemo(
    () => `${kind}::${names.join('|')}`,
    [kind, names]
  );

  const showSavedValue = Boolean(value && !names.includes(value));
  const isDisabled = isLoading || loadError || (names.length === 0 && !showSavedValue);

  return (
    <Select2
      aria-label={kind === 'production' ? 'Trưởng ca' : 'Người kiểm tra'}
      value={value}
      onValueChange={onChange}
      select2Options={select2Options}
      refreshKey={refreshKey}
      disabled={isDisabled}
      dropdownParent={dropdownParent}
      className="w-full text-[14px] border border-slate-300 rounded px-2 py-1 bg-white"
    >
      <option value="">{placeholder}</option>
      {showSavedValue && <option value={value}>{value} (đã lưu)</option>}
      {names.map(name => <option key={name} value={name}>{name}</option>)}
    </Select2>
  );
}
