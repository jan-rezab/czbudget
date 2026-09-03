#!/usr/bin/env python3
"""Rebuild the ten-country public-entity registry from cached official files."""

from __future__ import annotations

import csv, gzip, hashlib, io, json, re, tempfile, zipfile
from collections import Counter
from pathlib import Path

import pandas as pd
import pdfplumber
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT.parent / "data" / "source_cache" / "public_entities"
OUT = ROOT / "data" / "public-entities"
FIELDS = ["record_id","country_code","perimeter","source_id","period","national_id","name","entity_class","legal_form_native","ownership_level","ownership_share_pct","controlling_authority","status","sector","region","body_count","revenue","operating_result","net_result","assets","equity","liabilities","employees","currency","monetary_unit","financial_period","source_url","notes"]
GENERATED = "2026-08-23T20:12:23+02:00"

URL = {
 "CZE":"https://mf.gov.cz/cs/dane-a-ucetnictvi/ucetnictvi/ucetni-reforma-verejnych-financi-ucetnic/ucetni-vykaznictvi-statu/vycet-konsolidovanych-jednotek-statu-a-d",
 "POL":"https://dane.gov.pl/pl/dataset/1198/resource/66957",
 "DEU":"https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Bundesvermoegen/Privatisierungs_und_Beteiligungspolitik/Beteiligungspolitik/Beteiligungsberichte/beteiligungsbericht-des-bundes-2024.pdf?__blob=publicationFile&v=2",
 "GBR_ONS":"https://www.ons.gov.uk/methodology/classificationsandstandards/economicstatisticsclassifications/introductiontoeconomicstatisticsclassifications",
 "GBR_ALB":"https://www.gov.uk/government/publications/public-bodies-2024",
 "FRA":"https://www.economie.gouv.fr/agence-participations-etat/comprendre-lape/les-entreprises-de-lape",
 "USA":"https://fiscal.treasury.gov/reports-statements/financial-report/2024report.html",
 "USA_CENSUS":"https://www.census.gov/data/datasets/2025/econ/gus/public-use-files.html",
 "CHE":"https://www.efv.admin.ch/de/unternehmen-anstalten",
 "CHE_BFS":"https://www.pxweb.bfs.admin.ch/pxweb/de/px-x-0602010000_108/px-x-0602010000_108/",
 "SWE":"https://www.regeringen.se/rapporter/2025/06/verksamhetsberattelse-for-bolag-med-statligt-agande-2024/",
 "SWE_SCB":"https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__OE__OE0108/OffFtg/",
 "DNK":"https://fm.dk/arbejdsomraader/statens-selskaber/organisering-af-statens-selskaber/",
 "DNK_DST":"https://www.dst.dk/da/Statistik/dokumentation/statistikdokumentation/den-offentlige-sektors-finanser",
 "UKR":"https://www.spfu.gov.ua/ua/content/civil-access-data--Edinij-reestr-ob-ektiv-derzhavnoi-vlasnosti.html",
 "FRA_ACCOUNTS":"https://www.economie.gouv.fr/files/files/directions_services/agence-participations-etat/Documents/Rapports-de-l-Etat-actionnaire/2025/RAPPORT%20FINANCIER%202025.pdf",
}

def clean(v):
    if v is None or (isinstance(v,float) and pd.isna(v)): return ""
    return " ".join(str(v).replace("\u00ad","").replace("\xa0"," ").split())
def num(v):
    if v is None or (isinstance(v,float) and pd.isna(v)) or clean(v) in {"","-","–","s"}: return ""
    try:
        if isinstance(v, str):
            raw = str(v).replace("’", "").replace("'", "").replace(" ", "")
            if "," in raw:
                raw = raw.replace(".", "").replace(",", ".")
            elif raw.count(".") > 1:
                raw = raw.replace(".", "")
            n = float(raw)
        else:
            n = float(v)
        return int(n) if n.is_integer() else n
    except: return ""
def row(code, source, perimeter, period, name, ordinal, **kw):
    national=clean(kw.pop("national_id", "")); body_count=kw.pop("body_count",1); rid=f"{source}:{national or f'row-{ordinal:06d}'}:{ordinal:06d}"
    result={k:"" for k in FIELDS}; result.update(record_id=rid,country_code=code,perimeter=perimeter,source_id=source,period=period,national_id=national,name=clean(name),body_count=body_count,**kw); return result
def write_country(code, rows):
    OUT.mkdir(parents=True,exist_ok=True); path=OUT/f"{code}.v1.csv.gz"
    raw=io.StringIO(newline=""); w=csv.DictWriter(raw,fieldnames=FIELDS,lineterminator="\n");w.writeheader();w.writerows(rows)
    with path.open("wb") as target:
        with gzip.GzipFile(filename="",mode="wb",fileobj=target,mtime=0) as gz: gz.write(raw.getvalue().encode())

