"""
llm_client.py — Unified LLM Provider Abstraction for IPO Sherpa
==================================================================
Wraps Groq, OpenAI, Anthropic, and local Ollama behind one interface so the
active LLM provider is a config change (LLM_PROVIDER env var), not a code
change scattered across every module that calls an LLM.

Provider selection (.env):
    LLM_PROVIDER = groq | openai | anthropic | ollama   (default: groq)
    LLM_MODEL    = optional override; each provider has a sensible default

Per-provider credentials:
    groq      -> GROQ_API_KEY (+ optional GROQ_API_KEY_2, _3, ... for a pool — see below)
    openai    -> OPENAI_API_KEY
    anthropic -> ANTHROPIC_API_KEY
    ollama    -> OLLAMA_BASE_URL (default http://localhost:11434/v1); no key needed

Groq key pool:
    Set GROQ_API_KEY_2, GROQ_API_KEY_3, ... (or a comma-separated
    GROQ_API_KEYS) to add more keys to the pool. Each complete() call picks
    the next key round-robin (not just on failure), so concurrent calls —
    e.g. uploading several documents at once, each extracted in its own
    background job — spread across keys instead of serializing behind one.
    A call that still hits a rate limit retries on the remaining keys in the
    pool before giving up. One key alone behaves exactly as before (no pool
    overhead). Useful for stretching a limited free-tier daily token quota
    across several accounts and for cutting wall-clock time on batch uploads.

Usage:
    from llm_client import get_llm_client

    llm = get_llm_client()
    if not llm.is_available():
        ...offline/demo fallback...
    text = llm.complete(
        messages=[{"role": "user", "content": "..."}],
        temperature=0.2,
        max_tokens=800,
        json_mode=True,
    )
"""

import itertools
import os
import logging
from typing import Dict, List, Optional

logger = logging.getLogger("sebi-ipo-generator.llm_client")

DEFAULT_MODELS = {
    "groq": "llama-3.3-70b-versatile",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-sonnet-4-5",
    "ollama": "llama3.1:8b-instruct",
}

# Substrings that flag an env var as still holding its placeholder value
# rather than a real credential (matches the convention already used
# throughout the codebase, e.g. "your_groq_api_key" in .env.example).
_PLACEHOLDER_MARKERS = ("your_groq_api_key", "your_openai_api_key", "your_anthropic_api_key", "changeme", "xxxxx")


def _is_placeholder(key: str) -> bool:
    if not key or not key.strip():
        return True
    low = key.lower()
    return any(marker in low for marker in _PLACEHOLDER_MARKERS)


def _groq_key_pool() -> List[str]:
    """Collects every configured Groq key: GROQ_API_KEY, GROQ_API_KEY_2, _3, ...
    (open-ended, stops at the first missing number) plus a comma-separated
    GROQ_API_KEYS if set. Order is preserved and duplicates are dropped so the
    same key isn't ever double-counted in the pool.
    """
    keys: List[str] = []
    first = os.getenv("GROQ_API_KEY", "")
    if not _is_placeholder(first):
        keys.append(first)
    i = 2
    while True:
        k = os.getenv(f"GROQ_API_KEY_{i}", "")
        if not k:
            break
        if not _is_placeholder(k):
            keys.append(k)
        i += 1
    for k in os.getenv("GROQ_API_KEYS", "").split(","):
        k = k.strip()
        if k and not _is_placeholder(k):
            keys.append(k)
    seen = set()
    deduped = []
    for k in keys:
        if k not in seen:
            seen.add(k)
            deduped.append(k)
    return deduped


