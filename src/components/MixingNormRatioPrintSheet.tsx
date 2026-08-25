import React from 'react';
import { createPortal } from 'react-dom';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from './layout/constants';
import type { MixingNormLine, MixingNormProduct, MixingNormRow } from './MixingNormMaterialsTab';

export type MixingNormRatioPrintDoc = {
  maLenhSx: string;
  ngay: string;
  ca?: string;
  isActual?: boolean;
  actualValues?: Array<Array<{ percent: number | null; weight: number | null }>>;
  actualRounds?: Array<Array<Array<{ percent: number | null; weight: number | null }>>>;
  intro?: string;
  products: MixingNormProduct[];
};

function formatPrintDateLong(iso: string) {
  const raw = String(iso || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const now = new Date();
    return {
      day: String(now.getDate()).padStart(2, '0'),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year: String(now.getFullYear())
    };
  }
  return { day: match[3], month: match[2], year: match[1] };
}

function formatNumberVi(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value);
}

function formatActualPercentVi(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function resolveLinePercentAndKg(
  line: MixingNormLine,
  tongTrongLuong: number | null
): { percent: string; kg: string } {
  const value = line.gia_tri;
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { percent: '', kg: formatNumberVi(line.khoi_luong) };
  }
  const unit = String(line.don_vi || 'kg').trim();
  if (unit === '%') {
    const kg =
      line.khoi_luong !== null && Number.isFinite(line.khoi_luong)
        ? line.khoi_luong
        : tongTrongLuong !== null && Number.isFinite(tongTrongLuong)
          ? (tongTrongLuong * value) / 100
          : null;
    return { percent: `${formatNumberVi(value)}%`, kg: formatNumberVi(kg) };
  }
  const percent =
    tongTrongLuong && tongTrongLuong > 0
      ? `${formatNumberVi((value / tongTrongLuong) * 100)}%`
      : '';
  const kg =
    line.khoi_luong !== null && Number.isFinite(line.khoi_luong) ? line.khoi_luong : value;
  return { percent, kg: formatNumberVi(kg) };
}

/** Cối trộn tiêu chuẩn: quy đổi 1 dòng NVL về %Cối trộn, KL/cối và Tổng trọng lượng cả SP. */
function resolveStandardBatchRow(line: MixingNormLine, product: MixingNormProduct) {
  const batch = product.dinh_luong_coi ?? null;
  const tong = product.tong_trong_luong ?? null;
  const kgPerBatch =
    line.khoi_luong !== null && line.khoi_luong !== undefined && Number.isFinite(line.khoi_luong)
      ? line.khoi_luong
      : line.don_vi === '%' && line.gia_tri != null && batch
        ? (batch * line.gia_tri) / 100
        : line.gia_tri ?? null;
  const percentCoi =
    line.ty_le_coi !== null && line.ty_le_coi !== undefined && Number.isFinite(line.ty_le_coi)
      ? line.ty_le_coi
      : kgPerBatch !== null && batch
        ? (kgPerBatch / batch) * 100
        : null;
  const tongKg =
    line.tong_khoi_luong !== null && line.tong_khoi_luong !== undefined && Number.isFinite(line.tong_khoi_luong)
      ? line.tong_khoi_luong
      : percentCoi !== null && tong
        ? (percentCoi / 100) * tong
        : null;
  return { percentCoi, kgPerBatch, tongKg };
}

function productTitle(product: MixingNormProduct) {
  const name = (product.ten_sp || product.ma_sp || 'SẢN PHẨM').trim();
  return name.toUpperCase();
}

const MIXING_ROUNDS_PER_TABLE = 5;

function buildMixingRoundWeights(product: MixingNormProduct) {
  if (product.lan_tron?.length) {
    return product.lan_tron.map(round => round.tong_trong_luong ?? 0);
  }
  const total = product.tong_trong_luong ?? 0;
  const batch = product.dinh_luong_coi ?? 0;
  if (total <= 0 || batch <= 0) return [];
  return Array.from({ length: Math.ceil(total / batch) }, (_, index) =>
    Math.min(batch, Math.max(0, total - batch * index))
  );
}

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );
}

