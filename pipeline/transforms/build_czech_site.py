#!/usr/bin/env python3
"""Build static, indexable Czech municipality and region pages from the benchmark."""

from __future__ import annotations

import html
import json
import math
import os
import shutil
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote


ROOT = Path(os.environ.get("CZBUDGET_WORKSPACE_ROOT", Path(__file__).resolve().parents[3]))
WEB = ROOT / "website"
DATASET = WEB / "data/benchmark.v1.json"
PUBLIC_ORIGIN = os.environ.get("PUBLIC_ORIGIN", "https://publicspendingdata.org").rstrip("/")
METRICS = {
    "revenue_actual": ("Příjmy", "amounts"),
    "expense_actual": ("Výdaje", "amounts"),
    "cash_current": ("Peníze a vklady", "amounts"),
    "cash_to_expense": ("Krytí výdajů hotovostí", "ratios"),
    "capital_expense_share": ("Podíl kapitálových výdajů", "ratios"),
    "transfer_revenue_share": ("Podíl transferů na příjmech", "ratios"),
    "balance_to_revenue": ("Saldo vůči příjmům", "ratios"),
}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    parts, last_dash = [], False
    for char in ascii_value:
        if char.isalnum():
            parts.append(char)
            last_dash = False
        elif not last_dash:
            parts.append("-")
            last_dash = True
    return "".join(parts).strip("-")


def amount(value: float | None) -> str:
    if value is None:
        return "—"
    absolute = abs(value)
    sign = "−" if value < 0 else ""
    if absolute >= 1_000_000_000:
        return f"{sign}{absolute / 1_000_000_000:.1f}".replace(".", ",") + " mld. Kč"
    if absolute >= 1_000_000:
        return f"{sign}{absolute / 1_000_000:.1f}".replace(".", ",") + " mil. Kč"
    return f"{sign}{absolute:,.0f}".replace(",", " ") + " Kč"


def pct(value: float | None) -> str:
    return "—" if value is None else f"{value * 100:.1f}".replace(".", ",") + " %"


def number(value: float | None) -> str:
    return "" if value is None else f"{value:.2f}"


def entity_path(entity: dict, level: str) -> str:
    group = "municipalities" if level == "municipality" else "kraje"
    return f"/cz/{group}/{entity['seo']['slug']}/"


def percentile(entity: dict, cohort: list[dict], metric: str, section: str) -> int:
    value = entity[section].get(metric) or 0
    values = [(item[section].get(metric) or 0) for item in cohort]
    below = sum(candidate < value for candidate in values)
    equal = sum(candidate == value for candidate in values)
    return round((below + 0.5 * equal) / len(values) * 100)


