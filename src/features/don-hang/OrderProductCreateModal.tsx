import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ProductEditModal,
  productToForm,
  productFormToPayload,
  normalizeProducts,
  composeProductFormProductionName,
  defaultProductWastePercent,
  type ProductFormState,
  type ProductRow
} from '../san-pham';
import { appendSouthTemToTenGhep } from '../_shared/orderHelpers';
import type { OrderProductConversion } from '../_shared/orderHelpers';
import {
  classifyProductPxGroup,
  doLiDmWeightScale,
  hasZemInName,
  normalizeDoLiDm,
  productionNameAmisGrade,
  productionNameHasKg,
  rewriteOrderVariantProductName,
  songStandardDinhMucKg,
  seedProductionSpecs,
  stripBareKgToken
} from '../../utils/productProductionName';
import { productApiHeaders } from '../../utils/productActorHeaders';
import { editVariantConversion, positiveNumber, validateVariantConversions, variantConversion } from './variantConversions';

type SongDmFields = Pick<ProductFormState, 'group' | 'doDaiM' | 'tenGoc' | 'dinhMucKg'>;

/** Sóng: điền ĐM kg tấm 6m khi mở form. Sau khi người dùng sửa ô thì giữ số đã gõ. */
export function resolveSongCreateDinhMuc<T extends SongDmFields>(
  form: T,
  sheetKg: string,
  sourceHasKg: boolean,
  keepManual: boolean
): T {
  if (classifyProductPxGroup(form.group) !== 'song') return form;
  if (keepManual) return { ...form, tenGoc: stripBareKgToken(form.tenGoc) };
  if (!sourceHasKg) return form;
  const dinhMucKg = songStandardDinhMucKg(sheetKg, form.doDaiM);
  if (!dinhMucKg) return form;
  return { ...form, dinhMucKg, tenGoc: stripBareKgToken(form.tenGoc) };
}

