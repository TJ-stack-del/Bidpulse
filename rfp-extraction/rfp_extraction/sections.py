"""Stage 3 -- heading detection + canonical section taxonomy/synonym map
+ segmentation. New for Phase 2; does not modify any Phase 1 file.

Real, fixture-driven finding worth stating plainly (full write-up in
evidence/phase2/NOTES.md): the design doc's own heading-candidate rule
is "font size in the top 2 distinct sizes seen, OR bold + short (< 12
words) + starts a new paragraph, OR matches a numbering pattern." Taken
literally, the bold+short branch alone produces real false positives
against RFP-2026-0847-JANI -- every info-table label cell ("Issuing
Agency", "Solicitation Number", ...) and every table header cell
("Criterion", "Points", ...) is *also* bold and short, and completely
indistinguishable from a real sub-heading ("1.1 Day Porter Services") by
that signal alone. What actually distinguishes them in this real
document: genuine headings sit at the document's dominant body-text left
margin, while table-cell content is indented into its own column. So the
bold+short branch here additionally requires the line to sit at that
margin (computed per-document as the mode of every line's x0, not
hardcoded) rather than accepting bold+short on its own. This is a real,
deliberate simplification of "starts a new paragraph" (which the design
doc names but doesn't operationalize) -- documented as a known
limitation, not silently assumed to generalize to every possible RFP
layout (a heading rendered flush with a differently-indented body, for
instance, would not be caught by this specific proxy).
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field

from .layout import Line

MAX_HEADING_WORDS = 12

NUMBERING_PATTERNS: list[str] = [
    r"^SECTION\s+([A-M])\b",
    r"^PART\s+([IVX]+)\b",
    r"^(\d{1,2})\.\d+(\.\d+)*\s",  # 3.2.1 Numbered para
    r"^([A-Z])\.\d+\s",  # L.5
    r"^Article\s+([IVXLC]+)\b",
    r"^Attachment\s+([A-Z0-9]+)\b",
    # Added against the real fixture: none of the six patterns above
    # match a bare top-level "1. Scope of Work" style heading (they all
    # require a second numbering level, e.g. "3.2.1" or "L.5") -- this
    # exact style is what RFP-2026-0847-JANI's own top-level headings use.
    r"^(\d{1,2})\.\s+[A-Z]",
]
_NUMBERING_RE = [re.compile(p) for p in NUMBERING_PATTERNS]

# Per the brief: a plain, data-driven lookup table, trivially extended
# by adding one more string to a list -- never embedded logic. Covers
# every canonical type design doc §3 names, plus "definitions" (added
# per the brief, needed by Phase 3's obligation-filtering later even
# though the filtering logic itself isn't built here).
SECTION_SYNONYMS: dict[str, list[str]] = {
    "instructions_to_offerors": [  # ~ Section L
        "instructions to offerors",
        "instructions, conditions",
        "proposal submission requirements",
        "proposal preparation instructions",
        "how to submit",
        "submission instructions",
        "section l",
    ],
    "evaluation_factors": [  # ~ Section M
        "evaluation factors",
        "evaluation criteria",
        "basis for award",
        "method of award",
        "award criteria",
        "section m",
    ],
    "scope_of_work": [  # ~ Section C
        "scope of work",
        "statement of work",
        "performance work statement",
        "specifications",
        "description of services",
        "section c",
        "scope of services",
        "technical specifications",
    ],
    "supplies_and_prices": [  # ~ Section B
        "supplies or services and prices",
        "price schedule",
        "schedule of items",
        "clin",
        "bid schedule",
        "section b",
    ],
    "deliveries_performance": [  # ~ Section F
        "deliveries or performance",
        "period of performance",
        "delivery schedule",
        "section f",
    ],
    "contract_clauses": [  # ~ Section I
        "contract clauses",
        "far clauses",
        "applicable clauses",
        "section i",
    ],
    "representations_certifications": [  # ~ Section K
        "representations and certifications",
        "certifications and representations",
        "reps and certs",
        "section k",
    ],
    "attachments": ["list of attachments", "section j", "exhibits"],
    "special_requirements": ["special contract requirements", "section h"],
    "admin_data": ["contract administration data", "section g"],
    "definitions": ["definitions", "terms used", "terms and definitions"],
    # Not in the design doc's own §3 list, but a real, distinct section
    # type this fixture actually has ("3. Minimum Qualification
    # Requirements") that doesn't fit any UCF-derived synonym above --
    # rather than force-matching it to the nearest-sounding entry (the
    # brief explicitly says not to), it gets its own canonical type.
    "minimum_qualifications": [
        "minimum qualification requirements",
        "minimum qualifications",
        "eligibility requirements",
    ],
}


def classify_heading(text: str) -> str | None:
    norm = text.strip().lower()
    for canonical, synonyms in SECTION_SYNONYMS.items():
        if any(s in norm for s in synonyms):
            return canonical
    return None


def _matches_numbering(text: str) -> str | None:
    for pattern, regex in zip(NUMBERING_PATTERNS, _NUMBERING_RE):
        if regex.match(text):
            return pattern
    return None


@dataclass
class Heading:
    text: str
    page: int
    font_size: float
    canonical_section: str | None
    matched_via: str  # "top_font_size" | "numbering_pattern" | "bold_at_margin"
    matched_pattern: str | None = None  # the numbering regex, if that's how it matched


@dataclass
class Section:
    canonical_type: str | None  # None => "unclassified_body" fallback
    heading_text: str | None  # None for the unclassified_body fallback
    start_page: int
    lines: list[str] = field(default_factory=list)


@dataclass
class SegmentationResult:
    headings: list[Heading]
    sections: list[Section]
    unclassified_headings: list[dict]  # [{"text": ..., "page": ...}, ...] -- design doc §6 shape, verbatim

    def to_dict(self) -> dict:
        return {
            "headings": [
                {
                    "text": h.text,
                    "page": h.page,
                    "font_size": h.font_size,
                    "canonical_section": h.canonical_section,
                    "matched_via": h.matched_via,
                    "matched_pattern": h.matched_pattern,
                }
                for h in self.headings
            ],
            "sections": [
                {
                    "canonical_type": s.canonical_type,
                    "heading_text": s.heading_text,
                    "start_page": s.start_page,
                    "line_count": len(s.lines),
                    "preview": " ".join(s.lines)[:200],
                }
                for s in self.sections
            ],
            "unresolved": {"unclassified_headings": self.unclassified_headings},
        }


def detect_headings(lines: list[Line]) -> list[Heading]:
    if not lines:
        return []

    font_sizes_desc = sorted({l.font_size for l in lines}, reverse=True)
    top2_sizes = set(font_sizes_desc[:2])
    single_largest_size = font_sizes_desc[0]

    # Body-text margin proxy for "starts a new paragraph" -- see module
    # docstring. Computed from the document itself, not hardcoded.
    margin_x0 = Counter(round(l.x0) for l in lines).most_common(1)[0][0]

    headings: list[Heading] = []
    for line in lines:
        word_count = len(line.text.split())
        numbering_pattern = _matches_numbering(line.text)

        # Found via a deliberately constructed short-document test (see
        # evidence/phase2/NOTES.md): on a document with very few distinct
        # font sizes, "top 2 sizes" can cover essentially the whole
        # document's text, including plain body paragraphs that happen
        # to share a size with the real heading -- word-count alone
        # doesn't reliably filter these out, since body text is often
        # broken into short lines too. Requiring boldness (unless it's
        # the single largest size on the page, which is almost always a
        # real title regardless of weight) fixes it without regressing
        # the real fixture, where every genuine heading is already bold.
        if line.font_size in top2_sizes and (line.font_size == single_largest_size or line.is_bold):
            matched_via = "top_font_size"
        elif numbering_pattern:
            matched_via = "numbering_pattern"
        elif line.is_bold and word_count < MAX_HEADING_WORDS and round(line.x0) == margin_x0:
            matched_via = "bold_at_margin"
        else:
            continue

        headings.append(
            Heading(
                text=line.text,
                page=line.page_num,
                font_size=line.font_size,
                canonical_section=classify_heading(line.text),
                matched_via=matched_via,
                matched_pattern=numbering_pattern,
            )
        )
    return headings


def segment_sections(lines: list[Line], headings: list[Heading]) -> SegmentationResult:
    """Walks headings in document order; each *section-opening-eligible*
    heading opens a section that runs until the next heading of
    equal-or-higher structural level. Level is approximated by font size
    (bigger = higher level) -- a real, stated simplification of the
    design doc's numbering-depth-aware version, since Phase 2's only
    real fixture doesn't have deep enough nesting (more than 2 levels)
    to require the full version yet.

    Real bug found and fixed against the actual fixture: a document's
    own title/subtitle line is typically the single biggest font on the
    page (bigger than any real section heading), but isn't a UCF-style
    section at all -- it's front matter. Treating it as a section-opener
    under a naive "bigger font = higher level" rule meant nothing later
    in the document ever had an equal-or-bigger font to close it with,
    so the title silently swallowed the entire rest of the document into
    one section. Fixed: a heading only gets to open/close a section if
    it's independently identifiable as a *real* section marker -- it
    matched a numbering pattern, or it classified to a canonical
    section type. A heading that's neither (a bare, unnumbered,
    unclassified title/subtitle) still appears in `headings` and
    `unclassified_headings` for visibility, it just doesn't get treated
    as authoritative for section boundaries.

    Lines before the first section-opening-eligible heading, or the
    whole document if none exists, fall back to a single
    canonical_type=None "unclassified_body" section -- still real
    content, just with no section-level context.

    Second real bug found chasing the first one: once that fallback
    section is open, it has no real "level" of its own, but its
    font-size sentinel started at `inf` -- and since no real heading's
    font size can ever be `>= inf`, nothing could ever close it either,
    so the *fallback* section ended up swallowing the whole document
    instead of the title. Fixed with an explicit `in_fallback` check: a
    still-open fallback section never blocks the next real
    section-opening heading, regardless of font size.
    """
    heading_positions = {(h.page, h.text): h for h in headings}
    is_heading_line = {(l.page_num, l.text) for l in lines if (l.page_num, l.text) in heading_positions}

    sections: list[Section] = []
    current: Section | None = None
    current_heading_font_size = float("inf")

    for line in lines:
        key = (line.page_num, line.text)
        if key in is_heading_line:
            heading = heading_positions[key]
            can_open_section = bool(heading.matched_pattern) or heading.canonical_section is not None
            # A still-open fallback "unclassified_body" section (opened
            # for leading front-matter content, before any real heading
            # was found) has no real level to compare against -- without
            # this check, its font_size sentinel (`inf`, set below) means
            # no real heading's size could ever be ">=" it, so a fallback
            # section opened by front matter would silently swallow the
            # entire rest of the document. A real fixture-found bug, not
            # a hypothetical one -- see this function's own docstring.
            in_fallback = current is not None and current.heading_text is None
            if not can_open_section:
                # Front-matter-shaped heading (e.g. a bare document
                # title) -- visible in `headings`, but doesn't touch
                # section boundaries. Falls through to be recorded as
                # plain content of whatever section is currently open.
                pass
            elif current is None or in_fallback or heading.font_size >= current_heading_font_size:
                # Equal-or-higher level heading -- close the current
                # section (if any) and open a new one.
                if current is not None:
                    sections.append(current)
                current = Section(
                    canonical_type=heading.canonical_section,
                    heading_text=heading.text,
                    start_page=heading.page,
                )
                current_heading_font_size = heading.font_size
                continue
            # Lower-level heading (e.g. "1.1" under "1.") -- keep the
            # section open, but still record its own line as content.
        if current is None:
            current = Section(canonical_type=None, heading_text=None, start_page=line.page_num)
            current_heading_font_size = float("inf")
        current.lines.append(line.text)

    if current is not None:
        sections.append(current)

    unclassified = [
        {"text": h.text, "page": h.page}
        for h in headings
        if h.canonical_section is None
    ]

    return SegmentationResult(headings=headings, sections=sections, unclassified_headings=unclassified)
