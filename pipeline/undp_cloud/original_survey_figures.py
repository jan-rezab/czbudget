"""Original HDR survey calculations from SMALL warehouse aggregate cells.

No downloads, respondent exports, cloud jobs or publication occur here. Call
``grouped_query(dataset, country_to_hdi)`` with a verified report-era HDI mapping,
then execute with the pinned @release. ``derive_panels`` consumes only aggregate
cells. All-sample and valid-answer denominators are retained separately. Matching
published one-decimal figures is a gate, never assumed from available raw data.
"""
from collections import defaultdict
from decimal import Decimal, InvalidOperation
import json
import re

EDUCATION = 'Q11_Educationalplatformsorlearni'
HEALTH = 'Q11_Healthcareservicesorapplicat'
WORK = 'Q11_Work_relatedtoolsorsoftware'
USE_DOMAINS = (EDUCATION, HEALTH, WORK)
EXPECTED_DOMAINS = ('Q12_Foreducationandtraining','Q12_Formedicaladvice','Q12_Forworktasks')
PRODUCTIVITY = 'Q21_AIwillincreaseyourproductivi'
AUTOMATION = 'Q21_Yourcurrentjobwillbesignific'
AUGMENTATION = 'Q21_AIwillhelpyoufindnewjobroles'
WEIGHT = 'Weight_none_resp1'
VARIABLES = (*USE_DOMAINS,*EXPECTED_DOMAINS,PRODUCTIVITY,AUTOMATION,AUGMENTATION,'Q14','Q15')
COUNTRIES = ('Australia','Bangladesh','Brazil','China','Comoros','Egypt','Fiji','Germany','Greece','India','Indonesia','Japan','Kyrgyzstan','Nigeria','Pakistan','Republic of Korea','Russia','South Africa','Tunisia','Turkey','United States')
HDI_GROUPS = ('Low and medium','High','Very high')
AGES = ('15–24','25–34','35–44','45–59','60 and older')
METHOD_URL = 'https://hdr.undp.org/sites/default/files/2025/AIHDS/2025_AI_Survey_Methodology.pdf'
ERRATA_URL = 'https://hdr.undp.org/errata-and-corrigenda-hdr-2025'
REPORT_URL = 'https://hdr.undp.org/system/files/documents/global-report-document/hdr2025reporten.pdf'
BENCHMARKS = {
 'O.1': {'Low and medium':{'actual':Decimal('14.4'),'expected':Decimal('66.1')},'High':{'actual':Decimal('23.6'),'expected':Decimal('68.9')},'Very high':{'actual':Decimal('19.0'),'expected':Decimal('45.9')}},
 '2.1': {'Low and medium':{'current':Decimal('44.6'),'future':Decimal('45.8')},'High':{'current':Decimal('56.5'),'future':Decimal('57.5')},'Very high':{'current':Decimal('45.4'),'future':Decimal('32.1')}}
}


def grouped_query(dataset, country_to_hdi):
    """BigQuery SQL for original figure marginals, including age × HDI cells.

    Caller supplies a country-name → report-era HDI group map, verified against
    pinned official source. No country memberships are invented by this module.
    Only 11 question variables plus Q1 ages are scanned, within one release.
    The result is a few hundred grouped cells, never respondent data.
    """
    if not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_]+',dataset):
        raise ValueError('Unsafe BigQuery dataset identifier')
    if set(country_to_hdi) != set(COUNTRIES):
        raise ValueError('HDI grouping must cover exactly the 21 source countries')
    if not set(country_to_hdi.values()).issubset(HDI_GROUPS):
        raise ValueError('HDI groups must use the three explicit report labels')
    cases=' '.join('WHEN '+json.dumps(k)+' THEN '+json.dumps(v) for k,v in sorted(country_to_hdi.items()))
    variables=','.join(json.dumps(v) for v in VARIABLES)
    return f'''WITH dimensions AS (
      SELECT r.release_id,r.source_id,r.respondent_id,r.country,r.survey_weight,
        r.source_url,r.source_sha256,
        CASE r.country {cases} ELSE '__unmapped_country__' END hdi_group,
        MAX(IF(a.variable='Q1',a.value,NULL)) age
      FROM `{dataset}.survey_respondents` r
      LEFT JOIN `{dataset}.survey_answers` a
        ON r.release_id=a.release_id AND r.source_id=a.source_id
        AND r.respondent_id=a.respondent_id AND a.variable='Q1'
      WHERE r.release_id=@release AND r.source_id='ai2025_survey'
      GROUP BY r.release_id,r.source_id,r.respondent_id,r.country,r.survey_weight,
        r.source_url,r.source_sha256
    ), base AS (
      SELECT d.*,a.variable,a.source_value,a.value_label,
        COALESCE(a.missing_kind,IF(a.source_value IS NULL,'system_missing',NULL)) missing_kind,
        CASE WHEN age BETWEEN 15 AND 24 THEN '15–24'
             WHEN age BETWEEN 25 AND 34 THEN '25–34'
             WHEN age BETWEEN 35 AND 44 THEN '35–44'
             WHEN age BETWEEN 45 AND 59 THEN '45–59'
             WHEN age BETWEEN 60 AND 120 THEN '60 and older'
             ELSE '__unmapped_age__' END age_group
      FROM dimensions d JOIN `{dataset}.survey_answers` a
        USING(release_id,source_id,respondent_id)
      WHERE a.variable IN ({variables})
    ), scopes AS (
      SELECT *,s.scope,s.group_label FROM base CROSS JOIN UNNEST([
        STRUCT('hdi' AS scope,hdi_group AS group_label),
        STRUCT('age' AS scope,age_group AS group_label),
        STRUCT('hdi_age' AS scope,CONCAT(hdi_group,'|',age_group) AS group_label)
      ]) s
    ) SELECT release_id,source_id,scope,group_label,variable,source_value,
      value_label,missing_kind,source_url,source_sha256,
      COUNT(*) received_n,
      COUNTIF(survey_weight IS NOT NULL AND survey_weight>=0) usable_weight_n,
      COUNTIF(survey_weight IS NULL OR survey_weight<0) invalid_weight_n,
      SUM(IF(survey_weight IS NOT NULL AND survey_weight>=0,survey_weight,0)) weighted_n,
      ARRAY_AGG(DISTINCT country IGNORE NULLS) countries
    FROM scopes GROUP BY release_id,source_id,scope,group_label,variable,
      source_value,value_label,missing_kind,source_url,source_sha256'''