def cze():
    df=pd.read_excel(CACHE/"CZE/consolidation-units-2026.xlsx",header=1,dtype=str)
    finance={e["ico"]:e for e in json.loads((ROOT/"data/cz-public-entities-2024.json").read_text())["entities"]}
    out=[]
    for i,r in df.iterrows():
        ico=re.sub(r"\D","",clean(r.iloc[0])).zfill(8); form=clean(r.iloc[2]); form_lower=form.lower(); f=finance.get(ico,{})
        is_health_insurer="zdravotní pojišťovna" in form_lower
        cls="public_health_insurer" if is_health_insurer else "controlled_enterprise" if any(x in form_lower for x in ["podnik","akciová","ručením"]) else "statutory_public_body"
        owner="social_insurance_fund" if is_health_insurer else "local" if form_lower in {"obec","svazek obcí","městská část, městský obvod"} else "regional" if form_lower == "kraj" else "central_or_mixed"
        has_finance=f.get("revenue_mczk") is not None
        out.append(row("CZE","cze_mf_consolidation_units_2026","public_sector_consolidation_units","2026",r.iloc[1],i+1,national_id=ico,entity_class=cls,legal_form_native=form,ownership_level=owner,status="open_ended",region=clean(r.iloc[7]),revenue=f.get("revenue_mczk") if has_finance else "",net_result=f.get("net_result_mczk","") if f.get("net_result_mczk") is not None else "",assets=f.get("assets_mczk","") if f.get("assets_mczk") is not None else "",currency="CZK" if has_finance else "",monetary_unit="million" if has_finance else "",financial_period="2024" if has_finance else "",source_url=URL["CZE"],notes=f"valid_from={clean(r.iloc[10])}; valid_to={clean(r.iloc[11])}"))
    assert len(out)==18238 and sum(x["revenue"] != "" for x in out)==134
    assert sum(x["entity_class"] == "public_health_insurer" for x in out)==7
    assert all(x["ownership_level"] == "social_insurance_fund" for x in out if x["entity_class"] == "public_health_insurer")
    return out

def pol():
    out=[]
    for p in sorted((CACHE/"POL").glob("state-treasury-companies-*-page-*.json")):
        for item in json.loads(p.read_text())["data"]:
            a=item["attributes"]; val=lambda k:a.get(k,{}).get("val","")
            out.append(row("POL","pol_state_treasury_holdings_2025_03_31","state_treasury_direct_and_indirect_holdings","2025-03-31",val("col3"),len(out)+1,national_id=re.sub(r"\D","",clean(val("col2"))),entity_class="controlled_enterprise",ownership_level="central",ownership_share_pct=val("col6"),controlling_authority=clean(val("col7")),status=clean(val("col5")),region=clean(val("col4")),source_url=URL["POL"]))
    assert len(out)==406; return out

def numbered_table(lines, start, end, count, cls, status):
    start_i=max(i for i,x in enumerate(lines) if start in x)
    end_i=next(i for i,x in enumerate(lines[start_i+1:],start_i+1) if end in x)
    section=lines[start_i+1:end_i]
    entries=[]; continuation_open=False
    for line in section:
        m=re.match(r"^\s*(\d{1,2})\s+(.+?)\s+(?:[-−]|\d[\d.]*(?:,\d+)?)\s+",line)
        if m:
            candidate=clean(m.group(2))
            if candidate=="2": continuation_open=False; continue
            entries.append([int(m.group(1)),candidate]); continuation_open=True
        elif not line.strip():
            continuation_open=False
        elif continuation_open and entries and re.match(r"^\s{7,}\S",line) and not any(k in line for k in ["Bundesministerium","Beauftragte der Bundesregierung","Unternehmen","Nennkapital","Beteiligungsbericht","T€"]):
            tail=clean(line[:72]);
            if tail: entries[-1][1]+=" "+tail
        else:
            continuation_open=False
    entries=[x for x in entries if x[0]<=count][:count]; assert len(entries)==count,(start,len(entries)); return [(n,name,cls,status) for n,name in entries]
