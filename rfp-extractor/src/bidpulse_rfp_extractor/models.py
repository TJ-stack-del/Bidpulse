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
