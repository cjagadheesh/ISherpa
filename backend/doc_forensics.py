"""
doc_forensics.py — Document-structural integrity signals
==========================================================
Deterministic, dependency-free structural checks on a PDF's raw bytes, run
at upload time (main.py's /api/upload) alongside the existing SHA-256 hash
and blockchain anchor (blockchain.py's compute_sha256_file/anchor_document_hash).

This is a *complement* to blockchain anchoring, not a replacement for it.
The blockchain anchor proves the uploaded file's exact byte-for-byte state
hasn't changed *since the moment it was uploaded* — independently
verifiable by anyone via the public Polygon Amoy explorer, not just this
app's own database. These structural signals answer a different question:
whether the file itself shows signs of having been *edited by some tool
before* it was ever uploaded here — something an external hash anchor
can't tell you, since it can only vouch for the file going forward, not
its history before it arrived. Together: cryptographic proof of state at
upload, plus a heads-up on what that state's own structure suggests.

None of this proves forgery and it never claims to — it surfaces signs
worth a human's attention, same spirit as this app's conflict-flagging
elsewhere: point at what to check, don't accuse.
"""

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger("sebi-ipo-generator.doc_forensics")

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

# Known desktop/online PDF editing & scanning tools. A statutory financial
# document routed through one of these after its original creation is worth
# a second look before its figures are relied on.
_EDITOR_TOOL_MARKERS = (
    "ilovepdf", "smallpdf", "sejda", "pdfescape", "pdf24", "pdffiller",
    "soda pdf", "nitro", "foxit phantom", "pdf candy", "lightpdf",
    "camscanner", "adobe acrobat pro",
)

# Minimum extracted characters per page below which a PDF is treated as a
# scan/flattened image rather than a real text layer.
_THIN_TEXT_LAYER_CHARS_PER_PAGE = 40


def _pdf_string_field(raw: str, key: str) -> Optional[str]:
    m = re.search(rf"/{key}\s*\(([^)]{{0,120}})\)", raw)
    if not m:
        return None
    return m.group(1).replace(r"\(", "(").replace(r"\)", ")").strip()


def _pdf_date_field(raw: str, key: str) -> Optional[str]:
    m = re.search(rf"/{key}\s*\(D:(\d{{8}})", raw)
    return m.group(1) if m else None  # YYYYMMDD


def _fmt_pdf_date(d: str) -> str:
    return f"{d[0:4]}-{d[4:6]}-{d[6:8]}"


def analyze_document_forensics(file_path: str) -> Dict[str, Any]:
    """Structural integrity scan of a document at `file_path`. Never raises —
    any failure degrades to an inapplicable/neutral result, so a forensics
    bug can never block a real upload.

    Returns:
        applicable: False for non-PDF files or on any read failure.
        score: 0-100.
        level: "clean" | "review" | "flag" | "na".
        signals: list of {label, level, detail} dicts.
        summary: one-line human-readable summary.
    """
    def _na(reason: str) -> Dict[str, Any]:
        return {"applicable": False, "score": 100, "level": "na", "signals": [], "summary": reason}

    if not file_path.lower().endswith(".pdf"):
        return _na("Structural forensics apply to PDF files only.")

    try:
        with open(file_path, "rb") as f:
            raw_bytes = f.read()
    except Exception as e:
        logger.warning(f"doc_forensics: could not read {file_path}: {e}")
        return _na("Could not read file for structural analysis.")

    if not raw_bytes.startswith(b"%PDF-"):
        return _na("Not a PDF file.")

    raw = raw_bytes.decode("latin1", errors="ignore")
    signals: List[Dict[str, str]] = []

    def add(label: str, level: str, detail: str) -> None:
        signals.append({"label": label, "level": level, "detail": detail})

    # 1. Incremental saves: a clean, single-save PDF has exactly one %%EOF and
    # no /Prev cross-reference entry. More than one means the file was
    # re-saved (edited) after its first creation.
    eof_count = raw.count("%%EOF")
    prev_count = len(re.findall(r"/Prev\s+\d+", raw))
    if eof_count > 1 or prev_count > 0:
        add(
            "Edited after creation",
            "flag",
            f"This PDF carries {max(eof_count, prev_count + 1)} save generation(s) — it was modified after "
            "it was first created. Where possible, obtain the original single-save file.",
        )

    # 2. Modification date after creation date.
    created = _pdf_date_field(raw, "CreationDate")
    modified = _pdf_date_field(raw, "ModDate")
    if created and modified and modified > created:
        add(
            "Modified after creation date",
            "review",
            f"Created {_fmt_pdf_date(created)}, last modified {_fmt_pdf_date(modified)}. "
            "Common in legitimate workflows, but worth confirming for a statutory document.",
        )

    # 3. Producer/Creator tool fingerprint.
    tool = " / ".join(t for t in (_pdf_string_field(raw, "Producer"), _pdf_string_field(raw, "Creator")) if t)
    if tool and any(marker in tool.lower() for marker in _EDITOR_TOOL_MARKERS):
        add(
            "Processed by a PDF-editing/scanning tool",
            "flag",
            f'Metadata shows "{tool}". Source statutory documents (certificates, financials) should arrive '
            "directly from the issuing authority rather than through a third-party editor first.",
        )

    # 4. Thin/missing text layer. A quick pdfplumber pass only (no OCR) — kept
    # independent of extractor.py's own OCR-fallback decision so this module
    # has no coupling to that pipeline's internals; the extra text-extraction
    # pass is cheap (plain text, not OCR inference) relative to what OCR would
    # cost anyway if the caller's own extraction later needs it.
    if pdfplumber is not None:
        try:
            with pdfplumber.open(file_path) as pdf:
                page_count = len(pdf.pages)
                if page_count > 0:
                    text_len = sum(len(page.extract_text() or "") for page in pdf.pages)
                    chars_per_page = text_len / page_count
                    if chars_per_page < _THIN_TEXT_LAYER_CHARS_PER_PAGE:
                        add(
                            "No machine-readable text layer",
                            "review",
                            "This document is a scan or flattened image with little to no extractable text, "
                            "so its figures can't be cross-checked against a text source and edits are harder to detect.",
                        )
        except Exception as e:
            logger.debug(f"doc_forensics: text-layer check skipped for {file_path}: {e}")

    # 5. Digital signature — a positive signal, never penalised when absent.
    if "/ByteRange" in raw or "adobe.ppklite" in raw.lower():
        add("Carries a digital signature", "info", "This document is digitally signed, which strengthens its authenticity.")

    deduction = sum(35 if s["level"] == "flag" else 15 if s["level"] == "review" else 0 for s in signals)
    score = max(0, 100 - deduction)
    level = "clean" if score >= 85 else "review" if score >= 60 else "flag"
    flag_count = sum(1 for s in signals if s["level"] == "flag")
    review_count = sum(1 for s in signals if s["level"] == "review")
    if level == "clean":
        summary = "No structural signs of editing — this looks like a single, unedited original."
    elif flag_count:
        summary = f"{flag_count} structural sign(s) of post-creation editing — worth verifying against the original source."
    else:
        summary = f"{review_count} item(s) worth a quick check before relying on this document's figures."

    return {"applicable": True, "score": score, "level": level, "signals": signals, "summary": summary}
