from __future__ import annotations

import base64
from pathlib import Path

import pymupdf


ONE_PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
    "+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def _add_chrome(page: pymupdf.Page, page_number: int, page_count: int) -> None:
    page.insert_text((72, 28), "Solicitation Number: FALSE-HEADER-999", fontsize=8)
    page.insert_text((270, 770), f"Page {page_number} of {page_count}", fontsize=8)


def build_phase1_pdf(path: Path) -> Path:
    document = pymupdf.open()
    page_count = 3

    first = document.new_page(width=612, height=792)
    _add_chrome(first, 1, page_count)
    first.insert_text((72, 100), "REQUEST FOR PROPOSALS", fontsize=16)
    first.insert_text((72, 150), "Solicitation Number: BP-2026-0042", fontsize=11)
    first.insert_text((72, 190), "NAICS Code: 561720", fontsize=11)
    first.insert_text((72, 230), "This procurement is a total small business set-aside.", fontsize=11)
    first.insert_text((72, 270), "Contract Type: Firm-Fixed-Price", fontsize=11)

    second = document.new_page(width=612, height=792)
    _add_chrome(second, 2, page_count)
    second.insert_text((72, 100), "SECTION L - INSTRUCTIONS TO OFFERORS", fontsize=14)
    second.insert_text(
        (72, 160),
        "Questions are due September 18, 2026 at 5:00 PM ET.",
        fontsize=11,
    )
    second.insert_text(
        (72, 220),
        "Proposals must be received by October 15, 2026 at 2:00 PM ET.",
        fontsize=11,
    )
    second.insert_text(
        (72, 280),
        "The Technical Volume shall not exceed 25 pages.",
        fontsize=11,
    )
    second.insert_text(
        (72, 340),
        "Submit the response via email to bids@example.test.",
        fontsize=11,
    )
    second.insert_text(
        (72, 400),
        "Upload one copy through the OpenGov portal.",
        fontsize=11,
    )

    third = document.new_page(width=612, height=792)
    _add_chrome(third, 3, page_count)
    third.insert_text((72, 100), "AMENDMENT 0001", fontsize=14)
    third.insert_text(
        (72, 160),
        "The proposal deadline is October 16, 2026 at 2:00 PM ET.",
        fontsize=11,
    )
    third.insert_text(
        (72, 220),
        "The original deadline remains printed in the base solicitation.",
        fontsize=11,
    )

    document.save(path)
    document.close()
    return path


def build_image_only_pdf(path: Path) -> Path:
    document = pymupdf.open()
    page = document.new_page(width=612, height=792)
    page.insert_image(page.rect, stream=ONE_PIXEL_PNG)
    document.save(path)
    document.close()
    return path


def build_repeated_equivalent_deadline_pdf(path: Path) -> Path:
    document = pymupdf.open()
    first = document.new_page(width=612, height=792)
    first.insert_text(
        (72, 100),
        "Proposals are due October 15, 2026 at 2:00 PM ET.",
        fontsize=11,
    )
    second = document.new_page(width=612, height=792)
    second.insert_text(
        (72, 100),
        "Proposal deadline: 10/15/2026, 2:00 p.m. EDT.",
        fontsize=11,
    )
    document.save(path)
    document.close()
    return path


def build_text_pdf(path: Path, lines: list[str]) -> Path:
    document = pymupdf.open()
    page = document.new_page(width=612, height=792)
    for index, line in enumerate(lines):
        page.insert_text((72, 80 + index * 40), line, fontsize=11)
    document.save(path)
    document.close()
    return path


def build_same_block_deadlines_pdf(path: Path) -> Path:
    document = pymupdf.open()
    page = document.new_page(width=612, height=792)
    page.insert_textbox(
        pymupdf.Rect(72, 80, 540, 180),
        (
            "Questions are due September 18, 2026 at 5:00 PM ET. "
            "Proposals are due October 15, 2026 at 2:00 PM ET."
        ),
        fontsize=11,
    )
    document.save(path)
    document.close()
    return path


def build_repeated_identifier_header_pdf(path: Path) -> Path:
    document = pymupdf.open()
    for page_number in range(2):
        page = document.new_page(width=612, height=792)
        page.insert_text((72, 28), "Solicitation Number: HEADER-2026-17", fontsize=8)
        page.insert_text(
            (72, 120),
            f"General solicitation content for page {page_number + 1}.",
            fontsize=11,
        )
    document.save(path)
    document.close()
    return path


def build_adjacent_label_value_pdf(path: Path) -> Path:
    document = pymupdf.open()
    page = document.new_page(width=612, height=792)
    page.insert_text((72, 100), "Solicitation Number:", fontsize=11)
    page.insert_text((72, 125), "ADJ-2026-004", fontsize=11)
    page.insert_text((72, 180), "NAICS Code:", fontsize=11)
    page.insert_text((72, 205), "541512", fontsize=11)
    document.save(path)
    document.close()
    return path


