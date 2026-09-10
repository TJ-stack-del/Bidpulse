from __future__ import annotations

import hashlib
import math
import platform
import re
import shutil
import subprocess
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import pymupdf

from .errors import EncryptedPdfError, InvalidPdfError, ResourceLimitError
from .models import PageRecord, Quality, TextBlock
from .text import normalize_for_match, normalize_repeated_line, normalize_text


OcrMode = Literal["never", "auto"]


@dataclass(frozen=True)
class ProcessingLimits:
    max_file_bytes: int = 50 * 1024 * 1024
    max_pages: int = 500
    max_pdf_objects: int = 100_000
    max_page_area_points: float = 20_000 * 20_000
    max_images_per_page: int = 500
    max_image_rects_per_page: int = 1_000
    max_text_blocks_per_page: int = 20_000
    max_total_text_blocks: int = 100_000
    max_text_spans_per_page: int = 100_000
    max_total_text_characters: int = 10_000_000
    max_ocr_pages: int = 100
    max_ocr_pixels_per_page: int = 30_000_000
    max_processing_seconds: float = 120.0
    max_memory_bytes: int = 1_500_000_000


def _file_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _image_coverage(page: pymupdf.Page, limits: ProcessingLimits) -> float:
    page_area = max(float(page.rect.width * page.rect.height), 1.0)
    covered = 0.0
    seen: set[tuple[float, float, float, float]] = set()
    images = page.get_images(full=True)
    if len(images) > limits.max_images_per_page:
        raise ResourceLimitError(
            f"Page {page.number + 1} contains too many images ({len(images)})"
        )
    rect_count = 0
    for image in images:
        xref = image[0]
        for rect in page.get_image_rects(xref):
            rect_count += 1
            if rect_count > limits.max_image_rects_per_page:
                raise ResourceLimitError(
                    f"Page {page.number + 1} contains too many image placements"
                )
            key = tuple(round(float(value), 2) for value in rect)
            if key in seen:
                continue
            seen.add(key)
            covered += max(float(rect.width * rect.height), 0.0)
    return min(covered / page_area, 1.0)


def _extract_blocks(
    page: pymupdf.Page,
    page_index: int,
    limits: ProcessingLimits,
    textpage: pymupdf.TextPage | None = None,
) -> tuple[list[TextBlock], int, float]:
    payload = page.get_text("dict", textpage=textpage, sort=True)
    blocks: list[TextBlock] = []
    word_count = 0
    text_area = 0.0
    span_count = 0
    character_count = 0
    page_area = max(float(page.rect.width * page.rect.height), 1.0)

    for raw_block in payload.get("blocks", []):
        if raw_block.get("type") != 0:
            continue

        lines: list[str] = []
        spans: list[dict[str, Any]] = []
        for raw_line in raw_block.get("lines", []):
            line_spans = raw_line.get("spans", [])
            span_count += len(line_spans)
            if span_count > limits.max_text_spans_per_page:
                raise ResourceLimitError(
                    f"Page {page_index + 1} exceeds the text span limit"
                )
            spans.extend(line_spans)
            line_text = "".join(str(span.get("text", "")) for span in line_spans)
            if normalize_text(line_text):
                lines.append(line_text)

        text = "\n".join(lines).strip()
        if not text:
            continue
        character_count += len(text)
        if character_count > limits.max_total_text_characters:
            raise ResourceLimitError(
                f"Page {page_index + 1} exceeds the document text limit"
            )
        if len(blocks) >= limits.max_text_blocks_per_page:
            raise ResourceLimitError(
                f"Page {page_index + 1} exceeds the text block limit"
            )

        bbox = [round(float(value), 3) for value in raw_block["bbox"]]
        text_area += max((bbox[2] - bbox[0]) * (bbox[3] - bbox[1]), 0.0)
        word_count += len(text.split())
        largest_span = max(spans, key=lambda span: float(span.get("size", 0.0)), default={})
        block_id = f"p{page_index:04d}-b{len(blocks):04d}"
        blocks.append(
            TextBlock(
                block_id=block_id,
                page_index=page_index,
                bbox=bbox,
                text=text,
                normalized_text=normalize_for_match(text),
                font_name=largest_span.get("font"),
                font_size=(
                    round(float(largest_span["size"]), 3)
                    if largest_span.get("size") is not None
                    else None
                ),
                reading_order=len(blocks),
            )
        )

    return blocks, word_count, round(min(text_area / page_area, 1.0), 6)


