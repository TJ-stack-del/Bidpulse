from __future__ import annotations

import argparse
import json
from pathlib import Path

from .errors import ExtractionError
from .pipeline import extract


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="bidpulse-rfp-extract",
        description="Deterministically extract administrative fields from an RFP PDF.",
    )
    parser.add_argument("input", type=Path, help="Input PDF")
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        help="Output JSON path. Defaults to stdout.",
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
        result = extract(
            args.input,
            ocr=args.ocr,
            ocr_language=args.ocr_language,
        )
    except ExtractionError as exc:
        raise SystemExit(f"Extraction failed: {exc}") from exc

    payload = json.dumps(result.to_dict(), indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
    else:
        print(payload, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

