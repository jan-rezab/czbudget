#!/usr/bin/env python3
"""Merge imported European municipalities into the public directory and build profiles."""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import urllib.request
from pathlib import Path

from import_european_municipal_benchmarks import COUNTRY_META, ROOT, slugify
from municipal_profile_template import render_municipal_profile_shell


# Imported from the unversioned sibling scripts/ directory.
#
# ROOT comes from import_european_municipal_benchmarks (same directory), which
# resolves CZBUDGET_WORKSPACE_ROOT. The old CZBUDGET_WEB_ROOT override was
# spelled differently from every other transform and was set nowhere in the
# tree, so it was dead configuration; CZBUDGET_WORKSPACE_ROOT is the one
# convention.
WEB = ROOT / "website"

# One public origin for everything this generator emits. It previously wrote
# the private Cloud Run hostname (GCP project number included) into the sitemap
# and fetched the live site through it, so a run would have replaced canonical
# publicspendingdata.org sitemap entries with run.app URLs. PUBLIC_ORIGIN is
# overridable for a staging run but never defaults to an internal hostname.
SITE_BASE = os.environ.get("PUBLIC_ORIGIN", "https://publicspendingdata.org").rstrip("/")
PUBLIC_BASE = "https://publicspendingdata.org/data/international-municipalities.v1.json"
COUNTRIES = {
    "NOR": {
        "alpha2": "NO", "source": "https://www.ssb.no/en/offentlig-sektor/kommunale-finanser/statistikk/kommuneregnskap",
        "coverage_en": "All 357 municipalities plus Longyearbyen; 2015–2025 headline accounts and 2025 detail across 97 KOSTRA functions",
        "coverage_cs": "Všech 357 obcí plus Longyearbyen; souhrnné účty 2015–2025 a detail roku 2025 napříč 97 funkcemi KOSTRA",
        "years": list(range(2015, 2026)), "measures": ["revenue", "expenditure", "balance"],
    },
    "NLD": {
        "alpha2": "NL", "source": "https://www.cbs.nl/nl-nl/onze-diensten/open-data/iv3",
        "coverage_en": "All municipalities in CBS Iv3 annual accounts; native task fields and economic categories",
        "coverage_cs": "Všechny obce v ročních účtech CBS Iv3; původní funkční a ekonomické členění",
        "years": [2024, 2025], "measures": ["revenue", "expenditure", "balance"],
    },
    "FIN": {
        "alpha2": "FI", "source": "https://pxdata.stat.fi/PxWeb/pxweb/en/Kuntien_talous_ja_toiminta/",
        "coverage_en": "All 310 municipalities in the 2020 census; 203 financial-statement measures, 2015–2020 archive",
        "coverage_cs": "Všech 310 obcí v roce 2020; 203 položek účetních výkazů v archivu 2015–2020",
        "years": list(range(2015, 2021)), "measures": ["revenue", "expenditure", "balance"],
    },
}


def esc(value: object) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def fmt(value: float | None, currency: str) -> str:
    if value is None:
        return "—"
    absolute = abs(value)
    if absolute >= 1_000_000_000:
        return f"{value / 1_000_000_000:,.1f} bn {currency}"
    return f"{value / 1_000_000:,.1f} m {currency}"


