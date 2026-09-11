"""Deterministic extraction for government solicitation PDFs."""

__version__ = "0.1.0"

from .pipeline import extract
from .ingest import ProcessingLimits
from .phase2_pipeline import run as segment_sections

__all__ = ["ProcessingLimits", "extract", "segment_sections"]
