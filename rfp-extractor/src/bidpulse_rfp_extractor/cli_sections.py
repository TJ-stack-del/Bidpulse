from __future__ import annotations

import argparse
import json
from pathlib import Path

from .errors import ExtractionError
from .phase2_pipeline import render_report, run


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="bidpulse-rfp-sections",
        description="Deterministically segment an RFP PDF into canonical sections (Phase 2, no LLM).",
    )
    parser.add_argument("input", type=Path, help="Input PDF")
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        help="Write JSON to this path (also writes a .report.txt alongside it). Defaults to stdout.",
    )
    parser.add_argument(
        "--ocr",
        choices=("never", "auto"),
        default="never",
        help="Use local Tesseract through PyMuPDF for scanned pages.",
    )
    parser.add_argument("--ocr-language", default="eng")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        result, _diagnostics = run(
            str(args.input),
            ocr=args.ocr,
            ocr_language=args.ocr_language,
        )
    except ExtractionError as exc:
        raise SystemExit(f"Section segmentation failed: {exc}") from exc

    report = render_report(str(args.input), result)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(result.to_dict(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        report_path = args.output.with_suffix("")
        report_path = report_path.with_name(report_path.name + ".report.txt")
        report_path.write_text(report, encoding="utf-8")
        print(f"Wrote {args.output} and {report_path}")
    else:
        print(report, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
