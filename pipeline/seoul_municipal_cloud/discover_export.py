from __future__ import annotations

import hashlib
import io
import json
import re
import zipfile

import requests
import xlrd
import openpyxl


PAGE = "https://openfinance.seoul.go.kr/budgetbybusinessLofin?localGovCd=00&mngId=4"
EXPORT = "https://openfinance.seoul.go.kr/fnct/revexpLofin/downLoad?mngId=4&localGovCd=00"


def main() -> None:
    session = requests.Session()
    session.headers["User-Agent"] = "PublicSpendingData/1.0 (official-budget-ingestion)"
    page = session.get(PAGE, timeout=120)
    page.raise_for_status()
    match = re.search(r'name="csrfToken" value="([^"]+)"', page.text)
    if not match:
        raise RuntimeError("official page did not return its CSRF token")
    response = session.post(
        EXPORT,
        data={"init": "N", "mngId": "4", "csrfToken": match.group(1), "fisYear": "2025", "cate": "", "deptCd": "", "deptNm": "", "bNm": "", "won": "1"},
        timeout=300,
    )
    response.raise_for_status()
    raw = response.content
    info = {
        "status": response.status_code,
        "content_type": response.headers.get("content-type"),
        "content_disposition": response.headers.get("content-disposition"),
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "magic_hex": raw[:8].hex(),
    }
    if raw.startswith(b"\xd0\xcf\x11\xe0"):
        workbook = xlrd.open_workbook(file_contents=raw)
        info["format"] = "xls"
        info["sheets"] = [{"name": sheet.name, "rows": sheet.nrows, "cols": sheet.ncols, "preview": sheet.row_values(0)[:12]} for sheet in workbook.sheets()]
    elif zipfile.is_zipfile(io.BytesIO(raw)):
        info["format"] = "xlsx"
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            sheet_xml = archive.read("xl/worksheets/sheet1.xml")
            shared_xml = archive.read("xl/sharedStrings.xml")
            info["xml_counts"] = {
                "sheet_bytes": len(sheet_xml),
                "row_elements": sheet_xml.count(b"<row"),
                "cell_elements": sheet_xml.count(b"<c"),
                "shared_string_elements": shared_xml.count(b"<si"),
            }
            info["sheet_xml_prefix"] = sheet_xml[:500].decode("utf-8", "replace")
        workbook = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        info["sheets"] = []
        for sheet in workbook.worksheets:
            sheet.reset_dimensions()
            preview = []
            row_count = 0
            max_cols = 0
            for row in sheet.iter_rows(values_only=True):
                row_count += 1
                values = list(row)
                max_cols = max(max_cols, len(values))
                if row_count <= 8:
                    preview.append(values[:12])
            info["sheets"].append({"name": sheet.title, "rows": row_count, "cols": max_cols, "preview": preview})
    else:
        info["format"] = "unknown"
        info["prefix"] = raw[:200].decode("utf-8", "replace")
    print(json.dumps(info, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