def dec(value):
    try:
        x=Decimal(str(value))
    except (InvalidOperation,ValueError):
        raise ValueError('Invalid numeric aggregate') from None
    if not x.is_finite():raise ValueError('Nonfinite aggregate')
    return x


def response_score(variable, source_value, half_neutral=False):
    """Native codes verified from the 61-variable published source codebook.

    None means unanswered/explicit nonresponse, not a negative response. Invalid
    numeric codes fail closed; arbitrary values are never recoded by labels.
    """
    if source_value is None or source_value=='':return None
    code=dec(source_value)
    if code!=code.to_integral_value():raise ValueError('Nonintegral response code')
    code=int(code)
    if variable in USE_DOMAINS:
        if code not in (1,2):raise ValueError('Unknown Q11 response code')
        return Decimal(code==1)
    if variable in EXPECTED_DOMAINS:
        if code not in range(1,7):raise ValueError('Unknown Q12 response code')
        return None if code in (5,6) else Decimal(code in (3,4))
    if variable in (PRODUCTIVITY,AUTOMATION,AUGMENTATION):
        if code not in range(1,8):raise ValueError('Unknown Q21 response code')
        if code in (6,7):return None
        return Decimal('0.5') if half_neutral and code==3 else Decimal(code in (4,5))
    if variable in ('Q14','Q15'):
        if code not in range(1,13):raise ValueError('Unknown agency response code')
        return None if code in (11,12) else Decimal(code in (8,9,10))
    raise ValueError('Variable has no verified figure recode')


def stats(cells,variable,half_neutral=False,denominator='all_usable_weights'):
    if denominator not in ('all_usable_weights','valid_answers'):
        raise ValueError('Explicit denominator required')
    all_weight=valid_weight=numerator=Decimal(0)
    received=usable=invalid=0
    missing=[]
    seen=set()
    for r in cells:
        identity=(r.get('source_value'),r.get('missing_kind'))
        if identity in seen:raise ValueError('Duplicate aggregate category')
        seen.add(identity)
        w=dec(r['weighted_n'])
        if w<0:raise ValueError('Negative retained weight')
        n=int(r['received_n']);u=int(r['usable_weight_n']);bad=int(r['invalid_weight_n'])
        if min(n,u,bad)<0 or u+bad!=n:raise ValueError('Inconsistent weight counts')
        if u==0 and w!=0:raise ValueError('Weight on no eligible respondent')
        score=None if r.get('missing_kind') else response_score(variable,r.get('source_value'),half_neutral)
        all_weight+=w;received+=n;usable+=u;invalid+=bad
        if score is None:missing.append({'source_code':r.get('source_value'),'missing_kind':r.get('missing_kind') or 'explicit_nonresponse','n':n,'weight':str(w)})
        else:valid_weight+=w;numerator+=w*score
    total=all_weight if denominator=='all_usable_weights' else valid_weight
    return {'value':float(100*numerator/total) if total>0 else None,
      'valid_percent':float(100*numerator/valid_weight) if valid_weight>0 else None,
      'numerator_weight':str(numerator),'all_weight':str(all_weight),
      'valid_weight':str(valid_weight),'received_n':received,'usable_weight_n':usable,
      'invalid_weight_n':invalid,'missing_categories':missing,'denominator_rule':denominator}


