import json
from pathlib import Path

path = Path(
    r"C:\Users\Admin\.cursor\projects\e-chuyendoicongtyvietnhatipt\agent-transcripts"
    r"\ae281956-a9fc-4cc1-a735-4112130509b9\ae281956-a9fc-4cc1-a735-4112130509b9.jsonl"
)
outdir = Path(r"e:\chuyendoicongtyvietnhatipt\.transcript_extract")
outdir.mkdir(exist_ok=True)


def iter_str_replaces(target_substr=None, max_line=99999):
    with path.open(encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            if i > max_line:
                break
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            for item in obj.get("message", {}).get("content", []):
                if not isinstance(item, dict) or item.get("name") != "StrReplace":
                    continue
                inp = item.get("input", {})
                if not isinstance(inp, dict):
                    continue
                p = inp.get("path", "")
                if target_substr and target_substr not in p:
                    continue
                yield i, p, inp.get("old_string", ""), inp.get("new_string", "")


tabs = [
    "lenh_sx",
    "phieu_xuat_kho",
    "ton_dau_ca",
    "ton_cuoi_ca",
    "phieu_nhap_kho",
    "bao_cao_loi_hong",
    "san_luong",
    "tong_vat_tu_thuc_dung",
]
desktop = {}
mobile_full = None
mobile_line = 0
shift_tabs_pre503 = None
shift_tabs_pre503_line = 0
shift_tabs_post503 = None

for i, p, old, new in iter_str_replaces("ControlBoardShiftSummaryTable.tsx"):
    if i < 503 and "SHIFT_SUMMARY_TABS" in new and "lenh_sx" in new:
        shift_tabs_pre503 = new
        shift_tabs_pre503_line = i
    if i >= 503 and "SHIFT_SUMMARY_TABS" in new:
        shift_tabs_post503 = new
    for tab in tabs:
        needle = "activeTab === '" + tab + "'"
        if needle in new and "<table" in new:
            prev = desktop.get(tab)
            if prev is None or len(new) > len(prev[1]):
                desktop[tab] = (i, new)
    if "md:hidden" in new and "filteredRows.map" in new and "activeTab" in new:
        if mobile_full is None or len(new) > len(mobile_full):
            mobile_full = new
            mobile_line = i

(outdir / "SHIFT_SUMMARY_TABS_pre503.txt").write_text(
    "LINE " + str(shift_tabs_pre503_line) + "\n\n" + (shift_tabs_pre503 or "NONE"),
    encoding="utf-8",
)
(outdir / "SHIFT_SUMMARY_TABS_post503.txt").write_text(
    "LINE 503+\n\n" + (shift_tabs_post503 or "NONE"),
    encoding="utf-8",
)

for tab, (i, ns) in sorted(desktop.items()):
    (outdir / ("desktop_" + tab + ".txt")).write_text("LINE " + str(i) + "\n\n" + ns, encoding="utf-8")
    print("desktop", tab, i, len(ns))

(outdir / "mobile_cards.txt").write_text(
    "LINE " + str(mobile_line) + "\n\n" + (mobile_full or "NONE"),
    encoding="utf-8",
)
print("mobile", mobile_line, len(mobile_full or ""))

for fname in [
    "splitMachineNvlDauCaLineKg",
    "splitMachineNvlCuoiCaLineKg",
    "splitWarehouseSanPhamNhapLine",
]:
    best = None
    for i, p, old, new in iter_str_replaces("controlBoardShiftSummary.ts", max_line=502):
        sig1 = "export function " + fname
        sig2 = "function " + fname
        if sig1 in new or sig2 in new:
            if best is None or len(new) > len(best[1]):
                best = (i, new)
    if best:
        (outdir / (fname + ".txt")).write_text("LINE " + str(best[0]) + "\n\n" + best[1], encoding="utf-8")
        print("func", fname, best[0], len(best[1]))

for i, p, old, new in iter_str_replaces("weighingRecords.ts", max_line=502):
    if "export function splitDamagedGoodsDefectWeights" in new:
        (outdir / "splitDamagedGoodsDefectWeights.txt").write_text("LINE " + str(i) + "\n\n" + new, encoding="utf-8")
        print("splitDamagedGoodsDefectWeights", i, len(new))
        break

# warehouse import bucket logic
for i, p, old, new in iter_str_replaces("controlBoardShiftSummary.ts", max_line=502):
    if "splitWarehouseSanPhamNhapLine" in new and "bucket." in new:
        (outdir / "warehouse_import_bucket.txt").write_text("LINE " + str(i) + "\n\n" + new, encoding="utf-8")
        print("warehouse bucket", i, len(new))
