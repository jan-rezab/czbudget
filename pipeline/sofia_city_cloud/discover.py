import hashlib, io, json
import pandas as pd
import requests

URLS = [
 "https://svc.sofia.bg/documents/d/guest/1-prilozenie-1-za-prihodite-po-budzeta-na-stolicna-obsina-za-2025g",
 "https://svc.sofia.bg/documents/d/guest/2-prilozenie-2-za-razhodite-po-budzeta-na-stolicna-obsina-za-2025-g",
]
out=[]
session=requests.Session()
session.headers.update({"User-Agent":"Mozilla/5.0 (compatible; PublicSpendingData/1.0)","Referer":"https://svc.sofia.bg/bg/web/guest/2025-financial-year"})
session.get("https://svc.sofia.bg/bg/web/guest/2025-financial-year",timeout=120)
for url in URLS:
 r=session.get(url,timeout=120); r.raise_for_status(); body=r.content
 item={"url":url,"final_url":r.url,"content_type":r.headers.get("content-type"),"bytes":len(body),"sha256":hashlib.sha256(body).hexdigest(),"magic":body[:8].hex()}
 try:
  book=pd.ExcelFile(io.BytesIO(body)); item["sheets"]=book.sheet_names
  item["previews"]={name:pd.read_excel(io.BytesIO(body),sheet_name=name,header=None,nrows=15).fillna("").astype(str).values.tolist() for name in book.sheet_names[:3]}
 except Exception as exc: item["error"]=repr(exc)
 out.append(item)
print(json.dumps(out,ensure_ascii=False))
