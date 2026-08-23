"""
Banker Certification Workflow Store for IPO Sherpa.

Manages section-by-section review and certification states, enforcing
SEBI's mandate for merchant banker oversight before DRHP export.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional, Literal
from pydantic import BaseModel, Field

CERTIFIABLE_SECTIONS = [
    "cover_page",
    "business_overview",
    "risk_factors",
    "capital_structure",
    "objects_of_issue",
    "financial_summary",
    "promoter_details",
    "litigation",
    "management_discussion",
    "industry_overview",
    "regulatory_approvals",
]


class SectionState(BaseModel):
    section_key: str
    status: Literal["draft", "reviewed", "certified"] = "draft"
    certified_by: Optional[str] = None
    certified_at: Optional[datetime] = None
    banker_notes: Optional[str] = None
    reviewer_note: Optional[str] = None
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CertificationStore:
    """Manages section certification state within the session dictionary."""

    def _get_store(self, session: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        if "certification_store" not in session or not isinstance(session["certification_store"], dict):
            session["certification_store"] = {}
        return session["certification_store"]

    def get_state(self, session: Dict[str, Any], section_key: str) -> SectionState:
        store = self._get_store(session)
        if section_key not in store:
            state = SectionState(section_key=section_key, status="draft")
            store[section_key] = state.model_dump(mode="json")
            return state
        return SectionState(**store[section_key])

    def set_reviewed(self, session: Dict[str, Any], section_key: str, reviewer_note: str = "") -> SectionState:
        store = self._get_store(session)
        current = self.get_state(session, section_key)
        current.status = "reviewed"
        current.reviewer_note = reviewer_note
        current.last_updated = datetime.now(timezone.utc)
        store[section_key] = current.model_dump(mode="json")
        return current

    def certify(self, session: Dict[str, Any], section_key: str, banker_name: str, banker_notes: str = "") -> SectionState:
        store = self._get_store(session)
        current = self.get_state(session, section_key)
        current.status = "certified"
        current.certified_by = banker_name
        current.certified_at = datetime.now(timezone.utc)
        current.banker_notes = banker_notes
        current.last_updated = datetime.now(timezone.utc)
        store[section_key] = current.model_dump(mode="json")
        return current

    def uncertify(self, session: Dict[str, Any], section_key: str, reason: str = "") -> SectionState:
        store = self._get_store(session)
        current = self.get_state(session, section_key)
        current.status = "reviewed"
        current.banker_notes = f"Uncertified reason: {reason}" if reason else current.banker_notes
        current.last_updated = datetime.now(timezone.utc)
        store[section_key] = current.model_dump(mode="json")
        return current

    def get_all_states(self, session: Dict[str, Any]) -> Dict[str, SectionState]:
        res = {}
        for sec in CERTIFIABLE_SECTIONS:
            res[sec] = self.get_state(session, sec)
        return res

    def export_allowed(self, session: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Returns (allowed, blocking_sections).

        Allowed is True only if all CERTIFIABLE_SECTIONS are 'certified'.
        """
        all_states = self.get_all_states(session)
        blocking = [sec for sec, state in all_states.items() if state.status != "certified"]
        return (len(blocking) == 0, blocking)
