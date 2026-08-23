"""
blockchain.py — SEBI SME IPO Document Anchoring Service
========================================================
Provides SHA-256 hashing and Polygon (Amoy Testnet) blockchain anchoring
for uploaded compliance documents, generated draft prospectuses, and
compliance audit log snapshots.

Architecture
------------
  Off-chain : Documents stay in local storage (or are deleted after extraction)
  On-chain  : Only SHA-256 hashes are sent to the SEBIDocumentRegistry contract

Modes
-----
  LIVE mode : web3 installed + POLYGON_RPC_URL + BLOCKCHAIN_PRIVATE_KEY set in .env
  MOCK mode : Any of the above missing → graceful fallback, no crash, logs prefix [MOCK]

Environment Variables (.env)
-----------------------------
  POLYGON_RPC_URL            = https://rpc-amoy.polygon.technology  (or Alchemy/Infura)
  BLOCKCHAIN_PRIVATE_KEY     = 0x<your_test_wallet_private_key>
  BLOCKCHAIN_CONTRACT_ADDRESS= 0x<deployed_SEBIDocumentRegistry_address>
  BLOCKCHAIN_SESSION_ID      = sebi-ipo-session-v1   (optional, default used if missing)
"""

import os
import json
import hashlib
import logging
import time
from typing import Dict, Any, Optional

logger = logging.getLogger("sebi-ipo-generator.blockchain")

