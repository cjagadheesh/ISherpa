<div align="center">

# IPO Sherpa
### SEBI SME IPO Draft Generator & Compliance Auditor

[![SEBI TechSprint](https://img.shields.io/badge/SEBI-TechSprint%202026-1a2e6b?style=for-the-badge)](https://www.sebi.gov.in)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Blockchain](https://img.shields.io/badge/Blockchain-Polygon%20Amoy-8247E5?style=for-the-badge)](https://polygon.technology)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://docker.com)
[![Tests](https://img.shields.io/badge/Tests-75%20Passing-brightgreen?style=for-the-badge)](./backend/tests)
[![License](https://img.shields.io/badge/License-MIT-gray?style=for-the-badge)](./LICENSE)

**Takes an Indian SME from "we are thinking about an IPO" to a disclosure-ready, banker-certified, blockchain-anchored Draft Prospectus — in hours, not months.**

</div>

---

> [!IMPORTANT]
> **Jury / Evaluator — Sample Documents for Testing**
>
> A curated set of sample statutory documents (Certificate of Incorporation, GST Registration, PAN, Restated Financials, Cap Table, and more) is available for testing the prototype end-to-end.
>
> **[Access Sample Document Folder on Google Drive](https://drive.google.com/drive/folders/1t95ZwBJa-GAXgzpivNXt_x9aPi-_VsgP?usp=sharing)**
>
> Upload these documents through the Document Vault to trigger OCR extraction, contradiction detection, hallucination guard, and prospectus generation. No account or API key required.

---

## Table of Contents

- [The Problem](#the-problem)
- [Why This Wins](#why-this-wins)
- [Platform Overview](#platform-overview)
- [System Architecture](#system-architecture)
- [Trust & Verification Layer](#trust--verification-layer)
- [AI & Document Intelligence](#ai--document-intelligence)
- [Compliance Engine](#compliance-engine)
- [AI/ML Feature Index A–Z](#aiml-feature-index-az)
- [Frontend](#frontend)
- [Security](#security)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Deployment Architecture](#deployment-architecture)
- [SEBI TechSprint Problem Statement Mapping](#sebi-techsprint-problem-statement-mapping)

---

## The Problem

India's **₹600 Billion SME IPO market** is bottlenecked by paperwork, not opportunity. A SEBI SME Draft Prospectus takes **4–6 months**, spans **10+ statutory documents**, and needs legal, financial, and merchant-banking expertise in parallel — before a single rupee is raised.

> Founders abandon viable IPOs. Regulators receive incomplete filings. Investors lose access to quality SME opportunities.

| Without IPO Sherpa | With IPO Sherpa |
|---|---|
| 4–6 months of drafting | Hours to a disclosure-ready draft |
| 10+ disconnected document workflows | One Document Vault, auto-extracted |
| Missed SEBI ICDR clauses found at filing | 55 live requirements tracked in real time |
| Hallucinated LLM content in legal documents | Digit-level hallucination guard on every number |
| No audit trail, no tamper-evidence | Blockchain-anchored, structurally-verified documents |
| Banker reviews happen in silos | Section-by-section certification workflow |

---

## Why This Wins

**Every claim below is backed by a passing test or a verifiable code path — not a slide.**

- **Real OCR, not just an LLM wrapper.** A 4-tier extraction pipeline (`pdfplumber` → `PaddleOCR` → `pytesseract` → regex) handles the scanned, photographed, and photocopied statutory documents that are the norm in Indian SME filings — not just clean text-layer PDFs. A 3-tier structured-table extractor (`camelot` stream → `camelot` lattice → `tabula`) prevents financial figures from being paired with the wrong row/column label.

- **Hallucinations are verified out, not prompted away.** Every LLM-drafted number is extracted, unit-normalized, and traced back to a real value already present in the session before it's allowed to reach a document. If a number can't be verified, it's flagged or the section falls back to a safe template — never silently trusted.

- **Two independent layers of tamper-evidence, not one.** Every document is SHA-256 hashed and anchored to a public Polygon Amoy smart contract — independently verifiable by anyone, not just this app's own database. Alongside that, a dependency-free structural forensics pass checks each PDF's own bytes for incremental-save markers, suspicious modification dates, and known editor-tool fingerprints — catching signs of *prior* tampering that an external hash anchor can't see, since it only proves nothing changed *after* upload.

- **Earnings quality, not just field validation.** Beyond 20+ statutory cross-document checks (name mismatches, date logic, capital-structure math), the engine flags the same signals a merchant banker's own sniff-test would: operating cash flow that doesn't back up reported profit, and trade receivables growing faster than revenue — real earnings-quality red flags, not just format validation.

- **The merchant banker's statutory role is architecturally un-bypassable.** No export endpoint, admin flag, or configuration switch skips section-by-section banker certification. This was a deliberate constraint, not an oversight — the platform accelerates the drafting stage, it does not replace the intermediary SEBI requires.

- **Resilient by design under real free-tier constraints.** The LLM layer pools multiple Groq keys in round-robin rotation (not just failover-on-error), so concurrent document extraction spreads across keys instead of serializing behind one rate limit. Blockchain sealing runs as a background task — a slow or failed testnet transaction can never block or break a document download.

- **75 automated tests, not a demo that only works once.** Isolated, deterministic, offline-runnable pytest coverage across every consistency check, the hallucination guard, the OCR forensics module, and the LLM key-pool's behavior under concurrency — verified with real concurrent-thread tests, not just single-call happy paths.

---

## Platform Overview

```
+---------------------------------------------------------------------------------+
|                            IPO SHERPA PLATFORM                                  |
|                                                                                 |
|  DOCUMENT VAULT              AI ENGINE               TRUST LAYER                |
|  ─────────────               ─────────               ──────────                 |
|  10 doc types accepted       PaddleOCR + LLM         Polygon Amoy anchoring     |
|  4-tier OCR pipeline         NLP red-flag scan        W3C Verifiable Credentials|
|  Table-aware extraction      Hallucination guard      Structural PDF forensics  |
|  W3C VC per document         RAG over ICDR corpus     Append-only audit log     |
|                                                                                 |
|  COMPLIANCE ENGINE           DRAFTING WIZARD          BANKER WORKFLOW           |
|  ─────────────               ─────────────────        ──────────────            |
|  55 SEBI ICDR requirements   107 fields, 21 sections  Per-section certification |
|  20+ contradiction checks    4 sector KPI templates   Export gate (no bypass)   |
|  Earnings-quality signals    Auto-fill from OCR       Due-diligence Form A      |
|  Automated circular alerts   AI risk-factor drafting  Peer comparison metrics   |
+---------------------------------------------------------------------------------+
```

---

## System Architecture

```
+--------------------------------------------------------------------------------+
|                    React 19 / Vite Frontend (frontend/)                         |
|  SplashScreen -> AuthScreen -> Dashboard <-> Uploader <-> Wizard (10 tabs)      |
|         <-> BankerDashboard <-> Copilot (AI chat) <-> AuditTrail               |
+-----------------------------------+--------------------------------------------+
                                    | REST (fetch, JWT bearer or demo user)
+-----------------------------------v--------------------------------------------+
|                    FastAPI Backend (backend/main.py) -- ~50 REST endpoints       |
|                                                                                  |
|  extractor.py           -- 10 doc types, pdfplumber / OCR / LLM, 3-tier tables  |
|  validator.py           -- completeness -> filing_readiness score                |
|  coverage.py            -- 55 SEBI ICDR requirements -> gap list                |
|  consistency_checker.py -- 20+ cross-document contradiction checks               |
|  financial_ratio_checker.py -- restated-financials ratio audit                  |
|  nlp_analyzer.py        -- semantic matching, NER, red flags, risk-factor draft  |
|  hallucination_guard.py -- verifies every LLM-drafted number is real            |
|  generator.py           -- Draft Abridged Prospectus DOCX (single source of truth)|
|  exporter.py            -- ZIP export bundle (reuses generator.py's DOCX)       |
|  certification.py       -- per-section banker sign-off, gates export            |
|  audit_log.py           -- append-only JSONL of every material action           |
|  blockchain.py          -- SHA-256 anchoring, Polygon Amoy, non-blocking seal   |
|  doc_forensics.py       -- structural PDF tamper signals, run at upload time    |
|  verifiable_credentials.py -- W3C DID/VC issuance per uploaded document         |
|  rag_engine.py          -- ChromaDB semantic search over ICDR corpus            |
|  sebi_circulars.py      -- live regulatory-change alert feed                    |
|  llm_client.py          -- provider-agnostic LLM abstraction, Groq key pool     |
|  due_diligence.py, peer_comparison.py, version_tracker.py, ps_mapping.py       |
+----------------------------------+---------------------------------------------+
                                   |
               +-------------------+---------------------+
               |                   |                     |
    +----------+---------+ +-------+-------+ +-----------+----------+
    |   ChromaDB          | |  Supabase     | |  Polygon Amoy        |
    | (ICDR vectors)      | |(session/auth) | |  (blockchain)        |
    +--------------------+  +---------------+ +----------------------+
```

### API Surface (~50 endpoints)

**Session & Schema** · `GET /api/schema` · `GET /api/session` · `POST /api/session` · `POST /api/session_sync` · `POST /api/session/reset`

**Documents** · `POST /api/upload` · `GET /api/jobs/{job_id}/status` · `GET /api/ocr_status` · `GET /api/credentials/{doc_type}`

**AI Assistance** · `POST /api/copilot` · `POST /api/draft` · `POST /api/generate-risk-factors` · `POST /api/rag/query`

**Validation & Compliance** · `GET /api/validate` · `POST /api/validate/hallucination` · `POST /api/validate/fix-suggestion` · `GET /api/coverage` · `GET /api/regulatory_alerts` · `GET /api/ps-mapping`

**NLP** · `POST /api/nlp/redflag` · `POST /api/nlp/analyze` · `POST /api/nlp/explain`

**Generation & Export** · `GET|POST /api/generate` · `GET /api/export/bundle`

**Banker Certification** · `POST /api/certification/{section_key}/review` · `POST /api/certification/{section_key}/certify` · `POST /api/certification/{section_key}/uncertify` · `GET /api/certification/status`

**Audit & Blockchain** · `GET /api/audit` · `GET /api/blockchain/status` · `GET /api/blockchain/trail` · `GET /api/blockchain/verify/document/{doc_hash}` · `GET /api/blockchain/verify/prospectus/{draft_hash}`

**Ancillary** · `GET /api/due_diligence` · `POST /api/peer_comparison` · `GET /api/version_tracker` · `POST /api/version_tracker/snapshot` · `POST /api/approvals` · `POST /api/dpi/digilocker/simulate` · `GET /api/market/stats` · `GET /health`

---

## Trust & Verification Layer

Every document, prospectus version, and audit snapshot gets **two independent, complementary integrity signals** — not one.

### 1. Blockchain Anchoring (`blockchain.py`)

A **Polygon Amoy (EVM-compatible testnet) smart contract** (`SEBIDocumentRegistry`) provides cryptographically verifiable tamper-evidence. No document content ever leaves your infrastructure — only SHA-256 digests go on-chain.

| Function | Trigger | On-Chain Data |
|---|---|---|
| `anchorDocument()` | Document upload | SHA-256(document bytes), timestamp, doc type |
| `sealProspectus()` | Prospectus generation | SHA-256(DOCX bytes), version number |
| `logAudit()` | Validation run | SHA-256(audit snapshot), checks run, checks passed |
| `verifyDocument()` | Public verification (permissionless) | Hash lookup, returns anchor timestamp |

```
                     +------------------------------------+
                     |   SEBIDocumentRegistry Contract    |
                     |   (Polygon Amoy Testnet -- EVM)    |
                     +----------------+-------------------+
                                      |
              +-----------------------+-----------------------+
              |                       |                       |
     anchorDocument()         sealProspectus()           logAudit()
     SHA-256(doc_bytes)       SHA-256(docx_bytes)        SHA-256(audit_log)
```

**Deterministic mock mode**: with no RPC endpoint or private key configured, blockchain calls return deterministic `[MOCK]`-prefixed responses — zero crashes, full functional parity for offline evaluation.

**Non-blocking sealing**: `sealProspectus()` is a live testnet transaction that can take up to ~90 seconds per attempt plus retry backoff on a congested RPC. `/api/generate` never waits on it — the DOCX is generated and returned immediately, sealing runs as a background task afterward. A slow or failed anchor attempt can never block or break a download.

Every uploaded document also receives a **W3C v1.1 JSON-LD Verifiable Credential**, issued by a DID anchored to Polygon Amoy:

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1", "https://schema.sebi.gov.in/credentials/v1"],
  "type": ["VerifiableCredential", "SEBIDocumentComplianceCredential"],
  "issuer": { "id": "did:polygon:amoy:0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
  "credentialSubject": { "document_type": "incorporation", "verification_status": "AUTHENTICATED", "doc_hash": "0x4f2a..." }
}
```

### 2. Structural Document Forensics (`doc_forensics.py`)

A second signal answering a question blockchain anchoring can't: not "did this change after upload" but "does this file's own history look right." Deterministic, dependency-free analysis of a PDF's raw bytes at upload time, before OCR/LLM processing ever touches it:

| Signal | What It Detects |
|---|---|
| Incremental-save count | Multiple `%%EOF` / `/Prev` xref entries — re-saved after first creation |
| Modification date after creation date | `/ModDate` later than `/CreationDate` in the PDF's own metadata |
| Editor/scanner tool fingerprint | `/Producer` / `/Creator` matching known PDF-editing or scanning tools |
| Thin/missing text layer | Little to no extractable text — a scan or flattened image |
| Digital signature presence | Positive signal, never penalised when absent |

Neither signal claims to prove forgery — both surface signs worth a human's attention before relying on a document's figures.

---

## AI & Document Intelligence

### Multi-Tier OCR Pipeline (`extractor.py`)

A **4-tier fallback chain** ensures maximum extraction coverage across real-world document quality:

```
Tier 1: pdfplumber (text-based PDF -- instant, zero OCR overhead)
   | (empty pages or scanned documents)
Tier 2: PaddleOCR (production-grade, CPU-only)
   | (fails or confidence too low)
Tier 3: pytesseract (Tesseract fallback)
   | (all OCR engines fail)
Tier 4: Regex / keyword rules -- returns null (never fabricated) + missing_fields[]
```

For **table-heavy documents** (financials, cap tables, litigation schedules), a 3-tier structured table extractor runs first: `camelot stream → camelot lattice (Ghostscript) → tabula (JRE) → raw text` — preventing numbers from being paired with the wrong row/column label.

| Document Type | Key Extracted Fields |
|---|---|
| Certificate of Incorporation | CIN, company name, incorporation date, registered office, company type |
| GST Registration | GSTIN, declared turnover, registration date, filing status |
| PAN / TAN Compliance | PAN number, PAN name, TAN |
| Restated Financial Statements | 3-year: equity, net worth, revenue, EBITDA, PAT, EPS, RoNW, NAV, borrowings, cash flows |
| MOA / AOA | Authorized capital, face value per share, main objects clause |
| Register of Members (Cap Table) | Pre-offer shareholding, promoter group, aggregate promoter % |
| DIR-12 / Board Resolutions | Directors (name / DIN / designation / independence), KMP |
| Litigation Schedule | Structured litigation summary |
| Industry Report (CRISIL / CARE / ICRA) | Market size, CAGR, report source |
| Sales / GST Register | Top-5 customer revenue table, key geographies |

### Retrieval-Augmented Generation (`rag_engine.py`)

The Copilot is a **regulation-grounded question-answering system**, not a generic LLM wrapper:

```
User Query -> all-MiniLM-L6-v2 embedding -> ChromaDB cosine similarity search
           -> top-K SEBI ICDR Chapter IX clauses -> LLM synthesis
           -> grounded answer with regulation_no, chapter, url, confidence
```

The vector store is seeded once at container startup and persists across restarts via a named volume — no re-indexing on every boot.

### NLP Pipeline (`nlp_analyzer.py`)

`sentence-transformers/all-MiniLM-L6-v2` (384-dim embeddings) powers semantic field matching, red-flag detection, and entity disambiguation — falling back to `difflib.SequenceMatcher` when PyTorch is unavailable, so functionality never depends on GPU access.

| Flag Category | Example Detection | Severity |
|---|---|---|
| Vague language | "market leader", "rapidly growing" without citation | HIGH |
| Generic boilerplate risk | Macro risks without company-specific impact figures | HIGH |
| Missing litigation declaration | No affirmative nil/pending litigation statement | MEDIUM |
| Unsubstantiated forward-looking claims | Revenue projections without stated basis | HIGH |
| Customer concentration risk | >30% revenue from single customer undisclosed | HIGH |

Every flag carries 4-step chain-of-thought reasoning with statutory citations. The LLM-backed scan is cached by content hash — an unrelated form edit elsewhere in the session never re-triggers it.

### Hallucination Guard (`hallucination_guard.py`)

Before any LLM-drafted narrative is accepted:

1. Extract every number the LLM generated
2. Normalize across unit conversions (Crore / Lakh / units, ±0.01% tolerance)
3. Verify each number traces back to a real value in the session fact store
4. Unverified → retry generation, or fall back to a safe template
5. Output includes `violations[]` and `clean_text` with `[UNVERIFIED: N]` markers

```python
guard = HallucinationGuard()
result = guard.verify(llm_text, session_data)
# result.passed = False, result.violations = ["47.3"]  -- if 47.3 wasn't actually in the session
```

### LLM Provider Layer (`llm_client.py`)

One abstraction over **4 providers** — Groq (default), OpenAI, Anthropic, Ollama (local/offline) — swapping is a `.env` change, zero code edits. Groq keys (`GROQ_API_KEY_2`, `_3`, ... or comma-separated `GROQ_API_KEYS`) form a **round-robin pool**: every call picks the next key in rotation, not just on failure, so concurrent document extraction spreads across keys instead of serializing behind one rate limit. A rate-limited call retries across the remaining pool before giving up — verified thread-safe under real concurrent load.

---

## Compliance Engine

### 55 Live SEBI ICDR Requirements (`coverage.py`)

Each clause-referenced requirement is tagged with a fill type so the UI can prompt correctly:

```python
{"id": "icdr_234_objects", "regulation": "SEBI ICDR Reg 234", "fill_type": "manual", "blocking": True}
```

| State | Meaning |
|---|---|
| Covered | Field populated from extraction or manual input |
| Needs Document | Upload the specified document to auto-populate |
| Needs Manual Input | Board / CA / legal decision required |
| Blocking | Cannot generate the prospectus until resolved |

### 20+ Cross-Document Contradiction Checks (`consistency_checker.py`)

| Check | Rule Citation |
|---|---|
| Company name across form / PAN / GST / MCA | SEBI ICDR Reg 230(1)(a) |
| GST turnover vs. P&L revenue (±15% tolerance) | SEBI ICDR Reg 244(1)(b) |
| GST registration predating incorporation | Companies Act S.7 + GST Act S.22 |
| Paid-up capital exceeds Authorized capital | Companies Act S.61 |
| SME post-issue capital exceeds ₹25 Crore | SEBI ICDR Reg 229(1) |
| Objects of issue total does not match issue size | SEBI ICDR Reg 234 |
| Price-band width exceeds 20% of floor | SEBI ICDR Reg 236 |
| Diluted EPS exceeds Basic EPS | Ind AS 33 |
| Top-5 customer % vs. narrative text | SEBI ICDR Schedule VI |
| Statutory auditor name mismatch | SEBI ICDR Reg 244 |
| WACA certificate date plausibility | SEBI ICDR Schedule VI |
| Litigation table vs. narrative text | SEBI ICDR Schedule VI Item 8 |
| **Operating cash flow weak relative to reported PAT** | Earnings-quality review practice |
| **Trade receivables growing faster than revenue** | Earnings-quality review practice |
| + 6 additional checks | |

The two bolded checks go beyond format validation into **earnings quality** — the same sniff-test a merchant banker applies before a DRHP is filed. Findings feed the Dashboard, `/api/validate/fix-suggestion`, and the exported ZIP's `contradiction_findings.json` — one engine, one source of truth across every surface.

### Financial Ratio Audit (`financial_ratio_checker.py`)

5 ratios recomputed from restated financials against sector benchmarks:

| Ratio | Manufacturing | NBFC | Services | Jewellery / Trading |
|---|---|---|---|---|
| PAT Margin | ≥5% | ≥10% | ≥8% | ≥3% |
| EBITDA Margin | ≥10% | — | ≥12% | ≥5% |
| Leverage (D/E) | ≤3x | ≤8x | ≤2x | ≤4x |
| Return on Equity | ≥10% | ≥12% | ≥15% | ≥8% |

### Automated Circular Monitoring (`sebi_circulars.py`)

```
SEBI Official Circular Feed -> Circular Parser -> Session Impact Analyzer -> RegulatoryAlertBanner
```

```
[HIGH] SEBI/HO/CFD/PoD-2/P/CIR/2026/014 -- Master Circular, SEBI ICDR Chapter IX
Impact: GST registration date vs MCA incorporation date requires statutory
        reconciliation under Companies Act S.7 & GST Act S.22
Action: Attach predecessor entity conversion certificate
```

Available via `GET /api/regulatory_alerts` — circular number, effective date, affected sections, session-specific impact, and a specific required action.

---

## AI/ML Feature Index A–Z

> Every feature below is production-implemented — not prototyped, not mocked.

**A — Abridged Prospectus Generation** (`generator.py`) · SEBI Schedule VI Part E `.docx` with section order, table styling, and border rules extracted from a real SEBI-filed OCXML. Missing fields render as `[MISSING: upload X]` or `[REQUIRES BANKER/LEGAL INPUT]` — never silently omitted.

**B — Blockchain Anchoring** (`blockchain.py`) · See [Trust & Verification Layer](#trust--verification-layer).

**C — Consistency Checker** (`consistency_checker.py`) · See [Compliance Engine](#compliance-engine).

**D — Document Vault** (`extractor.py`, `Uploader.jsx`) · 10 statutory document types, background extraction via `job_manager.py` — large scans never block the UI.

**E — Entity Extraction** (`nlp_analyzer.py`) · CIN, GSTIN, PAN/TAN, monetary amounts with unit disambiguation, promoter/KMP names, statutory dates.

**F — Financial Ratio Audit** (`financial_ratio_checker.py`) · See [Compliance Engine](#compliance-engine).

**G — Gap Scoring** (`coverage.py`) · 55 clause-referenced requirements, live radial gauge on the Dashboard.

**H — Hallucination Guard** (`hallucination_guard.py`) · See [AI & Document Intelligence](#ai--document-intelligence).

**I — Intelligent Auto-Fill Wizard** (`Wizard.jsx`, `schema.json`) · 107 fields across 21 sections, every field carrying a `source_hint`. Fields tagged `"manual"` are never auto-filled — they show an inline explanation instead. 4 sector-specific KPI templates.

**J — Job Manager** (`job_manager.py`) · Thread-safe background queue; upload returns instantly with a `job_id`, frontend polls `/api/jobs/{id}/status`.

**K — KPI Sector Templates** (`schema.json`) · Manufacturing (inventory days, capacity utilization) · NBFC (AUM, NIM, CRAR, NPA) · Jewellery & Trading (inventory turnover, gold tonnage) · Services (revenue/employee, ARR).

**L — LLM Provider Abstraction** (`llm_client.py`) · See [AI & Document Intelligence](#ai--document-intelligence).

**M — Multi-Tier OCR** (`extractor.py`) · See [AI & Document Intelligence](#ai--document-intelligence).

**N — NLP Red-Flag Scanner** (`nlp_analyzer.py`) · See [AI & Document Intelligence](#ai--document-intelligence).

**O — OCR Status Monitoring** (`/api/ocr_status`) · Per-document extraction tier used, confidence score, extracted field count, `missing_fields[]`.

**P — Peer Comparison Engine** (`peer_comparison.py`) · Schedule VI-compliant Basis-of-Issue-Price metrics (EPS, NAV, RoNW, P/E) against comparable listed peers, via `POST /api/peer_comparison`.

**Q — Filing Readiness Scoring** (`validator.py`) · `filing_readiness` (blocking fields only, capped at 80% while contradictions are open) and `overall_completeness` (all required fields) — two distinct, deliberately-different scores.

**R — RAG Engine** (`rag_engine.py`) · See [AI & Document Intelligence](#ai--document-intelligence).

**S — SEBI Circular Monitoring** (`sebi_circulars.py`) · See [Compliance Engine](#compliance-engine).

**T — Tamper-Evident Audit Trail** (`audit_log.py`) · Append-only JSONL per user — uploads, edits, validation runs, certification events, export/anchoring transactions. Included in every export bundle and itself anchored on-chain.

**U — Uploader UI** (`Uploader.jsx`) · Drag-and-drop, real-time job progress, extracted-field preview, W3C VC inspector, structural-forensics badges.

**V — Verifiable Credentials** (`verifiable_credentials.py`) · See [Trust & Verification Layer](#trust--verification-layer).

**W — 10-Tab Drafting Wizard** (`Wizard.jsx`, `schema.json`) · Cover Page · General Info · Board & Promoters · Capital Structure · Objects of Issue · Business Operations · Financials & KPIs · Risk Disclosures · Compliance · Declarations.

**X — Export Bundle** (`exporter.py`) · Reuses `generator.py`'s DOCX directly — one document builder, not two independently-maintained ones that could silently drift apart:

```
{Company}_Export_Bundle.zip
├── {Company}_Draft_Abridged_Prospectus.docx
├── coverage_report.json
├── contradiction_findings.json
└── audit_log.jsonl
```

Gated behind banker certification — no bypass, no configuration flag skips it.

**Y — Source Transparency** · Every field explains itself: *"Objects of the Issue is a business decision by your board — no document can substitute for this."* Zero silent failures, zero unexplained blanks.

**Z — Zero-Downtime Session Persistence** · Supabase mode: multi-user, real-time sync, JWT auth. Local mode: `session_state.json`, preserved across container restarts via named Docker volumes.

---

## Frontend

| Component | Description |
|---|---|
| `SplashScreen.jsx` | Animated boot sequence |
| `AuthScreen.jsx` | Supabase auth with demo-mode fallback |
| `Dashboard.jsx` | Filing readiness, contradiction list, section status |
| `Uploader.jsx` | Document Vault — drag-and-drop, live progress, VC inspector |
| `Wizard.jsx` | 10-tab drafting form |
| `Copilot.jsx` | Chat-style AI assistant with direct form-edit capability |
| `BankerDashboard.jsx` | Section-by-section certification workflow |
| `DueDiligenceManager.jsx` | Form A due-diligence certificate generation |
| `ComplianceScoreMeter.jsx` | Animated radial compliance gauge |
| `RegulatoryAlertBanner.jsx` | Live SEBI circular alerts |
| `AuditTrail.jsx` | Append-only audit log timeline |
| `JourneyProgress.jsx` | Always-visible, segmented filing-progress rail in the header |

**UX highlights**: zero-router SPA (`activeTab` string routing), optimistic UI, source badges on every auto-filled field, an AI Copilot that can apply its own fix suggestions directly, a red-to-green export-gate meter, and a progress rail that's genuinely always on screen — not buried in a collapsible sidebar.

---

## Security

| Layer | Implementation |
|---|---|
| Authentication | Supabase JWT bearer in production; zero-friction demo mode locally |
| Document storage | Local filesystem, per-user path isolation |
| Session isolation | Per-user `session_id` enforced on every API route |
| Blockchain verification | Permissionless public verification of any document hash |
| Audit immutability | Append-only JSONL — no delete or update endpoints exist |
| CORS | Configurable `CORS_ORIGINS`, restricted in production |
| LLM data privacy | Only extracted text snippets sent to LLM APIs — never raw documents |

Documents never leave your infrastructure — only SHA-256 hashes go on-chain. No telemetry, no analytics, no third-party tracking. Offline/airgapped deployment is fully supported via the rule-based extraction fallback.

---

## Project Structure

```
SEBI/
├── backend/
│   ├── main.py                    FastAPI app & all ~50 API routes
│   ├── schema.json                Field/section data model (21 sections, 107 fields)
│   ├── extractor.py               Document -> structured data (10 doc types, 4-tier OCR)
│   ├── generator.py               Draft Abridged Prospectus DOCX generator (single source of truth)
│   ├── exporter.py                ZIP export bundle -- reuses generator.py, no duplicate builder
│   ├── validator.py               Completeness / filing-readiness scoring
│   ├── coverage.py                55 named SEBI ICDR requirements + gap engine
│   ├── consistency_checker.py     20+ cross-field/cross-document contradiction checks
│   ├── financial_ratio_checker.py 5 ratio audit with sector benchmarks
│   ├── hallucination_guard.py     Digit-level LLM fact verification
│   ├── nlp_analyzer.py            Semantic matching, NER, risk-factor drafting
│   ├── llm_client.py              Provider-agnostic LLM abstraction, Groq key-pool round-robin
│   ├── doc_forensics.py           Structural PDF tamper signals at upload time
│   ├── rag_engine.py              ChromaDB-backed SEBI ICDR semantic search
│   ├── sebi_icdr_corpus.py        Curated SEBI ICDR Chapter IX regulation corpus
│   ├── sebi_circulars.py          Live regulatory alert feed
│   ├── certification.py           Banker sign-off workflow / export gate
│   ├── audit_log.py               Append-only JSONL audit trail
│   ├── blockchain.py              Polygon Amoy SHA-256 anchoring (live + mock), non-blocking seal
│   ├── verifiable_credentials.py  W3C v1.1 JSON-LD VC issuance
│   ├── due_diligence.py           Form A due-diligence certificate generator
│   ├── peer_comparison.py         Dynamic peer valuation / accounting comparison
│   ├── version_tracker.py         Prospectus revision snapshots & diffs
│   ├── job_manager.py             Thread-safe background extraction job queue
│   ├── ps_mapping.py              SEBI TechSprint problem-statement clause mapping
│   ├── tests/                     pytest suite (75 tests)
│   └── Dockerfile                 Multi-stage build; models pre-downloaded at build time
├── frontend/
│   ├── src/
│   │   ├── App.jsx                Top-level state, routing, session sync
│   │   ├── components/            Wizard, Uploader, Dashboard, Copilot, BankerDashboard, JourneyProgress, ...
│   │   ├── api.js, config.js, supabase.js
│   │   └── data/icdrRegulations.js
│   ├── Dockerfile                 Multi-stage: Vite build -> nginx:alpine SPA server
│   └── nginx.conf                 SPA fallback routing
├── contracts/                     Solidity SEBIDocumentRegistry smart contract
├── draft/                         Reference SEBI-filed abridged prospectus samples
├── docker-compose.yml
├── .env.example                   Environment variable reference with inline documentation
└── DEMO_SCRIPT.md                 10-minute hackathon judge demo walkthrough
```

---

## Testing

**75 tests**, isolated and deterministic — run offline, no network or live API keys required.

| Module | What Is Tested |
|---|---|
| `certification.py` | Section sign-off, export gating, uncertify flows |
| `consistency_checker.py` | All 20+ contradiction check scenarios, including the earnings-quality signals |
| `coverage.py` | 55-requirement scoring, gap classification |
| `doc_forensics.py` | Structural PDF signals on real generated PDFs and crafted byte fixtures |
| `hallucination_guard.py` | Number extraction, unit normalization, violation detection |
| `llm_client.py` | Groq key-pool round-robin, rate-limit retry, thread-safety under concurrent calls |
| `nlp_analyzer.py` | Semantic similarity, red-flag detection, entity extraction, narrative-scan caching |
| `validator.py` | Completeness scoring, filing-readiness capping logic |

---

## Deployment Architecture

**Backend** (`backend/Dockerfile`) — multi-stage build on `python:3.13-slim`. All heavy models (PaddleOCR, `all-MiniLM-L6-v2`, ChromaDB's embedding model) are downloaded at *build* time, not on first request — zero first-request latency, fully offline-capable from the first container start. Named volumes separate ML model weights (survive rebuilds) from runtime state (session, uploads, audit log, vector store).

**Frontend** (`frontend/Dockerfile`) — multi-stage: Vite build in `node:20-alpine`, served by `nginx:alpine` with SPA fallback routing. `VITE_API_URL`/`VITE_SUPABASE_*` are baked into the JS bundle at build time.

**Scaling path** — session state, when Supabase is configured, lives entirely outside the FastAPI process, so the backend is stateless by design: any number of API instances can sit behind a load balancer and share the same ChromaDB vector store and Polygon Amoy contract without coordination. Local-JSON mode (the zero-config default) trades that horizontal scalability for zero external dependencies — the right default for offline evaluation, not for production fleet deployment.

---

## SEBI TechSprint Problem Statement Mapping

Live mapping available at `/api/ps-mapping` at runtime.

| PS Clause | Mandate | Implementation | Status |
|---|---|---|---|
| PS-1 | Document digitization & OCR | 4-tier OCR pipeline (PaddleOCR + pytesseract) | Full |
| PS-2 | Automated data extraction | 10 doc types, LLM + regex + table extraction | Full |
| PS-3 | Compliance gap identification | 55 SEBI ICDR requirements, live gap score | Full |
| PS-4 | Cross-document contradiction detection | 20+ cross-checks, fix suggestions | Full |
| PS-5 | AI-assisted narrative drafting | LLM drafting + hallucination guard | Full |
| PS-6 | Hallucination prevention | Digit-level verification against fact store | Full |
| PS-7 | CA/legal sign-off workflows | `source_hint: "manual"` + inline notes per field | Partial* |
| PS-8 | Merchant banker certification | Section-by-section gate, export blocked until certified | Full |
| PS-9 | Audit trail & tamper-evidence | Append-only JSONL + Polygon blockchain anchoring + structural PDF forensics | Full |
| PS-10 | DigiLocker integration | Simulation endpoint (`/api/dpi/digilocker/simulate`) | Simulated* |
| PS-11 | Regulatory circular monitoring | Live SEBI feed + session-specific impact analysis | Full |
| PS-12 | Investor-protection NLP | Red-flag scanner, vague language detection, readability | Full |
| PS-13 | Peer comparison & valuation | Schedule VI Basis-of-Issue-Price metrics via `/api/peer_comparison` | Full |

*PS-7: CA certificate content requires a licensed CA — correctly refused to auto-fill, with a clear explanation why.
*PS-10: Live DigiLocker API requires government-issued credentials — simulation demonstrates the integration flow accurately.

---

<div align="center">

### Statutory Role of SEBI Intermediaries

IPO Sherpa is not a substitute for a SEBI-registered Category I Merchant Banker. It **accelerates** the drafting stage that precedes banker review, **de-risks** that stage by catching 20+ contradiction classes before review begins, and **preserves** the intermediary role — no document leaves the platform without explicit, section-by-section banker certification. There is no API endpoint, no admin override, and no configuration flag that bypasses it.

*Built for SEBI TechSprint 2026 — Making Indian Capital Markets More Accessible, Transparent, and Trustworthy.*

</div>
