#!/usr/bin/env python3
"""Merge expansion bundles into the public directory and generate routes."""

from __future__ import annotations

import json
import re
from pathlib import Path


WEB = Path(__file__).resolve().parents[1]
WORKSPACE = WEB.parent
BUNDLES = WORKSPACE / "outputs/municipal-expansion"
DATA = WEB / "data/international-municipalities.v1.json"
ORIGIN = "https://publicspendingdata.org"
META = {
    "DNK":{"alpha2":"DK","name_cs":"Dánsko","name_en":"Denmark","currency":"DKK","slug":"denmark","years":[2025],"stages":["enacted","actual"],"measures":["revenue","expenditure","balance"],"coverage_cs":"Všech 98 obcí; schválený rozpočet BUDK100 a závěrečné účty REGK100 v autorizovaném funkčním a ekonomickém členění","coverage_en":"All 98 municipalities; BUDK100 adopted budgets and REGK100 final accounts at authorized functional and economic detail","source":"https://www.statbank.dk/BUDK100"},
    "BRA":{"alpha2":"BR","name_cs":"Brazílie","name_en":"Brazil","currency":"BRL","slug":"brazil","years":[2025],"stages":["enacted","revised","actual"],"measures":["revenue","expenditure","balance"],"coverage_cs":"Všechny obce v adresáři SICONFI; RREO 2025, 6. bimestr, příloha 01","coverage_en":"All municipalities in the SICONFI directory; 2025 period-6 RREO Annex 01","source":"https://apidatalake.tesouro.gov.br/docs/siconfi"},
    "ESP":{"alpha2":"ES","name_cs":"Španělsko","name_en":"Spain","currency":"EUR","slug":"spain","years":[2025,2026],"stages":["enacted","revised","actual","cash"],"measures":["revenue","expenditure","balance"],"coverage_cs":"6 198 vykazujících obcí v CONPREL; schválené rozpočty 2026 a likvidace 2025 s ekonomickými účty","coverage_en":"6,198 reporting municipalities in CONPREL; 2026 adopted budgets and 2025 liquidations with economic accounts","source":"https://serviciostelematicosext.hacienda.gob.es/sgfal/conprel"},
    "JPN":{"alpha2":"JP","name_cs":"Japonsko","name_en":"Japan","currency":"JPY","slug":"japan","years":[2024],"stages":["actual"],"measures":["revenue","expenditure","balance","debt"],"coverage_cs":"Všech 1 741 obcí a tokijských obvodů; 16 tabulek e-Stat pro příjmy, výdaje, dluh, fondy a finance spojené se stárnutím","coverage_en":"All 1,741 municipalities and Tokyo wards; 16 e-Stat tables covering revenue, expenditure, debt, funds and ageing-related finance","source":"https://www.e-stat.go.jp/stat-search/files?toukei=00200251&tstat=000001077755"}
}