export type ProductSnapshot = { product: ProductRow; conversions: OrderProductConversion[] };
export async function fetchProductSnapshot(id: string): Promise<ProductSnapshot> {
  const res = await fetch(`/api/san-pham/${encodeURIComponent(id)}/with-conversions`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể đọc sản phẩm và quy đổi.');
  const product = normalizeProducts([data.product])[0];
  if (product?.id !== id || !Array.isArray(data.conversions) || data.conversions.some((row: OrderProductConversion) => row.sanPhamId !== id)) throw new Error('Dữ liệu sản phẩm hoặc quy đổi không đầy đủ.');
  return { product, conversions: data.conversions };
}

export function OrderProductCreateModal({ source, projection, specs, projectCode, onClose, onSaved }: {
  source: ProductSnapshot;
  projection: { code: string; name: string; productionName: string };
  specs: { width: string; length: string; doLi: string; doLiDm: string; mang: string; tem: string; mauTem: string; danTem2Dau: boolean; kgPerSheet: string };
  projectCode: (form: ProductFormState) => string;
  onClose: () => void;
  onSaved: (saved: ProductSnapshot) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<ProductSnapshot | null>(null);
  const [pendingId, setPendingId] = useState('');
  const busy = useRef(false);
  const editedConversion = useRef(false);
  const noZem = !hasZemInName(source.product.productionName, source.product.name);
  const sourceHasKg = productionNameHasKg(
    [source.product.productionName, source.product.tenGhep, source.product.name].filter(Boolean).join(' ')
  );
  const dmKgEdited = useRef(false);
  const projectCodeRef = useRef(projectCode);
  projectCodeRef.current = projectCode;
  const initialForm = useMemo(() => {
    const form = productToForm(source.product, source.conversions);
    const seeded = seedProductionSpecs({ tenSanXuat: projection.productionName, maAmis: projection.code, nhomVthh: form.group });
    const doLi = noZem ? specs.tem || specs.doLi || seeded.doLi : '';
    const doDayM = specs.width || form.doDayM;
    const doDaiM = specs.length || form.doDaiM;
    const doLiDm = noZem
      ? (normalizeDoLiDm(specs.doLiDm || form.doLiDm || seeded.doLiDm, 'li') || '')
      : '';
    const name = rewriteOrderVariantProductName({
      name: projection.name || form.name,
      group: form.group,
      doLi,
      widthM: doDayM,
      lengthM: doDaiM
    });
    const next = {
      ...form, ...seeded,
      code: '', newCode: '', amisCode: projection.code,
      // Thêm SP từ đơn: không lưu / không hiện Mã AMIS cũ.
      amisOldCode: '',
      name,
      productionName: projection.productionName,
      // Để trống → ô canonical ở chế độ tự động theo thông số.
      tenGhepManual: '',
      doDayM,
      doDaiM,
      doLi,
      doLiDm,
      dinhMucKg: classifyProductPxGroup(form.group) === 'song' ? (seeded.dinhMucKg || form.dinhMucKg) : '',
      mang: specs.mang,
      tcmb: Boolean(seeded.tcmb),
      wastePercent: form.wastePercent.trim() || defaultProductWastePercent(form.group),
      openingStock: '', inbound: '', outbound: '', stock: '',
      conversions: form.conversions.map(row => variantConversion(row, {
        width: specs.width, length: specs.length,
        weightScale: noZem && specs.doLiDm && specs.doLiDm !== form.doLiDm
          ? doLiDmWeightScale(specs.doLiDm, form.doLiDm) : 1,
        kgPerSheet: specs.kgPerSheet
      }))
    };
    const first = next.conversions[0];
    const standardized = resolveSongCreateDinhMuc(next, first?.trongLuongKgTam || '', sourceHasKg, false);
    Object.assign(next, standardized);
    next.totalWeight = first?.trongLuongKgTam || '';
    const productionName = appendSouthTemToTenGhep(composeProductFormProductionName(next), '', '', false);
    next.productionName = productionName;
    const grade = productionNameAmisGrade(next.productionName);
    if (grade && !new RegExp(`(^|[\\s-])${grade === 'NP' ? 'NP2?' : grade}(?=[\\s-]|$)`, 'iu').test(next.amisCode)) {
      next.amisCode = projectCodeRef.current(next);
    }
    return next;
    // projectCode qua ref — tránh initialForm đổi mỗi render làm reset form modal.
  }, [source, projection, specs, noZem]);

  const transformProductionForm = (next: ProductFormState, previous: ProductFormState): ProductFormState => {
    const thicknessChanged = next.doLiDm !== previous.doLiDm;
    const dimensionsChanged = next.doDayM !== previous.doDayM || next.doDaiM !== previous.doDaiM;
    const base = editedConversion.current ? previous : productToForm(source.product, source.conversions);
    // Không khóa kgPerSheet từ specs đơn: đổi khổ / mét dài / ĐM phải tính lại kg/Tấm và kg/Cuộn.
    const weightScale = !noZem
      ? 1
      : next.doLiDm.trim() && base.doLiDm.trim() && next.doLiDm !== base.doLiDm
        ? doLiDmWeightScale(next.doLiDm, base.doLiDm)
        : 1;
    const conversions = thicknessChanged || dimensionsChanged
      ? base.conversions.map(row => variantConversion(row, {
          width: next.doDayM,
          length: next.doDaiM,
          weightScale
        }))
      : next.conversions;
    const doLiDm = next.doLiDm.trim() && !/\bkg\b/iu.test(next.doLiDm)
      ? (normalizeDoLiDm(next.doLiDm, 'li') || next.doLiDm)
      : next.doLiDm;
    const withDm = { ...next, doLiDm };
    if (next.dinhMucKg !== previous.dinhMucKg) dmKgEdited.current = true;
    const standardized = resolveSongCreateDinhMuc(
      withDm,
      conversions[0]?.trongLuongKgTam || '',
      sourceHasKg,
      dmKgEdited.current
    );
    // Thêm SP từ đơn: tên SX/tên ghép không gắn Dán Tem / Màu tem / 2 Đầu.
    const productionName = appendSouthTemToTenGhep(composeProductFormProductionName(standardized), '', '', false);
    const name = rewriteOrderVariantProductName({
      name: withDm.name || source.product.name,
      group: withDm.group,
      doLi: withDm.doLi,
      widthM: withDm.doDayM,
      lengthM: withDm.doDaiM
    });
    const first = conversions[0];
    const unit = withDm.unit.toLocaleLowerCase('vi');
    const totalWeight = unit === 'cuộn'
      ? (first?.trongLuongKgCuon || '')
      : (first?.trongLuongKgTam || first?.trongLuongKgCuon || '');
    return {
      ...standardized,
      name,
      conversions,
      productionName,
      tenGhepManual: '',
      amisCode: projectCode(withDm),
      totalWeight
    };
  };

  const finishRead = async (id: string) => {
    const saved = await fetchProductSnapshot(id);
    const readError = validateVariantConversions(productToForm(saved.product, saved.conversions).conversions, saved.product.unit);
    if (readError || !saved.conversions.length) throw new Error(readError || 'Sản phẩm đã lưu nhưng chưa đọc được quy đổi. Bấm Thêm mới để thử đọc lại.');
    onSaved(saved);
  };

  const save = async (form: ProductFormState) => {
    if (busy.current || duplicate) return;
    const validation = validateVariantConversions(form.conversions, form.unit);
    if (!form.amisCode.trim() || !form.name.trim() || !form.productionName.trim() || !form.group.trim() || !form.unit.trim()) {
      setError('Vui lòng nhập đủ mã AMIS, tên sản phẩm, tên sản xuất, nhóm VTHH và đơn vị tính.'); return;
    }
    if (validation) { setError(validation); return; }
    if (form.unit.toLocaleLowerCase('vi') === 'tấm' && (!positiveNumber(form.doDayM) || !positiveNumber(form.doDaiM))) {
      setError('Cần nhập khổ rộng và mét dài hợp lệ trong thông số sản xuất.'); return;
    }
    busy.current = true; setIsSaving(true); setError('');
    try {
      if (pendingId) { await finishRead(pendingId); return; }
      const payload = productFormToPayload({
        ...form,
        amisOldCode: '',
        totalWeight: form.conversions[0].trongLuongKgTam
      }, { includeProduction: true });
      const res = await fetch('/api/san-pham', { method: 'POST', headers: productApiHeaders(), body: JSON.stringify({ ...payload, createOrReuse: true }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể lưu sản phẩm.');
      const id = String(data.product?.id || '');
      if (!id) throw new Error('Server không trả về ID sản phẩm đã lưu.');
      // Trùng bộ ma_amis + ten_sp + ten_san_xuat → không tạo mới, báo bằng modal.
      if (data.reused) {
        const saved = await fetchProductSnapshot(id).catch(() => null);
        setDuplicate(saved || {
          product: {
            ...source.product,
            id,
            amisCode: form.amisCode,
            name: form.name,
            productionName: form.productionName
          },
          conversions: []
        });
        return;
      }
      setPendingId(id);
      await finishRead(id);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Không thể lưu sản phẩm.');
    } finally { busy.current = false; setIsSaving(false); }
  };

  return createPortal(<>
    <ProductEditModal mode="add" product={null} warehouseOptions={[]} enableProductionFields
      productConversions={source.conversions}
      initialForm={initialForm} transformProductionForm={transformProductionForm}
      hideAmisOldCode
      calculateConversion={(row, key) => { editedConversion.current = true; return key ? editVariantConversion(row, key, row[key]) : row; }}
      overlayClassName="fixed inset-0 z-[100] flex items-end justify-center bg-zinc-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      isSaving={isSaving || Boolean(duplicate)} formError={error}
      isReadOnly={Boolean(pendingId)} saveLabel={pendingId ? 'Đọc lại quy đổi đã lưu' : undefined}
      onClose={() => { if (!busy.current) onClose(); }} onSave={save} />
    {duplicate && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label="Không thể tạo mới sản phẩm" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-zinc-900">Không thể tạo mới</h3>
        <p className="mt-3 text-sm text-zinc-700">
          Đã có sản phẩm trùng bộ <span className="font-semibold">Mã AMIS + Tên sản phẩm + (Tên sản xuất hoặc Tên ghép)</span>. Không tạo thêm bản ghi mới.
        </p>
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
          <div><span className="font-semibold">Mã AMIS:</span> {duplicate.product.amisCode || '—'}</div>
          <div className="mt-1"><span className="font-semibold">Tên sản phẩm:</span> {duplicate.product.name || '—'}</div>
          <div className="mt-1"><span className="font-semibold">Tên sản xuất:</span> {duplicate.product.productionName || '—'}</div>
          {duplicate.product.tenGhep && duplicate.product.tenGhep !== duplicate.product.productionName ? (
            <div className="mt-1"><span className="font-semibold">Tên ghép:</span> {duplicate.product.tenGhep}</div>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700" onClick={() => setDuplicate(null)}>Đóng</button>
        </div>
      </div>
    </div>}
  </>, document.body);
}
