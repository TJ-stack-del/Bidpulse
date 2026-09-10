from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from importlib.resources import files
from typing import Any, Iterable

from .models import Candidate, FieldResult, PageRecord, Provenance, TextBlock
from .text import normalize_for_match, normalize_text


DATE_RE = re.compile(
    r"\b(?P<date>"
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|"
    r"Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|"
    r"Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}"
    r"|"
    r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"
    r")"
    r"(?:\s*(?:at|,)?\s*"
    r"(?P<time>\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)))?"
    r"(?:\s*(?P<timezone>ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT|UTC|GMT))?"
    r"\b",
    re.I,
)

DEADLINE_ANCHOR_RE = re.compile(
    r"\b(due|deadline|closing|received|receipt|submit|submission|"
    r"questions?|inquiries|pre[- ]bid|site visit|offers?|proposals?|bids?|responses?)\b",
    re.I,
)

DATE_FORMATS = (
    "%B %d %Y",
    "%b %d %Y",
    "%m/%d/%Y",
    "%m/%d/%y",
    "%m-%d-%Y",
    "%m-%d-%y",
)

TIMEZONE_MAP = {
    "ET": "America/New_York",
    "EST": "America/New_York",
    "EDT": "America/New_York",
    "CT": "America/Chicago",
    "CST": "America/Chicago",
    "CDT": "America/Chicago",
    "MT": "America/Denver",
    "MST": "America/Denver",
    "MDT": "America/Denver",
    "PT": "America/Los_Angeles",
    "PST": "America/Los_Angeles",
    "PDT": "America/Los_Angeles",
    "UTC": "UTC",
    "GMT": "UTC",
}

TIMEZONE_OFFSETS = {
    "EST": "-05:00",
    "EDT": "-04:00",
    "CST": "-06:00",
    "CDT": "-05:00",
    "MST": "-07:00",
    "MDT": "-06:00",
    "PST": "-08:00",
    "PDT": "-07:00",
    "UTC": "+00:00",
    "GMT": "+00:00",
}

NEGATED_SUBMISSION_RE = re.compile(
    r"\b(?:must|shall|should|do|may|will|can)\s+not\b|\bcannot\b|"
    r"\bprohibited\s+from\b|"
    r"\bnot\s+permitted\s+to\b",
    re.I,
)

CANONICAL_VALUES = {
    "set_aside": {
        "8(a)": "8(a)",
        "hubzone": "HUBZone",
        "sdvosb": "SDVOSB",
        "wosb": "WOSB",
        "edwosb": "EDWOSB",
        "dbe": "DBE",
        "dbe/sdb": "DBE/SDB",
        "jseb": "JSEB",
    },
    "contract_type": {
        "firm fixed price": "firm-fixed-price",
        "firm-fixed-price": "firm-fixed-price",
        "fixed price": "fixed-price",
        "fixed-price": "fixed-price",
        "time and materials": "time-and-materials",
        "t&m": "time-and-materials",
        "idiq": "IDIQ",
        "indefinite-delivery/indefinite-quantity": "IDIQ",
        "indefinite delivery": "indefinite-delivery",
        "requirements contract": "requirements-contract",
    },
}


def _load_rule_config() -> tuple[dict[str, Any], str]:
    rule_path = files("bidpulse_rfp_extractor").joinpath("rules/admin_fields.json")
    content = rule_path.read_bytes()
    return json.loads(content), hashlib.sha256(content).hexdigest()


def _candidate_id(
    document_id: str,
    field: str,
    rule_id: str,
    block_id: str,
    start: int,
    normalized_value: str,
) -> str:
    raw = (
        f"{document_id}|{field}|{rule_id}|{block_id}|{start}|{normalized_value}"
    ).encode()
    return "cand-" + hashlib.sha1(raw).hexdigest()[:16]


def _quote(text: str, start: int, end: int, radius: int = 140) -> str:
    left = max(0, start - radius)
    right = min(len(text), end + radius)
    return normalize_text(text[left:right])


def _provenance(
    page: PageRecord,
    blocks: list[TextBlock],
    char_span: list[int] | None,
) -> Provenance:
    bbox = [
        min(block.bbox[0] for block in blocks),
        min(block.bbox[1] for block in blocks),
        max(block.bbox[2] for block in blocks),
        max(block.bbox[3] for block in blocks),
    ]
    return Provenance(
        page_index=page.page_index,
        printed_page_label=page.printed_page_label,
        block_ids=[block.block_id for block in blocks],
        bbox=[round(value, 3) for value in bbox],
        char_span=char_span,
    )


