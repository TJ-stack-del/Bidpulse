from __future__ import annotations

from bidpulse_rfp_extractor.ingest import ingest_pdf
from bidpulse_rfp_extractor.layout import extract_layout_lines
from bidpulse_rfp_extractor.phase2_pipeline import run
from bidpulse_rfp_extractor.sections import detect_headings, segment

from fixture_factory import (
    build_multicolumn_pdf,
    build_section_pipeline_pdf,
    build_unmappable_heading_pdf,
)


def _layout_lines(pdf_path):
    _document, pages, _quality, _diagnostics = ingest_pdf(pdf_path)
    return extract_layout_lines(str(pdf_path), pages)


def test_multicolumn_page_reordered_column_major_not_row_interleaved(tmp_path):
    pdf_path = build_multicolumn_pdf(tmp_path / "multicolumn.pdf")
    lines = _layout_lines(pdf_path)

    texts = [line.text for line in lines]
    assert texts == [
        "Left column line one",
        "Left column line two",
        "Left column line three",
        "Left column line four",
        "Right column line one",
        "Right column line two",
        "Right column line three",
        "Right column line four",
    ]


def test_short_document_does_not_misdetect_every_body_line_as_heading(tmp_path):
    pdf_path = build_unmappable_heading_pdf(tmp_path / "unmappable.pdf")
    lines = _layout_lines(pdf_path)

    result, _diagnostics = segment(lines)

    heading_texts = [heading.text for heading in result.headings]
    assert heading_texts == ["Special Provisions"]
    assert result.headings[0].matched_via == "top_font_size"
    assert result.headings[0].canonical_section is None
    assert result.unclassified_headings == [{"text": "Special Provisions", "page_index": 0}]

    # Because the one heading can't open a real section (no numbering
    # match, no canonical classification), every line -- including the
    # heading's own text -- lands in a single unclassified fallback
    # section, not scattered across phantom sections.
    assert len(result.sections) == 1
    assert result.sections[0].canonical_type is None
    assert len(result.sections[0].lines) == 4


def test_title_and_numbered_headings_segment_correctly_not_swallowed(tmp_path):
    pdf_path = build_section_pipeline_pdf(tmp_path / "sections.pdf")
    result, diagnostics = run(str(pdf_path))

    # The bold, short, off-margin "Issuing Agency" line must not be
    # detected as a heading at all (the table-label-cell false-positive
    # bug this fixture specifically targets).
    heading_texts = [heading.text for heading in result.headings]
    assert "Issuing Agency" not in heading_texts

    # Title (front matter, unclassified) + the two numbered headings.
    assert heading_texts == [
        "City of Example, Procurement Division",
        "1. Scope of Work",
        "2. Evaluation Criteria",
    ]

    # Three real sections: the title's own fallback section, then one
    # per numbered heading -- not one giant section swallowing
    # everything after the title (the font-size-ordering bug), and not
    # an unclosable fallback either (the inf-sentinel bug).
    assert [section.canonical_type for section in result.sections] == [
        None,
        "scope_of_work",
        "evaluation_factors",
    ]
    assert result.sections[0].heading_text is None
    assert result.sections[1].heading_text == "1. Scope of Work"
    assert result.sections[2].heading_text == "2. Evaluation Criteria"

    # The indented label line ends up as ordinary content of whichever
    # section is open when it appears -- not lost, not a section of
    # its own.
    assert "Issuing Agency" in result.sections[1].lines

    assert diagnostics["sections"]["rule_set_version"]
    assert diagnostics["native_pages_used"] == 1


def test_detect_headings_on_empty_input_returns_empty():
    assert detect_headings([], {}) == []
