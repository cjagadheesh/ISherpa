import os
import tempfile
import unittest

from doc_forensics import analyze_document_forensics


def _minimal_pdf_bytes(extra: bytes = b"", eof_count: int = 1) -> bytes:
    """A minimal, deliberately hand-built PDF byte string — good enough for
    the raw-byte structural checks (which only look at markers/metadata, not
    a fully parseable page tree), not intended to render.
    """
    body = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n" + extra
    return body + (b"%%EOF\n" * eof_count)


class DocForensicsTests(unittest.TestCase):
    def _write_temp(self, data: bytes, suffix: str = ".pdf") -> str:
        fd, path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        self.addCleanup(os.remove, path)
        return path

    def test_non_pdf_file_is_not_applicable(self):
        path = self._write_temp(b"just some text", suffix=".txt")
        result = analyze_document_forensics(path)
        self.assertFalse(result["applicable"])
        self.assertEqual(result["level"], "na")

    def test_non_pdf_bytes_with_pdf_extension_is_not_applicable(self):
        path = self._write_temp(b"not actually a pdf", suffix=".pdf")
        result = analyze_document_forensics(path)
        self.assertFalse(result["applicable"])

    def test_single_save_pdf_has_no_edit_signal(self):
        path = self._write_temp(_minimal_pdf_bytes(eof_count=1))
        result = analyze_document_forensics(path)
        self.assertTrue(result["applicable"])
        labels = [s["label"] for s in result["signals"]]
        self.assertNotIn("Edited after creation", labels)

    def test_multiple_eof_markers_flagged_as_edited(self):
        path = self._write_temp(_minimal_pdf_bytes(eof_count=2))
        result = analyze_document_forensics(path)
        labels = {s["label"]: s for s in result["signals"]}
        self.assertIn("Edited after creation", labels)
        self.assertEqual(labels["Edited after creation"]["level"], "flag")

    def test_multiple_flag_signals_push_overall_level_to_flag(self):
        # Two independent flag-worthy signals should stack deductions past
        # the "review" threshold into "flag" overall.
        extra = b"/Producer (iLovePDF)\n/Creator (iLovePDF)\n"
        path = self._write_temp(_minimal_pdf_bytes(extra=extra, eof_count=2))
        result = analyze_document_forensics(path)
        labels = [s["label"] for s in result["signals"]]
        self.assertIn("Edited after creation", labels)
        self.assertIn("Processed by a PDF-editing/scanning tool", labels)
        self.assertEqual(result["level"], "flag")

    def test_prev_xref_entry_flagged_as_edited(self):
        path = self._write_temp(_minimal_pdf_bytes(extra=b"/Prev 12345\n"))
        result = analyze_document_forensics(path)
        labels = [s["label"] for s in result["signals"]]
        self.assertIn("Edited after creation", labels)

    def test_known_editor_tool_metadata_is_flagged(self):
        extra = b"/Producer (iLovePDF)\n/Creator (iLovePDF)\n"
        path = self._write_temp(_minimal_pdf_bytes(extra=extra))
        result = analyze_document_forensics(path)
        labels = {s["label"]: s for s in result["signals"]}
        self.assertIn("Processed by a PDF-editing/scanning tool", labels)
        self.assertEqual(labels["Processed by a PDF-editing/scanning tool"]["level"], "flag")

    def test_unremarkable_producer_is_not_flagged(self):
        extra = b"/Producer (Microsoft Word)\n/Creator (Microsoft Word)\n"
        path = self._write_temp(_minimal_pdf_bytes(extra=extra))
        result = analyze_document_forensics(path)
        labels = [s["label"] for s in result["signals"]]
        self.assertNotIn("Processed by a PDF-editing/scanning tool", labels)

    def test_mod_date_after_creation_date_is_review(self):
        extra = b"/CreationDate (D:20250101000000)\n/ModDate (D:20250601000000)\n"
        path = self._write_temp(_minimal_pdf_bytes(extra=extra))
        result = analyze_document_forensics(path)
        labels = {s["label"]: s for s in result["signals"]}
        self.assertIn("Modified after creation date", labels)
        self.assertEqual(labels["Modified after creation date"]["level"], "review")

    def test_mod_date_before_creation_date_is_not_flagged(self):
        extra = b"/CreationDate (D:20250601000000)\n/ModDate (D:20250101000000)\n"
        path = self._write_temp(_minimal_pdf_bytes(extra=extra))
        result = analyze_document_forensics(path)
        labels = [s["label"] for s in result["signals"]]
        self.assertNotIn("Modified after creation date", labels)

    def test_digital_signature_is_a_positive_info_signal(self):
        extra = b"/ByteRange [0 100 200 300]\n"
        path = self._write_temp(_minimal_pdf_bytes(extra=extra))
        result = analyze_document_forensics(path)
        labels = {s["label"]: s for s in result["signals"]}
        self.assertIn("Carries a digital signature", labels)
        self.assertEqual(labels["Carries a digital signature"]["level"], "info")

    def test_real_pdf_with_substantial_text_has_no_thin_text_layer_signal(self):
        fitz = __import__("fitz")
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 72), "This is a genuine, substantial block of extractable body text. " * 20)
        path = self._write_temp(bytes(doc.tobytes()))
        doc.close()
        result = analyze_document_forensics(path)
        self.assertTrue(result["applicable"])
        labels = [s["label"] for s in result["signals"]]
        self.assertNotIn("No machine-readable text layer", labels)

    def test_real_pdf_with_no_text_has_thin_text_layer_signal(self):
        fitz = __import__("fitz")
        doc = fitz.open()
        doc.new_page()  # blank page, no text at all
        path = self._write_temp(bytes(doc.tobytes()))
        doc.close()
        result = analyze_document_forensics(path)
        labels = [s["label"] for s in result["signals"]]
        self.assertIn("No machine-readable text layer", labels)


if __name__ == "__main__":
    unittest.main()
