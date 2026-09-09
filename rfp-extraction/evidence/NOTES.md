# Phase 1 evidence

Per the brief's evidence standard: "provide the actual extracted JSON
output, not a description of what it should contain." Everything below
is a real run, not a description of an expected run.

## 1. Real fixture: RFP-2026-0847-JANI

**Source of the fixture.** The brief names `RFP-2026-0847-JANI` as "the
real synthetic test RFP already in the mock data ecosystem." It doesn't
exist as a file anywhere in the BidPulse repo, but it does exist as a
real row in the production `submissions` table (agency "City of
Jacksonville, Procurement Division"), with a real uploaded solicitation
PDF attached to it (`submission_documents`, `document_type: "rfp_file"`,
uploaded 2026-09-08). Pulled that actual file down from Supabase
Storage rather than writing a new synthetic one — this is the same
mock-data-ecosystem object the brief is pointing at, not a re-creation
of it. Saved to `../test-fixtures/RFP-2026-0847-JANI.pdf`. It is
explicitly and repeatedly labeled a fictional test fixture on every
page ("SYNTHETIC TEST DATA... NOT A REAL SOLICITATION"), consistent
with BidPulse's own rule about never treating synthetic content as
real.

No other real (non-synthetic) JAA/JEA/City of Jacksonville RFP PDF was
available in this environment (no network access to actual agency
procurement sites from this sandbox) — per the brief's own "if
available" qualifier on that requirement, only the one fixture above
was used.

**Full source page text:** `jani-source-page-text.txt` (raw PyMuPDF
digital extraction, both pages, unmodified).

**As-given (design doc §5, unmodified) output:** `jani-asgiven-output.json`
**Refined (patterns actually used) output:** `jani-refined-output.json`

### Side-by-side, field by field

| Field | Source text (page 1 unless noted) | As-given result | Refined result | Verdict |
|---|---|---|---|---|
| `solicitation_number` | `Solicitation Number\nRFP-2026-0847-JANI` (also appears fused in the title: `...(RFP) No. RFP-2026-0847-JANI`) | **Unresolved conflict**: `"2026-0847-JANI"` vs `"RFP-2026-0847-JANI"` | `"RFP-2026-0847-JANI"` | As-given pattern needed adjustment — see §2 below. |
| `due_date` | `Proposal Due Date\nOct 6, 2026, 3:00 PM local time` | `"Sept 22, 2026"` — **wrong**, matched `Questions Deadline\nSept 22, 2026, 5:00 PM` instead | `"Oct 6, 2026"` | As-given pattern needed adjustment — see §3 below. This is the more serious of the two: no conflict was raised, just a confident wrong answer. |
| `set_aside` | `Set-Aside Status\nTotal Small Business Set-Aside; JSEB participation encouraged...` | `"Total Small Business Set-Aside"` | same | Fired correctly as-given, no change. |
| `naics_code` | *(NAICS never appears anywhere in the document)* | `null` | `null` | Correct true negative both ways — nothing to adjust. |
| `contract_type` | `Contract Term\n3-year base + two 1-year renewal options` — no Firm-Fixed-Price/T&M/Cost-Plus/IDIQ language anywhere | `null` | `null` | Correct true negative both ways. |
| `page_limit` | *(no page-limit language anywhere in the document)* | `null` | `null` | Correct true negative both ways. |

### 2. `solicitation_number` — why it needed adjustment

The as-given pattern's anchor keyword list includes `RFP`, and the real
solicitation number itself is `RFP-2026-0847-JANI` — i.e. the anchor
word is also the literal first three characters of the value it's
trying to capture. With the designator group `(?:No\.?|Number|#)?`
*optional*, the regex also matches starting **inside the ID itself**:
anchor = the "RFP" at the front of "RFP-2026-0847-JANI", designator
group matches nothing, `[:\-]?` consumes the ID's own hyphen, and the
capture group grabs only `2026-0847-JANI` — a truncated, wrong value,
reported at the same `"confidence": "high"` as the correct match found
elsewhere on the page (`Solicitation Number\nRFP-2026-0847-JANI`).

The conflict-detection logic did catch this — two different values for
the same field correctly came back as `resolved: false` rather than
silently picking one — but the underlying cause is a fixable pattern
flaw, not a genuine "the document really has two different numbers"
case. **Fix:** made the designator group required instead of optional.
This blocks the self-match (nothing but a bare hyphen follows "RFP"
inside the ID, so a required "No./Number/#" can't be found there) while
still matching every real anchor-plus-designator occurrence, including
this fixture's actual label line. Verified: `evidence/jani-refined-output.json`
now returns a single resolved value, `"RFP-2026-0847-JANI"`.

### 3. `due_date` — why it needed adjustment (the more serious finding)

Two separate problems, both real:

**(a) None of the three as-given patterns match the fixture's actual
due-date line at all.** The fixture renders admin fields as a label
line followed by a value line (`Proposal Due Date\nOct 6, 2026, 3:00 PM
local time`), not inline prose like "proposals are due no later than
October 6, 2026" (what pattern 1 expects) or "Closing Date: October 6,
2026" (pattern 2). Pattern 1 specifically fails here because the literal
word "Date" sits between the anchor "due" and the actual date value —
`due\s+(?:no\s+later\s+than\s+)?[:\-]?\s*` has nothing that accounts for
an extra label word in between.

**(b) The as-given `deadline` pattern (§5 pattern 3) is a real decoy-date
risk, not just a missed match.** It has no anchor beyond the bare word
"deadline," so it also matches `Questions Deadline\nSept 22, 2026, 5:00
PM` — a real date on the page, just the wrong one (the Q&A deadline, not
the proposal due date). Because patterns 1 and 2 don't match anything
on this page, pattern 3's match is the *only* one found, so no conflict
is raised — the as-given pipeline returns `"Sept 22, 2026"` as a
confident, unflagged, wrong answer. This is exactly the kind of "decoy
date" problem BidPulse's existing LLM-based extraction route
(`app/api/extract-from-document/route.ts`) already had to special-case
in its prompt — the deterministic pipeline needs its own real answer to
the same problem; "no LLM" doesn't mean "no decoy-date risk" for free.

**Fix:** narrowed the deadline anchor to require proposal/bid/response/
submission context (`(?:proposal|bid|response|submission)s?\s+deadline`
— this would still correctly ignore "Questions Deadline"), and added a
new pattern anchored on "due date" as its own labeled unit (covers both
"Due Date" and "Proposal Due Date" as a heading, with the label-then-
value newline the fixture actually uses). Verified:
`evidence/jani-refined-output.json` now returns the correct `"Oct 6,
2026"`, sourced from the correct label.

## 4. Deliberately field-free input

`no-admin-fields-fixture.pdf` — a generic one-page memo about office
supplies, no dates/codes/numbers in any recognizable format. Real run:
`no-admin-fields-output.json` — every one of the six fields correctly
returns `{"value": null, "provenance": null}`. No false positives.

## 5. OCR fallback

`ocr-fallback-fixture.pdf` — a single page containing only a rasterized
image of the same admin-field text (no embedded text layer at all;
confirmed `page.get_text("text")` returns an empty string before running
the pipeline, so this is genuinely image-only, not a weak digital
extraction). Rendered image: `ocr-fixture-page.png`.

Real run: `ocr-fallback-output.json`.
- `document.extraction_method_summary` correctly reports
  `{"digital_pages": 0, "ocr_pages": 1}`.
- Tesseract successfully read `due_date`, `set_aside`, and
  `solicitation_number` off the image correctly.
- Every one of those results is tagged `"extraction_method": "ocr_regex"`
  and `"confidence": "low"` — not blended in at the same visual/data
  weight as digital extraction, per the design doc's explicit
  requirement in §7/§8.

## Summary

Of the six as-given §5 patterns exercised against a real fixture, two
needed real adjustment (`solicitation_number`, `due_date`) and the
`due_date` case specifically surfaced a genuine silent-wrong-answer
failure mode, not just a missed match — worth carrying forward as a
concrete lesson into Phase 3 (obligation harvesting), where the same
"anchor word also appears inside the thing you're trying to extract"
and "broad anchor matches a decoy" failure shapes will very likely recur
against real government drafting language. The other four
(`naics_code`, `set_aside`, `contract_type`, `page_limit`) either fired
correctly as-given or correctly returned a true negative, with nothing
to adjust.
