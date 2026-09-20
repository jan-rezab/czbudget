#!/usr/bin/env python3
"""Load Vienna's official municipality-supplied 2025 result and financing account CSVs."""
import csv, hashlib, io, json, re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from google.cloud import bigquery

PROJECT="czbudget-janrezab"; DATASET="budget_detail"; ENTITY="AT:90001"
LANDING="https://www.offenerhaushalt.at/gemeinde/wien/downloads"
FORM="https://www.offenerhaushalt.at/gemeinde/wien/download?from_downloads_list=1&origin=gemeinde&rechnungsabschluss=1&year=2025"
TOKEN_ENDPOINT="https://www.offenerhaushalt.at/downloads/get-token"
DOWNLOAD_ENDPOINT="https://www.offenerhaushalt.at/downloads/ghdByParams"
COMPONENTS={"ehh":{"stage":"actual","name":"Ergebnishaushalt"},"fhh":{"stage":"paid","name":"Finanzierungshaushalt"}}

def dec(value):
    value=str(value or "").strip().replace(".","").replace(",",".")
    try:
        out=Decimal(value); return out if out.is_finite() and out != 0 else None
    except InvalidOperation: return None

def download(session, budget, token, contract):
    fields={"gkz":"90001","_token":token,"haushalt":budget,"rechnungsabschluss":"ra","year":"2025","origin":"gemeinde"}
    response=session.request(contract["method"],contract["action"],data=fields,headers={"Referer":FORM},timeout=240)
    response.raise_for_status()
    if "text/csv" not in response.headers.get("content-type","") or len(response.content)<100000:
        raise RuntimeError(f"source contract failed {budget}: {response.status_code} {response.headers.get('content-type')} {len(response.content)}")
    return response.content

def parse(body, budget, loaded):
    source_id=f"at-vienna-municipality-account-2025-{budget}"
    reader=csv.DictReader(io.StringIO(body.decode("utf-8-sig")),delimiter=";")
    rows=[]; rejected_mvag=set()
    for n,row in enumerate(reader,start=2):
        value=dec(row.get("Wert"))
        if value is None: continue
        mvag=str(row.get("Mvag") or "").strip()
        if budget=="ehh":
            side="revenue" if mvag.startswith("21") else "expenditure" if mvag.startswith("22") else None
        else:
            side="revenue" if mvag.startswith(("31","33","35")) else "expenditure" if mvag.startswith(("32","34","36")) else None
        if side is None: rejected_mvag.add(mvag); continue
        function=f"{row.get('Ansatz-Uab','').strip()}{row.get('Ansatz-Ugl','').strip()}"
        account=f"{row.get('Konto-Grp','').strip()}{row.get('Konto-Ugl','').strip()}"
        project=row.get("Vorhabencode","").strip()
        code=f"{budget}:{function}:{account}:{project}:{mvag}"
        label=" | ".join(x for x in (row.get("Ansatz-Text","").strip(),row.get("Konto-Text","").strip()) if x)
        rows.append({"public_entity_id":ENTITY,"fiscal_year":2025,"fiscal_period":"FY","reporting_scope":"vienna_city_state_municipal_accounts","budget_stage":COMPONENTS[budget]["stage"],"budget_side":side,"source_budget_item_type_code":label,"functional_paragraph_code":function,"economic_item_code":code,"functional_classification_id":"AT_VRV2015_ANSATZ_2025","economic_classification_id":"AT_VRV2015_KONTO_MVAG_2025","amount_local":str(abs(value)),"currency_code":"EUR","amount_eur":str(abs(value)),"fx_date":"2025-12-31","is_consolidation_item":False,"is_financing":budget=="fhh" and mvag.startswith(("35","36")),"is_summary_row":False,"source_row_number":n,"source_sheet":COMPONENTS[budget]["name"],"source_id":source_id,"ingestion_run_id":"at-vienna-account-2025-v2","coverage_type":"published_subset","is_imputed":False,"quality_flags":["official_city_of_vienna_open_data","municipality_supplied_final_account","coded_account_function_project_line","anchor_only_not_un_agglomeration",f"mvag:{mvag}",f"basis:{COMPONENTS[budget]['stage']}"] ,"loaded_at":loaded})
    if len(rows)<1000: raise RuntimeError(f"too few Vienna {budget} lines: {len(rows)}")
    return rows,sorted(rejected_mvag)

def main():
    loaded=datetime.now(timezone.utc).isoformat(); session=requests.Session(); session.headers.update({"User-Agent":"Mozilla/5.0 (compatible; PublicSpendingData/1.0)"})
    page=session.get(FORM,timeout=120); page.raise_for_status(); soup=BeautifulSoup(page.text,"html.parser"); token=soup.find("input",{"name":"_token"})["value"]
    auth=session.post(TOKEN_ENDPOINT,data={"foo":"bar","_token":token},headers={"Referer":FORM,"X-Requested-With":"XMLHttpRequest","X-CSRF-TOKEN":token},timeout=120); auth.raise_for_status(); contract=auth.json()
    if contract.get("action") != DOWNLOAD_ENDPOINT or contract.get("method") != "POST": raise RuntimeError(f"unexpected download contract {contract}")
    facts=[]; sources={}
    for budget in COMPONENTS:
        body=download(session,budget,token,contract); parsed,rejected=parse(body,budget,loaded); facts.extend(parsed)
        sources[budget]={"component":COMPONENTS[budget]["name"],"budget_stage":COMPONENTS[budget]["stage"],"official_url":DOWNLOAD_ENDPOINT,"request_parameters":{"gkz":"90001","haushalt":budget,"rechnungsabschluss":"ra","year":"2025","origin":"gemeinde"},"sha256":hashlib.sha256(body).hexdigest(),"bytes":len(body),"rows_loaded":len(parsed),"excluded_mvag_codes":rejected}
    client=bigquery.Client(project=PROJECT); target=f"{PROJECT}.{DATASET}.municipal_budget_line_facts"; stage=f"{PROJECT}.{DATASET}._vienna_city_account_stage"
    client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result(); client.load_table_from_json(facts,stage).result()
    if client.get_table(stage).num_rows != len(facts): raise RuntimeError("stage row mismatch")
    client.query(f"BEGIN TRANSACTION; DELETE FROM `{target}` WHERE fiscal_year=2025 AND public_entity_id='{ENTITY}' AND STARTS_WITH(source_id,'at-vienna-municipality-account-2025-'); INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year=2025; COMMIT TRANSACTION; DROP TABLE `{stage}`;").result()
    counts={}
    for row in facts: counts[f"{row['budget_stage']}:{row['budget_side']}"]=counts.get(f"{row['budget_stage']}:{row['budget_side']}",0)+1
    receipt={"retrieved_at":loaded,"entity_id":ENTITY,"fiscal_year":2025,"reporting_scope":"City and Land Vienna legal government; not the complete UN built-up area","official_landing_page":LANDING,"official_metadata_url":"https://www.data.gv.at/datasets/71cb70af-2d7a-4b6d-811c-489f254a0353?locale=de","download_endpoint":DOWNLOAD_ENDPOINT,"rows_loaded":len(facts),"rows_by_stage_side":counts,"sources":sources,"excluded_component":"Vermögenshaushalt balance sheet"}
    Path("/workspace/vienna-receipt.json").write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n"); print(json.dumps(receipt,ensure_ascii=False))

if __name__=="__main__": main()
