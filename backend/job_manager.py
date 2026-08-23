"""
job_manager.py — Thread-safe Background Extraction Job Queue Manager
====================================================================
Tracks background OCR/LLM document extractions with step-by-step progress,
stage indicators, and job status polling for the SEBI IPO Generator API.
"""

import uuid
import time
import threading
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("sebi-ipo-generator.job_manager")

class JobManager:
    def __init__(self):
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create_job(self, doc_type: str, filename: str) -> str:
        """Creates a new extraction job and returns unique job_id."""
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        now = time.time()
        job_data = {
            "job_id": job_id,
            "status": "processing", # processing | completed | failed
            "progress": 10,
            "stage": "Validating uploaded document structure...",
            "doc_type": doc_type,
            "filename": filename,
            "extracted_data": None,
            "error": None,
            "created_at": now,
            "updated_at": now
        }
        with self._lock:
            self._jobs[job_id] = job_data
        logger.info(f"Created extraction job {job_id} for file '{filename}' [{doc_type}]")
        return job_id

    def update_job(
        self,
        job_id: str,
        status: Optional[str] = None,
        progress: Optional[int] = None,
        stage: Optional[str] = None,
        extracted_data: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ) -> None:
        """Updates job progress, stage, status, or completion payload."""
        with self._lock:
            if job_id not in self._jobs:
                return
            job = self._jobs[job_id]
            if status is not None:
                job["status"] = status
            if progress is not None:
                job["progress"] = min(100, max(0, progress))
            if stage is not None:
                job["stage"] = stage
            if extracted_data is not None:
                job["extracted_data"] = extracted_data
            if error is not None:
                job["error"] = error
            job["updated_at"] = time.time()

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Returns snapshot of current job status."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            return dict(job)

# Singleton JobManager instance
job_manager = JobManager()
