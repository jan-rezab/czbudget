"""Inspect the cloud-only crawler checkpoint; never restore it on a workstation."""
import hashlib,json,sqlite3,subprocess
from pathlib import Path
bucket='gs://czbudget-janrezab-un-comtrade-raw'
def cat(uri):return subprocess.check_output(['gcloud','storage','cat',uri])
m=json.loads(cat(bucket+'/manifests/latest.json'))
b=cat(m['checkpoint']['uri']+'#'+m['checkpoint']['generation'])
assert hashlib.sha256(b).hexdigest()==m['checkpoint']['sha256']
Path('/tmp/crawl.sqlite3').write_bytes(b)
c=sqlite3.connect('/tmp/crawl.sqlite3');c.row_factory=sqlite3.Row
for label,q in [
 ('monthly_status',"SELECT period,flow_code,status,count(*) n,count(distinct reporter_iso3) reporters,sum(record_count) records FROM tasks WHERE frequency='M' AND product_type='C' GROUP BY 1,2,3 ORDER BY 1,2,3"),
 ('sample',"SELECT * FROM tasks WHERE frequency='M' AND status='completed' AND reporter_iso3='USA' LIMIT 2"),
 ('tables',"SELECT sql FROM sqlite_master WHERE type='table' AND name NOT IN ('tasks','availability')")]:
 print(label,json.dumps([dict(r) for r in c.execute(q)]),flush=True)
