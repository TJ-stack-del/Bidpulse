from __future__ import annotations

import re
import unicodedata


WHITESPACE_RE = re.compile(r"\s+")


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = value.replace("\u00ad", "")
    return WHITESPACE_RE.sub(" ", value).strip()


def normalize_for_match(value: str) -> str:
    return normalize_text(value).casefold()


def normalize_repeated_line(value: str) -> str:
    value = normalize_for_match(value)
    value = re.sub(r"\bpage\s+\d+(?:\s+of\s+\d+)?\b", "page #", value)
    value = re.sub(r"\b\d+\b", "#", value)
    return value