class LLMClient:
    """Provider-agnostic chat-completion client.

    `messages` always uses the standard OpenAI-style
    [{"role": "system"|"user"|"assistant", "content": str}] shape regardless
    of provider; Anthropic's separate-system-parameter convention is handled
    internally so callers never need provider-specific branches.
    """

    def __init__(self, provider: Optional[str] = None, model: Optional[str] = None):
        self.provider = (provider or os.getenv("LLM_PROVIDER", "groq")).strip().lower()
        if self.provider not in DEFAULT_MODELS:
            logger.warning(f"Unknown LLM_PROVIDER '{self.provider}'; defaulting to 'groq'.")
            self.provider = "groq"
        self.model = (model or os.getenv("LLM_MODEL", "").strip()) or DEFAULT_MODELS[self.provider]
        self._client = None
        self._init_error: Optional[str] = None
        # One pre-built client per Groq key (round-robin below picks an index
        # into this list per call) — a list of independent client objects,
        # not one shared mutable client, so concurrent calls from different
        # background threads never race over which key is "currently active".
        self._groq_clients: list = []
        self._groq_round_robin = itertools.count()
        self._init_client()

    # ── Provider client construction ──────────────────────────────────────

    def _init_client(self) -> None:
        try:
            if self.provider == "groq":
                from groq import Groq
                keys = _groq_key_pool()
                if not keys:
                    self._init_error = "GROQ_API_KEY not configured"
                    return
                self._groq_clients = [Groq(api_key=k) for k in keys]
                self._client = self._groq_clients[0]

            elif self.provider == "openai":
                from openai import OpenAI
                key = os.getenv("OPENAI_API_KEY", "")
                if _is_placeholder(key):
                    self._init_error = "OPENAI_API_KEY not configured"
                    return
                self._client = OpenAI(api_key=key)

            elif self.provider == "anthropic":
                import anthropic
                key = os.getenv("ANTHROPIC_API_KEY", "")
                if _is_placeholder(key):
                    self._init_error = "ANTHROPIC_API_KEY not configured"
                    return
                self._client = anthropic.Anthropic(api_key=key)

            elif self.provider == "ollama":
                # Ollama exposes an OpenAI-compatible /v1 endpoint, so the
                # openai SDK is reused instead of adding a 5th dependency.
                # No API key is needed for a local instance.
                from openai import OpenAI
                base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1").strip()
                self._client = OpenAI(api_key="ollama", base_url=base_url)

        except ImportError as e:
            self._init_error = f"'{self.provider}' SDK not installed ({e})"
            logger.warning(f"LLM provider '{self.provider}' unavailable: {self._init_error}")
        except Exception as e:
            self._init_error = f"'{self.provider}' client init failed ({e})"
            logger.warning(f"LLM provider '{self.provider}' unavailable: {self._init_error}")

    def is_available(self) -> bool:
        return self._client is not None

    def unavailable_reason(self) -> str:
        return self._init_error or "LLM client not initialised"

    # ── Unified completion call ───────────────────────────────────────────

    def complete(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.3,
        max_tokens: Optional[int] = None,
        json_mode: bool = False,
    ) -> str:
        """Sends a chat completion request and returns the plain text response.

        Raises RuntimeError if the client wasn't initialised (check
        is_available() first) or the provider call itself fails — callers
        already wrap LLM calls in try/except with an offline fallback, so
        this intentionally does not swallow errors itself.
        """
        if not self.is_available():
            raise RuntimeError(f"LLM client unavailable: {self.unavailable_reason()}")

        if self.provider in ("groq", "openai", "ollama"):
            kwargs = {"messages": messages, "model": self.model, "temperature": temperature}
            if max_tokens:
                kwargs["max_tokens"] = max_tokens
            if json_mode and self.provider != "ollama":
                # Local Ollama builds/models don't reliably honour response_format yet;
                # JSON-mode callers already instruct the format in-prompt as a fallback.
                kwargs["response_format"] = {"type": "json_object"}
            if self.provider == "groq":
                return self._complete_groq(kwargs)
            completion = self._client.chat.completions.create(**kwargs)
            return (completion.choices[0].message.content or "").strip()

        elif self.provider == "anthropic":
            system_msg = "\n".join(m["content"] for m in messages if m.get("role") == "system")
            convo = [m for m in messages if m.get("role") != "system"]
            kwargs = {
                "model": self.model,
                "max_tokens": max_tokens or 1024,
                "temperature": temperature,
                "messages": convo,
            }
            if system_msg:
                kwargs["system"] = system_msg
            response = self._client.messages.create(**kwargs)
            return "".join(
                block.text for block in response.content if getattr(block, "type", "") == "text"
            ).strip()

        raise RuntimeError(f"Unsupported LLM provider: {self.provider}")

    def _complete_groq(self, kwargs: Dict) -> str:
        """Round-robins across the Groq key pool: each call starts at the next
        key in rotation (via an atomic counter, safe under concurrent calls
        from different background threads — no shared "current key" state
        gets mutated), so parallel calls spread across keys instead of
        serializing behind one. A call that hits a rate limit retries on the
        remaining keys in the pool, in rotation order, before giving up.
        With a single key this degenerates to the old always-use-key-1
        behaviour with no extra overhead.
        """
        n = len(self._groq_clients)
        start = next(self._groq_round_robin) % n
        last_exc: Optional[Exception] = None
        for attempt in range(n):
            idx = (start + attempt) % n
            try:
                completion = self._groq_clients[idx].chat.completions.create(**kwargs)
                return (completion.choices[0].message.content or "").strip()
            except Exception as e:
                if not is_rate_limit_error(e):
                    raise
                last_exc = e
                if n > 1:
                    logger.warning(f"Groq key #{idx + 1} rate-limited; trying next key in pool.")
        raise last_exc


def is_rate_limit_error(exc: Exception) -> bool:
    """True if `exc` is a provider rate-limit error (HTTP 429) — groq, openai, and
    anthropic's SDKs each raise a same-named `RateLimitError` class, so matching on
    the class name avoids importing all three SDKs just to check `isinstance`.
    Callers use this to give a distinct "usage limit reached, try again shortly"
    message instead of silently folding it into the generic offline-fallback path,
    which reads as "the AI is broken" rather than "today's quota is used up."
    """
    return type(exc).__name__ == "RateLimitError"


_singleton: Optional["LLMClient"] = None


def get_llm_client() -> "LLMClient":
    """Returns the process-wide LLM client singleton, built from env config on first use."""
    global _singleton
    if _singleton is None:
        _singleton = LLMClient()
    return _singleton


def reset_llm_client() -> None:
    """Clears the cached singleton. Call after changing LLM_PROVIDER/keys at runtime (e.g. in tests)."""
    global _singleton
    _singleton = None