def _canonicalize(field: str, value: str, rule_id: str) -> Any:
    clean = normalize_text(value)
    folded = clean.casefold()
    if field == "solicitation_number":
        return clean.upper()
    if field == "naics":
        return re.sub(r"\D", "", clean)
    if field == "submission_methods":
        return rule_id.rsplit(".", 1)[-1]
    for source, canonical in CANONICAL_VALUES.get(field, {}).items():
        if folded == source:
            return canonical
    return clean


def _normalize_value(value: Any) -> str:
    if isinstance(value, str):
        return normalize_for_match(value)
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _iter_blocks(pages: Iterable[PageRecord]) -> Iterable[tuple[PageRecord, TextBlock]]:
    for page in pages:
        if page.extraction_mode == "unreadable":
            continue
        for block in page.blocks:
            yield page, block


def _extract_configured_candidates(
    pages: list[PageRecord],
    config: dict[str, Any],
    document_id: str,
) -> tuple[list[Candidate], dict[str, str]]:
    candidates: list[Candidate] = []
    cardinalities: dict[str, str] = {}
    for rule in config["fields"]:
        field = str(rule["field"])
        rule_id = str(rule["id"])
        cardinalities[field] = str(rule["cardinality"])
        pattern = re.compile(str(rule["pattern"]), re.I | re.S)
        for page, block in _iter_blocks(pages):
            for match in pattern.finditer(block.text):
                if field == "submission_methods":
                    clause, _ = _clause_for_offset(block.text, match.start())
                    if NEGATED_SUBMISSION_RE.search(clause):
                        continue
                value = _canonicalize(field, match.group("value"), rule_id)
                normalized = _normalize_value(value)
                candidates.append(
                    Candidate(
                        candidate_id=_candidate_id(
                            document_id,
                            field,
                            rule_id,
                            block.block_id,
                            match.start(),
                            normalized,
                        ),
                        field=field,
                        value=value,
                        normalized_value=normalized,
                        quote=_quote(block.text, match.start(), match.end()),
                        provenance=_provenance(
                            page,
                            [block],
                            [match.start(), match.end()],
                        ),
                        rule_id=rule_id,
                        score=int(rule["score"]) - (2 if block.is_header_footer else 0),
                        source_role=(
                            "repeated_header_footer"
                            if block.is_header_footer
                            else "body"
                        ),
                    )
                )
    candidates.extend(_extract_adjacent_label_candidates(pages, document_id))
    return candidates, cardinalities


def _extract_adjacent_label_candidates(
    pages: list[PageRecord],
    document_id: str,
) -> list[Candidate]:
    patterns = (
        (
            "solicitation_number",
            "solicitation_number.adjacent_block",
            re.compile(r"^\s*(?:solicitation|rfp|rfq|ifb|bid)\s*(?:number|no\.?|#)\s*:?\s*$", re.I),
            re.compile(r"^\s*(?P<value>[A-Z0-9][A-Z0-9._\-/]{2,39})\s*$", re.I),
            7,
        ),
        (
            "naics",
            "naics.adjacent_block",
            re.compile(r"^\s*NAICS(?:\s+(?:code|number))?\s*:?\s*$", re.I),
            re.compile(r"^\s*(?P<value>\d{6})\s*$"),
            8,
        ),
    )
    candidates: list[Candidate] = []
    for page in pages:
        if page.extraction_mode == "unreadable":
            continue
        ordered = sorted(page.blocks, key=lambda block: block.reading_order)
        for label, value_block in zip(ordered, ordered[1:]):
            vertical_gap = value_block.bbox[1] - label.bbox[3]
            label_center_y = (label.bbox[1] + label.bbox[3]) / 2
            value_center_y = (value_block.bbox[1] + value_block.bbox[3]) / 2
            same_row = (
                abs(label_center_y - value_center_y)
                <= max(label.bbox[3] - label.bbox[1], value_block.bbox[3] - value_block.bbox[1])
                and value_block.bbox[0] >= label.bbox[0]
            )
            directly_below = -2 <= vertical_gap <= 50
            if not (same_row or directly_below):
                continue
            for field, rule_id, label_pattern, value_pattern, score in patterns:
                if not label_pattern.fullmatch(label.text):
                    continue
                match = value_pattern.fullmatch(value_block.text)
                if match is None:
                    continue
                value = _canonicalize(field, match.group("value"), rule_id)
                normalized = _normalize_value(value)
                is_header = label.is_header_footer or value_block.is_header_footer
                candidates.append(
                    Candidate(
                        candidate_id=_candidate_id(
                            document_id,
                            field,
                            rule_id,
                            f"{label.block_id}+{value_block.block_id}",
                            0,
                            normalized,
                        ),
                        field=field,
                        value=value,
                        normalized_value=normalized,
                        quote=normalize_text(f"{label.text} {value_block.text}"),
                        provenance=_provenance(
                            page,
                            [label, value_block],
                            None,
                        ),
                        rule_id=rule_id,
                        score=score - (2 if is_header else 0),
                        source_role=(
                            "repeated_header_footer" if is_header else "body"
                        ),
                    )
                )
    return candidates


