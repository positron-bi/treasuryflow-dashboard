#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ساخت گزارش HTML تک‌فایلی از خروجی پایپ‌لاین TreasuryFlow."""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys


HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"


def build_html(data_json: os.PathLike[str] | str, output_html: os.PathLike[str] | str) -> Path:
    """Build the standalone dashboard and replace the destination atomically."""
    data_path = Path(data_json)
    output_path = Path(output_html)
    with data_path.open(encoding="utf-8") as handle:
        data = json.load(handle)

    data_json_text = json.dumps(data, ensure_ascii=False)
    if "</script" in data_json_text.lower():
        raise ValueError("داده حاوی تگ پایانی script است و برای HTML امن نیست.")

    html = (
        (ASSETS / "template_head.html").read_text(encoding="utf-8")
        + "<script>const DATA = "
        + data_json_text
        + ";</script>\n<script>"
        + (ASSETS / "chartjs.min.js").read_text(encoding="utf-8")
        + "</script>\n<script>"
        + (ASSETS / "main.js").read_text(encoding="utf-8")
        + "</script>\n"
        + (ASSETS / "template_tail.html").read_text(encoding="utf-8")
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pending = output_path.with_name(output_path.name + ".pending")
    pending.write_text(html, encoding="utf-8")
    os.replace(pending, output_path)
    return output_path


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    data_path = Path(args[0]) if args else Path("/home/claude/data.json")
    with data_path.open(encoding="utf-8") as handle:
        report_date = json.load(handle)["report_date"].replace("/", "-")
    output_path = Path(args[1]) if len(args) > 1 else Path(
        f"/mnt/user-data/outputs/Positron_TMS_v2_{report_date}.html"
    )
    build_html(data_path, output_path)
    print(f"written -> {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
