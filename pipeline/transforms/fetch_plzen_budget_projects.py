#!/usr/bin/env python3
"""Cache Plzen's public investment-project tree and payment details.

The city application exposes its data through Next.js server actions rather than a
documented public API.  This fetcher is deliberately sequential, rate limited and
writes one local snapshot so the public website never calls the city application.
"""

from __future__ import annotations

import argparse
import hashlib
import math
import re
import shutil
import requests
from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit
import json
import time
import urllib.error
import urllib.request
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WEB = Path(__file__).resolve().parents[2]
OUTPUT = WEB / "data/contracts/00075370.plzen-projects.v1.json"
ENDPOINT = "https://rozpocetmesta.plzen.eu/stavebni-investice"

CACHE = WEB.parent / "data/source_cache/plzen-investments"
ACTION_NAMES = ("getNode", "getBuildingNode", "getDetail")

class Scripts(HTMLParser):
    def __init__(self): super().__init__(); self.urls=[]
    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("src"): self.urls.append(dict(attrs)["src"])

def discover_references(chunks):
    found={name:set() for name in ACTION_NAMES}
    pattern=r'createServerReference\)\(\s*["\']([a-f0-9]{40,64})["\'][^;]{0,250}?,\s*["\'](getNode|getBuildingNode|getDetail)["\']\s*\)'
    for text in chunks:
        for action,name in re.findall(pattern,text): found[name].add(action)
    if any(len(ids)!=1 for ids in found.values()):
        raise ValueError(f"Missing or ambiguous named server actions: {found}")
    return {name:next(iter(ids)) for name,ids in found.items()}

def flight_number(value):
    # React Flight represents special JS numbers as tokens. Keep signed zero;
    # undefined remains missing, never a monetary zero. Raw tokens are archived.
    if value == "$-0": return -0.0
    if value == "$undefined": return None
    return value

def numeric(value):
    return value is None or (isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value))

def validate_payload(name,payload):
    if not isinstance(payload,dict) or payload.get("isError") is not False or "data" not in payload:
        raise ValueError("City action failed or response envelope changed")
    data=payload["data"]
    if name in ("getNode","getBuildingNode"):
        if not isinstance(data,list): raise ValueError("Node data must be an explicit array")
        for node in data:
            required={"title","nodeId","detailId","approved","edited","real","hasChild"}
            if not isinstance(node,dict) or not required.issubset(node): raise ValueError("Node schema changed")
            if not isinstance(node['title'],str) or not isinstance(node['hasChild'],bool): raise ValueError("Node types changed")
            for k in ('approved','edited','real'):node[k]=flight_number(node[k])
            if any(not numeric(node[k]) for k in ('approved','edited','real')): raise ValueError("Invalid node financial values")
    elif name=="getDetail":
        required={'Akce','Nazev','StavDatum','Uhrazeno','Vyfakturovano','CelkoveNakladyPRP','CelkoveNakladyRealizace','StavebniNakladyRealizace','priprava','realizace','uhrazenoStruktura'}
        if not isinstance(data,dict) or not required.issubset(data): raise ValueError("Detail schema changed or unavailable detail")
        if not isinstance(data['Akce'],str) or not isinstance(data['Nazev'],str): raise ValueError('Invalid detail identity')
        for key in ('Uhrazeno','Vyfakturovano','CelkoveNakladyPRP','CelkoveNakladyRealizace','StavebniNakladyRealizace'):
            data[key]=flight_number(data[key])
            if not numeric(data[key]): raise ValueError('Invalid detail financial value')
        for key in ('priprava','realizace','uhrazenoStruktura'):
            if not isinstance(data[key],list): raise ValueError('Detail tables must be explicit arrays')
        for row in data['uhrazenoStruktura']:
            if isinstance(row,dict) and 'castka' in row:row['castka']=flight_number(row['castka'])
            if not isinstance(row,dict) or not {'fiskalniRok','castka'}.issubset(row) or not isinstance(row['fiskalniRok'],int) or not numeric(row['castka']): raise ValueError('Invalid annual payment row')
        for row in data['priprava']+data['realizace']:
            if isinstance(row,dict) and 'Cena' in row:row['Cena']=flight_number(row['Cena'])
            if not isinstance(row,dict) or not {'Cena','Dodavatel','IC','Stupen'}.issubset(row) or not numeric(row['Cena']): raise ValueError('Invalid phase row')
    else: raise ValueError('Unknown action')
    return data

