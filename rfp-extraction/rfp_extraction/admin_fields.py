"""Stage 6 (Phase 1 slice) -- administrative field extraction.

Two pattern sets are kept side by side on purpose, not merged into one
"final" list:

  ADMIN_FIELD_PATTERNS_ASGIVEN  -- exactly the design doc's §5 patterns,
    unmodified. Kept so a real run can show, verbatim, what the design
    doc alone produces against a real document -- this is the evidence
    the Phase 1 brief asks for ("which patterns fired correctly, which
    needed adjustment, and why").

  ADMIN_FIELD_PATTERNS -- the patterns actually used for extraction,
    starting from the §5 set and refined against the real
    RFP-2026-0847-JANI fixture. See evidence/NOTES.md for the full
    write-up; the short version:

  - due_date: the as-given "deadline" pattern (§5 pattern 3) matches
    ANY deadline-labeled date, including "Questions Deadline" -- on the
    real fixture this silently returns Sept 22 (the Q&A deadline) as
    the due date instead of Oct 6 (the actual proposal due date), with
    no conflict raised, because none of the other two as-given patterns
    also fire. A confident wrong answer is worse than a flagged
    conflict. This is exactly the "decoy date" problem BidPulse's
    existing LLM-based extraction route already had to special-case
    (see app/api/extract-from-document/route.ts's due-date prompt) --
    the deterministic pipeline needs its own answer to the same
    problem, not just "no LLM" as a substitute for "no decoy-date risk."
    Fixed by narrowing the deadline anchor to require proposal/bid/
    response/submission context, and adding a table-label pattern for
    "Due Date" / "Proposal Due Date" as its own heading (the real
    fixture renders admin fields as a label-line then a value-line, not
    inline prose -- "Proposal Due Date\nOct 6, 2026" -- which none of
    the three original inline-prose patterns match at all, since the
    literal word "Date" sits between the anchor "due" and the value in
    a way the original patterns don't account for).
  - solicitation_number: fired correctly as-given, no changes needed --
    "Solicitation Number\nRFP-2026-0847-JANI" matches via \\s* spanning
    the newline between label and value.
  - naics_code, contract_type, page_limit: none of these fields appear
    anywhere in the fixture at all (a real, not contrived, negative
    case) -- as-given patterns correctly return no match on all three,
    nothing to adjust.
  - set_aside: fired correctly as-given ("Total Small Business
    Set-Aside" appears inline, matching the first pattern directly).
  - solicitation_number: as-given produced a genuine *false* conflict,
    not a real one. "RFP" is both the anchor keyword the pattern looks
    for AND the literal prefix of the ID it's trying to capture
    ("RFP-2026-0847-JANI"), so the regex also matches starting mid-
    token -- anchor "RFP" (the ID's own first 3 chars), the optional
    `(?:No\\.?|Number|#)?` group matching nothing, `[:\\-]?` consuming
    the ID's own first hyphen, and the capture group grabbing only
    "2026-0847-JANI" -- a truncated, wrong value, produced with the
    exact same "high" confidence as the correct one from "Solicitation
    Number\\n<id>" elsewhere on the page. The conflict-detection logic
    caught it (both values differ, so it correctly came back
    `resolved: false` rather than silently picking one), but the root
    cause is fixable, not a genuine two-numbers-in-the-document
    ambiguity: made the `(?:No\\.?|Number|#)` designator *required*
    (was optional) for this refined pattern, which blocks the
    self-match (nothing but a bare hyphen follows "RFP" inside the ID
    itself) while still matching every real "<Anchor> No./Number/#
    <value>" occurrence, including this fixture's actual label line.
"""

from __future__ import annotations

import re

from .ingest import Page
from .schema import AdminFieldResult, Provenance