/** Một phiếu DB → một tờ in (nhiều khối SP). */
export function toPrintDoc(row: MixingNormRow): MixingNormRatioPrintDoc {
  return {
    maLenhSx: row.ma_lenh_sx.trim(),
    ngay: row.ngay || new Date().toISOString().slice(0, 10),
    products: [...row.products].sort((a, b) =>
      `${a.ma_sp} ${a.ten_sp}`.localeCompare(`${b.ma_sp} ${b.ten_sp}`, 'vi')
    )
  };
}

export function MixingNormRatioPrintSheet({ doc }: { doc: MixingNormRatioPrintDoc }) {
  const dateParts = formatPrintDateLong(doc.ngay || '');
  const intro = doc.intro?.trim() || 'Hiện tại BPSX thay đổi tỷ lệ như sau';

  return (
    <div className="mixing-norm-ratio-print-sheet">
      <div className="mixing-norm-ratio-print-doc">
        <header className="mixing-norm-ratio-print-header">
          <img src={vietNhatLogoUrl} alt={PRINT_COMPANY_NAME} className="mixing-norm-ratio-print-logo" />
          <div className="mixing-norm-ratio-print-company">
            <p className="mixing-norm-ratio-print-company-name">{PRINT_COMPANY_NAME}</p>
            <p className="mixing-norm-ratio-print-company-sub">Phiếu tỷ lệ trộn {doc.isActual ? 'thực tế' : 'định mức'}</p>
          </div>
        </header>

        <h1 className="mixing-norm-ratio-print-title">TỶ LỆ TRỘN {doc.isActual ? 'THỰC TẾ' : 'ĐỊNH MỨC'}</h1>
        <p className="mixing-norm-ratio-print-intro">{intro}</p>
        <p className="mixing-norm-ratio-print-meta">
          Lệnh SX: <strong>{doc.maLenhSx || '—'}</strong>
          <span className="mixing-norm-ratio-print-meta-sep">·</span>
          Ngày: <strong>{`${dateParts.day}/${dateParts.month}/${dateParts.year}`}</strong>
          {doc.ca ? <><span className="mixing-norm-ratio-print-meta-sep">·</span>Ca: <strong>{doc.ca}</strong></> : null}
        </p>

        {doc.products.length === 0 ? (
          <p className="mixing-norm-ratio-print-empty">Chưa có sản phẩm định mức cho lệnh này.</p>
        ) : (
          doc.products.map((product, index) => {
            const tong = product.tong_trong_luong;
            return (
              <section
                key={`${product.ma_sp}-${index}`}
                className="mixing-norm-ratio-print-block"
              >
                <h2 className="mixing-norm-ratio-print-product">
                  {index + 1}. {productTitle(product)}
                  {product.ma_sp ? ` (${product.ma_sp})` : ''}
                </h2>
                {tong !== null && tong !== undefined ? (
                  <p className="mixing-norm-ratio-print-tonnage">
                    Tổng trọng lượng: <strong>{formatNumberVi(tong)} kg</strong>
                  </p>
                ) : null}
                {!doc.isActual && product.dinh_luong_coi ? (
                  <p className="mixing-norm-ratio-print-tonnage">
                    Cối trộn tiêu chuẩn: <strong>{formatNumberVi(product.dinh_luong_coi)} kg</strong>
                    {product.so_lan_tron ? (
                      <>
                        <span className="mixing-norm-ratio-print-meta-sep">·</span>
                        Số cối cần trộn: <strong>{product.so_lan_tron}</strong>
                      </>
                    ) : null}
                  </p>
                ) : null}

                {doc.isActual && buildMixingRoundWeights(product).length > 0 ? (
                  chunks(buildMixingRoundWeights(product), MIXING_ROUNDS_PER_TABLE).map((rounds, tableIndex) => (
                    <table key={tableIndex} className={`mixing-norm-ratio-print-table mixing-norm-ratio-round-table ${doc.isActual ? 'is-actual' : ''}`}>
                      <colgroup>
                        <col className="col-stt" />
                        <col className="col-code" />
                        <col className="col-name" />
                        {Array.from({ length: MIXING_ROUNDS_PER_TABLE }, (_, roundIndex) => (
                          <React.Fragment key={roundIndex}>
                            <col className="col-round" />
                            {doc.isActual ? <col className="col-round col-round-actual" /> : null}
                          </React.Fragment>
                        ))}
                      </colgroup>
                      <thead><tr>
                        <th className="col-stt">STT</th><th className="col-code">Mã NVL</th><th className="col-name">Tên NVL</th>
                        {Array.from({ length: MIXING_ROUNDS_PER_TABLE }, (_, index) => (
                          <React.Fragment key={index}>
                            <th className="col-round">{index < rounds.length ? `L${tableIndex * MIXING_ROUNDS_PER_TABLE + index + 1}` : ''}</th>
                            {doc.isActual ? <th className="col-round col-round-actual">{index < rounds.length ? `L${tableIndex * MIXING_ROUNDS_PER_TABLE + index + 1} TT` : ''}</th> : null}
                          </React.Fragment>
                        ))}
                      </tr></thead>
                      <tbody>{(() => {
                        const roundOffset = tableIndex * MIXING_ROUNDS_PER_TABLE;
                        const normRounds = Array.from({ length: rounds.length }, (_, index) =>
                          product.lan_tron?.[roundOffset + index]?.nvl ?? product.chi_tiet
                        );
                        const uniqueLines = new Map<string, MixingNormLine>();
                        normRounds.flat().forEach(line => uniqueLines.set(`${line.ma_nvl}|${line.ten_nvl}`.toLowerCase(), line));
                        return [...uniqueLines.values()].map((displayLine, lineIndex) => (
                          <tr key={`${displayLine.ma_nvl}-${displayLine.ten_nvl}-${lineIndex}`}>
                            <td className="col-stt">{lineIndex + 1}</td><td className="col-code">{displayLine.ma_nvl}</td><td className="col-name">{displayLine.ten_nvl}</td>
                            {Array.from({ length: MIXING_ROUNDS_PER_TABLE }, (_, slotIndex) => {
                              const roundWeight = rounds[slotIndex];
                              if (roundWeight === undefined) return <React.Fragment key={slotIndex}><td className="col-round" />{doc.isActual ? <td className="col-round col-round-actual" /> : null}</React.Fragment>;
                              const globalRoundIndex = roundOffset + slotIndex;
                              const normLines = normRounds[slotIndex] ?? [];
                              const normLineIndex = normLines.findIndex(line => `${line.ma_nvl}|${line.ten_nvl}`.toLowerCase() === `${displayLine.ma_nvl}|${displayLine.ten_nvl}`.toLowerCase());
                              const normLine = normLines[normLineIndex];
                              const kg = normLine
                                ? normLine.khoi_luong ?? (normLine.don_vi === '%' && normLine.gia_tri != null ? roundWeight * normLine.gia_tri / 100 : normLine.gia_tri)
                                : null;
                              const actualWeight = normLineIndex >= 0 ? doc.actualRounds?.[index]?.[globalRoundIndex]?.[normLineIndex]?.weight : null;
                              return <React.Fragment key={slotIndex}><td className="col-round">{formatNumberVi(kg)}</td>{doc.isActual ? <td className="col-round col-round-actual">{formatNumberVi(actualWeight)}</td> : null}</React.Fragment>;
                            })}
                          </tr>
                        ));
                      })()}</tbody>
                    </table>
                  ))
                ) : doc.isActual ? (
                <table className="mixing-norm-ratio-print-table">
                  <thead>
                    <tr>
                      <th className="col-stt">STT</th>
                      <th className="col-code">Mã NVL</th>
                      <th className="col-name">Tên NVL</th>
                      <th className="col-pct">Tỷ lệ</th>
                      <th className="col-kg">Khối lượng</th>
                      <th className="col-kg">Thực tế</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.chi_tiet.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="mixing-norm-ratio-print-empty-cell">
                          Chưa có dòng NVL
                        </td>
                      </tr>
                    ) : (
                      product.chi_tiet.map((line, lineIndex) => {
                        const { percent, kg } = resolveLinePercentAndKg(line, tong);
                        return (
                          <tr key={`${product.ma_sp}-${line.ma_nvl}-${lineIndex}`}>
                            <td className="col-stt">{lineIndex + 1}</td>
                            <td className="col-code">{line.ma_nvl || ''}</td>
                            <td className="col-name">{line.ten_nvl || ''}</td>
                            <td className="col-pct">{percent}</td>
                            <td className="col-kg">{kg ? `${kg} kg` : ''}</td>
                            <td className="col-kg">
                              {formatActualPercentVi(doc.actualValues?.[index]?.[lineIndex]?.percent)}%
                              {' · '}
                              {formatNumberVi(doc.actualValues?.[index]?.[lineIndex]?.weight)} kg
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                ) : (
                <table className="mixing-norm-ratio-print-table">
                  <thead>
                    <tr>
                      <th className="col-stt">STT</th>
                      <th className="col-code">Mã NVL</th>
                      <th className="col-name">Tên NVL</th>
                      <th className="col-pct">% Cối trộn</th>
                      <th className="col-kg">Giá trị (kg/cối)</th>
                      <th className="col-kg">Tổng trọng lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.chi_tiet.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="mixing-norm-ratio-print-empty-cell">
                          Chưa có dòng NVL
                        </td>
                      </tr>
                    ) : (
                      product.chi_tiet.map((line, lineIndex) => {
                        const { percentCoi, kgPerBatch, tongKg } = resolveStandardBatchRow(line, product);
                        return (
                          <tr key={`${product.ma_sp}-${line.ma_nvl}-${lineIndex}`}>
                            <td className="col-stt">{lineIndex + 1}</td>
                            <td className="col-code">{line.ma_nvl || ''}</td>
                            <td className="col-name">{line.ten_nvl || ''}</td>
                            <td className="col-pct">{percentCoi !== null ? `${formatNumberVi(percentCoi)}%` : ''}</td>
                            <td className="col-kg">{kgPerBatch !== null ? `${formatNumberVi(kgPerBatch)} kg` : ''}</td>
                            <td className="col-kg">{tongKg !== null ? `${formatNumberVi(tongKg)} kg` : ''}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {product.chi_tiet.length > 0 ? (
                    <tfoot>
                      <tr>
                        <td colSpan={5} className="mixing-norm-ratio-print-total-label">
                          Tổng trọng lượng NVL cần
                        </td>
                        <td className="col-kg">
                          {formatNumberVi(
                            product.chi_tiet.reduce(
                              (sum, line) => sum + (resolveStandardBatchRow(line, product).tongKg ?? 0),
                              0
                            )
                          )}{' '}
                          kg
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
                )}

                {product.ghi_chu ? (
                  <p className="mixing-norm-ratio-print-note">
                    <strong>Ghi chú:</strong> {product.ghi_chu}
                  </p>
                ) : null}
              </section>
            );
          })
        )}

        {doc.isActual ? <p className="mixing-norm-ratio-print-legend"><strong>Ghi chú:</strong> TT là Thực tế.</p> : null}

        <div className="mixing-norm-ratio-print-footer">
          <div className="mixing-norm-ratio-print-place">
            Việt Trì, ngày {dateParts.day} tháng {dateParts.month} năm {dateParts.year}
          </div>

          <div className="mixing-norm-ratio-print-signatures">
            <div>
              <p className="role">Người lập</p>
              <span>(Ký, ghi rõ họ tên)</span>
            </div>
            <div>
              <p className="role">Người kiểm tra</p>
              <span>(Ký, ghi rõ họ tên)</span>
            </div>
            <div>
              <p className="role">Duyệt</p>
              <span>(Ký, ghi rõ họ tên)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MixingNormRatioPrintBatch({ docs }: { docs: MixingNormRatioPrintDoc[] }) {
  if (docs.length === 0) return null;

  return createPortal(
    <div className="mixing-norm-ratio-print-batch">
      {docs.map((doc, index) => (
        <div
          key={`${doc.maLenhSx || 'none'}-${doc.ngay}-${index}`}
          className="mixing-norm-ratio-print-page"
        >
          <MixingNormRatioPrintSheet doc={doc} />
        </div>
      ))}
    </div>,
    document.body
  );
}