def benchmark(ref,rows):
    expected=BENCHMARKS[ref];actual={r['label']:r for r in rows};checks=[]
    for group,values in expected.items():
        for field,target in values.items():
            value=actual.get(group,{}).get(field)
            checks.append({'group':group,'field':field,'reported':str(target),
              'calculated':value,'passed':value is not None and abs(dec(value)-target)<=Decimal('0.05')})
    return {'status':'passed' if all(c['passed'] for c in checks) else 'not_matched',
      'tolerance_percentage_points':'0.05','source_url':REPORT_URL,'checks':checks}


def derive_panels(grouped_cells, hdi_source_ref, denominator='all_usable_weights'):
    """Return report-shaped charts and diagnostic gaps from aggregate cells.

    hdi_source_ref must pin the source of the caller's country grouping. All
    question marginals retain denominator detail. An original figure receives
    original_recreation_status only when its published values benchmark matches;
    no benchmark exists for full figure1.3 or O.6, so these remain method-bound
    calculations rather than certified exact graphic reproductions.
    """
    if not all(hdi_source_ref.get(k) for k in ('source_id','release_id','sha256','url')):
        raise ValueError('Pinned HDI country-group source reference required')
    groups=defaultdict(list); refs={};gaps=[]
    for cell in grouped_cells:
        r=dict(cell)
        if r['variable'] not in VARIABLES:raise ValueError('Unexpected query variable')
        if not all(r.get(k) for k in ('release_id','source_id','source_url','source_sha256')):
            raise ValueError('Aggregate source provenance missing')
        key=(r['release_id'],r['source_id'],r['source_sha256'],r['source_url'])
        refs[key]={'source_id':r['source_id'],'release_id':r['release_id'],'sha256':r['source_sha256'],'url':r['source_url'],'vintage':'Nov2024–Jan2025 fieldwork','relation':'original_report_source'}
        if '__unmapped_' in r['group_label']:
            gaps.append({'reason':'unmapped source dimension retained','scope':r['scope'],'group':r['group_label'],'received_n':r['received_n']});continue
        groups[(r['scope'],r['group_label'],r['variable'])].append(r)
    if len(refs)!=1:raise ValueError('Mixed or empty physical survey source releases')
    source_refs=[*refs.values(),hdi_source_ref]
    def group(scope,label,variable,half=False):
        cells=groups.get((scope,label,variable))
        if not cells:raise ValueError('Required figure marginal absent: '+str((scope,label,variable)))
        return stats(cells,variable,half,denominator)
    def chart(id,ref,title_en,title_cs,rows,fields,method_en,method_cs,unit='percent',kind='bar'):
        return {'id':id,'chapter':ref.split('.')[0] if not ref.startswith('O.') else 'overview',
         'title':{'en':title_en,'cs':title_cs},'unit':unit,'chart_type':kind,'rows':rows,'fields':fields,
         'status':'ready','source_refs':source_refs,'method':{'en':method_en,'cs':method_cs},
         'denominator':{'en':'Original survey weights across 21 countries; all retained weights including explicit nonresponse unless valid-answer denominator explicitly chosen. Country HDI groups from pinned official data. Czechia not surveyed.',
          'cs':'Původní váhy průzkumu ve 21 zemích; všechny zachované váhy včetně neodpovědí, pokud nebyl výslovně zvolen jmenovatel platných odpovědí. Skupiny HDI z ověřeného zdroje. Česko nebylo dotazováno.'},
         'latest_period':'2025','original_refs':[ref],
         'original_recreation_status':'method_bound_calculation_numeric_benchmark_pending',
         'denominator_rule':denominator,'fieldwork_period':'2024-11/2025-01'}
    charts=[]
    use_rows=[];agency_rows=[];work_rows=[]
    for label in HDI_GROUPS:
        use=[group('hdi',label,v) for v in USE_DOMAINS];expected=[group('hdi',label,v) for v in EXPECTED_DOMAINS]
        if any(s['value'] is None for s in use+expected):raise ValueError('Empty domain denominator')
        actual=sum(dec(s['value']) for s in use)/3;future=sum(dec(s['value']) for s in expected)/3
        use_rows.append({'country':'SURVEY21','period':'2025','label':label,'actual':float(actual),'expected':float(future),'change':float(future-actual),'domain_denominators':dict(zip((*USE_DOMAINS,*EXPECTED_DOMAINS),use+expected))})
        now=group('hdi',label,'Q14');later=group('hdi',label,'Q15')
        agency_rows.append({'country':'SURVEY21','period':'2025','label':label,'current':now['value'],'future':later['value'],'change':later['value']-now['value'] if now['value'] is not None and later['value'] is not None else None,'question_denominators':{'Q14':now,'Q15':later}})
        scores=[group('hdi',label,v,True) for v in (AUTOMATION,AUGMENTATION,PRODUCTIVITY)]
        work_rows.append({'country':'SURVEY21','period':'2025','label':label,**dict(zip(('automation','augmentation','productivity'),[s['value'] for s in scores])),'question_denominators':dict(zip((AUTOMATION,AUGMENTATION,PRODUCTIVITY),scores))})
    c=chart('original-survey-o1','O.1','AI use and expected use by human development group','Používání AI a očekávané používání podle HDI',use_rows,['actual','expected','change'],'Mean of three separately weighted education, health and work percentages. Actual Q11 yes=1; expected Q12 somewhat/very likely=3/4. Expected minus actual is percentage points, not subsequent observed growth.','Průměr tří samostatně vážených podílů pro vzdělávání, zdraví a práci. Skutečné použitíQ11ano=1; očekávanéQ12=3/4. Rozdíl v procentních bodech není později pozorovaný růst.')
    c['original_refs']=['O.1','1.1'];c['published_value_benchmark']=benchmark('O.1',use_rows)
    if c['published_value_benchmark']['status']=='passed':c['original_recreation_status']='published_values_and_documented_method_matched'
    charts.append(c)
    c=chart('original-survey-agency','2.1','Perceived control today and in five years','Vnímaná kontrola dnes a za pět let',agency_rows,['current','future','change'],'High control means original Q14/Q15 codes8–10 on the1–10 scale. Future expectation is not future observation. Change is future minus current in percentage points.','Vysoká kontrola znamená původní kódyQ14/Q15=8–10 na stupnici1–10. Budoucí očekávání není pozorovaný výsledek. Rozdíl je budoucnost minus současnost v procentních bodech.')
    c['published_value_benchmark']=benchmark('2.1',agency_rows)
    if c['published_value_benchmark']['status']=='passed':c['original_recreation_status']='published_values_and_documented_method_matched'
    charts.append(c)
    age_rows=[];change_rows=[]
    for age in AGES:
        use=[group('age',age,v) for v in USE_DOMAINS];confidence=group('age',age,PRODUCTIVITY)
        age_rows.append({'country':'SURVEY21','period':'2025','label':age,'actual':float(sum(dec(s['value']) for s in use)/3),'confidence':confidence['value'],'question_denominators':dict(zip((*USE_DOMAINS,PRODUCTIVITY),use+[confidence]))})
        for hdi in HDI_GROUPS:
            now=group('hdi_age',hdi+'|'+age,'Q14');later=group('hdi_age',hdi+'|'+age,'Q15')
            change_rows.append({'country':'SURVEY21','period':'2025','label':age+' / '+hdi,'age_group':age,'hdi_group':hdi,'change':later['value']-now['value'] if now['value'] is not None and later['value'] is not None else None,'question_denominators':{'Q14':now,'Q15':later}})
    charts.append(chart('original-survey-use-productivity','1.3','AI use and productivity confidence across ages','Používání AI a očekávaná produktivita podle věku',age_rows,['actual','confidence'],'Q1 age groups use original exact ages. Horizontal measure is mean Q11 education/health/work yes percentages; confidence isQ21 likely/very likely codes4/5, without half-neutral. Association, not causal productivity estimate.','Věkové skupiny z přesného věkuQ1. Používání je průměr tří podílůQ11; důvěra jeQ21kód4/5, bez poloviny neutrálních odpovědí. Jde o souvislost, nikoli kauzální odhad.',kind='bar'))
    c=chart('original-survey-agency-age-change','O.6','Expected change in control across ages and development groups','Očekávaná změna kontroly podle věku a HDI',change_rows,['change'],'Difference between Q15 and Q14 shares reporting8–10, grouped by exactQ1 ages and report HDI group. Percentagepoints, not relative percent or mean control score.','Rozdíl podílůQ15aQ14s odpovědí8–10 podle přesného věkuQ1 a HDI. Procentní body, nikoli relativní procenta nebo průměrné skóre.',unit='percentage points')
    c['original_refs']=['O.6','4.4'];charts.append(c)
    c=chart('original-survey-job-expectations','6.3','Expected job changes, new roles and productivity','Očekávané změny práce, nové role a produktivita',work_rows,['automation','augmentation','productivity'],'Original figure6.3 note: likely/very likely Q21 codes4/5 plus HALF neutral code3. Separate marginal proportions; not joint automation-and-augmentation shares.','Poznámka k původnímu obrázku6.3:Q21kódy4/5 plus POLOVINA neutrálních odpovědí3. Samostatné podíly, nikoli společný výskyt obou očekávání.')
    charts.append(c)
    return charts,gaps