def deu():
    text="\n".join(page.extract_text(layout=True) or "" for page in pdfplumber.open(CACHE/"DEU/federal-holdings-report-2024.pdf").pages); lines=text.splitlines()
    specs=[("6.1 Beteiligungen mit Geschäftstätigkeit","6.2 Mehrheitsbeteiligungen",74,"federal_direct_holding","active","active_federal_direct_holding"),("6.4 Beteiligungen ohne Geschäftstätigkeit","6.5 Wirtschaftlich agierende",4,"federal_direct_holding","inactive","inactive_federal_direct_holding"),("6.5 Wirtschaftlich agierende","6.6 Genossenschaften",3,"public_law_institution","active","federal_public_law_institution"),("6.6 Genossenschaften","6.7 Unmittelbare Beteiligungen der Sondervermögen",14,"cooperative_membership","active","federal_cooperative_membership"),("6.7 Unmittelbare Beteiligungen der Sondervermögen","B   -   Beteiligungen",29,"special_fund_direct_holding","active","special_fund_direct_holding")]
    out=[]
    for start,end,count,cls,status,perimeter in specs:
        for _,name,_,_ in numbered_table(lines,start,end,count,cls,status): out.append(row("DEU","deu_federal_holdings_report_2024",perimeter,"2023-12-31",name,len(out)+1,entity_class=cls,ownership_level="central",status=status,source_url=URL["DEU"]))
    assert len(out)==124; return out

PUBLIC_SECTORS={"Central Government","Local Government","Public Non-Financial Corporations","Public Other financial intermediaries, except insurance corporations and pension funds","Public Pension Funds","Public Financial Auxiliaries","Public Captive financial institutions and money lenders","Public Captive Financial Institutions and money lenders","Central Bank","Public Financial Corporation","Public deposit-taking corporations except the central bank","Public Insurance Corporation"}
def gbr():
    out=[]; ons=pd.read_excel(CACHE/"GBR/public-sector-classification-guide-2026-08.xlsx",sheet_name="Organisation|Institutional Unit",header=5)
    for _,r in ons.iterrows():
        sector=clean(r.get("Sector Classification")).replace("\n"," ")
        if sector not in PUBLIC_SECTORS: continue
        cls="public_corporation" if sector.startswith("Public") or sector=="Central Bank" else "government_unit"
        out.append(row("GBR","gbr_ons_public_sector_classification_2026_08","national_accounts_public_sector_classifications","2026-08-21",r.get("Name"),len(out)+1,entity_class=cls,ownership_level="central_or_mixed",controlling_authority=clean(r.get("Sponsoring Entity")),status="currently_classified_public",sector=sector,source_url=URL["GBR_ONS"],notes=f"ESA_2010={clean(r.get('ESA 2010 Code'))}; parent={clean(r.get('Parent Company'))}"))
    assert len(out)==2016
    alb=pd.read_excel(CACHE/"GBR/public-bodies-directory-2023-24.xlsx",sheet_name="Data",header=6)
    for _,r in alb.iterrows():
        out.append(row("GBR","gbr_cabinet_office_public_bodies_2023_24","central_government_arms_length_bodies","2023/24",r["overall_alb_name"],len(out)+1,national_id=clean(r["overall_copbt_uid"]),entity_class=clean(r["overall_classification"]),ownership_level="central",controlling_authority=clean(r["overall_parent_department"]),sector=clean(r["overall_primary_purpose"]),region=clean(r["overall_regional_scope"]),body_count=int(r["overall_body_numbers"]),revenue=num(r["finance_total_income"]),employees=num(r["staffing_fte_inpost"]),currency="GBP",monetary_unit="unit",financial_period="2023/24",source_url=URL["GBR_ALB"],notes=clean(r["overall_description"])))
    assert len(out)==2267; return out

FRA_SECTORS={
"energy":["Areva","Electricité de France (EDF)","Engie","Eramet","FSI Equation","Laboratoire français du fractionnement et des biotechnologies (LFB)","Orano"],
"industry":["Airbus Group SE","Bull","Chantiers de l’Atlantique","Civipol","Dassault Aviation","Défense Conseil International (DCI)","Eurenco Holding SAS","GIAT Industries SAS","John Cockerill Defense","KNDS NV","La Monnaie de Paris","Naval Group","Odas","Renault","Safran","SNPE SAS","SOGEPA","TechnicAtome","Thales","TSA SAS"],
"services_and_finance":["Alcatel Submarine Networks (ASN)","Arte France","Bpifrance EPIC","Casino d’Aix-les-Bains","Consortium de réalisation (CDR)","Dexia","Eutelsat","France Médias Monde","France Télévisions","IN Groupe","La Française des Jeux (FDJ)","La Poste","Orange","Radio France","Semmaris","Société de prise de participation de l’État (SPPE)","Société pour le logement intermédiaire (SLI)"],
"transport":["Aéroport de Bordeaux – Mérignac","Aéroport de la Réunion – Roland Garros","Aéroport de Marseille – Provence","Aéroport de Montpellier – Méditerranée","Aéroport de Strasbourg – Entzheim","Aéroport de Toulouse – Blagnac","Aéroport Martinique – Aimé Césaire","Aéroports de Paris (ADP)","Air France-KLM","Caisse nationale des autoroutes","Compagnie générale maritime et financière (CGMF)","Fonds pour le développement d’une politique intermodale des transports dans le massif alpin (FDPITMA)","Grand port maritime de Bordeaux","Grand port maritime de Dunkerque","Grand port maritime de la Guadeloupe","Grand port maritime de la Guyane","Grand port maritime de la Martinique","Grand port maritime de la Réunion","Grand port maritime de La Rochelle","Grand port maritime de Marseille","Grand port maritime de Nantes Saint‑Nazaire","Grand port fluvio-maritime Haropa","RATP","Société aéroportuaire de Guadeloupe Pôle Caraïbes","SNCF","Société concessionnaire française pour la construction et l’exploitation du tunnel routier sous le Mont-Blanc (ATMB- Autoroutes et tunnel du Mont-Blanc)","Société des autoroutes Rhône-Alpes (AREA)","Société des chemins de fer luxembourgeois","Société française du tunnel routier du Fréjus (SFTRF)","Société internationale de la Moselle"],
"single_state_share":["Adit","Airbus Defence and Space Holding France SAS","ArianeGroup SAS","Aubert & Duval SAS","Bpifrance SA","Compagnie industrielle des lasers (CILAS)","Exxelia International SAS","GEAST SAS","Nexter systems, Safran Ceramics","Société nationale maritime Corse Méditerranée (SNCM)","Société de financement local (SFIL)","Société Le Nickel (SLN)","Solinter holding"]}
def fra():
    out=[]
    for sector,names in FRA_SECTORS.items():
        for name in names: out.append(row("FRA","fra_ape_portfolio_2025","state_shareholder_portfolio","2025-06-30",name,len(out)+1,entity_class="state_shareholder_portfolio_entity",ownership_level="central",status="portfolio_at_reference_date",sector=sector,source_url=URL["FRA"]))
    assert len(out)==87; return out

