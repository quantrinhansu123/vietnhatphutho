import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CheckSquare, GripVertical, Plus, Square, X } from 'lucide-react';
import {
  MIXING_NORM_CATEGORIES,
  MIXING_NORM_OTHER_CATEGORY,
  buildMixingNormProductSignals,
  classifyMixingNormCategory,
  mixingNormCategoryById,
  mixingNormCategoryGroupLabel,
  type MixingNormCategoryDef,
  type MixingNormCategoryGroup
} from '../utils/mixingNormProductCategories';

export type MixingNormGroupProduct = {
  key: string;
  id: string;
  code: string;
  amisCode?: string;
  name: string;
  tenSanXuat?: string;
  productionName?: string;
  nhomVthh?: string;
  mang?: string;
  hangPhe?: string;
  doLi?: string;
  width?: number | null;
  zem?: string;
  dinhMucKg?: string;
  doDaiM?: string;
  mau?: string;
  tcmb?: boolean | string;
  tcmn?: string;
  giaRe?: string;
  np?: string;
  off?: string;
  linePrefix?: string;
  selectionKey?: string;
};

export type MixingNormGroupAddPayload =
  | {
      mode: 'groups';
      groups: Array<{ category: MixingNormCategoryDef; products: MixingNormGroupProduct[] }>;
    }
  | {
      mode: 'products';
      products: MixingNormGroupProduct[];
    };

type Props = {
  open: boolean;
  products: MixingNormGroupProduct[];
  /** SP đã gắn trên phiếu — vẫn hiện trong modal, chỉ đánh dấu. */
  usedProductKeys?: Set<string>;
  /** SP đang gắn trên block hiện tại — mở modal sẽ tick sẵn như lúc chọn. */
  preselectedProductKeys?: Set<string>;
  onClose: () => void;
  /** Add theo nhóm (tick category) hoặc theo từng SP đã chọn. */
  onAdd: (payload: MixingNormGroupAddPayload) => void;
};

const GROUP_ORDER: MixingNormCategoryGroup[] = ['dac', 'rong', 'song', 'other'];

const GROUP_HEADER_CLASS: Record<MixingNormCategoryGroup, string> = {
  song: 'bg-sky-100 text-sky-900 border-sky-200',
  dac: 'bg-amber-100 text-amber-900 border-amber-200',
  rong: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  other: 'bg-zinc-200 text-zinc-800 border-zinc-300'
};

const DRAG_MIME = 'application/x-mixing-norm-product-keys';

function productLabel(product: MixingNormGroupProduct) {
  return `${product.linePrefix ? `${product.linePrefix} · ` : ''}${product.amisCode || product.code} — ${
    product.productionName || product.tenSanXuat || product.name
  }`;
}