def page(profile: dict, info: dict) -> str:
    data_path=f"../../../data/municipal-expansion/{profile['country'].lower()}/{profile['code']}.json"
    return f'''<!doctype html><html lang="cs"><head><script src="/language-bootstrap.js?v=20260822-no-language-flash"></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{profile['name']} — Public Spending Data</title><meta name="description" content="Official municipality-level finance profile for {profile['name']}, {info['name_en']}."><link rel="canonical" href="{ORIGIN}{profile['url']}"><link rel="alternate" hreflang="cs" href="{ORIGIN}{profile['url']}?lang=cs"><link rel="alternate" hreflang="en" href="{ORIGIN}{profile['url']}?lang=en"><link rel="icon" href="../../../assets/favicon.svg"><link rel="stylesheet" href="../../../styles.css"><link rel="stylesheet" href="../../../chart-system.css"><link rel="stylesheet" href="../../../municipalities.css"><link rel="stylesheet" href="../../../municipal-benchmark-profile.css"><link rel="stylesheet" href="../../../municipal-expanded-profile.css"><link rel="stylesheet" href="../../../global-footer.css"><script src="../../../global-nav.js" defer></script><script src="../../../municipal-expanded-profile.js" defer></script><script src="../../../global-footer.js" defer></script></head><body class="municipalities-page benchmark-profile expanded-profile" data-profile-url="{data_path}" data-source="{info['source']}"><header class="site-header compact-header has-global-nav"><a class="brand" href="../../../index.html" aria-label="Public Spending Data"><img class="brand-logo" src="../../../assets/logo-lockup.svg" width="190" height="48" alt="" aria-hidden="true"></a><nav class="global-nav" aria-label="Primary navigation"></nav><div class="municipality-lang-switch" role="group" aria-label="Language"><button data-lang="cs" class="active" aria-pressed="true">CZ</button><button data-lang="en" aria-pressed="false">EN</button></div></header><main><nav id="profile-breadcrumbs" class="breadcrumbs"></nav><section id="profile-hero" class="municipal-profile-hero"></section><section id="profile-kpis" class="municipal-profile-kpis"></section><section class="municipal-profile-section"><div><span id="profile-history-kicker" class="kicker">History</span><h2 id="profile-history-title"></h2><p id="profile-history-copy"></p></div><div class="profile-table-scroll"><table id="profile-history"></table></div></section><section class="municipal-profile-section"><div><span id="profile-detail-kicker" class="kicker">Native detail</span><h2 id="profile-detail-title"></h2><p id="profile-detail-copy"></p></div><div><div class="expanded-detail-controls"><label><span id="profile-detail-search-label"></span><input id="profile-detail-search" type="search"></label><label><span id="profile-detail-stage-label"></span><select id="profile-detail-stage"></select></label><b id="profile-detail-count"></b></div><div class="profile-table-scroll"><table id="profile-detail"></table></div><button id="profile-detail-more" class="load-more" type="button"></button></div></section><div class="profile-source-row"><a id="profile-source" target="_blank" rel="noopener"></a></div></main><footer data-global-footer></footer></body></html>'''


_legacy_page = page


def page(profile: dict, info: dict) -> str:
    """Render expansion profiles with the current shared-header contract."""
    html = _legacy_page(profile, info)
    html = html.replace(
        '<link rel="stylesheet" href="../../../styles.css">',
        '<link rel="stylesheet" href="../../../site-header.css?v=20260824-header-lockup" data-psd-site-header><link rel="stylesheet" href="../../../styles.css">',
    )
    html = html.replace(
        '<script src="../../../global-nav.js" defer></script>',
        '<script src="../../../global-nav.js?v=20260824-logo-120" defer></script>',
    )
    legacy_header = '<header class="site-header compact-header has-global-nav"><a class="brand" href="../../../index.html" aria-label="Public Spending Data"><img class="brand-logo" src="../../../assets/logo-lockup.svg" width="190" height="48" alt="" aria-hidden="true"></a><nav class="global-nav" aria-label="Primary navigation"></nav><div class="municipality-lang-switch" role="group" aria-label="Language"><button data-lang="cs" class="active" aria-pressed="true">CZ</button><button data-lang="en" aria-pressed="false">EN</button></div></header>'
    return html.replace(legacy_header, '<psd-site-header data-section="cities"></psd-site-header>')


