import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ProductionReport, ShiftInfo, ProductEntry, MaterialBatches 
} from './types';
import { computeReportMetrics, formatNumber } from './utils';
import ShiftInfoForm from './components/ShiftInfoForm';
import ProductEntryForm from './components/ProductEntryForm';
import MaterialsForm from './components/MaterialsForm';
import WasteForm from './components/WasteForm';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { 
  FileSpreadsheet, FilePlus2, BarChart3, Wifi, WifiOff, 
  HelpCircle, CheckCircle, Smartphone, MapPin, 
  ChevronRight, ChevronLeft, Save, Sparkles, Loader2
} from 'lucide-react';

const STORAGE_DRAFT_KEY = 'factory_report_draft_v1';
const STORAGE_OFFLINE_KEY = 'factory_reports_offline_queue';

const DEFAULT_REPORT: Omit<ProductionReport, 'id' | 'createdAt'> = {
  date: new Date().toISOString().split('T')[0],
  shiftInfo: {
    machineId: '',
    shiftName: '',
    operatorName: '',
    assistantName: ''
  },
  productEntry: {
    productCode: '',
    rolls: 0,
    actualWeight: 0
  },
  materials: {
    virginPlastic: [0],
    recycledPlastic: [0],
    brightenerPowder: [0],
    dispersionOil: [0],
    otherAdditives: [0]
  },
  wasteWeight: 0,
  notes: ''
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'form' | 'dashboard'>('form');
  const [currentStep, setCurrentStep] = useState<number>(1); // 1: Shift & Product, 2: Materials, 3: Waste & Submit
  const [reportForm, setReportForm] = useState<Omit<ProductionReport, 'id' | 'createdAt'>>(DEFAULT_REPORT);
  const [reports, setReports] = useState<ProductionReport[]>([]);
  
  // App states
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [isFetchLoading, setIsFetchLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notifications, setNotifications] = useState<{ id: string; text: string; type: 'success' | 'error' | 'warning' }[]>([]);
  const [offlineReports, setOfflineReports] = useState<ProductionReport[]>([]);

  // 1. Fetch reports from Server DB
  const fetchReports = async () => {
    setIsFetchLoading(true);
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      } else {
        addNotification('Không thể lấy báo cáo từ máy chủ. Đang hiển thị bản lưu thiết bị.', 'warning');
      }
    } catch (err) {
      addNotification('Mất kết nối máy chủ dữ liệu. Kiểm tra sóng di động.', 'warning');
    } finally {
      setIsFetchLoading(false);
    }
  };

  // Sync / loading on mount
  useEffect(() => {
    fetchReports();

    // Check navigator online status
    const handleOnline = () => {
      setIsOnline(true);
      addNotification('Thiết bị trực tuyến bản ghi. Sẵn sàng đồng bộ!', 'success');
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      addNotification('Đã ngắt mạng kết nối. Đang kích hoạt lưu cục bộ.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load draft from localStorage on start
    const cachedDraft = localStorage.getItem(STORAGE_DRAFT_KEY);
    if (cachedDraft) {
      try {
        setReportForm(JSON.parse(cachedDraft));
      } catch (e) {
        console.error('Lỗi khi phục hồi bản nháp:', e);
      }
    }

    // Load offline queue
    const cachedQueue = localStorage.getItem(STORAGE_OFFLINE_KEY);
    if (cachedQueue) {
      try {
        setOfflineReports(JSON.parse(cachedQueue));
      } catch (e) {
        console.error('Lỗi phục hồi hàng chờ ngoại tuyến:', e);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync draft to storage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(reportForm));
  }, [reportForm]);

  // Sync offline queue to storage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_OFFLINE_KEY, JSON.stringify(offlineReports));
  }, [offlineReports]);

  // Helper to add floating toast notifications
  const addNotification = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = `${Date.now()}`;
    setNotifications(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Submit a production report
  const handleSubmitReport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Complete form validation
    const { machineId, shiftName, operatorName, assistantName } = reportForm.shiftInfo;
    const { productCode, rolls, actualWeight } = reportForm.productEntry;
    
    if (!machineId || !shiftName || !operatorName || !assistantName) {
      addNotification('Vui lòng điền đầy đủ Thông tin Ca Trực ở Bước 1!', 'error');
      setCurrentStep(1);
      return;
    }
    if (!productCode || !rolls || !actualWeight) {
      addNotification('Vui lòng điền thông tin Thành Phẩm ở Bước 1!', 'error');
      setCurrentStep(1);
      return;
    }

    setIsSubmitLoading(true);

    try {
      if (isOnline) {
        // Send directly to Express Server API
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportForm)
        });

        if (res.ok) {
          const newRep = await res.json();
          addNotification('Lưu báo cáo lên database Đà Nẵng thành công!', 'success');
          // Update local list
          setReports(prev => [newRep, ...prev]);
          // Reset form draft
          handleResetForm();
        } else {
          // Server returned error, queue offline instead
          throw new Error('Server returned error status');
        }
      } else {
        // Offline capability fallback
        const offlineRep: ProductionReport = {
          ...reportForm,
          id: `rep_offline_${Date.now()}`,
          createdAt: new Date().toISOString()
        };
        setOfflineReports(prev => [offlineRep, ...prev]);
        addNotification('Mất sóng kho! Báo cáo đã lưu tạm tại LocalStorage trên máy dọn.', 'warning');
        // Reset form draft
        handleResetForm();
      }
    } catch (err) {
      // API error fallback
      const offlineRep: ProductionReport = {
        ...reportForm,
        id: `rep_offline_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      setOfflineReports(prev => [offlineRep, ...prev]);
      addNotification('Mất mạng kết nối. Đã lưu báo cáo dự phòng ngoại tuyến.', 'warning');
      handleResetForm();
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Synchronize queued offline reports once connection returns
  const syncOfflineQueue = async () => {
    const cachedQueue = localStorage.getItem(STORAGE_OFFLINE_KEY);
    if (!cachedQueue) return;
    
    try {
      const parsedQueue: ProductionReport[] = JSON.parse(cachedQueue);
      if (parsedQueue.length === 0) return;

      addNotification(`Đang tự động đồng bộ ${parsedQueue.length} báo cáo nộp tạm...`, 'success');

      for (const rep of parsedQueue) {
        // Stripe out id generated for offline identification so server assigns database order key
        const { id, ...cleanForm } = rep; 
        await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanForm)
        });
      }

      // Success, empty local table queue
      setOfflineReports([]);
      localStorage.setItem(STORAGE_OFFLINE_KEY, '[]');
      addNotification('Đồng bộ dữ liệu nộp tạm thành công!', 'success');
      // Reload main database
      fetchReports();
    } catch (e) {
      console.error('Không thể tự động đồng bộ báo cáo ngoại tuyến:', e);
    }
  };

  // Reset form helper
  const handleResetForm = () => {
    setReportForm(DEFAULT_REPORT);
    localStorage.removeItem(STORAGE_DRAFT_KEY);
    setCurrentStep(1);
    setActiveTab('dashboard'); // Redirect operator to dashboard to view live results
  };

  // Reset Server Database (for demo and review testing)
  const handleResetDb = async () => {
    if (window.confirm('Vui lòng xác nhận khôi phục tất cả dữ liệu báo cáo về bản seeding mẫu?')) {
      try {
        const res = await fetch('/api/reports/reset', { method: 'POST' });
        if (res.ok) {
          const resJson = await res.json();
          setReports(resJson.data);
          addNotification('Khôi phục database mẫu Đà Nẵng thành công!', 'success');
        }
      } catch (e) {
        addNotification('Lỗi khi khôi phục database.', 'error');
      }
    }
  };

  // Wizard update handlers
  const updateShiftInfo = (updated: Partial<ShiftInfo>) => {
    setReportForm(prev => ({
      ...prev,
      shiftInfo: { ...prev.shiftInfo, ...updated }
    }));
  };

  const updateProductEntry = (updated: Partial<ProductEntry>) => {
    setReportForm(prev => ({
      ...prev,
      productEntry: { ...prev.productEntry, ...updated }
    }));
  };

  const updateMaterials = (updated: Partial<MaterialBatches>) => {
    setReportForm(prev => ({
      ...prev,
      materials: { ...prev.materials, ...updated }
    }));
  };

  const updateWasteAndNotes = (updates: { wasteWeight?: number; notes?: string }) => {
    setReportForm(prev => ({
      ...prev,
      ...updates
    }));
  };

  // Derived metrics for real-time stepper footer preview
  const activeMetrics = computeReportMetrics(reportForm);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col sm:py-6 sm:px-4 font-sans selection:bg-emerald-500 selection:text-white" id="main-root-container">
      {/* Smartphone framework emulator on Wide Screens, fullscreen and intuitive on small touch screens */}
      <div className="w-full max-w-4xl mx-auto bg-slate-900 sm:rounded-3xl sm:shadow-2xl overflow-hidden flex flex-col min-h-screen sm:min-h-[850px] sm:border sm:border-slate-800">
        
        {/* Device Status Header / Bar */}
        <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800/80 px-4 py-3 shrink-0 flex items-center justify-between pt-safe">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight leading-none uppercase">ĐÀ NẴNG PLANT</h1>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Vận Hành Máy & Báo Cáo Sản Xuất</p>
            </div>
          </div>

          {/* Network status and offline indicator pills */}
          <div className="flex items-center gap-1.5">
            {offlineReports.length > 0 && (
              <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full animate-pulse border border-rose-500/30">
                Tạm {offlineReports.length}
              </span>
            )}
            
            {isOnline ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <Wifi className="w-3.5 h-3.5" />
                Đồng bộ
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                <WifiOff className="w-3.5 h-3.5" />
                Ngoại tuyến
              </span>
            )}
          </div>
        </header>

        {/* Floating notifications / Toasts layout */}
        <div className="fixed top-14 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm mx-auto">
          <AnimatePresence>
            {notifications.map(n => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-3 rounded-xl border shadow-lg text-xs font-semibold flex items-start gap-2 backdrop-blur-md ${
                  n.type === 'success' 
                    ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' 
                    : n.type === 'error' 
                    ? 'bg-rose-950/90 border-rose-500/30 text-rose-200' 
                    : 'bg-amber-950/90 border-amber-500/30 text-amber-200'
                }`}
              >
                {n.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                <p className="flex-1 leading-relaxed">{n.text}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Tab navigation links */}
        <nav className="bg-slate-900 border-b border-slate-800 grid grid-cols-2 text-center" id="tab-navigation">
          <button
            type="button"
            id="tab-btn-form"
            onClick={() => setActiveTab('form')}
            className={`py-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
              activeTab === 'form' 
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-950/40' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{ minHeight: '44px' }}
          >
            <FilePlus2 className="w-4 h-4" />
            Nhập Báo Cáo
          </button>
          
          <button
            type="button"
            id="tab-btn-dashboard"
            onClick={() => {
              setActiveTab('dashboard');
              fetchReports(); // refresh lists on visit
            }}
            className={`py-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
              activeTab === 'dashboard' 
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-950/40' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{ minHeight: '44px' }}
          >
            <BarChart3 className="w-4 h-4" />
            Phân Tích & Đối Chiếu
          </button>
        </nav>

        {/* Main Content scrollable container viewport */}
        <main className="flex-1 overflow-y-auto bg-slate-50 focus:outline-none p-4 md:p-6" id="applet-viewport">
          <AnimatePresence mode="wait">
            {activeTab === 'form' ? (
              <motion.div
                key="form-stepper"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* Visual Wizard Stepper Indicator */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider leading-none">BƯỚC</span>
                    <span className="text-lg font-black text-slate-800 leading-none">{currentStep}/3</span>
                  </div>
                  
                  {/* Visual segment progress lines */}
                  <div className="flex-1 mx-4 flex gap-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${currentStep >= 1 ? 'bg-emerald-500 w-1/3' : 'w-0'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${currentStep >= 2 ? 'bg-emerald-500 w-1/3' : 'w-0'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${currentStep >= 3 ? 'bg-emerald-500 w-1/3' : 'w-0'}`} />
                  </div>

                  <span className="text-[11px] font-bold text-slate-500 shrink-0">
                    {currentStep === 1 ? 'Thông tin & Mã hàng' : currentStep === 2 ? 'Phối trộn polymer' : 'Phế phẩm & Lưu'}
                  </span>
                </div>

                {/* Stepper Card Frame */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm min-h-[300px]">
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <ShiftInfoForm data={reportForm.shiftInfo} onChange={updateShiftInfo} />
                      <div className="pt-2 border-t border-slate-100">
                        <ProductEntryForm data={reportForm.productEntry} onChange={updateProductEntry} />
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <MaterialsForm data={reportForm.materials} onChange={updateMaterials} />
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <WasteForm 
                        wasteWeight={reportForm.wasteWeight} 
                        notes={reportForm.notes || ''} 
                        onChange={updateWasteAndNotes} 
                      />

                      {/* Final layout summary review before submission */}
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                          Tổng Hợp Kết Quả Báo Cáo
                        </h4>

                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-semibold py-1 border-b border-slate-800">
                          <div>Ca máy: <span className="text-slate-300 block">{reportForm.shiftInfo.machineId.split(' ')[0] || '--'}</span></div>
                          <div>Mã hàng: <span className="text-slate-300 block">{reportForm.productEntry.productCode || '--'}</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs py-1 border-b border-slate-800 font-mono">
                          <div>Polymer phối: <strong className="text-indigo-400 text-sm block">{formatNumber(activeMetrics.totalPlastic)} kg</strong></div>
                          <div>Thành phẩm: <strong className="text-emerald-400 text-sm block">{formatNumber(activeMetrics.actualProductWeight)} kg</strong></div>
                        </div>

                        {/* Variance result */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Phế phẩm: <strong className="text-rose-400">{formatNumber(reportForm.wasteWeight)} kg</strong></span>
                          <span>Tỉ lệ hao hụt: <strong className={`${
                            activeMetrics.status === 'optimal' ? 'text-emerald-400' : activeMetrics.status === 'warning' ? 'text-amber-400' : 'text-rose-400'
                          }`}>{formatNumber(activeMetrics.variancePercent)}%</strong></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submitting / Loader overlay */}
                {isSubmitLoading && (
                  <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="p-5 bg-white rounded-2xl shadow-xl flex items-center gap-3.5 text-slate-800 font-bold max-w-sm">
                      <Loader2 className="w-6 h-6 text-emerald-600 animate-spin shrink-0" />
                      <span>Đang mã hóa & đồng bộ dữ liệu Đà Nẵng...</span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="dashboard-charts"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <AnalyticsDashboard 
                  reports={reports} 
                  onResetDb={handleResetDb} 
                  isLoading={isFetchLoading} 
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Dynamic STICKY Wizard Footer Bar for Form Inputs - locked at bottom, min height 44px layout */}
        {activeTab === 'form' && (
          <footer className="sticky bottom-0 z-40 bg-white border-t border-slate-200 py-3.5 pb-safe px-4 shrink-0 shadow-lg flex items-center justify-between" id="sticky-wizard-footer">
            <div className="flex-1 flex gap-3">
              {currentStep > 1 ? (
                <button
                  type="button"
                  id="wizard-prev-btn"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="h-12 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition font-bold text-sm text-slate-600 flex items-center justify-center gap-1 active:scale-95"
                  style={{ minHeight: '44px' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Quay lại</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Khôi phục bản ghi nháp hiện tại?')) {
                      setReportForm(DEFAULT_REPORT);
                      localStorage.removeItem(STORAGE_DRAFT_KEY);
                      addNotification('Đã xóa trắng nháp báo cáo!', 'success');
                    }
                  }}
                  className="h-12 px-4 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 transition font-bold text-xs text-slate-500 shrink-0 active:scale-95"
                  style={{ minHeight: '44px' }}
                >
                  Reset Nháp
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  id="wizard-next-btn"
                  onClick={() => {
                    // Quick validation for Step 1
                    if (currentStep === 1) {
                      const { machineId, shiftName, operatorName, assistantName } = reportForm.shiftInfo;
                      const { productCode, rolls, actualWeight } = reportForm.productEntry;
                      if (!machineId || !shiftName || !operatorName || !assistantName) {
                        addNotification('Thiếu! Hãy nhập đầy đủ thông tin Ca máy và thợ máy.', 'warning');
                        return;
                      }
                      if (!productCode || !rolls || !actualWeight) {
                        addNotification('Thiếu! Hãy chọn Mã SP, Số lượng cuộn đạt và Cân nặng.', 'warning');
                        return;
                      }
                    }
                    setCurrentStep(prev => prev + 1);
                  }}
                  className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-850 text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow"
                  style={{ minHeight: '44px' }}
                >
                  <span>Tiếp tục</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  id="save-report-submit-btn"
                  onClick={() => handleSubmitReport()}
                  className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-600/10"
                  style={{ minHeight: '44px' }}
                >
                  <Save className="w-4.5 h-4.5" />
                  <span>Nộp & Lưu báo cáo</span>
                </button>
              )}
            </div>
          </footer>
        )}
        
      </div>
    </div>
  );
}
