"""Phase 2 pipeline: layout -> heading detection -> section
segmentation, plus a human-readable report surfacing
`unclassified_headings` -- a JSON field nobody opens isn't a real
feedback loop for extending the synonym map. Separate module from
Phase 1's pipeline.py (untouched); this is additive, not a revision.

Runs in-process, unlike Phase 1's extract() (no worker-subprocess
resource isolation) -- a deliberate scope choice matching this being a
first port of the original Phase 2 work, not a hardening pass. Revisit
if this becomes a public-facing entry point the way Phase 1's is.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from .ingest import ProcessingLimits, ingest_pdf
from .layout import extract_layout_lines
from .models import SegmentationResult
from .sections import segment


def run(
    pdf_path: str,
    *,
    ocr: Literal["never", "auto"] = "never",
    ocr_language: str = "eng",
    limits: ProcessingLimits | None = None,
) -> tuple[SegmentationResult, dict[str, object]]:
    limits = limits or ProcessingLimits()
    document, pages, quality, ingest_diagnostics = ingest_pdf(
        pdf_path,
        ocr_mode=ocr,
        ocr_language=ocr_language,
        limits=limits,
    )
    lines = extract_layout_lines(pdf_path, pages, limits=limits)
    result, section_diagnostics = segment(lines)
    diagnostics = {
        "document": document,
        "quality": quality.__dict__,
        "ingest": ingest_diagnostics,
        "sections": section_diagnostics,
        "native_pages_used": len(
            {line.page_index for line in lines}
        ),
    }
    return result, diagnostics


def render_report(pdf_path: str, result: SegmentationResult) -> str:
    """The thing a person actually reads after a run -- not the JSON
    blob. Surfacing unclassified_headings only as JSON is the same as
    not surfacing them at all in practice."""
    total = len(result.headings)
    unclassified = result.unclassified_headings
    classified = total - len(unclassified)

    lines_out = [
        f"Section segmentation report -- {Path(pdf_path).name}",
        "=" * 60,
        f"{total} headings detected, {classified} classified, {len(unclassified)} unclassified.",
        "",
        f"Sections found ({len(result.sections)}):",
    ]
    for section in result.sections:
        label = section.canonical_type or "(unclassified body / front matter)"
        heading = f' -- "{section.heading_text}"' if section.heading_text else ""
        lines_out.append(
            f"  - {label}{heading} ({len(section.lines)} lines, "
            f"starts page index {section.start_page_index})"
        )

    lines_out.append("")
    if unclassified:
        lines_out.append(
            f"{len(unclassified)} heading(s) did NOT match any entry in "
            "rules/section_synonyms.json -- review these; if a real pattern "
            "emerges, add it as one new list entry, no code changes needed:"
        )
        for entry in unclassified:
            lines_out.append(f'  - page {entry["page_index"]}: "{entry["text"]}"')
    else:
        lines_out.append("Every detected heading classified to a canonical section. Nothing to review.")

    return "\n".join(lines_out) + "\n"


__all__ = ["render_report", "run"]
