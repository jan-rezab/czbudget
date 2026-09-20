#!/usr/bin/env python3
"""Load enacted 2025 Budapest capital-municipality budget detail from its official XLSX."""
import hashlib, io, json, re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

import openpyxl
import requests
from google.cloud import bigquery

PROJECT="czbudget-janrezab"; DATASET="budget_detail"; ENTITY="HU:13578"
SOURCE_ID="hu-budapest-approved-budget-2025-detail"
LANDING="https://einfoszab.budapest.hu/session/DvdItem/125496?key=fovarosi-kozgyules-nyilvanos-ulesei&organizationtype=2&parentid=18407&parenttype=2&sessionType=1&type=5"
URL="https://einfoszab.budapest.hu/File/DownloadDvD/125496?fileId=201239&filename=szerkesztheto_m01m01_1.+mell%C3%A9klet+-+rendeleti+t%C3%A1bla+2025_rev.xlsx&key=fovarosi-kozgyules-nyilvanos-ulesei&organizationtype=2&parentId=18407&parenttype=2&path=Tev%C3%A9kenys%C3%A9gre%2C+m%C5%B1k%C3%B6d%C3%A9sre+vonatkoz%C3%B3+adatok+%2F+D%C3%B6nt%C3%A9shozatal%2C+%C3%BCl%C3%A9sek+%2F+A+F%C5%91v%C3%A1rosi+K%C3%B6zgy%C5%B1l%C3%A9s+%C3%BCl%C3%A9sei&prevaction=DvdItem&prevcont=Session&sessionType=1&type=5"
COLUMNS={9:("expenditure","operating_expenditure"),10:("revenue","operating_revenue"),11:("expenditure","capital_expenditure"),12:("revenue","capital_revenue"),13:("financing","financing_expenditure"),14:("financing","financing_revenue")}

def text(value):
    return re.sub(r"\s+"," ",str(value or "")).strip()

def amount(value):
    if value in (None, ""): return None
    try:
        number=Decimal(str(value))
        return number if number.is_finite() and number != 0 else None
    except (InvalidOperation, ValueError): return None

def fetch():
    response=requests.get(URL,headers={"User-Agent":"Mozilla/5.0 (compatible; PublicSpendingData/1.0)","Referer":LANDING},timeout=180)
    response.raise_for_status()
    if "spreadsheet" not in response.headers.get("content-type","") or len(response.content)<100000:
        raise RuntimeError(f"source contract failed: type={response.headers.get('content-type')} bytes={len(response.content)}")
    return response.content

def parse(body, loaded):
    workbook=openpyxl.load_workbook(io.BytesIO(body),data_only=True,read_only=True)
    rows=[]; sheets=[]; excluded_sheets=[]
    for sheet in workbook.worksheets:
        if sheet.title in {"Mindösszesen", "01 02 03megbontás"}:
            excluded_sheets.append(sheet.title); continue
        values=list(sheet.iter_rows(values_only=True))
        header=next((idx for idx,row in enumerate(values) if text(row[0] if len(row)>0 else None).startswith("Feladat besoro") and text(row[3] if len(row)>3 else None).startswith("Kiemelt")),None)
        if header is None:
            excluded_sheets.append(sheet.title); continue
        task_code=task_name=title_code=title_name=""; sheet_count=0
        for idx,row in enumerate(values[header+1:],start=header+2):
            cells=list(row)+[None]*max(0,15-len(row))
            maybe_task=text(cells[0])
            if re.fullmatch(r"0[123]",maybe_task) and text(cells[5]):
                task_code=maybe_task; task_name=text(cells[5])
            if re.fullmatch(r"\d{6}",text(cells[1])):
                title_code=text(cells[1]); title_name=text(cells[2])
            item_code=text(cells[3]).replace(" ","")
            if not re.fullmatch(r"[KB]\d{1,3}",item_code): continue
            item_name=text(cells[8]); deal_code=text(cells[6]); project_name=text(cells[7])
            if not title_code or not item_name: continue
            for column,(side,measure) in COLUMNS.items():
                value=amount(cells[column])
                if value is None: continue
                consolidation=item_code in {"K915","B816"}
                composite=":".join(part for part in (title_code,task_code,item_code,deal_code or "none",measure) if part)
                label=" | ".join(part for part in (title_name,project_name,item_name) if part)
                rows.append({
                    "public_entity_id":ENTITY,"fiscal_year":2025,"fiscal_period":"FY","reporting_scope":"budapest_municipality_consolidated_budget",
                    "budget_stage":"enacted","budget_side":side,"source_budget_item_type_code":label,"functional_paragraph_code":title_code,
                    "economic_item_code":composite,"functional_classification_id":"HU_BUDAPEST_TITLE_2025","economic_classification_id":"HU_COFOG_ECONOMIC_2025",
                    "amount_local":str(abs(value)),"currency_code":"HUF","amount_eur":None,"fx_date":None,"is_consolidation_item":consolidation,
                    "is_financing":side=="financing" or item_code.startswith(("K9","B8")),"is_summary_row":False,"source_row_number":idx,"source_sheet":sheet.title,
                    "source_id":SOURCE_ID,"ingestion_run_id":"hu-budapest-budget-2025-v1","coverage_type":"published_subset","is_imputed":False,
                    "quality_flags":["official_budapest_capital_municipality","ordinance_29_2024_xii_31","enacted_2025_appropriation","coded_published_line","anchor_only_not_un_agglomeration",f"task:{task_code or 'unspecified'}",f"measure:{measure}"],
                    "loaded_at":loaded
                }); sheet_count+=1
        sheets.append({"sheet":sheet.title,"rows_loaded":sheet_count})
    if len(rows)<500: raise RuntimeError(f"parsed too few line rows: {len(rows)}")
    return rows,sheets,excluded_sheets

def main():
    loaded=datetime.now(timezone.utc).isoformat(); body=fetch(); rows,sheets,excluded=parse(body,loaded)
    client=bigquery.Client(project=PROJECT); target=f"{PROJECT}.{DATASET}.municipal_budget_line_facts"; stage=f"{PROJECT}.{DATASET}._budapest_city_budget_stage"
    client.query(f"CREATE OR REPLACE TABLE `{stage}` LIKE `{target}`").result(); client.load_table_from_json(rows,stage).result()
    if client.get_table(stage).num_rows != len(rows): raise RuntimeError("stage row mismatch")
    client.query(f"BEGIN TRANSACTION; DELETE FROM `{target}` WHERE fiscal_year=2025 AND public_entity_id='{ENTITY}' AND source_id='{SOURCE_ID}'; INSERT INTO `{target}` SELECT * FROM `{stage}` WHERE fiscal_year=2025; COMMIT TRANSACTION; DROP TABLE `{stage}`;").result()
    counts={}
    for row in rows: counts[row["budget_side"]]=counts.get(row["budget_side"],0)+1
    receipt={"retrieved_at":loaded,"entity_id":ENTITY,"fiscal_year":2025,"budget_stage":"enacted","ordinance":"29/2024 (XII. 31.)","reporting_scope":"Budapest capital municipality consolidated budget; excludes 23 district municipalities and is not the UN built-up area","official_landing_page":LANDING,"official_url":URL,"source_id":SOURCE_ID,"sha256":hashlib.sha256(body).hexdigest(),"bytes":len(body),"rows_loaded":len(rows),"rows_by_side":counts,"sheets":sheets,"excluded_summary_sheets":excluded}
    Path("/workspace/budapest-receipt.json").write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(receipt,ensure_ascii=False))

if __name__=="__main__": main()
