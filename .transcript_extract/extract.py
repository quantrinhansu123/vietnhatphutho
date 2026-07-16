import json
import os
from pathlib import Path

path = Path(
    r"C:\Users\Admin\.cursor\projects\e-chuyendoicongtyvietnhatipt\agent-transcripts"
    r"\ae281956-a9fc-4cc1-a735-4112130509b9\ae281956-a9fc-4cc1-a735-4112130509b9.jsonl"
)
outdir = Path(r"e:\chuyendoicongtyvietnhatipt\.transcript_extract")
outdir.mkdir(parents=True, exist_ok=True)


def get_input(item):
    inp = item.get("input")
    return inp if isinstance(inp, dict) else {}


last_tabs = None
last_tabs_line = 0
table_sections = []
split_funcs = {}
all_table_edits = []
tong_cuoi_edits = []

with path.open(encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        content = obj.get("message", {}).get("content", [])
        if not isinstance(content, list):
            continue
        for item in content:
            if not isinstance(item, dict) or item.get("type") != "tool_use":
                continue
            name = item.get("name")
            inp = get_input(item)
            p = str(inp.get("path", ""))
            ns = str(inp.get("new_string", ""))
            os_ = str(inp.get("old_string", ""))

            if name == "StrReplace" and "ControlBoardShiftSummaryTable.tsx" in p:
                all_table_edits.append((i, os_, ns))
                if "SHIFT_SUMMARY_TABS" in ns and "lenh_sx" in ns:
                    last_tabs = ns
                    last_tabs_line = i
                if "activeTab ===" in ns and len(ns) > 200:
                    table_sections.append((i, ns))

            if name == "StrReplace" and "tongTrongLuongTonCuoiCa" in ns:
                tong_cuoi_edits.append((i, p, ns))

            for fn in [
                "splitDamagedGoodsDefectWeights",
                "splitWarehouseSanPhamNhapLine",
                "splitMachineNvlDauCaLineKg",
                "splitMachineNvlCuoiCaLineKg",
            ]:
                if name == "StrReplace" and fn in ns:
                    split_funcs[fn] = (i, p, ns)

(outdir / "SHIFT_SUMMARY_TABS.txt").write_text(
    f"From line {last_tabs_line}\n\n{last_tabs or 'NOT FOUND'}", encoding="utf-8"
)

sections_text = []
for i, ns in table_sections:
    sections_text.append(f"\n\n===== LINE {i} len={len(ns)} =====\n{ns}")
(outdir / "table_sections.txt").write_text("".join(sections_text), encoding="utf-8")

funcs_text = []
for fn, (i, p, ns) in sorted(split_funcs.items()):
    funcs_text.append(f"\n\n===== {fn} line {i} =====\nFILE: {p}\n\n{ns}")
(outdir / "split_funcs.txt").write_text("".join(funcs_text), encoding="utf-8")

tong_text = []
for i, p, ns in tong_cuoi_edits:
    tong_text.append(f"\n\n===== LINE {i} =====\nFILE: {p}\n\n{ns}")
(outdir / "tong_cuoi_edits.txt").write_text("".join(tong_text), encoding="utf-8")

edit_text = [f"Total table edits: {len(all_table_edits)}\n"]
for i, os_, ns in all_table_edits[-15:]:
    edit_text.append(f"\nLINE {i}\nOLD head: {os_[:150]}\nNEW head: {ns_[:150]}\n")
(outdir / "table_edit_tail.txt").write_text("".join(edit_text), encoding="utf-8")

print("tabs line", last_tabs_line)
print("table sections", len(table_sections))
print("split funcs", list(split_funcs))
print("tong cuoi edits", len(tong_cuoi_edits))
