# AGENTS.md — Hướng dẫn AI

## Đọc code theo bảng (tiết kiệm token)

Repo monolith: logic chính nằm trong `App.tsx` và `server.ts`.

**Luôn bắt đầu tại:** [`docs/ai-tables/README.md`](docs/ai-tables/README.md)

Mỗi bảng Supabase có manifest ~20 dòng liệt kê:
- File SQL migration
- API route + dòng `server.ts`
- Component / dòng `App.tsx`
- Utils liên quan

Registry TypeScript: `src/features/registry.ts`

## Cấu trúc thư mục

```
docs/ai-tables/     ← manifest theo bảng (AI đọc đầu tiên)
src/components/     ← UI đã tách (ưu tiên đọc)
src/features/       ← registry.ts
src/App.tsx         ← shell + panel chưa tách (đọc theo dòng)
server.ts           ← API (đọc theo dòng)
```

## Refactor dần (kế hoạch)

Panel lớn trong App.tsx sẽ chuyển sang `src/features/<bang>/` — manifest sẽ cập nhật khi tách xong.

## Cursor rules

- `ai-table-index.mdc` — luôn áp dụng
- `weighing-image-preview.mdc` — phiếu cân / ảnh
