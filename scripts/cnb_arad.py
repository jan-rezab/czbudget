"""Public production ARAD monetary history. No test service or account required."""
import hashlib,json,os,subprocess
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
BASE='https://www.cnb.cz/aradb/api/v13/indicators-data-by-id2?snList=&periodFrom=&periodTo=&roleId=U&type=set&chartData=&id=1191&setParams='
PARAMETERS={'levels':'D21657','flows':'D21658','growth':'D21660'}
CODES={'currency':'SMV4M1101','m1':'SMV5M103','m2':'SMV5M106','m3':'SMV5M108','government_credit':'SMV6M105','private_credit':'SMV6M106','net_foreign_assets':'SMV6M108','m1_yoy':'SMV5M603','m2_yoy':'SMV5M606','m3_yoy':'SMV5M608'}
def acquire():
 directory=Path(os.environ.get('CNB_ARAD_INPUT',ROOT.parent/'outputs/czech-source-implementation-20260909/sources'));directory.mkdir(parents=True,exist_ok=True)
 result={};native=[];sources=[]
 for kind,parameter in PARAMETERS.items():
  path=directory/('arad-set1191.json' if kind=='levels' else f'arad-set1191-{kind}.json');url=BASE+parameter
  if not path.exists() or not os.environ.get('CNB_ARAD_INPUT') or os.environ.get('CNB_ARAD_REFRESH')=='1':
   body=subprocess.run(['curl','-sS','-L','--fail','--max-time','60',url],capture_output=True,check=True).stdout
   json.loads(body);path.write_bytes(body)
  body=path.read_bytes();sha=hashlib.sha256(body).hexdigest();snapshot=directory/f'arad-1191-{kind}-{sha[:12]}.json'
  if not snapshot.exists():snapshot.write_bytes(body)
  payload=json.loads(body)['data'][0];assert payload['id']==1191
  sources.append({'url':url,'sha256':sha,'kind':kind,'retrieved_at':datetime.fromtimestamp(path.stat().st_mtime,timezone.utc).isoformat(),'acquired_file':snapshot.name})
  for indicator in payload['indicators']:
   unit=indicator['units_name']['en'];assert unit==('%' if kind=='growth' else 'Million of CZK'),(kind,unit)
   snapshots=indicator['snapshots_data'];assert len(snapshots)==1
   points=[]
   for timestamp,value in snapshots[0]['data']:
    if value is None:continue
    if not isinstance(value,(int,float)):raise ValueError(f'Unexpected ARAD value {value}')
    period=datetime.fromtimestamp(timestamp/1000,timezone.utc).strftime('%Y-%m');points.append([period,value])
   assert points==sorted(points) and len({p for p,v in points})==len(points)
   native.append({'code':indicator['code'],'name':indicator['name'],'kind':kind,'unit':unit,'frequency':'M','points':points})
   for name,code in CODES.items():
    if indicator['code']==code:
     result[name]=[[p,v if kind=='growth' else v/1e6] for p,v in points]
 assert set(result)==set(CODES)
 assert all(len(v)>250 for v in result.values())
 artifact={'schema_version':'1.0.0','source':'ČNB ARAD production set1191','sources':sources,'definitions':'Levels and financial transactions in CZK million; official annual growth in percent. Credit counterparts include securities and are not government debt. Growth is not recalculated from rounded stocks.','series':native}
 (ROOT/'data/money-reports/cze-arad-native.v1.json').write_text(json.dumps(artifact,ensure_ascii=False,separators=(',',':'))+'\n')
 return result,artifact
if __name__=='__main__':
 data,artifact=acquire();path=ROOT/'data/money-reports/cze.v1.json';payload=json.loads(path.read_text());mapping={'currency':'cash','m3':'broad','m3_yoy':'broad_yoy'}
 for key,points in data.items():payload['series'][mapping.get(key,key)]=points
 payload['generated_at']=datetime.now(timezone.utc).isoformat();payload['arad_provenance']=artifact['sources'];payload['series_metadata']={mapping.get(k,k):{'source_series_id':code,'unit':'percent' if k.endswith('_yoy') else 'CZK trillion','first_period':data[k][0][0],'last_period':data[k][-1][0]} for k,code in CODES.items()}
 payload['sources'][0]={'name':'ČNB ARAD · full monetary history','url':'https://www.cnb.cz/arad/','note_cs':'Úplné měsíční řady od roku 2002; roční růst od 2003. Stavy a transakce jsou odlišné.','note_en':'Full monthly series from 2002; annual growth from 2003. Stocks and transactions are distinct.'}
 payload['sources'].append({'name':'ČNB ARAD · native series, units and provenance','url':'/data/money-reports/cze-arad-native.v1.json','note_cs':'Všechny načtené složky a protipoložky: stavy, transakce a oficiální růst.','note_en':'All loaded components and counterparts: stocks, transactions and official growth.'}) if not any(s['url']=='/data/money-reports/cze-arad-native.v1.json' for s in payload['sources']) else None
 path.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n');print(f'{len(artifact["series"])} native series; '+str({k:(len(v),v[0][0],v[-1][0]) for k,v in data.items()}))