function parseDragKeys(raw: string): string[] {
  return String(raw || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
}

export default function MixingNormProductGroupModal({
  open,
  products,
  usedProductKeys,
  preselectedProductKeys,
  onClose,
  onAdd
}: Props) {
  const productSignals = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildMixingNormProductSignals>>();
    products.forEach(product => {
      const signals = buildMixingNormProductSignals({
        nhomVthh: product.nhomVthh,
        maAmis: product.amisCode || product.code,
        tenSanXuat: product.tenSanXuat || product.productionName,
        productionName: product.productionName,
        tenSp: product.name,
        mang: product.mang,
        hangPhe: product.hangPhe,
        doLi: product.doLi,
        zem: product.zem,
        dinhMucKg: product.dinhMucKg,
        doDaiM: product.doDaiM,
        mau: product.mau,
        tcmb: product.tcmb,
        tcmn: product.tcmn,
        giaRe: product.giaRe,
        np: product.np,
        off: product.off
      });
      map.set(product.key, signals);
    });
    return map;
  }, [products]);

  const initialAssignments = useMemo(() => new Map([...productSignals].map(([key, signals]) =>
    [key, classifyMixingNormCategory(signals)])), [productSignals]);

  const [assignments, setAssignments] = useState<Map<string, string>>(initialAssignments);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  /** SP được chọn để kéo thả nhiều cái cùng lúc. */
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [draggingKeys, setDraggingKeys] = useState<string[]>([]);
  const [dropTargetId, setDropTargetId] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetCategoryId, setMoveTargetCategoryId] = useState('');

  const productsByKey = useMemo(() => new Map(products.map(item => [item.key, item])), [products]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, MixingNormGroupProduct[]>();
    MIXING_NORM_CATEGORIES.forEach(category => buckets.set(category.id, []));
    assignments.forEach((categoryId, productKey) => {
      const product = productsByKey.get(productKey);
      if (!product) return;
      const id = MIXING_NORM_CATEGORIES.some(item => item.id === categoryId)
        ? categoryId
        : MIXING_NORM_OTHER_CATEGORY.id;
      if (!buckets.has(id)) buckets.set(id, []);
      buckets.get(id)!.push(product);
    });
    const missingLast = (a: number | null | undefined, b: number | null | undefined) => (a ?? Infinity) - (b ?? Infinity);
    for (const [category, items] of buckets) {
      const group = mixingNormCategoryById(category).group;
      items.sort((a, b) => {
        const left = productSignals.get(a.key);
        const right = productSignals.get(b.key);
        const order = group === 'dac' ? missingLast(a.width, b.width) || missingLast(left?.doLi, right?.doLi) :
          group === 'rong' ? missingLast(left?.doLi, right?.doLi) :
          group === 'song' ? missingLast(left?.kg, right?.kg) || missingLast(left?.doDaiM, right?.doDaiM) : 0;
        return order || a.code.localeCompare(b.code, 'vi', { numeric: true }) || a.key.localeCompare(b.key);
      });
    }
    return buckets;
  }, [assignments, productsByKey, productSignals]);

  /** Category đủ tick khi mọi SP con trong cột đều đang chọn. */
  const categoryFullySelected = (categoryId: string, selected: Set<string>) => {
    const list = grouped.get(categoryId) || [];
    if (list.length === 0) return false;
    return list.every(item => selected.has(item.key));
  };

  useEffect(() => {
    if (!open) return;
    setAssignments(new Map(initialAssignments));
    // Tick sẵn SP đã gắn block hiện tại — UI giống lúc đang chọn.
    const preset = new Set<string>();
    if (preselectedProductKeys && preselectedProductKeys.size > 0) {
      products.forEach(product => {
        const keys = [product.key, product.selectionKey, product.id, product.code]
          .map(value => String(value || '').trim())
          .filter(Boolean);
        if (keys.some(key => preselectedProductKeys.has(key))) {
          preset.add(product.key);
        }
      });
    }
    setSelectedKeys(preset);
    setDraggingKeys([]);
    setDropTargetId('');
    setShowMoveModal(false);
    setMoveTargetCategoryId('');
  }, [open, initialAssignments, preselectedProductKeys, products]);

  // Chọn hết SP con trong cột → tự tick category; thiếu 1 con → bỏ tick.
  useEffect(() => {
    if (!open) return;
    setChecked(prev => {
      const next = new Set<string>();
      MIXING_NORM_CATEGORIES.forEach(category => {
        if (categoryFullySelected(category.id, selectedKeys)) next.add(category.id);
      });
      if (next.size === prev.size && [...next].every(id => prev.has(id))) return prev;
      return next;
    });
  }, [open, selectedKeys, grouped]);

  /** Hiện đủ mọi category theo cột trái → phải (Sóng → Đặc → Rỗng → Khác). */
  const columns = useMemo(
    () =>
      GROUP_ORDER.flatMap(group =>
        MIXING_NORM_CATEGORIES.filter(category => category.group === group && (grouped.get(category.id)?.length || 0) > 0)
      ),
    [grouped]
  );

  const toggleCategory = (categoryId: string) => {
    const list = grouped.get(categoryId) || [];
    const willCheck = !checked.has(categoryId);
    // Tick/bỏ tick category → chọn/bỏ hết SP con; effect phía trên sẽ sync checkbox category.
    setSelectedKeys(prev => {
      const next = new Set(prev);
      list.forEach(item => {
        if (willCheck) next.add(item.key);
        else next.delete(item.key);
      });
      return next;
    });
  };

  const toggleProductSelect = (productKey: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(productKey)) next.delete(productKey);
      else next.add(productKey);
      return next;
    });
  };

  const moveProducts = (productKeys: string[], categoryId: string) => {
    const targetGroup = mixingNormCategoryById(categoryId).group;
    const unique = [...new Set(productKeys.filter(key => {
      const initial = initialAssignments.get(key);
      return initial && mixingNormCategoryById(initial).group === targetGroup;
    }))];
    if (unique.length === 0) return;
    setAssignments(prev => {
      const next = new Map(prev);
      unique.forEach(key => next.set(key, categoryId));
      return next;
    });
    setSelectedKeys(prev => {
      const next = new Set(prev);
      unique.forEach(key => next.delete(key));
      return next;
    });
  };

  const handleAdd = () => {
    // Ưu tiên tick nhóm; không tick nhóm thì Add theo từng SP đã chọn.
    if (checked.size > 0) {
      const selected = [...checked]
        .map(categoryId => {
          const category = mixingNormCategoryById(categoryId);
          const list = grouped.get(categoryId) || [];
          return { category, products: list };
        })
        .filter(item => item.products.length > 0);
      if (selected.length === 0) return;
      onAdd({ mode: 'groups', groups: selected });
      return;
    }
    if (selectedKeys.size === 0) return;
    const picked = [...selectedKeys]
      .map(key => productsByKey.get(key))
      .filter((item): item is MixingNormGroupProduct => Boolean(item));
    if (picked.length === 0) return;
    onAdd({ mode: 'products', products: picked });
  };

  const openMoveModal = () => {
    if (selectedKeys.size === 0) return;
    setMoveTargetCategoryId('');
    setShowMoveModal(true);
  };

  const confirmMoveToCategory = () => {
    if (!moveTargetCategoryId || selectedKeys.size === 0) return;
    moveProducts([...selectedKeys], moveTargetCategoryId);
    setShowMoveModal(false);
    setMoveTargetCategoryId('');
  };

  if (!open) return null;

  const checkedCount = [...checked].reduce((sum, id) => sum + (grouped.get(id)?.length || 0), 0);
  const isDragging = draggingKeys.length > 0;
  const selectedProducts = [...selectedKeys]
    .map(key => productsByKey.get(key))
    .filter((item): item is MixingNormGroupProduct => Boolean(item));
  const canAdd = checkedCount > 0 || selectedKeys.size > 0;
  const isUsedOnForm = (product: MixingNormGroupProduct) => {
    if (!usedProductKeys || usedProductKeys.size === 0) return false;
    const keys = [product.selectionKey, product.id, product.key, product.code]
      .map(value => String(value || '').trim())
      .filter(Boolean);
    return keys.some(key => usedProductKeys.has(key));
  };

  const isPreselectedOnBlock = (product: MixingNormGroupProduct) => {
    if (!preselectedProductKeys || preselectedProductKeys.size === 0) return false;
    const keys = [product.selectionKey, product.id, product.key, product.code]
      .map(value => String(value || '').trim())
      .filter(Boolean);
    return keys.some(key => preselectedProductKeys.has(key));
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950 sm:text-base">
            Chọn nhanh sản phẩm theo nhóm
          </h3>
          <p className="text-[11px] font-semibold text-zinc-500 sm:text-xs">
            Tick từng SP hoặc tick cả nhóm → Add vào phiếu. Kéo thả / Chuyển để chỉnh cột.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
          title="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {products.length === 0 ? (
          <p className="m-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm font-bold text-zinc-500">
            Chưa có sản phẩm từ lệnh SX đã chọn.
          </p>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-100 px-3 pt-3 pb-2">
              {GROUP_ORDER.map(group => {
                const count = columns.filter(item => item.group === group).length;
                return (
                  <span
                    key={group}
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${GROUP_HEADER_CLASS[group]}`}
                  >
                    {group === 'other' ? 'Cần xử lý thủ công' : mixingNormCategoryGroupLabel(group)}
                    <span className="ml-1.5 opacity-70">{count} cột</span>
                  </span>
                );
              })}
              {selectedKeys.size > 0 ? (
                <span className="ml-auto inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800">
                  Đang chọn {selectedKeys.size} SP để kéo
                </span>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3">
              <div
                className="flex h-full min-h-[420px] gap-3"
                style={{ width: `max(100%, ${columns.length * 280}px)` }}
              >
                {columns.map(category => {
                  const list = grouped.get(category.id) || [];
                  const isChecked = checked.has(category.id);
                  const isDropTarget = dropTargetId === category.id;
                  return (
                    <section
                      key={category.id}
                      onDragEnter={event => {
                        event.preventDefault();
                        if (isDragging) setDropTargetId(category.id);
                      }}
                      onDragOver={event => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        if (dropTargetId !== category.id) setDropTargetId(category.id);
                      }}
                      onDragLeave={event => {
                        const related = event.relatedTarget as Node | null;
                        if (related && event.currentTarget.contains(related)) return;
                        setDropTargetId(prev => (prev === category.id ? '' : prev));
                      }}
                      onDrop={event => {
                        event.preventDefault();
                        const fromMime = event.dataTransfer.getData(DRAG_MIME);
                        const fromText = event.dataTransfer.getData('text/plain');
                        const keys = parseDragKeys(fromMime || fromText || draggingKeys.join('\n'));
                        moveProducts(keys, category.id);
                        setDraggingKeys([]);
                        setDropTargetId('');
                      }}
                      className={`flex h-full w-[270px] shrink-0 flex-col rounded-xl border shadow-sm transition ${
                        isDropTarget
                          ? 'border-amber-400 bg-amber-100/80 ring-2 ring-amber-300'
                          : isChecked
                            ? 'border-[#ef1b2d]/45 bg-red-50/50 ring-1 ring-[#ef1b2d]/20'
                            : 'border-zinc-200 bg-zinc-50'
                      }`}
                    >
                      <div className="shrink-0 border-b border-zinc-200/80 px-2.5 py-2">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => toggleCategory(category.id)}
                            className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                            title={isChecked ? 'Bỏ chọn nhóm' : 'Chọn nhóm'}
                          >
                            {isChecked ? (
                              <CheckSquare className="h-4 w-4 text-[#ef1b2d]" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black uppercase leading-snug tracking-wide text-zinc-800">
                              {category.label}
                            </p>
                            <p className="mt-0.5 text-[10px] font-semibold leading-snug text-zinc-500">
                              {category.hint}
                            </p>
                            <p className="mt-1 text-[10px] font-bold text-zinc-400">
                              {list.length} SP · {mixingNormCategoryGroupLabel(category.group)}
                              {isDropTarget ? ' · Thả vào đây' : ''}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        {list.length === 0 ? (
                          <p
                            className={`rounded-lg border border-dashed px-2 py-6 text-center text-[11px] font-semibold ${
                              isDropTarget
                                ? 'border-amber-400 bg-amber-50 text-amber-700'
                                : 'border-zinc-300 bg-white text-zinc-400'
                            }`}
                          >
                            {isDropTarget ? 'Thả sản phẩm vào đây' : 'Kéo sản phẩm vào đây'}
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {list.map(product => {
                              const isSelected = selectedKeys.has(product.key);
                              const isItemDragging = draggingKeys.includes(product.key);
                              const alreadyOnForm = isUsedOnForm(product);
                              const onThisBlock = isPreselectedOnBlock(product);
                              // Đã chọn trên block hiện tại → luôn hiện giống trạng thái đang chọn.
                              const showAsSelected = isSelected || onThisBlock;
                              return (
                                <li
                                  key={product.key}
                                  draggable
                                  onClick={event => {
                                    event.preventDefault();
                                    toggleProductSelect(product.key);
                                  }}
                                  onDragStart={event => {
                                    const keys =
                                      selectedKeys.has(product.key) && selectedKeys.size > 0
                                        ? [...selectedKeys]
                                        : [product.key];
                                    setDraggingKeys(keys);
                                    if (!selectedKeys.has(product.key)) {
                                      setSelectedKeys(new Set([product.key]));
                                    }
                                    const payload = keys.join('\n');
                                    event.dataTransfer.setData(DRAG_MIME, payload);
                                    event.dataTransfer.setData('text/plain', payload);
                                    event.dataTransfer.effectAllowed = 'move';
                                  }}
                                  onDragEnd={() => {
                                    setDraggingKeys([]);
                                    setDropTargetId('');
                                  }}
                                  className={`flex cursor-grab items-start gap-1.5 rounded-lg border px-2 py-1.5 active:cursor-grabbing ${
                                    isItemDragging
                                      ? 'border-amber-300 bg-amber-50 opacity-50'
                                      : showAsSelected
                                        ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300'
                                        : alreadyOnForm
                                          ? 'border-zinc-200 bg-zinc-100/80'
                                          : 'border-zinc-200 bg-white'
                                  }`}
                                  title="Tick để Add từng SP · kéo thả / Chuyển sang cột khác"
                                >
                                  <button
                                    type="button"
                                    onClick={event => {
                                      event.stopPropagation();
                                      toggleProductSelect(product.key);
                                    }}
                                    className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500"
                                    title={showAsSelected ? 'Bỏ chọn SP' : 'Chọn SP để Add / kéo'}
                                  >
                                    {showAsSelected ? (
                                      <CheckSquare className="h-3.5 w-3.5 text-amber-700" />
                                    ) : (
                                      <Square className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                                  <span className="min-w-0 flex-1 text-[11px] font-semibold leading-snug text-zinc-800">
                                    {productLabel(product)}
                                    {showAsSelected ? (
                                      <span className="mt-0.5 block text-[10px] font-bold text-amber-700">
                                        {onThisBlock ? 'Đã chọn trên SP này' : 'Đang chọn'}
                                      </span>
                                    ) : alreadyOnForm ? (
                                      <span className="mt-0.5 block text-[10px] font-bold text-zinc-500">
                                        Đã trên phiếu
                                      </span>
                                    ) : null}
                                    {isSelected && selectedKeys.size > 1 && draggingKeys.includes(product.key) ? (
                                      <span className="mt-0.5 block text-[10px] font-bold text-amber-700">
                                        +{selectedKeys.size - 1} SP cùng kéo
                                      </span>
                                    ) : null}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-3 sm:px-5">
        <p className="text-xs font-semibold text-zinc-600">
          {checked.size > 0
            ? `Đã tick ${checked.size} nhóm · ${checkedCount} SP`
            : selectedKeys.size > 0
              ? `Đã chọn ${selectedKeys.size} SP để Add`
              : 'Tick SP hoặc tick nhóm rồi Add'}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {selectedKeys.size > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedKeys(new Set())}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Bỏ chọn SP
              </button>
              <button
                type="button"
                onClick={openMoveModal}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-extrabold text-amber-900 hover:bg-amber-100"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Chuyển ({selectedKeys.size})
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {checked.size > 0
              ? `Add ${checked.size} nhóm`
              : selectedKeys.size > 0
                ? `Add ${selectedKeys.size} SP`
                : 'Add vào phiếu'}
          </button>
        </div>
      </div>

      {showMoveModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  Chuyển đến nhóm
                </h4>
                <p className="text-[11px] font-semibold text-zinc-500">
                  {selectedProducts.length} sản phẩm đã chọn
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMoveModal(false);
                  setMoveTargetCategoryId('');
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-56 space-y-1.5 overflow-y-auto px-4 py-3">
              {selectedProducts.map(product => (
                <div
                  key={product.key}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-zinc-800"
                >
                  {productLabel(product)}
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Chọn nhóm chuyển đến
                </span>
                <select
                  value={moveTargetCategoryId}
                  onChange={event => setMoveTargetCategoryId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                >
                  <option value="">— Chọn nhóm —</option>
                  {GROUP_ORDER.map(group => (
                    <optgroup key={group} label={mixingNormCategoryGroupLabel(group)}>
                      {columns
                        .filter(category => category.group === group)
                        .map(category => (
                          <option key={category.id} value={category.id}>
                            {category.label} ({(grouped.get(category.id) || []).length} SP)
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowMoveModal(false);
                    setMoveTargetCategoryId('');
                  }}
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={confirmMoveToCategory}
                  disabled={!moveTargetCategoryId}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-amber-500 px-4 text-xs font-extrabold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Chuyển {selectedProducts.length} SP
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
