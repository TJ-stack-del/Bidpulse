# Phase 2 evidence

Per the brief's evidence standard: real run outputs, not descriptions of
expected behavior. Every JSON/report file referenced below was produced
by an actual run of the code in this commit, not hand-written.

## 0. Stated limitation (per the brief's explicit requirement)

**The synonym map and heading heuristics below are validated against
synthetic fixtures only.** No real (non-synthetic) JAA/JEA/City of
Jacksonville solicitation was available in this environment to test
against — same constraint as Phase 1, and the same real gap the brief
names directly. Mike's decision (recorded in the brief): build for
adaptability now via a data-driven synonym map and a real
`unclassified_headings` feedback mechanism, refine against real
documents once they're sourced. **Treat everything below as a first
draft, not a finished, field-validated result.**

## 1. Real fixture: RFP-2026-0847-JANI — full heading/section mapping

Layout dump (every line, with font size/bold/x0):
`jani-layout-dump.txt`. Segmentation output: `jani-sections-output.json`
+ human-readable report: `jani-sections-output.report.txt`.

| Heading text | Page | Matched via | Canonical section | Notes |
|---|---|---|---|---|
| `City of Jacksonville — Procurement Division` | 1 | top_font_size (16.0, single largest) | *(unclassified — front matter)* | Document title, correctly excluded from opening a section (see §2). |
| `Request for Proposals (RFP) No. RFP-2026-0847-JANI` | 1 | top_font_size (12.5, bold) | *(unclassified — front matter)* | Document subtitle, same reasoning. |
| `1. Scope of Work` | 1 | top_font_size + numbering_pattern | `scope_of_work` | |
| `1.1 Day Porter Services (M–F, 7:00 AM–4:00 PM)` | 1 | numbering_pattern | *(unclassified)* | Real sub-heading, correctly not force-matched — it's a specific service tier, not a UCF-equivalent top-level type. Stays inside the `scope_of_work` section as content (lower structural level, doesn't open a new section). |
| `1.2 Night Shift Services (M–F, 6:00 PM–2:00 AM)` | 1 | numbering_pattern | *(unclassified)* | Same reasoning. |
| `1.3 Periodic Care (Scheduled / Quarterly unless noted)` | 1 | numbering_pattern | *(unclassified)* | Same reasoning. |
| `2. Evaluation Criteria (100 Points Total)` | 1 | top_font_size + numbering_pattern | `evaluation_factors` | |
| `3. Minimum Qualification Requirements` | 2 | top_font_size + numbering_pattern | `minimum_qualifications` | Not in the design doc's own §3 synonym list — added as its own canonical type rather than force-matched to the nearest-sounding entry (e.g. `instructions_to_offerors`), per the brief's explicit instruction. |

Resulting sections (4): front matter (24 lines), `scope_of_work` (16
lines, includes the 1.1/1.2/1.3 sub-headings and their body text),
`evaluation_factors` (20 lines, includes the evaluation table's own
content), `minimum_qualifications` (8 lines). Full text preview of each
is in `jani-sections-output.report.txt`.

## 2. Real bugs found and fixed (this is the actual point of Phase 2's evidence pass)

### 2.1 Document title/subtitle silently swallowed the entire rest of the document

The naive "bigger font = higher structural level" rule treats whatever
has the single biggest font on the page as the highest-level
section-opener. A document's own title is almost always the biggest
font on the page — but it isn't a UCF section at all, it's front
matter. With that rule applied literally, once the 16pt title "opened"
a section, no later heading (all smaller fonts) could ever be `>=` it,
so the title's "section" ran to the end of the document. First real run
produced exactly one section containing all 71 lines — confirmed via
`sections.py`'s own module and its `segment_sections` docstring, which
documents this fix in detail (`can_open_section` now requires a heading
to be independently identifiable as a real section marker — numbered,
or classified — before it can open/close a section boundary).

### 2.2 A still-open fallback section blocked all subsequent real headings

Chasing bug 2.1 surfaced a second, related bug: the fallback
"unclassified_body" section (opened for the leading front-matter lines
before any real heading) initialized its own font-size sentinel to
`inf`. Since no real heading's font size can ever be `>= inf`, the
*fallback* section itself became unclosable once bug 2.1's fix was
applied — same symptom (one giant section), different cause. Fixed with
an explicit `in_fallback` check: a still-open fallback section never
blocks the next real section-opening heading. Both fixes are documented
directly in `sections.py`'s `segment_sections` docstring since they're
tightly coupled.

### 2.3 Bold+short table-label cells looked identical to real sub-headings

