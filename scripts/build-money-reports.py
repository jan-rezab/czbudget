#!/usr/bin/env python3
"""Build the Czech and US monetary-report marts from primary/public sources.

The browser consumes one country file per route.  Keeping the schema country-
neutral lets later reports add a country without copying the presentation code.
"""

from __future__ import annotations

import csv
import gzip
import hashlib
import io
import json
import re
import subprocess
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
OUTPUT_DIR = ROOT / "data" / "money-reports"
ECONOMIC_FACTS = ROOT / "data" / "economy" / "economic-observations.v1.csv.gz"
CNB_MONEY_URL = "https://www.cnb.cz/cs/statistika/menova_bankovni_stat/narodni_stat_data/mp.htm"
FRED_SERIES = ("M1SL", "M2SL", "CURRSL", "FEDFUNDS", "CPIAUCSL")
FRED_URL = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={','.join(FRED_SERIES)}"


def fetch_text(url: str) -> str:
    completed = subprocess.run(
        ["curl", "--http1.1", "--location", "--fail", "--silent", "--show-error", "--max-time", "20", url],
        check=True, capture_output=True,
    )
    body = completed.stdout
    content_type = "application/zip" if body.startswith(b"PK\x03\x04") else "text/plain"
    if content_type == "application/zip" or body.startswith(b"PK\x03\x04"):
        with zipfile.ZipFile(io.BytesIO(body)) as archive:
            csv_name = next(name for name in archive.namelist() if name.lower().endswith(".csv"))
            body = archive.read(csv_name)
    return body.decode("utf-8", errors="replace")


def parse_number(value: str) -> float | None:
    value = value.strip().replace("\xa0", "")
    if not value or value in {".", "..", "—"}:
        return None
    return float(value)


def parse_czech_number(value: str) -> float | None:
    value = value.strip().replace("\xa0", "").replace(" ", "")
    if not value or value in {".", "..", "—", "-"}:
        return None
    return float(value.replace(".", "").replace(",", "."))


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_table = False
        self.in_cell = False
        self.cell_parts: list[str] = []
        self.row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "table" and not self.in_table:
            self.in_table = True
        elif self.in_table and tag in {"td", "th"}:
            self.in_cell = True
            self.cell_parts = []
        elif self.in_table and tag == "tr":
            self.row = []

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.cell_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self.in_table and tag in {"td", "th"} and self.in_cell:
            self.row.append(" ".join("".join(self.cell_parts).split()))
            self.in_cell = False
        elif self.in_table and tag == "tr" and self.row:
            self.rows.append(self.row)
        elif self.in_table and tag == "table":
            self.in_table = False


def cnb_series() -> dict[str, list[list[float | str]]]:
    parser = TableParser()
    parser.feed(fetch_text(CNB_MONEY_URL))
    header = parser.rows[0]
    periods = [value.replace("/", "-") for value in header[1:]]
    patterns = {
        "currency": r"\(1\.1\) Oběživo$",
        "m1": r"\(1\.3\) M1 ",
        "m2": r"\(1\.7\) M2 ",
        "m3": r"\(1\) M3 ",
        "m1_yoy": r"^M1 - roční míra růstu",
        "m2_yoy": r"^M2- roční míra růstu",
        "m3_yoy": r"^M3 - roční míra růstu",
        "private_credit": r"^\(4\.2\) Úvěry soukromému sektoru",
        "government_credit": r"^\(4\.1\) Úvěry vládním institucím",
        "net_foreign_assets": r"^\(5\) Čistá zahraniční aktiva",
    }
    result: dict[str, list[list[float | str]]] = {}
    for code, pattern in patterns.items():
        row = next((item for item in parser.rows if item and re.search(pattern, item[0])), None)
        if not row:
            raise RuntimeError(f"CNB table row missing: {code}")
        values = [parse_czech_number(value) for value in row[1:1 + len(periods)]]
        scale = 1 if code.endswith("_yoy") else 1 / 1_000_000  # CZK millions -> trillions
        result[code] = [[period, round(value * scale, 4)] for period, value in zip(periods, values) if value is not None]
    return result


