"""Phase 2 pipeline + CLI: layout -> heading detection -> section
segmentation, plus a real, human-readable surfacing of
unclassified_headings -- per the brief, a JSON field nobody opens isn't
a real feedback loop. Separate module from Phase 1's pipeline.py (which
stays untouched); this is additive, not a revision.
"""

from __future__ import annotations

from pathlib import Path

from .layout import load_pdf_layout
from .sections import SegmentationResult, detect_headings, segment_sections


def run(pdf_path: str) -> SegmentationResult:
    lines = load_pdf_layout(pdf_path)
    headings = detect_headings(lines)
    return segment_sections(lines, headings)


def render_report(pdf_path: str, result: SegmentationResult) -> str:
    """The actual thing a person reads after a run -- not the JSON blob.
    Per the brief: 'it just has to be something Mike will actually look
    at, not buried in a JSON blob nobody opens.'"""
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
    for s in result.sections:
        label = s.canonical_type or "(unclassified body / front matter)"
        heading = f' -- "{s.heading_text}"' if s.heading_text else ""
        lines_out.append(f"  - {label}{heading} ({len(s.lines)} lines, starts page {s.start_page})")

    lines_out.append("")
    if unclassified:
        lines_out.append(
            f"{len(unclassified)} heading(s) did NOT match any entry in SECTION_SYNONYMS "
            "-- review these; if a real pattern emerges, add it as one new list entry, "
            "no code restructuring needed:"
        )
        for u in unclassified:
            lines_out.append(f'  - p{u["page"]}: "{u["text"]}"')
    else:
        lines_out.append("Every detected heading classified to a canonical section. Nothing to review.")

    return "\n".join(lines_out) + "\n"


if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Phase 2: section segmentation (deterministic, no LLM).")
    parser.add_argument("pdf_path")
    parser.add_argument("-o", "--output", help="Write JSON to this path (also writes a .report.txt alongside it).")
    args = parser.parse_args()

    result = run(args.pdf_path)
    report = render_report(args.pdf_path, result)
    print(report)

    if args.output:
        Path(args.output).write_text(json.dumps(result.to_dict(), indent=2))
        report_path = Path(args.output).with_suffix("")
        report_path = report_path.with_name(report_path.name + ".report.txt")
        report_path.write_text(report)
        print(f"Wrote {args.output} and {report_path}")
