import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import type { ControlBoardShiftSummaryRow } from '../utils/controlBoardShiftSummary';
import { TI_LE_LOI_HONG_DINH_MUC_PERCENT } from '../utils/controlBoardShiftSummary';

// Validated categorical palette (light mode) — see dataviz skill palette.md
const SERIES_1_BLUE = '#2a78d6';
const SERIES_2_AQUA = '#1baf7a';
const SERIES_3_YELLOW = '#eda100';
const SERIES_4_GREEN = '#008300';
const STATUS_CRITICAL_RED = '#d03b3b';

const GRID_COLOR = '#e1e0d9';
const AXIS_COLOR = '#898781';
const SURFACE = '#fcfcfb';

const tooltipContentStyle: React.CSSProperties = {
  fontSize: '11px',
  borderRadius: '12px',
  border: '1px solid #e1e0d9',
  boxShadow: '0 4px 16px rgba(11,11,11,0.08)'
};

const legendStyle: React.CSSProperties = { fontSize: '11px', paddingTop: '8px' };

function formatAxisNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}

function formatShortDate(ngay: string) {
  const parts = String(ngay || '').split('-');
  if (parts.length !== 3) return ngay || '-';
  return `${parts[2]}/${parts[1]}`;
}

function shortenShift(ca: string) {
  const trimmed = String(ca || '').trim();
  if (!trimmed) return '-';
  return trimmed.length > 10 ? `${trimmed.slice(0, 9)}…` : trimmed;
}

