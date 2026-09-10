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

The same input bytes, parser version, rule-set content, and OCR engine
configuration produce deterministic semantic extraction. Source filename is
retained as metadata, so complete JSON differs when identical bytes are
processed under different filenames.

`extract()` runs parsing in an isolated worker. `ProcessingLimits` bounds
input size, decompressed text structures, memory, and wall-clock time; a
timed-out worker is terminated. Production services should still apply their
own container and queue limits as defense in depth.