def _event_type(context: str) -> str | None:
    folded = normalize_for_match(context)
    if re.search(r"\b(question|questions|inquir(?:y|ies))\b", folded):
        return "questions_due"
    if re.search(r"\b(pre[- ]bid|site visit|walkthrough|preproposal)\b", folded):
        return "site_visit"
    if re.search(
        r"\b(proposal|offer|bid|response|submission)s?\b", folded
    ) and re.search(r"\b(due|deadline|closing|received|receipt|submit)\b", folded):
        return "proposal_due"
    if re.search(r"\b(due|deadline|closing|received|receipt)\b", folded):
        return "other_deadline"
    return None


def _clause_for_offset(text: str, offset: int) -> tuple[str, int]:
    clause_start = 0
    for boundary in re.finditer(r"[;!?\n]|[.](?=\s|$)", text):
        if (
            boundary.group() == "."
            and text[max(0, boundary.start() - 3) : boundary.end()].casefold()
            in {"a.m.", "p.m."}
        ):
            continue
        next_start = boundary.end()
        while next_start < len(text) and text[next_start].isspace():
            next_start += 1
        if boundary.start() >= offset:
            return text[clause_start : boundary.start()], clause_start
        clause_start = next_start
    return text[clause_start:], clause_start


def _parse_date(raw: str) -> str | None:
    value = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", raw, flags=re.I)
    value = value.replace(",", "")
    for date_format in DATE_FORMATS:
        try:
            return datetime.strptime(value, date_format).date().isoformat()
        except ValueError:
            continue
    return None