def load_base(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        request = urllib.request.Request(PUBLIC_BASE, headers={"User-Agent": "czbudget-public/1.0"})
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.load(response)


def materialize_text(path: Path, public_url: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        request = urllib.request.Request(public_url, headers={"User-Agent": "czbudget-public/1.0"})
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.read().decode("utf-8")


def update_existing_navigation() -> None:
    country_js = WEB / "municipalities-country.js"
    source = materialize_text(country_js, f"{SITE_BASE}/municipalities-country.js")
    old = 'const slugs={CZE:"czechia",POL:"poland",DNK:"denmark",FRA:"france",SWE:"sweden",GBR:"england",UKR:"ukraine"};'
    new = 'const slugs={CZE:"czechia",POL:"poland",DNK:"denmark",FRA:"france",SWE:"sweden",GBR:"england",UKR:"ukraine",NOR:"norway",NLD:"netherlands",FIN:"finland"};'
    if old not in source and new not in source:
        raise RuntimeError("municipalities-country.js route map changed unexpectedly")
    country_js.write_text(source.replace(old, new), encoding="utf-8")

    navigator_js = WEB / "municipalities.js"
    source = materialize_text(navigator_js, f"{SITE_BASE}/municipalities.js")
    replacements = {
        "Obce napříč<br><em>sedmi zeměmi.</em>": "Obce napříč<br><em>deseti zeměmi.</em>",
        "Municipalities across<br><em>seven countries.</em>": "Municipalities across<br><em>ten countries.</em>",
        "Místní rozpočty · 2024 + 2025": "Místní rozpočty · víceletá řada",
        "Local budgets · 2024 + 2025": "Local budgets · multi-year coverage",
        "2024 + 2025 · national sources": "2015–2025 · national sources",
    }
    for old_text, new_text in replacements.items():
        source = source.replace(old_text, new_text)
    navigator_js.write_text(source, encoding="utf-8")

    navigator_html = WEB / "municipalities/index.html"
    source = materialize_text(navigator_html, f"{SITE_BASE}/municipalities/")
    for old_text, new_text in replacements.items():
        source = source.replace(old_text, new_text)
    navigator_html.write_text(source, encoding="utf-8")


def update_sitemap(entities: list[dict]) -> None:
    sitemap = WEB / "sitemap.xml"
    request = urllib.request.Request(f"{SITE_BASE}/sitemap.xml", headers={"User-Agent": "czbudget-municipal-pipeline/1.0 (+https://www.czbudget.cz)"})
    with urllib.request.urlopen(request, timeout=120) as response:
        source = response.read().decode("utf-8")
    source = re.sub(r"\s*<url><loc>[^<]*/municipalities/(?:norway|netherlands|finland)/[^<]*</loc>.*?</url>", "", source)
    paths = [f"/municipalities/{COUNTRY_META[code]['slug']}/" for code in ("NOR", "NLD", "FIN")]
    paths.extend(entity["url"] for entity in entities)
    rows = "\n".join(f"  <url><loc>{SITE_BASE}{esc(path)}</loc></url>" for path in paths)
    if "</urlset>" not in source:
        raise RuntimeError("Unexpected sitemap format")
    # Replacing an evicted iCloud placeholder can otherwise block while macOS
    # attempts to hydrate the obsolete local copy before opening it for write.
    if sitemap.exists():
        sitemap.unlink()
    sitemap.write_text(source.replace("</urlset>", rows + "\n</urlset>"), encoding="utf-8")


def country_record(code: str, count: int) -> dict:
    base, meta = COUNTRIES[code], COUNTRY_META[code]
    return {
        "code": code, "alpha2": base["alpha2"], "name_cs": meta["name_cs"], "name_en": meta["name_en"],
        "currency": meta["currency"], "status": "complete", "directory_count": count,
        "years": base["years"], "stages": ["actual"], "measures": base["measures"],
        "coverage_cs": base["coverage_cs"], "coverage_en": base["coverage_en"], "source": base["source"],
    }


def navigation_root(depth: int) -> str:
    return "../" * depth


def profile_page(entity: dict) -> str:
    country, meta = entity["country"], COUNTRY_META[entity["country"]]
    return render_municipal_profile_shell(
        name=entity["name"],
        country_name=meta["name_en"],
        canonical_path=entity["url"],
        profile_data_path=f"../../../data/municipal-benchmarks/{country.lower()}/{entity['code']}.json",
        source_url=entity["source_url"],
        profile=entity,
        coverage_note=COUNTRIES[country]["coverage_en"],
        default_language="en",
    )


def legacy_profile_page(entity: dict) -> str:
    """Previous static renderer retained temporarily for fixture comparison."""
    country, meta = entity["country"], COUNTRY_META[entity["country"]]
    latest, currency = entity["latest"], entity["currency"]
    rows = "".join(
        f"<tr><th>{row['year']}</th><td>{fmt(row.get('revenue'), currency)}</td><td>{fmt(row.get('expenditure'), currency)}</td><td>{fmt(row.get('balance'), currency)}</td><td>{fmt(row.get('debt'), currency)}</td></tr>"
        for row in reversed(entity["history"])
    )
    breakdown_rows = entity.get("breakdown", [])
    if entity.get("breakdown_kind") == "native_measures":
        breakdown = "".join(
            f"<tr><th>{esc(row['code'])}</th><td>{esc(row['name'])}</td><td>{fmt(row.get('amount'), currency)}</td></tr>"
            for row in breakdown_rows
        )
        breakdown_head = "<tr><th>Code</th><th>Native accounting measure</th><th>Amount</th></tr>"
        breakdown_copy = f"All {len(breakdown_rows)} reported measures for the latest year are shown with their original national labels."
    else:
        breakdown = "".join(
            f"<tr><th>{esc(row['code'])}</th><td>{esc(row['name'])}</td><td>{fmt(row.get('expenditure'), currency)}</td><td>{fmt(row.get('revenue'), currency)}</td></tr>"
            for row in breakdown_rows
        )
        breakdown_head = "<tr><th>Code</th><th>Function</th><th>Expenditure</th><th>Revenue</th></tr>"
        breakdown_copy = f"All {len(breakdown_rows)} reported functions are shown with the original national task codes."
    breakdown_section = "" if not breakdown else f"<section class=\"municipal-profile-section\"><div><span class=\"kicker\">Latest year · complete native detail</span><h2>Where the municipality records activity.</h2><p>{breakdown_copy} Nothing is silently mapped to a cross-country category.</p></div><details class=\"native-measure-table\" open><summary>Show all native measures · {len(breakdown_rows)}</summary><div class=\"profile-table-scroll\" role=\"region\" tabindex=\"0\" aria-label=\"Data table, scrolls horizontally\"><table><thead>{breakdown_head}</thead><tbody>{breakdown}</tbody></table></div></details></section>"
    return f"""<!doctype html><html lang="en"><head><script src="/language-bootstrap.js?v=20260822-no-language-flash"></script><link rel="stylesheet" href="../../../site-header.css?v=20260824-header-lockup" data-psd-site-header><script src="../../../global-nav.js?v=20260824-identity-outlines" defer></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(entity['name'])} municipal finances — Public Spending Data</title><meta name="description" content="Official municipal finance history and native accounting measures for {esc(entity['name'])}, {esc(meta['name_en'])}."><link rel="canonical" href="{SITE_BASE}{esc(entity['url'])}"><link rel="stylesheet" href="../../../chart-system.css"><link rel="stylesheet" href="../../../municipalities.css"><link rel="stylesheet" href="../../../municipal-benchmark-profile.css?v=20260824-box-sizing"><link rel="stylesheet" href="../../../municipal-benchmark-native.css?v=20260824-native-wrap"></head><body class="municipalities-page benchmark-profile"><psd-site-header></psd-site-header><main><nav class="breadcrumbs"><a href="../../">Europe</a><span>›</span><a href="../">{esc(meta['name_en'])}</a><span>›</span><strong>{esc(entity['name'])}</strong></nav><section class="municipal-profile-hero"><div><span class="eyebrow"><i class="live-dot"></i>{esc(meta['name_en'])} · official accounts</span><h1>{esc(entity['name'])}</h1><p>National code {esc(entity['code'])}. {len(entity['history'])} annual observations and {entity['measure_count']} native accounting measures are retained for benchmarking.</p></div><aside><span>Latest observation</span><strong>{latest['year']}</strong><small>{esc(currency)} · actual accounts</small></aside></section><section class="municipal-profile-kpis"><article><span>Revenue</span><strong>{fmt(latest.get('revenue'), currency)}</strong></article><article><span>Expenditure</span><strong>{fmt(latest.get('expenditure'), currency)}</strong></article><article><span>Fiscal result</span><strong>{fmt(latest.get('balance'), currency)}</strong></article><article><span>Debt</span><strong>{fmt(latest.get('debt'), currency)}</strong></article></section><section class="municipal-profile-section"><div><span class="kicker">History</span><h2>One town, every available year.</h2><p>Nominal local currency. Definitions follow the national source and are not silently relabelled.</p></div><div class="profile-table-scroll" role="region" tabindex="0" aria-label="Data table, scrolls horizontally"><table><thead><tr><th>Year</th><th>Revenue</th><th>Expenditure</th><th>Result</th><th>Debt</th></tr></thead><tbody>{rows}</tbody></table></div></section>{breakdown_section}<section class="data-contract"><div><span class="kicker">Source and machine data</span><h2>Benchmark-ready, with the original codes.</h2><p>The downloadable JSON includes the complete profile history and latest native accounting detail. The analytical fact archive retains every accounting row.</p></div><div class="source-list"><a href="{esc(entity['source_url'])}" target="_blank" rel="noopener"><span>Official source</span><strong>Open ↗</strong></a><a href="../../../data/municipal-benchmarks/{country.lower()}/{esc(entity['code'])}.json"><span>Profile data</span><strong>JSON ↗</strong></a></div></section></main></body></html>"""


def country_page(code: str, entities: list[dict]) -> str:
    meta, info = COUNTRY_META[code], COUNTRIES[code]
    return f"""<!doctype html><html lang="en" data-country-code="{code}"><head><script src="/language-bootstrap.js?v=20260822-no-language-flash"></script><link rel="stylesheet" href="../../site-header.css?v=20260822-component" data-psd-site-header><script src="../../global-nav.js?v=20260822-component" defer></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(meta['name_en'])} municipal finances — Public Spending Data</title><meta name="description" content="Search official municipality-level finance records for {esc(meta['name_en'])}."><link rel="canonical" href="{SITE_BASE}/municipalities/{esc(meta['slug'])}/"><link rel="stylesheet" href="../../chart-system.css"><link rel="stylesheet" href="../../municipalities.css"><link rel="stylesheet" href="../../municipal-benchmark-profile.css?v=20260824-box-sizing"><script src="../../municipality-benchmark-country.js" defer></script></head><body class="municipalities-page benchmark-country"><psd-site-header></psd-site-header><main><nav class="breadcrumbs"><a href="../">Europe</a><span>›</span><strong>{esc(meta['name_en'])}</strong></nav><section class="municipal-profile-hero"><div><span class="eyebrow"><i class="live-dot"></i>{esc(meta['name_en'])} · municipal census</span><h1>{esc(meta['name_en'])}<br><em>municipal finances.</em></h1><p>{esc(info['coverage_en'])}</p></div><aside><span>Covered entities</span><strong>{len(entities):,}</strong><small>{min(info['years'])}–{max(info['years'])}</small></aside></section><section class="directory"><div class="directory-title"><div><span class="kicker">Municipality directory</span><h2>Find a town.</h2></div><p id="benchmark-country-count">{len(entities):,} entities</p></div><form class="directory-filters"><label class="filter-search"><span>Search</span><input id="benchmark-country-query" type="search" placeholder="Name or national code…"></label><button id="benchmark-country-reset" type="reset">Reset</button></form><div class="municipality-grid" id="benchmark-country-grid"></div><button class="load-more" id="benchmark-country-more" type="button">Load more</button></section><section class="data-contract"><div><span class="kicker">National source</span><h2>Native classifications preserved.</h2><p>The analytical archive retains the original national accounting codes for future benchmarking.</p></div><div class="source-list"><a href="{esc(info['source'])}" target="_blank" rel="noopener"><span>Official source</span><strong>Open ↗</strong></a></div></section></main></body></html>"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--base", type=Path, default=WEB / "data/international-municipalities.v1.json")
    parser.add_argument("--profiles-only", action="store_true", help="Regenerate benchmark profile JSON/HTML without changing directories, navigation, or sitemap")
    args = parser.parse_args()
    imported = json.loads(args.input.read_text(encoding="utf-8"))
    base = load_base(args.base)
    imported_codes = set(COUNTRIES)
    if not args.profiles_only:
        base["countries"] = [row for row in base["countries"] if row["code"] not in imported_codes]
        base["entities"] = [row for row in base["entities"] if row["country"] not in imported_codes]
    by_country: dict[str, list[dict]] = {code: [] for code in imported_codes}
    for entity in imported["entities"]:
        by_country[entity["country"]].append(entity)
        latest = entity["latest"]
        if not args.profiles_only:
            base["entities"].append({
                "id": entity["id"], "country": entity["country"], "code": entity["code"], "name": entity["name"],
                "region": None, "currency": entity["currency"], "years": entity["years"],
                "revenue": latest.get("revenue"), "expenditure": latest.get("expenditure"), "balance": latest.get("balance"),
                "population": None, "url": entity["url"],
            })
    if not args.profiles_only:
        base["countries"].extend(country_record(code, len(by_country[code])) for code in ("NOR", "NLD", "FIN"))
        base["generated_at"] = imported["generated_at"][:10]
        args.base.parent.mkdir(parents=True, exist_ok=True)
        args.base.write_text(json.dumps(base, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    data_root = WEB / "data/municipal-benchmarks"
    for code, entities in by_country.items():
        meta = COUNTRY_META[code]
        country_data = data_root / f"{code.lower()}.json"
        country_data.parent.mkdir(parents=True, exist_ok=True)
        country_data.write_text(json.dumps({"country": country_record(code, len(entities)), "entities": entities}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        entity_dir = data_root / code.lower()
        entity_dir.mkdir(parents=True, exist_ok=True)
        for entity in entities:
            (entity_dir / f"{entity['code']}.json").write_text(json.dumps(entity, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
            page = WEB / entity["url"].lstrip("/") / "index.html"
            page.parent.mkdir(parents=True, exist_ok=True)
            page.write_text(profile_page(entity), encoding="utf-8")
        if not args.profiles_only:
            landing = WEB / "municipalities" / meta["slug"] / "index.html"
            landing.parent.mkdir(parents=True, exist_ok=True)
            landing.write_text(country_page(code, entities), encoding="utf-8")
    if not args.profiles_only:
        update_existing_navigation()
        update_sitemap(imported["entities"])
    print(json.dumps({"countries": len(by_country), "profiles": sum(map(len, by_country.values())), "directory_entities": len(base["entities"])}))


if __name__ == "__main__":
    main()
