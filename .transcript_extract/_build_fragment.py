"""One-off helper to verify fragment line count."""
from pathlib import Path

fragment = Path(r"e:\chuyendoicongtyvietnhatipt\.transcript_extract\table_body_fragment.tsx")
if fragment.exists():
    lines = fragment.read_text(encoding="utf-8").splitlines()
    print(len(lines))
