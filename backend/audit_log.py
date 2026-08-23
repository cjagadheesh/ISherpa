"""
Audit Log Module for IPO Sherpa.

Append-only audit trail logging system stored as JSONL per user workspace.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Literal
from pydantic import BaseModel, Field

logger = logging.getLogger("sebi-ipo-generator.audit_log")


ACTION_TYPES = [
    "session.load", "session.save", "session.reset",
    "document.upload", "document.extract",
    "section.generate", "section.review", "section.certify",
    "section.uncertify", "export.docx", "export.blocked",
    "validation.run", "contradiction.found",
    "blockchain.anchor", "blockchain.seal"
]


class AuditEntry(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    user_id: str
    action: str
    resource: str
    detail: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    outcome: Literal["success", "denied", "error"] = "success"


class AuditLog:
    """Append-only audit logger writing to backend/audit/{user_id}.jsonl."""

    def __init__(self, base_dir: Optional[str] = None):
        if base_dir is None:
            base_dir = os.path.join(os.path.dirname(__file__), "audit")
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def _get_filepath(self, user_id: str) -> str:
        safe_id = "".join(c for c in user_id if c.isalnum() or c in ("-", "_")).strip() or "default_user"
        return os.path.join(self.base_dir, f"{safe_id}.jsonl")

    def log(self, user_id: str, action: str, resource: str, detail: Optional[Dict[str, Any]] = None,
            ip: Optional[str] = None, outcome: Literal["success", "denied", "error"] = "success") -> AuditEntry:
        entry = AuditEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            user_id=user_id,
            action=action,
            resource=resource,
            detail=detail or {},
            ip_address=ip,
            outcome=outcome
        )
        filepath = self._get_filepath(user_id)
        try:
            with open(filepath, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry.model_dump(mode="json")) + "\n")
        except Exception as e:
            logger.error(f"Failed to write audit log entry for user {user_id}: {e}")
        return entry

    def get_log(self, user_id: str, limit: int = 100) -> List[AuditEntry]:
        filepath = self._get_filepath(user_id)
        if not os.path.exists(filepath):
            return []
        entries = []
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            data = json.loads(line)
                            entries.append(AuditEntry(**data))
                        except Exception:
                            pass
        except Exception:
            return []
        # Return newest first
        entries.reverse()
        return entries[:limit]

    def get_summary(self, user_id: str) -> Dict[str, Any]:
        entries = self.get_log(user_id, limit=10000)
        if not entries:
            return {
                "total_events": 0,
                "first_activity": None,
                "last_activity": None,
                "action_counts": {},
                "total_contradictions_found": 0,
                "total_sections_certified": 0,
            }

        counts: Dict[str, int] = {}
        contradictions = 0
        certified = 0

        for entry in entries:
            counts[entry.action] = counts.get(entry.action, 0) + 1
            if entry.action == "contradiction.found":
                contradictions += 1
            elif entry.action == "section.certify" and entry.outcome == "success":
                certified += 1

        first_act = entries[-1].timestamp
        last_act = entries[0].timestamp

        return {
            "total_events": len(entries),
            "first_activity": first_act,
            "last_activity": last_act,
            "action_counts": counts,
            "total_contradictions_found": contradictions,
            "total_sections_certified": certified,
        }