class CityClient:
    def __init__(self, delay: float, max_requests: int, cache: Path) -> None:
        self.delay=delay; self.max_requests=max_requests; self.requests=0; self.last_request=0.0
        self.cache=cache;cache.mkdir(parents=True,exist_ok=True)
        self.session=requests.Session();self.session.headers['User-Agent']='PublicSpendingData-source-archiver/1.0'
        self.records=[];self.actions={}
    def request(self,url,*,name,args=None):
        error=None
        for attempt in range(3):
            if self.requests>=self.max_requests:raise RuntimeError(f'Safety cap of {self.max_requests} requests reached')
            time.sleep(max(0,self.delay-(time.monotonic()-self.last_request)))
            self.requests+=1
            try:
                headers={'Accept':'text/x-component','Content-Type':'text/plain;charset=UTF-8','Next-Action':self.actions[name]} if args is not None else {}
                with self.session.request('POST' if args is not None else 'GET',url,data=json.dumps(args,ensure_ascii=False).encode('utf-8') if args is not None else None,headers=headers,timeout=45,verify=True) as response:
                    raw=response.content
                    digest=hashlib.sha256(raw).hexdigest();path=self.cache/f'{self.requests:04d}-{name}-{digest[:12]}.raw'
                    path.write_bytes(raw)
                    record={'url':url,'resolved_url':response.url,'retrieved_at':datetime.now(timezone.utc).isoformat(),'sha256':digest,'path':str(path.relative_to(CACHE)),'bytes':len(raw),'http_status':response.status_code,'action_name':name,'action_id':self.actions.get(name),'arguments':args,'source_validity':None}
                    self.records.append(record)
                    path.with_suffix('.meta.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
                    response.raise_for_status()
                return raw.decode('utf-8'),record,path
            except (requests.RequestException,TimeoutError) as exc:
                error=exc
                if attempt<2:time.sleep(2**attempt)
            finally:self.last_request=time.monotonic()
        raise RuntimeError(f'City request failed after retries: {error}')
    def discover(self):
        html,_,_=self.request(ENDPOINT,name='html');parser=Scripts();parser.feed(html)
        urls=list(dict.fromkeys(urljoin(ENDPOINT,u) for u in parser.urls))
        if not urls or len(urls)>30:raise ValueError('Unexpected script inventory')
        if any(urlsplit(u).netloc!=urlsplit(ENDPOINT).netloc or '/_next/' not in urlsplit(u).path for u in urls):raise ValueError('Unexpected script origin')
        chunks=[self.request(url,name='chunk')[0] for url in urls]
        self.actions=discover_references(chunks)
    def call(self,name,args):
        body,record,path=self.request(ENDPOINT,name=name,args=args)
        matches=[line[2:] for line in body.splitlines() if line.startswith('1:')]
        if len(matches)!=1:raise ValueError('Unexpected React server-action response')
        payload=json.loads(matches[0]);data=validate_payload(name,payload)
        if name=='getDetail':
            if data['Akce']!=str(args[0]):raise ValueError('Returned project ID mismatch')
            record['source_validity']=data['StavDatum']
            path.with_suffix('.meta.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
        return payload

def clean_node(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": node.get("title"),
        "node_id": None if node.get("nodeId") in (None, "$undefined", "-1") else node.get("nodeId"),
        "detail_id": None if node.get("detailId") in (None, "$undefined") else node.get("detailId"),
        "approved_thousand_czk": node.get("approved"),
        "adjusted_thousand_czk": node.get("edited"),
        "actual_thousand_czk": node.get("real"),
        "has_children": bool(node.get("hasChild")),
    }


def crawl_year(client: CityClient, year: int) -> list[dict[str, Any]]:
    root = client.call("getNode", ["39", "MMP", str(year)])["data"]
    queue: deque[tuple[dict[str, Any], list[str]]] = deque((node, []) for node in root)
    rows: list[dict[str, Any]] = []
    visited: set[str] = set()

    while queue:
        raw, parents = queue.popleft()
        node = clean_node(raw)
        row = {**node, "year": year, "path": parents + [node["title"]]}
        rows.append(row)
        node_id = node["node_id"]
        if not node["has_children"] or node_id is None or str(node_id) in visited:
            continue
        visited.add(str(node_id))
        children = client.call("getBuildingNode", [node_id, str(year)])["data"]
        queue.extend((child, row["path"]) for child in children)
    return rows


def compact_detail(detail: dict[str, Any]) -> dict[str, Any]:
    suppliers: dict[str, dict[str, Any]] = {}
    phases = []
    for source_key, kind in (("priprava", "preparation"), ("realizace", "delivery")):
        for item in detail.get(source_key) or []:
            ico = item.get("IC")
            name = (item.get("Dodavatel") or "").strip()
            if ico or name:
                suppliers[ico or name] = {"name": name, "ico": ico}
            phases.append({
                "kind": kind,
                "stage": item.get("Stupen"),
                "status": item.get("StavStupne"),
                "started_at": item.get("Zahajeno"),
                "finished_at": item.get("Dokonceno"),
                "price_czk": item.get("Cena"),
                "supplier_name": name or None,
                "supplier_ico": ico,
            })

    return {
        "code": detail.get("Akce"),
        "title": detail.get("Nazev"),
        "as_of": detail.get("StavDatum"),
        "preparation_status": detail.get("StavProjektovePripravyText"),
        "delivery_status": detail.get("StavRealizaceText"),
        "preparation_started_at": detail.get("DatumZahajeniPRP"),
        "preparation_finished_at": detail.get("DatumDokonceniPRP"),
        "delivery_started_at": detail.get("DatumZahajeniRealizace"),
        "delivery_finished_at": detail.get("DatumDokonceniRealizace"),
        "preparation_cost_czk": detail.get("CelkoveNakladyPRP"),
        "delivery_cost_czk": detail.get("CelkoveNakladyRealizace"),
        "construction_cost_czk": detail.get("StavebniNakladyRealizace"),
        "invoiced_czk": detail.get("Vyfakturovano"),
        "paid_czk": detail.get("Uhrazeno"),
        "paid_by_fiscal_year": [
            {"year": item.get("fiskalniRok"), "amount_czk": item.get("castka")}
            for item in (detail.get("uhrazenoStruktura") or [])
        ],
        "suppliers": list(suppliers.values()),
        "phases": phases,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-year", type=int, default=2018)
    parser.add_argument("--to-year", type=int, default=2026)
    parser.add_argument("--delay", type=float, default=0.25, help="Minimum seconds between requests")
    parser.add_argument("--max-requests", type=int, default=1200)
    args = parser.parse_args()
    if args.delay < 0.1:
        raise SystemExit("Refusing a delay below 0.1 seconds")

    if args.from_year>args.to_year:raise SystemExit('Invalid year range')
    run_id=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    cache=CACHE/run_id;cache.mkdir(parents=True,exist_ok=True)
    if OUTPUT.exists():
        shutil.copy2(OUTPUT,cache/'previous-serving-artifact.json')
        (cache/'previous-serving-artifact.sha256').write_text(hashlib.sha256(OUTPUT.read_bytes()).hexdigest()+'\n')
    client = CityClient(args.delay, args.max_requests,cache)
    client.discover()
    rows = []
    for year in range(args.from_year, args.to_year + 1):
        print(f"Crawling project tree {year}…", flush=True)
        rows.extend(crawl_year(client, year))

    detail_ids = sorted({row["detail_id"] for row in rows if row["detail_id"]})
    details = []
    for index, detail_id in enumerate(detail_ids, 1):
        if index == 1 or index % 50 == 0:
            print(f"Fetching project details {index}/{len(detail_ids)}…", flush=True)
        detail = client.call("getDetail", [detail_id])["data"]
        details.append(compact_detail(detail))

    payload = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entity": {"name": "statutární město Plzeň", "ico": "00075370"},
        "period": {"from": args.from_year, "to": args.to_year},
        "source": {
            "name": "Rozpočet města Plzně — stavební investice MMP",
            "url": "https://rozpocetmesta.plzen.eu/stavebni-investice",
            "access": "cached Next.js server-action snapshot",
            "action_discovery": client.actions,
            "raw_snapshot": str(cache.relative_to(WEB.parent)),
            "raw_response_manifest": str((cache/"manifest.json").relative_to(WEB.parent)),
            "source_validity_dates": sorted({d["as_of"] for d in details if d.get("as_of")}),
            "native_units": {"budget_tree":"CZK_thousands","project_costs_and_payments":"CZK"},
            "explicit_empty_tree_years": [year for year in range(args.from_year,args.to_year+1) if not any(r["year"]==year for r in rows)],
            "scope": "Stavební investice Magistrátu města Plzně shown by the city application",
        },
        "request_policy": {
            "sequential": True,
            "minimum_delay_seconds": args.delay,
            "safety_cap": args.max_requests,
            "requests_this_run": client.requests,
            "website_runtime_requests": 0,
        },
        "budget_rows": rows,
        "projects": details,
    }
    (cache/'manifest.json').write_text(json.dumps({'complete':True,'actions':client.actions,'responses':client.records,'budget_rows':len(rows),'project_details':len(details)},ensure_ascii=False,indent=2)+'\n')
    temporary=OUTPUT.with_suffix('.part')
    temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT)
    client.session.close()
    print(json.dumps({
        "budget_rows": len(rows),
        "project_ids": len(detail_ids),
        "project_details": len(details),
        "requests": client.requests,
        "output": str(OUTPUT),
    }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
