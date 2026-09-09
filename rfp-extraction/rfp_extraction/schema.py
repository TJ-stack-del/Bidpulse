"""Output schema -- Phase 1 only emits the `document` and `admin_fields`
sections of the full design doc's §6 schema. The other sections
(compliance_matrix, evaluation_factors, clins, deliverables,
key_personnel, required_certifications, clause_references, sow_extract,
unresolved) are later phases and intentionally absent here, not stubbed
with empty placeholders -- an empty list would be indistinguishable from
"ran and found nothing," which isn't true; this phase never looked.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Provenance:
    page: int
    quote: str  # exact original text this match came from, never paraphrased
    matched_pattern: Optional[str] = None
    extraction_method: str = "regex"  # "regex" | "ocr_regex"
    confidence: str = "high"  # "high" | "medium" | "low"

    def to_dict(self) -> dict:
        return {
            "page": self.page,
            "quote": self.quote,
            "matched_pattern": self.matched_pattern,
            "extraction_method": self.extraction_method,
            "confidence": self.confidence,
        }


@dataclass
class AdminFieldResult:
    """A single admin field's result. Exactly one of two shapes, matching
    the design doc's own §6/§8 examples:
      - resolved:  {"value": ..., "provenance": {...}}
      - unresolved (conflicting matches): {"candidates": [...], "resolved": false}
    Never both, and never a `value` key present but null-with-no-explanation
    when the real reason is "multiple different matches, not zero
    matches" -- those are different facts and the schema should say which
    one happened.
    """

    value: Optional[str] = None
    provenance: Optional[Provenance] = None
    candidates: Optional[list[dict]] = None
    resolved: bool = True

    def to_dict(self) -> dict:
        if self.candidates is not None:
            return {"candidates": self.candidates, "resolved": self.resolved}
        return {
            "value": self.value,
            "provenance": self.provenance.to_dict() if self.provenance else None,
        }


@dataclass
class DocumentMeta:
    source_filename: str
    page_count: int
    extraction_method_summary: dict  # {"digital_pages": N, "ocr_pages": N}

    def to_dict(self) -> dict:
        return {
            "source_filename": self.source_filename,
            "page_count": self.page_count,
            "extraction_method_summary": self.extraction_method_summary,
        }


@dataclass
class ExtractionResult:
    document: DocumentMeta
    admin_fields: dict[str, AdminFieldResult] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "document": self.document.to_dict(),
            "admin_fields": {k: v.to_dict() for k, v in self.admin_fields.items()},
        }
