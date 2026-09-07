"""Build the animation's cited-source inventory from published repository artifacts."""
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from collections import defaultdict
import json, hashlib, re
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'studio/data-in-one-place'
refs={}; inputs={}
def read(path):
    raw=(ROOT/path).read_bytes(); inputs[path]=hashlib.sha256(raw).hexdigest(); return json.loads(raw)
def add(url,title,artifact,country='',topic='',period=''):
    if not isinstance(url,str) or not url.startswith(('http://','https://')):return
    u=urlparse(url)
    if u.hostname in ['publicspendingdata.org','localhost']:return
    url=urlunparse(u._replace(fragment=''))
    title=str(title or u.hostname)
    r=refs.setdefault(url,{'url':url,'title':title,'host':u.hostname.removeprefix('www.'),'artifacts':set(),'countries':set(),'topics':set(),'periods':set()})
    if r['title']==r['host'] and title:r['title']=title
    r['artifacts'].add(artifact)
    if country:r['countries'].add(country)
    if topic:r['topics'].add(topic)
    if period:r['periods'].add(str(period))
ledger=read('data/methodology-sources.v1.json')
for r in ledger['rows']:
    if r['source_availability']!='loaded' or not r.get('artifact'):continue
    for s in r['sources']:add(s.get('url'),s.get('title'),r['artifact'],r['country_code'],r['module'],r.get('period',''))
provenance=read('data/registry/source-provenance.v1.json')
for r in provenance['sources']:
    if not r['artifact_count']:continue
    for artifact in r['artifacts']:add(r.get('url'),r.get('title') or r.get('provider'),artifact,r.get('country',''))
# Source metadata in published report artifacts supplements the older methodology ledger.
# Research-only acquisition catalogs and raw caches are intentionally not inputs.
reports=['country-demography','country-health-performance','country-revenue','country-functional-budgets','country-health','country-provider-networks','education-deep-dive','education-institutions','education-capacity-international','europe-demographic-pressure','eu-migration','eu-budget-flows','defense-deep-dive','digital-spillover','cz-public-employment','cz-public-entities-2024','cz-health-budget','cz-spending-2026','czech-budget','care-envelope','transport-performance','transport-budget-detail','road-network-history','oecd-key-metrics','state-owned-enterprises','public-entity-aggregates','country-cash-in','global-budget-transparency']
def walk(x,artifact,country='',context='',period=''):
    if isinstance(x,dict):
        c=x.get('country_code') or x.get('code') or country
        if not isinstance(c,str) or not re.fullmatch('[A-Z]{3}',c):c=country
        p=x.get('period') or x.get('year') or period
        if not isinstance(p,(str,int)):p=period
        title=x.get('title') or x.get('label_en') or x.get('label') or x.get('source_title') or x.get('source_name') or x.get('dataset') or x.get('publisher') or x.get('item')
        for k,v in x.items():
            if k in ['source_url','sourceUrl'] or (context and k in ['url','homepage','download_page']):
                add(v,title,artifact,c,context,p)
            if isinstance(v,(dict,list)):
                childcontext=k if 'source' in k or k=='provenance' else context
                childcountry=k if re.fullmatch('[A-Z]{3}',k) else c
                walk(v,artifact,childcountry,childcontext,p)
    elif isinstance(x,list):
        for v in x:walk(v,artifact,country,context,period)
for stem in reports:
    path='data/'+stem+('.json' if stem=='cz-public-entities-2024' else '.v1.json')
    walk(read(path),path,'CZE' if stem.startswith(('cz-','czech-')) or stem in ['education-deep-dive','care-envelope'] else '')
for path in ['data/trade/annual-hs2-2024.v1.json','data/trade/product-intelligence.v1.json']:
    walk(read(path),path)
