"""Count native WIPO landscape families; never treat them as granted patents."""
from collections import Counter
import json
import math

BINDINGS={
 'wipo_assistive_conventional2021':dict(sha256='8f7fb6b276e977321f26c7828f7d8dda988819a514f293fede3ac64511a991c2',expected_families=117209,export_header='DWPI Family Members - Export Date Jul 20, 2020',cutoff='2020-07-20',kind='conventional'),
 'wipo_assistive_emerging2021':dict(sha256='5e7be8fd4a05947dc9929222abe929e9bd18c93f502597c8348e4b441ce854ef',expected_families=15592,export_header='DWPI Family Members - Export Date Aug 17, 2020',cutoff='2020-08-17',kind='emerging')}

def derive_family_history(raw_rows,sid,meta,binding):
    counts=Counter();seen=set();header_seen=False;native_types=Counter()
    for raw in raw_rows:
        for key,value in [('source_id',sid),('release_id',meta['release_id']),('source_sha256',meta['sha256']),('source_url',meta['url'])]:
            if raw.get(key)!=value:raise ValueError('Pinned WIPO source identity changed: '+key)
        payload=json.loads(raw['record_json'])
        if payload.get('representation')!='cached_values' or payload.get('sheet')!='Overall Metadata':continue
        values=payload.get('values',[])
        if len(values)<8:raise ValueError('WIPO native row missing fields')
        if values[0]=='S.No':
            if header_seen:raise ValueError('Duplicate native family header')
            if (str(values[1]).strip(),str(values[3]).strip(),values[5],values[7])!=('DWPI Accession Number','Earliest Priority Year (Year of first Filing)',binding['export_header'],'Utility Model/Patent (how it was treated in the analysis)'):raise ValueError('Reviewed WIPO family/year/unit schema changed')
            header_seen=True;continue
        if not header_seen:raise ValueError('Family row precedes reviewed header')
        family=values[1];year=values[3];treatment=values[7]
        if isinstance(family,bool) or family is None or not isinstance(family,(str,int,float)) or not str(family).strip():raise ValueError('Missing native family identifier')
        if isinstance(family,float) and (not math.isfinite(family) or not family.is_integer()):raise ValueError('Nonintegral native numeric family identifier')
        family=str(int(family)) if isinstance(family,float) else str(family).strip()
        if family in seen:raise ValueError('Duplicate DWPI family identifier; do not double count')
        if isinstance(year,bool) or not isinstance(year,(int,float)) or not math.isfinite(year) or int(year)!=year or not 1998<=year<=2020:raise ValueError('Native priority year changed or missing')
        if not isinstance(treatment,str) or not treatment.strip():raise ValueError('Missing native patent/utility model treatment')
        seen.add(family);counts[int(year)]+=1;native_types[treatment]+=1
    if not header_seen or len(seen)!=binding['expected_families']:raise ValueError('Complete native family coverage failed')
    if min(counts)!=1998 or max(counts)!=2020:raise ValueError('Verified native historical range changed')
    return dict(rows=[dict(country='WLD',period=str(year),year=year,label=str(year),value=counts[year],calculation='count_distinct_native_DWPI_accession',partial_year=year==2020) for year in sorted(counts)],native_family_count=len(seen),native_treatment_counts=dict(native_types),latest_period='2020',source_export_cutoff=binding['cutoff'])
