class ExtractionError(Exception):
    """Base exception for deterministic extraction failures."""


class InvalidPdfError(ExtractionError):
    """Raised when an input is not a readable PDF."""


class EncryptedPdfError(ExtractionError):
    """Raised when a PDF requires a password."""


class ResourceLimitError(ExtractionError):
    """Raised when a PDF exceeds configured processing limits."""
