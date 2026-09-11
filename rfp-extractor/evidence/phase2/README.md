# Phase 2 evidence (section segmentation)

Regenerate every artifact below with:

```bash
python scripts/build_phase2_evidence.py
```

## Stated limitation

The synonym map (`src/bidpulse_rfp_extractor/rules/section_synonyms.json`)
and heading heuristics are validated against one real solicitation
(`test-fixtures/RFP-2026-0847-JANI.pdf`, a City of Jacksonville janitorial
RFP) plus deliberately constructed synthetic fixtures — not a broad corpus.
Treat this as a first draft, refined as more real solicitations become
available, not a field-validated result.

## Real fixture: `RFP-2026-0847-JANI.pdf`

`jani-output.json` / `jani-output.report.txt`. 8 headings detected, 3
classified into canonical sections, 5 correctly left unclassified (the
document's own title/subtitle, plus three `1.1`/`1.2`/`1.3` sub-headings
that are real structure but not UCF-equivalent section types — they stay
as content inside `scope_of_work` rather than opening phantom sections
of their own).

| Heading | Canonical section |
| --- | --- |
| `City of Jacksonville — Procurement Division` | *(unclassified — front matter)* |
| `Request for Proposals (RFP) No. RFP-2026-0847-JANI` | *(unclassified — front matter)* |
| `1. Scope of Work` | `scope_of_work` |
| `2. Evaluation Criteria (100 Points Total)` | `evaluation_factors` |
| `3. Minimum Qualification Requirements` | `minimum_qualifications` — not in the original UCF-derived synonym list; added as its own canonical type rather than force-matched to the nearest-sounding entry |

## Real bugs this evidence pass caught and fixed

1. **Document title swallowed the whole document.** A naive "biggest
   font = highest section level" rule treats the document's own title
   (almost always the single biggest font on the page) as a
   section-opener — but it isn't a real section, so nothing later in
   the document can ever be big enough to close it. Fixed:
   `segment_sections` only lets a heading open/close a section if it's
   independently identifiable as a real marker (numbered, or
   classified) — see `sections.py`'s own docstring.
2. **A still-open fallback section became unclosable.** Chasing bug 1
   surfaced a second bug: the fallback "front matter" section's own
   font-size sentinel started at `inf`, so no real heading's size could
   ever be `>=` it either — same symptom, different cause. Fixed with
   an explicit `in_fallback` check.
3. **Bold, short table-label cells looked identical to real
   sub-headings.** Every info-table label ("Issuing Agency",
   "Solicitation Number") and table header cell ("Criterion", "Points")
   in the real fixture is bold and short — indistinguishable from a
   real sub-heading like "1.1 Day Porter Services" by that signal
   alone. Fixed by additionally requiring the line to sit at the
   document's dominant body-text left margin (computed per document,
   not hardcoded) — see `section-pipeline-output.report.txt`, where the
   synthetic fixture's own indented "Issuing Agency" line is correctly
   excluded from `headings` entirely.

## Synthetic fixtures

- `multicolumn-output.json` / `.report.txt` — proves
  `extract_layout_lines`'s two-column reordering regroups a
  row-interleaved page into column-major reading order, not a no-op
  (an earlier version's split-point calculation silently never
  triggered — see `layout.py`'s own docstring).
- `unmappable-heading-output.json` / `.report.txt` — a short document
  with only two distinct font sizes, proving "top 2 font sizes" doesn't
  over-trigger on plain body text once boldness is required for
  anything but the single largest size.
- `section-pipeline-output.json` / `.report.txt` — the title-swallowing,
  fallback-sentinel, and table-label-margin bugs above, all in one
  fixture; also exercised directly as `tests/test_sections.py`
  regression tests, not just evidence.