def _looks_suspect(blocks: list[TextBlock], word_count: int) -> bool:
    if word_count == 0:
        return False
    text = " ".join(block.text for block in blocks)
    if not text:
        return False
    replacement_ratio = text.count("\ufffd") / max(len(text), 1)
    printable = sum(character.isprintable() for character in text)
    printable_ratio = printable / max(len(text), 1)
    return replacement_ratio > 0.01 or printable_ratio < 0.9


def _mark_repeated_headers_and_footers(pages: list[PageRecord]) -> int:
    if len(pages) < 2:
        return 0

    candidates: Counter[str] = Counter()
    occurrences: dict[str, list[TextBlock]] = {}
    for page in pages:
        seen_on_page: set[str] = set()
        top = page.height * 0.12
        bottom = page.height * 0.88
        for block in page.blocks:
            if block.bbox[3] > top and block.bbox[1] < bottom:
                continue
            key = normalize_repeated_line(block.text)
            if len(key) < 3:
                continue
            occurrences.setdefault(key, []).append(block)
            if key not in seen_on_page:
                candidates[key] += 1
                seen_on_page.add(key)

    threshold = max(2, math.ceil(len(pages) * 0.6))
    marked = 0
    for key, page_count in candidates.items():
        if page_count < threshold:
            continue
        for block in occurrences[key]:
            if not block.is_header_footer:
                block.is_header_footer = True
                marked += 1
    return marked


