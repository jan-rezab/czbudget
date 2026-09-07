#!/usr/bin/env python3
"""Immutable Eurostat all-geography industrial production snapshot.

sts_inpr_m: all available monthly observations from 2010 through the current year.
sts_inpr_a: published annual observations for completed reference years from 2010.
No geography, industry, adjustment or unit filters are applied. The geography
catalogue comes from returned full-dataset dimensions, not a selected aggregate.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import math
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

BASE='https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
# ISO 3166-1 crosswalk, applied only AFTER discovery in the Eurostat response.
ISO3=dict(BE='BEL',BG='BGR',CZ='CZE',DK='DNK',DE='DEU',EE='EST',IE='IRL',EL='GRC',ES='ESP',FR='FRA',HR='HRV',IT='ITA',CY='CYP',LV='LVA',LT='LTU',LU='LUX',HU='HUN',MT='MLT',NL='NLD',AT='AUT',PL='POL',PT='PRT',RO='ROU',SI='SVN',SK='SVK',FI='FIN',SE='SWE',NO='NOR',CH='CHE',UK='GBR',BA='BIH',ME='MNE',MK='MKD',AL='ALB',RS='SRB',TR='TUR',UA='UKR')
DEFINITIONS={
 'M': {'I21':'Published monthly production index; 2021 average=100','I15':'Published monthly production index; 2015 average=100','I10':'Published monthly production index; 2010 average=100','PCH_PRE':'Month-on-month percentage change; source values, no local calculation','PCH_SM':'Percentage change compared with same month one year earlier; source values'},
 'A': {'I21':'Published annual production index; 2021=100','I15':'Published annual production index; 2015=100','I10':'Published annual production index; 2010=100','PCH_PRE':'If present, annual percentage change against previous annual period (year-on-year)','PCH_SM':'Published annual percentage change compared with previous year; not a December-to-December rate'},
 'annual_note':'Annual values are fetched from sts_inpr_a, never calculated from an incomplete year of monthly data. 2026 annual values are not requested. Unit and adjustment dimensions remain distinct.',
 'missing_note':'Absent/null source values yield no observation, never a zero. Listed geographies without observations retain explicit coverage status.',
}

def classify(geo,label):
    if geo in ISO3:return ISO3[geo],'country'
    if geo.startswith(('EU','EA')):return geo,'aggregate'
    raise ValueError(f'Unrecognized geography needs reviewed ISO crosswalk: {geo} ({label})')

def decode(data,dataset,meta):
    ids,sizes=data['id'],data['size'];categories={}
    for dimension in ids:
        index=data['dimension'][dimension]['category']['index']
        categories[dimension]={v:k for k,v in index.items()} if isinstance(index,dict) else dict(enumerate(index))
    values=data.get('value',{});statuses=data.get('status',{})
    for position,value in (enumerate(values) if isinstance(values,list) else values.items()):
        if value is None:continue
        assert isinstance(value,(int,float)) and math.isfinite(value)
        offset,key=int(position),{}
        for dimension,size in reversed(list(zip(ids,sizes))):
            offset,index=divmod(offset,size);key[dimension]=categories[dimension][index]
        assert offset==0 and key['indic_bt']=='PRD'
        freq=key['freq'];period=key['time'];unit=key['unit']
        assert (freq=='M' and 2010 <= int(period[:4]) <= dt.date.today().year) or (freq=='A' and period in [str(y) for y in range(2010,dt.date.today().year)])
        measure={'PCH_PRE':'mom_pct' if freq=='M' else 'yoy_pct','PCH_SM':'yoy_pct'}.get(unit,'index' if unit in ['I21','I15','I10'] else None)
        assert measure,f'Unrecognized unit {unit}'
        geo=key['geo'];name=data['dimension']['geo']['category']['label'][geo];country,kind=classify(geo,name)
        flag=statuses[int(position)] if isinstance(statuses,list) and int(position)<len(statuses) else statuses.get(str(position)) if isinstance(statuses,dict) else None
        flags=(flag or '').split();status='provisional' if 'p' in flags else 'revised' if 'r' in flags else 'unknown'
        row=dict(country=country,country_name=name,geo_code=geo,geography_type=kind,publisher='Eurostat',disseminator='Eurostat',source_channel='eurostat',dataset=dataset,
            series_id=dataset+':'+'.'.join(key[k] for k in ids if k!='time'),industry_code=key['nace_r2'],industry_label=data['dimension']['nace_r2']['category']['label'][key['nace_r2']],
            frequency=freq,period=period,measure=measure,adjustment=key['s_adj'],unit='percent' if measure!='index' else 'index',base_period={'I21':'2021','I15':'2015','I10':'2010'}.get(unit),value=value,
            raw_value=value,transformation='none',status=status,source_status=flag,classification='NACE Rev.2',source_dimensions=key,source_unit_label=data['dimension']['unit']['category']['label'][unit],
            source_dataset_updated_at=data.get('updated'),publication_at=None,vintage_at=None,method_version='industrial-federation/1.1.0',**{k:meta[k] for k in ['source_url','retrieved_at','raw_file']})
        row['observation_id']=hashlib.sha256(json.dumps([row['series_id'],period,meta['sha256']],separators=(',',':')).encode()).hexdigest()
        yield row

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);args=p.parse_args();out=args.output.resolve()
    if out.exists() and any(out.iterdir()):p.error('Use a new or empty output directory; snapshots are immutable')
    (out/'raw').mkdir(parents=True,exist_ok=True)
    manifest=[];coverage={'definitions':DEFINITIONS,'datasets':{},'errors':[]};seen=set();total=0
    def fetch(dataset,params,name):
        url=BASE+dataset+'?'+urllib.parse.urlencode(dict(lang='EN',**params))
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url,timeout=60) as response:raw=response.read()
                break
            except urllib.error.HTTPError as exc:
                if attempt==2 or exc.code not in [413,429,500,502,503,504]:raise
                time.sleep(5*(attempt+1))
            except (urllib.error.URLError,TimeoutError):
                if attempt==2:raise
                time.sleep(1+attempt)
        path=out/'raw'/name;path.write_bytes(raw);meta=dict(dataset=dataset,source_url=url,retrieved_at=dt.datetime.now(dt.timezone.utc).isoformat(),raw_file=str(path),sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),method='GET');manifest.append(meta)
        data=json.loads(raw)
        if data.get('error'):raise ValueError(data['error'])
        return data,meta
    tasks=[('sts_inpr_m',dict(freq='M',time=f'{y}-{m:02}'),f'{y}-{m:02}') for y in range(2010,dt.date.today().year+1) for m in range(1,13) if (y,m)<=(dt.date.today().year,dt.date.today().month)]+[('sts_inpr_a',dict(freq='A',time=str(y)),str(y)) for y in range(2010,dt.date.today().year)]
    with (out/'observations.jsonl').open('w') as stream:
        for dataset,params,year in tasks:
            dc=coverage['datasets'].setdefault(dataset,dict(geographies={},requests=[],observations=0))
            try:
                data,meta=fetch(dataset,params,f'{dataset}-{year}.json');geo_cat=data['dimension']['geo']['category']
                dc['requests'].append(dict(period=year,status='downloaded',source_url=meta['source_url'],source_dataset_updated_at=data.get('updated')))
                for geo,label in geo_cat['label'].items():
                    country,kind=classify(geo,label)
                    dc['geographies'].setdefault(geo,dict(country=country,country_name=label,geo_code=geo,geography_type=kind,status='no_observations_in_requested_period',observations=0,periods=set(),series=set(),industries=set(),units=set(),adjustments=set(),source_status_flags=set()))
                count=0
                for row in decode(data,dataset,meta):
                    key=(row['series_id'],row['period']);assert key not in seen,f'Duplicate key {key}';seen.add(key)
                    stream.write(json.dumps(row,ensure_ascii=False)+'\n');count+=1;total+=1
                    gc=dc['geographies'][row['geo_code']];gc['status']='downloaded';gc['observations']+=1;gc['periods'].add(row['period']);gc['series'].add(row['series_id']);gc['industries'].add(row['industry_code']);gc['units'].add(row['source_dimensions']['unit']);gc['adjustments'].add(row['adjustment'])
                    if row['source_status']:gc['source_status_flags'].add(row['source_status'])
                dc['observations']+=count;print(dataset,year,count,flush=True)
            except Exception as exc:
                error=dict(dataset=dataset,period=year,error=str(exc));coverage['errors'].append(error);dc['requests'].append(dict(period=year,status='request_error',error=str(exc)));print(error,flush=True)
    for dc in coverage['datasets'].values():
        for gc in dc['geographies'].values():
            gc['series_count']=len(gc.pop('series'));gc['industry_count']=len(gc['industries'])
            for key,value in gc.items():
                if isinstance(value,set):gc[key]=sorted(value)
        dc['geographies_listed']=len(dc['geographies']);dc['countries_with_observations']=sum(g['geography_type']=='country' and g['observations']>0 for g in dc['geographies'].values());dc['aggregates_with_observations']=sum(g['geography_type']=='aggregate' and g['observations']>0 for g in dc['geographies'].values())
    coverage['total_observations']=total
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(out/'coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2)+'\n')
    with (out/'observations.jsonl').open('rb') as src,(out/'observations.jsonl.gz').open('wb') as dst:
        with gzip.GzipFile(fileobj=dst,mode='wb',mtime=0) as gz:
            for chunk in iter(lambda:src.read(1024*1024),b''):gz.write(chunk)
    print('TOTAL',total,flush=True)
    if coverage['errors']:raise SystemExit('Snapshot saved with explicit errors; inspect coverage.json')

if __name__=='__main__':main()
