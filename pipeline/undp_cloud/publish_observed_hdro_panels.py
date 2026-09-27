"""Observed portions of HDR figures from verified official HDRO aggregate rows.

No country recombination, forecasting, regression or inferred HDI grouping.
"""
from collections import defaultdict
from decimal import Decimal
from chart_core import numeric

GROUPS={'ZZE.AS':('Arab States','Arabské státy','arab_states'),'ZZF.EAP':('East Asia and the Pacific','Východní Asie a Tichomoří','east_asia_pacific'),'ZZG.ECA':('Europe and Central Asia','Evropa a Střední Asie','europe_central_asia'),'ZZH.LAC':('Latin America and the Caribbean','Latinská Amerika a Karibik','latin_america_caribbean'),'ZZI.SA':('South Asia','Jižní Asie','south_asia'),'ZZJ.SSA':('Sub-Saharan Africa','Subsaharská Afrika','sub_saharan_africa'),'ZZK.WORLD':('World','Svět','world'),'ZZA.VHHD':('Very high human development','Velmi vysoký lidský rozvoj','very_high'),'ZZD.LHD':('Low human development','Nízký lidský rozvoj','low')}

def bi(en,cs):return dict(en=en,cs=cs)

def observed_panels(records):
    sources=defaultdict(dict)
    for item in records:
        r=dict(item);code=r['country_code']
        if r.get('metric')!='hdi' or r.get('geography_kind')!='aggregate' or code not in GROUPS:continue
        if r['country_name']!=GROUPS[code][0] or r['unit']!='index':raise ValueError('Official HDRO aggregate binding changed')
        key=(r['release_id'],r['source_id'],r['source_vintage'],r['source_url'],r['source_sha256'])
        obs=(code,int(r['year']))
        if obs in sources[key]:raise ValueError('Duplicate HDRO aggregate source-year')
        sources[key][obs]=r
    charts=[]
    for key,data in sources.items():
        release,sid,vintage,url,sha=key
        source=[dict(url=url,vintage=vintage,table='Official HDRO aggregate HDI time series',release_id=release,source_id=sid,sha256=sha)]
        def panel(cid,title,unit,rows,fields,method,original,kind="line"):
            if not rows:return
            charts.append(dict(id=cid,chapter='overview',title=title,unit=unit,chart_type=kind,rows=rows,fields=fields,source_refs=source,method=method,denominator=bi('Publisher-defined HDRO aggregates from one source edition; no national rows recombined and no overlapping aggregates summed.','Agregáty definované HDRO v jednom vydání; žádné přepočítávání národních řad ani sčítání překrývajících se agregátů.'),original_refs=original,status='ready',latest_period=max(r['year'] for r in rows),original_reproduction_status='observed_series_only; forecast/trend components not reproduced'))
        world={year:numeric(r['value']) for (code,year),r in data.items() if code=='ZZK.WORLD' and numeric(r['value']) is not None}
        panel('observed-world-hdi-full',bi('Global HDI — full available source history','Globální HDI — celá dostupná historie zdroje'),'HDI index',[dict(country='WLD',year=y,value=float(v)) for y,v in sorted(world.items())],[dict(key='value',label=bi('Official global HDI','Oficiální globální HDI'))],bi('Every available observed World HDI from this pinned HDRO edition, including years outside the original figure window. No countries recombined, inferred projections or interpolation.','Každé dostupné pozorování globálního HDI z připnutého vydání HDRO, včetně let mimo okno původního grafu. Bez přepočítávání zemí, prognóz nebo interpolace.'),['Statistical annex Table 2; extended observed context for O.2'])
        panel('observed-world-hdi',bi('Global HDI — observed series','Globální HDI — pozorovaná řada'),'HDI index',[dict(country='WLD',year=y,value=float(v)) for y,v in sorted(world.items()) if y>=2000],[dict(key='value',label=bi('Official global HDI','Oficiální globální HDI'))],bi('Observed official World aggregate, matching the historical period from 2000. Original O.2 forecasts for 2024 and extrapolated trends are absent; no inferred projections or exact full-figure recreation.','Oficiální pozorovaný agregát Svět od roku 2000. Prognóza 2024 a extrapolované trendy původního O.2 chybí; bez odhadovaných projekcí a tvrzení o úplné reprodukci grafu.'),['O.2 (observed portion; PDF18/p4)'])
        changes=[dict(country='WLD',year=y,value=float(v-world[y-1]),current_hdi=str(v),previous_hdi=str(world[y-1])) for y,v in sorted(world.items()) if y-1 in world and y not in {2020,2021,2022}]
        panel('observed-world-hdi-change',bi('Global HDI change — observed years','Změna globálního HDI — pozorované roky'),'HDI index points',changes,[dict(key='value',label=bi('Calculated annual change','Vypočtená roční změna'))],bi('Calculation: source World HDI in year t minus year t-1, at the source-reported precision. Comparison excludes 2020–2022 as O.2 does. The 2024 forecast and original 1990–2024 mean/4.5-times comparison are not reproduced.','Výpočet: globální HDI v roce t minus rok t-1 v přesnosti zdroje. Srovnání vynechává 2020–2022 stejně jako O.2. Prognóza 2024 a původní průměr 1990–2024 či srovnání 4,5násobku se nereprodukují.'),['O.2 (observed annual-change portion; PDF18/p4)'],kind='column')
        regions=[c for c in GROUPS if c.startswith(('ZZE.','ZZF.','ZZG.','ZZH.','ZZI.','ZZJ.'))]
        years=sorted({year for code,year in data if code in regions and year>=1999})
        rows=[]
        for y in years:
            row=dict(country='WLD',year=y)
            for c in regions:
                v=numeric(data.get((c,y),{}).get('value'))
                row[GROUPS[c][2]]=float(v) if v is not None else None
            if any(row[GROUPS[c][2]] is not None for c in regions):rows.append(row)
        panel('observed-regional-hdi',bi('Regional HDI — six observed official series','Regionální HDI — šest oficiálních pozorovaných řad'),'HDI index',rows,[dict(key=GROUPS[c][2],label=bi(*GROUPS[c][:2])) for c in regions],bi('Six original region literals are verified against the pinned HDRO aggregate registry. Source observations 1999–2023; no regression or original pre-2020 trend line assumed. This reproduces observed-source portions, not the complete O.3 figure.','Šest původních regionů je ověřeno v registru agregátů HDRO. Pozorování zdroje 1999–2023; bez domýšlení regrese či původní trendové čáry před 2020. Jde o pozorovanou část zdroje, ne úplný graf O.3.'),['O.3 (observed region portions; PDF19/p5)'])
        gaps=[]
        for y in sorted({year for code,year in data if year>=1992}):
            high=numeric(data.get(('ZZA.VHHD',y),{}).get('value'));low=numeric(data.get(('ZZD.LHD',y),{}).get('value'))
            if high is not None and low is not None:gaps.append(dict(country='WLD',year=y,value=float(high-low),very_high_hdi=str(high),low_hdi=str(low)))
        panel('observed-hdi-group-gap',bi('HDI gap — very high minus low, observed','Rozdíl HDI — velmi vysoká minus nízká skupina, pozorovaný'),'HDI index points',gaps,[dict(key='value',label=bi('Calculated group gap','Vypočtený rozdíl skupin'))],bi('Calculation: official very-high HDI aggregate minus official low HDI aggregate in the same edition/year, at source precision. Inputs retained beside derived values. The 2024 projection is unavailable; no full original-figure recreation claimed.','Výpočet: oficiální agregát velmi vysokého HDI minus agregát nízkého HDI ve stejném vydání a roce, v přesnosti zdroje. Vstupy jsou zachovány. Projekce 2024 chybí; úplná reprodukce původního grafu se netvrdí.'),['O.2 (observed gap portion; PDF18/p4)','1.2 (observed portion; PDF33/p19)'])
    return charts