# Exactly design doc §5, verbatim -- do not edit this dict; see module
# docstring for why it's kept separate from the patterns actually used.
ADMIN_FIELD_PATTERNS_ASGIVEN: dict[str, list[str]] = {
    "due_date": [
        r"(?:proposals?|bids?|responses?|offers?)\s+(?:are\s+)?due\s+(?:no\s+later\s+than\s+)?[:\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})",
        r"closing\s+date[:\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})",
        r"deadline[:\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})",
    ],
    "naics_code": [r"\bNAICS\s*(?:Code)?[:\-]?\s*(\d{6})\b"],
    "set_aside": [
        r"\b(Total\s+Small\s+Business\s+Set-Aside)\b",
        r"\b(8\(a\)\s+Set-Aside)\b",
        r"\b(WOSB|EDWOSB|HUBZone|SDVOSB|VOSB)\s+Set-Aside\b",
        r"\b(JSEB\s+Only)\b",
        r"\bfull\s+and\s+open\s+competition\b",
    ],
    "contract_type": [
        r"\b(Firm[\s-]Fixed[\s-]Price|Time[\s-]and[\s-]Materials|Cost[\s-]Plus[\s-]Fixed[\s-]Fee|IDIQ)\b",
    ],
    "page_limit": [
        r"(?:not\s+(?:to\s+)?exceed|no\s+more\s+than|maximum\s+of)\s+(\d{1,3})\s+pages?",
    ],
    "solicitation_number": [
        r"\b(?:Solicitation|RFP|ITB|RFQ|IFB)\s*(?:No\.?|Number|#)?\s*[:\-]?\s*([A-Z0-9\-]{5,})\b",
    ],
}

# Refined set actually used for extraction -- see module docstring.
ADMIN_FIELD_PATTERNS: dict[str, list[str]] = {
    "due_date": [
        ADMIN_FIELD_PATTERNS_ASGIVEN["due_date"][0],
        ADMIN_FIELD_PATTERNS_ASGIVEN["due_date"][1],
        # Narrowed from the as-given bare "deadline" -- requires the
        # deadline to actually be about proposal submission, not any
        # deadline-labeled date on the page (Q&A deadline, addendum
        # deadline, etc.).
        r"(?:proposal|bid|response|submission)s?\s+deadline[:\-]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})",
        # New: table label/value layout ("Due Date\n<date>" or
        # "Proposal Due Date\n<date>") -- \s* already spans the newline,
        # this just adds the missing "due date" (as a unit) anchor the
        # as-given patterns don't have.
        r"\b(?:proposal\s+)?due\s+date[:\-]?\s*\n?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})",
    ],
    "naics_code": ADMIN_FIELD_PATTERNS_ASGIVEN["naics_code"],
    "set_aside": ADMIN_FIELD_PATTERNS_ASGIVEN["set_aside"],
    "contract_type": ADMIN_FIELD_PATTERNS_ASGIVEN["contract_type"],
    "page_limit": ADMIN_FIELD_PATTERNS_ASGIVEN["page_limit"],
    "solicitation_number": [
        # Designator required (was optional in the as-given pattern) --
        # see module docstring for why: this blocks the anchor from
        # self-matching against the ID's own "RFP-" prefix while still
        # matching every real "<Anchor> No./Number/# <value>" case.
        r"\b(?:Solicitation|RFP|ITB|RFQ|IFB)\s*(?:No\.?|Number|#)\s*[:\-]?\s*([A-Z0-9\-]{5,})\b",
    ],
}


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def extract_admin_fields(pages: list[Page], patterns: dict[str, list[str]] | None = None) -> dict[str, AdminFieldResult]:
    """Scans every page's text for every pattern of every field (design
    doc §5: "scanning the whole document ... since agencies place these
    inconsistently"). Distinct matching values for the same field become
    `candidates` with `resolved: false` rather than silently picking one
    -- see schema.py's own docstring for why that shape exists.
    """
    patterns = patterns if patterns is not None else ADMIN_FIELD_PATTERNS
    results: dict[str, AdminFieldResult] = {}

    for field_name, field_patterns in patterns.items():
        # value -> first Provenance seen for it (dedup by normalized value)
        found: dict[str, Provenance] = {}
        for pattern in field_patterns:
            regex = re.compile(pattern, re.IGNORECASE)
            for page in pages:
                for match in regex.finditer(page.text):
                    raw_value = match.group(1) if match.groups() else match.group(0)
                    value = _normalize(raw_value)
                    if not value or value in found:
                        continue
                    found[value] = Provenance(
                        page=page.page_num,
                        quote=_normalize(match.group(0)),
                        matched_pattern=pattern,
                        extraction_method="ocr_regex" if page.extraction_method == "ocr" else "regex",
                        confidence="low" if page.extraction_method == "ocr" else "high",
                    )

        if len(found) == 0:
            results[field_name] = AdminFieldResult(value=None, provenance=None)
        elif len(found) == 1:
            (value, prov), = found.items()
            results[field_name] = AdminFieldResult(value=value, provenance=prov)
        else:
            candidates = [{"value": v, "provenance": p.to_dict()} for v, p in found.items()]
            results[field_name] = AdminFieldResult(candidates=candidates, resolved=False)

    return results
