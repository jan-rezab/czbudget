#!/usr/bin/env python3
"""Generate the all-municipality directory, 20-year city explorer and SEO profiles."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from build_czech_site import PUBLIC_ORIGIN, WEB, amount, esc, footer, head, header, mix_row, pct, slugify, stat_bar


SNAPSHOT = WEB / "data/municipal-snapshot.v1.json"
BENCHMARK = WEB / "data/benchmark.v1.json"
HISTORY = WEB / "data/large-city-history.v1.json"


def assign_slugs(municipalities: list[dict], large_ids: set[str]) -> None:
    used: set[str] = set()
    ordered = sorted(municipalities, key=lambda item: (item["national_id"] not in large_ids, item["short_name"].casefold(), item["national_id"]))
    for entity in ordered:
        base = slugify(entity["short_name"]) or entity["national_id"]
        slug = base if base not in used else f"{base}-{entity['national_id']}"
        used.add(slug)
        entity["seo"] = {"slug": slug, "path": f"/cz/obce/{slug}/"}


def card(entity: dict) -> str:
    a = entity["amounts"]
    return f"""<article class="entity-card compact-entity-card"><div class="entity-card-top"><span>{esc(entity['territory'].get('region_name') or 'Česko')}</span><small>IČO {esc(entity['national_id'])}</small></div><h2><a href="{esc(entity['seo']['path'])}">{esc(entity['short_name'])}</a></h2><dl><div><dt>Příjmy</dt><dd>{amount(a['revenue_actual'])}</dd></div><div><dt>Výdaje</dt><dd>{amount(a['expense_actual'])}</dd></div><div><dt>Stav účtů</dt><dd>{amount(a['cash_current'])}</dd></div><div><dt>Výsledek</dt><dd class="{'positive' if a['budget_balance'] >= 0 else 'negative'}">{amount(a['budget_balance'])}</dd></div></dl><a class="entity-detail-link" href="{esc(entity['seo']['path'])}">Detail a data <span>↗</span></a></article>"""


def summary_row(label: str, summary: dict, note: str) -> str:
    entity_count = f"{summary['entity_count']:,}".replace(",", " ")
    return f"""<article class="layer-row"><div><span>{esc(label)}</span><strong>{entity_count}</strong><small>{esc(note)}</small></div><dl><div><dt>Příjmy</dt><dd>{amount(summary['revenue_actual'])}</dd></div><div><dt>Výdaje</dt><dd>{amount(summary['expense_actual'])}</dd></div><div><dt>Výsledek</dt><dd class="{'positive' if summary['budget_balance'] >= 0 else 'negative'}">{amount(summary['budget_balance'])}</dd></div><div><dt>Stav účtů</dt><dd>{amount(summary['cash_current'])}</dd></div></dl></article>"""


def aggregate_story(municipalities: list[dict]) -> str:
    surplus = [entity for entity in municipalities if entity["amounts"]["budget_balance"] >= 0]
    deficit = [entity for entity in municipalities if entity["amounts"]["budget_balance"] < 0]

    def total(group: list[dict], field: str) -> float:
        return sum(entity["amounts"][field] for entity in group)

    def count(group: list[dict]) -> str:
        return f"{len(group):,}".replace(",", " ")

    def share(group: list[dict]) -> str:
        return f"{len(group) / len(municipalities):.1%}".replace(".", ",")

    net_balance = total(municipalities, "budget_balance")
    surplus_balance = total(surplus, "budget_balance")
    deficit_balance = total(deficit, "budget_balance")
    worst = sorted(deficit, key=lambda entity: entity["amounts"]["budget_balance"])[:5]
    worst_balance = total(worst, "budget_balance")
    without_worst = net_balance - worst_balance
    cards = "".join(
        f'<li><a href="{esc(entity["seo"]["path"])}"><span>{index}. {esc(entity["short_name"])}</span><strong>{amount(entity["amounts"]["budget_balance"])}</strong></a></li>'
        for index, entity in enumerate(worst, 1)
    )
    return f"""<section class="municipal-aggregate-story" aria-labelledby="aggregate-story-title"><div class="directory-title"><div><span class="kicker">02 / Co tvoří výsledek</span><h2 id="aggregate-story-title">{amount(surplus_balance)} vytvořily přebytkové obce.</h2></div><p>Celkové příjmy a souhrnný výsledek podle toho, zda obec rok 2025 uzavřela v přebytku, nebo ve schodku.</p></div><div class="aggregate-equation"><article class="aggregate-cohort good-cohort"><span>Přebytkové obce</span><strong>{count(surplus)}</strong><small>{share(surplus)} <i>všech obcí</i></small><dl><div><dt>Celkové příjmy</dt><dd>{amount(total(surplus, 'revenue_actual'))}</dd></div><div><dt>Souhrnný výsledek</dt><dd class="positive">+{amount(surplus_balance)}</dd></div></dl></article><div class="equation-sign" aria-hidden="true">+</div><article class="aggregate-cohort bad-cohort"><span>Schodkové obce</span><strong>{count(deficit)}</strong><small>{share(deficit)} <i>všech obcí</i></small><dl><div><dt>Celkové příjmy</dt><dd>{amount(total(deficit, 'revenue_actual'))}</dd></div><div><dt>Souhrnný výsledek</dt><dd class="negative">{amount(deficit_balance)}</dd></div></dl></article><div class="equation-sign" aria-hidden="true">=</div><article class="aggregate-cohort net-cohort"><span>Všechny obce čistě</span><strong>{count(municipalities)}</strong><small><i>příjmy</i> {amount(total(municipalities, 'revenue_actual'))}</small><dl><div><dt>Výsledek po započtení</dt><dd class="positive">+{amount(net_balance)}</dd></div></dl></article></div><div class="piggy-panel"><div class="piggy-copy"><span class="kicker">Pět největších schodků</span><h3>Pět „špatných prasátek“ ubralo {amount(abs(worst_balance))}.</h3><p>Bez této pětice by obce dohromady skončily v přebytku <strong>{amount(without_worst)}</strong> namísto {amount(net_balance)}.</p><small>„Špatné“ zde znamená pouze největší schodek za jediný rok. Schodek může být plánovanou investicí hrazenou z dřívějších úspor; nejde o hodnocení kvality vedení ani platební schopnosti.</small></div><ol>{cards}</ol></div></section>"""


def build_directory(data: dict) -> None:
    municipalities = sorted(data["municipalities"], key=lambda item: item["amounts"]["revenue_actual"], reverse=True)
    summary = data["summary"]
    regions = sorted({entity["territory"].get("region_name") for entity in municipalities if entity["territory"].get("region_name")})
    schema = {
        "@context": "https://schema.org", "@type": "Dataset", "name": "Rozpočty všech obcí ČR 2025",
        "description": "Příjmy, výdaje, výsledek hospodaření a stav účtů 6 254 českých obcí; doplněno o deduplikovaný souhrn s kraji.",
        "url": PUBLIC_ORIGIN + "/cz/obce/", "inLanguage": "cs", "temporalCoverage": "2025", "spatialCoverage": "CZ",
        "distribution": {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": PUBLIC_ORIGIN + "/data/municipal-snapshot.v1.json"},
    }
    page_head = head('Rozpočty všech obcí a krajů ČR 2025', 'Srovnání příjmů, výdajů, výsledku hospodaření a stavu účtů všech 6 254 obcí. Praha je v součtu s kraji započtena jen jednou.', '/cz/obce/', 2, schema).replace('cz-budget.css"', 'cz-budget.css?v=20260822-aggregate-stats"')
    initial = "\n".join(card(entity) for entity in municipalities[:48])
    options = "".join(f'<option value="{esc(region)}">{esc(region)}</option>' for region in regions)
    output = WEB / "cz/obce/index.html"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(f"""<!doctype html><html lang="cs">{page_head}
