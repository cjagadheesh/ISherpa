"""
Hallucination Guard Module for IPO Sherpa.

Ensures that LLM-generated text does not output numbers that are missing
from the verified session fact store. Supports unit/currency conversions (Crores, Lakhs, units).
"""

import re
from typing import Dict, Any, Set, List, Tuple
from pydantic import BaseModel


class HallucinationDetected(Exception):
    """Raised when unverified numbers are found in generated text."""
    def __init__(self, violations: List[str]):
        self.violations = violations
        super().__init__(f"Hallucinated numbers detected: {', '.join(violations)}")


class GuardResult(BaseModel):
    passed: bool
    violations: List[str]
    warning_count: int
    clean_text: str


class HallucinationGuard:
    """Validates numeric figures in generated text against session data."""

    def _normalize_num(self, val: float) -> Set[str]:
        """Generates variants of a numeric value across units (crores, lakhs, plain units)."""
        res = set()
        val_round = round(val, 4)
        if val_round == int(val_round):
            base_str = str(int(val_round))
        else:
            base_str = f"{val_round:.2f}".rstrip('0').rstrip('.')

        res.add(base_str)
        res.add(f"{val_round:.2f}")
        res.add(f"{val_round:.1f}")

        # Integer representation
        res.add(str(int(round(val))))

        # crore -> lakhs (* 100)
        cr_lakh = round(val * 100, 2)
        res.add(f"{cr_lakh:.2f}".rstrip('0').rstrip('.'))
        res.add(str(int(round(cr_lakh))))

        # crore -> units (* 10,00,000 / 1,00,00,000)
        cr_units = int(round(val * 10000000))
        if cr_units > 0:
            res.add(str(cr_units))
            res.add(f"{cr_units:,}")

        res.add(str(round(val, 1)))
        return res

    def extract_numbers_from_session(self, session: Dict[str, Any]) -> Set[str]:
        """Recursively extracts and normalizes all numeric values in session data."""
        allowed_numbers: Set[str] = set()

        def _walk(obj: Any):
            if isinstance(obj, (int, float)):
                if not isinstance(obj, bool):
                    allowed_numbers.update(self._normalize_num(float(obj)))
            elif isinstance(obj, str):
                clean = obj.replace(',', '').strip()
                nums = re.findall(r'\b\d+(?:\.\d+)?\b', clean)
                for n in nums:
                    try:
                        val = float(n)
                        allowed_numbers.update(self._normalize_num(val))
                    except ValueError:
                        pass
            elif isinstance(obj, dict):
                for v in obj.values():
                    _walk(v)
            elif isinstance(obj, list):
                for item in obj:
                    _walk(item)

        _walk(session)
        # Always allow small numbers 0..10 for prose count/years
        for common_i in range(0, 11):
            allowed_numbers.add(str(common_i))

        return allowed_numbers

    def extract_numbers_from_text(self, text: str) -> List[Tuple[str, str]]:
        """Extracts (raw_match, normalized) tuples from text using regex."""
        matches = re.findall(r'\b\d[\d,\.]*\d\b|\b\d\b', text)
        result = []
        for m in matches:
            clean = m.replace(',', '')
            if clean.startswith('.') or clean.endswith('.'):
                clean = clean.strip('.')
            if not clean:
                continue
            result.append((m, clean))
        return result

    def check(self, generated_text: str, session: Dict[str, Any]) -> GuardResult:
        """Validates all numeric figures in text against allowed session numbers."""
        allowed = self.extract_numbers_from_session(session)
        found_nums = self.extract_numbers_from_text(generated_text)

        violations = []
        clean_text = generated_text
        violated_set = set()

        for raw_match, normalized in found_nums:
            is_allowed = False
            if normalized in allowed:
                is_allowed = True
            else:
                try:
                    val = float(normalized)
                    val_str = f"{val:.2f}".rstrip('0').rstrip('.')
                    if val_str in allowed or str(int(val)) in allowed:
                        is_allowed = True
                except ValueError:
                    pass

            if not is_allowed:
                violated_set.add(raw_match)

        violations = list(violated_set)

        for v in violations:
            pattern = r'\b' + re.escape(v) + r'\b'
            clean_text = re.sub(pattern, f"⚠️[UNVERIFIED: {v}]", clean_text)

        return GuardResult(
            passed=len(violations) == 0,
            violations=violations,
            warning_count=len(violations),
            clean_text=clean_text
        )

    def assert_clean(self, generated_text: str, session: Dict[str, Any]) -> str:
        """Raises HallucinationDetected if violations exist, otherwise returns unchanged text."""
        result = self.check(generated_text, session)
        if not result.passed:
            raise HallucinationDetected(result.violations)
        return generated_text
