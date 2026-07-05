import React, { useState, useMemo } from 'react';
import { ProductionReport, MATERIAL_LABELS, STANDARD_PRODUCTS } from '../types';
import { computeReportMetrics, formatNumber, sumArray } from '../utils';
import { 
  TrendingUp, Scale, Trash2, ShieldAlert, CheckCircle, 
  Search, Eye, HelpCircle, CornerDownRight, RotateCcw, 
  Filter, ChevronRight, Activity, Award
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';

interface AnalyticsDashboardProps {
  reports: ProductionReport[];
  onResetDb: () => void;
  isLoading?: boolean;
}

export default function AnalyticsDashboard({ reports, onResetDb, isLoading }: AnalyticsDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [machineFilter, setMachineFilter] = useState('');

  // 1. Process all reports for analytics
  const computedReports = useMemo(() => {
    return reports.map(r => ({
      report: r,
      metrics: computeReportMetrics(r)
    }));
  }, [reports]);

  // Unique machines for filtration
  const uniqueMachines = useMemo(() => {
    const list = reports.map(r => r.shiftInfo.machineId);
    return Array.from(new Set(list));
  }, [reports]);

  // Filtered list
  const filteredReports = useMemo(() => {
    let list = computedReports;
    
    if (machineFilter) {
      list = list.filter(item => item.report.shiftInfo.machineId === machineFilter);
    }
    
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(item => 
        item.report.shiftInfo.operatorName.toLowerCase().includes(q) ||
        item.report.shiftInfo.assistantName.toLowerCase().includes(q) ||
        item.report.productEntry.productCode.toLowerCase().includes(q) ||
        item.report.date.includes(q)
      );
    }
    
    return list;
  }, [computedReports, searchTerm, machineFilter]);

  // Aggregate Metrics
  const summaryMetrics = useMemo(() => {
    if (computedReports.length === 0) {
      return {
        totalReports: 0,
        totalPlasticKg: 0,
        totalProductKg: 0,
        totalWasteKg: 0,
        avgVariancePercent: 0,
        optimalCount: 0,
        warningCount: 0,
        errorCount: 0
      };
    }

    let totalPlastic = 0;
    let totalProduct = 0;
    let totalWaste = 0;
    let sumVariancePercent = 0;
    let optimalCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    computedReports.forEach(({ metrics }) => {
      totalPlastic += metrics.totalPlastic;
      totalProduct += metrics.actualProductWeight;
      totalWaste += metrics.totalBrightener + metrics.totalDispersionOil + metrics.totalOtherAdditives + metrics.varianceWeight; // approximations
      optimalCount += metrics.status === 'optimal' ? 1 : 0;
      warningCount += metrics.status === 'warning' ? 1 : 0;
      errorCount += metrics.status === 'error' ? 1 : 0;
      sumVariancePercent += metrics.variancePercent;
    });

    // Recalculate static waste weight explicitly
    const actualWasteSum = computedReports.reduce((sum, item) => sum + item.report.wasteWeight, 0);

    return {
      totalReports: computedReports.length,
      totalPlasticKg: totalPlastic,
      totalProductKg: totalProduct,
      totalWasteKg: actualWasteSum,
      avgVariancePercent: sumVariancePercent / computedReports.length,
      optimalCount,
      warningCount,
      errorCount
    };
  }, [computedReports]);

  // Prepare chart data (sorted Chronologically)
  const chartData = useMemo(() => {
    const sorted = [...computedReports].reverse();
    return sorted.map(({ report, metrics }) => {
      const dateParts = report.date.split('-');
      const displayDate = `${dateParts[2] || ''}/${dateParts[1] || ''}`; // dd/mm
      const shortMachine = report.shiftInfo.machineId.split(' ')[0] || '';
      return {
        name: `${displayDate} (${shortMachine})`,
        'Nhựa Phối Trộn (kg)': Number(metrics.totalPlastic.toFixed(1)),
        'Thành Phẩm Thực Tế (kg)': Number(metrics.actualProductWeight.toFixed(1)),
        'Phế Phẩm (kg)': Number(report.wasteWeight.toFixed(1)),
        'Hao Hụt (%)': Number(metrics.variancePercent.toFixed(1))
      };
    });
  }, [computedReports]);

  // Selected report details
  const selectedReportDetails = useMemo(() => {
    if (!selectedReportId) return null;
    return computedReports.find(item => item.report.id === selectedReportId);
  }, [selectedReportId, computedReports]);

  return (
    <div className="space-y-6 pb-20" id="analytics-panel">
      {/* High Level Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Báo cấu / Ca máy</span>
            <Activity className="w-5 h-5 text-success-600" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800">{summaryMetrics.totalReports}</p>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">Lượt kiểm tra nộp về</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tổng Polymer Nạp</span>
            <Scale className="w-5 h-5 text-brand-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800">{formatNumber(summaryMetrics.totalPlasticKg, 0)} <span className="text-xs font-bold text-slate-500">kg</span></p>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">Nhựa nguyên + tái sinh xuất kho</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Phế phẩm tỷ lệ</span>
            <Trash2 className="w-5 h-5 text-rose-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800">{formatNumber(summaryMetrics.totalWasteKg, 1)} <span className="text-xs font-bold text-slate-500">kg</span></p>
            <p className="text-[10px] text-rose-600 font-bold mt-1 bg-rose-50/50 px-1 py-0.5 rounded w-max">
              Hao hụt hạt: {formatNumber(summaryMetrics.avgVariancePercent)}%
            </p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-gradient-to-br from-success-800 to-slate-900 p-4 rounded-xl text-slate-100 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-success-300">
            <span className="text-xs font-bold uppercase tracking-wider text-success-400">Hiệu Suất Chỉ Số</span>
            <Award className="w-5 h-5 text-success-400" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-white">
              {summaryMetrics.totalReports > 0 
                ? `${((summaryMetrics.optimalCount / summaryMetrics.totalReports) * 100).toFixed(0)}%` 
                : '0%'
              }
            </p>
            <p className="text-[10px] text-success-200 mt-1 font-medium">Đạt mức tiêu chuẩn xanh</p>
          </div>
        </div>
      </div>

      {/* Visual Analytics Graphs (Vite compiled charts via recharts) */}
      {reports.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1: Output Product Trend */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center pb-2">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-success-500" />
                Sản Lượng Thành Phẩm & Vật Tư Nhập Ca
              </h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Đối chiếu kg</span>
            </div>
            
            <div className="h-60 w-full text-xs font-medium">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px' }} />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Nhựa Phối Trộn (kg)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Thành Phẩm Thực Tế (kg)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Waste and Variance Line */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center pb-2">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Lượng Phế Phẩm Sinh Ra Theo Ca (kg)
              </h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Phế phẩm dây chuyền</span>
            </div>
            
            <div className="h-60 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px' }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="Phế Phẩm (kg)" stroke="#f43f5e" fill="#ffe4e6" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 font-medium">
          Chưa có báo cáo sản lượng để vẽ biểu đồ trực quan
        </div>
      )}

      {/* Reports List Screen with Filtration */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">Danh Sách Báo Cáo Gần Đây</h3>
            <p className="text-xs text-slate-500 mt-0.5">Lọc báo cáo nộp của phân xưởng để tra cứu chi tiết</p>
          </div>
          
          <button
            type="button"
            id="reset-db-btn"
            onClick={onResetDb}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-success-700 bg-slate-50 hover:bg-success-50 border border-slate-200 rounded-xl px-3 py-2 transition h-9 min-h-[36px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Khôi phục dữ liệu mẫu
          </button>
        </div>

        {/* Filters and Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          {/* Search bar */}
          <div className="sm:col-span-7 relative">
            <input
              type="text"
              id="report-search-bar"
              className="w-full h-10 pl-9 pr-4 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-success-500 placeholder:text-slate-400"
              placeholder="Tìm theo thợ chính, thợ phụ, mã hàng PE/PP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ minHeight: '44px' }}
            />
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
          </div>

          {/* Machine selector filter */}
          <div className="sm:col-span-5 relative">
            <select
              id="machine-filter-select"
              className="w-full h-10 px-3 pr-8 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-success-500 cursor-pointer appearance-none"
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              style={{ minHeight: '44px' }}
            >
              <option value="">-- Tất cả máy SX --</option>
              {uniqueMachines.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
              <Filter className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Vertical list of rows layout */}
        {isLoading ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-400">
            Xin chờ, đang nạp dữ liệu phân tích...
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="space-y-2.5 divide-y divide-slate-50 max-h-[460px] overflow-y-auto pr-1">
            {filteredReports.map(({ report, metrics }, index) => {
              const statusColors = {
                optimal: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-200', icon: CheckCircle },
                warning: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-200', icon: HelpCircle },
                error: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: ShieldAlert }
              };
              const style = statusColors[metrics.status];
              const IconComp = style.icon;

              return (
                <div
                  key={report.id}
                  id={`report-row-${report.id}`}
                  onClick={() => setSelectedReportId(report.id)}
                  className={`pt-3 first:pt-0 pb-3 flex items-center justify-between gap-3 cursor-pointer group hover:bg-slate-50/50 p-2 rounded-xl border border-transparent hover:border-slate-100 transition`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {report.date.split('-').reverse().join('/')}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                        {report.shiftInfo.machineId.split(' ')[0]}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {report.shiftInfo.shiftName.split(' ')[0]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <p className="text-sm font-bold text-slate-800 leading-tight">
                        {report.shiftInfo.operatorName}
                      </p>
                      <span className="text-xs text-slate-400 font-medium">({report.productEntry.productCode})</span>
                    </div>

                    {/* Meta quick data */}
                    <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
                      <span>Thành phẩm: <strong className="text-slate-600">{formatNumber(metrics.actualProductWeight)} kg</strong></span>
                      <span className="w-1 h-3 border-r border-slate-200" />
                      <span>Phế phẩm: <strong className="text-rose-600">{formatNumber(report.wasteWeight)} kg</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Variance status badge */}
                    <div className={`hidden xs:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}>
                      <IconComp className="w-3.5 h-3.5" />
                      <span>Hao hụt {formatNumber(metrics.variancePercent)}%</span>
                    </div>

                    {/* Small layout fallback */}
                    <div className={`xs:hidden w-2 h-2 rounded-full ${metrics.status === 'optimal' ? 'bg-success-500' : metrics.status === 'warning' ? 'bg-warning-400' : 'bg-rose-500'}`} />

                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-all shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-sm font-semibold text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Không tìm thấy bản ghi báo cáo nào phù hợp bộ lọc
          </div>
        )}
      </div>

      {/* Interactive Bottom Sheet details modal */}
      {selectedReportDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end xs:items-center justify-center p-0 xs:p-4 animate-fadeIn" id="detail-modal-overlay">
          <div className="bg-white w-full max-w-lg rounded-t-2xl xs:rounded-2xl max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col focus:outline-none">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <span className="text-[10px] font-extrabold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full uppercase">
                  BÁO CÁO CHI TIẾT
                </span>
                <h3 className="text-base font-extrabold text-slate-800 mt-1">
                  {selectedReportDetails.report.date.split('-').reverse().join('/')} - Máy {selectedReportDetails.report.shiftInfo.machineId.split(' ')[0]}
                </h3>
              </div>
              <button
                type="button"
                id="close-modal-btn"
                onClick={() => setSelectedReportId(null)}
                className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 hover:shadow shadow-sm transition"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-5 flex-1">
              {/* Operator details and work crew info */}
              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Thợ chính trực ca</span>
                  <p className="text-sm font-bold text-slate-800">{selectedReportDetails.report.shiftInfo.operatorName}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Thợ phụ trực ca</span>
                  <p className="text-sm font-semibold text-slate-700">{selectedReportDetails.report.shiftInfo.assistantName}</p>
                </div>
                <div className="col-span-2 pt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 font-semibold border-t border-slate-50">
                  <span>Ca máy: <strong>{selectedReportDetails.report.shiftInfo.machineId}</strong></span>
                  <span>Mã trích: <strong>{selectedReportDetails.report.shiftInfo.shiftName}</strong></span>
                </div>
              </div>

              {/* Product summary */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Thành Phẩm Ca Máy</span>
                <div className="p-3 bg-success-50/50 rounded-xl border border-success-100 flex justify-between items-center text-sm font-semibold text-slate-700">
                  <div>
                    <p className="font-extrabold text-slate-900">{selectedReportDetails.report.productEntry.productCode}</p>
                    <p className="text-[11px] text-slate-500">Quy cách: {STANDARD_PRODUCTS.find(p => p.code === selectedReportDetails.report.productEntry.productCode)?.name || 'Khác'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-success-800">{selectedReportDetails.report.productEntry.rolls} cuộn đạt</p>
                    <p className="text-xs text-slate-500 font-bold">Thực tế: {selectedReportDetails.metrics.actualProductWeight} kg</p>
                  </div>
                </div>
              </div>

              {/* Raw Material Batch-by-Batch breakdown */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Hao Hụt & Phối Trộn Vật Tư</span>
                
                {/* Variance indicator */}
                <div className={`p-4 rounded-xl border ${
                  selectedReportDetails.metrics.status === 'optimal' 
                    ? 'bg-success-50 border-success-200 text-success-800' 
                    : selectedReportDetails.metrics.status === 'warning' 
                    ? 'bg-warning-50 border-warning-200 text-warning-800' 
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                } space-y-1.5`}>
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span>Hao Hụt Polymer Thực Tế:</span>
                    <span className="font-mono text-base">{selectedReportDetails.metrics.variancePercent.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed opacity-90">{selectedReportDetails.metrics.statusMessage}</p>
                </div>

                {/* Batch analysis table */}
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs shadow-sm bg-slate-50/30">
                  {(Object.keys(MATERIAL_LABELS) as Array<keyof typeof MATERIAL_LABELS>).map((key) => {
                    const labelCfg = MATERIAL_LABELS[key];
                    const batchWeights = selectedReportDetails.report.materials[key] || [];
                    const totalSum = sumArray(batchWeights);

                    return (
                      <div key={key} className="p-3 space-y-1.5">
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-slate-800">{labelCfg.label}</span>
                          <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-extrabold">
                            Tổng {formatNumber(totalSum)} {labelCfg.unit}
                          </span>
                        </div>
                        {batchWeights.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {batchWeights.map((v, i) => (
                              <div key={i} className="flex items-center gap-1 font-mono text-[10px] text-slate-500 bg-white border border-slate-100 px-1.5 py-0.5 rounded">
                                <CornerDownRight className="w-2.5 h-2.5 text-slate-400" />
                                <span>Lần {i+1}: <strong>{v} kg</strong></span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Waste Weights */}
              <div className="p-3 bg-rose-50/20 border border-rose-100/50 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="text-slate-500">Khối lượng phế phẩm trong ca:</span>
                <span className="text-sm font-extrabold text-rose-600">{selectedReportDetails.report.wasteWeight} kg phế phẩm</span>
              </div>

              {/* Operator Notes log logs */}
              {selectedReportDetails.report.notes && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs">
                  <span className="font-bold text-slate-400 uppercase text-[10px]">Nhật ký vận hành / Notes</span>
                  <p className="text-slate-600 font-medium leading-relaxed italic">
                    "{selectedReportDetails.report.notes}"
                  </p>
                </div>
              )}
            </div>

            {/* Footer action */}
            <div className="p-4 pb-safe border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <span className="text-[10px] font-mono text-slate-400 shrink-0">Báo cáo ID: {selectedReportDetails.report.id}</span>
              <button
                type="button"
                onClick={() => setSelectedReportId(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition"
                style={{ minHeight: '44px' }}
              >
                Đóng chi tiết
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
