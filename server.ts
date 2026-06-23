import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { ProductionReport } from './src/types';

const DB_FILE_PATH = path.join(process.cwd(), 'reports-db.json');

// Helper to seed standard reports if file doesn't exist
function getReportsFromDb(): ProductionReport[] {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      const seedReports: ProductionReport[] = [
        {
          id: 'rep_seed_1',
          date: '2026-06-20',
          shiftInfo: {
            machineId: 'MÁY SX-01 (Đùn PE)',
            shiftName: 'Ca 12C1 (08:00 - 20:00)',
            operatorName: 'Nguyễn Văn Hùng',
            assistantName: 'Trần Minh Tâm'
          },
          productEntry: {
            productCode: 'PE-LD100',
            rolls: 12,
            actualWeight: 295.5
          },
          materials: {
            virginPlastic: [100, 100],
            recycledPlastic: [50, 50],
            brightenerPowder: [1.5],
            dispersionOil: [0.5],
            otherAdditives: [0.3]
          },
          wasteWeight: 3.2,
          notes: 'Vận hành ổn định, màng PE bóng dẻo đạt chuẩn. Hao hụt cắt biên mỏng.',
          createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: 'rep_seed_2',
          date: '2026-06-21',
          shiftInfo: {
            machineId: 'MÁY SX-02 (Đùn PE)',
            shiftName: 'Ca 12C2 (20:00 - 08:00)',
            operatorName: 'Lê Hoàng Hải',
            assistantName: 'Phan Thanh Bình'
          },
          productEntry: {
            productCode: 'PE-HD200',
            rolls: 8,
            actualWeight: 402.0
          },
          materials: {
            virginPlastic: [150, 150],
            recycledPlastic: [55, 50],
            brightenerPowder: [2.0],
            dispersionOil: [0.8],
            otherAdditives: [0.5]
          },
          wasteWeight: 2.5,
          notes: 'Chạy cuộn PE-HD200 dày dặn, tỷ lệ trộn nhựa tái sinh tăng nhẹ nhưng màng dai đạt chuẩn.',
          createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: 'rep_seed_3',
          date: '2026-06-22',
          shiftInfo: {
            machineId: 'MÁY SX-03 (Dệt PP)',
            shiftName: 'Ca 12C1 (08:00 - 20:00)',
            operatorName: 'Nguyễn Văn Hùng',
            assistantName: 'Trần Minh Tâm'
          },
          productEntry: {
            productCode: 'PP-Y101',
            rolls: 10,
            actualWeight: 388.0
          },
          materials: {
            virginPlastic: [180, 170],
            recycledPlastic: [25, 25],
            brightenerPowder: [3.0],
            dispersionOil: [1.0],
            otherAdditives: [1.2]
          },
          wasteWeight: 10.5,
          notes: 'Một số cuộn lỗi phế phẩm đầu mẩu do nhiệt độ đầu đùn chưa đều nửa đầu ca, đã căn chỉnh lại.',
          createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
        }
      ];
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(seedReports, null, 2), 'utf-8');
      return seedReports;
    }

    const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Lỗi khi đọc file CSDL:', error);
    return [];
  }
}

function saveReportsToDb(reports: ProductionReport[]): boolean {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(reports, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu file CSDL:', error);
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Get all reports
  app.get('/api/reports', (req, res) => {
    const list = getReportsFromDb();
    // Sort by Date descending (most recent first)
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(list);
  });

  // API Route: Create a new report
  app.post('/api/reports', (req, res) => {
    try {
      const reportData = req.body;
      
      if (!reportData.date || !reportData.shiftInfo || !reportData.productEntry) {
        return res.status(400).json({ error: 'Yêu cầu điền đầy đủ dữ liệu bắt buộc!' });
      }

      const list = getReportsFromDb();
      
      const newReport: ProductionReport = {
        ...reportData,
        id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date().toISOString()
      };

      list.push(newReport);
      const success = saveReportsToDb(list);

      if (success) {
        res.status(201).json(newReport);
      } else {
        res.status(500).json({ error: 'Không thể ghi lưu báo cáo mới vào cơ sở dữ liệu!' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi hệ thống không xác định' });
    }
  });

  // API Route: Reset database (optional/utility)
  app.post('/api/reports/reset', (req, res) => {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        fs.unlinkSync(DB_FILE_PATH);
      }
      const seeded = getReportsFromDb();
      res.json({ message: 'Đã hoàn tác và tạo mới dữ liệu mẫu biên chế!', data: seeded });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Development / Production Environment routing integrations
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FULLSTACK] Server running on http://0.0.0.0:${PORT}`);
    // Initialize DB with seed reports if missing
    getReportsFromDb();
  });
}

startServer();
