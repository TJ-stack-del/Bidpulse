from __future__ import annotations

import json
import shutil

import pytest

from bidpulse_rfp_extractor import ProcessingLimits, extract
from bidpulse_rfp_extractor.errors import (
    EncryptedPdfError,
    InvalidPdfError,
    ResourceLimitError,
)

from fixture_factory import (
    build_adjacent_label_value_pdf,
    build_encrypted_pdf,
    build_image_only_pdf,
    build_phase1_pdf,
    build_repeated_identifier_header_pdf,
    build_repeated_equivalent_deadline_pdf,
    build_same_block_deadlines_pdf,
    build_scanned_text_pdf,
    build_side_by_side_label_value_pdf,
    build_text_pdf,
)


def test_phase1_extracts_fields_with_provenance_and_conflicts(tmp_path):
    pdf_path = build_phase1_pdf(tmp_path / "phase1.pdf")

    result = extract(pdf_path)
    payload = result.to_dict()
    fields = payload["administrative_fields"]

    assert payload["quality"]["status"] == "ok"
    assert payload["document"]["page_count"] == 3
    assert payload["document"]["id"].startswith("sha256:")

    assert fields["solicitation_number"]["status"] == "resolved"
    assert fields["solicitation_number"]["selected"] == "BP-2026-0042"
    header_candidates = [
        candidate
        for candidate in fields["solicitation_number"]["candidates"]
        if candidate["value"] == "FALSE-HEADER-999"
    ]
    assert header_candidates
    assert all(
        candidate["source_role"] == "repeated_header_footer"
        for candidate in header_candidates
    )

    assert fields["naics"]["selected"] == ["561720"]
    assert fields["set_aside"]["selected"] == ["total small business set-aside"]
    assert fields["contract_type"]["selected"] == ["firm-fixed-price"]
    assert fields["page_limits"]["selected"] == ["shall not exceed 25 pages"]
    assert fields["submission_methods"]["selected"] == ["email", "portal"]

    assert fields["questions_due"]["status"] == "resolved"
    assert fields["questions_due"]["selected"] == {
        "date": "2026-09-18",
        "time": "17:00:00",
        "timezone": "America/New_York",
        "timezone_abbreviation": "ET",
        "utc_offset": None,
        "raw": "September 18, 2026 at 5:00 PM ET",
    }

    proposal_due = fields["proposal_due"]
    assert proposal_due["status"] == "conflict"
    assert proposal_due["selected"] is None
    assert {candidate["value"]["date"] for candidate in proposal_due["candidates"]} == {
        "2026-10-15",
        "2026-10-16",
    }
    for candidate in proposal_due["candidates"]:
        assert candidate["quote"]
        assert candidate["provenance"]["block_ids"]
        assert len(candidate["provenance"]["bbox"]) == 4
        assert candidate["provenance"]["char_span"]


def test_same_input_and_configuration_are_deterministic(tmp_path):
    pdf_path = build_phase1_pdf(tmp_path / "phase1.pdf")

    first = json.dumps(extract(pdf_path).to_dict(), sort_keys=True)
    second = json.dumps(extract(pdf_path).to_dict(), sort_keys=True)

    assert first == second


def test_image_only_page_is_not_reported_as_empty_document(tmp_path):
    pdf_path = build_image_only_pdf(tmp_path / "scan.pdf")

    result = extract(pdf_path, ocr="never").to_dict()

    assert result["quality"]["status"] == "coverage_failure"
    assert result["quality"]["unreadable_pages"] == [0]
    assert "no_pages_with_usable_text" in result["quality"]["coverage_warnings"]
    assert result["pages"][0]["warnings"] == [
        "image_dominant_page",
        "ocr_required",
    ]
    assert all(
        field["status"] == "unknown"
        for field in result["administrative_fields"].values()
    )


def test_non_pdf_is_rejected(tmp_path):
    input_path = tmp_path / "not-a-pdf.pdf"
    input_path.write_text("not actually a PDF", encoding="utf-8")

    with pytest.raises(InvalidPdfError, match="PDF header"):
        extract(input_path)


def test_equivalent_deadline_formats_do_not_create_a_conflict(tmp_path):
    pdf_path = build_repeated_equivalent_deadline_pdf(tmp_path / "same-date.pdf")

    proposal_due = extract(pdf_path).to_dict()["administrative_fields"][
        "proposal_due"
    ]

    assert proposal_due["status"] == "resolved"
    assert proposal_due["selected"]["date"] == "2026-10-15"
    assert len(proposal_due["candidates"]) == 2
    assert any(
        "EDT" in candidate["quote"]
        for candidate in proposal_due["candidates"]
    )


