"""Shared, server-rendered HTML for international municipal profiles.

Country importers own data normalization. This module owns the durable first
view; municipal-expanded-profile.js progressively enhances it with filtering,
language switching, and the complete visual detail explorer.
"""

from __future__ import annotations

import html
import json
import math
import re
from collections.abc import Iterable


ORIGIN = "https://publicspendingdata.org"
ASSET_VERSION = "20260828-fx-currency"
STAGE_ORDER = ("enacted", "revised", "actual", "committed", "cash", "period", "remaining")
STAGE_LABELS = {
    "en": {"enacted": "Approved", "revised": "Amended", "actual": "Actual", "committed": "Committed", "cash": "Paid", "period": "In period", "remaining": "Remaining"},
    "cs": {"enacted": "Schválený", "revised": "Upravený", "actual": "Skutečnost", "committed": "Závazky", "cash": "Zaplaceno", "period": "V období", "remaining": "Zbývá"},
}


def esc(value: object) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def numeric(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def fmt_money(value: object, currency: str, *, compact: bool = True) -> str:
    number = numeric(value)
    if number is None:
        return "—"
    absolute = abs(number)
    if compact and absolute >= 1_000_000_000:
        return f"{number / 1_000_000_000:,.2f} bn {currency}"
    if compact and absolute >= 1_000_000:
        return f"{number / 1_000_000:,.2f} m {currency}"
    if compact and absolute >= 1_000:
        return f"{number / 1_000:,.1f} k {currency}"
    return f"{number:,.0f} {currency}"


def _normalize_brazil_rows(rows: list[dict]) -> list[dict]:
    side_by_account: dict[tuple[str, str], str] = {}
    for row in rows:
        column = str(row.get("column") or "").upper()
        label = str(row.get("name") or "").upper()
        key = (str(row.get("code") or ""), str(row.get("name") or ""))
        if re.search(r"PREVISÃO|REALIZADAS", column) or "RECEITAS (EXCETO" in label:
            side_by_account[key] = "revenue"
        if re.search(r"DOTAÇÃO|EMPENHADAS|LIQUIDADAS|PAGAS", column) or "DESPESAS (EXCETO" in label:
            side_by_account[key] = "expenditure"
    normalized = []
    for source in rows:
        row = dict(source)
        column = str(row.get("column") or "").upper()
        key = (str(row.get("code") or ""), str(row.get("name") or ""))
        if re.search(r"PREVISÃO INICIAL|DOTAÇÃO INICIAL", column):
            row["stage"] = "enacted"
        elif re.search(r"PREVISÃO ATUALIZADA|DOTAÇÃO ATUALIZADA", column):
            row["stage"] = "revised"
        elif "NO BIMESTRE" in column:
            row["stage"] = "period"
        elif "SALDO" in column:
            row["stage"] = "remaining"
        elif "PAGAS" in column:
            row["stage"] = "cash"
        elif "EMPENHADAS" in column:
            row["stage"] = "committed"
        elif re.search(r"LIQUIDADAS|REALIZADAS|ATÉ O BIMESTRE", column):
            row["stage"] = "actual"
        row["side"] = side_by_account.get(key, row.get("side"))
        normalized.append(row)
    return normalized


def _profile_detail(profile: dict) -> list[dict]:
    if isinstance(profile.get("detail"), list):
        rows = [dict(row) for row in profile["detail"]]
        if profile.get("country") == "BRA":
            return _normalize_brazil_rows(rows)
        if profile.get("country") == "JPN":
            for row in rows:
                if row.get("side"):
                    continue
                label = f"{row.get('name') or ''} {row.get('table_title') or ''}"
                row["side"] = "revenue" if "歳入" in label else "expenditure" if re.search(r"歳出|経費|人件費", label) else "other"
        return rows
    breakdown = profile.get("breakdown")
    if not isinstance(breakdown, list):
        return []
    years = [int(year) for year in profile.get("years", []) if numeric(year) is not None]
    latest_year = int(numeric((profile.get("latest") or {}).get("year")) or (max(years) if years else 0))
    rows: list[dict] = []
    latest = profile.get("latest") or {}
    for side in ("revenue", "expenditure"):
        if numeric(latest.get(side)) is not None:
            rows.append({"year": latest_year, "stage": "actual", "side": side, "code": f"TOTAL_{side.upper()}", "name": f"Total {side}", "amount": latest[side]})
    for source in breakdown:
        if numeric(source.get("revenue")) is not None or numeric(source.get("expenditure")) is not None:
            for side in ("revenue", "expenditure"):
                if numeric(source.get(side)) is not None:
                    rows.append({**source, "year": latest_year, "stage": "actual", "side": side, "amount": source[side]})
        else:
            label = f"{source.get('code', '')} {source.get('name', '')}"
            side = "expenditure" if re.search(r"expenditure|expense|cost|payment|wages|salar|investment", label, re.I) else "revenue" if re.search(r"revenue|income|tax|grant|receipt|sales|fee|charge", label, re.I) else "other"
            rows.append({**source, "year": latest_year, "stage": "actual", "side": side})
    return rows


def _headline(rows: Iterable[dict], stage: str, side: str, country: str) -> float | None:
    candidates = [row for row in rows if row.get("stage") == stage and row.get("side") == side and numeric(row.get("amount")) is not None]
    if not candidates:
        return None
    canonical = next((row for row in candidates if row.get("code") == f"TOTAL_{side.upper()}"), None)
    if canonical:
        return numeric(canonical.get("amount"))
    # Denmark's authorized-account cube contains overlapping account groups
    # and financing flows. Its importer deliberately leaves headline totals
    # absent; selecting the largest native row would fabricate a total.
    if country == "DNK":
        return None
    if country == "BRA":
        pattern = r"RECEITAS \(EXCETO INTRA-?ORÇAMENTÁRIAS\)" if side == "revenue" else r"DESPESAS \(EXCETO INTRA-?ORÇAMENTÁRIAS\)"
        exact = next((row for row in candidates if re.search(pattern, str(row.get("name") or ""), re.I)), None)
        if exact:
            return numeric(exact.get("amount"))
    return numeric(max(candidates, key=lambda row: abs(numeric(row.get("amount")) or 0)).get("amount"))


def _table(rows: list[list[str]], headings: list[str], label: str, *, table_id: str | None = None) -> str:
    head = "".join(f"<th>{esc(item)}</th>" for item in headings)
    body = "".join("<tr>" + "".join(f"<{('th' if index == 0 else 'td')}>{cell}</{('th' if index == 0 else 'td')}>" for index, cell in enumerate(row)) + "</tr>" for row in rows)
    identifier = f' id="{esc(table_id)}"' if table_id else ""
    return f'<div class="profile-table-scroll" role="region" tabindex="0" aria-label="{esc(label)}"><table{identifier}><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def render_municipal_profile_shell(
    *,
    name: str,
    country_name: str,
    canonical_path: str,
    profile_data_path: str,
    source_url: str,
    profile: dict | None = None,
    coverage_note: str | None = None,
    display_country_name: str | None = None,
    default_language: str = "cs",
    history_data_path: str | None = None,
    page_title: str | None = None,
    page_description: str | None = None,
) -> str:
    """Return a complete first view; client JavaScript only enhances it."""
    profile = profile or {}
    lang = "en" if default_language == "en" else "cs"
    is_en = lang == "en"
    display_country = display_country_name or country_name
    title = page_title or f"{name} municipal finances — Public Spending Data"
    description = page_description or f"Official municipality-level finance profile for {name}, {country_name}."
    canonical = f"{ORIGIN}{canonical_path}"
    history_attribute = f' data-history-url="{esc(history_data_path)}"' if history_data_path else ""
    dataset = json.dumps({
        "@context": "https://schema.org", "@type": "Dataset", "name": title, "description": description,
        "url": canonical, "inLanguage": lang,
        "spatialCoverage": {"@type": "AdministrativeArea", "name": name, "addressCountry": country_name},
        "distribution": {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": profile_data_path},
    }, ensure_ascii=False, separators=(",", ":"))

    country = str(profile.get("country") or "")
    code = profile.get("code") or ""
    currency = str(profile.get("currency") or "")
    detail = _profile_detail(profile)
    history = sorted((dict(row) for row in profile.get("history", []) if isinstance(row, dict)), key=lambda row: numeric(row.get("year")) or 0)
    meaningful_history = [row for row in history if any(numeric(row.get(key)) is not None for key in ("revenue", "expenditure", "balance", "cash", "debt"))]
    years = [int(number) for number in (numeric(year) for year in profile.get("years", [])) if number is not None]
    latest = meaningful_history[-1] if meaningful_history else (profile.get("latest") or {})
    latest_year = int(numeric(latest.get("year")) or (max(years) if years else 0))
    year_rows = [row for row in detail if numeric(row.get("year")) == latest_year]
    revenue = numeric(latest.get("revenue"))
    expenditure = numeric(latest.get("expenditure"))
    balance = numeric(latest.get("balance"))
    if revenue is None:
        revenue = _headline(year_rows, "actual", "revenue", country)
    if expenditure is None:
        expenditure = _headline(year_rows, "actual", "expenditure", country)
    revised_expenditure = _headline(year_rows, "revised", "expenditure", country)
    execution_rate = expenditure / revised_expenditure if expenditure is not None and revised_expenditure not in (None, 0) else None
    fourth_value = numeric(latest.get("cash")) if numeric(latest.get("cash")) is not None else numeric(latest.get("debt"))
    fourth_label = ("Cash balance" if is_en else "Stav účtů") if numeric(latest.get("cash")) is not None else ("Debt" if is_en else "Dluh") if numeric(latest.get("debt")) is not None else ("Expenditure execution" if is_en else "Plnění výdajů")
    has_finance = any(value is not None for value in (revenue, expenditure, balance, fourth_value)) or bool(detail)
    has_plan = any(row.get("stage") in {"enacted", "revised"} for row in detail)

    labels = {
        "municipalities": "Municipalities" if is_en else "Obce", "official": "official municipal finance" if is_en else "oficiální obecní finance",
        "code": "National code" if is_en else "Národní kód", "overview": "Overview" if is_en else "Přehled",
        "trend": "Trend" if is_en else "Vývoj", "budget": ("Plan & actual" if has_plan else "Accounts") if is_en else ("Plán a skutečnost" if has_plan else "Účty"),
        "detail": "Native detail" if is_en else "Původní detail", "method": "Coverage & source" if is_en else "Rozsah a zdroj",
        "revenue": "Revenue" if is_en else "Příjmy", "expenditure": "Expenditure" if is_en else "Výdaje", "balance": "Balance" if is_en else "Saldo",
    }
    nav_items = [("overview", labels["overview"])]
    if meaningful_history:
        nav_items.append(("history-explorer", labels["trend"]))
    if has_finance:
        nav_items.append(("rozpocet", labels["budget"]))
    if detail:
        nav_items.append(("native-detail", labels["detail"]))
    nav_items.append(("metodika", labels["method"]))
    rail = "".join(f'<a href="#{section}">{esc(label)}</a>' for section, label in nav_items)

    kpi_values = [
        (labels["revenue"], revenue, ""), (labels["expenditure"], expenditure, ""), (labels["balance"], balance, "balance"),
        (fourth_label, fourth_value if fourth_value is not None else execution_rate, "percentage" if fourth_value is None else ""),
    ]
    kpis = "".join(
        f'<article><span>{esc(label)}</span><strong class="{("positive" if numeric(value) is not None and numeric(value) >= 0 else "negative") if kind == "balance" else ""}">{(f"{value:.1%}" if kind == "percentage" and value is not None else fmt_money(value, currency))}</strong><small>{latest_year or "—"}</small></article>'
        for label, value, kind in kpi_values
    )

    history_section = ""
    if meaningful_history:
        fourth_history_label = "Cash balance" if any(numeric(row.get("cash")) is not None for row in meaningful_history) else "Debt"
        if not is_en:
            fourth_history_label = "Stav účtů" if fourth_history_label == "Cash balance" else "Dluh"
        history_rows = [[
            esc(row.get("year")), esc(fmt_money(row.get("revenue"), currency, compact=False)), esc(fmt_money(row.get("expenditure"), currency, compact=False)),
            esc(fmt_money(row.get("balance"), currency, compact=False)), esc(fmt_money(row.get("cash") if numeric(row.get("cash")) is not None else row.get("debt"), currency, compact=False)),
        ] for row in reversed(meaningful_history)]
        history_table = _table(history_rows, ["Year" if is_en else "Rok", labels["revenue"], labels["expenditure"], labels["balance"], fourth_history_label], "Budget history")
        kicker = f"{labels['trend']} · {meaningful_history[0].get('year')}–{meaningful_history[-1].get('year')}" if len(meaningful_history) > 1 else ("One year available" if is_en else "Jeden dostupný rok")
        history_section = f'<section class="history-explorer{(" single-period-history" if len(meaningful_history) == 1 else "")}" id="history-explorer"><div class="directory-title"><div><span class="kicker">{esc(kicker)}</span><h2>{"Budget over time" if is_en else "Rozpočet v čase"}</h2></div><p>{"Nominal values in local currency; unavailable years and measures are not estimated." if is_en else "Nominální hodnoty v místní měně; chybějící roky ani ukazatele se nedopočítávají."}</p></div>{history_table}</section>'

    budget_section = ""
    if has_finance:
        stage_rows = []
        for stage in STAGE_ORDER:
            stage_revenue = _headline(year_rows, stage, "revenue", country)
            stage_expenditure = _headline(year_rows, stage, "expenditure", country)
            if stage_revenue is None and stage_expenditure is None:
                continue
            stage_balance = stage_revenue - stage_expenditure if stage_revenue is not None and stage_expenditure is not None else None
            stage_rows.append([esc(STAGE_LABELS[lang].get(stage, stage)), esc(fmt_money(stage_revenue, currency, compact=False)), esc(fmt_money(stage_expenditure, currency, compact=False)), esc(fmt_money(stage_balance, currency, compact=False))])
        if not stage_rows and any(value is not None for value in (revenue, expenditure)):
            stage_rows.append([esc(STAGE_LABELS[lang]["actual"]), esc(fmt_money(revenue, currency, compact=False)), esc(fmt_money(expenditure, currency, compact=False)), esc(fmt_money(balance, currency, compact=False))])
        stage_table = _table(stage_rows, ["Budget stage" if is_en else "Fáze", labels["revenue"], labels["expenditure"], labels["balance"]], "Budget stages") if stage_rows else f'<p class="profile-empty-note">{"Headline totals are unavailable in this filing." if is_en else "Souhrnné hodnoty nejsou v tomto výkazu k dispozici."}</p>'

        detail_section = ""
        if detail:
            default_side = "expenditure" if any(row.get("side") == "expenditure" for row in detail) else "revenue" if any(row.get("side") == "revenue" for row in detail) else "other"
            default_year = latest_year or max((int(numeric(row.get("year")) or 0) for row in detail), default=0)
            side_year_rows = [row for row in detail if row.get("side") == default_side and int(numeric(row.get("year")) or 0) == default_year]
            default_stage = "actual" if any(row.get("stage") == "actual" for row in side_year_rows) else str(side_year_rows[0].get("stage") or "all") if side_year_rows else "all"
            filtered = [row for row in side_year_rows if default_stage == "all" or row.get("stage") == default_stage]
            unique: dict[tuple, dict] = {}
            for row in filtered:
                if numeric(row.get("amount")) is None or str(row.get("code") or "").startswith("TOTAL_"):
                    continue
                label = str(row.get("name") or "")
                if country == "BRA" and re.search(r"DESPESAS \(EXCETO INTRA-?ORÇAMENTÁRIAS\)", label, re.I):
                    continue
                key = tuple(str(row.get(field) or "") for field in ("year", "stage", "side", "code", "name", "column", "table_title", "amount"))
                unique.setdefault(key, row)
            visual_rows = sorted(unique.values(), key=lambda row: abs(numeric(row.get("amount")) or 0), reverse=True)
            maximum = max((abs(numeric(row.get("amount")) or 0) for row in visual_rows), default=0)
            visual_items = []
            for index, row in enumerate(visual_rows[:12], 1):
                label = row.get("name") or row.get("column") or row.get("code") or ("Specific item" if is_en else "Konkrétní položka")
                meta = " · ".join(str(value) for value in (row.get("code"), row.get("table_title"), row.get("column") if row.get("column") != row.get("name") else None) if value)
                width = max(1.5, abs(numeric(row.get("amount")) or 0) / maximum * 100) if maximum else 0
                visual_items.append(f'<article class="native-visual-row"><div class="native-visual-rank">{index:02d}</div><div class="native-visual-body"><div class="native-visual-label"><div><strong>{esc(label)}</strong>{f"<small>{esc(meta)}</small>" if meta else ""}</div><b>{esc(fmt_money(abs(numeric(row.get("amount")) or 0), currency))}</b></div><div class="native-visual-track"><i style="width:{width:.2f}%"></i></div></div></article>')
            visual_list = "".join(visual_items) or f'<p class="profile-empty-note">{"No items are available for these filters." if is_en else "Pro zvolené filtry nejsou dostupné žádné položky."}</p>'

            detail_rows = []
            for row in filtered[:24]:
                item = f'<b>{esc(row.get("code") or "—")}</b><small>{esc(row.get("name") or row.get("column") or "")}</small>'
                detail_rows.append([esc(row.get("year") or "—"), esc(STAGE_LABELS[lang].get(str(row.get("stage")), row.get("stage") or "—")), esc(row.get("side") or "—"), item, esc(fmt_money(row.get("amount"), currency, compact=False))])
            detail_table = _table(detail_rows, ["Year" if is_en else "Rok", "Budget stage" if is_en else "Fáze", "Side" if is_en else "Strana", "Code / item" if is_en else "Kód / položka", "Amount" if is_en else "Částka"], "Source item table", table_id="profile-detail")
            year_options = "".join(f'<option value="{year}"{(" selected" if year == default_year else "")}>{year}</option>' for year in sorted({int(numeric(row.get("year")) or 0) for row in detail if numeric(row.get("year")) is not None}, reverse=True))
            stages = sorted({str(row.get("stage")) for row in detail if row.get("stage")}, key=lambda stage: STAGE_ORDER.index(stage) if stage in STAGE_ORDER else len(STAGE_ORDER))
            stage_options = "".join(f'<option value="{esc(stage)}"{(" selected" if stage == default_stage else "")}>{esc(STAGE_LABELS[lang].get(stage, stage))}</option>' for stage in stages)
            detail_section = f'<section class="native-detail-explorer" id="native-detail"><div class="breakdown-heading"><div><span class="kicker">{"Where the money goes" if is_en else "Kam peníze jdou"}</span><h2>{"Explore income and spending." if is_en else "Příjmy a výdaje v detailu"}</h2></div><p>{"Switch between income and spending, then explore the specific purposes reported by the source. Bar length compares reported line magnitude; native labels and codes stay intact." if is_en else "Přepněte mezi příjmy a výdaji a procházejte konkrétní účely. Délka pruhu porovnává velikost vykázaných položek; původní názvy a kódy zůstávají zachované."}</p></div><div class="detail-side-tabs" role="group" aria-label="{("Side" if is_en else "Strana")}"><button type="button" data-detail-side="expenditure" class="{("active" if default_side == "expenditure" else "")}" aria-pressed="{str(default_side == "expenditure").lower()}">{"Spending / expenditure" if is_en else "Výdaje"}</button><button type="button" data-detail-side="revenue" class="{("active" if default_side == "revenue" else "")}" aria-pressed="{str(default_side == "revenue").lower()}">{"Income / revenue" if is_en else "Příjmy"}</button></div><div class="expanded-detail-controls"><label><span>{"Search items" if is_en else "Hledat položku"}</span><input id="profile-detail-search" type="search" placeholder="{("Code or label…" if is_en else "Kód nebo název…")}"></label><label><span>{"Year" if is_en else "Rok"}</span><select id="profile-detail-year"><option value="all">{"All years" if is_en else "Všechny roky"}</option>{year_options}</select></label><label><span>{"Budget stage" if is_en else "Fáze"}</span><select id="profile-detail-stage"><option value="all">{"All stages" if is_en else "Všechny fáze"}</option>{stage_options}</select></label></div><div id="profile-detail-visual-wrap"><div class="native-visual-summary"><span>{"Specific items" if is_en else "Konkrétní položky"}</span><strong>{len(visual_rows):,}</strong></div><div class="native-visual-list" id="profile-detail-visual">{visual_list}</div><p class="native-visual-note">{"Bars compare the absolute magnitude of reported lines, not a share of an artificially summed total." if is_en else "Pruhy porovnávají absolutní velikost vykázaných řádků, nikoli podíl z uměle sečteného celku."}</p></div><details class="raw-detail-audit"><summary><span>{"Source rows" if is_en else "Zdrojové řádky"}</span><strong>{"Open raw audit table" if is_en else "Otevřít auditní tabulku"} · <b id="profile-detail-count">{min(24, len(filtered)):,} / {len(filtered):,}</b></strong></summary>{detail_table}<button id="profile-detail-more" class="load-more" type="button">{"Load more source rows" if is_en else "Načíst další zdrojové řádky"}</button></details></section>'
        budget_section = f'<section class="detail-analysis" id="rozpocet"><div class="detail-section-title"><div><span class="kicker">{labels["budget"]} · {latest_year or "—"}</span><h2>{"Reported budget stages" if is_en else "Vykázané fáze rozpočtu."}</h2></div><p>{"Only stages present in the official source are shown." if is_en else "Zobrazují se pouze fáze přítomné v oficiálním zdroji."}</p></div><article class="detail-panel plan-panel">{stage_table}</article>{detail_section}</section>'

    coverage = coverage_note or ("Item-level filing available; national labels and classifications are preserved." if detail and is_en else "Položkový výkaz je dostupný; národní názvy a klasifikace zůstávají zachovány." if detail else "No item-level financial filing is available for this directory entity." if is_en else "Pro tuto jednotku adresáře není dostupný položkový finanční výkaz.")
    hero_action = f'<a class="primary-button" href="#rozpocet">{labels["budget"]} {latest_year or ""} <b>↓</b></a>' if has_finance else '<a class="primary-button" href="#metodika">Coverage <b>↓</b></a>'
    hero_score = f'<span>{"Latest observation" if is_en else "Poslední období"}</span><strong>{latest_year or "—"}</strong><small>{esc(currency)}</small>'

    return f'''<!doctype html><html lang="{lang}"><head><script src="/language-bootstrap.js?v=20260822-no-language-flash"></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title><meta name="description" content="{esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="{esc(canonical)}"><link rel="alternate" hreflang="cs" href="{esc(canonical)}?lang=cs"><link rel="alternate" hreflang="en" href="{esc(canonical)}?lang=en"><meta property="og:type" content="website"><meta property="og:site_name" content="Public Spending Data"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{esc(canonical)}"><meta property="og:image" content="{ORIGIN}/assets/og.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(title)}"><meta name="twitter:description" content="{esc(description)}"><meta name="twitter:image" content="{ORIGIN}/assets/og.png"><script type="application/ld+json">{dataset}</script><link rel="icon" href="../../../assets/favicon.svg"><link rel="stylesheet" href="../../../site-header.css?v=20260824-header-lockup" data-psd-site-header><link rel="stylesheet" href="../../../styles.css"><link rel="stylesheet" href="../../../chart-system.css"><link rel="stylesheet" href="../../../municipalities.css"><link rel="stylesheet" href="../../../municipal-benchmark-profile.css"><link rel="stylesheet" href="../../../municipal-expanded-profile.css?v={ASSET_VERSION}"><link rel="stylesheet" href="../../../global-footer.css"><script src="../../../global-nav.js?v=20260824-logo-120" defer></script><script src="../../../municipal-expanded-profile.js?v=20260831-warehouse-lines-2" defer></script><script src="../../../global-footer.js" defer></script></head><body class="municipalities-page benchmark-profile expanded-profile cz-budget-page detail-page international-municipality-profile" data-profile-url="{esc(profile_data_path)}" data-source="{esc(source_url)}"{history_attribute}><psd-site-header data-section="cities"></psd-site-header><nav class="context-rail municipal-context-rail international-context-rail" aria-label="{('Page sections' if is_en else 'Sekce stránky')}">{rail}</nav><main><nav class="breadcrumbs"><a href="../../../municipalities/?lang={lang}">{labels["municipalities"]}</a><span>›</span><a href="../?lang={lang}">{esc(display_country)}</a><span>›</span><strong>{esc(name)}</strong></nav><section class="detail-hero" id="overview"><div><span class="eyebrow"><i class="live-dot"></i>{esc(display_country)} · {labels["official"]}</span><h1>{esc(name)}</h1><p>{labels["code"]} {esc(code)}. {esc(coverage)}</p><div class="detail-actions">{hero_action}<a href="#metodika">{labels["method"]}</a><a href="{esc(profile_data_path)}" download>{"Machine-readable data" if is_en else "Strojová data"}</a></div></div><aside class="detail-score">{hero_score}</aside></section><section class="detail-kpis">{kpis}</section>{history_section}{budget_section}<section class="data-contract" id="metodika"><div><span class="kicker">{labels["method"]}</span><h2>{"Sources and data" if is_en else "Zdroje a data"}</h2><p>{esc(coverage)} {"Missing cash, debt, stages, or history are not estimated." if is_en else "Chybějící hotovost, dluh, fáze ani historie se nedopočítávají."}</p></div><div class="source-list"><a href="{esc(source_url)}" target="_blank" rel="noopener"><span>{"Official source" if is_en else "Oficiální zdroj"}</span><strong>{"Open" if is_en else "Otevřít"} ↗</strong></a><a href="{esc(profile_data_path)}"><span>{"Machine-readable data" if is_en else "Strojová data"}</span><strong>JSON ↗</strong></a></div></section></main><footer data-global-footer></footer></body></html>'''