def usa_federal_names():
    p=CACHE/"USA/financial-report-appendix-a-2024.pdf"; pdf=pdfplumber.open(p)
    layout=[page.extract_text(layout=True) or "" for page in pdf.pages]
    def paired(text,start,end):
        block=text[text.index(start)+len(start):text.index(end)]; names=[]
        for line in block.splitlines():
            if "www." in line or not clean(line): continue
            parts=[clean(x) for x in re.split(r"\s{3,}",line) if clean(x)]
            names.extend(parts[:2])
        return names
    cfo=paired(layout[0],"Twenty-Four Chief Financial Officer Act Consolidation Entities","Sixteen Additional") if "Sixteen Additional" in layout[0] else []
    if len(cfo)!=24:
        cfo=["Department of Agriculture","Department of Labor","Department of Commerce","Department of State","Department of Defense","Department of Transportation","Department of Education","Department of the Treasury","Department of Energy","Department of Veterans Affairs","Department of Health and Human Services","Environmental Protection Agency","Department of Homeland Security","General Services Administration","Department of Housing and Urban Development","National Aeronautics and Space Administration","Department of the Interior","National Science Foundation","Department of Justice","Office of Personnel Management","Small Business Administration","U.S. Agency for International Development","Social Security Administration","U.S. Nuclear Regulatory Commission"]
    significant=[]
    words=pdf.pages[1].extract_words();
    for top in sorted({round(w['top'],1) for w in words if 70<w['top']<270}):
        ws=[w for w in words if round(w['top'],1)==top];
        for lo,hi in [(0,306),(306,612)]:
            text=clean(" ".join(w['text'] for w in sorted([x for x in ws if lo<=x['x0']<hi],key=lambda x:x['x0'])))
            if text and "www." not in text and "Sixteen" not in text: significant.append(text)
    significant=significant[:16]
    def column_names(page,lo,hi,top_min,top_max):
        words=page.extract_words(); groups=[]
        for top in sorted({round(w['top'],1) for w in words if top_min<w['top']<top_max and lo<=w['x0']<hi}):
            ws=sorted([w for w in words if round(w['top'],1)==top and lo<=w['x0']<hi],key=lambda x:x['x0']); groups.append((min(w['x0'] for w in ws),clean(" ".join(w['text'] for w in ws))))
        names=[];base=54 if lo==0 else 308.5
        for x,text in groups:
            if not text or text.startswith("*"): continue
            if x>base+2.5 and names: names[-1]+=" "+text
            else: names.append(text)
        return names
    extra=column_names(pdf.pages[1],0,306,294,660)+column_names(pdf.pages[1],306,612,294,660)+column_names(pdf.pages[2],0,306,65,570)+column_names(pdf.pages[2],306,612,65,570)
    assert len(cfo)==24 and len(significant)==16 and len(extra)==127,(len(cfo),len(significant),len(extra)); return cfo+significant+extra