# Names are editorial labels; membership and counts come from the actual cited URLs.
labels={
'monitor.statnipokladna.gov.cz':('MONITOR · Czech Treasury','municipal'),
'mf.gov.cz':('Czech Ministry of Finance','state'),'mfcr.cz':('Czech Ministry of Finance','state'),
'apl.czso.cz':('Czech Statistical Office','statistics'),'csu.gov.cz':('Czech Statistical Office','statistics'),'data.csu.gov.cz':('Czech Statistical Office','statistics'),
'ares.gov.cz':('ARES · public entity register','registers'),'or.justice.cz':('Ministry of Justice · registers','registers'),
'mpsv.gov.cz':('Ministry of Labour & Social Affairs','state'),'cssz.cz':('Czech Social Security Administration','services'),
'msmt.gov.cz':('Ministry of Education','state'),'md.gov.cz':('Ministry of Transport','state'),'mv.gov.cz':('Ministry of the Interior','state'),
'uzis.cz':('ÚZIS · health information','services'),'nrpzs.uzis.cz':('ÚZIS · health information','services'),'datanzis.uzis.gov.cz':('ÚZIS · health information','services'),
'nato.int':('NATO','international'),'comtrade.un.org':('UN Comtrade','international'),'population.un.org':('UN Population Division','international'),'unhcr.org':('UNHCR','international'),
'data.imf.org':('IMF · World Economic Outlook','international'),'imf.org':('IMF · World Economic Outlook','international'),
'data-explorer.oecd.org':('OECD','international'),'oecd.org':('OECD','international'),'sdmx.oecd.org':('OECD','international'),
'api.worldbank.org':('World Bank','international'),'data.worldbank.org':('World Bank','international'),'worldbank.org':('World Bank','international'),
'ec.europa.eu':('Eurostat / European Commission','international'),'gisco-services.ec.europa.eu':('Eurostat GISCO','international'),'transport.ec.europa.eu':('European Commission · transport','international'),
'data-api.ecb.europa.eu':('European Central Bank','international'),
'data.economie.gouv.fr':('France · DGFiP accounts','municipal'),'data.ofgl.fr':('France · OFGL','municipal'),
'apidatalake.tesouro.gov.br':('Brazil · National Treasury','municipal'),
'statbank.dk':('Denmark · Statistics Denmark','statistics'),'api.statbank.dk':('Denmark · Statistics Denmark','statistics'),
'bdl.stat.gov.pl':('Poland · Statistics Poland','statistics'),
'e-stat.go.jp':('Japan · e-Stat','statistics'),'stat.fi':('Finland · Statistics Finland','statistics'),'pxdata.stat.fi':('Finland · Statistics Finland','statistics'),
'ssb.no':('Norway · Statistics Norway','statistics'),'cbs.nl':('Netherlands · Statistics Netherlands','statistics'),'scb.se':('Sweden · Statistics Sweden','statistics'),'statistikdatabasen.scb.se':('Sweden · Statistics Sweden','statistics'),
'destatis.de':('Germany · Destatis','statistics'),'genesis.destatis.de':('Germany · Destatis','statistics'),'census.gov':('US Census Bureau','statistics'),
'ons.gov.uk':('UK · Office for National Statistics','statistics'),
'whitehouse.gov':('US · Office of Management and Budget','state'),'fiscal.treasury.gov':('US Treasury','state'),
'bundeshaushalt.de':('Germany · Federal budget','state'),'budget.gouv.fr':('France · Directorate of the Budget','state'),
'openbudget.gov.ua':('Ukraine · Open Budget','state'),'siope.it':('Italy · SIOPE','municipal'),
'serviciostelematicosext.hacienda.gob.es':('Spain · Ministry of Finance','municipal'),
'sng-wofi.org':('OECD / UCLG · WOFI','international'),'internationalbudget.org':('International Budget Partnership','international'),
}
groups={}
for i,r in enumerate(sorted(refs.values(),key=lambda r:r['url'])):
    h=r['host'];text=(r['title']+' '+' '.join(r['artifacts'])).lower()
    default='municipal' if any(t in text for t in ['municipal','commune','conprel']) else 'services' if any(t in text for t in ['health','education','hospital','transport']) else 'registers' if any(t in text for t in ['annual report','annual-report','public-entity','state-owned','portfolio','register','holdings']) else 'state'
    label,family=labels.get(h,(h,default))
    origin='czech' if h.endswith('.cz') else 'international' if family=='international' else 'national'
    r.update({'id':i,'provider':label,'family':family,'origin':origin})
    for key in ['artifacts','countries','topics','periods']:r[key]=sorted(r[key])
    group=groups.setdefault(label,{'name':label,'family':family,'origin':origin,'references':[],'url':r['url']})
    group['references'].append(i)
municipal=read('data/municipal-snapshot.v1.json')
chapters=read('data/cz-spending-2026.v1.json')
coverage=read('data/coverage-metrics.v1.json')
directory=read('data/municipal-directory-counts.v1.json')
sovereign=read('lib/data/sovereign-benchmark.v1.json')
municipalities=[{'id':m['national_id'],'name':m['short_name'],'alias':{'Praha':'Prague','Plzeň':'Pilsen'}.get(m['short_name'],''),'region':m['territory']['region_name'],'amount':m['amounts']['expense_actual'],'url':m['sources']['budget']} for m in municipal['municipalities']]
municipalities.sort(key=lambda m:-m['amount'])
chapter_rows=[{'id':r['code'],'name':r['label_en'],'name_cs':r['label_cs'],'amount':r['amount_2026_czk'],'ministry':r['label_cs'].startswith('Ministerstvo'),'url':chapters['sources'][0]['url']} for r in chapters['chapters']]
data={'generated':'2026-09-07','references':sorted(refs.values(),key=lambda r:r['id']),'providers':sorted(groups.values(),key=lambda r:(r['origin']!='czech',-len(r['references']),r['name'])),'municipalities':municipalities,'chapters':chapter_rows,'coverage':coverage,'directory':directory,'countryCodes':{c['iso2'].lower():c['country_code'] for c in sovereign['countries'] if c.get('iso2')},'inputs':inputs,'methodology':'Unique external source URLs cited by loaded methodology rows, the provenance registry and the listed published reports. URLs are deduplicated without fragments. Publishers are grouped by their named source, with publishing hostnames used where no editorial label is assigned. Citation counts are not row volumes, and entity counts are not source counts.'}
(OUT/'network-data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
(OUT/'network-data.js').write_text('window.PSD_SOURCE_NETWORK='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
assert len(municipalities)==6254
assert len(chapter_rows)==47
assert any(p['name']=='UN Comtrade' for p in data['providers'])
assert any(p['name']=='UN Population Division' for p in data['providers'])
print(json.dumps({'source_references':len(refs),'provider_groups':len(groups),'czech_source_references':sum(r['origin']=='czech' for r in refs.values()),'municipalities':len(municipalities),'ministries':sum(r['ministry'] for r in chapter_rows),'chapters':len(chapter_rows),'families':{f:sum(r['family']==f for r in refs.values()) for f in ['municipal','state','statistics','international','services','registers']}},indent=2))
