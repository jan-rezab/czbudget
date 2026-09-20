#!/usr/bin/env python3
import csv, hashlib, io, json, zipfile
from pathlib import Path
import requests
import pandas as pd

SOURCES={
 "expense_2024":"https://portalautarquico.dgal.gov.pt/ficheiros/?channel=a7187039-4863-4c6c-9ef0-1422b677728d&content_id=146E0A67-200E-4762-9485-1E3DE31F1EF2&dtestate=2025-11-18110913&field=storage_image&filetype=pdf&lang=pt&schema=f7664ca7-3a1a-4b25-9f46-2056eef44c33&ver=1",
 "revenue_2024":"https://portalautarquico.dgal.gov.pt/ficheiros/?channel=a7187039-4863-4c6c-9ef0-1422b677728d&content_id=C2D515CE-1EA6-4CEA-9FD7-1849E59C2DEC&dtestate=2025-11-17103717&field=storage_image&filetype=pdf&lang=pt&schema=f7664ca7-3a1a-4b25-9f46-2056eef44c33&ver=1",
}
def main():
 out={}
 for sid,url in SOURCES.items():
  r=requests.get(url,timeout=120); r.raise_for_status(); body=r.content
  item={"url":url,"bytes":len(body),"sha256":hashlib.sha256(body).hexdigest(),"members":[]}
  with zipfile.ZipFile(io.BytesIO(body)) as z:
   for info in z.infolist():
    raw=z.read(info); sample=raw[:12000].decode("utf-8-sig",errors="replace")
    item["members"].append({"name":info.filename,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"sample":sample.splitlines()[:12]})
  book=pd.ExcelFile(io.BytesIO(body),engine="odf")
  item["sheets"]={}
  for sheet in book.sheet_names:
   frame=pd.read_excel(book,sheet_name=sheet,header=None)
   matches=frame[frame.apply(lambda row: row.astype(str).str.contains("Lisboa",case=False,na=False).any(),axis=1)]
   item["sheets"][sheet]={"shape":list(frame.shape),"head":frame.head(12).fillna("").astype(str).values.tolist(),"lisboa_rows":matches.head(20).fillna("").astype(str).values.tolist()}
  out[sid]=item
 Path('/workspace/portugal-discovery.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:{"bytes":v["bytes"],"members":[m["name"] for m in v["members"]]} for k,v in out.items()}))
if __name__=='__main__': main()