def main() -> None:
    payload=json.loads(DATA.read_text(encoding="utf-8"))
    for country in payload["countries"]:
        if country["code"] == "NOR":
            country["coverage_en"] = "All 357 municipalities plus Longyearbyen; 2015–2025 headline accounts and 2025 detail across 97 KOSTRA functions"
            country["coverage_cs"] = "Všech 357 obcí plus Longyearbyen; souhrnné účty 2015–2025 a detail roku 2025 napříč 97 funkcemi KOSTRA"
    codes=[code for code in META if (BUNDLES/f"{code}.json").exists()]
    payload["countries"]=[row for row in payload["countries"] if row["code"] not in codes]
    payload["entities"]=[row for row in payload["entities"] if row["country"] not in codes]
    generated_profiles=[]
    brazil_registry_update=None
    for code in codes:
        bundle=json.loads((BUNDLES/f"{code}.json").read_text(encoding="utf-8")); info={**META[code]}
        entities=bundle["entities"]
        extra={}
        status="complete"
        if code == "BRA":
            fmt_cs=lambda value:f"{value:,}".replace(","," ")
            regular_count=sum(profile.get("reporting_basis")=="RREO" and any(row.get("year")==2025 for row in profile.get("detail",[])) for profile in entities)
            simplified_count=sum(profile.get("reporting_basis")=="RREO Simplificado" and any(row.get("year")==2025 for row in profile.get("detail",[])) for profile in entities)
            rreo_count=regular_count+simplified_count
            dca_count=sum(any(row.get("year")==2024 for row in profile.get("detail",[])) for profile in entities)
            missing_count=len(entities)-rreo_count-dca_count
            status="complete" if missing_count==0 and not bundle.get("errors") else "partial"
            info["years"]=[2024,2025] if dca_count else [2025]
            info["coverage_en"]=f"All {len(entities):,} municipalities in the SICONFI directory; 2025 regular or simplified RREO Annex 01 for {rreo_count:,}, 2024 DCA I-C/I-D fallback for {dca_count:,}, {missing_count:,} without either return"
            info["coverage_cs"]=f"Všech {fmt_cs(len(entities))} obcí v adresáři SICONFI; běžné nebo zjednodušené RREO 2025 pro {fmt_cs(rreo_count)}, náhradní DCA I-C/I-D 2024 pro {fmt_cs(dca_count)}, bez obou výkazů {fmt_cs(missing_count)}"
            extra={"rreo_2025_count":rreo_count,"regular_rreo_2025_count":regular_count,"simplified_rreo_2025_count":simplified_count,"dca_2024_fallback_count":dca_count,"missing_finance_count":missing_count}
            brazil_registry_update={"pipeline":"loaded" if missing_count==0 else "loaded_partial","note_en":f"Loaded: {rreo_count:,} municipalities with 2025 regular or simplified RREO, {dca_count:,} with paired 2024 DCA revenue/expenditure fallback, and {missing_count:,} directory entities with no rows in either filing layer.","note_cs":f"Načteno: {fmt_cs(rreo_count)} obcí s běžným nebo zjednodušeným RREO 2025, {fmt_cs(dca_count)} s náhradní dvojicí DCA 2024 pro příjmy a výdaje a {fmt_cs(missing_count)} jednotek adresáře bez řádků v obou vrstvách."}
        payload["countries"].append({"code":code,**{key:value for key,value in info.items() if key!="slug"},"status":status,"directory_count":len(entities),**extra})
        data_dir=WEB/f"data/municipal-expansion/{code.lower()}"; data_dir.mkdir(parents=True,exist_ok=True)
        for profile in entities:
            latest=next((row for row in reversed(profile["history"]) if row.get("revenue") is not None or row.get("expenditure") is not None),profile["history"][-1])
            payload["entities"].append({"id":f"{code}:{profile['code']}","country":code,"code":profile["code"],"name":profile["name"],"region":profile.get("region"),"currency":profile["currency"],"years":profile["years"],"revenue":latest.get("revenue"),"expenditure":latest.get("expenditure"),"balance":latest.get("balance"),"population":profile.get("population"),"url":profile["url"]})
            (data_dir/f"{profile['code']}.json").write_text(json.dumps(profile,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
            target=WEB/profile["url"].lstrip("/")/"index.html"; target.parent.mkdir(parents=True,exist_ok=True); target.write_text(page(profile,info),encoding="utf-8")
            generated_profiles.append(profile["url"])
    payload["countries"].sort(key=lambda row:row["name_en"])
    payload["entities"].sort(key=lambda row:(row["country"],str(row["name"]).casefold(),row["code"]))
    payload["generated_at"]="2026-08-25"
    DATA.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    if brazil_registry_update:
        registry_path=WEB/"data/municipal-transparency.v1.json"
        registry=json.loads(registry_path.read_text(encoding="utf-8"))
        for country in registry["countries"]:
            if country["iso3"] == "BRA": country.update(brazil_registry_update)
        registry_path.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    sitemap=WEB/"sitemap.xml"; source=sitemap.read_text(encoding="utf-8")
    source=re.sub(
        r"\s*<url><loc>https://(?:publicspendingdata\.org|czbudget-public-258433468858\.europe-west1\.run\.app)/municipalities/(?:denmark|brazil|spain|japan)/(?:[^<]*)?</loc>(?:<lastmod>[^<]*</lastmod>)?</url>",
        "", source,
    )
    additions=[]
    for code in codes: additions.append(f"  <url><loc>{ORIGIN}/municipalities/{META[code]['slug']}/</loc></url>")
    additions.extend(f"  <url><loc>{ORIGIN}{path}</loc></url>" for path in generated_profiles)
    source=source.replace("</urlset>","\n".join(additions)+"\n</urlset>")
    sitemap.write_text(source,encoding="utf-8")
    print(json.dumps({"countries":codes,"profiles":len(generated_profiles),"directory":len(payload["entities"])}))


if __name__=="__main__": main()
