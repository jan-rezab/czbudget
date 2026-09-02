#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the public 2026 Plzen contract detail dataset and inject its explorer."""

from __future__ import annotations

import gzip
import json
import re
from pathlib import Path


WEB = Path(__file__).resolve().parents[2]
SOURCE = WEB / "data/contracts/00075370.full.v1.json.gz"
OUTPUT = WEB / "data/contracts/00075370.2026.v1.json"
PAGE = WEB / "cz/municipalities/plzen/index.html"

PROJECT_RE = re.compile(r"(?<![A-Z0-9])[0-9]{2}[A-Z]{4,8}[0-9]{2}(?![A-Z0-9])")
SAP_RE = re.compile(r"(?<![0-9])45[0-9]{8}(?![0-9])")


def identifiers(subject: str) -> tuple[list[str], list[str]]:
    return sorted(set(PROJECT_RE.findall(subject))), sorted(set(SAP_RE.findall(subject)))


def build_dataset() -> dict:
    with gzip.open(SOURCE, "rt", encoding="utf-8") as stream:
        source = json.load(stream)

    rows = []
    for contract in source["contracts"]:
        # This matches the year series already shown on the page: publication year.
        # A contract signed at the end of 2025 but published in 2026 therefore belongs
        # to the 2026 register cohort, while its actual signature date stays visible.
        if not str(contract.get("published_at") or "").startswith("2026-"):
            continue
        project_codes, sap_orders = identifiers(contract.get("subject") or "")
        rows.append({
            "id": contract.get("id"),
            "subject": contract.get("subject"),
            "signed_at": contract.get("signed_at"),
            "published_at": contract.get("published_at"),
            "value_czk": contract.get("value_czk"),
            "suppliers": contract.get("suppliers") or [],
            "category": contract.get("category"),
            "budget_match": contract.get("budget_match"),
            "project_codes": project_codes,
            "sap_orders": sap_orders,
            "parent_contract_id": contract.get("parent_contract_id"),
            "source_url": contract.get("source_url"),
        })

    rows.sort(key=lambda row: (row.get("signed_at") or "", row.get("published_at") or ""), reverse=True)
    known = [row for row in rows if row["value_czk"] is not None]
    supplier_keys = {
        supplier.get("ico") or supplier.get("name")
        for row in rows for supplier in row["suppliers"]
        if supplier.get("ico") or supplier.get("name")
    }
    payload = {
        "schema_version": "1.0.0",
        "year": 2026,
        "entity": {"name": "statutární město Plzeň", "ico": "00075370"},
        "source": source.get("source"),
        "summary": {
            "contracts": len(rows),
            "known_value_contracts": len(known),
            "known_value_czk": sum(row["value_czk"] for row in known),
            "suppliers": len(supplier_keys),
            "with_project_code": sum(bool(row["project_codes"]) for row in rows),
            "with_sap_order": sum(bool(row["sap_orders"]) for row in rows),
        },
        "contracts": rows,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return payload


def inject_explorer() -> None:
    html = PAGE.read_text(encoding="utf-8")
    timeline_start = html.find('<section class="contract-time" id="smlouvy-v-case">')
    if timeline_start >= 0:
        timeline_end = html.find("</section>", timeline_start)
        html = html[:timeline_start] + html[timeline_end + len("</section>"):]
    start = html.find('<section class="contract-year-detail" id="smlouvy-2026">')
    if start >= 0:
        end = html.find("</section>", start)
        html = html[:start] + html[end + len("</section>"):]

    marker = '<section class="detail-analysis" id="rozpocet">'
    timeline_section = '''<section class="contract-time" id="smlouvy-v-case"><div class="directory-title"><div><span class="kicker" data-ct-copy="kicker">Dvě časové osy · 2016–2026</span><h2 data-ct-copy="title">Od podpisu smlouvy ke skutečné platbě</h2></div><p data-ct-copy="intro">Registr zachycuje vznik a zveřejnění závazku. Rozpočet města u 555 stavebních investic navíc ukazuje, ve kterém fiskálním roce peníze skutečně odešly.</p></div><div class="contract-time-definitions"><article><span>01</span><strong data-ct-copy="commitment">Závazek</strong><p data-ct-copy="commitmentText">Hodnota smlouvy v datu podpisu. Víceletou částku dál nerozpočítáváme odhadem.</p></article><article><span>02</span><strong data-ct-copy="register">Registr</strong><p data-ct-copy="registerText">Datum zveřejnění je okamžik, kdy se záznam objevil veřejně. Není to datum platby.</p></article><article><span>03</span><strong data-ct-copy="cash">Skutečná platba</strong><p data-ct-copy="cashText">Částka „Uhrazeno“ z městské investiční akce, přesně přiřazená k fiskálnímu roku projektu.</p></article></div><div class="contract-time-coverage" id="contract-time-coverage"></div><div class="contract-time-panel"><header><div><span class="section-index">01 / REGISTR</span><h3 data-ct-copy="activityTitle">Měsíční aktivita všech smluv</h3></div><div class="contract-time-controls"><label><span data-ct-copy="eventLabel">Čas události</span><select id="contract-time-event"><option value="signed" data-ct-copy="signed">Podpis · vznik závazku</option><option value="published" data-ct-copy="published">Zveřejnění v registru</option></select></label><label><span data-ct-copy="metricLabel">Měřítko</span><select id="contract-time-metric"><option value="value" data-ct-copy="knownValue">Známá hodnota</option><option value="count" data-ct-copy="count">Počet smluv</option></select></label></div></header><div class="contract-time-kpis" id="contract-time-kpis"></div><div class="contract-time-chart" id="contract-time-chart" role="img" aria-live="polite"><p>Načítám časovou osu…</p></div><p class="contract-time-source" data-ct-copy="activityNote">Výška sloupce patří jednomu měsíci. Smlouvy s neuvedenou cenou vstupují do počtu, nikoli do hodnoty; chybné budoucí datum podpisu graf ignoruje.</p></div><div class="portfolio-time-panel"><header><span class="section-index">02 / PORTFOLIO</span><h3 data-ct-copy="portfolioTitle">Investiční portfolio: závazky proti hotovosti</h3><p data-ct-copy="portfolioIntro">Oranžově jsou známé hodnoty propojených smluv podle roku podpisu. Zeleně skutečné platby všech 555 sledovaných akcí podle fiskálního roku.</p></header><div class="portfolio-time-kpis" id="portfolio-time-kpis"></div><div class="portfolio-time-chart" id="portfolio-time-chart" role="img" aria-live="polite"></div><p class="contract-time-source" data-ct-copy="portfolioNote">Smluvní řada je neúplná, dokud projekt nejde bezpečně propojit s registrem. Platební řada je přesná pro rozsah stavebních investic MMP zveřejněný městem; nejde o všechny výdaje Plzně.</p></div><div class="project-time-panel"><header><div><span class="section-index">03 / PROJEKT</span><h3 data-ct-copy="projectTitle">Závazky a hotovost na jedné projektové ose</h3><p data-ct-copy="projectIntro">Vyberte investiční akci. Oranžové sloupce ukazují smlouvy podle podpisu, zelené skutečně uhrazené částky podle fiskálního roku.</p></div><label><span data-ct-copy="projectLabel">Investiční akce</span><select id="project-time-select"><option>Načítám projekty…</option></select></label></header><div class="project-time-kpis" id="project-time-kpis"></div><div class="project-time-chart" id="project-time-chart" role="img" aria-live="polite"></div><div class="project-time-contracts" id="project-time-contracts"></div><p class="method-warning" data-ct-copy="projectNote">Platby jsou přesné na úrovni městské investiční akce, nikoli jednotlivé smlouvy. Připojení smlouvy k projektu je ověřené interním kódem nebo konzervativně odhadnuté podle názvu a IČO dodavatele; nejisté shody jsou označené.</p></div></section>'''
    section = '''<section class="contract-year-detail" id="smlouvy-2026"><div class="directory-title"><div><span class="kicker" data-cy-copy="kicker">Detail roku 2026</span><h2 data-cy-copy="title">Všech 4 215 smluv zveřejněných v roce 2026</h2></div><p data-cy-copy="intro">Vyhledávejte předmět, dodavatele, IČO, interní kód investiční akce nebo číslo SAP objednávky.</p></div><div class="contract-year-summary" id="contract-year-summary"></div><form class="contract-year-controls" id="contract-year-controls"><label><span data-cy-copy="search">Hledat</span><input id="contract-year-query" type="search" placeholder="Projekt, dodavatel, IČO, SAP…" autocomplete="off"></label><label><span data-cy-copy="identifier">Identifikátor</span><select id="contract-year-identifier"><option value="all" data-cy-copy="all">Všechny smlouvy</option><option value="project" data-cy-copy="projectOnly">S kódem akce</option><option value="sap" data-cy-copy="sapOnly">Se SAP objednávkou</option></select></label><label><span data-cy-copy="sort">Řazení</span><select id="contract-year-sort"><option value="newest" data-cy-copy="newest">Nejnovější</option><option value="value" data-cy-copy="largest">Nejvyšší hodnota</option></select></label></form><p class="contract-year-result" id="contract-year-result" aria-live="polite"></p><div class="contract-year-table"><table><thead><tr><th data-cy-copy="date">Datum</th><th data-cy-copy="contract">Smlouva a identifikátory</th><th data-cy-copy="supplier">Dodavatel</th><th data-cy-copy="classification">Klasifikace</th><th data-cy-copy="value">Hodnota</th></tr></thead><tbody id="contract-year-body"><tr><td colspan="5">Načítám detail…</td></tr></tbody></table></div><button class="load-more contract-year-more" id="contract-year-more" type="button" data-cy-copy="more">Načíst dalších 50</button><p class="method-warning" data-cy-copy="warning">Výběr roku používá datum zveřejnění v registru; ve sloupci Datum je zachováno datum uzavření. Kódy akce a SAP objednávky jsou rozpoznané z textu smlouvy. Rozpočtová položka zůstává odhadem; nejde o účetní spárování platby.</p></section>'''
    if marker not in html:
        raise RuntimeError("Plzen budget section marker not found")
    html = html.replace(marker, timeline_section + section + marker, 1)
    scripts = [
        '<script src="../../../plzen-contract-timeline.js?v=20260902-time" defer></script>',
        '<script src="../../../plzen-contracts-2026.js?v=20260902-detail" defer></script>',
    ]
    html = re.sub(r'<script src="\.\./\.\./\.\./plzen-contracts-2026\.js\?v=[^"]+" defer></script>', "", html)
    for script in scripts:
        if script not in html:
            html = html.replace("</body>", script + "</body>")
    html = re.sub(r'cz-budget\.css\?v=[^"]+', "cz-budget.css?v=20260902-contract-time", html, count=1)
    PAGE.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    payload = build_dataset()
    inject_explorer()
    print(json.dumps(payload["summary"], ensure_ascii=False))
