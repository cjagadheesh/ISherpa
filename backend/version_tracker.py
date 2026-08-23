"""
version_tracker.py — Live DRHP Version Revision Diff & SEBI Observation Tracker
=================================================================================
Tracks DRHP draft revision snapshots dynamically from live workspace session data.
"""

import logging
import difflib
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger("sebi-ipo-generator.version_tracker")

def create_version_snapshot(session_data: Dict[str, Any], version_tag: str, comment: str) -> Dict[str, Any]:
    """Saves a version snapshot of the active workspace DRHP session data."""
    snapshot_id = f"snap_{int(datetime.now().timestamp())}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    return {
        "snapshot_id": snapshot_id,
        "version_tag": version_tag,
        "timestamp": now_str,
        "comment": comment,
        "form_data": session_data.get("form_data", {}),
        "extracted_data": session_data.get("extracted_data", {})
    }

def compute_section_text_diff(old_text: str, new_text: str) -> List[Dict[str, Any]]:
    """Computes line-by-line diff between two version text drafts."""
    diff_lines = []
    matcher = difflib.SequenceMatcher(None, old_text.splitlines(), new_text.splitlines())
    
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            for line in old_text.splitlines()[i1:i2]:
                diff_lines.append({"type": "unchanged", "text": line})
        elif tag == 'replace':
            for line in old_text.splitlines()[i1:i2]:
                diff_lines.append({"type": "removed", "text": line})
            for line in new_text.splitlines()[j1:j2]:
                diff_lines.append({"type": "added", "text": line})
        elif tag == 'delete':
            for line in old_text.splitlines()[i1:i2]:
                diff_lines.append({"type": "removed", "text": line})
        elif tag == 'insert':
            for line in new_text.splitlines()[j1:j2]:
                diff_lines.append({"type": "added", "text": line})
                
    return diff_lines

def get_version_history_summary(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Returns dynamic workspace revision history and active SEBI observation queries."""
    version_history = session_data.get("version_history", [])
    sebi_observations = session_data.get("sebi_observations", [])

    return {
        "status": "success",
        "has_data": len(version_history) > 0 or len(sebi_observations) > 0,
        "total_versions": len(version_history),
        "versions": version_history,
        "sebi_observations": sebi_observations
    }
