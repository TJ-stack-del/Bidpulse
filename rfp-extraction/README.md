# RFP Extraction Pipeline — Phase 1 + Phase 2

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

Phase 2 adds section segmentation: mapping detected headings to a
canonical taxonomy (the Uniform Contract Format's A–M structure, or the
closest local-agency equivalent) via a plain, data-driven synonym map,
so later phases have organized sections to work with instead of a flat
document. See `../BRIEF-rfp-extraction-phase2.md` for its exact scope.

**What neither phase does yet** (later phases): obligation-language
harvesting for the Compliance Matrix (Phase 3 — the part that actually
finds requirements, not just organizes the document), table extraction
(CLINs/evaluation factors/deliverables — Phase 4), or any integration
into BidPulse itself. Completing Phase 2 does not reduce anyone's review
burden on its own either — organizing a document into sections isn't
the same as finding the requirements inside them.

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

```bash
python3 -m rfp_extraction.pipeline2 path/to/some-rfp.pdf
```

Runs Phase 2 (section segmentation) and prints a human-readable report
to stdout — headings found, which classified to which canonical
section, and which didn't (the actual thing a person should look at;
see "Unclassified headings" below). Add `-o out.json` to also write the
full JSON plus a matching `.report.txt` file alongside it.

## Unclassified headings — where they actually surface

Per the Phase 2 brief: a JSON field nobody opens isn't a real feedback
loop. Every run of `pipeline2` prints a plain-text summary — total
headings, how many classified, and the exact text + page of every one
that didn't match `SECTION_SYNONYMS` — both to stdout and, when `-o` is
used, to a `<output>.report.txt` file. When a real solicitation surfaces
a genuine synonym-map gap, this is what someone should be looking at:
add one string to the relevant list in `rfp_extraction/sections.py`'s
`SECTION_SYNONYMS`, no code restructuring required.

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
- `rfp_extraction/pipeline.py` — ties the above together; also the
  Phase 1 CLI entry point.
- `rfp_extraction/layout.py` — Phase 2: per-line layout metadata (font
  size, boldness, position) that Phase 1 never needed, plus multi-column
  page reordering. New file; does not modify `ingest.py`.
- `rfp_extraction/sections.py` — Phase 2: heading detection, the
  `SECTION_SYNONYMS` canonical taxonomy, and section segmentation.
- `rfp_extraction/pipeline2.py` — Phase 2's pipeline + CLI entry point,
  including the human-readable report (see above).
- `evidence/` (Phase 1) and `evidence/phase2/` (Phase 2) — real run
  outputs and the written evidence notes required before trusting this
  further, per the brief's own "no self-certification" evidence
  standard.

## Evidence

**Phase 1:** see `evidence/NOTES.md` — real extracted JSON for the
actual `RFP-2026-0847-JANI` fixture (pulled from a real submission's
uploaded document in the BidPulse database, not invented for this
task), side-by-side against the source page text; a deliberately
field-free input confirmed to return `null` rather than a false match;
a genuinely image-only (no embedded text layer) page confirmed to
trigger the OCR fallback and come back flagged `low` confidence, not
blended in at equal weight with digital extraction; and a note on which
of the design doc's own §5 patterns fired correctly as given vs. needed
real adjustment, including one that silently produced a **wrong, high-
confidence answer** on the real fixture.

**Phase 2:** see `evidence/phase2/NOTES.md` — real heading/section
mapping for the same fixture; a deliberately unmappable heading
confirmed to land in `unclassified_headings` rather than being
force-matched; a deliberately constructed multi-column test (stated
plainly as synthetic, since no fixture naturally has this layout); and
five real bugs found and fixed along the way, three of them genuine
silent-failure bugs (a document title swallowing the entire rest of the
document into one section; a fallback section that, once opened, could
never be closed; and multi-column reordering that was a complete
no-op every single time it ran) rather than partial-credit tuning
issues — exactly the kind of thing this evidence discipline exists to
catch before Phase 3 builds obligation harvesting on top of section
boundaries that didn't actually work.