export default function ControlBoardShiftSummaryChart({
  rows,
  isLoading
}: {
  rows: ControlBoardShiftSummaryRow[];
  isLoading?: boolean;
}) {
  const [defectUnit, setDefectUnit] = useState<'kg' | 'percent'>('percent');

  const chartData = useMemo(() => {
    return [...rows]
      .reverse()
      .map(row => ({
        key: row.key,
        label: `${formatShortDate(row.ngay)} · ${shortenShift(row.ca)}`,
        khoiLuongHangThucTe: Number(row.khoiLuongHangThucTe.toFixed(1)),
        tongThucDung: Number(row.tongThucDung.toFixed(1)),
        tongTpNhapKho: Number(row.tongTpNhapKho.toFixed(1)),
        hangHong: Number(row.hangHong.toFixed(1)),
        tiLeLoiHong: Number(row.tiLeLoiHong.toFixed(2)),
        tongNhuaThucDung: Number(Math.max(row.tongNhuaThucDung, 0).toFixed(1)),
        tongMangThucDung: Number(Math.max(row.tongMangThucDung, 0).toFixed(1)),
        loiThucDung: Number(Math.max(row.loiThucDung, 0).toFixed(1)),
        tuiThucDung: Number(Math.max(row.tuiThucDung, 0).toFixed(1)),
        tonDauCaNhua: Number(row.tonDauCaNhua.toFixed(1)),
        tonCuoiCaNhua: Number(row.tonCuoiCaNhua.toFixed(1))
      }));
  }, [rows]);

  const hasData = chartData.length > 0;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-400 shadow-sm">
        Đang tải dữ liệu để vẽ biểu đồ...
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-400">
        Chưa có dữ liệu trong khoảng thời gian đã chọn để vẽ biểu đồ trực quan.
      </div>
    );
  }

  const xAxisProps = {
    dataKey: 'label',
    stroke: AXIS_COLOR,
    tick: { fontSize: 10, fill: AXIS_COLOR },
    angle: -35 as const,
    textAnchor: 'end' as const,
    height: 56,
    interval: 'preserveStartEnd' as const
  };

  const yAxisProps = {
    stroke: AXIS_COLOR,
    tick: { fontSize: 10, fill: AXIS_COLOR },
    tickFormatter: formatAxisNumber,
    width: 52
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-slate-800">Biểu đồ trực quan — Bảng tổng hợp theo ca</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {chartData.length} ca sản xuất trong khoảng thời gian đã lọc · số liệu chi tiết có ở bảng bên dưới
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Sản lượng & vật tư nhập kho theo ca */}
        <div className="rounded-xl border border-slate-100 p-3">
          <div className="flex items-center gap-1.5 pb-2">
            <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
            <h4 className="text-xs font-bold text-slate-700">Sản lượng &amp; vật tư nhập kho theo ca (kg)</h4>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
                <CartesianGrid stroke={GRID_COLOR} strokeWidth={1} vertical={false} />
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip contentStyle={tooltipContentStyle} formatter={(value: number) => formatAxisNumber(value)} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={legendStyle} />
                <Bar
                  name="Khối lượng hàng TT"
                  dataKey="khoiLuongHangThucTe"
                  fill={SERIES_1_BLUE}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  name="Tổng thực dùng"
                  dataKey="tongThucDung"
                  fill={SERIES_2_AQUA}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  name="Tổng TP nhập kho"
                  dataKey="tongTpNhapKho"
                  fill={SERIES_3_YELLOW}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Tỉ lệ / khối lượng lỗi hỏng theo ca */}
        <div className="rounded-xl border border-slate-100 p-3">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              <h4 className="text-xs font-bold text-slate-700">Lỗi hỏng theo ca</h4>
            </div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setDefectUnit('percent')}
                className={`px-2 py-1 ${defectUnit === 'percent' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'}`}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => setDefectUnit('kg')}
                className={`px-2 py-1 ${defectUnit === 'kg' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'}`}
              >
                kg
              </button>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeWidth={1} vertical={false} />
                <XAxis {...xAxisProps} />
                <YAxis
                  {...yAxisProps}
                  tickFormatter={value => (defectUnit === 'percent' ? `${formatAxisNumber(value)}%` : formatAxisNumber(value))}
                />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  formatter={(value: number) => (defectUnit === 'percent' ? `${value}%` : `${formatAxisNumber(value)} kg`)}
                />
                {defectUnit === 'percent' && (
                  <ReferenceLine
                    y={TI_LE_LOI_HONG_DINH_MUC_PERCENT}
                    stroke={AXIS_COLOR}
                    strokeDasharray="4 4"
                    label={{ value: `Định mức ${TI_LE_LOI_HONG_DINH_MUC_PERCENT}%`, position: 'insideTopLeft', fontSize: 10, fill: AXIS_COLOR }}
                  />
                )}
                <Line
                  name={defectUnit === 'percent' ? 'Tỉ lệ lỗi hỏng (%)' : 'Hàng hỏng (kg)'}
                  dataKey={defectUnit === 'percent' ? 'tiLeLoiHong' : 'hangHong'}
                  stroke={STATUS_CRITICAL_RED}
                  strokeWidth={2}
                  dot={{ r: 4, fill: STATUS_CRITICAL_RED, stroke: SURFACE, strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Vật tư thực dùng theo ca (stacked) */}
        <div className="rounded-xl border border-slate-100 p-3">
          <div className="flex items-center gap-1.5 pb-2">
            <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
            <h4 className="text-xs font-bold text-slate-700">Vật tư thực dùng theo ca (kg)</h4>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid stroke={GRID_COLOR} strokeWidth={1} vertical={false} />
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip contentStyle={tooltipContentStyle} formatter={(value: number) => `${formatAxisNumber(value)} kg`} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={legendStyle} />
                <Bar name="Nhựa" dataKey="tongNhuaThucDung" stackId="vt" fill={SERIES_1_BLUE} stroke={SURFACE} strokeWidth={2} maxBarSize={22} />
                <Bar name="Màng" dataKey="tongMangThucDung" stackId="vt" fill={SERIES_2_AQUA} stroke={SURFACE} strokeWidth={2} maxBarSize={22} />
                <Bar name="Lõi" dataKey="loiThucDung" stackId="vt" fill={SERIES_3_YELLOW} stroke={SURFACE} strokeWidth={2} maxBarSize={22} />
                <Bar
                  name="Túi"
                  dataKey="tuiThucDung"
                  stackId="vt"
                  fill={SERIES_4_GREEN}
                  stroke={SURFACE}
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Tồn kho nhựa đầu ca vs cuối ca */}
        <div className="rounded-xl border border-slate-100 p-3">
          <div className="flex items-center gap-1.5 pb-2">
            <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
            <h4 className="text-xs font-bold text-slate-700">Tồn kho nhựa đầu ca &amp; cuối ca (kg)</h4>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID_COLOR} strokeWidth={1} vertical={false} />
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip contentStyle={tooltipContentStyle} formatter={(value: number) => `${formatAxisNumber(value)} kg`} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={legendStyle} />
                <Line
                  name="Tồn đầu ca"
                  dataKey="tonDauCaNhua"
                  stroke={SERIES_1_BLUE}
                  strokeWidth={2}
                  dot={{ r: 4, fill: SERIES_1_BLUE, stroke: SURFACE, strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }}
                />
                <Line
                  name="Tồn cuối ca"
                  dataKey="tonCuoiCaNhua"
                  stroke={SERIES_2_AQUA}
                  strokeWidth={2}
                  dot={{ r: 4, fill: SERIES_2_AQUA, stroke: SURFACE, strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
