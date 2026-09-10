from __future__ import annotations

import multiprocessing
from pathlib import Path
from typing import Literal

from . import __version__
from .admin_fields import extract_administrative_fields
from .errors import EncryptedPdfError, InvalidPdfError, ResourceLimitError
from .ingest import ProcessingLimits, ingest_pdf
from .models import ExtractionResult


def _apply_process_limits(limits: ProcessingLimits) -> None:
    try:
        import resource
    except ImportError:
        return
    resource.setrlimit(
        resource.RLIMIT_AS,
        (limits.max_memory_bytes, limits.max_memory_bytes),
    )


def _extract_in_process(
    input_path: str | Path,
    *,
    ocr: Literal["never", "auto"],
    ocr_language: str,
    limits: ProcessingLimits,
) -> ExtractionResult:
    document, pages, quality, ingest_diagnostics = ingest_pdf(
        input_path,
        ocr_mode=ocr,
        ocr_language=ocr_language,
        limits=limits,
    )
    administrative_fields, field_diagnostics = extract_administrative_fields(
        pages,
        document_id=document["id"],
        coverage_complete=quality.status == "ok",
    )
    document["parser_version"] = __version__
    document["rule_set_version"] = field_diagnostics["rule_set_version"]

    return ExtractionResult(
        document=document,
        quality=quality,
        pages=pages,
        administrative_fields=administrative_fields,
        diagnostics={
            "ingest": ingest_diagnostics,
            "administrative_fields": field_diagnostics,
        },
    )


def _worker(
    connection,
    input_path: str,
    ocr: Literal["never", "auto"],
    ocr_language: str,
    limits: ProcessingLimits,
) -> None:
    try:
        _apply_process_limits(limits)
        result = _extract_in_process(
            input_path,
            ocr=ocr,
            ocr_language=ocr_language,
            limits=limits,
        )
        connection.send(("ok", result))
    except BaseException as exc:
        connection.send(("error", type(exc).__name__, str(exc)))
    finally:
        connection.close()


def extract(
    input_path: str | Path,
    *,
    ocr: Literal["never", "auto"] = "never",
    ocr_language: str = "eng",
    limits: ProcessingLimits | None = None,
) -> ExtractionResult:
    limits = limits or ProcessingLimits()
    methods = multiprocessing.get_all_start_methods()
    context = multiprocessing.get_context("fork" if "fork" in methods else "spawn")
    receive, send = context.Pipe(duplex=False)
    process = context.Process(
        target=_worker,
        args=(send, str(input_path), ocr, ocr_language, limits),
        daemon=True,
    )
    process.start()
    send.close()
    try:
        if not receive.poll(limits.max_processing_seconds):
            process.terminate()
            process.join(timeout=1)
            if process.is_alive():
                process.kill()
                process.join()
            raise ResourceLimitError("PDF processing time limit exceeded")
        try:
            outcome = receive.recv()
        except EOFError as exc:
            raise ResourceLimitError(
                "PDF worker exited before returning a result"
            ) from exc
    finally:
        receive.close()
        if process.is_alive():
            process.join(timeout=1)
        if process.is_alive():
            process.terminate()
            process.join(timeout=1)

    if outcome[0] == "ok":
        return outcome[1]
    _, error_name, message = outcome
    known_errors = {
        "EncryptedPdfError": EncryptedPdfError,
        "InvalidPdfError": InvalidPdfError,
        "ResourceLimitError": ResourceLimitError,
    }
    error_type = known_errors.get(error_name, RuntimeError)
    raise error_type(message)