# ── ABI for SEBIDocumentRegistry (only the functions we call) ────────────────
CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_docHash",   "type": "bytes32"},
            {"internalType": "string",  "name": "_docType",   "type": "string"},
            {"internalType": "string",  "name": "_sessionId", "type": "string"},
        ],
        "name": "anchorDocument",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_draftHash",   "type": "bytes32"},
            {"internalType": "string",  "name": "_sessionId",   "type": "string"},
            {"internalType": "string",  "name": "_companyName", "type": "string"},
        ],
        "name": "sealProspectus",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "string",  "name": "_sessionId",    "type": "string"},
            {"internalType": "bytes32", "name": "_snapshotHash", "type": "bytes32"},
            {"internalType": "uint8",   "name": "_checksRun",    "type": "uint8"},
            {"internalType": "uint8",   "name": "_checksPassed", "type": "uint8"},
        ],
        "name": "logAudit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_docHash", "type": "bytes32"}],
        "name": "verifyDocument",
        "outputs": [
            {"internalType": "bool",    "name": "exists",     "type": "bool"},
            {"internalType": "uint256", "name": "anchoredAt", "type": "uint256"},
            {"internalType": "string",  "name": "docType",    "type": "string"},
            {"internalType": "string",  "name": "sessionId",  "type": "string"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_draftHash", "type": "bytes32"}],
        "name": "verifyProspectus",
        "outputs": [
            {"internalType": "bool",    "name": "exists",      "type": "bool"},
            {"internalType": "uint256", "name": "sealedAt",    "type": "uint256"},
            {"internalType": "string",  "name": "companyName", "type": "string"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "totalDocuments",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ── web3 import with graceful fallback ───────────────────────────────────────
try:
    from web3 import Web3
    WEB3_AVAILABLE = True
except ImportError:
    WEB3_AVAILABLE = False
    logger.warning(
        "web3 package not installed. Blockchain anchoring running in MOCK mode. "
        "Install with: pip install web3"
    )


# ── Configuration ─────────────────────────────────────────────────────────────

def _mask_key(key: str) -> str:
    """Mask private key for safe logging (e.g. 0x****...1234)."""
    if not key or len(key) < 10:
        return "[UNCONFIGURED_OR_EMPTY_KEY]"
    return key[:4] + "****************" + key[-4:]


def _get_config() -> Dict[str, str]:
    """Read blockchain config from environment variables safely."""
    raw_pk = os.getenv("BLOCKCHAIN_PRIVATE_KEY", "").strip()
    return {
        "rpc_url":          os.getenv("POLYGON_RPC_URL", "").strip(),
        "private_key":      raw_pk,
        "masked_key":       _mask_key(raw_pk),
        "contract_address": os.getenv("BLOCKCHAIN_CONTRACT_ADDRESS", "").strip(),
        "session_id":       os.getenv("BLOCKCHAIN_SESSION_ID", "sebi-ipo-session-v1").strip(),
        "network_name":     os.getenv("BLOCKCHAIN_NETWORK", "Polygon Amoy Testnet").strip(),
        "explorer_base":    os.getenv("BLOCKCHAIN_EXPLORER", "https://amoy.polygonscan.com/tx/").strip(),
    }


def _is_mock() -> bool:
    """Returns True if any critical config is missing → mock mode."""
    if not WEB3_AVAILABLE:
        return True
    cfg = _get_config()
    missing = [k for k in ("rpc_url", "private_key", "contract_address") if not cfg[k]]
    if missing:
        logger.debug(f"Blockchain MOCK mode active. Missing env vars: {missing}")
        return True
    return False


# ── Hashing utilities ─────────────────────────────────────────────────────────

def compute_sha256_file(file_path: str) -> str:
    """
    Compute SHA-256 of a file on disk.
    Returns hex string like '0xabc123...' (66 chars total).
    """
    sha256 = hashlib.sha256()
    try:
        with open(file_path, "rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                sha256.update(chunk)
        return "0x" + sha256.hexdigest()
    except Exception as e:
        logger.error(f"SHA-256 hashing failed for {file_path}: {e}")
        raise


def compute_sha256_bytes(data: bytes) -> str:
    """
    Compute SHA-256 of in-memory bytes (e.g. a generated .docx read into memory).
    Returns hex string like '0xabc123...'.
    """
    return "0x" + hashlib.sha256(data).hexdigest()


def compute_sha256_dict(data: Dict) -> str:
    """
    Compute SHA-256 of a Python dict serialised as canonical JSON.
    Used to snapshot session_state.json for the audit log.
    """
    canonical = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return "0x" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _hex_to_bytes32(hex_hash: str) -> bytes:
    """Convert '0x<64-char hex>' → 32-byte value for the Solidity bytes32 param."""
    clean = hex_hash.removeprefix("0x")
    if len(clean) != 64:
        raise ValueError(f"Expected 64-char hex, got {len(clean)}: {hex_hash!r}")
    return bytes.fromhex(clean)


# ── Internal: build web3 connection ──────────────────────────────────────────

def _get_web3_and_contract():
    """
    Returns (w3, contract, account) tuple if LIVE mode, raises RuntimeError in MOCK.
    """
    cfg = _get_config()
    w3 = Web3(Web3.HTTPProvider(cfg["rpc_url"]))
    if not w3.is_connected():
        raise RuntimeError(f"Cannot connect to RPC: {cfg['rpc_url']}")

    account = w3.eth.account.from_key(cfg["private_key"])
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(cfg["contract_address"]),
        abi=CONTRACT_ABI,
    )
    return w3, contract, account


# ── Dynamic gas pricing ───────────────────────────────────────────────────────
# Gas limit and gas price are both derived from live network conditions at
# send time rather than fixed constants — a hardcoded gas limit sized for a
# short company name will underflow on a longer one, and a hardcoded (or
# unbuffered) gas price can leave a transaction stuck as "underpriced" during
# network congestion.

GAS_LIMIT_BUFFER_PCT = 0.10  # +10% safety margin over the raw eth_estimateGas result
GAS_PRICE_BUFFER_PCT = 0.10  # +10% over the network's current suggested gas price
# Both trimmed down from 25%/20% — the wallet funding this contract runs on a
# thin, manually-topped-up testnet MATIC balance, so the combined 1.5x markup
# over raw cost (now 1.21x) was burning through it faster than it needed to.
# Polygon Amoy's gas price is stable enough day-to-day that 10% is still a
# safe cushion against being underpriced between quote time and inclusion.

# Used only if eth_estimateGas itself fails (e.g. RPC hiccup) — a conservative
# ceiling, not the per-call gas actually used, which is now estimated live.
_FALLBACK_GAS_LIMIT = {
    "anchorDocument": 150_000,
    "sealProspectus": 180_000,
    "logAudit": 130_000,
}


def _estimate_gas_limit(fn_call, from_address: str, fn_name: str) -> int:
    """Estimates gas for a specific contract call and adds a safety margin.

    Calling eth_estimateGas per-transaction (instead of one fixed limit for
    every call) means gas scales correctly with actual input size — e.g.
    sealProspectus with a long company_name string costs more gas than one
    with a short name, and a static limit sized for the short case would
    revert as "out of gas" on the long one.
    """
    try:
        raw_estimate = fn_call.estimate_gas({"from": from_address})
        return int(raw_estimate * (1 + GAS_LIMIT_BUFFER_PCT))
    except Exception as e:
        fallback = _FALLBACK_GAS_LIMIT.get(fn_name, 150_000)
        logger.warning(
            f"eth_estimateGas failed for {fn_name} ({e}); using fallback ceiling {fallback}."
        )
        return fallback


def _dynamic_gas_price(w3) -> int:
    """Returns the network's current suggested gas price plus a buffer.

    Polygon gas prices fluctuate with network load; querying eth_gasPrice at
    send time (instead of a fixed value) tracks real conditions, and the
    buffer absorbs the gap between quote time and block inclusion so
    transactions don't get stuck as underpriced.
    """
    base = w3.eth.gas_price
    return int(base * (1 + GAS_PRICE_BUFFER_PCT))


# ── Transient RPC error retry ─────────────────────────────────────────────────
# Public RPC endpoints (the free tier used for Polygon Amoy) intermittently
# return 429 (rate limited), 5xx, or drop the connection under load — none of
# these mean the transaction itself is invalid. Retrying the whole build→sign→
# send→confirm sequence (with a fresh connection, nonce, and gas quote each
# attempt) can turn a transient RPC hiccup into a brief delay instead of a
# permanently unanchored document — but blockchain anchoring is a best-effort
# side-feature on top of the core upload/extraction flow (already wrapped in
# try/except by callers), not something worth making a user wait on. Default
# is a single attempt with no retry; raise BLOCKCHAIN_MAX_RETRIES in .env if
# you're on a more reliable (e.g. paid) RPC endpoint and want retries back.
MAX_TX_RETRIES = max(1, int(os.getenv("BLOCKCHAIN_MAX_RETRIES", "1")))
RETRY_BACKOFF_BASE_SECONDS = float(os.getenv("BLOCKCHAIN_RETRY_BACKOFF_SECONDS", "2"))

_TRANSIENT_ERROR_MARKERS = (
    "429", "too many requests",
    "500", "internal server error",
    "502", "bad gateway",
    "503", "service unavailable",
    "504", "gateway timeout",
    "timed out", "timeout",
    "connection", "cannot connect to rpc",
    "econnreset", "connection reset",
)


def _is_transient_rpc_error(exc: Exception) -> bool:
    """Heuristic: retry on rate-limit/connectivity/server errors, not on
    definitive on-chain rejections (e.g. insufficient funds, reverted call)."""
    return any(marker in str(exc).lower() for marker in _TRANSIENT_ERROR_MARKERS)


def _build_sign_send_wait(build_fn_call, cfg: Dict[str, str], fn_name: str):
    """
    Builds, signs, sends, and confirms a contract transaction, retrying the
    entire sequence on transient RPC errors with exponential backoff.

    Args:
        build_fn_call : callable(contract) -> bound ContractFunction to invoke
                        (e.g. lambda contract: contract.functions.anchorDocument(...))
        cfg           : config dict from _get_config() (needs 'private_key')
        fn_name       : contract function name, used for gas fallback lookup + logging

    Returns (w3, tx_hex, receipt). Raises the last exception if every attempt
    fails or a non-transient error occurs.

    Note: a fresh nonce and gas quote are fetched on every retry since network
    state may have advanced between attempts. If a receipt-wait specifically
    times out after the transaction was already broadcast, a retry sends a
    second, independent transaction rather than re-checking the first — an
    accepted tradeoff for this anchoring use case (idempotent-in-effect: the
    contract just records another anchor of the same hash) over the added
    complexity of tracking in-flight tx hashes across retries.
    """
    last_exc: Optional[Exception] = None
    for attempt in range(1, MAX_TX_RETRIES + 1):
        try:
            w3, contract, account = _get_web3_and_contract()
            fn_call = build_fn_call(contract)
            tx = fn_call.build_transaction({
                "from":     account.address,
                "nonce":    w3.eth.get_transaction_count(account.address),
                "gas":      _estimate_gas_limit(fn_call, account.address, fn_name),
                "gasPrice": _dynamic_gas_price(w3),
            })
            signed  = w3.eth.account.sign_transaction(tx, cfg["private_key"])
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=90)
            return w3, w3.to_hex(tx_hash), receipt
        except Exception as e:
            last_exc = e
            if attempt < MAX_TX_RETRIES and _is_transient_rpc_error(e):
                wait_s = RETRY_BACKOFF_BASE_SECONDS ** attempt
                logger.warning(
                    f"{fn_name} attempt {attempt}/{MAX_TX_RETRIES} hit a transient RPC "
                    f"error ({e}); retrying in {wait_s}s..."
                )
                time.sleep(wait_s)
                continue
            raise
    raise last_exc  # pragma: no cover — loop always returns or raises above


# ── Public API ────────────────────────────────────────────────────────────────

def anchor_document_hash(
    doc_hash: str,
    doc_type: str,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Anchor a document SHA-256 hash on the Polygon blockchain.

    Args:
        doc_hash   : '0x' + 64-char hex SHA-256 of the document file
        doc_type   : 'financials' | 'gst' | 'incorporation' | 'compliance'
        session_id : optional override for session identifier

    Returns dict with keys:
        status       : 'success' | 'mock' | 'error'
        tx_hash      : Polygon transaction hash (or mock placeholder)
        explorer_url : PolygonScan URL for the transaction
        doc_hash     : echo of input hash
        mode         : 'live' | 'mock'
    """
    cfg = _get_config()
    sid = session_id or cfg["session_id"]

    if _is_mock():
        mock_tx = "0x" + ("ab" * 32)
        logger.info(f"[MOCK] Document anchored: type={doc_type} hash={doc_hash[:18]}...")
        return {
            "status": "mock",
            "tx_hash": mock_tx,
            "block_number": None,
            "explorer_url": f"{cfg['explorer_base']}{mock_tx}",
            "doc_hash": doc_hash,
            "doc_type": doc_type,
            "mode": "mock",
            "network": cfg["network_name"],
        }

    try:
        hash_bytes = _hex_to_bytes32(doc_hash)
        w3, tx_hex, receipt = _build_sign_send_wait(
            lambda contract: contract.functions.anchorDocument(hash_bytes, doc_type, sid),
            cfg, "anchorDocument",
        )
        logger.info(
            f"[LIVE] Document anchored on {cfg['network_name']} | "
            f"type={doc_type} | block={receipt.blockNumber} | tx={tx_hex[:18]}..."
        )
        return {
            "status": "success",
            "tx_hash": tx_hex,
            "block_number": receipt.blockNumber,
            "explorer_url": f"{cfg['explorer_base']}{tx_hex}",
            "doc_hash": doc_hash,
            "doc_type": doc_type,
            "mode": "live",
            "network": cfg["network_name"],
        }

    except Exception as e:
        logger.error(f"Blockchain anchoring FAILED for {doc_type}: {e}")
        return {
            "status": "error",
            "error": str(e),
            "doc_hash": doc_hash,
            "doc_type": doc_type,
            "mode": "live",
        }


def seal_prospectus(
    draft_hash: str,
    company_name: str,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Seal a generated Draft Prospectus (.docx) hash on the blockchain.

    Args:
        draft_hash   : '0x' + 64-char hex SHA-256 of the .docx bytes
        company_name : Company name (for on-chain event readability)
        session_id   : optional override

    Returns same shape as anchor_document_hash().
    """
    cfg = _get_config()
    sid = session_id or cfg["session_id"]

    if _is_mock():
        mock_tx = "0x" + ("cd" * 32)
        logger.info(f"[MOCK] Prospectus sealed: company={company_name} hash={draft_hash[:18]}...")
        return {
            "status": "mock",
            "tx_hash": mock_tx,
            "block_number": None,
            "explorer_url": f"{cfg['explorer_base']}{mock_tx}",
            "draft_hash": draft_hash,
            "company_name": company_name,
            "mode": "mock",
            "network": cfg["network_name"],
        }

    try:
        hash_bytes = _hex_to_bytes32(draft_hash)
        w3, tx_hex, receipt = _build_sign_send_wait(
            lambda contract: contract.functions.sealProspectus(hash_bytes, sid, company_name),
            cfg, "sealProspectus",
        )
        logger.info(
            f"[LIVE] Prospectus sealed on {cfg['network_name']} | "
            f"company={company_name} | block={receipt.blockNumber} | tx={tx_hex[:18]}..."
        )
        return {
            "status": "success",
            "tx_hash": tx_hex,
            "block_number": receipt.blockNumber,
            "explorer_url": f"{cfg['explorer_base']}{tx_hex}",
            "draft_hash": draft_hash,
            "company_name": company_name,
            "mode": "live",
            "network": cfg["network_name"],
        }

    except Exception as e:
        logger.error(f"Prospectus sealing FAILED for {company_name}: {e}")
        return {
            "status": "error",
            "error": str(e),
            "draft_hash": draft_hash,
            "company_name": company_name,
            "mode": "live",
        }


def log_audit_snapshot(
    session_snapshot: Dict,
    checks_run: int,
    checks_passed: int,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Log an immutable compliance audit snapshot to the blockchain.

    Args:
        session_snapshot : dict of current session data (will be hashed, not stored on-chain)
        checks_run       : total number of ICDR checks executed
        checks_passed    : number of checks that passed without flags
        session_id       : optional override

    Returns same shape as anchor_document_hash().
    """
    cfg   = _get_config()
    sid   = session_id or cfg["session_id"]
    snap_hash = compute_sha256_dict(session_snapshot)

    if _is_mock():
        mock_tx = "0x" + ("ef" * 32)
        logger.info(
            f"[MOCK] Audit logged: checks={checks_run} passed={checks_passed} "
            f"snapshot={snap_hash[:18]}..."
        )
        return {
            "status": "mock",
            "tx_hash": mock_tx,
            "snapshot_hash": snap_hash,
            "checks_run": checks_run,
            "checks_passed": checks_passed,
            "mode": "mock",
            "network": cfg["network_name"],
        }

    try:
        hash_bytes = _hex_to_bytes32(snap_hash)
        w3, tx_hex, receipt = _build_sign_send_wait(
            lambda contract: contract.functions.logAudit(sid, hash_bytes, checks_run, checks_passed),
            cfg, "logAudit",
        )
        logger.info(
            f"[LIVE] Audit logged on {cfg['network_name']} | "
            f"checks={checks_run}/{checks_passed} | block={receipt.blockNumber}"
        )
        return {
            "status": "success",
            "tx_hash": tx_hex,
            "snapshot_hash": snap_hash,
            "checks_run": checks_run,
            "checks_passed": checks_passed,
            "mode": "live",
            "network": cfg["network_name"],
        }

    except Exception as e:
        logger.error(f"Audit log FAILED: {e}")
        return {
            "status": "error",
            "error": str(e),
            "snapshot_hash": snap_hash,
            "mode": "live",
        }


def verify_document_hash(doc_hash: str) -> Dict[str, Any]:
    """
    Query the blockchain to verify whether a document hash was previously anchored.

    Returns dict with:
        exists       : bool
        anchored_at  : ISO timestamp string or None
        doc_type     : str
        session_id   : str
        mode         : 'live' | 'mock'
    """
    if _is_mock():
        return {
            "exists": False,
            "anchored_at": None,
            "doc_type": None,
            "session_id": None,
            "mode": "mock",
            "note": "Blockchain in mock mode — configure .env to enable live verification",
        }

    try:
        import datetime
        w3, contract, _ = _get_web3_and_contract()
        hash_bytes = _hex_to_bytes32(doc_hash)
        exists, anchored_at_ts, doc_type, session_id = contract.functions.verifyDocument(hash_bytes).call()

        anchored_iso = (
            datetime.datetime.utcfromtimestamp(anchored_at_ts).isoformat() + "Z"
            if anchored_at_ts > 0 else None
        )
        return {
            "exists": exists,
            "anchored_at": anchored_iso,
            "doc_type": doc_type,
            "session_id": session_id,
            "mode": "live",
        }
    except Exception as e:
        logger.error(f"Verification query failed: {e}")
        return {"exists": False, "error": str(e), "mode": "live"}


def verify_prospectus_hash(draft_hash: str) -> Dict[str, Any]:
    """
    Query the blockchain to verify whether a prospectus hash was previously sealed.
    """
    if _is_mock():
        return {
            "exists": False,
            "sealed_at": None,
            "company_name": None,
            "mode": "mock",
            "note": "Blockchain in mock mode — configure .env to enable live verification",
        }

    try:
        import datetime
        w3, contract, _ = _get_web3_and_contract()
        hash_bytes = _hex_to_bytes32(draft_hash)
        exists, sealed_at_ts, company_name = contract.functions.verifyProspectus(hash_bytes).call()

        sealed_iso = (
            datetime.datetime.utcfromtimestamp(sealed_at_ts).isoformat() + "Z"
            if sealed_at_ts > 0 else None
        )
        return {
            "exists": exists,
            "sealed_at": sealed_iso,
            "company_name": company_name,
            "mode": "live",
        }
    except Exception as e:
        logger.error(f"Prospectus verification query failed: {e}")
        return {"exists": False, "error": str(e), "mode": "live"}


def get_blockchain_status() -> Dict[str, Any]:
    """
    Returns connectivity status, wallet address, and MATIC balance.
    Safe to call on startup for a health-check endpoint.
    """
    cfg = _get_config()

    if not WEB3_AVAILABLE:
        return {
            "mode": "mock",
            "reason": "web3 package not installed (pip install web3)",
            "network": cfg["network_name"],
            "connected": False,
            "contract_configured": False,
        }

    missing = [k for k in ("rpc_url", "private_key", "contract_address") if not cfg[k]]
    if missing:
        return {
            "mode": "mock",
            "reason": f"Missing .env vars: {missing}",
            "network": cfg["network_name"],
            "connected": False,
            "contract_configured": False,
        }

    try:
        w3 = Web3(Web3.HTTPProvider(cfg["rpc_url"]))
        if not w3.is_connected():
            return {
                "mode": "live_error",
                "reason": f"Cannot reach RPC: {cfg['rpc_url']}",
                "connected": False,
                "contract_configured": True,
            }

        account = w3.eth.account.from_key(cfg["private_key"])
        balance_wei = w3.eth.get_balance(account.address)
        balance_matic = float(Web3.from_wei(balance_wei, "ether"))

        contract = w3.eth.contract(
            address=Web3.to_checksum_address(cfg["contract_address"]),
            abi=CONTRACT_ABI,
        )
        total_docs = contract.functions.totalDocuments().call()

        return {
            "mode": "live",
            "network": cfg["network_name"],
            "connected": True,
            "contract_configured": True,
            "contract_address": cfg["contract_address"],
            "wallet_address": account.address,
            "wallet_balance_matic": round(balance_matic, 6),
            "total_anchored_documents": total_docs,
            "explorer_base": cfg["explorer_base"],
        }

    except Exception as e:
        return {
            "mode": "live_error",
            "reason": str(e),
            "connected": False,
            "contract_configured": bool(cfg["contract_address"]),
        }
