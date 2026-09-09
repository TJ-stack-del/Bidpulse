# Deterministic RFP Extraction Pipeline — Design

Non-LLM, rule-based + classical NLP extraction of structured data from
government solicitation PDFs, feeding the Compliance Matrix, Technical
Narrative inputs, and Capability Statement inputs. No generative model
calls anywhere in this pipeline — every output is traceable to a regex,
a layout heuristic, or a lookup table.

---

## 1. Why this is tractable without an LLM

Government solicitations (especially federal ones, and most state/local
ones modeled after them) follow the **Uniform Contract Format (UCF)**:

```
Section A — Solicitation/Contract Form
Section B — Supplies/Services and Prices/Costs (often CLINs)
Section C — Description/Specs/SOW (or PWS)
Section D — Packaging and Marking
Section E — Inspection and Acceptance
Section F — Deliveries or Performance
Section G — Contract Administration Data
Section H — Special Contract Requirements
Section I — Contract Clauses (FAR/DFARS/agency supplement refs)
Section J — List of Attachments
Section K — Representations, Certifications, Other Statements
Section L — Instructions, Conditions, Notices to Offerors
Section M — Evaluation Factors for Award
```

Local/municipal RFPs (JAA, JEA, City of Jacksonville, Duval Schools)
rarely use exact UCF letters, but almost always have equivalent
sections under different names ("Proposal Submission Requirements" ≈
Section L, "Evaluation Criteria" ≈ Section M, "Scope of Services" ≈
Section C). The pipeline needs a **canonical section taxonomy** with a
synonym map, not a hard dependency on A–M lettering.

Within any given section, obligation language is linguistically narrow:
government drafters use a small, well-known set of modal/obligation
constructions almost universally, because "shall" vs. "should" vs. "may"
has contractual meaning. This is exactly the kind of narrow, high-precision
domain regex is good at — much better suited to deterministic patterns
than open-domain text.

---

## 2. Pipeline architecture

```
┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌──────────────┐
│  1. Ingest   │──▶│ 2. Layout &  │──▶│ 3. Section    │──▶│ 4. Requirement│
│  PDF → text  │   │ structure    │   │ segmentation  │   │  harvesting   │
│  + layout    │   │ extraction   │   │ (A–M taxonomy)│   │  (regex/NLP)  │
└─────────────┘   └──────────────┘   └───────────────┘   └──────┬───────┘
                                                                  │
┌─────────────┐   ┌──────────────┐   ┌───────────────┐          │
│ 8. Output    │◀──│ 7. Assembly  │◀──│ 6. Field      │◀─────────┘
│  JSON/Excel  │   │  into 3      │   │  extraction   │
│  w/ provenance│  │  artifacts   │   │  (admin data) │
└─────────────┘   └──────────────┘   └───────┬───────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │ 5. Table extraction │
                                    │  (CLINs, eval       │
                                    │  factors, deliv.)   │
                                    └─────────────────────┘
```

### Stage 1 — Ingest

Use **PyMuPDF (`fitz`)** as the primary engine — it's fast and gives you
per-character bounding boxes, font size, and font name, which stage 2
needs for heading detection. Use **pdfplumber** as a secondary/fallback
engine specifically for table extraction (`extract_tables()` is more
reliable than PyMuPDF's table support for ruled/bordered tables common
in Section L/M and CLIN schedules).

```python
import fitz  # PyMuPDF

def load_pdf(path: str) -> list[dict]:
    """Returns one dict per page with text blocks + layout metadata."""
    doc = fitz.open(path)
    pages = []
    for page_num, page in enumerate(doc, start=1):
        blocks = page.get_text("dict")["blocks"]
        pages.append({
            "page_num": page_num,
            "blocks": blocks,       # spans with font, size, bbox
            "raw_text": page.get_text("text"),
        })
    return pages
```

Run OCR fallback (Tesseract via `pytesseract` + `pdf2image`) only when a
page's extracted text is empty/near-empty (scanned RFPs happen with
smaller municipal agencies). Flag OCR'd pages explicitly in provenance —
confidence should be visibly lower downstream, never silently equal to
digitally-extracted text.

### Stage 2 — Layout & structure extraction

From the `blocks` dict, build a flat list of **lines** with:
`text, page_num, font_size, is_bold, x0, y0, is_all_caps`.

Heading candidates = lines where:
- font size is in the top 2 distinct sizes seen on that page/document, OR
- bold + short (< 12 words) + starts a new paragraph, OR
- matches a numbering pattern (see below).

