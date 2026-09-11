# BidPulse RFP Extractor

Standalone, deterministic extraction for government solicitation PDFs.
This package does not call an LLM and is not connected to the BidPulse
Next.js application.

Phase 1 currently provides:

- PDF validation, SHA-256 identity, and page-level quality diagnostics
- geometry-preserving text blocks with page and bounding-box provenance
- optional OCR through PyMuPDF and a locally installed Tesseract binary
- repeated header/footer detection, provenance tagging, and body-evidence preference
- rule-based extraction of solicitation number, dates, NAICS, set-aside,
  contract type, page limits, and submission methods
- explicit `resolved`, `conflict`, `absent`, and `unknown` field states
- configurable limits for file size, page count, page geometry, images,
  decompressed text, OCR, memory, and elapsed processing time
- JSON output suitable for later section and obligation extraction phases

Phase 2 adds deterministic section segmentation (no LLM):

- per-line font size, boldness, and position, plus two-column page
  reordering into correct document-wide reading order
- heading detection (font-size ranking, numbering patterns, or bold
  text at the document's own dominant left margin)
- a data-driven canonical section taxonomy/synonym map
  (`rules/section_synonyms.json`, trivially extended with one new list
  entry — no code changes)
- segmentation into sections, with front matter and unclassified
  headings kept visible rather than silently dropped or force-matched
- a human-readable report (`render_report`) surfacing
  `unclassified_headings` for review, not just a JSON field nobody opens

See `evidence/phase2/README.md` for real-fixture results and the real
bugs this stage's evidence pass found and fixed.

## Development

```bash
cd rfp-extractor
python -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
pytest
```

## Command line

```bash
bidpulse-rfp-extract input.pdf --output result.json
```

OCR is disabled by default so local behavior is predictable. Use
`--ocr auto` when Tesseract is installed. Pages that appear scanned are
always surfaced in diagnostics when OCR is unavailable or disabled.

```bash
bidpulse-rfp-extract scanned.pdf --ocr auto --output result.json
```

Phase 2's segmentation has its own CLI entry point:

```bash
bidpulse-rfp-sections input.pdf --output sections.json
```

The same input bytes, parser version, rule-set content, and OCR engine
configuration produce deterministic semantic extraction. Source filename is
retained as metadata, so complete JSON differs when identical bytes are
processed under different filenames.

`extract()` runs parsing in an isolated worker. `ProcessingLimits` bounds
input size, decompressed text structures, memory, and wall-clock time; a
timed-out worker is terminated. Production services should still apply their
own container and queue limits as defense in depth.