def test_short_native_page_remains_usable(tmp_path):
    pdf_path = build_text_pdf(
        tmp_path / "short.pdf",
        ["Solicitation Number: ABC-123"],
    )

    result = extract(pdf_path).to_dict()

    assert result["quality"]["status"] == "ok"
    assert result["pages"][0]["extraction_mode"] == "native"
    assert result["administrative_fields"]["solicitation_number"]["selected"] == (
        "ABC-123"
    )


def test_adjacent_deadlines_in_one_block_are_classified_by_clause(tmp_path):
    pdf_path = build_same_block_deadlines_pdf(tmp_path / "deadlines.pdf")

    fields = extract(pdf_path).to_dict()["administrative_fields"]

    assert fields["questions_due"]["selected"]["date"] == "2026-09-18"
    assert fields["proposal_due"]["selected"]["date"] == "2026-10-15"
    assert fields["questions_due"]["status"] == "resolved"
    assert fields["proposal_due"]["status"] == "resolved"


def test_lowercase_semicolon_deadlines_are_classified_by_clause(tmp_path):
    pdf_path = build_text_pdf(
        tmp_path / "lowercase-deadlines.pdf",
        [
            (
                "Questions are due September 18, 2026; "
                "proposals are due October 15, 2026."
            )
        ],
    )

    fields = extract(pdf_path).to_dict()["administrative_fields"]

    assert fields["questions_due"]["selected"]["date"] == "2026-09-18"
    assert fields["proposal_due"]["selected"]["date"] == "2026-10-15"


def test_repeated_identifier_header_is_retained_as_fallback_evidence(tmp_path):
    pdf_path = build_repeated_identifier_header_pdf(tmp_path / "header.pdf")

    field = extract(pdf_path).to_dict()["administrative_fields"][
        "solicitation_number"
    ]

    assert field["status"] == "resolved"
    assert field["selected"] == "HEADER-2026-17"
    assert len(field["candidates"]) == 2
    assert all(
        candidate["source_role"] == "repeated_header_footer"
        for candidate in field["candidates"]
    )


def test_negated_submission_method_is_not_emitted(tmp_path):
    pdf_path = build_text_pdf(
        tmp_path / "negated.pdf",
        ["Offerors must not submit proposals via email."],
    )

    field = extract(pdf_path).to_dict()["administrative_fields"][
        "submission_methods"
    ]

    assert field["status"] == "absent"
    assert field["selected"] is None


def test_negated_method_does_not_hide_later_allowed_method(tmp_path):
    pdf_path = build_text_pdf(
        tmp_path / "mixed-methods.pdf",
        [
            (
                "Do not submit by email; "
                "submit through the OpenGov portal."
            )
        ],
    )

    field = extract(pdf_path).to_dict()["administrative_fields"][
        "submission_methods"
    ]

    assert field["status"] == "resolved"
    assert field["selected"] == ["portal"]


@pytest.mark.parametrize("negative", ["may not", "will not", "cannot"])
def test_common_submission_negations_are_respected(tmp_path, negative):
    pdf_path = build_text_pdf(
        tmp_path / f"negative-{negative.replace(' ', '-')}.pdf",
        [f"Offerors {negative} submit proposals via email."],
    )

    field = extract(pdf_path).to_dict()["administrative_fields"][
        "submission_methods"
    ]

    assert field["status"] == "absent"


def test_eight_a_set_aside_matches_before_punctuation(tmp_path):
    pdf_path = build_text_pdf(
        tmp_path / "eight-a.pdf",
        ["This acquisition is reserved for eligible 8(a) participants."],
    )

    field = extract(pdf_path).to_dict()["administrative_fields"]["set_aside"]

    assert field["status"] == "resolved"
    assert field["selected"] == ["8(a)"]


def test_adjacent_label_value_blocks_are_joined(tmp_path):
    pdf_path = build_adjacent_label_value_pdf(tmp_path / "table-like.pdf")

    fields = extract(pdf_path).to_dict()["administrative_fields"]

    assert fields["solicitation_number"]["selected"] == "ADJ-2026-004"
    assert fields["naics"]["selected"] == ["541512"]
    assert len(fields["solicitation_number"]["candidates"][0]["provenance"]["block_ids"]) == 2


