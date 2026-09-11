from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal


FieldStatus = Literal["absent", "unknown", "resolved", "conflict"]
QualityStatus = Literal["ok", "review_required", "coverage_failure"]


@dataclass(frozen=True)
class Provenance:
    page_index: int
    printed_page_label: str
    block_ids: list[str]
    bbox: list[float]
    char_span: list[int] | None


@dataclass
class TextBlock:
    block_id: str
    page_index: int
    bbox: list[float]
    text: str
    normalized_text: str
    font_name: str | None = None
    font_size: float | None = None
    reading_order: int = 0
    is_header_footer: bool = False


@dataclass
class PageRecord:
    page_index: int
    printed_page_label: str
    width: float
    height: float
    extraction_mode: Literal["native", "ocr", "unreadable"]
    text_coverage_ratio: float
    word_count: int
    blocks: list[TextBlock] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class Candidate:
    candidate_id: str
    field: str
    value: Any
    normalized_value: str
    quote: str
    provenance: Provenance
    rule_id: str
    score: int
    source_role: Literal["body", "repeated_header_footer"]


@dataclass
class FieldResult:
    status: FieldStatus
    selected: Any | None
    candidates: list[Candidate] = field(default_factory=list)


@dataclass
class Quality:
    status: QualityStatus
    native_pages: int
    ocr_pages: int
    suspect_pages: list[int]
    unreadable_pages: list[int]
    coverage_warnings: list[str]


@dataclass
class ExtractionResult:
    document: dict[str, Any]
    quality: Quality
    pages: list[PageRecord]
    administrative_fields: dict[str, FieldResult]
    diagnostics: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# --- Phase 2 (section segmentation) -----------------------------------
# Additive to the Phase 1 models above; nothing above this line is
# touched or read by section segmentation.


@dataclass(frozen=True)
class LayoutLine:
    text: str
    page_index: int
    printed_page_label: str
    font_size: float
    is_bold: bool
    x0: float
    y0: float


@dataclass(frozen=True)
class Heading:
    text: str
    page_index: int
    printed_page_label: str
    font_size: float
    canonical_section: str | None
    matched_via: Literal["top_font_size", "numbering_pattern", "bold_at_margin"]
    matched_pattern: str | None = None


@dataclass
class Section:
    canonical_type: str | None  # None => unclassified front matter / body
    heading_text: str | None  # None for the unclassified fallback section
    start_page_index: int
    lines: list[str] = field(default_factory=list)


@dataclass
class SegmentationResult:
    headings: list[Heading]
    sections: list[Section]
    unclassified_headings: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "headings": [asdict(heading) for heading in self.headings],
            "sections": [
                {
                    "canonical_type": section.canonical_type,
                    "heading_text": section.heading_text,
                    "start_page_index": section.start_page_index,
                    "line_count": len(section.lines),
                    "preview": " ".join(section.lines)[:200],
                }
                for section in self.sections
            ],
            "unresolved": {"unclassified_headings": self.unclassified_headings},
        }