```python
import re

NUMBERING_PATTERNS = [
    r"^SECTION\s+([A-M])\b",                    # SECTION L
    r"^PART\s+([IVX]+)\b",                        # PART III
    r"^(\d{1,2})\.\d+(\.\d+)*\s",                # 3.2.1 Numbered para
    r"^([A-Z])\.\d+\s",                            # L.5
    r"^Article\s+([IVXLC]+)\b",                    # Article IV
    r"^Attachment\s+([A-Z0-9]+)\b",                # Attachment J-1
]
```

### Stage 3 — Section segmentation (canonical taxonomy + synonym map)

Because municipal RFPs don't use UCF letters reliably, map every
detected heading to a **canonical section type** via a synonym table.
This is the single most valuable piece of domain data to invest in and
tune over time — it is what lets the same pipeline handle a federal
DFARS solicitation and a City of Jacksonville RFP with the same code.

```python
SECTION_SYNONYMS: dict[str, list[str]] = {
    "instructions_to_offerors": [       # ≈ Section L
        "instructions to offerors", "instructions, conditions",
        "proposal submission requirements", "proposal preparation instructions",
        "how to submit", "submission instructions", "section l",
    ],
    "evaluation_factors": [             # ≈ Section M
        "evaluation factors", "evaluation criteria", "basis for award",
        "method of award", "award criteria", "section m",
    ],
    "scope_of_work": [                  # ≈ Section C
        "scope of work", "statement of work", "performance work statement",
        "specifications", "description of services", "section c",
        "scope of services", "technical specifications",
    ],
    "supplies_and_prices": [            # ≈ Section B
        "supplies or services and prices", "price schedule",
        "schedule of items", "clin", "bid schedule", "section b",
    ],
    "deliveries_performance": [         # ≈ Section F
        "deliveries or performance", "period of performance",
        "delivery schedule", "section f",
    ],
    "contract_clauses": [               # ≈ Section I
        "contract clauses", "far clauses", "applicable clauses", "section i",
    ],
    "representations_certifications": [ # ≈ Section K
        "representations and certifications", "certifications and representations",
        "reps and certs", "section k",
    ],
    "attachments": ["list of attachments", "section j", "exhibits"],
    "special_requirements": ["special contract requirements", "section h"],
    "admin_data": ["contract administration data", "section g"],
}

def classify_heading(text: str) -> str | None:
    norm = text.strip().lower()
    for canonical, synonyms in SECTION_SYNONYMS.items():
        if any(s in norm for s in synonyms):
            return canonical
    return None
```

Segmentation algorithm:
1. Walk headings in document order.
2. Each heading opens a section that runs until the next heading of
   **equal or higher structural level** (use numbering depth / font
   size rank, not just "next heading found").
3. Attach every line/paragraph between two headings to the currently
   open section, tagged with `page_num` and a running character offset
   for provenance.
4. If no headings classify cleanly (common in short/simple RFQs),
   fall back to a single `"unclassified_body"` section — still run
   requirement harvesting over it, just without section-level context.

---

## 3. Requirement harvesting (obligation-language extraction)

This is the core of the Compliance Matrix. The goal: every sentence
containing binding obligation language, with full text, page, section,
and a classified **obligation strength**.

### 3.1 Obligation modal taxonomy

Government drafting has three tiers, and conflating them is a real
compliance risk — a matrix that treats "may" the same as "shall" is
actively misleading, so keep them distinct fields, never collapse them.

```python
OBLIGATION_TIERS = {
    "mandatory": [
        r"\bshall\b", r"\bmust\b", r"\bis required to\b", r"\bare required to\b",
        r"\brequired\s+that\b", r"\bwill be required\b", r"\bmandatory\b",
        r"\bfailure to .{0,40}will result\b",
    ],
    "conditional_mandatory": [
        r"\bif applicable,?\s+.{0,60}\bshall\b",
        r"\bwhen applicable\b", r"\bunless otherwise\b",
    ],
    "expected": [
        r"\bwill\b(?!\s+not\s+be\s+required)",  # "will" alone is weaker than "shall" but usually treated as binding in practice — flag, don't silently merge with "shall"
    ],
    "discretionary": [
        r"\bmay\b", r"\bshould\b", r"\bis encouraged to\b", r"\bat its discretion\b",
    ],
    "prohibition": [
        r"\bshall not\b", r"\bmust not\b", r"\bis prohibited\b", r"\bwill not\b",
    ],
}
```

