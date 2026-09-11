"""Phase 2, stage 2: heading detection + canonical section taxonomy +
segmentation. Additive to Phase 1; does not modify any Phase 1 module.

Real, fixture-driven finding worth stating plainly (full write-up in
evidence/phase2/NOTES.md): a heading-candidate rule of "font size in the
top 2 distinct sizes seen, OR bold + short (< 12 words), OR matches a
numbering pattern" produces real false positives against a real
solicitation -- every info-table label cell ("Issuing Agency",
"Solicitation Number", ...) and every table header cell ("Criterion",
"Points", ...) is also bold and short, and indistinguishable from a real
sub-heading ("1.1 Day Porter Services") by that signal alone. What
actually distinguishes them in the real fixture this was built against:
genuine headings sit at the document's dominant body-text left margin,
while table-cell content is indented into its own column. So the
bold+short branch here additionally requires the line to sit at that
margin (computed per-document as the mode of every line's x0, not
hardcoded) rather than accepting bold+short alone. This is a deliberate,
stated simplification of "starts a new paragraph" -- a heading rendered
flush with differently-indented body text would not be caught by this
specific proxy; a known limitation, not a general solution.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from importlib.resources import files
from typing import Any

from .models import Heading, LayoutLine, Section, SegmentationResult

MAX_HEADING_WORDS = 12

NUMBERING_PATTERNS: list[str] = [
    r"^SECTION\s+([A-M])\b",
    r"^PART\s+([IVX]+)\b",
    r"^(\d{1,2})\.\d+(\.\d+)*\s",  # 3.2.1 Numbered para
    r"^([A-Z])\.\d+\s",  # L.5
    r"^Article\s+([IVXLC]+)\b",
    r"^Attachment\s+([A-Z0-9]+)\b",
    # A bare top-level "1. Scope of Work" style heading -- none of the
    # patterns above match it (they all require a second numbering
    # level, e.g. "3.2.1" or "L.5") -- found against a real fixture
    # using exactly this top-level heading style.
    r"^(\d{1,2})\.\s+[A-Z]",
]
_NUMBERING_RE = [re.compile(pattern) for pattern in NUMBERING_PATTERNS]


def _load_synonym_config() -> tuple[dict[str, list[str]], str, str]:
    rule_path = files("bidpulse_rfp_extractor").joinpath("rules/section_synonyms.json")
    content = rule_path.read_bytes()
    config = json.loads(content)
    return config["sections"], config["version"], hashlib.sha256(content).hexdigest()


def classify_heading(text: str, synonyms: dict[str, list[str]]) -> str | None:
    norm = text.strip().lower()
    for canonical, phrases in synonyms.items():
        if any(phrase in norm for phrase in phrases):
            return canonical
    return None


def _matches_numbering(text: str) -> str | None:
    for pattern, regex in zip(NUMBERING_PATTERNS, _NUMBERING_RE):
        if regex.match(text):
            return pattern
    return None


def detect_headings(
    lines: list[LayoutLine],
    synonyms: dict[str, list[str]],
) -> list[Heading]:
    if not lines:
        return []

    font_sizes_desc = sorted({line.font_size for line in lines}, reverse=True)
    top2_sizes = set(font_sizes_desc[:2])
    single_largest_size = font_sizes_desc[0]

    # Body-text margin proxy for "starts a new paragraph" -- see module
    # docstring. Computed from the document itself, not hardcoded.
    margin_x0 = Counter(round(line.x0) for line in lines).most_common(1)[0][0]

    headings: list[Heading] = []
    for line in lines:
        word_count = len(line.text.split())
        numbering_pattern = _matches_numbering(line.text)

        # On a document with very few distinct font sizes, "top 2
        # sizes" can cover essentially the whole document's text,
        # including plain body paragraphs that happen to share a size
        # with the real heading -- word count alone doesn't reliably
        # filter these out, since body text is often broken into short
        # lines too. Requiring boldness (unless it's the single largest
        # size on the page, which is almost always a real title
        # regardless of weight) fixes this without regressing a
        # document where every genuine heading is already bold.
        if line.font_size in top2_sizes and (
            line.font_size == single_largest_size or line.is_bold
        ):
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
                page_index=line.page_index,
                printed_page_label=line.printed_page_label,
                font_size=line.font_size,
                canonical_section=classify_heading(line.text, synonyms),
                matched_via=matched_via,
                matched_pattern=numbering_pattern,
            )
        )
    return headings


def segment_sections(lines: list[LayoutLine], headings: list[Heading]) -> SegmentationResult:
    """Walks headings in document order; each *section-opening-eligible*
    heading opens a section that runs until the next heading of
    equal-or-higher structural level. Level is approximated by font
    size (bigger = higher level) -- a deliberate simplification that
    doesn't account for numbering-depth beyond what's needed here.

    A document's own title/subtitle line is typically the single
    biggest font on the page (bigger than any real section heading),
    but isn't a real section at all -- it's front matter. Treating it
    as a section-opener under a naive "bigger font = higher level" rule
    means nothing later in the document ever has an equal-or-bigger
    font to close it with, so the title silently swallows the entire
    rest of the document into one section. Fixed: a heading only gets
    to open/close a section if it's independently identifiable as a
    real section marker -- it matched a numbering pattern, or it
    classified to a canonical section type. A heading that's neither (a
    bare, unnumbered, unclassified title/subtitle) still appears in
    `headings` and `unclassified_headings` for visibility, it just
    doesn't get treated as authoritative for section boundaries.

    Lines before the first section-opening-eligible heading, or the
    whole document if none exists, fall back to a single
    canonical_type=None section -- still real content, just with no
    section-level context.

    A still-open fallback section has no real "level" of its own; its
    font-size sentinel must not simply start at `inf`, since no real
    heading's font size can ever be `>= inf` -- that would make the
    *fallback* section itself unclosable, and it would swallow the
    whole document instead of the title. Guarded with an explicit
    `in_fallback` check: a still-open fallback section never blocks the
    next real section-opening heading, regardless of font size.
    """
    heading_positions = {(h.page_index, h.text): h for h in headings}
    is_heading_line = {
        (line.page_index, line.text)
        for line in lines
        if (line.page_index, line.text) in heading_positions
    }

    sections: list[Section] = []
    current: Section | None = None
    current_heading_font_size = float("inf")

    for line in lines:
        key = (line.page_index, line.text)
        if key in is_heading_line:
            heading = heading_positions[key]
            can_open_section = bool(heading.matched_pattern) or heading.canonical_section is not None
            in_fallback = current is not None and current.heading_text is None
            if not can_open_section:
                # Front-matter-shaped heading (e.g. a bare document
                # title) -- visible in `headings`, but doesn't touch
                # section boundaries. Falls through to be recorded as
                # plain content of whatever section is currently open.
                pass
            elif current is None or in_fallback or heading.font_size >= current_heading_font_size:
                if current is not None:
                    sections.append(current)
                current = Section(
                    canonical_type=heading.canonical_section,
                    heading_text=heading.text,
                    start_page_index=heading.page_index,
                )
                current_heading_font_size = heading.font_size
                continue
            # Lower-level heading (e.g. "1.1" under "1.") -- keep the
            # section open, but still record its own line as content.
        if current is None:
            current = Section(canonical_type=None, heading_text=None, start_page_index=line.page_index)
            current_heading_font_size = float("inf")
        current.lines.append(line.text)

    if current is not None:
        sections.append(current)

    unclassified = [
        {"text": heading.text, "page_index": heading.page_index}
        for heading in headings
        if heading.canonical_section is None
    ]

    return SegmentationResult(headings=headings, sections=sections, unclassified_headings=unclassified)


def segment(lines: list[LayoutLine]) -> tuple[SegmentationResult, dict[str, Any]]:
    """Convenience entry point: loads the synonym rule set, detects
    headings, and segments -- plus the same rule-set version/sha256
    diagnostics pattern admin_fields.py already returns, so a caller can
    record which synonym map produced a given result."""
    synonyms, rule_set_version, rule_set_sha256 = _load_synonym_config()
    headings = detect_headings(lines, synonyms)
    result = segment_sections(lines, headings)
    diagnostics = {
        "rule_set_version": rule_set_version,
        "rule_set_sha256": rule_set_sha256,
    }
    return result, diagnostics


__all__ = [
    "MAX_HEADING_WORDS",
    "NUMBERING_PATTERNS",
    "classify_heading",
    "detect_headings",
    "segment",
    "segment_sections",
]