def _parse_time(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.casefold().replace(".", "").replace(" ", "")
    for time_format in ("%I:%M%p", "%I%p"):
        try:
            return datetime.strptime(value, time_format).time().isoformat()
        except ValueError:
            continue
    return None


def _extract_deadline_candidates(
    pages: list[PageRecord],
    document_id: str,
) -> list[Candidate]:
    candidates: list[Candidate] = []
    for page, block in _iter_blocks(pages):
        for match in DATE_RE.finditer(block.text):
            context, _ = _clause_for_offset(block.text, match.start())
            if not DEADLINE_ANCHOR_RE.search(context):
                continue
            event_type = _event_type(context)
            parsed_date = _parse_date(match.group("date"))
            if event_type is None or parsed_date is None:
                continue
            raw_timezone = match.group("timezone")
            timezone_abbreviation = raw_timezone.upper() if raw_timezone else None
            value = {
                "date": parsed_date,
                "time": _parse_time(match.group("time")),
                "timezone": (
                    TIMEZONE_MAP.get(timezone_abbreviation)
                    if timezone_abbreviation
                    else None
                ),
                "timezone_abbreviation": timezone_abbreviation,
                "utc_offset": (
                    TIMEZONE_OFFSETS.get(timezone_abbreviation)
                    if timezone_abbreviation
                    else None
                ),
                "raw": normalize_text(match.group(0)),
            }
            normalized = _normalize_value(
                {
                    "date": value["date"],
                    "time": value["time"],
                    "timezone": value["timezone"],
                    "utc_offset": value["utc_offset"],
                }
            )
            rule_id = f"deadline.{event_type}"
            candidates.append(
                Candidate(
                    candidate_id=_candidate_id(
                        document_id,
                        event_type,
                        rule_id,
                        block.block_id,
                        match.start(),
                        normalized,
                    ),
                    field=event_type,
                    value=value,
                    normalized_value=normalized,
                    quote=normalize_text(context),
                    provenance=_provenance(
                        page,
                        [block],
                        [match.start(), match.end()],
                    ),
                    rule_id=rule_id,
                    score=(8 if event_type != "other_deadline" else 5)
                    - (2 if block.is_header_footer else 0),
                    source_role=(
                        "repeated_header_footer"
                        if block.is_header_footer
                        else "body"
                    ),
                )
            )
    return candidates


def _preferred_candidates(candidates: list[Candidate]) -> list[Candidate]:
    body = [candidate for candidate in candidates if candidate.source_role == "body"]
    return body or candidates


def _reconcile(
    candidates: list[Candidate],
    cardinality: str,
    coverage_complete: bool,
) -> FieldResult:
    preferred = _preferred_candidates(candidates)
    unique_values: dict[str, Any] = {}
    for candidate in preferred:
        unique_values.setdefault(candidate.normalized_value, candidate.value)

    if not candidates:
        return FieldResult(
            status="absent" if coverage_complete else "unknown",
            selected=None,
            candidates=[],
        )
    if cardinality == "many":
        return FieldResult(
            status="resolved",
            selected=list(unique_values.values()),
            candidates=candidates,
        )
    if len(unique_values) == 1:
        return FieldResult(
            status="resolved",
            selected=next(iter(unique_values.values())),
            candidates=candidates,
        )
    return FieldResult(status="conflict", selected=None, candidates=candidates)


def _reconcile_deadline(
    candidates: list[Candidate],
    coverage_complete: bool,
) -> FieldResult:
    if not candidates:
        return FieldResult(
            status="absent" if coverage_complete else "unknown",
            selected=None,
            candidates=[],
        )
    preferred = _preferred_candidates(candidates)
    dates = {candidate.value["date"] for candidate in preferred}
    times = {
        candidate.value["time"]
        for candidate in preferred
        if candidate.value["time"] is not None
    }
    offsets = {
        candidate.value["utc_offset"]
        for candidate in preferred
        if candidate.value["utc_offset"] is not None
    }
    zones = {
        candidate.value["timezone"]
        for candidate in preferred
        if candidate.value["timezone"] is not None
    }
    if len(dates) > 1 or len(times) > 1 or len(offsets) > 1 or len(zones) > 1:
        return FieldResult(status="conflict", selected=None, candidates=candidates)

    def specificity(candidate: Candidate) -> tuple[int, int]:
        value = candidate.value
        detail_count = sum(
            value[key] is not None
            for key in ("time", "timezone", "utc_offset")
        )
        return detail_count, candidate.score

    selected = max(preferred, key=specificity).value
    return FieldResult(
        status="resolved",
        selected=selected,
        candidates=candidates,
    )


def extract_administrative_fields(
    pages: list[PageRecord],
    *,
    document_id: str,
    coverage_complete: bool,
) -> tuple[dict[str, FieldResult], dict[str, Any]]:
    config, rule_set_sha256 = _load_rule_config()
    configured, cardinalities = _extract_configured_candidates(
        pages,
        config,
        document_id,
    )
    deadlines = _extract_deadline_candidates(pages, document_id)
    all_candidates = configured + deadlines

    for deadline_field in (
        "proposal_due",
        "questions_due",
        "site_visit",
        "other_deadline",
    ):
        cardinalities[deadline_field] = "single"

    results: dict[str, FieldResult] = {}
    for field in sorted(cardinalities):
        field_candidates = [
            candidate for candidate in all_candidates if candidate.field == field
        ]
        if field.endswith("_due") or field in {"site_visit", "other_deadline"}:
            results[field] = _reconcile_deadline(
                field_candidates,
                coverage_complete,
            )
        else:
            results[field] = _reconcile(
                field_candidates,
                cardinalities[field],
                coverage_complete,
            )

    diagnostics = {
        "rule_set_version": config["version"],
        "rule_set_sha256": rule_set_sha256,
        "candidate_count": len(all_candidates),
        "candidate_counts_by_field": {
            field: len(result.candidates) for field, result in results.items()
        },
        "conflicting_fields": [
            field for field, result in results.items() if result.status == "conflict"
        ],
    }
    return results, diagnostics
