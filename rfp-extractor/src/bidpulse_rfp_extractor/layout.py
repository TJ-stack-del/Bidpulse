"""Phase 2, stage 1: per-line font/position metadata for heading
detection. Kept separate from ingest.py rather than extending
TextBlock -- Phase 1's ingest.py only ever needed block-level text for
admin-field regex (the largest span per block is enough for that), so
it never captured the per-LINE font size/boldness/position that heading
detection needs (a block can mix a heading line with body-text lines
below it). This module re-opens the PDF a second time rather than
threading line-level capture through ingest_pdf's block loop, so Phase
1's tested extraction path stays completely unmodified.

Only processes pages ingest_pdf already marked "native": an OCR'd or
unreadable page has no real font/position metadata to extract, and
heading detection against OCR'd text would be unreliable regardless.
"""

from __future__ import annotations

import time
from collections import Counter

import pymupdf

from .errors import InvalidPdfError, ResourceLimitError
from .ingest import ProcessingLimits
from .models import LayoutLine, PageRecord
from .text import normalize_text


# PyMuPDF span flag bit for bold (bit 0 superscript, 1 italic, 2 serifed,
# 3 monospaced, 4 bold -- see PyMuPDF's TextPage flag documentation).
_BOLD_FLAG_BIT = 1 << 4

# A page is treated as candidate multi-column layout when its lines' x0
# positions cluster into two well-separated groups with a real gap
# between them (not just ordinary paragraph/list indentation, which is
# usually a much smaller offset). Both numbers are page-width-relative
# heuristics, not hard pixel constants, so they still make sense across
# different page sizes.
_MIN_COLUMN_GAP_FRACTION = 0.12
_MIN_LINES_PER_COLUMN = 3


def _line_from_dict(line_dict: dict, page_index: int, printed_page_label: str) -> LayoutLine | None:
    spans = line_dict.get("spans", [])
    if not spans:
        return None
    text = normalize_text("".join(str(span.get("text", "")) for span in spans))
    if not text:
        return None
    # Headings are near-universally rendered in one consistent style
    # across their whole line -- using the first span's metrics is a
    # reasonable simplification rather than tracking per-character style.
    first = spans[0]
    is_bold = bool(int(first.get("flags", 0)) & _BOLD_FLAG_BIT) or "bold" in str(
        first.get("font", "")
    ).lower()
    x0, y0 = line_dict["bbox"][0], line_dict["bbox"][1]
    return LayoutLine(
        text=text,
        page_index=page_index,
        printed_page_label=printed_page_label,
        font_size=round(float(first.get("size", 0.0)), 1),
        is_bold=is_bold,
        x0=round(float(x0), 1),
        y0=round(float(y0), 1),
    )


def _reorder_if_multicolumn(lines: list[LayoutLine], page_width: float) -> list[LayoutLine]:
    """Detects a two-column page by finding the largest gap between
    consecutive distinct x0 values, and if found, reorders that page's
    lines column-by-column (left column top-to-bottom, then right
    column top-to-bottom) instead of raw top-to-bottom document order,
    which would otherwise interleave and scramble the two columns'
    reading order. Single-column pages (the overwhelming common case)
    are returned completely unchanged, in their original order.

    The split point is deliberately the actual largest gap between
    consecutive distinct x0 values, not a positional index like
    `sorted(x0 values)[len // 2]` -- on an evenly split page that index
    can land exactly on the right column's own x0, which (with a `<=`
    comparison) puts every line from both columns into "left" and
    silently no-ops every time instead of reordering anything.
    """
    if len(lines) < _MIN_LINES_PER_COLUMN * 2:
        return lines

    distinct_xs = sorted({line.x0 for line in lines})
    if len(distinct_xs) < 2:
        return lines

    best_gap = 0.0
    split_after: float | None = None
    for left_x, right_x in zip(distinct_xs, distinct_xs[1:]):
        gap = right_x - left_x
        if gap > best_gap:
            best_gap, split_after = gap, left_x

    if split_after is None or best_gap < page_width * _MIN_COLUMN_GAP_FRACTION:
        return lines  # no gap wide enough to be a real column boundary

    left = [line for line in lines if line.x0 <= split_after]
    right = [line for line in lines if line.x0 > split_after]

    if len(left) < _MIN_LINES_PER_COLUMN or len(right) < _MIN_LINES_PER_COLUMN:
        return lines  # not a real second column, just normal variance

    left.sort(key=lambda line: line.y0)
    right.sort(key=lambda line: line.y0)
    return left + right


def extract_layout_lines(
    input_path: str,
    pages: list[PageRecord],
    *,
    limits: ProcessingLimits | None = None,
) -> list[LayoutLine]:
    """Returns a flat, document-wide-reading-order list of LayoutLines
    for every page `pages` (ingest_pdf's own output) marked "native".
    `pages` is required rather than re-deriving native/OCR status here,
    so this module never has to duplicate ingest_pdf's OCR/quality
    logic -- it only re-opens the PDF for the one thing ingest_pdf
    doesn't capture (per-line font/position).
    """
    limits = limits or ProcessingLimits()
    native_page_indexes = {page.page_index for page in pages if page.extraction_mode == "native"}
    if not native_page_indexes:
        return []

    try:
        document = pymupdf.open(input_path)
    except Exception as exc:
        raise InvalidPdfError(f"Unable to open PDF: {exc}") from exc

    started_at = time.monotonic()
    all_lines: list[LayoutLine] = []
    try:
        for page_record in pages:
            if page_record.page_index not in native_page_indexes:
                continue
            if time.monotonic() - started_at > limits.max_processing_seconds:
                raise ResourceLimitError("Layout extraction time limit exceeded")
            page = document[page_record.page_index]
            payload = page.get_text("dict", sort=True)
            page_lines: list[LayoutLine] = []
            for block in payload.get("blocks", []):
                if block.get("type") != 0:  # 0 = text block; skip images
                    continue
                for line_dict in block.get("lines", []):
                    line = _line_from_dict(
                        line_dict,
                        page_record.page_index,
                        page_record.printed_page_label,
                    )
                    if line:
                        page_lines.append(line)
            all_lines.extend(_reorder_if_multicolumn(page_lines, page.rect.width))
    finally:
        document.close()

    return all_lines


__all__ = ["extract_layout_lines"]
