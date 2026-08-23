# ── Stage 1: Build ──────────────────────────────────────────────────────────
# Python 3.13 — matches the version this project's pinned requirements.txt
# was resolved and tested against; a different minor version can silently
# resolve different transitive dependency versions.
FROM python:3.13-slim AS builder

WORKDIR /app

# System deps: libgl1/libglib2.0-0 for OpenCV (camelot), ghostscript for
# camelot lattice mode, poppler-utils as the secondary PDF rasterizer
# fallback (pymupdf is primary and needs no system binary), tesseract-ocr
# for the pytesseract OCR fallback engine.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    ghostscript \
    poppler-utils \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies. requirements.txt already embeds the
# --extra-index-url for torch's CPU-only wheel, so a single install here
# covers everything with no separate/duplicate torch step.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Force the plain "paddle" inference backend instead of "mkldnn" — some
# PP-OCRv6-family models hit an unimplemented oneDNN/PIR attribute
# conversion on certain CPU builds (see extractor.py for the full story).
# Must be set before PaddleOCR/paddlex is imported anywhere, including here.
ENV PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT=False

# ── Pre-cache the sentence-transformers model at build time ─────────────────
# Avoids a first-request HuggingFace download delay.
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('all-MiniLM-L6-v2'); \
print('[Dockerfile] sentence-transformers model cached.')"

# ── Pre-cache PaddleOCR models at build time ─────────────────────────────────
# Imports extractor.py itself (rather than duplicating its PaddleOCR
# constructor call here) so the exact models cached always match what the
# running app actually uses — the two configs drifting apart previously
# left this step caching models the app never loads at runtime.
# llm_client.py is copied too since extractor.py imports it at module load.
COPY extractor.py llm_client.py ./
RUN python -c "\
import extractor; \
print('[Dockerfile] PaddleOCR models cached:', extractor.OCR_STATUS)"

# ── Pre-cache ChromaDB's default embedding model at build time ──────────────
# rag_engine.py's singleton seeds a ChromaDB collection on import, which
# triggers chromadb's default embedding function to download a ~79 MB ONNX
# model from S3 on first use. Left uncached, this happens on every fresh
# container's first request/import — observed taking 5+ minutes on a slow
# connection, which defeats a "one command run" experience entirely. Caches
# to /root/.cache/chroma/, under the same /root/.cache tree already copied
# to the runtime stage below for the HuggingFace model — no extra COPY needed.
COPY rag_engine.py sebi_icdr_corpus.py ./
RUN python -c "\
import rag_engine; \
print('[Dockerfile] ChromaDB embedding model cached.')"


# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.13-slim

WORKDIR /app

# Runtime system libs only (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    ghostscript \
    poppler-utils \
    tesseract-ocr \
    default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

ENV PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT=False
# Both models are already pre-cached at build time above; these flags stop
# huggingface_hub from making a network freshness-check on every container
# startup (harmless when online, but adds latency and a needless network
# dependency for what should be a fully offline-capable runtime).
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

# Copy installed Python packages from builder
COPY --from=builder /usr/local/lib/python3.13 /usr/local/lib/python3.13
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy pre-cached HuggingFace model
COPY --from=builder /root/.cache /root/.cache

# Copy pre-cached PaddleX/PaddleOCR models
COPY --from=builder /root/.paddlex /root/.paddlex

# Copy application source
COPY . .

# Pre-create every path the app writes runtime state to, so the named volumes
# mounted onto them in docker-compose.yml bind cleanly on first `up` instead
# of Docker creating an empty directory where one is expected, or the app
# hitting ENOENT on a directory that was never created. Without this,
# `docker compose down && up` silently wiped the demo user's entire
# in-progress session (state/session_state.json), audit trail
# (audit/*.jsonl), and the seeded ChromaDB corpus (chroma_db/) on every
# restart. state/ holds session_state.json inside a directory (not mounted
# as a volume directly onto the file itself) — some Docker builds fail to
# mount a named volume onto a single file path even when it's freshly
# created, so the volume targets this directory instead.
RUN mkdir -p temp_uploads audit chroma_db state && touch state/session_state.json

# Expose FastAPI port
EXPOSE 8000

# Health-check so Docker/Railway/Render knows when the app is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Start server (single worker; add --workers 2 if you have >= 2 GB RAM)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