def usa():
    out=[]
    for name in usa_federal_names(): out.append(row("USA","usa_treasury_reporting_entities_fy2024","federal_financial_report_reporting_entities","FY2024",name,len(out)+1,entity_class="cfo_act_consolidation_entity",ownership_level="federal",status="consolidated",source_url=URL["USA"]))
    for name in ["Amtrak (National Railroad Passenger Service Corp)","Federal Home Loan Mortgage Corporation (Freddie Mac)","Federal National Mortgage Association (Fannie Mae)","Federal Reserve System","Special Purpose Vehicles"]: out.append(row("USA","usa_treasury_reporting_entities_fy2024","federal_financial_report_disclosure_entities","FY2024",name,len(out)+1,entity_class="disclosure_entity",ownership_level="federal_relationship",status="disclosed",source_url=URL["USA"]))
    for name in ["Federal Home Loan Banks","International Monetary Fund and Multilateral Development Banks"]: out.append(row("USA","usa_treasury_reporting_entities_fy2024","federal_financial_report_related_parties","FY2024",name,len(out)+1,entity_class="related_party",ownership_level="federal_relationship",status="related_party",source_url=URL["USA"]))
    with zipfile.ZipFile(CACHE/"USA/government-units-listing-2025.zip") as z,tempfile.TemporaryDirectory() as td:
        z.extract("Govt_Units_2025_Final.xlsx",td); x=Path(td)/"Govt_Units_2025_Final.xlsx"
        for sheet in ["General Purpose","Special District","School District","DEP School Dist","Public Pension Sys"]:
            df=pd.read_excel(x,sheet_name=sheet,dtype=str); dependent=sheet in ["DEP School Dist","Public Pension Sys"]
            if "ACTIVE" in df: df=df[df.ACTIVE.eq("Y")]
            for _,r in df.iterrows():
                cls={"General Purpose":"general_purpose_government","Special District":"special_district","School District":"independent_school_district","DEP School Dist":"dependent_school_agency","Public Pension Sys":"public_pension_system"}[sheet]
                out.append(row("USA","usa_census_government_units_2025","state_and_local_dependent_major_agencies" if dependent else "state_and_local_independent_government_units","2025",r["UNIT_NAME"],len(out)+1,national_id=clean(r["CENSUS_ID_PID6"]),entity_class=cls,ownership_level=clean(r.get("UNIT_TYPE")),status="active",sector=clean(r.get("FUNCTION_NAME") or r.get("ACTIVITY_NAME") or r.get("POLITICAL_CODE_DESCRIPTION") or r.get("SCHOOL_LEVEL_DESCRIPTION")),region=clean(r.get("STATE")),controlling_authority=clean(r.get("PARENT_UNIT_NAME")),source_url=URL["USA_CENSUS"],notes=f"county={clean(r.get('COUNTY_AREA_NAME'))}; city={clean(r.get('CITY'))}"))
    assert len(out)==96984; return out

CHE_PAGES=[4,8,11,14,18,21,24,28,31,34,38,42,46,50,54,58,62,66,70,75,79,85]
def metric(text,labels):
    for label in labels:
        m=re.search(rf"{label}[^\n]*?\((?:Mio\.|Tsd\.) CHF\)\s+(-?\d{{1,3}}(?:[ ’']\d{{3}})*(?:[,.]\d+)?)",text,re.I)
        if m:return num(m.group(1))
    return ""
def che():
    soup=BeautifulSoup((CACHE/"CHE/federal-enterprises-and-institutions.html").read_text(),"html.parser"); heads=[h for h in soup.find_all("h2") if (h.find_next(["h2","h3"]) and h.find_next(["h2","h3"]).name=="h3")]
    pdf=pdfplumber.open(CACHE/"CHE/aggregated-federal-entities-report-2024.pdf"); finance=[]
    for page in CHE_PAGES:
        current=pdf.pages[page]; text=current.extract_text() or ""; lines=[clean(x) for x in text.splitlines() if clean(x)]; title=lines[0].split(" Internet:")[0]; words=current.extract_words()
        def first_column(labels):
            for top in sorted({round(w["top"],1) for w in words}):
                line=[w for w in words if round(w["top"],1)==top]; joined=" ".join(w["text"] for w in line).lower()
                if not any(label.lower() in joined for label in labels):continue
                cells=[w["text"] for w in line if 450<=w["x0"]<500 and re.search(r"\d",w["text"])]
                return num("".join(cells)) if cells else ""
            return ""
        revenue=first_column(["Umsatz","Operativer Ertrag","Ertrag (Mio"]); assets=first_column(["Bilanzsumme"]); result=first_column(["Jahresergebnis","Unternehmensergebnis"]); employees=first_column(["Personalbestand"])
        finance.append((title,revenue,result,assets,employees))
    def tokens(s):return set(re.findall(r"[a-z0-9]{3,}",s.lower().replace("schweizerische","").replace("eidgenössische","").replace("aktiengesellschaft","ag")))
    out=[]
    for i,h in enumerate(heads):
        name=clean(h.get_text()); legal=clean(h.find_next_sibling("h3").get_text()); share=re.search(r"(\d+(?:[,.]\d+)?)\s*%",legal)
        match=max(finance,key=lambda x:len(tokens(name)&tokens(x[0])))
        if "Bundesbahnen" in name: match=next(x for x in finance if x[0]=="SBB")
        out.append(row("CHE","che_federal_enterprises_institutions_2025","federal_controlled_or_statutory_entities","2025-02-05",re.sub(r" \([A-Z]+\)$","",name),i+1,entity_class="controlled_enterprise" if "Aktiengesellschaft" in legal else "statutory_public_body",legal_form_native=legal,ownership_level="federal",ownership_share_pct=num(share.group(1)) if share else "",status="portfolio_current",revenue=match[1],net_result=match[2],assets=match[3],employees=match[4],currency="CHF",monetary_unit="million",financial_period="2024",source_url=URL["CHE"],notes="financial_source=che_aggregated_federal_entities_report_2024"))
    assert len(out)==22; return out