def build_side_by_side_label_value_pdf(path: Path) -> Path:
    document = pymupdf.open()
    page = document.new_page(width=612, height=792)
    page.insert_text((72, 100), "Solicitation Number:", fontsize=11)
    page.insert_text((240, 100), "SIDE-2026-9", fontsize=11)
    document.save(path)
    document.close()
    return path


def build_scanned_text_pdf(path: Path) -> Path:
    source = pymupdf.open()
    source_page = source.new_page(width=612, height=792)
    source_page.insert_text((60, 100), "REQUEST FOR PROPOSALS", fontsize=22)
    source_page.insert_text(
        (60, 160),
        "Solicitation Number: OCR-2026-88",
        fontsize=22,
    )
    source_page.insert_text(
        (60, 220),
        "This scanned solicitation contains enough text",
        fontsize=18,
    )
    source_page.insert_text((60, 260), "for OCR validation.", fontsize=18)
    pixmap = source_page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
    image = pixmap.tobytes("png")
    source.close()

    scanned = pymupdf.open()
    scanned_page = scanned.new_page(width=612, height=792)
    scanned_page.insert_image(scanned_page.rect, stream=image)
    scanned.save(path)
    scanned.close()
    return path


def build_multicolumn_pdf(path: Path) -> Path:
    """Two four-line columns at the same four y-rows, a wide gap apart
    (72 vs 320 on a 612-wide page -- well past the 12%-of-page-width
    threshold `_reorder_if_multicolumn` requires). PyMuPDF's own
    row-sorted text order interleaves the two columns row-by-row
    (L1, R1, L2, R2, ...) even with `sort=True`, since that only orders
    top-to-bottom-then-left-to-right across the *whole* page, not per
    column -- exactly the raw order `extract_layout_lines` has to
    detect and regroup into column-major order (L1..L4, R1..R4)."""
    document = pymupdf.open()
    page = document.new_page(width=612, height=792)
    left_lines = ["Left column line one", "Left column line two", "Left column line three", "Left column line four"]
    right_lines = ["Right column line one", "Right column line two", "Right column line three", "Right column line four"]
    for index, (left, right) in enumerate(zip(left_lines, right_lines)):
        y = 100 + index * 30
        page.insert_text((72, y), left, fontsize=11)
        page.insert_text((320, y), right, fontsize=11)
    document.save(path)
    document.close()
    return path


def build_unmappable_heading_pdf(path: Path) -> Path:
    """A short document with only two distinct font sizes (14pt bold
    heading, 10pt plain body) -- against a naive "top 2 font sizes"
    heading rule, the 10pt body lines share a size with the real
    heading and would all be misdetected as headings too. Requiring
    boldness for anything but the single largest size (the fix this
    fixture proves) correctly leaves only the real heading detected.
    "Special Provisions" is deliberately not in rules/section_synonyms.json,
    so it also proves the unclassified_headings path."""
    document = pymupdf.open()
    page = document.new_page(width=612, height=792)
    page.insert_text((72, 100), "Special Provisions", fontsize=14)
    page.insert_text((72, 140), "This clause covers site-specific safety requirements.", fontsize=10)
    page.insert_text((72, 165), "Contractors must complete orientation before starting work.", fontsize=10)
    page.insert_text((72, 190), "No hot work is permitted without a daily permit.", fontsize=10)
    document.save(path)
    document.close()
    return path


def build_section_pipeline_pdf(path: Path) -> Path:
    """Exercises all three real bugs Phase 2 was fixture-built to catch,
    in one document:

    - A single-instance 16pt title, the single biggest font on the
      page -- must NOT swallow the rest of the document into one
      section (the naive "bigger font = higher level" bug).
    - Two numbered, bold, 12.5pt headings ("1. Scope of Work",
      "2. Evaluation Criteria") at the document's dominant left margin
      (x=72) -- equal-level headings that must each close the previous
      section and open their own.
    - A bold, short, 10pt "Issuing Agency" line indented well past the
      dominant margin (x=300), simulating a table label cell -- must
      NOT be detected as a heading despite being bold and short.
    """
    document = pymupdf.open()
    page = document.new_page(width=612, height=792)
    page.insert_text((72, 80), "City of Example, Procurement Division", fontsize=16)
    page.insert_text((72, 120), "Request for Proposals", fontsize=10)
    page.insert_text((72, 160), "1. Scope of Work", fontsize=12.5)
    page.insert_text((72, 190), "The contractor shall provide janitorial services.", fontsize=10)
    page.insert_text((300, 220), "Issuing Agency", fontsize=10)
    page.insert_text((72, 260), "2. Evaluation Criteria", fontsize=12.5)
    page.insert_text((72, 290), "Proposals are scored on price and past performance.", fontsize=10)
    document.save(path)
    document.close()
    return path


def build_encrypted_pdf(path: Path) -> Path:
    document = pymupdf.open()
    page = document.new_page()
    page.insert_text((72, 100), "Protected solicitation", fontsize=11)
    document.save(
        path,
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        owner_pw="owner-password",
        user_pw="user-password",
    )
    document.close()
    return path
