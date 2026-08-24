import React, { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';

interface MachineCell {
  tenMay: string;
  nhanSu: Array<{ name: string; dispatch?: string }>;
}

interface LichRow {
  khungGio: string;
  tenCa: string;
  machines: MachineCell[];
}

interface ScheduleData {
  ngay: string;
  ca_list: any[];
  may_list: any[];
  lich: LichRow[];
}

interface LichLamViecPrintProps {
  ngay: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LichLamViecPrint({ ngay, isOpen, onClose }: LichLamViecPrintProps) {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError('');
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/lich-lam-viec?ngay=${encodeURIComponent(ngay)}`);
        if (res.ok) {
          const result = await res.json();
          setData(result);
        } else {
          const err = await res.json();
          setError(err.error || 'Lỗi khi tải dữ liệu lịch làm việc.');
        }
      } catch (err: any) {
        setError(err.message || 'Lỗi khi tải dữ liệu lịch làm việc.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [ngay, isOpen]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Xem trước lịch làm việc</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : data && data.ca_list && data.ca_list.length > 0 ? (
            <div
              id="lich-lam-viec-print"
              className="space-y-6"
              style={{
                fontFamily: 'Arial, sans-serif'
              }}
            >
              {/* Title */}
              <div className="text-center">
                <h1 className="text-xl font-bold text-zinc-900 mb-2">
                  LỊCH LÀM VIỆC THEO NGÀY CÁC TỔ
                </h1>
                <p className="text-lg font-semibold text-zinc-800">
                  NGÀY {formatDate(data.ngay)}
                </p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-zinc-300">
                <table
                  className="w-full border-collapse"
                  style={{
                    fontSize: '11px'
                  }}
                >
                  <thead>
                    <tr className="bg-zinc-100 border-b-2 border-zinc-300">
                      <th className="border border-zinc-300 px-2 py-2 text-left font-bold text-zinc-900 w-24">
                        Khung Giờ
                      </th>
                      <th className="border border-zinc-300 px-2 py-2 text-left font-bold text-zinc-900 w-16">
                        Ca SX
                      </th>
                      {data.may_list.map(may => (
                        <th
                          key={may.id}
                          className="border border-zinc-300 px-2 py-2 text-left font-bold text-zinc-900 min-w-20"
                        >
                          {may.ten_may}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.lich.map((row, idx) => (
                      <tr key={idx} className="border-b border-zinc-300">
                        <td className="border border-zinc-300 px-2 py-2 text-zinc-900 font-medium">
                          {row.khungGio}
                        </td>
                        <td className="border border-zinc-300 px-2 py-2 text-zinc-800">
                          {row.tenCa}
                        </td>
                        {row.machines.map((machineCell, midx) => (
                          <td
                            key={midx}
                            className="border border-zinc-300 px-2 py-2 text-zinc-700"
                            style={{ verticalAlign: 'top' }}
                          >
                            {machineCell.nhanSu.length > 0 ? (() => {
                              const withoutDispatch = machineCell.nhanSu.filter(p => !p.dispatch);
                              const withDispatch = machineCell.nhanSu.filter(p => p.dispatch);
                              const names = withoutDispatch.map(p => p.name);
                              return (
                                <div className="space-y-0.5">
                                  {names.length > 0 && (
                                    <div className="text-xs leading-tight">
                                      {names.join(', ')}
                                    </div>
                                  )}
                                  {withDispatch.map((person, pidx) => (
                                    <div key={pidx} className="text-xs leading-tight">
                                      <div>{person.name}</div>
                                      <div className="italic text-zinc-600">
                                        {person.dispatch}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })() : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-600">
              Không có dữ liệu lịch làm việc cho ngày {formatDate(data?.ngay || '')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => {
              const element = document.getElementById('lich-lam-viec-print');
              if (element) {
                const originalDisplay = document.body.style.display;
                const printWindow = window.open('', '', 'width=1200,height=800');
                if (printWindow) {
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Lịch làm việc ${formatDate(data?.ngay || '')}</title>
                        <style>
                          @page {
                            size: A4 landscape;
                            margin: 10mm;
                          }
                          body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 10mm;
                          }
                          table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 11px;
                          }
                          th, td {
                            border: 1px solid #333;
                            padding: 4px;
                            text-align: left;
                          }
                          th {
                            background-color: #f3f4f6;
                            font-weight: bold;
                          }
                          h1, h2 {
                            text-align: center;
                            margin: 10px 0;
                          }
                          h1 {
                            font-size: 16px;
                          }
                          h2 {
                            font-size: 14px;
                            font-weight: normal;
                          }
                        </style>
                      </head>
                      <body>
                        ${element.innerHTML}
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.print();
                  printWindow.close();
                }
              }
            }}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            IN LỊCH LÀM VIỆC
          </button>
          <button
            onClick={onClose}
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
