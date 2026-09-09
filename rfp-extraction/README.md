# RFP Extraction Pipeline — Phase 1

Deterministic (non-LLM) extraction of administrative fields from RFP/
solicitation PDFs — due date, NAICS code, set-aside, contract type, page
limit, solicitation number. Every value is traceable to a regex, the
exact page it came from, and the exact quoted text it matched — no
generative model calls anywhere in this code.

Standalone: not wired into the BidPulse Next.js app. Does not modify
`route (2).ts`, `route (3).ts`, `route (4).ts`, or any existing route.
See `../rfp-extraction-pipeline-design.md` for the full multi-phase
design this is Phase 1 of, and `../BRIEF-rfp-extraction-phase1.md` for
this phase's exact scope.

**What this phase does NOT do yet** (later phases): section
segmentation, obligation-language harvesting for the Compliance Matrix,
table extraction (CLINs/evaluation factors/deliverables), or any
integration into BidPulse itself. Completing this phase does not yet
reduce anyone's review burden on its own — it only proves the ingest +
admin-field extraction mechanics work against real documents.

## Setup

```bash
cd rfp-extraction
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Tesseract itself (the OCR engine `pytesseract` calls out to) and
`poppler-utils` (needed by `pdf2image` to rasterize PDF pages) are
system packages, not Python packages:

```bash
sudo apt-get install -y tesseract-ocr poppler-utils
```

## Running it

```bash
python3 -m rfp_extraction.pipeline path/to/some-rfp.pdf
```

Prints the extraction result as JSON to stdout. Add `-o out.json` to
write to a file instead, or `--as-given` to run the design doc's
unmodified §5 patterns instead of the refined set actually used by
default (see `rfp_extraction/admin_fields.py`'s module docstring for
why the two differ, and `evidence/NOTES.md` for the full write-up).

## Layout

- `rfp_extraction/ingest.py` — Stage 1: PDF → per-page text, with a
  Tesseract OCR fallback for pages that come back empty/near-empty from
  digital extraction (a real, not hypothetical, case for scanned
  solicitations from smaller municipal agencies).
- `rfp_extraction/admin_fields.py` — Stage 6 (this phase's slice of it):
  the six admin-field regex patterns, both as-given from the design doc
  and the refined set actually used, plus the extraction + conflict-
  detection logic.
- `rfp_extraction/schema.py` — output dataclasses (`document` +
  `admin_fields` sections only — the rest of the full design's §6
  schema is later phases and intentionally not stubbed out here).
- `rfp_extraction/pipeline.py` — ties the above together; also the CLI
  entry point.
- `evidence/` — real run outputs and the written evidence notes (see
  below) required before trusting this further, per the brief's own
  "no self-certification" evidence standard.

## Evidence

See `evidence/NOTES.md` for the full write-up: real extracted JSON for
the actual `RFP-2026-0847-JANI` fixture (pulled from a real submission's
uploaded document in the BidPulse database, not invented for this
task), side-by-side against the source page text; a deliberately
field-free input confirmed to return `null` rather than a false match;
a genuinely image-only (no embedded text layer) page confirmed to
trigger the OCR fallback and come back flagged `low` confidence, not
blended in at equal weight with digital extraction; and a note on which
of the design doc's own §5 patterns fired correctly as given vs. needed
real adjustment, including one that silently produced a **wrong, high-
confidence answer** on the real fixture — the actual finding this
evidence-gathering step exists to catch before anything downstream
builds on top of it.
