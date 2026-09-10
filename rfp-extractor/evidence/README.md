# Phase 1 evidence

This evidence is generated from a deliberately synthetic three-page PDF.
It proves the current deterministic code paths, but it does not establish
accuracy on real government solicitations.

Regenerate both artifacts with:

```bash
python scripts/build_phase1_evidence.py
```

## Expected results

| Field | Expected result | Provenance |
| --- | --- | --- |
| Solicitation number | `BP-2026-0042` | Physical page 1 |
| NAICS | `561720` | Physical page 1 |
| Set-aside | `total small business set-aside` | Physical page 1 |
| Contract type | `firm-fixed-price` | Physical page 1 |
| Questions due | `2026-09-18 17:00 America/New_York` | Physical page 2 |
| Proposal due | `conflict`: October 15 versus October 16 | Physical pages 2 and 3 |
| Page limit | `shall not exceed 25 pages` | Physical page 2 |
| Submission methods | `email`, `portal` | Physical page 2 |

The repeated header deliberately contains
`Solicitation Number: FALSE-HEADER-999`. It appears on all three pages and
must be suppressed rather than conflicting with the real value.

The amendment deliberately changes the proposal date. The extractor must
retain both candidates with their quotations and page locations, return
`status: conflict`, and leave `selected` null.

The test suite also creates an image-only PDF. With OCR disabled, it must
return `coverage_failure` and `ocr_required`, never a misleading successful
empty result.
