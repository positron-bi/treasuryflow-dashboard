from __future__ import annotations

import os
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest

from treasuryflow_core import (
    SourceSet,
    find_sources,
    normalize_date,
    source_signature,
)


class TreasuryFlowCoreTests(unittest.TestCase):
    def test_normalize_solar_date(self) -> None:
        self.assertEqual(normalize_date("گزارش ۱۴۰۵-۵-۲۸"), "1405/05/28")
        self.assertEqual(normalize_date("1405/05/28"), "1405/05/28")
        self.assertIsNone(normalize_date("1405/13/01"))

    def test_find_sources_selects_latest_report_date(self) -> None:
        with TemporaryDirectory() as temp:
            home = Path(temp)
            older = home / "Treasury Daily Report - 1405-05-28.xlsx"
            newer = home / "Treasury Daily Report - 1405-06-01.xlsx"
            older.write_bytes(b"older")
            newer.write_bytes(b"newer")
            # حتی اگر mtime فایل قدیمی جدیدتر باشد، تاریخ گزارش معیار اصلی است.
            now = time.time()
            os.utime(older, (now + 10, now + 10))
            (home / "Manual_Inputs.xlsx").write_bytes(b"manual")
            (home / "گزارش تسهیلات.xlsx").write_bytes(b"facilities")

            sources = find_sources(home)
            self.assertEqual(sources.daily, newer)
            self.assertEqual(sources.manual.name, "Manual_Inputs.xlsx")
            self.assertEqual(sources.facilities.name, "گزارش تسهیلات.xlsx")

    def test_signature_changes_when_content_changes(self) -> None:
        with TemporaryDirectory() as temp:
            daily = Path(temp) / "daily.xlsx"
            daily.write_bytes(b"v1")
            sources = SourceSet(daily=daily, manual=None, facilities=None)
            first = source_signature(sources)
            daily.write_bytes(b"v2")
            second = source_signature(sources)
            self.assertNotEqual(first, second)


if __name__ == "__main__":
    unittest.main()
