/**
 * Công thức quy trình NVL (bán tự động).
 * Wizard chọn quy trình + bước → gợi ý loại phiếu / mã / kho; user sửa rồi lưu từng phiếu.
 */

export const LOAI_SAN_XUAT_OPTIONS = ['Đặc', 'Sóng', 'Rỗng'] as const;
export type LoaiSanXuat = (typeof LOAI_SAN_XUAT_OPTIONS)[number];

/** Alias semantic: cột DB vẫn `phan_xuong`, UI gọi Loại sản xuất. */
export const LOAI_SAN_XUAT_OPTIONS_UI = LOAI_SAN_XUAT_OPTIONS;

export type NvlKhoHint = 'Kho NVL Chính' | 'Kho NVL Phụ' | 'Kho PC';

export type NvlProcessMode = 'nhap' | 'xuat' | 'chuyen';

export type NvlProcessLineHint = {
  ma?: string;
  tenGoiY?: string;
  kho?: NvlKhoHint;
  /** Mã đích sau chuyển đổi (nhập TP / đổi mã). */
  maDich?: string;
  khoDich?: NvlKhoHint;
};

export type NvlProcessStep = {
  id: string;
  title: string;
  description: string;
  mode: NvlProcessMode;
  /** Gợi ý loại nhập/xuất trên form. */
  loaiPhieu?: string;
  /** Cần đợt + loại SX (phiếu SX). */
  requiresSxMeta?: boolean;
  /** Cần chọn máy nguồn/đích. */
  requiresMay?: boolean;
  /** Gợi ý nguồn nhập. */
  nguonLoai?: '' | 'kho' | 'may' | 'ncc';
  lines?: NvlProcessLineHint[];
  /** Gợi ý chuyển kho sau bước (mở ChuyenKho / nhắc user). */
  chuyenKhoHint?: { tu: NvlKhoHint; den: NvlKhoHint; ma?: string[] };
  note?: string;
};

export type NvlProcessRecipe = {
  id: string;
  title: string;
  summary: string;
  steps: NvlProcessStep[];
};

/** Rule kho đích khi nhập phế theo mã. */
export const PHE_MA_KHO_RULES: Record<string, NvlKhoHint> = {
  SX01: 'Kho PC',
  SX06: 'Kho NVL Chính'
};

export function suggestedKhoForPheMa(ma: string): NvlKhoHint | null {
  const key = String(ma || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!key) return null;
  for (const [prefix, kho] of Object.entries(PHE_MA_KHO_RULES)) {
    if (key === prefix || key.startsWith(prefix)) return kho;
  }
  return null;
}

/** Map đổi mã tạo hạt / băm (nguồn → đích). */
export const MA_TRANSFORM: Record<string, string> = {
  MN01: 'MN01', // dư trả về
  MN02: 'MN06',
  MN05: 'MN04',
  SX01: 'SX02', // băm: phế SX → TP băm SX02 (nhập riêng)
  SX02: 'SX03',
  SX06: 'SX03',
  SX05: 'SX05' // trộn màu giữ; xuất tạo hạt → HM
};

export function transformMa(ma: string): string | null {
  const key = String(ma || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!key) return null;
  if (MA_TRANSFORM[key]) return MA_TRANSFORM[key];
  const hit = Object.entries(MA_TRANSFORM).find(([src]) => key.startsWith(src));
  return hit ? hit[1] : null;
}