### 3.2 Sentence-level extraction

Use spaCy purely for **sentence boundary detection** (its statistical
sentencizer handles legal-document punctuation — e.g. "e.g.", "U.S.C.",
numbered sub-clauses — far better than a naive regex split), not for any
semantic classification. Everything downstream of sentence splitting is
still deterministic regex.

```python
import spacy
nlp = spacy.load("en_core_web_sm", disable=["ner", "lemmatizer"])  # sentencizer only

def extract_obligations(section_text: str, page_num: int, section: str, source_ref: str):
    doc = nlp(section_text)
    results = []
    for sent in doc.sents:
        s = sent.text.strip()
        if len(s) < 8:
            continue
        for tier, patterns in OBLIGATION_TIERS.items():
            for pat in patterns:
                if re.search(pat, s, re.IGNORECASE):
                    results.append({
                        "text": s,
                        "obligation_tier": tier,
                        "matched_pattern": pat,
                        "page": page_num,
                        "section": section,
                        "source_ref": source_ref,   # e.g. "L.5.2" numbered para if known
                    })
                    break  # one tier per sentence — first/strongest match wins
            else:
                continue
            break
    return results
```

Precedence rule when a sentence matches multiple tiers (e.g. "shall...
unless otherwise directed"): mandatory > conditional_mandatory >
prohibition > expected > discretionary. Encode this as tier ordering in
the loop, not as separate logic, so it stays auditable.

### 3.3 De-duplication and noise filtering

- Skip sentences inside boilerplate FAR clause **titles** already
  captured by the clause-reference extractor (§3.4) to avoid double
  counting — e.g. don't harvest "Contractor shall comply with FAR
  52.219-8" both as a clause reference and a generic obligation; tag it
  as a clause reference primarily and cross-link.
- Skip table-of-contents / list-of-attachments pages (detect via a high
  ratio of lines matching a `"\.{3,}\s*\d+$"` dot-leader pattern).
- Collapse near-duplicate sentences (e.g. a requirement repeated
  verbatim in the SOW and again in an attachment) via exact-text match
  after whitespace normalization — keep both provenance entries but
  merge into one compliance-matrix row with `also_appears_in: [...]`.

### 3.4 FAR/DFARS/agency clause references

```python
CLAUSE_REF_PATTERN = re.compile(
    r"\b(FAR|DFARS|AFARS|DEARS)\s+(\d{2}\.\d{3}-\d{1,2})\b"
)
```
Maintain a small local lookup table (JSON, hand-curated, versioned in
repo — not fetched at runtime) mapping common clause numbers to their
plain-English titles for common trades (e.g. `52.219-8` → "Utilization
of Small Business Concerns", `52.222-41` → "Service Contract Labor
Standards"). This is the same pattern already used for
`requirements-reference.ts` in BidPulse — same idea, just triggered by
clause number instead of by trade keyword.

---

## 4. Table extraction

Three table types matter: **CLIN schedules**, **evaluation
factor/weight tables**, **deliverables schedules**. Use `pdfplumber`'s
`page.extract_tables()` with explicit strategy settings per type, since
one global setting rarely works well across all three:

```python
import pdfplumber

def extract_tables_from_page(pdf_path: str, page_num: int, table_settings: dict):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num - 1]
        return page.extract_tables(table_settings)
```

- **Ruled tables** (most CLIN schedules, most eval-factor tables):
  `{"vertical_strategy": "lines", "horizontal_strategy": "lines"}`.
- **Text-aligned tables without visible rules** (common in scanned-then-
  retyped municipal RFPs): fall back to
  `{"vertical_strategy": "text", "horizontal_strategy": "text"}`, then
  validate the result against a header-keyword check before trusting it
  (see below) — this strategy produces more false positives.

**Table classification** — after extraction, classify by header row
keywords rather than by which section it was found in (headers are more
reliable than section boundaries, which can be miscategorized):

```python
TABLE_HEADER_SIGNATURES = {
    "clin_schedule": {"clin", "description", "qty", "unit price", "extended price"},
    "evaluation_factors": {"factor", "weight", "points", "criteria", "%"},
    "deliverables": {"deliverable", "due date", "frequency", "format"},
}

def classify_table(header_row: list[str]) -> str | None:
    norm = {h.strip().lower() for h in header_row if h}
    best, best_score = None, 0
    for kind, sig in TABLE_HEADER_SIGNATURES.items():
        score = len(norm & sig)
        if score > best_score:
            best, best_score = kind, score
    return best if best_score >= 1 else None
```

For **evaluation weights specifically**: after classifying a table as
`evaluation_factors`, run a secondary numeric-consistency check — sum
the weight/point column and flag (not reject) if it doesn't land on a
clean 100 or 100% — RFPs sometimes list weighted *and* unweighted
factors in the same table, and a mismatch is a signal for a human to
check, not a parsing bug to silently "fix."

---

## 5. Administrative field extraction

These are single-value fields, best extracted via **targeted regex
around anchor phrases**, scanning the whole document (not just one
section) since agencies place these inconsistently.

```python
ADMIN_FIELD_PATTERNS = {
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

def extract_admin_fields(full_text: str) -> dict:
    out = {}
    for field, patterns in ADMIN_FIELD_PATTERNS.items():
        for pat in patterns:
            m = re.search(pat, full_text, re.IGNORECASE)
            if m:
                out[field] = {"value": m.group(1).strip(), "matched_pattern": pat}
                break
    return out
```

Every match here should carry `matched_pattern` in provenance too — if
the regex is ever wrong, you want to know *which* pattern fired, not
just where the text came from, since debugging a false match starts
with the pattern, not the page.

**Key personnel / certifications required** are best extracted as a
*list-detection* problem, not single-value regex: find bulleted/numbered
lists immediately following an anchor heading like "Key Personnel",
"Required Certifications", "Minimum Qualifications", and capture each
list item as a row rather than trying to regex the whole block at once.

```python
LIST_ANCHOR_HEADINGS = [
    "key personnel", "required certifications", "minimum qualifications",
    "required licenses", "submittal checklist", "required forms",
]

def extract_following_list(lines: list[dict], anchor_idx: int) -> list[str]:
    items = []
    for line in lines[anchor_idx + 1:]:
        if re.match(r"^\s*(?:[-•●▪]|\d+[\.\)])\s+", line["text"]):
            items.append(re.sub(r"^\s*(?:[-•●▪]|\d+[\.\)])\s+", "", line["text"]).strip())
        elif items and line["is_heading"]:
            break  # next heading ends the list
        elif items and not line["text"].strip():
            continue  # blank line inside a list is fine
        elif items:
            break  # non-list prose after list items ends it
    return items
```

---

## 6. Output schema

Design the schema around the **three downstream consumers**, with a
shared provenance model so every field/row traces back to page + quote.

```python
from dataclasses import dataclass, field

@dataclass
class Provenance:
    page: int
    section: str | None
    source_ref: str | None        # e.g. "L.5.2" if a numbered para was resolved
    quote: str                    # exact original text, never paraphrased
    matched_pattern: str | None = None
    extraction_method: str = "regex"   # "regex" | "table" | "ocr_regex"
    confidence: str = "high"           # "high" | "medium" | "low" (see §7)

@dataclass
class ComplianceMatrixRow:
    requirement_id: str            # stable hash of text+page for dedup/tracking
    requirement_text: str
    obligation_tier: str           # mandatory | conditional_mandatory | expected | discretionary | prohibition
    category: str                  # "administrative" | "technical" | "certification" | "submission_format" | "clause"
    provenance: Provenance
    also_appears_in: list[Provenance] = field(default_factory=list)
    status: str = "needs_response"  # admin/client fills in later — never pre-filled by the pipeline
```

```json
{
  "document": {
    "source_filename": "RFP-2026-0847-JANI.pdf",
    "page_count": 47,
    "extraction_timestamp": "2026-09-09T14:02:00Z",
    "extraction_method_summary": {"digital_pages": 45, "ocr_pages": 2}
  },
  "admin_fields": {
    "solicitation_number": {"value": "RFP-2026-0847-JANI", "provenance": {...}},
    "due_date": {"value": "2026-10-14", "provenance": {...}},
    "naics_code": {"value": "561720", "provenance": {...}},
    "set_aside": {"value": "Total Small Business Set-Aside", "provenance": {...}},
    "contract_type": {"value": null, "provenance": null},
    "page_limit": {"value": 15, "provenance": {...}}
  },
  "compliance_matrix": [
    { "requirement_id": "...", "requirement_text": "...", "obligation_tier": "mandatory",
      "category": "submission_format", "provenance": {...} }
  ],
  "evaluation_factors": [
    { "factor": "Technical Approach", "weight": "40%", "provenance": {...} },
    { "factor": "Past Performance", "weight": "25%", "provenance": {...} }
  ],
  "clins": [ { "clin": "0001", "description": "...", "qty": 12, "unit": "MO", "provenance": {...} } ],
  "deliverables": [ { "deliverable": "...", "due": "...", "frequency": "...", "provenance": {...} } ],
  "key_personnel": [ { "role": "Project Manager", "requirement": "5 yrs relevant experience", "provenance": {...} } ],
  "required_certifications": [ { "text": "FDACS Commercial Pesticide Applicator License", "provenance": {...} } ],
  "clause_references": [ { "clause": "FAR 52.219-8", "title_lookup": "Utilization of Small Business Concerns", "provenance": {...} } ],
  "sow_extract": {
    "raw_sections": [ {"heading": "3.2 Cleaning Frequency", "text": "...", "page": 8} ],
    "obligation_sentences": [ {"text": "...", "tier": "mandatory", "page": 8} ]
  },
  "unresolved": {
    "unclassified_headings": [ {"text": "Addendum Log", "page": 44} ],
    "low_confidence_admin_fields": [ "contract_type" ],
    "ocr_pages_flagged": [12, 13]
  }
}
```

### 6.1 Feeding the three downstream artifacts

- **Compliance Matrix** ← `compliance_matrix[]` directly, cross-joined
  with BidPulse's existing static `requirements-reference.ts`
  (`ALWAYS_MANDATORY`, `CONDITIONAL_REQUIREMENTS`,
  `TRADE_SPECIFIC_CERTIFICATIONS`) — the extracted rows are the
  **bid-specific NEEDS VERIFICATION facts**, the static reference is
  the **baseline checklist**; merge, don't replace. This keeps the
  "never invent, always verifiable" property extraction gives you and
  extends it, rather than displacing the existing curated logic.
- **Technical Narrative inputs** ← `sow_extract`, `evaluation_factors`
  (so the narrative addresses what's actually being scored), and
  `deliverables[]`. Feed these as *structured facts* into the existing
  no-invention drafting prompt in `route (3).ts` — this pipeline
  replaces manual reading, not the drafting step itself; the drafting
  route still explicitly refuses to invent anything beyond what's
  given, same as today.
- **Capability Statement inputs** ← `key_personnel[]`,
  `required_certifications[]`, `naics_code`, `set_aside` (so the
  statement can honestly say "responsive to this NAICS/set-aside," not
  invent a broader claim).

---

## 7. Confidence scoring (deterministic, not statistical)

Every extracted item gets a rule-based confidence tag, not a model
score — keep it explainable:

- **high** — matched a specific, unambiguous anchor pattern *and* came
  from a digitally-extracted (non-OCR) page *and* is not from a
  fallback table strategy.
- **medium** — matched a broader/looser pattern (e.g. `will` obligation
  tier, or the `text`-strategy table fallback), or came from OCR text
  with high per-character confidence.
- **low** — came from OCR with low confidence scores from Tesseract, or
  matched only a generic list-detection heuristic with no anchor
  heading, or a table classification score of exactly 1 keyword match.

Surface `low`-confidence items separately in the UI (a "needs manual
check" bucket) rather than blending them into the main compliance
matrix at equal visual weight — this preserves the audit trail Mike
already cares about for the LLM-drafting side of BidPulse.

---

## 8. Edge cases and how to handle them deterministically

| Edge case | Deterministic handling |
|---|---|
| Scanned/image-only PDF | OCR fallback (Tesseract), all resulting extractions forced to `confidence: low` or `medium` at best, `extraction_method: ocr_regex`, and OCR pages listed in `unresolved.ocr_pages_flagged`. Never silently treat OCR text as equal-confidence to digital text. |
| No clear section headers (short RFQ, 2-page price request) | Fall back to `unclassified_body`; still run obligation harvesting and admin-field regex over the whole doc; skip section-dependent logic (e.g. Section L/M specific parsing) gracefully — don't error out. |
| Table has merged cells / multi-line cells | `pdfplumber` returns `None` or empty strings for some cells in this case — post-process by forward-filling `None` CLIN/row-id cells from the row above (common in CLIN schedules with grouped line items), but never forward-fill price/qty columns (a blank there is a real blank, not a continuation). |
| Requirement referenced only by pointer ("see Attachment J-3") | Extract the pointer itself as a `category: "cross_reference"` row with the raw pointer text, and attempt to resolve it if the referenced attachment/section was also parsed (link by matching heading text against `SECTION_SYNONYMS`/numbering); if unresolved, leave it in `unresolved` rather than guessing. |
| Conflicting/duplicate values (two different due dates found) | Keep both matches in a list rather than picking one silently; surface the conflict to the admin UI (`"due_date": {"candidates": [...], "resolved": false}`) — this is exactly the kind of ambiguity a human should resolve, not the pipeline. |
| Boilerplate FAR clause text reproduced in full in the RFP body | De-duplicate against the clause-reference lookup table by clause number; store only the clause number + short title, not the full boilerplate text, to keep output size sane and avoid treating standard clause language as a bid-specific requirement. |
| "Shall" used in a definitions section, not as a real obligation (e.g. "'Contractor' shall mean...") | Add a definitional-sentence filter: skip sentences matching `r"^['\"]?\w+['\"]?\s+(?:shall|will)\s+mean\b"` or occurring inside a section classified as `"definitions"` (add `"definitions"` to the synonym map, anchored on "Definitions", "Terms Used"). |
| Multi-column page layout (some municipal RFPs) | PyMuPDF's block `x0` positions let you detect two-column layout (bimodal x0 clustering); re-order blocks column-by-column, top-to-bottom, before sentence splitting — otherwise obligation sentences get scrambled across columns. |
| Addenda/amendments issued as separate PDFs after the base RFP | Treat as a separate ingestion unit with its own provenance, but tag `is_addendum: true` and let matched clause/requirement text supersede the base document's version for that same numbered paragraph — track both versions, never silently overwrite, since "which version governs" is itself sometimes disputed and worth keeping evidence of. |
| Page-limit or format rules stated as prose, not a clean regex hit (e.g. "no proposal shall exceed fifteen (15) pages including appendices") | Extend the numeric pattern to also catch spelled-out numbers immediately followed by a parenthetical digit — `r"\b\w+\s*\((\d{1,3})\)\s+pages?"` — this specific "word (digit)" construction is extremely common in government drafting and worth its own pattern rather than folding into the general page-limit regex. |

---

## 9. Suggested phased build order

1. **Ingest + layout extraction** (Stage 1–2) — get clean per-line
   text with font metadata for a handful of real JAA/JEA/City of
   Jacksonville PDFs first, since those are the actual target agencies.
2. **Admin field regex** (Stage 6) — highest immediate value, lowest
   complexity; replaces the riskiest part of the current
   `route (2).ts` LLM-based extraction (form pre-fill) with something
   deterministic and auditable.
3. **Section segmentation + synonym map** — build the synonym table
   empirically against 8–10 real solicitations from the actual target
   agencies before generalizing further; don't over-engineer for
   federal DFARS patterns you may not see in practice.
4. **Obligation harvesting** — the compliance-matrix core.
5. **Table extraction** — CLINs and evaluation factors; test against
   both ruled and unruled table layouts from real samples.
6. **Confidence scoring + `unresolved` bucket** — build this in
   parallel with 2–5, not bolted on afterward, since every extractor
   above needs to emit confidence at the point of extraction.
7. **Wire into the three artifacts** — merge with
   `requirements-reference.ts` for the Compliance Matrix; feed
   `route (3).ts`'s existing no-invention drafting prompts with
   structured facts instead of (or alongside) whatever manual input
   currently seeds them.

A good regression-test set is the same pattern already used elsewhere
in BidPulse: a small library of real (or realistic synthetic) RFP PDFs
with hand-verified expected extractions, checked automatically on every
pipeline change — the same evidence discipline as the existing
`regression-check.mjs` script, just applied to extraction accuracy
instead of app behavior.

---

## 10. Suggested tech stack summary

| Purpose | Library |
|---|---|
| PDF text + layout | `PyMuPDF` (`fitz`) |
| Table extraction | `pdfplumber` |
| OCR fallback | `pytesseract` + `pdf2image` |
| Sentence boundaries only | `spaCy` (`en_core_web_sm`, sentencizer only — no NER/LLM component) |
| Regex engine | stdlib `re` (or `regex` package if you need lookbehind-heavy patterns) |
| Output | JSON (primary) + `openpyxl` for an Excel-ready compliance matrix export |

None of this calls out to any generative model — the only "AI-adjacent"
dependency is spaCy's statistical sentence tokenizer, which is a small
local model doing sentence-boundary detection only, not text generation
or classification of meaning.
