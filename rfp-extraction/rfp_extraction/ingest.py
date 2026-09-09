"""Stage 1 — Ingest. PDF -> per-page text, with an OCR fallback for pages
that come back empty/near-empty from digital extraction (scanned RFPs from
smaller municipal agencies are a real, not hypothetical, case per the
design doc). No layout/font metadata yet -- Phase 1 doesn't need heading
detection, only enough page-by-page text to run admin-field regex over
with correct page provenance.
"""

from __future__ import annotations

from dataclasses import dataclass

import fitz  # PyMuPDF
import pytesseract
from pdf2image import convert_from_path

# Below this many non-whitespace characters, a page is treated as
# "nothing digitally extracted" and handed to OCR instead. Not zero --
# a page with just a stray running header/footer can still land a few
# characters through PyMuPDF even with no real body text.
NEAR_EMPTY_CHAR_THRESHOLD = 20


@dataclass
class Page:
    page_num: int
    text: str
    extraction_method: str  # "digital" | "ocr"


def _ocr_page(pdf_path: str, page_num: int) -> str:
    images = convert_from_path(pdf_path, first_page=page_num, last_page=page_num, dpi=300)
    if not images:
        return ""
    return pytesseract.image_to_string(images[0])


def load_pdf(path: str) -> list[Page]:
    """Returns one Page per PDF page. Falls back to Tesseract OCR only for
    pages whose digital text extraction is near-empty -- every other page
    stays a plain, fast PyMuPDF text pull."""
    doc = fitz.open(path)
    pages: list[Page] = []
    try:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text")
            method = "digital"
            if len(text.strip()) < NEAR_EMPTY_CHAR_THRESHOLD:
                ocr_text = _ocr_page(path, page_num)
                if len(ocr_text.strip()) > len(text.strip()):
                    text = ocr_text
                    method = "ocr"
            pages.append(Page(page_num=page_num, text=text, extraction_method=method))
    finally:
        doc.close()
    return pages