export const NVL_PROCESS_RECIPES: NvlProcessRecipe[] = [
  {
    id: 'bam',
    title: '1. Quy trình băm',
    summary: 'Nhập MN01 mua ngoài về Kho PC (+ SX01 phế SX) → xuất băm → nhập TP băm (MN05, SX02) về PC; dư MN01 trả PC.',
    steps: [
      {
        id: 'bam-nhap-mn01',
        title: 'Nhập phế cái mua ngoài (MN01) về Kho PC',
        description: 'Nhập MN01 từ nhà cung cấp về Kho PC trước khi xuất xuống máy băm.',
        mode: 'nhap',
        loaiPhieu: 'Nhập kho từ Nhà cung cấp',
        nguonLoai: 'ncc',
        lines: [{ ma: 'MN01', kho: 'Kho PC', tenGoiY: 'Phế cái mua ngoài' }]
      },
      {
        id: 'bam-xuat-phe',
        title: 'Xuất phế xuống phân xưởng Băm',
        description: 'Xuất MN01 và SX01 từ Kho PC xuống máy băm.',
        mode: 'xuat',
        loaiPhieu: 'Xuất phế cái cho máy băm',
        requiresSxMeta: true,
        requiresMay: true,
        lines: [
          { ma: 'MN01', kho: 'Kho PC', tenGoiY: 'Phế cái mua ngoài' },
          { ma: 'SX01', kho: 'Kho PC', tenGoiY: 'Phế sản xuất' }
        ]
      },
      {
        id: 'bam-nhap-tp',
        title: 'Nhập thành phẩm băm + dư chưa băm',
        description: 'Nhập MN05 (TP băm) và SX02 về Kho PC; phần MN01 chưa băm hết nhập lại Kho PC.',
        mode: 'nhap',
        loaiPhieu: 'Nhập thành phẩm từ máy băm',
        requiresSxMeta: true,
        requiresMay: true,
        nguonLoai: 'may',
        lines: [
          { ma: 'MN05', kho: 'Kho PC', tenGoiY: 'Thành phẩm băm' },
          { ma: 'SX02', kho: 'Kho PC', tenGoiY: 'TP băm từ SX01' },
          { ma: 'MN01', kho: 'Kho PC', tenGoiY: 'Dư chưa băm hết' }
        ]
      }
    ]
  },
  {
    id: 'tao-hat',
    title: '2. Quy trình tạo hạt',
    summary: 'MN02/MN05/SX02 @ PC + SX06 @ NVL Chính → đổi mã MN06/MN04/SX03 → nhập TP PC rồi chuyển NVL Chính/Phụ; phế SX01 về PC.',
    steps: [
      {
        id: 'tao-hat-xuat',
        title: 'Xuất nguyên liệu tạo hạt',
        description: 'Xuất MN02, MN05, SX02 từ Kho PC và SX06 từ Kho NVL Chính sang máy tạo hạt.',
        mode: 'xuat',
        loaiPhieu: 'Xuất phế băm cho máy tạo hạt',
        requiresSxMeta: true,
        requiresMay: true,
        lines: [
          { ma: 'MN02', kho: 'Kho PC', maDich: 'MN06' },
          { ma: 'MN05', kho: 'Kho PC', maDich: 'MN04' },
          { ma: 'SX02', kho: 'Kho PC', maDich: 'SX03' },
          { ma: 'SX06', kho: 'Kho NVL Chính', maDich: 'SX03' }
        ]
      },
      {
        id: 'tao-hat-nhap-tp',
        title: 'Nhập thành phẩm tạo hạt về Kho PC',
        description: 'Nhập MN06, MN04, SX03 vào Kho PC (từ máy tạo hạt).',
        mode: 'nhap',
        loaiPhieu: 'Nhập thành phẩm từ máy tạo hạt, máy băm',
        requiresSxMeta: true,
        requiresMay: true,
        nguonLoai: 'may',
        lines: [
          { ma: 'MN06', kho: 'Kho PC' },
          { ma: 'MN04', kho: 'Kho PC' },
          { ma: 'SX03', kho: 'Kho PC' }
        ],
        chuyenKhoHint: {
          tu: 'Kho PC',
          den: 'Kho NVL Chính',
          ma: ['MN06', 'MN04', 'SX03']
        },
        note: 'Sau nhập PC: chuyển sang Kho NVL Chính/Phụ; phần chưa tạo hết trả kho nguồn.'
      },
      {
        id: 'tao-hat-phe',
        title: 'Nhập phế phân xưởng tạo hạt (SX01)',
        description: 'Phế SX01 của tạo hạt nhập về Kho PC.',
        mode: 'nhap',
        loaiPhieu: 'Nhập phế của các máy sóng, rỗng, đặc, tạo hạt',
        requiresSxMeta: true,
        requiresMay: true,
        nguonLoai: 'may',
        lines: [{ ma: 'SX01', kho: 'Kho PC' }]
      }
    ]
  },
  {
    id: 'tron-mau',
    title: '3. Quy trình trộn màu',
    summary: 'Xuất NS + hạt màu từ Chính/Phụ → SX05 → nhập NVL Chính → xuất tạo hạt → HM05/HM09 @ PC → chuyển NVL Phụ.',
    steps: [
      {
        id: 'tron-mau-xuat-nvl',
        title: 'B1. Xuất NS + hạt màu trộn',
        description: 'Lấy nguyên liệu từ Kho NVL Chính / Phụ xuất sang máy trộn → sản phẩm SX05.',
        mode: 'xuat',
        loaiPhieu: 'Xuất theo máy',
        requiresSxMeta: true,
        requiresMay: true,
        lines: [
          { kho: 'Kho NVL Chính', tenGoiY: 'Nhựa nguyên sinh / NS' },
          { kho: 'Kho NVL Phụ', tenGoiY: 'Hạt màu' }
        ]
      },
      {
        id: 'tron-mau-nhap-sx05',
        title: 'B2. Nhập SX05 về Kho NVL Chính',
        description: 'Nhập sản phẩm trộn màu SX05 về Kho NVL Chính.',
        mode: 'nhap',
        loaiPhieu: 'Nhập lại từ máy giữa đợt',
        requiresSxMeta: true,
        requiresMay: true,
        nguonLoai: 'may',
        lines: [{ ma: 'SX05', kho: 'Kho NVL Chính' }]
      },
      {
        id: 'tron-mau-xuat-tao-hat',
        title: 'B3. Xuất SX05 đi tạo hạt',
        description: 'Xuất SX05 sang máy tạo hạt → thành phẩm hạt màu kéo giãn HM05, HM09.',
        mode: 'xuat',
        loaiPhieu: 'Xuất theo máy',
        requiresSxMeta: true,
        requiresMay: true,
        lines: [{ ma: 'SX05', kho: 'Kho NVL Chính' }]
      },
      {
        id: 'tron-mau-nhap-hm',
        title: 'B4. Nhập HM05/HM09 @ PC rồi chuyển NVL Phụ',
        description: 'Nhập HM05, HM09 vào Kho PC (thành phẩm) rồi chuyển sang Kho NVL Phụ.',
        mode: 'nhap',
        loaiPhieu: 'Nhập thành phẩm từ máy tạo hạt, máy băm',
        requiresSxMeta: true,
        requiresMay: true,
        nguonLoai: 'may',
        lines: [
          { ma: 'HM05', kho: 'Kho PC' },
          { ma: 'HM09', kho: 'Kho PC' }
        ],
        chuyenKhoHint: { tu: 'Kho PC', den: 'Kho NVL Phụ', ma: ['HM05', 'HM09'] }
      }
    ]
  },
  {
    id: 'mua-ngoai',
    title: '4. Nhập mua ngoài',
    summary: 'MN03 + NNS → Kho NVL Chính; NVL phụ → Kho NVL Phụ (từ NCC).',
    steps: [
      {
        id: 'mua-mn03-nns',
        title: 'Nhập MN03 / NNS về Kho NVL Chính',
        description: 'Nhập hạt nhựa mua ngoài (MN03) và nhựa nguyên sinh (NNS) về Kho NVL Chính.',
        mode: 'nhap',
        loaiPhieu: 'Nhập kho từ Nhà cung cấp',
        nguonLoai: 'ncc',
        lines: [
          { ma: 'MN03', kho: 'Kho NVL Chính', tenGoiY: 'Hạt nhựa mua ngoài' },
          { ma: 'NNS', kho: 'Kho NVL Chính', tenGoiY: 'Nhựa nguyên sinh' }
        ]
      },
      {
        id: 'mua-nvl-phu',
        title: 'Nhập NVL phụ về Kho NVL Phụ',
        description: 'Nhập các mã NVL phụ về Kho NVL Phụ.',
        mode: 'nhap',
        loaiPhieu: 'Nhập kho từ Nhà cung cấp',
        nguonLoai: 'ncc',
        lines: [{ kho: 'Kho NVL Phụ', tenGoiY: 'NVL phụ' }]
      }
    ]
  },
  {
    id: 'xuat-sx',
    title: '5. Xuất NVL cho sản xuất',
    summary: 'Xuất theo máy + đợt + loại sản xuất (Đặc/Sóng/Rỗng). Không còn đích «phân xưởng».',
    steps: [
      {
        id: 'xuat-theo-may',
        title: '5.0 Xuất theo máy',
        description: 'Xuất NVL đến máy Đặc / Rỗng / Sóng. Bắt buộc đợt, ca, máy và Loại sản xuất.',
        mode: 'xuat',
        loaiPhieu: 'Xuất theo máy',
        requiresSxMeta: true,
        requiresMay: true
      },
      {
        id: 'xuat-theo-dot',
        title: '5.1 Theo dõi theo đợt – máy',
        description: 'Dùng màn NVL theo đợt–máy để xem xuất / nhập lại / phế theo đợt.',
        mode: 'xuat',
        loaiPhieu: 'Xuất theo máy',
        requiresSxMeta: true,
        requiresMay: true,
        note: 'Mở tab «NVL theo đợt–máy» để đối chiếu.'
      },
      {
        id: 'xuat-nhieu-may-loai-sx',
        title: '5.2 Xuất nhiều máy cùng loại sản xuất',
        description: 'Thay xuất theo phân xưởng: chọn Loại sản xuất rồi xuất từng máy (Đặc 1, Sóng 1 chạy đặc, …).',
        mode: 'xuat',
        loaiPhieu: 'Xuất theo máy',
        requiresSxMeta: true,
        requiresMay: true,
        note: 'Máy Sóng 1 chạy đặc vs sóng: phân biệt bằng ô Loại sản xuất.'
      }
    ]
  },
  {
    id: 'nhap-lai',
    title: '6. Nhập lại giữa / cuối đợt',
    summary: 'Chọn ngày, đợt, máy, loại SX. Kho nhập = kho đã xuất ở bước 5.',
    steps: [
      {
        id: 'nhap-lai-giua',
        title: 'Nhập lại giữa đợt',
        description: 'Nhập lại NVL từ máy về đúng kho đã xuất.',
        mode: 'nhap',
        loaiPhieu: 'Nhập lại từ máy giữa đợt',
        requiresSxMeta: true,
        requiresMay: true,
        nguonLoai: 'may',
        note: 'Hệ thống gợi ý kho nhập từ phiếu xuất cùng đợt–máy.'
      },
      {
        id: 'nhap-lai-cuoi',
        title: 'Nhập lại cuối đợt',
        description: 'Nhập lại cuối đợt — cùng rule kho với phiếu xuất gốc.',
        mode: 'nhap',
        loaiPhieu: 'Nhập lại từ máy cuối đợt',
        requiresSxMeta: true,
        requiresMay: true,
        nguonLoai: 'may'
      }
    ]
  },
  {
    id: 'nhap-phe',
    title: '7. Nhập phế từ sản xuất',
    summary: 'SX01 → Kho PC; SX06 → Kho NVL Chính. Chọn ngày, đợt, máy, loại SX.',
    steps: [
      {
        id: 'nhap-phe-sx',
        title: 'Nhập phế băm / đầu khuôn',
        description: 'Nhập SX01 về Kho PC, SX06 về Kho NVL Chính.',
        mode: 'nhap',
        loaiPhieu: 'Nhập phế của các máy sóng, rỗng, đặc, tạo hạt',
        requiresSxMeta: true,
        requiresMay: true,
        nguonLoai: 'may',
        lines: [
          { ma: 'SX01', kho: 'Kho PC' },
          { ma: 'SX06', kho: 'Kho NVL Chính' }
        ]
      }
    ]
  }
];

export function getNvlProcessRecipe(id: string) {
  return NVL_PROCESS_RECIPES.find(item => item.id === id) || null;
}

export function getNvlProcessStep(processId: string, stepId: string) {
  const recipe = getNvlProcessRecipe(processId);
  return recipe?.steps.find(item => item.id === stepId) || null;
}

export function listNvlProcessOptions() {
  return NVL_PROCESS_RECIPES.map(item => ({ id: item.id, label: item.title, summary: item.summary }));
}

/** Máy có thể chạy nhiều loại SX → bắt buộc chọn Loại sản xuất. */
export function machineNeedsLoaiSanXuat(machineLabel: string) {
  const folded = String(machineLabel || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  return folded.includes('song') || folded.includes('sts');
}
