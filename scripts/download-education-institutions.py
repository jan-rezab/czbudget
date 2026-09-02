#!/usr/bin/env python3
"""Download official institution registers and build the six-country level table."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import re
import tempfile
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


WEB = Path(os.environ.get("CZBUDGET_WEBSITE_ROOT", Path(__file__).resolve().parents[1])).resolve()
ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[2])).resolve()
CACHE = ROOT / "data/source_cache/education/institutions"
OUTPUT = WEB / "data/education-institutions.v1.json"
USER_AGENT = "czbudget-public/1.0 education institution downloader"

GISCO_COUNTRIES = {"CZE": "CZ", "SWE": "SE", "DNK": "DK", "FIN": "FI", "NOR": "NO"}
GISCO_TEMPLATE = "https://gisco-services.ec.europa.eu/pub/education/2023/csv/{geo}.csv"
SWISS_CSV = "https://dam-api.bfs.admin.ch/hub/api/dam/assets/36465187/master"
SWISS_APPENDIX = "https://dam-api.bfs.admin.ch/hub/api/dam/assets/36465187/appendix"
SWEDISH_HEI_LIST = "https://www.uka.se/swedish-higher-education-authority/about-higher-education/universities-university-colleges-and-other-education-providers/higher-education-institutions"
DENMARK_ECEC = "https://api.statbank.dk/v1/data/BOERN4/CSV?BLSTKOM=000&PASTIL=61,69,65,66&EJERFORM=00&Tid=2024"
DENMARK_HEI = "https://api.statbank.dk/v1/tableinfo/INST20?lang=en"
FINLAND_INSTITUTIONS = "https://pxweb2.stat.fi/PxWeb/api/v1/en/StatFin/kjarj/125j.px"
NORWAY_ECEC = "https://data.ssb.no/api/v0/en/table/09220/"
NORWAY_HEI = "https://dbh.hkdir.no/static/files/esdata/2024/nokkeltall_statlige_2024.pdf"
LEVEL_TOKENS = {
    "preprimary": {"0"},
    "primary": {"1"},
    "lower_secondary": {"2"},
    "upper_secondary": {"3"},
    "tertiary": {"5", "6", "7", "8"},
}
SWISS_LEVELS = {
    "preprimary": {"110"},
    "primary": {"120"},
    "lower_secondary": {"130"},
    "upper_secondary": {"220", "240", "255"},
    "tertiary": {"310", "320"},
}


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(content)
    temporary.replace(path)
    path.chmod(0o644)


def download(url: str, destination: Path, payload: dict | None = None) -> None:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=headers, method="POST" if body else "GET")
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                content = response.read()
            if not content:
                raise RuntimeError(f"Empty response from {url}")
            atomic_write(destination, content)
            return
        except Exception as error:  # pragma: no cover - network retry path
            last_error = error
            if attempt == 4:
                raise
            time.sleep(2**attempt)
    raise RuntimeError(last_error)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def gisco_counts(path: Path) -> dict[str, int]:
    identifiers = {level: set() for level in LEVEL_TOKENS}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            institution_id = row.get("id", "").strip()
            levels = {part.strip() for part in row.get("levels", "").split("-") if part.strip()}
            if not institution_id:
                continue
            for level, tokens in LEVEL_TOKENS.items():
                if levels & tokens:
                    identifiers[level].add(institution_id)
    counts = {level: len(ids) for level, ids in identifiers.items()}
    return counts


def swedish_tertiary_count(path: Path) -> int:
    html = path.read_text(encoding="utf-8")
    match = re.search(r'id="h-Universities"(.*?)</div></div>', html, re.DOTALL)
    if not match:
        raise RuntimeError("Could not locate the UKÄ higher-education institution list")
    count = len(re.findall(r'<p class="hiq-p"', match.group(1)))
    if not 40 <= count <= 60:
        raise RuntimeError(f"Unexpected UKÄ institution count: {count}")
    return count


def swiss_counts(path: Path) -> dict[str, int]:
    values: dict[str, int] = {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle, delimiter=";"):
            if row["PERIOD"] == "2024/25" and row["REGION"] == "TOT" and row["STATUS_LEVEL"] == "TOT":
                values[row["LEVEL"]] = int(row["VALUE"])
    counts = {level: sum(values.get(code, 0) for code in codes) for level, codes in SWISS_LEVELS.items()}
    if any(value == 0 for value in counts.values()):
        raise RuntimeError(f"Missing Swiss level coverage in {path}: {counts}")
    return counts


def pxweb_payload(selections: list[tuple[str, list[str], str]]) -> dict:
    return {
        "query": [
            {"code": code, "selection": {"filter": selection_filter, "values": values}}
            for code, values, selection_filter in selections
        ],
        "response": {"format": "json-stat2"},
    }


def jsonstat_values(path: Path, dimension: str) -> dict[str, int]:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    index = payload["dimension"][dimension]["category"]["index"]
    return {code: int(payload["value"][position]) for code, position in index.items()}


def main() -> None:
    swedish_path = CACHE / "swedish-higher-education-institutions.html"
    download(SWEDISH_HEI_LIST, swedish_path)
    swedish_tertiary = swedish_tertiary_count(swedish_path)
    countries = []
    for code, geo in GISCO_COUNTRIES.items():
        url = GISCO_TEMPLATE.format(geo=geo)
        path = CACHE / f"gisco-education-services-2023-{geo}.csv"
        download(url, path)
        counts = gisco_counts(path)
        if code == "SWE":
            counts["tertiary"] = swedish_tertiary
        country = {
            "code": code,
            "period": "2023 register",
            "counts": counts,
            "source_title": "Eurostat GISCO — Education services in Europe",
            "source_url": url,
            "source_sha256": sha256(path),
            "definition": "Unique education-service identifiers tagged with each ISCED level; a service spanning levels is counted in every applicable level.",
        }
        if code == "SWE":
            country.update({
                "source_title": "Eurostat GISCO and Swedish Higher Education Authority institution list",
                "source_url": SWEDISH_HEI_LIST,
                "source_sha256": sha256(swedish_path),
                "secondary_source_url": url,
                "secondary_source_sha256": sha256(path),
                "definition": "GISCO service identifiers by ISCED level through upper-secondary; tertiary is the 50 providers listed by the Swedish Higher Education Authority. Level-spanning services can appear in more than one row.",
            })
        countries.append(country)

    by_code = {country["code"]: country for country in countries}

    denmark_ecec_path = CACHE / "denmark-ecec-institutions-2024.csv"
    denmark_hei_path = CACHE / "denmark-university-institutions.json"
    download(DENMARK_ECEC, denmark_ecec_path)
    download(DENMARK_HEI, denmark_hei_path)
    with denmark_ecec_path.open(encoding="utf-8-sig", newline="") as handle:
        denmark_ecec = list(csv.DictReader(handle, delimiter=";"))
    denmark_ecec_count = sum(int(row["INDHOLD"]) for row in denmark_ecec if row["PASTIL"] in {"Daginstitution på enheds niveau", "Puljeordning"})
    denmark_hei = json.loads(denmark_hei_path.read_text(encoding="utf-8"))
    institution_dimension = next(variable for variable in denmark_hei["variables"] if variable["id"] == "INSTI")
    denmark_hei_count = sum(value["id"] != "TOT" for value in institution_dimension["values"])
    by_code["DNK"]["counts"].update(preprimary=denmark_ecec_count, tertiary=denmark_hei_count)
    by_code["DNK"].update({
        "period": "2023–2024",
        "source_title": "Eurostat GISCO and Statistics Denmark institution tables",
        "source_url": "https://www.statbank.dk/BOERN4",
        "source_sha256": sha256(denmark_ecec_path),
        "secondary_source_url": "https://www.statbank.dk/INST20",
        "secondary_source_sha256": sha256(denmark_hei_path),
        "gisco_source_url": GISCO_TEMPLATE.format(geo="DK"),
        "gisco_source_sha256": sha256(CACHE / "gisco-education-services-2023-DK.csv"),
        "definition": "GISCO service identifiers for ISCED 1–3; pre-primary is day-care units plus pool schemes in 2024, and tertiary is the nine universities enumerated in Statistics Denmark's INST20 table.",
    })

    finland_path = CACHE / "finland-educational-institutions-2024.json"
    finland_types = ["11", "12", "15", "19", "21", "22", "23", "24", "28", "29", "41", "42", "43"]
    download(FINLAND_INSTITUTIONS, finland_path, pxweb_payload([
        ("timeperiod_y", ["2024"], "item"),
        ("alue_23_20230101", ["SSS"], "item"),
        ("omistajatyyppi_11_19930101", ["S"], "item"),
        ("kieli_15_20180102", ["SSS"], "item"),
        ("oppilaittostyyp_6_20180101", finland_types, "item"),
        ("contentscode", ["kjarj-oppilaitoksia"], "item"),
    ]))
    finland = jsonstat_values(finland_path, "oppilaittostyyp_6_20180101")
    comprehensive = sum(finland[code] for code in ("11", "12", "19"))
    by_code["FIN"]["counts"] = {
        "preprimary": comprehensive,
        "primary": comprehensive,
        "lower_secondary": comprehensive,
        "upper_secondary": sum(finland[code] for code in ("15", "19", "21", "22", "23", "24", "28", "29")),
        "tertiary": sum(finland[code] for code in ("41", "42", "43")),
    }
    by_code["FIN"].update({
        "period": "2024",
        "source_title": "Statistics Finland — Educational institutions",
        "source_url": "https://pxweb2.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__kjarj/125j.px/",
        "source_sha256": sha256(finland_path),
        "gisco_source_url": GISCO_TEMPLATE.format(geo="FI"),
        "gisco_source_sha256": sha256(CACHE / "gisco-education-services-2023-FI.csv"),
        "definition": "National institution types mapped to ISCED bands. Comprehensive institutions are shown for pre-primary, primary and lower-secondary because the register reports them as one institution type; pre-primary delivered only in day-care centres is outside this institution register.",
    })

    norway_ecec_path = CACHE / "norway-kindergartens-2024.json"
    norway_hei_path = CACHE / "norway-state-higher-education-key-figures-2024.pdf"
    download(NORWAY_ECEC, norway_ecec_path, pxweb_payload([
        ("Region", ["0"], "item"),
        ("Eierskap", ["*"], "all"),
        ("ContentsCode", ["Antall1"], "item"),
        ("Tid", ["2024"], "item"),
    ]))
    download(NORWAY_HEI, norway_hei_path)
    norway_ecec = json.loads(norway_ecec_path.read_text(encoding="utf-8"))
    norway_hei_count = 21
    by_code["NOR"]["counts"].update(preprimary=sum(map(int, norway_ecec["value"])), tertiary=norway_hei_count)
    by_code["NOR"].update({
        "period": "2023–2024",
        "source_title": "Eurostat GISCO, Statistics Norway and Norwegian Ministry of Education",
        "source_url": "https://www.ssb.no/en/statbank/table/09220",
        "source_sha256": sha256(norway_ecec_path),
        "secondary_source_url": NORWAY_HEI,
        "secondary_source_sha256": sha256(norway_hei_path),
        "gisco_source_url": GISCO_TEMPLATE.format(geo="NO"),
        "gisco_source_sha256": sha256(CACHE / "gisco-education-services-2023-NO.csv"),
        "definition": "GISCO service identifiers for ISCED 1–3; pre-primary is all public and private kindergartens in 2024. Tertiary is the 21 state universities, university colleges and specialised colleges documented in HK-dir's 2024 key figures; private providers are outside this count.",
    })

    swiss_path = CACHE / "swiss-education-institutions-2024-25.csv"
    appendix_path = CACHE / "swiss-education-institutions-appendix-2024-25.ods"
    download(SWISS_CSV, swiss_path)
    download(SWISS_APPENDIX, appendix_path)
    countries.append({
        "code": "CHE",
        "period": "2024/25",
        "counts": swiss_counts(swiss_path),
        "source_title": "Swiss Federal Statistical Office — Educational institutions by educational level",
        "source_url": "https://opendata.swiss/en/dataset/bildungsinstitutionen-nach-bildungsstufe-tragerschaft-und-kanton3",
        "source_sha256": sha256(swiss_path),
        "appendix_sha256": sha256(appendix_path),
        "definition": "National totals across public and private institutions; schools spanning levels are counted at every level. Primary level 1–2 is mapped to pre-primary and primary level 3–8 to primary.",
    })

    ordered = {code: index for index, code in enumerate(("CZE", "CHE", "SWE", "DNK", "FIN", "NOR"))}
    countries.sort(key=lambda country: ordered[country["code"]])
    for country in countries:
        if any(not isinstance(value, int) or value <= 0 for value in country["counts"].values()):
            raise RuntimeError(f"Incomplete institution coverage for {country['code']}: {country['counts']}")
    payload = {
        "schema_version": "1.0.0",
        "dataset_id": "education-institutions",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "country_count": len(countries),
        "level_count": len(LEVEL_TOKENS),
        "countries": countries,
        "methodology": "Institution counts are official register measures, not a harmonised Eurostat UOE indicator. Level-spanning institutions can appear in more than one row.",
    }
    atomic_write(OUTPUT, (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(f"Wrote {OUTPUT} with {len(countries)} countries")
    for country in countries:
        print(f"  {country['code']} ({country['period']}): {country['counts']}")


if __name__ == "__main__":
    main()