def head(title: str, description: str, canonical_path: str, depth: int, schema: dict, language: str = "cs") -> str:
    root = "../" * depth
    canonical = PUBLIC_ORIGIN + canonical_path
    schema_json = json.dumps(schema, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    og_locale = "en_GB" if language == "en" else "cs_CZ"
    return f"""<head><script src="/language-bootstrap.js?v=20260822-no-language-flash"></script>
  <link rel="stylesheet" href="{root}site-header.css?v=20260824-header-lockup" data-psd-site-header>
  <script src="{root}global-nav.js?v=20260824-logo-120" defer></script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="{esc(canonical)}">
  <link rel="alternate" hreflang="cs" href="{esc(canonical)}?lang=cs">
  <link rel="alternate" hreflang="en" href="{esc(canonical)}?lang=en">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="{og_locale}">
  <meta property="og:site_name" content="Public Spending Data">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:url" content="{esc(canonical)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{esc(title)}">
  <meta name="twitter:description" content="{esc(description)}">
  <link rel="icon" href="{root}assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="{root}styles.css?v=20260822-brand">
  <link rel="stylesheet" href="{root}cz-budget.css">
  <link rel="stylesheet" href="{root}chart-system.css">
  <script type="application/ld+json">{schema_json}</script>
</head>"""


def header(root: str, active: str = "czech") -> str:
    return "<psd-site-header data-section=\"cities\"></psd-site-header>"


def footer(root: str) -> str:
    return f"""<footer data-global-footer></footer><script src="{root}global-footer.js?v=20260824-compact" defer></script>"""


def prepare_entities(data: dict) -> list[dict]:
    entities = data["entities"]
    used: set[str] = set()
    for entity in entities:
        base = slugify(entity["short_name"])
        slug = base
        suffix = 2
        while slug in used:
            slug = f"{base}-{suffix}"
            suffix += 1
        used.add(slug)
        entity["seo"] = {
            "slug": slug,
            "municipality_path": f"/cz/municipalities/{slug}/" if "municipality" in entity["administrative_levels"] else None,
            "region_path": f"/cz/kraje/{slug}/" if "region" in entity["administrative_levels"] else None,
        }
    return entities


def listing_card(entity: dict, level: str) -> str:
    a, r = entity["amounts"], entity["ratios"]
    balance_kind = "surplus" if a["budget_balance"] >= 0 else "deficit"
    path = entity_path(entity, level)
    risk = "K–Index " + (entity["risk"].get("grade") or "—") if level == "municipality" else "Krajský rozpočet"
    return f"""<article class="entity-card" data-name="{esc(entity['short_name'].lower())}" data-revenue="{number(a['revenue_actual'])}" data-expense="{number(a['expense_actual'])}" data-cash="{number(a['cash_current'])}" data-cash-to-expense="{number(r.get('cash_to_expense') or 0)}" data-capital-share="{number(r.get('capital_expense_share') or 0)}" data-transfer-share="{number(r.get('transfer_revenue_share') or 0)}" data-balance-ratio="{number(r.get('balance_to_revenue') or 0)}" data-balance="{balance_kind}">
  <div class="entity-card-top"><span>{esc(risk)}</span><small>IČO {esc(entity['national_id'])}</small></div>
  <h2><a href="{esc(path)}">{esc(entity['short_name'])}</a></h2>
  <dl><div><dt>Příjmy</dt><dd>{amount(a['revenue_actual'])}</dd></div><div><dt>Výdaje</dt><dd>{amount(a['expense_actual'])}</dd></div><div><dt>Peníze a vklady</dt><dd>{amount(a['cash_current'])}</dd></div><div><dt>Saldo</dt><dd class="{'positive' if a['budget_balance'] >= 0 else 'negative'}">{amount(a['budget_balance'])}</dd></div></dl>
  <a class="entity-detail-link" href="{esc(path)}">Detail rozpočtu <span>↗</span></a>
</article>"""


def build_listing(data: dict, entities: list[dict], level: str) -> None:
    is_region = level == "region"
    cohort = [e for e in entities if level in e["administrative_levels"]]
    cohort.sort(key=lambda e: e["amounts"]["revenue_actual"], reverse=True)
    noun = "krajů" if is_region else "statutárních měst"
    title = ("Rozpočty krajů ČR 2025" if is_region else "Rozpočty obcí a měst ČR 2025") + " — Public Spending Data"
    description = f"Srovnání příjmů, výdajů, salda a peněz na účtech {len(cohort)} {noun}. Filtry, benchmarky a detailní rozpočtové profily."
    canonical_path = "/cz/kraje/" if is_region else "/cz/municipalities/"
    totals = {key: sum(e["amounts"][key] for e in cohort) for key in ("revenue_actual", "expense_actual", "cash_current")}
    schema = {
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": title.split(" — ")[0],
        "description": description,
        "url": PUBLIC_ORIGIN + canonical_path,
        "inLanguage": "cs",
        "temporalCoverage": "2025",
        "spatialCoverage": {"@type": "Country", "name": "Česko"},
        "creator": {"@type": "Organization", "name": "Public Spending Data"},
        "isBasedOn": "https://monitor.statnipokladna.gov.cz/",
        "distribution": {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": PUBLIC_ORIGIN + "/data/benchmark.v1.json"},
    }
    cards = "\n".join(listing_card(entity, level) for entity in cohort)
    active_obce = " active" if not is_region else ""
    active_kraje = " active" if is_region else ""
    accountability_entry = "" if not is_region else """<section class="accountability-entry"><div><span class="kicker">Institucionální vrstva</span><h2>Kdo za rozpočet odpovídá</h2><p>Kdo stanoví pravidla, kdo platí, kdo vlastní, kdo službu poskytuje a kdo kontroluje výsledek. Kraj není rozpočtovým rodičem obcí.</p></div><a class="primary-button" href="accountability/">Otevřít mapu odpovědnosti →</a></section>"""
    output = WEB / ("cz/kraje/index.html" if is_region else "cz/municipalities/index.html")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(f"""<!doctype html>
<html lang="cs">
{head(title, description, canonical_path, 2, schema)}
<body class="cz-budget-page directory-page" data-level="{level}" data-source="../../data/benchmark.v1.json">
{header('../../')}
<main id="top">
  <nav class="breadcrumbs" aria-label="Drobečková navigace"><a href="../../index.html">Domů</a><span>›</span><span>Česko</span><span>›</span><strong>{'Kraje' if is_region else 'Obce a města'}</strong></nav>
  <section class="cz-hero compact-cz-hero">
    <div><span class="eyebrow"><i class="live-dot"></i>České územní rozpočty · skutečnost 2025</span><h1>{'Kraje' if is_region else 'Obce a města'}<br><em>a jejich rozpočty</em></h1><p>{description}</p></div>
    <div class="cohort-switch" aria-label="Úroveň samosprávy"><a class="{active_obce.strip()}" href="../municipalities/">Města <b>27</b></a><a class="{active_kraje.strip()}" href="../kraje/">Kraje <b>14</b></a></div>
  </section>
  {accountability_entry}
  <section class="cz-totals" aria-label="Souhrn kohorty"><article><span>Příjmy</span><strong>{amount(totals['revenue_actual'])}</strong><small>{len(cohort)} účetních jednotek</small></article><article><span>Výdaje</span><strong>{amount(totals['expense_actual'])}</strong><small>{pct(totals['expense_actual']/totals['revenue_actual'])} příjmů</small></article><article><span>Peníze a vklady</span><strong>{amount(totals['cash_current'])}</strong><small>{pct(totals['cash_current']/totals['expense_actual'])} ročních výdajů</small></article></section>
  <section class="directory" id="subjekty">
    <div class="directory-title"><div><span class="kicker">01 / Datový průzkumník</span><h2>Vyhledávání a srovnání</h2></div><p>Filtry mění zobrazení, nikoli účetní data. Částky jsou ve skutečných korunách za rok 2025.</p></div>
    <form class="directory-filters" id="directory-filters">
      <label class="filter-search"><span>Hledat</span><input id="filter-query" type="search" placeholder="Název města nebo kraje…" autocomplete="off"></label>
      <label><span>Metrika</span><select id="filter-metric"><option value="revenue">Příjmy</option><option value="expense">Výdaje</option><option value="cash">Peníze a vklady</option><option value="cash-to-expense">Krytí výdajů hotovostí</option><option value="capital-share">Investiční podíl</option><option value="transfer-share">Podíl transferů</option><option value="balance-ratio">Saldo / příjmy</option></select></label>
      <label><span>Velikost příjmů</span><select id="filter-size"><option value="all">Všechny</option><option value="small">Do 5 mld. Kč</option><option value="medium">5–20 mld. Kč</option><option value="large">Nad 20 mld. Kč</option></select></label>
      <label><span>Saldo</span><select id="filter-balance"><option value="all">Přebytek i schodek</option><option value="surplus">Přebytek</option><option value="deficit">Schodek</option></select></label>
      <label><span>Řazení</span><select id="filter-order"><option value="desc">Od nejvyšší hodnoty</option><option value="asc">Od nejnižší hodnoty</option><option value="name">Podle názvu</option></select></label>
      <button type="reset">Vymazat filtry</button>
    </form>
    <div class="result-meta"><strong id="result-count">{len(cohort)} subjektů</strong><span id="active-metric">Řazeno podle příjmů</span></div>
    <div class="entity-grid" id="entity-grid">{cards}</div>
    <p class="empty-state" id="empty-state" hidden>Žádný subjekt neodpovídá zvoleným filtrům.</p>
  </section>
  <section class="analysis-ready" id="metodika"><div><span class="kicker">02 / Připraveno pro hlubší analýzu</span><h2>Stabilní identita<br>Rozšiřitelná data</h2></div><div class="analysis-grid"><article><b>01</b><h3>Jedna stránka na subjekt</h3><p>Každé město a každý kraj má vlastní trvalou adresu, unikátní metadata a strojově čitelný JSON.</p></article><article><b>02</b><h3>Oddělené kohorty</h3><p>Města porovnáváme s městy a kraje s kraji. Praha je v obou rolích, ale v každé kohortě jen jednou.</p></article><article><b>03</b><h3>Datový kontrakt</h3><p>Identifikace přes country_code a IČO, měna přes ISO kód CZK a metriky ve stabilních polích.</p></article></div></section>
</main>
{footer('../../')}
<script src="../../cz-directory.js" defer></script>
</body></html>\n""", encoding="utf-8")


def stat_bar(label: str, actual: float, planned: float) -> str:
    rate = actual / planned if planned else 0
    width = min(rate * 100, 100)
    return f"""<div class="plan-row"><div><strong>{esc(label)}</strong><span>{amount(actual)} / {amount(planned)}</span></div><div class="plan-track"><i style="width:{width:.2f}%"></i><b>{pct(rate)}</b></div></div>"""


def mix_row(label: str, value: float, total: float, color: str) -> str:
    share = value / total if total else 0
    return f"""<div class="mix-row"><div><i style="background:{color}"></i><strong>{esc(label)}</strong><span>{amount(value)}</span></div><div class="mix-track"><i style="width:{max(share*100, .5):.2f}%;background:{color}"></i><b>{pct(share)}</b></div></div>"""


def build_detail(data: dict, entity: dict, entities: list[dict], level: str) -> None:
    a, r = entity["amounts"], entity["ratios"]
    is_region = level == "region"
    group = "kraje" if is_region else "municipalities"
    label = "kraj" if is_region else "město"
    cohort = [e for e in entities if level in e["administrative_levels"]]
    cohort.sort(key=lambda e: e["short_name"])
    canonical_path = entity_path(entity, level)
    title = f"Rozpočet {'kraje' if is_region else 'města'} {entity['short_name']} 2025 — příjmy, výdaje a účty"
    description = f"Rozpočet {'kraje' if is_region else 'města'} {entity['short_name']} za rok 2025: příjmy {amount(a['revenue_actual'])}, výdaje {amount(a['expense_actual'])}, saldo {amount(a['budget_balance'])} a peníze na účtech {amount(a['cash_current'])}."
    schema = {
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": title,
        "description": description,
        "url": PUBLIC_ORIGIN + canonical_path,
        "inLanguage": "cs",
        "temporalCoverage": "2025",
        "spatialCoverage": {"@type": "AdministrativeArea", "name": entity["short_name"], "addressCountry": "CZ"},
        "about": {"@type": "GovernmentOrganization", "name": entity["name"], "identifier": entity["national_id"]},
        "creator": {"@type": "Organization", "name": "Public Spending Data"},
        "isBasedOn": entity["sources"]["budget"],
        "distribution": {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": PUBLIC_ORIGIN + f"/data/entities/{entity['national_id']}.json"},
    }
    comparison_options = "".join(f"<option value=\"{esc(entity_path(other, level))}\"{' selected' if other['entity_id'] == entity['entity_id'] else ''}>{esc(other['short_name'])}</option>" for other in cohort)
    cash_change = (a["cash_current"] - a["cash_previous"])
    revenue_mix = "".join([
        mix_row("Daňové příjmy", a["tax_revenue"], a["revenue_actual"], "#d9ff69"),
        mix_row("Přijaté transfery", a["transfer_revenue"], a["revenue_actual"], "#86b6ff"),
        mix_row("Nedaňové příjmy", a["nontax_revenue"], a["revenue_actual"], "#ffb36b"),
        mix_row("Kapitálové příjmy", a["capital_revenue"], a["revenue_actual"], "#8298d8"),
    ])
    expense_mix = "".join([
        mix_row("Běžné výdaje", a["current_expense"], a["expense_actual"], "#171a19"),
        mix_row("Kapitálové výdaje", a["capital_expense"], a["expense_actual"], "#47735c"),
    ])
    benchmark_rows = []
    for metric, label_text in [
        ("cash_to_expense", "Krytí výdajů hotovostí"),
        ("capital_expense_share", "Investiční podíl"),
        ("transfer_revenue_share", "Podíl transferů"),
        ("balance_to_revenue", "Saldo vůči příjmům"),
    ]:
        position = percentile(entity, cohort, metric, "ratios")
        benchmark_rows.append(f"""<div class="benchmark-row"><div><strong>{label_text}</strong><span>{pct(r.get(metric))}</span></div><div class="benchmark-track"><i></i><b style="left:calc({position}% - 7px)"></b></div><small>{position}. percentil podle hodnoty</small></div>""")
    badge = f"K–Index {esc(entity['risk'].get('grade') or '—')} · {esc(entity['risk'].get('score') if entity['risk'].get('score') is not None else 'bez skóre')}" if not is_region else "Krajský rozpočet"
    output = WEB / f"cz/{group}/{entity['seo']['slug']}/index.html"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(f"""<!doctype html>
<html lang="cs">
{head(title, description, canonical_path, 3, schema)}
<body class="cz-budget-page detail-page" data-entity-id="{esc(entity['entity_id'])}" data-level="{level}">
{header('../../../')}
<main id="top">
  <nav class="breadcrumbs" aria-label="Drobečková navigace"><a href="../../../index.html">Domů</a><span>›</span><a href="../">{'Kraje' if is_region else 'Obce a města'}</a><span>›</span><strong>{esc(entity['short_name'])}</strong></nav>
  <section class="detail-hero">
    <div><span class="eyebrow"><i class="live-dot"></i>{'Kraj' if is_region else 'Statutární město'} · IČO {esc(entity['national_id'])} · 2025</span><h1>{esc(entity['short_name'])}</h1><p>{esc(description)}</p><div class="detail-actions"><a class="primary-button" href="#rozpocet">Analyzovat rozpočet <b>↓</b></a><a href="../../../data/entities/{esc(entity['national_id'])}.json" download>Stáhnout data JSON</a></div></div>
    <aside class="detail-score"><span>{badge}</span><strong>{pct(r.get('cash_to_expense'))}</strong><small>ročních výdajů kryto penězi a vklady</small></aside>
  </section>
  <section class="detail-kpis" aria-label="Hlavní ukazatele"><article><span>Skutečné příjmy</span><strong>{amount(a['revenue_actual'])}</strong><small>{pct(r.get('revenue_execution'))} upraveného rozpočtu</small></article><article><span>Skutečné výdaje</span><strong>{amount(a['expense_actual'])}</strong><small>{pct(r.get('expense_execution'))} upraveného rozpočtu</small></article><article><span>Saldo</span><strong class="{'positive' if a['budget_balance'] >= 0 else 'negative'}">{amount(a['budget_balance'])}</strong><small>{pct(r.get('balance_to_revenue'))} příjmů</small></article><article><span>Peníze a vklady</span><strong>{amount(a['cash_current'])}</strong><small class="{'positive' if cash_change >= 0 else 'negative'}">{pct(r.get('cash_yoy'))} meziročně</small></article></section>
  <section class="detail-controls"><label><span>Porovnat jiný subjekt</span><select id="entity-jump">{comparison_options}</select></label><div><span>Kohorta</span><strong>{'14 krajů včetně Prahy' if is_region else '27 statutárních měst včetně Prahy'}</strong></div><div><span>Měna</span><strong>CZK · nominální částky</strong></div><div><span>Období</span><strong>1–12 / 2025</strong></div></section>
  <section class="detail-analysis" id="rozpocet">
    <div class="detail-section-title"><div><span class="kicker">01 / Plnění rozpočtu</span><h2>Plán a skutečnost</h2></div><p>Skutečné příjmy a výdaje poměřujeme s rozpočtem po změnách.</p></div>
    <article class="detail-panel plan-panel">{stat_bar('Příjmy', a['revenue_actual'], a['revenue_adjusted'])}{stat_bar('Výdaje', a['expense_actual'], a['expense_adjusted'])}<div class="plan-note"><span>Schválené příjmy <b>{amount(a['revenue_approved'])}</b></span><span>Schválené výdaje <b>{amount(a['expense_approved'])}</b></span></div></article>
    <div class="detail-section-title"><div><span class="kicker">02 / Struktura toků</span><h2>Struktura příjmů a výdajů</h2></div><p>Příjmové a výdajové třídy podle rozpočtové skladby.</p></div>
    <div class="detail-grid"><article class="detail-panel"><div class="panel-title"><h3>Struktura příjmů</h3><strong>{amount(a['revenue_actual'])}</strong></div>{revenue_mix}</article><article class="detail-panel"><div class="panel-title"><h3>Struktura výdajů</h3><strong>{amount(a['expense_actual'])}</strong></div>{expense_mix}</article></div>
    <div class="detail-section-title"><div><span class="kicker">03 / Likvidita</span><h2>Peníze na účtech</h2></div><p>Vymezené peněžní prostředky a krátkodobé vklady podle rozvahy účetní jednotky.</p></div>
    <div class="cash-story"><article><span>31. 12. 2024</span><strong>{amount(a['cash_previous'])}</strong></article><i class="{'up' if cash_change >= 0 else 'down'}">{'+' if cash_change >= 0 else '−'}{amount(abs(cash_change))}</i><article><span>31. 12. 2025</span><strong>{amount(a['cash_current'])}</strong></article><aside><span>Meziroční změna</span><strong class="{'positive' if cash_change >= 0 else 'negative'}">{pct(r.get('cash_yoy'))}</strong></aside></div>
    <div class="detail-section-title"><div><span class="kicker">04 / Benchmark</span><h2>Pozice ve srovnatelné skupině</h2></div><p>Percentil ukazuje relativní výši ukazatele; sám o sobě není známkou kvality hospodaření.</p></div>
    <article class="detail-panel benchmark-panel">{''.join(benchmark_rows)}</article>
  </section>
  <section class="data-contract" id="metodika"><div><span class="kicker">05 / Data a metodika</span><h2>Zdroje a data</h2><p>Údaje jsou vedeny na úrovni samostatné účetní jednotky. Příspěvkové organizace ani samostatné městské části nejsou přičteny podruhé.</p></div><div class="source-list"><a href="{esc(entity['sources']['budget'])}" rel="noopener" target="_blank"><span>Rozpočet</span><strong>Monitor státní pokladny ↗</strong></a><a href="{esc(entity['sources']['entity'])}" rel="noopener" target="_blank"><span>Identita subjektu</span><strong>ARES ↗</strong></a><a href="../../../data/entities/{esc(entity['national_id'])}.json"><span>Strojová data</span><strong>JSON · schema {esc(data['schema_version'])} ↗</strong></a></div></section>
</main>
{footer('../../../')}
<script src="../../../cz-detail.js" defer></script>
</body></html>\n""", encoding="utf-8")


def build_machine_data(data: dict, entities: list[dict]) -> None:
    target = WEB / "data/entities"
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    for entity in entities:
        payload = {
            "schema_version": data["schema_version"],
            "generated_at": data["generated_at"],
            "period": data["period"],
            "cash_definition": data["cash_definition"],
            "entity": entity,
        }
        (target / f"{entity['national_id']}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_sitemap(entities: list[dict]) -> None:
    paths = ["/", "/eu-capitals.html", "/cz/municipalities/", "/cz/kraje/", "/cz/kraje/accountability/"]
    for entity in entities:
        for level in entity["administrative_levels"]:
            paths.append(entity_path(entity, level))
    # <lastmod> was a frozen literal, so every rebuild told crawlers the pages
    # had not changed since that date. It now reports the actual build date;
    # CZBUDGET_GENERATED_AT pins it for a reproducible build.
    lastmod = (os.environ.get("CZBUDGET_GENERATED_AT") or datetime.now(timezone.utc).isoformat())[:10]
    urls = "\n".join(f"  <url><loc>{esc(PUBLIC_ORIGIN + path)}</loc><lastmod>{lastmod}</lastmod></url>" for path in paths)
    (WEB / "sitemap.xml").write_text(f"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n{urls}\n</urlset>\n", encoding="utf-8")
    (WEB / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {PUBLIC_ORIGIN}/sitemap.xml\n", encoding="utf-8")


def main() -> None:
    data = json.loads(DATASET.read_text(encoding="utf-8"))
    entities = prepare_entities(data)
    data["analysis_dimensions"] = [
        {"dimension_code": "administrative_level", "values": ["municipality", "region"]},
        {"dimension_code": "country_code", "values": ["CZ"]},
        {"dimension_code": "currency_code", "values": ["CZK"]},
        {"dimension_code": "fiscal_year", "values": [2025]},
    ]
    DATASET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_listing(data, entities, "municipality")
    build_listing(data, entities, "region")
    for entity in entities:
        for level in entity["administrative_levels"]:
            build_detail(data, entity, entities, level)
    build_machine_data(data, entities)
    build_sitemap(entities)
    print(json.dumps({
        "entities": len(entities),
        "detail_pages": sum(len(e["administrative_levels"]) for e in entities),
        "municipalities": sum("municipality" in e["administrative_levels"] for e in entities),
        "regions": sum("region" in e["administrative_levels"] for e in entities),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