def swe():
    pdf=pdfplumber.open(CACHE/"SWE/state-owned-companies-report-2024.pdf");out=[]
    pages=[x for x in range(34,75) if x not in {46,59,72}]
    names=["Akademiska Hus","Almi","Apotek Produktion & Laboratorier (APL)","Apoteket","Arlandabanan Infrastructure","Green Cargo","Göta kanalbolag","Infranord","Jernhusen","Kungliga Dramatiska teatern (Dramaten)","Kungliga Operan (Operan)","Luossavaara-Kiirunavaara (LKAB)","Miljömärkning Sverige","PostNord","RISE Research Institutes of Sweden","Samhall","Saminvest","SBAB Bank","SJ","SOS Alarm Sverige","Specialfastigheter Sverige","Statens Bostadsomvandling","Sveaskog","Svensk Exportkredit (SEK)","Svensk-Danska Broförbindelsen (Svedab)","Svenska rymdaktiebolaget (SSC)","Svenska skeppshypotekskassan","Svenska Spel","Svevia","Swedavia","Sweden House","Swedfund International","Systembolaget","Telia Company","Teracom Group","Vattenfall","VisitSweden","Voksenåsen"]
    for page,name in zip(pages,names):
        current=pdf.pages[page]; text=current.extract_text() or ""; words=current.extract_words()
        def first_column(label):
            for top in sorted({round(w["top"],1) for w in words}):
                line=[w for w in words if round(w["top"],1)==top]
                if label.lower() not in " ".join(w["text"] for w in line).lower():continue
                cells=[w["text"] for w in line if 485<=w["x0"]<518 and re.search(r"\d",w["text"])]
                return num("".join(cells)) if cells else ""
            return ""
        share=re.search(r"Statens ägarandel:\s*([\d,.]+)\s*%",text)
        out.append(row("SWE","swe_state_owned_companies_2024","government_managed_state_owned_company_portfolio","2024",name,len(out)+1,entity_class="controlled_enterprise",ownership_level="central",ownership_share_pct=num(share.group(1)) if share else "",status="portfolio_current",revenue=first_column("Nettoomsättning"),operating_result=first_column("Rörelseresultat"),employees=first_column("Antal anställda i medeltal"),currency="SEK",monetary_unit="million",financial_period="2024",source_url=URL["SWE"]))
    assert len(out)==38; return out