def fred_series() -> dict[str, list[list[float | str]]]:
    result: dict[str, list[list[float | str]]] = defaultdict(list)
    rows = csv.DictReader(io.StringIO(fetch_text(FRED_URL)))
    for row in rows:
        period = row["observation_date"][:7]
        if period < "2000-01":
            continue
        for code in FRED_SERIES:
            value = parse_number(row.get(code, ""))
            if value is not None:
                result[code].append([period, value])
    for row in csv.DictReader(io.StringIO(fetch_text("https://fred.stlouisfed.org/graph/fredgraph.csv?id=WALCL"))):
        period = row["observation_date"][:7]
        value = parse_number(row.get("WALCL", ""))
        if period >= "2000-01" and value is not None:
            result["WALCL"].append([period, value])
    result["WALCL"] = [[period, value] for period, value in dict(result["WALCL"]).items()]
    # FRED publishes WALCL in USD millions; money stocks and GDP are USD billions.
    result["WALCL"] = [[period, round(value / 1000, 3)] for period, value in result["WALCL"]]
    return dict(result)


def local_economic_series(country: str, codes: set[str]) -> dict[str, list[list[float | str]]]:
    result: dict[str, list[list[float | str]]] = defaultdict(list)
    with gzip.open(ECONOMIC_FACTS, "rt", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["country_code"] != country or row["indicator_code"] not in codes:
                continue
            if row["frequency"] not in {"A", "M"}:
                continue
            result[row["indicator_code"]].append([row["period"], float(row["value"])])
    for values in result.values():
        values.sort(key=lambda item: item[0])
    return dict(result)


def yoy(values: list[list[float | str]], months: int = 12) -> list[list[float | str]]:
    output = []
    for index in range(months, len(values)):
        current = float(values[index][1])
        prior = float(values[index - months][1])
        if prior:
            output.append([values[index][0], round((current / prior - 1) * 100, 3)])
    return output


def annual_index_from_inflation(values: list[list[float | str]], start: int = 2000) -> list[list[float | str]]:
    rates = {int(period[:4]): float(value) for period, value in values}
    index = 100.0
    output = [[str(start), index]]
    for year in range(start + 1, max(rates) + 1):
        if year not in rates:
            continue
        index *= 1 + rates[year] / 100
        output.append([str(year), round(index, 3)])
    return output


def interventions() -> dict[str, list[dict]]:
    return {
        "CZE": [
            {"date":"2013-11","type":"fx","title_cs":"Kurzový závazek","title_en":"Exchange-rate commitment","detail_cs":"ČNB začala bránit posílení koruny pod přibližně 27 Kč za euro poté, co vyčerpala prostor pro další snížení sazeb.","detail_en":"After exhausting room for further rate cuts, the CNB began preventing appreciation beyond roughly CZK 27 per euro.","source":"https://www.cnb.cz/en/faq/What-was-the-exchange-rate-commitment"},
            {"date":"2017-04","type":"fx","title_cs":"Ukončení kurzového závazku","title_en":"Commitment ends","detail_cs":"Bankovní rada ukončila režim 6. dubna 2017; kurz se vrátil k řízenému plování.","detail_en":"The Bank Board ended the regime on 6 April 2017 and returned the koruna to a managed float.","source":"https://www.cnb.cz/en/cnb-news/press-releases/5e737306-3a7c-11e8-a804-5254004e4603"},
            {"date":"2020-03","type":"rate","title_cs":"Pandemické snížení sazeb","title_en":"Pandemic rate cuts","detail_cs":"Od března do května 2020 ČNB snížila dvoutýdenní repo sazbu z 2,25 % na 0,25 % a uvolnila úvěrové podmínky.","detail_en":"From March to May 2020, the CNB cut its two-week repo rate from 2.25% to 0.25% and eased credit conditions.","source":"https://www.cnb.cz/en/monetary-policy/inflation-reports/boxes-and-annexes-contained-in-inflation-reports/The-CNBs-measures-in-response-to-the-Covid-19-pandemic/"},
            {"date":"2021-06","type":"rate","title_cs":"Začátek cyklu zvyšování","title_en":"Tightening cycle begins","detail_cs":"ČNB začala zvyšovat sazby; dvoutýdenní repo sazba následně dosáhla v červnu 2022 úrovně 7 %.","detail_en":"The CNB began raising rates; the two-week repo rate subsequently reached 7% in June 2022.","source":"https://www.cnb.cz/en/cnb-news/press-releases/CNB-increases-interest-rates-by-25-basis-points/"},
            {"date":"2022-05","type":"fx","title_cs":"Intervence proti oslabení koruny","title_en":"Intervention against depreciation","detail_cs":"ČNB začala prodávat devizové rezervy, aby omezila oslabení koruny během vysoké inflace. V roce 2022 prodala 25,5 mld. EUR.","detail_en":"The CNB sold foreign reserves to limit koruna depreciation during high inflation, selling EUR 25.5bn in 2022.","source":"https://www.cnb.cz/en/cnb-news/press-releases/CNB-intervenes-on-the-FX-market-against-depreciation-of-the-koruna-00002/"},
            {"date":"2023-08","type":"fx","title_cs":"Formální konec intervenčního režimu","title_en":"Intervention regime formally ends","detail_cs":"ČNB režim formálně ukončila; na trhu nebyla aktivní od října 2022.","detail_en":"The CNB formally ended the regime; it had not been active in the market since October 2022.","source":"https://www.cnb.cz/export/sites/cnb/en/monetary-policy/.galleries/strategic_documents/maastricht_assessment_2025.pdf"},
            {"date":"2023-12","type":"rate","title_cs":"Začátek snižování sazeb","title_en":"Rate-cutting cycle begins","detail_cs":"Bankovní rada snížila dvoutýdenní repo sazbu o 0,25 bodu na 6,75 %.","detail_en":"The Bank Board cut the two-week repo rate by 0.25 percentage point to 6.75%.","source":"https://www.cnb.cz/en/cnb-news/press-releases/CNB-cuts-interest-rates-00004/"},
        ],
        "USA": [
            {"date":"2008-11","type":"asset","title_cs":"QE1 a podpora bydlení","title_en":"QE1 and housing support","detail_cs":"Fed oznámil nákupy agenturních dluhopisů a hypotečních cenných papírů; v březnu 2009 program výrazně rozšířil a přidal státní dluhopisy.","detail_en":"The Fed announced agency-debt and mortgage-backed-security purchases, then expanded them sharply in March 2009 and added Treasuries.","source":"https://www.federalreserve.gov/newsevents/pressreleases/monetary20090318a.htm"},
            {"date":"2010-11","type":"asset","title_cs":"QE2","title_en":"QE2","detail_cs":"FOMC oznámil nákup dalších 600 mld. USD dlouhodobých státních dluhopisů.","detail_en":"The FOMC announced purchases of a further $600bn in longer-term Treasury securities.","source":"https://www.federalreserve.gov/newsevents/pressreleases/monetary20101103a.htm"},
            {"date":"2012-09","type":"asset","title_cs":"QE3","title_en":"QE3","detail_cs":"Fed spustil otevřené nákupy hypotečních cenných papírů tempem 40 mld. USD měsíčně a později přidal státní dluhopisy.","detail_en":"The Fed launched open-ended MBS purchases at $40bn per month and later added Treasury purchases.","source":"https://www.federalreserve.gov/newsevents/pressreleases/monetary20120913a.htm"},
            {"date":"2015-12","type":"rate","title_cs":"První zvýšení sazeb po krizi","title_en":"Post-crisis liftoff","detail_cs":"FOMC zvýšil cílové pásmo z téměř nulové úrovně a zahájil normalizaci sazeb.","detail_en":"The FOMC raised the target range from near zero and began rate normalisation.","source":"https://www.federalreserve.gov/newsevents/pressreleases/monetary20151216a.htm"},
            {"date":"2020-03","type":"emergency","title_cs":"Pandemická reakce","title_en":"Pandemic response","detail_cs":"Fed snížil sazby k nule, nakupoval státní a hypoteční cenné papíry podle potřeby a otevřel nouzové úvěrové programy pro klíčové trhy.","detail_en":"The Fed cut rates to near zero, bought Treasuries and MBS as needed, and opened emergency credit facilities for key markets.","source":"https://www.federalreserve.gov/monetarypolicy/bsd-overview-202008.htm"},
            {"date":"2022-03","type":"rate","title_cs":"Utahování proti inflaci","title_en":"Inflation tightening","detail_cs":"FOMC zahájil zvyšování sazeb; od června 2022 začal také snižovat objem držených cenných papírů.","detail_en":"The FOMC began raising rates and, from June 2022, also started reducing its securities holdings.","source":"https://www.federalreserve.gov/newsevents/pressreleases/monetary20220316a.htm"},
            {"date":"2023-03","type":"emergency","title_cs":"Bank Term Funding Program","title_en":"Bank Term Funding Program","detail_cs":"Po problémech regionálních bank Fed zavedl termínované financování proti kvalitním cenným papírům oceňovaným v nominální hodnotě.","detail_en":"Following regional-bank stress, the Fed introduced term funding against eligible high-quality securities valued at par.","source":"https://www.federalreserve.gov/newsevents/pressreleases/monetary20230312a.htm"},
            {"date":"2025-12","type":"asset","title_cs":"Konec snižování rozvahy","title_en":"Balance-sheet runoff ends","detail_cs":"Po poklesu držených cenných papírů o více než 2,2 bilionu USD Fed od 1. prosince 2025 ukončil jejich další samovolné snižování.","detail_en":"After securities holdings fell by more than $2.2tn, the Fed ended balance-sheet runoff from 1 December 2025.","source":"https://www.federalreserve.gov/monetarypolicy/policy-normalization.htm"},
        ],
    }


def build() -> None:
    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    cnb = cnb_series()
    fred = fred_series()
    econ_cze = local_economic_series("CZE", {"broad_money", "consumer_price_inflation_annual", "central_bank_policy_rate", "real_gdp_per_capita"})
    econ_usa = local_economic_series("USA", {"broad_money", "consumer_price_inflation_annual", "real_gdp_per_capita"})
    events = interventions()

    cze = {
        "schema_version":"1.0.0","generated_at":retrieved_at,
        "country":{"code":"CZE","slug":"cze","name_cs":"Česko","name_en":"Czechia","currency":"CZK","currency_unit_cs":"bil. Kč","currency_unit_en":"CZK tn","central_bank_cs":"Česká národní banka","central_bank_en":"Czech National Bank","peer":{"code":"USA","slug":"usa","name_cs":"Spojené státy","name_en":"United States"}},
        "definitions":{"broadest":"M3","cash":"Oběživo","m1_cs":"Oběživo + jednodenní vklady","m1_en":"Currency + overnight deposits","m2_cs":"M1 + likvidní krátkodobé vklady","m2_en":"M1 + liquid short-term deposits","broad_cs":"M2 + repo operace, fondy peněžního trhu a krátké dluhopisy","broad_en":"M2 + repos, money-market funds and short debt securities","break_note_cs":"Harmonizované agregáty zahrnují závazky českých MFI vůči rezidentům mimo centrální vládu.","break_note_en":"Harmonised aggregates cover Czech MFI liabilities to residents other than central government."},
        "series":{"cash":cnb["currency"],"m1":cnb["m1"],"m2":cnb["m2"],"broad":cnb["m3"],"m1_yoy":cnb["m1_yoy"],"m2_yoy":cnb["m2_yoy"],"broad_yoy":cnb["m3_yoy"],"broad_to_gdp":econ_cze.get("broad_money", []),"inflation":econ_cze.get("consumer_price_inflation_annual", []),"price_index":annual_index_from_inflation(econ_cze.get("consumer_price_inflation_annual", [])),"real_gdp_per_capita":econ_cze.get("real_gdp_per_capita", []),"policy_rate":econ_cze.get("central_bank_policy_rate", []),"government_credit":cnb["government_credit"],"private_credit":cnb["private_credit"],"net_foreign_assets":cnb["net_foreign_assets"]},
        "interventions":events["CZE"],
        "sources":[
            {"name":"CNB monetary overview / ARAD","url":CNB_MONEY_URL,"note_cs":"Měsíční stavy, růst a protipoložky M3; poslední období předběžné.","note_en":"Monthly stocks, growth and M3 counterparts; latest period provisional."},
            {"name":"World Bank WDI","url":"https://data.worldbank.org/indicator/FM.LBL.BMNY.GD.ZS","note_cs":"Dlouhá roční řada širokých peněz vůči HDP a makroekonomické kontextové řady.","note_en":"Long annual broad-money-to-GDP series and macroeconomic context."},
            {"name":"BIS","url":"https://data.bis.org/topics/CBPOL","note_cs":"Srovnatelná měsíční měnověpolitická sazba.","note_en":"Comparable monthly central-bank policy rate."},
        ]
    }
    usa = {
        "schema_version":"1.0.0","generated_at":retrieved_at,
        "country":{"code":"USA","slug":"usa","name_cs":"Spojené státy","name_en":"United States","currency":"USD","currency_unit_cs":"bil. USD","currency_unit_en":"USD tn","central_bank_cs":"Federální rezervní systém","central_bank_en":"Federal Reserve System","peer":{"code":"CZE","slug":"cze","name_cs":"Česko","name_en":"Czechia"}},
        "definitions":{"broadest":"M2","cash":"Currency","m1_cs":"Oběživo + vklady splatné na požádání + ostatní likvidní vklady","m1_en":"Currency + demand deposits + other liquid deposits","m2_cs":"M1 + malé termínované vklady a retailové fondy peněžního trhu","m2_en":"M1 + small time deposits and retail money-market funds","broad_cs":"Fed od roku 2006 M3 nezveřejňuje; nejširším aktuálním agregátem je M2.","broad_en":"The Fed discontinued M3 in 2006; M2 is its broadest current aggregate.","break_note_cs":"V květnu 2020 byly spořicí vklady přesunuty do M1. Skok M1 je změna definice, nikoli čistá tvorba peněz.","break_note_en":"Savings deposits moved into M1 in May 2020. The M1 jump is a definition change, not pure money creation."},
        "series":{"cash":[[period, round(float(value) / 1000, 4)] for period, value in fred["CURRSL"]],"m1":[[period, round(float(value) / 1000, 4)] for period, value in fred["M1SL"]],"m2":[[period, round(float(value) / 1000, 4)] for period, value in fred["M2SL"]],"broad":[[period, round(float(value) / 1000, 4)] for period, value in fred["M2SL"]],"m1_yoy":yoy(fred["M1SL"]),"m2_yoy":yoy(fred["M2SL"]),"broad_yoy":yoy(fred["M2SL"]),"broad_to_gdp":econ_usa.get("broad_money", []),"inflation":econ_usa.get("consumer_price_inflation_annual", []),"price_index":annual_index_from_inflation(econ_usa.get("consumer_price_inflation_annual", [])),"real_gdp_per_capita":econ_usa.get("real_gdp_per_capita", []),"policy_rate":fred["FEDFUNDS"],"central_bank_assets":fred["WALCL"]},
        "interventions":events["USA"],
        "sources":[
            {"name":"Federal Reserve H.6 via FRED","url":"https://fred.stlouisfed.org/categories/24","note_cs":"Měsíční M1, M2 a oběživo; sezonně očištěné agregáty.","note_en":"Monthly M1, M2 and currency; seasonally adjusted aggregates."},
            {"name":"Federal Reserve H.4.1 via FRED","url":"https://fred.stlouisfed.org/series/WALCL","note_cs":"Týdenní celková aktiva Federálního rezervního systému.","note_en":"Weekly total assets of the Federal Reserve System."},
            {"name":"World Bank WDI","url":"https://data.worldbank.org/indicator/FM.LBL.BMNY.GD.ZS","note_cs":"Roční mezinárodně srovnatelný makroekonomický kontext.","note_en":"Annual internationally comparable macroeconomic context."},
        ]
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for payload in (cze, usa):
        path = OUTPUT_DIR / f"{payload['country']['slug']}.v1.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        files.append(path)
    manifest = {
        "schema_version":"1.0.0","generated_at":retrieved_at,"countries":["CZE","USA"],
        "files":[{"path":path.name,"bytes":path.stat().st_size,"sha256":hashlib.sha256(path.read_bytes()).hexdigest()} for path in files],
        "schema_note":"Every country file uses the same presentation contract; country-specific definitions and series remain explicit."
    }
    (OUTPUT_DIR / "manifest.v1.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
