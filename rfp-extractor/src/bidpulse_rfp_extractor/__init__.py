"""Deterministic extraction for government solicitation PDFs."""

__version__ = "0.1.0"

from .pipeline import extract
from .ingest import ProcessingLimits

__all__ = ["ProcessingLimits", "extract"]
