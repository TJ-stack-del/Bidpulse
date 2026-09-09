"""Stage 2 (layout & structure extraction) -- new for Phase 2. Phase 1's
ingest.py only ever needed plain per-page text for admin-field regex, so
it never captured font size/boldness/position -- exactly what heading
detection needs. Kept as a separate module rather than extending
ingest.py's Page/load_pdf, per the brief's explicit "no change to Phase
1's existing code" scope line; this is new capability, not a revision of
Phase 1's.
"""

from __future__ import annotations

from dataclasses import dataclass

import fitz  # PyMuPDF

# PyMuPDF span flag bit for bold (see PyMuPDF docs on TextPage flags:
# bit 0 superscript, 1 italic, 2 serifed, 3 monospaced, 4 bold).
_BOLD_FLAG_BIT = 1 << 4


@dataclass
class Line:
    text: str
    page_num: int
    font_size: float
    is_bold: bool
    x0: float
    y0: float
    is_all_caps: bool


def _line_from_span_line(line_dict: dict, page_num: int) -> Line | None:
    spans = line_dict.get("spans", [])
    if not spans:
        return None
    text = "".join(s["text"] for s in spans).strip()
    if not text:
        return None
    # Headings are near-universally rendered in one consistent style
    # across their whole line -- using the first span's metrics is a
    # reasonable simplification rather than tracking per-character style.
    first = spans[0]
    is_bold = bool(int(first.get("flags", 0)) & _BOLD_FLAG_BIT) or "bold" in first.get("font", "").lower()
    x0, y0 = line_dict["bbox"][0], line_dict["bbox"][1]
    return Line(
        text=text,
        page_num=page_num,
        font_size=round(float(first["size"]), 1),
        is_bold=is_bold,
        x0=x0,
        y0=y0,
        is_all_caps=text.isupper() and any(c.isalpha() for c in text),
    )


# A page is treated as candidate multi-column layout when its lines'
# x0 positions cluster into two well-separated groups with a real gap
# between them (not just ordinary paragraph/list indentation, which is
# usually a much smaller offset). Both numbers are page-width-relative
# heuristics per design doc §8's "multi-column" row, not hard pixel
# constants, so they still make sense across different page sizes.
_MIN_COLUMN_GAP_FRACTION = 0.12
_MIN_LINES_PER_COLUMN = 3


def _reorder_if_multicolumn(lines: list[Line], page_width: float) -> list[Line]:
    """Detects a two-column page by finding the largest gap between
    consecutive distinct x0 values, and if found, reorders that page's
    lines column-by-column (left column top-to-bottom, then right column
    top-to-bottom) instead of raw top-to-bottom document order, which
    would otherwise interleave and scramble the two columns' reading
    order. Single-column pages (the overwhelming common case) are
    returned completely unchanged, in their original order.

    Real bug found via a deliberately constructed row-interleaved
    two-column fixture (see evidence/phase2/NOTES.md): an earlier
    version picked the split point as `sorted(x0 values)[len/2]` --
    for an evenly split page (4 lines per column here), that index
    lands exactly ON the right column's own x0, and `<=` on that value
    put every line, both columns, into "left", leaving "right" empty
    and silently no-op'ing every single time rather than reordering
    anything. Fixed by finding the actual largest gap between
    consecutive distinct x0 values instead of an arbitrary index.
    """
    if len(lines) < _MIN_LINES_PER_COLUMN * 2:
        return lines

    distinct_xs = sorted({l.x0 for l in lines})
    if len(distinct_xs) < 2:
        return lines

    best_gap = 0.0
    split_after = None
    for a, b in zip(distinct_xs, distinct_xs[1:]):
        gap = b - a
        if gap > best_gap:
            best_gap, split_after = gap, a

    if split_after is None or best_gap < page_width * _MIN_COLUMN_GAP_FRACTION:
        return lines  # no gap wide enough to be a real column boundary

    left = [l for l in lines if l.x0 <= split_after]
    right = [l for l in lines if l.x0 > split_after]

    if len(left) < _MIN_LINES_PER_COLUMN or len(right) < _MIN_LINES_PER_COLUMN:
        return lines  # not a real second column, just normal variance

    left.sort(key=lambda l: l.y0)
    right.sort(key=lambda l: l.y0)
    return left + right


def load_pdf_layout(path: str) -> list[Line]:
    """Returns a flat list of Lines across the whole document, each with
    the layout metadata heading detection needs. Multi-column pages are
    reordered per-page before being appended, so the returned list is
    always in correct reading order document-wide."""
    doc = fitz.open(path)
    all_lines: list[Line] = []
    try:
        for page_num, page in enumerate(doc, start=1):
            blocks = page.get_text("dict")["blocks"]
            page_lines: list[Line] = []
            for block in blocks:
                if block.get("type") != 0:  # 0 = text block; skip images
                    continue
                for line_dict in block.get("lines", []):
                    line = _line_from_span_line(line_dict, page_num)
                    if line:
                        page_lines.append(line)
            all_lines.extend(_reorder_if_multicolumn(page_lines, page.rect.width))
    finally:
        doc.close()
    return all_lines