<body class="cz-budget-page directory-page all-municipalities">{header('../../')}<main id="top">
<nav class="breadcrumbs"><a href="../../index.html">Domů</a><span>›</span><strong>Obce a kraje</strong></nav>
<section class="cz-hero compact-cz-hero"><div><span class="eyebrow"><i class="live-dot"></i>České územní rozpočty · skutečnost 2025</span><h1>Obce a kraje<br><em>v jednom obrazu.</em></h1><p>Všechny obecní účetní jednotky, kraje i společný součet. Praha je započtena jen jednou.</p></div><div class="cohort-switch wide-switch"><a class="active" href="../obce/">Obce <b>6 254</b></a><a href="../mesta/">Velká města <b>20 let</b></a><a href="../kraje/">Kraje <b>14</b></a></div></section>
<section class="territorial-stack" aria-label="Souhrn územních rozpočtů"><div class="directory-title"><div><span class="kicker">01 / Deduplikovaný součet</span><h2>901,9 mld. Kč příjmů.</h2></div><p>6 254 obcí včetně Prahy + 13 krajů bez Prahy = 6 267 unikátních účetních jednotek.</p></div>{summary_row('Obce a města', summary['municipalities'], 'Praha je zde jako obec')}{summary_row('Kraje bez Prahy', summary['regions_excluding_prague'], '13 krajských účetních jednotek')}{summary_row('Celkem — Praha jen jednou', summary['combined_deduplicated_prague'], '6 267 unikátních jednotek')}<p class="method-warning"><strong>Pozor na interpretaci:</strong> Praha není zdvojena, ale součet není konsolidovaný mezi obcemi a kraji — vzájemné transfery mohou zůstávat na obou stranách.</p></section>
{aggregate_story(municipalities)}
<section class="directory" id="subjekty"><div class="directory-title"><div><span class="kicker">03 / Všechny obce</span><h2>Najděte libovolnou obec.</h2></div><p>Jednotná data FIN 2-12M a rozvahy za rok 2025. Stav účtů nezahrnuje samostatné příspěvkové organizace.</p></div>
<form class="directory-filters" id="municipality-filters"><label class="filter-search"><span>Hledat</span><input id="municipality-query" type="search" placeholder="Název nebo IČO…" autocomplete="off"></label><label><span>Kraj</span><select id="municipality-region"><option value="">Všechny kraje</option>{options}</select></label><label><span>Výsledek</span><select id="municipality-balance"><option value="all">Přebytek i schodek</option><option value="surplus">Přebytek</option><option value="deficit">Schodek</option></select></label><label><span>Řazení</span><select id="municipality-sort"><option value="revenue_actual">Podle příjmů</option><option value="expense_actual">Podle výdajů</option><option value="cash_current">Podle stavu účtů</option><option value="budget_balance">Podle výsledku</option><option value="name">Podle názvu</option></select></label><button type="reset">Vymazat filtry</button></form>
<div class="result-meta"><strong id="municipality-count">6 254 obcí</strong><a href="../mesta/">Zobrazit 20letý trend velkých měst →</a></div><div class="entity-grid" id="municipality-grid">{initial}</div><p id="municipality-empty" class="empty-state" hidden>Žádná obec neodpovídá filtrům.</p><button class="load-more" id="municipality-more" type="button">Načíst dalších 48 obcí</button></section>
<section class="data-contract" id="metodika"><div><span class="kicker">04 / Definice</span><h2>Výsledek i stav účtů.</h2><p>Výsledek = skutečné příjmy po konsolidaci minus skutečné výdaje po konsolidaci. Stav účtů je součet účtů 068, 231, 236, 241, 244, 261 a 262 v rozvaze obce.</p></div><div class="source-list"><a href="../../data/municipal-snapshot.v1.json"><span>Kompletní snapshot</span><strong>JSON · 6 254 obcí ↗</strong></a><a href="https://monitor.statnipokladna.gov.cz/datovy-katalog/" target="_blank" rel="noopener"><span>Primární zdroj</span><strong>Monitor MF ČR ↗</strong></a></div></section>
</main>{footer('../../')}<script src="../../municipal-i18n.js?v=20260822-aggregate-stats" defer></script><script src="../../cz-municipal-directory.js" defer></script></body></html>\n""", encoding="utf-8")


def history_section(ico: str | None, depth: int) -> str:
    root = "../" * depth
    fixed = f' data-fixed-ico="{esc(ico)}"' if ico else ""
    selector = "" if ico else '<label class="history-select"><span>Vyberte město</span><select id="history-city"></select></label>'
    return f"""<section class="history-explorer" id="history-explorer" data-source="{root}data/large-city-history.v1.json"{fixed}><div class="directory-title"><div><span class="kicker">20 let / 2006–2025</span><h2>Výsledek hospodaření a stav účtů.</h2></div>{selector}</div><div class="history-kpis" id="history-kpis"></div><div class="history-legend"><span><i class="revenue-key"></i>Příjmy</span><span><i class="expense-key"></i>Výdaje</span><span><i class="cash-key"></i>Stav účtů</span></div><div class="history-chart" id="history-chart"></div><details class="history-table"><summary>Roční data v tabulce</summary><div><table><thead><tr><th>Rok</th><th>Příjmy</th><th>Výdaje</th><th>Výsledek</th><th>Stav účtů</th></tr></thead><tbody id="history-table-body"></tbody></table></div></details><p class="method-warning">Rozpočtový výsledek je po konsolidaci v celé řadě. Stav účtů 2006–2011 vychází z běžných účtů ve FIN 2-12M; od 2012 z širšího součtu účtů rozvahy. Rok 2012 je proto metodický zlom.</p></section>"""


def build_large_cities(data: dict, history: dict, large_ids: set[str]) -> None:
    cities = [entity for entity in data["municipalities"] if entity["national_id"] in large_ids]
    cities.sort(key=lambda item: item["amounts"]["revenue_actual"], reverse=True)
    schema = {"@context": "https://schema.org", "@type": "Dataset", "name": "Rozpočty velkých měst ČR 2006–2025", "temporalCoverage": "2006/2025", "spatialCoverage": "CZ", "url": PUBLIC_ORIGIN + "/cz/mesta/"}
    cards = "\n".join(card(entity) for entity in cities)
    output = WEB / "cz/mesta/index.html"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(f"""<!doctype html><html lang="cs">{head('Rozpočty velkých měst 2006–2025 — trend a stav účtů', 'Dvacetiletý trend příjmů, výdajů, výsledku hospodaření a stavu účtů 27 velkých českých měst.', '/cz/mesta/', 2, schema)}<body class="cz-budget-page directory-page">{header('../../')}<main><nav class="breadcrumbs"><a href="../../index.html">Domů</a><span>›</span><a href="../obce/">Obce</a><span>›</span><strong>Velká města</strong></nav><section class="cz-hero compact-cz-hero"><div><span class="eyebrow"><i class="live-dot"></i>27 velkých měst · nominální CZK</span><h1>Dvacet let<br><em>v jednom trendu.</em></h1><p>Každý rok od 2006 do 2025: příjmy, výdaje, výsledek hospodaření a stav účtů.</p></div><div class="cohort-switch wide-switch"><a href="../obce/">Obce <b>6 254</b></a><a class="active" href="../mesta/">Velká města <b>20 let</b></a><a href="../kraje/">Kraje <b>14</b></a></div></section>{history_section(None, 2)}<section class="directory"><div class="directory-title"><div><span class="kicker">Profily</span><h2>Detail každého města.</h2></div><p>Nejnovější rok i celá časová řada na jedné trvalé adrese.</p></div><div class="entity-grid">{cards}</div></section></main>{footer('../../')}<script src="../../municipal-i18n.js" defer></script><script src="../../cz-history.js" defer></script></body></html>\n""", encoding="utf-8")


def build_detail(data: dict, entity: dict, has_history: bool) -> None:
    a, r = entity["amounts"], entity["ratios"]
    cash_available = entity.get("quality", {}).get("cash_data_available", True)
    cash_change = (a["cash_current"] - a["cash_previous"]) if cash_available else None
    canonical = entity["seo"]["path"]
    description = f"Rozpočet obce {entity['short_name']} 2025: příjmy {amount(a['revenue_actual'])}, výdaje {amount(a['expense_actual'])}, výsledek {amount(a['budget_balance'])} a stav účtů {amount(a['cash_current'])}."
    schema = {"@context": "https://schema.org", "@type": "Dataset", "name": f"Rozpočet obce {entity['short_name']} 2025", "description": description, "url": PUBLIC_ORIGIN + canonical, "temporalCoverage": "2006/2025" if has_history else "2025", "spatialCoverage": {"@type": "AdministrativeArea", "name": entity["short_name"], "addressCountry": "CZ"}, "about": {"@type": "GovernmentOrganization", "name": entity["name"], "identifier": entity["national_id"]}}
    history_html = history_section(entity["national_id"], 3) if has_history else ""
    history_script = '<script src="../../../cz-history.js" defer></script>' if has_history else ""
    revenue_mix = "".join([mix_row("Daňové příjmy", a["tax_revenue"], a["revenue_actual"], "#d9ff69"), mix_row("Přijaté transfery", a["transfer_revenue"], a["revenue_actual"], "#86b6ff"), mix_row("Nedaňové příjmy", a["nontax_revenue"], a["revenue_actual"], "#ffb36b"), mix_row("Kapitálové příjmy", a["capital_revenue"], a["revenue_actual"], "#8298d8")])
    expense_mix = mix_row("Běžné výdaje", a["current_expense"], a["expense_actual"], "#171a19") + mix_row("Kapitálové výdaje", a["capital_expense"], a["expense_actual"], "#47735c")
    out = WEB / f"cz/obce/{entity['seo']['slug']}/index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    cash_change_class = "" if cash_change is None else ("positive" if cash_change >= 0 else "negative")
    cash_change_text = "Data rozvahy nejsou dostupná" if cash_change is None else f"{pct(r.get('cash_yoy'))} meziročně"
    cash_story = "<p class=\"data-quality-warning\">Stav účtů nelze zobrazit: ve zdrojové rozvaze chybí odpovídající řádky.</p>" if cash_change is None else f"<div class=\"cash-story\"><article><span>31. 12. 2024</span><strong>{amount(a['cash_previous'])}</strong></article><i class=\"{'up' if cash_change >= 0 else 'down'}\">{'+' if cash_change >= 0 else '−'}{amount(abs(cash_change))}</i><article><span>31. 12. 2025</span><strong>{amount(a['cash_current'])}</strong></article></div>"
    out.write_text(f"""<!doctype html><html lang="cs">{head(f"Rozpočet obce {entity['short_name']} 2025 — příjmy, výdaje a účty", description, canonical, 3, schema)}<body class="cz-budget-page detail-page" data-entity-id="{esc(entity['entity_id'])}">{header('../../../')}<main><nav class="breadcrumbs"><a href="../../../index.html">Domů</a><span>›</span><a href="../">Obce</a><span>›</span><strong>{esc(entity['short_name'])}</strong></nav><section class="detail-hero"><div><span class="eyebrow"><i class="live-dot"></i>Obecní účetní jednotka · IČO {esc(entity['national_id'])} · 2025</span><h1>{esc(entity['short_name'])}</h1><p>{esc(description)}</p><div class="detail-actions"><a class="primary-button" href="#rozpocet">Rozpočet 2025 <b>↓</b></a>{'<a href="#history-explorer">Trend 20 let</a>' if has_history else ''}<a href="../../../data/entities/{esc(entity['national_id'])}.json" download>Stáhnout JSON</a></div></div><aside class="detail-score"><span>{esc(entity['territory'].get('region_name') or 'Česko')}</span><strong>{pct(r.get('cash_to_expense'))}</strong><small>{'ročních výdajů kryto stavem účtů' if cash_available else 'data rozvahy nejsou dostupná'}</small></aside></section><section class="detail-kpis"><article><span>Příjmy</span><strong>{amount(a['revenue_actual'])}</strong><small>{pct(r.get('revenue_execution'))} upraveného rozpočtu</small></article><article><span>Výdaje</span><strong>{amount(a['expense_actual'])}</strong><small>{pct(r.get('expense_execution'))} upraveného rozpočtu</small></article><article><span>Výsledek</span><strong class="{'positive' if a['budget_balance'] >= 0 else 'negative'}">{amount(a['budget_balance'])}</strong><small>{pct(r.get('balance_to_revenue'))} příjmů</small></article><article><span>Stav účtů</span><strong>{amount(a['cash_current'])}</strong><small class="{cash_change_class}">{cash_change_text}</small></article></section>{history_html}<section class="detail-analysis" id="rozpocet"><div class="detail-section-title"><div><span class="kicker">Rozpočet 2025</span><h2>Plán a skutečnost.</h2></div></div><article class="detail-panel plan-panel">{stat_bar('Příjmy', a['revenue_actual'], a['revenue_adjusted'])}{stat_bar('Výdaje', a['expense_actual'], a['expense_adjusted'])}</article><div class="detail-grid"><article class="detail-panel"><div class="panel-title"><h3>Struktura příjmů</h3><strong>{amount(a['revenue_actual'])}</strong></div>{revenue_mix}</article><article class="detail-panel"><div class="panel-title"><h3>Struktura výdajů</h3><strong>{amount(a['expense_actual'])}</strong></div>{expense_mix}</article></div>{cash_story}</section><section class="data-contract" id="metodika"><div><span class="kicker">Data a metodika</span><h2>Auditovatelný profil.</h2><p>Samostatná účetní jednotka obce; příspěvkové organizace nejsou přičítány. Výsledek je po konsolidaci uvnitř rozpočtu obce.</p></div><div class="source-list"><a href="{esc(entity['sources']['budget'])}" target="_blank" rel="noopener"><span>Rozpočet</span><strong>Monitor MF ČR ↗</strong></a><a href="../../../data/entities/{esc(entity['national_id'])}.json"><span>Strojová data</span><strong>JSON ↗</strong></a></div></section></main>{footer('../../../')}<script src="../../../municipal-i18n.js" defer></script>{history_script}</body></html>\n""", encoding="utf-8")


def build_machine_data(data: dict, benchmark: dict) -> None:
    target = WEB / "data/entities"
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    for entity in data["municipalities"]:
        payload = {"schema_version": data["schema_version"], "generated_at": data["generated_at"], "period": data["period"], "definitions": data["definitions"], "entity": entity}
        (target / f"{entity['national_id']}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for entity in benchmark["entities"]:
        if "region" not in entity.get("administrative_levels", []) or (target / f"{entity['national_id']}.json").exists():
            continue
        payload = {"schema_version": benchmark["schema_version"], "generated_at": benchmark["generated_at"], "period": benchmark["period"], "cash_definition": benchmark["cash_definition"], "entity": entity}
        (target / f"{entity['national_id']}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_sitemap(data: dict, benchmark: dict) -> None:
    paths = [
        "/", "/cesko.html", "/cesky-rozpocet.html", "/eu-capitals.html",
        "/cz/obce/", "/cz/mesta/", "/cz/kraje/",
    ] + [entity["seo"]["path"] for entity in data["municipalities"]]
    for entity in benchmark["entities"]:
        if "region" in entity.get("administrative_levels", []):
            paths.append(f"/cz/kraje/{entity['seo']['slug']}/")
    lastmod = data.get("generated_at", "")[:10]
    urls = "\n".join(f"  <url><loc>{esc(PUBLIC_ORIGIN + path)}</loc><lastmod>{lastmod}</lastmod></url>" for path in dict.fromkeys(paths))
    (WEB / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n', encoding="utf-8")


def main() -> None:
    data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    benchmark = json.loads(BENCHMARK.read_text(encoding="utf-8"))
    history = json.loads(HISTORY.read_text(encoding="utf-8"))
    large_ids = {city["national_id"] for city in history["cities"]}
    assign_slugs(data["municipalities"], large_ids)
    SNAPSHOT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_directory(data)
    build_large_cities(data, history, large_ids)
    for index, entity in enumerate(data["municipalities"], 1):
        build_detail(data, entity, entity["national_id"] in large_ids)
        if index % 1000 == 0:
            print(f"built {index}/{len(data['municipalities'])}", flush=True)
    build_machine_data(data, benchmark)
    build_sitemap(data, benchmark)
    print(json.dumps({"municipal_profiles": len(data["municipalities"]), "history_cities": len(large_ids)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
