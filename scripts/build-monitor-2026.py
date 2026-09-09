#!/usr/bin/env python3
"""C063 adapter. Technical column names, explicit native partners, partial-year facts."""
import csv,gzip,hashlib,io,json,re
from pathlib import Path
from decimal import Decimal
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT.parent/'data/source_cache/monitor2026'
CATALOG='https://monitor.statnipokladna.gov.cz/api/opendata/monitor'

def technical_columns(header):
    keys=[c.rsplit(':',1)[-1].strip() for c in header]
    if len(set(keys))!=len(keys):raise ValueError('Duplicate technical columns')
    return keys

def partner_type(v):
    if not v:return None
    if v=='111':return 'domestic_nonbusiness_person_aggregate'
    if re.fullmatch(r'\d{8}',v):return 'ico'
    return 'source_native_other'

def amount(v):
    if not v.strip():return None
    v=v.strip().replace(',','.')
    if v.endswith('-'):v='-'+v[:-1]
    return Decimal(v)

def convert(keys,row,period):
    if len(keys)!=len(row):raise ValueError('C063 field count changed')
    r=dict(zip(keys,(v.strip() for v in row)))
    if r['ZC_VYKAZ']!='063' or r['0FISCPER']!=period:raise ValueError('Wrong C063 report/period')
    required=['ZC_ICO','ZCMMT_ITM','0FUNC_AREA','ZC_PARTNF','ZU_ROZSCH','ZU_ROZPZM','ZU_ROZKZ']
    if not all(k in r for k in required):raise ValueError('C063 schema mismatch')
    measures={k:amount(r[k]) for k in ['ZU_ROZSCH','ZU_ROZPZM','ZU_ROZKZ']}
    if any(v is None for v in measures.values()):raise ValueError('Missing mandatory C063 amount')
    return {'ico':r['ZC_ICO'],'period':period,'report':'063','item':r['ZCMMT_ITM'],'paragraph':r['0FUNC_AREA'],'partner_id':r['ZC_PARTNF'] or None,'partner_identifier_type':partner_type(r['ZC_PARTNF']),'approved_czk':float(measures['ZU_ROZSCH']),'adjusted_czk':float(measures['ZU_ROZPZM']),'actual_ytd_czk':float(measures['ZU_ROZKZ']),'source_dimensions':{k:v for k,v in r.items() if k not in measures}},measures

def shard_facts(directory, expected_rows, chunk_rows=500000):
    source=directory/'unit-facts.ndjson.gz';shards=[];logical=hashlib.sha256();count=0;stream=None;target=None;raw=None
    try:
        with gzip.open(source,'rb') as src:
            for line in src:
                if count % chunk_rows == 0:
                    if stream:
                        stream.close();raw.close();tmp.replace(target)
                        shards[-1]['sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
                    target=directory/f'unit-facts-{len(shards):03d}.ndjson.gz';tmp=target.with_suffix('.tmp');raw=tmp.open('wb');stream=gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0)
                    shards.append({'path':'monitor-2026/'+target.name,'rows':0})
                stream.write(line);logical.update(line);count+=1;shards[-1]['rows']+=1
            if stream:
                stream.close();raw.close();stream=None;raw=None;tmp.replace(target);shards[-1]['sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
    finally:
        if stream:stream.close()
        if raw:raw.close()
    if count!=expected_rows:raise ValueError('C063 shard row count differs from source conversion')
    for shard in shards:
        if (directory/Path(shard['path']).name).stat().st_size>=20_000_000:raise ValueError('C063 shard exceeds asset-size budget')
    return {'rows':count,'logical_ndjson_sha256':logical.hexdigest(),'shards':shards}

def main():
    import zipfile
    catalog=json.loads((CACHE/'catalog.json').read_text());metadata=json.loads((CACHE/'fin2026-metadata.json').read_text())
    url=next(d['soubor_ke_stažení'] for d in metadata['distribuce'] if d.get('soubor_ke_stažení','').endswith('.zip'))
    period=metadata['časové_pokrytí']['konec'];fiscal=period[:4]+'0'+period[5:7]
    archive=CACHE/(period[:7].replace('-','_')+'_FINM2026.zip');out=ROOT/'data/monitor-2026';out.mkdir(exist_ok=True)
    counts={'rows':0,'partner_rows':0};units={};kinds={};members=[]
    with zipfile.ZipFile(archive) as z:
        matches=[n for n in z.namelist() if re.fullmatch(r'FINM01_UJ_\d{7}\.csv',n)]
        if len(matches)!=1:raise ValueError('Expected one unit-level C063 Part I')
        for n in z.namelist():members.append({'name':n,'bytes':z.getinfo(n).file_size})
        with z.open(matches[0]) as f,gzip.open(out/'unit-facts.ndjson.gz','wt',encoding='utf-8') as facts,gzip.open(out/'partner-facts.ndjson.gz','wt',encoding='utf-8') as edges:
            reader=csv.reader(io.TextIOWrapper(f,encoding='utf-8-sig'),delimiter=';');keys=technical_columns(next(reader))
            for row in reader:
                if row[0]=='ZZZ' and row[2]=='0000000':continue # publisher sentinel, not a budget observation
                r,m=convert(keys,row,fiscal);facts.write(json.dumps(r,ensure_ascii=False,separators=(',',':'))+'\n');counts['rows']+=1
                if r['partner_id']:
                    edges.write(json.dumps(r,ensure_ascii=False,separators=(',',':'))+'\n');counts['partner_rows']+=1;k=r['partner_identifier_type'];kinds[k]=kinds.get(k,0)+1
                totals=units.setdefault(r['ico'],{'row_count':0,'partner_row_count':0});totals['row_count']+=1;totals['partner_row_count']+=bool(r['partner_id'])
    payload={'schema_version':'1.0.0','report':'C063','period_end':period,'period_kind':'year_to_date','unit':'CZK','coverage':counts,'entity_count':len(units),'partner_identifier_counts':kinds,'source':{'url':url,'catalog_url':CATALOG,'metadata_url':metadata['iri'],'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},'files':{'facts':'monitor-2026/unit-facts.ndjson.gz','partners':'monitor-2026/partner-facts.ndjson.gz'},'members':members,'entities':units,'definitions':{'partner_facts':'Source-native partner-bearing budget lines: transfers, repayments and lending, not universal purchases or invoices','consolidation':'Unit facts retain original source dimensions; do not sum units as consolidated national total','period':'Cumulative actual through period end, not full-year 2026','identifiers':'111 is aggregate domestic nonbusiness persons; other non-IČO identifiers remain unchanged','missingness':'Missing mandatory financial amounts fail ingestion; blank partner is absence of reported identifier'},'discovery':{'available_2026_datasets':[u for u in catalog['datová_sada'] if '/2026_' in u]}}
    payload['fact_shards']=shard_facts(out,counts['rows']);payload['files']['facts']=[x['path'] for x in payload['fact_shards']['shards']]
    (ROOT/'data/czech-monitor-2026.v1.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n');print(json.dumps(counts));(out/'unit-facts.ndjson.gz').unlink()
if __name__=='__main__':main()
