from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tests"))

from bidpulse_rfp_extractor.phase2_pipeline import render_report, run  # noqa: E402
from fixture_factory import (  # noqa: E402
    build_multicolumn_pdf,
    build_section_pipeline_pdf,
    build_unmappable_heading_pdf,
)


def _write_result(pdf_path: Path, output_dir: Path, stem: str) -> None:
    result, diagnostics = run(str(pdf_path))
    output_dir.joinpath(f"{stem}-output.json").write_text(
        json.dumps(
            {"result": result.to_dict(), "diagnostics": diagnostics},
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    output_dir.joinpath(f"{stem}-output.report.txt").write_text(
        render_report(str(pdf_path), result),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=ROOT / "evidence" / "phase2")
    parser.add_argument(
        "--real-fixture",
        type=Path,
        default=ROOT.parent / "test-fixtures" / "RFP-2026-0847-JANI.pdf",
        help="A real (non-synthetic) solicitation PDF to run against, if available.",
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    synthetic = {
        "section-pipeline": build_section_pipeline_pdf(args.output_dir / "section-pipeline-fixture.pdf"),
        "multicolumn": build_multicolumn_pdf(args.output_dir / "multicolumn-fixture.pdf"),
        "unmappable-heading": build_unmappable_heading_pdf(
            args.output_dir / "unmappable-heading-fixture.pdf"
        ),
    }
    for stem, pdf_path in synthetic.items():
        _write_result(pdf_path, args.output_dir, stem)
        print(args.output_dir / f"{stem}-output.json")

    if args.real_fixture.is_file():
        # Run directly against the real fixture in place -- it's already
        # tracked at test-fixtures/RFP-2026-0847-JANI.pdf; no need to
        # duplicate a real, non-synthetic PDF into evidence/ as well.
        _write_result(args.real_fixture, args.output_dir, "jani")
        print(args.output_dir / "jani-output.json")
    else:
        print(f"Real fixture not found at {args.real_fixture}; skipped.", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
