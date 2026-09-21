# AGENTS.md — Hướng dẫn AI

## Đọc code theo bảng (tiết kiệm token)

Repo monolith: logic chính từng bước chuyển khỏi `App.tsx` sang `src/features/<bang>/`.

**Luôn bắt đầu tại:** [`docs/ai-tables/README.md`](docs/ai-tables/README.md)

Mỗi bảng Supabase có manifest ~20 dòng liệt kê:
- File SQL migration
- API route + dòng `server.ts`
- Feature / component (ưu tiên `src/features/`, không còn dòng App.tsx nếu đã tách)
- Utils liên quan

Registry TypeScript: `src/features/registry.ts`

### Tách feature + manifest → token thấp hơn nhiều

| Trước (monolith) | Sau (manifest + feature) |
|------------------|--------------------------|
| `App.tsx` ~18k dòng | manifest ~20 dòng + feature ~500–1.100 dòng |
| Quét cả `server.ts` | Chỉ `serverLines` trong manifest |

**AI:** đọc manifest → mở đúng feature/component → API theo dòng. Không mở `App.monolith.backup.tsx`.

## Cấu trúc thư mục

```
docs/ai-tables/           ← manifest theo bảng (AI đọc đầu tiên)
src/features/<bang>/      ← panel đã tách (ưu tiên sửa UI)
src/components/           ← UI dùng chung / list view / in phiếu
src/features/registry.ts
src/App.tsx               ← shell + routing (import feature)
server.ts                 ← API (đọc theo dòng manifest)
```

## Refactor dần (kế hoạch)

Panel lớn trong App.tsx chuyển sang `src/features/<bang>/` — **cập nhật manifest ngay khi tách xong** để AI không đọc dòng App cũ.

Đã tách ví dụ: `bao-cao-may-nvl-ton` → `src/features/bao-cao-may-nvl-ton/index.tsx`

## Cursor rules

- `ai-table-index.mdc` — luôn áp dụng
- `weighing-image-preview.mdc` — phiếu cân / ảnh

## Quy ước ngày giờ tiếng Việt (bắt buộc)

- Hiển thị cho người dùng cuối luôn kiểu Việt Nam: ngày `DD/MM/YYYY`, tháng `Tháng X`, thứ `Thứ 2` … `Chủ nhật`.
- **Không dùng** `input type="date" / type="month" / type="datetime-local"` native cho UI người dùng cuối — chúng hiển thị theo locale trình duyệt, không đảm bảo tiếng Việt.
  Thay bằng lịch popup / select tiếng Việt tự làm (tuần bắt đầu Thứ 2, tháng `Tháng X`). Tham khảo mẫu chuẩn
  trong `src/features/so-che-do-may/index.tsx`:
  `VnCalendarPicker` (lịch popup chọn ngày đầy đủ), `MonthYearPicker` (popup chỉ tháng + năm).
- Lưu trữ và truyền API chuẩn ISO `YYYY-MM-DD`; validate ngày hợp lệ (kể cả năm nhuận, dùng được tới năm 2999) trước khi lưu — xem `parseDateStr` / `formatDateVN` cùng file mẫu trên.
- `index.html` đã đặt `<html lang="vi">` — giữ nguyên.