def ingest_pdf(
    input_path: str | Path,
    *,
    ocr_mode: OcrMode = "never",
    ocr_language: str = "eng",
    limits: ProcessingLimits | None = None,
) -> tuple[dict[str, Any], list[PageRecord], Quality, dict[str, Any]]:
    limits = limits or ProcessingLimits()
    path = Path(input_path)
    if not path.is_file():
        raise InvalidPdfError(f"PDF does not exist: {path}")
    file_size = path.stat().st_size
    if file_size > limits.max_file_bytes:
        raise ResourceLimitError(
            f"PDF is {file_size} bytes; limit is {limits.max_file_bytes}"
        )
    pdf_bytes = path.read_bytes()
    if len(pdf_bytes) > limits.max_file_bytes:
        raise ResourceLimitError(
            f"PDF is {len(pdf_bytes)} bytes; limit is {limits.max_file_bytes}"
        )
    if not re.search(rb"%PDF-\d\.\d", pdf_bytes[:1024]):
        raise InvalidPdfError("Input does not contain a PDF header in its first 1024 bytes")

    try:
        document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise InvalidPdfError(f"Unable to open PDF: {exc}") from exc

    try:
        if document.needs_pass:
            raise EncryptedPdfError("Password-protected PDFs are not supported")
        if document.page_count == 0:
            raise InvalidPdfError("PDF contains no pages")
        if document.page_count > limits.max_pages:
            raise ResourceLimitError(
                f"PDF has {document.page_count} pages; limit is {limits.max_pages}"
            )
        object_count = document.xref_length()
        if object_count > limits.max_pdf_objects:
            raise ResourceLimitError(
                f"PDF has {object_count} objects; limit is {limits.max_pdf_objects}"
            )

        pages: list[PageRecord] = []
        suspect_pages: list[int] = []
        unreadable_pages: list[int] = []
        ocr_attempt_count = 0
        total_text_characters = 0
        total_text_blocks = 0
        started_at = time.monotonic()

        for page_index, page in enumerate(document):
            if time.monotonic() - started_at > limits.max_processing_seconds:
                raise ResourceLimitError("PDF processing time limit exceeded")
            page_area = float(page.rect.width * page.rect.height)
            if page_area > limits.max_page_area_points:
                raise ResourceLimitError(
                    f"Page {page_index + 1} dimensions exceed the configured limit"
                )
            warnings: list[str] = []
            blocks, word_count, coverage = _extract_blocks(
                page,
                page_index,
                limits,
            )
            image_coverage = _image_coverage(page, limits)
            suspect = _looks_suspect(blocks, word_count)
            alphanumeric_count = sum(
                character.isalnum()
                for block in blocks
                for character in block.text
            )
            needs_ocr = alphanumeric_count == 0 or suspect
            mode: Literal["native", "ocr", "unreadable"] = "native"

            if suspect:
                warnings.append("suspect_native_text")
                suspect_pages.append(page_index)
                needs_ocr = True

            if needs_ocr:
                warnings.append(
                    "image_dominant_page" if image_coverage >= 0.35 else "low_text_page"
                )
                if ocr_mode == "auto":
                    ocr_attempt_count += 1
                    if ocr_attempt_count > limits.max_ocr_pages:
                        raise ResourceLimitError(
                            f"OCR page limit exceeded ({limits.max_ocr_pages})"
                        )
                    estimated_pixels = int(
                        page_area * ((300.0 / 72.0) ** 2)
                    )
                    if estimated_pixels > limits.max_ocr_pixels_per_page:
                        raise ResourceLimitError(
                            f"Page {page_index + 1} exceeds the OCR pixel limit"
                        )
                    try:
                        textpage = page.get_textpage_ocr(
                            language=ocr_language,
                            dpi=300,
                            full=True,
                        )
                        ocr_blocks, ocr_word_count, ocr_coverage = _extract_blocks(
                            page,
                            page_index,
                            limits,
                            textpage=textpage,
                        )
                        if ocr_word_count >= 5:
                            blocks = ocr_blocks
                            word_count = ocr_word_count
                            coverage = ocr_coverage
                            mode = "ocr"
                            warnings.append("ocr_used")
                        else:
                            mode = "unreadable"
                            warnings.append("ocr_returned_insufficient_text")
                    except Exception as exc:
                        mode = "unreadable"
                        warnings.append(f"ocr_failed:{type(exc).__name__}")
                else:
                    mode = "unreadable"
                    warnings.append("ocr_required")
            elif word_count < 5:
                warnings.append("low_text_page")

            if mode == "unreadable":
                unreadable_pages.append(page_index)
            else:
                total_text_blocks += len(blocks)
                if total_text_blocks > limits.max_total_text_blocks:
                    raise ResourceLimitError(
                        "PDF exceeds the total text block limit"
                    )
                total_text_characters += sum(len(block.text) for block in blocks)
                if total_text_characters > limits.max_total_text_characters:
                    raise ResourceLimitError(
                        "PDF exceeds the document text character limit"
                    )

            if time.monotonic() - started_at > limits.max_processing_seconds:
                raise ResourceLimitError("PDF processing time limit exceeded")

            try:
                printed_label = page.get_label() or str(page_index + 1)
            except Exception:
                printed_label = str(page_index + 1)

            pages.append(
                PageRecord(
                    page_index=page_index,
                    printed_page_label=printed_label,
                    width=round(float(page.rect.width), 3),
                    height=round(float(page.rect.height), 3),
                    extraction_mode=mode,
                    text_coverage_ratio=coverage,
                    word_count=word_count,
                    blocks=blocks,
                    warnings=warnings,
                )
            )

        repeated_count = _mark_repeated_headers_and_footers(pages)
        native_pages = sum(page.extraction_mode == "native" for page in pages)
        ocr_pages = sum(page.extraction_mode == "ocr" for page in pages)
        coverage_warnings: list[str] = []
        if unreadable_pages:
            coverage_warnings.append("one_or_more_pages_unreadable")
        if len(unreadable_pages) == len(pages):
            status = "coverage_failure"
            coverage_warnings.append("no_pages_with_usable_text")
        elif unreadable_pages or suspect_pages:
            status = "review_required"
        else:
            status = "ok"

        quality = Quality(
            status=status,
            native_pages=native_pages,
            ocr_pages=ocr_pages,
            suspect_pages=suspect_pages,
            unreadable_pages=unreadable_pages,
            coverage_warnings=coverage_warnings,
        )
        metadata = {
            "id": f"sha256:{_file_sha256(pdf_bytes)}",
            "filename": path.name,
            "byte_size": len(pdf_bytes),
            "page_count": document.page_count,
            "pdf_metadata": {
                key: value
                for key, value in document.metadata.items()
                if value not in (None, "")
            },
        }
        diagnostics = {
            "repeated_header_footer_blocks": repeated_count,
            "ocr_mode": ocr_mode,
            "ocr_language": ocr_language,
            "runtime_versions": _runtime_versions(ocr_mode),
            "processing_limits": {
                key: value for key, value in vars(limits).items()
            },
        }
        return metadata, pages, quality, diagnostics
    finally:
        document.close()


def _runtime_versions(ocr_mode: OcrMode) -> dict[str, str | None]:
    tesseract_version: str | None = None
    if ocr_mode == "auto" and shutil.which("tesseract"):
        try:
            completed = subprocess.run(
                ["tesseract", "--version"],
                check=False,
                capture_output=True,
                text=True,
                timeout=2,
            )
            first_line = completed.stdout.splitlines()
            if first_line:
                tesseract_version = first_line[0]
        except (OSError, subprocess.SubprocessError):
            tesseract_version = "unknown"
    return {
        "python": platform.python_version(),
        "pymupdf": pymupdf.__version__,
        "tesseract": tesseract_version,
    }