def test_side_by_side_label_value_blocks_are_joined(tmp_path):
    pdf_path = build_side_by_side_label_value_pdf(tmp_path / "same-row.pdf")

    field = extract(pdf_path).to_dict()["administrative_fields"][
        "solicitation_number"
    ]

    assert field["selected"] == "SIDE-2026-9"


def test_date_only_and_more_specific_same_date_resolve(tmp_path):
    pdf_path = build_text_pdf(
        tmp_path / "specific-date.pdf",
        [
            "Proposals are due October 15, 2026.",
            "Proposal deadline: October 15, 2026 at 2:00 PM ET.",
        ],
    )

    field = extract(pdf_path).to_dict()["administrative_fields"]["proposal_due"]

    assert field["status"] == "resolved"
    assert field["selected"]["time"] == "14:00:00"


def test_explicit_est_and_edt_offsets_conflict(tmp_path):
    pdf_path = build_text_pdf(
        tmp_path / "offset-conflict.pdf",
        [
            "Proposals are due October 15, 2026 at 2:00 PM EST.",
            "Proposal deadline: October 15, 2026 at 2:00 PM EDT.",
        ],
    )

    field = extract(pdf_path).to_dict()["administrative_fields"]["proposal_due"]

    assert field["status"] == "conflict"
    assert {
        candidate["value"]["utc_offset"] for candidate in field["candidates"]
    } == {"-05:00", "-04:00"}


def test_pdf_header_may_follow_leading_bytes(tmp_path):
    original = build_text_pdf(tmp_path / "original.pdf", ["Valid PDF content"])
    prefixed = tmp_path / "prefixed.pdf"
    prefixed.write_bytes(b"\n" + original.read_bytes())

    result = extract(prefixed).to_dict()

    assert result["document"]["page_count"] == 1


def test_file_size_limit_is_enforced_before_parsing(tmp_path):
    pdf_path = build_text_pdf(tmp_path / "limited.pdf", ["Valid PDF content"])

    with pytest.raises(ResourceLimitError, match="bytes; limit"):
        extract(
            pdf_path,
            limits=ProcessingLimits(max_file_bytes=16),
        )


def test_wall_clock_limit_terminates_worker(tmp_path):
    pdf_path = build_text_pdf(tmp_path / "timeout.pdf", ["Valid PDF content"])

    with pytest.raises(ResourceLimitError, match="time limit"):
        extract(
            pdf_path,
            limits=ProcessingLimits(max_processing_seconds=0.000001),
        )


def test_decompressed_text_limit_is_enforced(tmp_path):
    pdf_path = build_text_pdf(
        tmp_path / "text-limit.pdf",
        ["Solicitation text that exceeds a deliberately tiny limit."],
    )

    with pytest.raises(ResourceLimitError, match="text limit"):
        extract(
            pdf_path,
            limits=ProcessingLimits(max_total_text_characters=8),
        )


def test_password_protected_pdf_is_rejected(tmp_path):
    pdf_path = build_encrypted_pdf(tmp_path / "encrypted.pdf")

    with pytest.raises(EncryptedPdfError):
        extract(pdf_path)


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="Tesseract unavailable")
def test_scanned_page_is_ocr_extracted(tmp_path):
    pdf_path = build_scanned_text_pdf(tmp_path / "scan-text.pdf")

    result = extract(pdf_path, ocr="auto").to_dict()

    assert result["quality"]["ocr_pages"] == 1
    assert result["administrative_fields"]["solicitation_number"]["selected"] == (
        "OCR-2026-88"
    )


def test_candidate_identity_is_document_scoped(tmp_path):
    first_path = build_text_pdf(
        tmp_path / "first.pdf",
        ["Solicitation Number: SAME-123"],
    )
    second_path = build_text_pdf(
        tmp_path / "second.pdf",
        ["Solicitation Number: SAME-123", "Different trailing content."],
    )

    first_candidate = extract(first_path).to_dict()["administrative_fields"][
        "solicitation_number"
    ]["candidates"][0]
    second_candidate = extract(second_path).to_dict()["administrative_fields"][
        "solicitation_number"
    ]["candidates"][0]

    assert first_candidate["candidate_id"] != second_candidate["candidate_id"]