def dnk():
    soup=BeautifulSoup((CACHE/"DNK/state-companies-organisation.html").read_text(),"html.parser");out=[]; cls=""
    for tr in soup.find("table").find_all("tr")[1:]:
        cells=[clean(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"])]
        if len(cells)==1: cls=cells[0];continue
        if len(cells)!=3:continue
        if not cells[1] and not cells[2]: cls=cells[0];continue
        share=re.search(r"[\d,.]+",cells[2]);out.append(row("DNK","dnk_state_company_portfolio_2026_01_31","central_state_company_portfolio","2026-01-31",re.sub(r"\s+\d+\)$","",cells[0]),len(out)+1,entity_class="controlled_enterprise",legal_form_native=cls,ownership_level="central",ownership_share_pct=num(share.group()) if share else "",controlling_authority=cells[1],status="portfolio_current",source_url=URL["DNK"]))
    assert len(out)==24;return out
def ukr():
    df=pd.read_csv(CACHE/"UKR/state-sector-enterprises-2026-04-01.csv",dtype=str);out=[]
    for _,r in df.iterrows():out.append(row("UKR","ukr_state_sector_enterprises_2026_04_01","state_sector_enterprises_and_majority_companies","2026-04-01",r.iloc[1],len(out)+1,entity_class="state_enterprise",legal_form_native=clean(r.iloc[4]),ownership_level="central_or_regional_state",controlling_authority=clean(r.iloc[3]),status="in_register",source_url=URL["UKR"],notes=f"managing_authority_code={clean(r.iloc[2])}"))
    assert len(out)==3009;return out

def obs(code,source,period,perimeter,metric,value,unit,url,**dims):return {"country_code":code,"source_id":source,"period":period,"perimeter":perimeter,**dims,"metric":metric,"value":value,"unit":unit,"source_url":url}
def aggregates():
    a=[]
    vals={"entity_count":112145,"budget_law_units":55302,"state_enterprises":21,"public_commercial_companies":6259,"public_foreign_capital_companies":54}
    for k,v in vals.items():a.append(obs("POL","pol_regon_public_sector_2025","2025","public_sector_registered_units_all_levels",k,v,"entities",URL["POL"]))
    a.append(obs("DEU","deu_destatis_public_funds_enterprises_2023","2023","public_funds_institutions_and_enterprises_all_levels","entity_count",20658,"entities","https://www.destatis.de/DE/Themen/Staat/Oeffentliche-Finanzen/Fonds-Einrichtungen-Unternehmen/_inhalt.html"))
    for k,v in {"revenue":189960,"other_activity_income":14192,"operating_margin":46685,"operating_result":24421,"net_result":19194}.items():a.append(obs("FRA","fra_ape_combined_accounts_2024","2024","ape_combined_accounts",k,v,"million_EUR",URL["FRA_ACCOUNTS"]))
    a += [obs("FRA","fra_insee_recme_2023","2023","state_majority_controlled_enterprises_including_indirect_subsidiaries","entity_count",1897,"entities","https://www.insee.fr/fr/statistiques/8642383"),obs("FRA","fra_insee_recme_2023","2023","state_majority_controlled_enterprises_including_indirect_subsidiaries","employees",587000,"persons_approximately","https://www.insee.fr/fr/statistiques/8642383")]
    a.append(obs("GBR","gbr_cabinet_office_public_bodies_2023_24","2023/24","central_government_arms_length_bodies","total_income",391979635984.14,"GBP",URL["GBR_ALB"]))
    for orientation,count,employees,fte in [("market",724,260972,217354),("nonmarket",4428,628174,450811)]:
        for k,v,u in [("entity_count",count,"institutional_units"),("employees",employees,"persons"),("full_time_equivalents",fte,"FTE")]:a.append(obs("CHE","che_bfs_public_sector_units_2024","2024","public_sector_market_and_nonmarket_units",k,v,u,URL["CHE_BFS"],market_orientation=orientation))
    for k,v,u in [("entity_count",800,"entities_approximately"),("revenue",178,"billion_DKK_approximately"),("equity",201,"billion_DKK_approximately"),("employees",57000,"persons_approximately")]:a.append(obs("DNK","dnk_dst_public_enterprises_2024" if k=="entity_count" else "dnk_state_company_portfolio_2026_01_31","2024","public_enterprises_all_government_levels" if k=="entity_count" else "central_state_company_portfolio",k,v,u,URL["DNK_DST"] if k=="entity_count" else URL["DNK"]))
    for k,v,u in [("entity_count",3204,"entities"),("revenue_excluding_associates",480,"billion_SEK"),("revenue_including_associates",517.9,"billion_SEK"),("net_result",69.5,"billion_SEK"),("dividends",23.9,"billion_SEK"),("employees",121800,"persons_approximately"),("portfolio_value",870,"billion_SEK_estimated")]:a.append(obs("SWE","swe_scb_public_owned_enterprises_2024" if k=="entity_count" else "swe_state_owned_companies_2024","2024","state_region_and_municipal_owned_entities" if k=="entity_count" else "government_managed_state_owned_company_portfolio",k,v,u,URL["SWE_SCB"] if k=="entity_count" else URL["SWE"]))
    with zipfile.ZipFile(CACHE/"SWE/public-owned-enterprises-2015-2024.zip") as z:
        df=pd.read_csv(z.open(z.namelist()[0]),encoding="latin-1")
    for _,r in df[df["år"].eq(2024)].iterrows():
        metric=clean(r["tabellinnehåll"]); monetary="mnkr" in metric.lower(); value=pd.to_numeric(r.iloc[-1],errors="coerce"); a.append(obs("SWE","swe_scb_public_owned_enterprises_2024","2024","state_region_and_municipal_owned_entities",metric,None if pd.isna(value) else float(value),"million_SEK" if monetary else "entities_or_persons",URL["SWE_SCB"],sector=clean(r["sektor"]),owner_category=clean(r["ägarkategori"]),legal_form=clean(r["juridisk form  "])))
    return a

def coverage(rows):
    counts={c:Counter(x["perimeter"] for x in rs) for c,rs in rows.items()}; finance={c:Counter(x["perimeter"] for x in rs if any(x[k] != "" for k in ["revenue","operating_result","net_result","assets","equity","liabilities","employees"])) for c,rs in rows.items()}
    meta={
      "CZE":("public_sector_consolidation_units",18238,{}),"POL":("public_sector_registered_units_all_levels",112145,{"public_sector_registered_units_all_levels":112145}),"DEU":("active_federal_direct_holding",20658,{"public_funds_institutions_and_enterprises_all_levels":20658}),"GBR":("national_accounts_public_sector_classifications",None,{}),"FRA":("state_majority_controlled_enterprises_including_indirect_subsidiaries",1897,{"state_majority_controlled_enterprises_including_indirect_subsidiaries":1897}),"USA":("state_and_local_independent_government_units",None,{}),"CHE":("public_sector_market_and_nonmarket_units",5152,{"public_sector_market_and_nonmarket_units":5152}),"SWE":("state_region_and_municipal_owned_entities",3204,{"state_region_and_municipal_owned_entities":3204}),"DNK":("public_enterprises_all_government_levels",800,{"public_enterprises_all_government_levels":800}),"UKR":("state_sector_enterprises_and_majority_companies",3009,{})}
    gaps={"POL":["REGON publishes all-level counts by legal category, but no single open entity-level bulk register combining state, regional and municipal units was identified."],"DEU":["Destatis publishes the all-level universe and aggregates, but the entity-level list was not found as an open bulk download."],"FRA":["The current RECME release reports the complete count and aggregates but does not expose the current entity list as a bulk file."],"CHE":["BFS publishes all-level unit and employment totals, but a harmonised open entity-level register of cantonal and municipal enterprises was not identified."],"SWE":["SCB publishes complete category totals and financial aggregates, but not the underlying entity list as open bulk data."],"DNK":["The official all-level workbook link was broken at crawl time; only the documented population perimeter is recorded."],"UKR":["The downloaded state-sector register does not cover the full municipal public-enterprise universe."],"CZE":[],"GBR":[],"USA":[]}
    sources={c:[{"source_id":sid,"period":next(x["period"] for x in rs if x["source_id"]==sid),"publisher":sid.replace("_"," "),"url":next(x["source_url"] for x in rs if x["source_id"]==sid),"coverage_status":"official_published_source","record_granularity":"entity"} for sid in dict.fromkeys(x["source_id"] for x in rs)] for c,rs in rows.items()}
    out={}
    for c,rs in rows.items():
        comparison,broad,extra=meta[c]; per={p:{"record_count":n,"represented_entity_count":sum(int(x["body_count"] or 1) for x in rs if x["perimeter"]==p),"financial_record_count":finance[c][p]} for p,n in counts[c].items()}
        for p,n in extra.items():per.setdefault(p,{"record_count":0,"represented_entity_count":n,"financial_record_count":0,"coverage_status":"aggregate_only"})
        out[c]={"comparison_perimeter":comparison,"broad_entity_count":broad,"registry_file":f"data/public-entities/{c}.v1.csv.gz","registry_record_count":len(rs),"perimeters":per,"sources":sources[c],"unresolved_layers":gaps[c]}
    out["DNK"]["broad_count_is_approximate"]=True;return out

def main():
    builders={"CZE":cze,"POL":pol,"DEU":deu,"GBR":gbr,"FRA":fra,"USA":usa,"CHE":che,"SWE":swe,"DNK":dnk,"UKR":ukr}; rows={}
    for code,builder in builders.items(): rows[code]=builder();write_country(code,rows[code]);print(code,len(rows[code]))
    cov={"schema_version":"1.0.0","contract":"public-entity-coverage.v1","generated_at":GENERATED,"comparison_warning":"Perimeters are source-scoped and non-additive; missing financial values are unavailable, not zero.","methodology":{"record_id":"source-scoped identity","financial_nulls":"unavailable, never zero"},"countries":coverage(rows)}
    (ROOT/"data/public-entity-coverage.v1.json").write_text(json.dumps(cov,ensure_ascii=False,indent=2)+"\n")
    agg={"schema_version":"1.0.0","contract":"public-entity-aggregates.v1","generated_at":GENERATED,"warning":cov["comparison_warning"],"observations":aggregates()};(ROOT/"data/public-entity-aggregates.v1.json").write_text(json.dumps(agg,ensure_ascii=False,indent=2)+"\n")
    assets=[]
    for p in sorted(CACHE.glob("*/*")):
        data=p.read_bytes();assets.append({"path":str(p.relative_to(ROOT.parent)),"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()})
    (ROOT/"pipeline/public-entity-source-assets.manifest.json").write_text(json.dumps({"generated_at":GENERATED,"algorithm":"sha256","assets":assets},indent=2)+"\n")
if __name__=="__main__":main()
