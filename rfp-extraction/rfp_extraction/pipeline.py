"""Phase 1 pipeline: ingest -> admin field extraction -> ExtractionResult.
Deliberately does not touch section segmentation, obligation harvesting,
or table extraction -- those are later phases per the brief."""

from __future__ import annotations

from pathlib import Path

from .admin_fields import ADMIN_FIELD_PATTERNS, extract_admin_fields
from .ingest import load_pdf
from .schema import DocumentMeta, ExtractionResult


def run(pdf_path: str, patterns: dict[str, list[str]] | None = None) -> ExtractionResult:
    pages = load_pdf(pdf_path)
    admin_fields = extract_admin_fields(pages, patterns=patterns)

    digital_pages = sum(1 for p in pages if p.extraction_method == "digital")
    ocr_pages = sum(1 for p in pages if p.extraction_method == "ocr")

    document = DocumentMeta(
        source_filename=Path(pdf_path).name,
        page_count=len(pages),
        extraction_method_summary={"digital_pages": digital_pages, "ocr_pages": ocr_pages},
    )
    return ExtractionResult(document=document, admin_fields=admin_fields)


if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Phase 1 RFP admin-field extraction (deterministic, no LLM).")
    parser.add_argument("pdf_path", help="Path to the RFP PDF to extract from.")
    parser.add_argument("--as-given", action="store_true", help="Use the design doc's unmodified §5 patterns instead of the refined set.")
    parser.add_argument("-o", "--output", help="Write JSON to this path instead of stdout.")
    args = parser.parse_args()

    from .admin_fields import ADMIN_FIELD_PATTERNS_ASGIVEN

    result = run(args.pdf_path, patterns=ADMIN_FIELD_PATTERNS_ASGIVEN if args.as_given else ADMIN_FIELD_PATTERNS)
    output_json = json.dumps(result.to_dict(), indent=2)

    if args.output:
        Path(args.output).write_text(output_json)
        print(f"Wrote {args.output}")
    else:
        print(output_json)
