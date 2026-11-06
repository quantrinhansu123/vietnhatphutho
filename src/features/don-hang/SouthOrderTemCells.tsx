import React, { startTransition, useEffect, useState } from 'react';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import {
  SOUTH_TEM_COLOR_OPTIONS,
  SOUTH_TEM_OPTIONS,
  orderFieldClass,
  southTemColorLabel
} from '../_shared/orderHelpers';

const TEM_OPTIONS = [...SOUTH_TEM_OPTIONS];
const TEM_COLOR_OPTIONS = [...SOUTH_TEM_COLOR_OPTIONS];

function stopRowClick(event: React.SyntheticEvent) {
  event.stopPropagation();
}

type TemPatch = {
  tem?: string;
  mauTem?: string;
  danTem2Dau?: boolean;
};

/**
 * Tem / Màu tem / 2 Đầu không đổi trọng lượng.
 * Click chỉ cập nhật ô ngay; ghi vào form đơn được nhường sau để không chờ render cả lưới.
 */
export function SouthOrderTemCells({
  tem,
  mauTem,
  danTem2Dau,
  onPatch
}: {
  tem: string;
  mauTem: string;
  danTem2Dau: boolean;
  onPatch: (patch: TemPatch) => void;
}) {
  const [temValue, setTemValue] = useState(tem);
  const [colorValue, setColorValue] = useState(mauTem);
  const [twoEnds, setTwoEnds] = useState(danTem2Dau);

  useEffect(() => {
    setTemValue(tem);
  }, [tem]);
  useEffect(() => {
    setColorValue(mauTem);
  }, [mauTem]);
  useEffect(() => {
    setTwoEnds(danTem2Dau);
  }, [danTem2Dau]);

  const commit = (patch: TemPatch) => {
    startTransition(() => onPatch(patch));
  };

  return (
    <>
      <div className="min-w-0" onMouseDown={stopRowClick} onClick={stopRowClick}>
        <SearchableSelect
          value={temValue}
          onChange={next => {
            setTemValue(next);
            commit({ tem: next });
          }}
          options={TEM_OPTIONS}
          placeholder="Chọn/nhập tem"
          getLabel={item => String(item)}
          getValue={item => String(item)}
          allowEmpty
          allowCustomValue
          skipUnchangedBlurCommit
          showAllWhenQueryMatchesSelection
          inputClassName={orderFieldClass}
        />
      </div>
      <div className="min-w-0" onMouseDown={stopRowClick} onClick={stopRowClick}>
        <SearchableSelect
          value={colorValue}
          onChange={next => {
            setColorValue(next);
            commit({ mauTem: next });
          }}
          options={TEM_COLOR_OPTIONS}
          placeholder="Màu tem"
          getLabel={item => String(item)}
          getValue={item => String(item)}
          getOptionLabel={item => southTemColorLabel(String(item)) || String(item)}
          getSearchText={item => `${item} ${southTemColorLabel(String(item))}`}
          allowEmpty
          allowCustomValue
          skipUnchangedBlurCommit
          showAllWhenQueryMatchesSelection
          inputClassName={orderFieldClass}
        />
      </div>
      <div
        className="flex min-w-0 items-center justify-center"
        onMouseDown={stopRowClick}
        onClick={stopRowClick}
      >
        <label className="flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50" title="Dán Tem 2 Đầu">
          <input
            type="checkbox"
            checked={twoEnds}
            onChange={event => {
              const checked = event.target.checked;
              setTwoEnds(checked);
              commit({ danTem2Dau: checked });
            }}
            className="h-4 w-4 accent-emerald-600"
          />
          2 Đầu
        </label>
      </div>
    </>
  );
}