The design doc's own heading-candidate rule includes "bold + short (< 12
words)" as an independently sufficient condition. Against the real
fixture, every info-table label cell ("Issuing Agency", "Solicitation
Number", "Proposal Due Date", ...) and every evaluation-table header
cell ("Criterion", "Points") is *also* bold and short — completely
indistinguishable from a real sub-heading like "1.1 Day Porter Services"
by that signal alone. Fixed by additionally requiring the line to sit at
the document's dominant body-text left margin (computed per-document as
the mode of every line's x0, not hardcoded) — table content in this
fixture is indented into its own columns, genuine headings aren't. See
`sections.py`'s module docstring for the full reasoning, including the
known limitation (a heading rendered flush with differently-indented
body text wouldn't be caught by this specific proxy — this is a real,
stated simplification of the design doc's unimplemented "starts a new
paragraph" condition, not a general solution to it).

### 2.4 "Top 2 font sizes" over-triggered on a short, simple document

Deliberately constructed a short synthetic fixture
(`unmappable-heading-fixture.pdf`, see §3) with only 2 distinct font
sizes total (14pt heading, 10pt body). "Top 2 sizes" then covered
*every* line in the document, including plain, non-bold body prose —
first run detected 4 "headings" where only 1 was real. Fixed by
requiring boldness for anything but the single largest font size on the
page (a true document title is almost always the single biggest size,
regardless of weight; a "second-tier" size shared with plain body text
needs boldness to actually distinguish a heading from prose that
happens to share that size). Verified this doesn't regress the real
fixture, where every genuine heading is already bold.

### 2.5 Multi-column reordering was a silent no-op

The first version of `_reorder_if_multicolumn` picked its column split
point as `sorted(x0 values)[len(x0_values) // 2]` and used `<=` for the
left column. For an evenly-split two-column page (4 lines per column,
the deliberately constructed test case — see §4), that index lands
exactly on the right column's own x0 value, so `<=` swept every line
from *both* columns into "left," leaving "right" empty, and the
function correctly detected "not a real second column" and returned
unchanged every time — silently never reordering anything, on every
input, not just this one. Only caught because the test fixture used
row-interleaved insertion order specifically to make a no-op visibly
distinguishable from a real fix (an earlier, weaker version of this test
happened to insert whole columns one after another, which didn't
actually exercise the reordering logic at all — see §4 for why that
mattered). Fixed by finding the actual largest gap between consecutive
*distinct* x0 values instead of an arbitrary sorted-list index.

## 3. Deliberately unmappable heading

`unmappable-heading-fixture.pdf` — real heading "4. Green Cleaning
Certification Appendix" plus body prose about certification bodies, on
a topic with no canonical section type in `SECTION_SYNONYMS` at all.
Real run: `unmappable-heading-output.json` /
`unmappable-heading-output.report.txt`. Result: exactly 1 heading
detected (after the §2.4 fix removed the 3 false-positive body-prose
"headings" the first run produced), correctly landing in
`unclassified_headings` rather than being force-matched to
`scope_of_work` or any other nearest-sounding entry.

## 4. Multi-column layout — explicitly a constructed test, not naturally occurring

Neither `RFP-2026-0847-JANI` nor any other current fixture has a real
multi-column layout, so per the brief this is a **deliberately
constructed synthetic test**, stated plainly as such: `multicolumn-
fixture.pdf`, two columns (left: "SECTION L. Instructions to Offerors"
+ 3 lines of body text; right: "SECTION M. Evaluation Factors" + 3
lines), with **row-interleaved insertion order** specifically so the
raw (pre-reordering) block order is genuinely scrambled across columns
— an earlier version of this same test inserted one whole column at a
time, which happened to already come back in correct order regardless
of whether the reordering logic worked at all, and would have let the
§2.5 bug pass undetected. Real output:
`multicolumn-output.json` / `multicolumn-output.report.txt` — both
sections come back with their own 3 lines of body text, correctly
un-scrambled, and both headings correctly classify (`instructions_to_offerors`,
`evaluation_factors`). **Validated only against this one synthetic
case** — genuinely untested against a real multi-column municipal RFP,
which may have more than two columns, uneven column widths, or column
breaks that don't align with section boundaries the way this
constructed example does.

## Summary

Five real bugs found and fixed, three of them (2.1, 2.2, 2.5) not
partial-credit "needed tuning" findings but genuine silent-failure
bugs that would have produced wrong or no-op output with no error
raised — exactly the kind of thing this evidence-gathering discipline
exists to catch before Phase 3 (obligation harvesting) builds on top of
section boundaries that, before these fixes, didn't actually work. The
synonym map itself is a first draft validated only against synthetic
fixtures, per §0 above, and needs a real second pass once actual agency
solicitations are available to test against.
