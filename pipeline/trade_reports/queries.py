"""Bulk forms of the published reader SQL; every table uses one warehouse time pin."""
import json,re
from pathlib import Path
SOURCE=json.loads(Path(__file__).with_name('source-sql.json').read_text())
SQL=SOURCE['queries']
EXPORTERS=['DEU','CZE','POL','FRA','ITA','NLD','GBR','USA','JPN','KOR','CHN','TUR']
VIAS=['KAZ','KGZ','ARM','GEO','TUR','UZB','ARE','CHN','BLR']
HS6=['854231','847130','845710','848210']
PRODUCTS=['TOTAL']+[str(n).zfill(2) for n in range(1,100)]+HS6

def change(sql,old,new,count=None):
    found=sql.count(old)
    if not found or (count is not None and found!=count):raise ValueError('SQL transformation drift: '+old)
    return sql.replace(old,new)

def pinned(sql):
    sql=re.sub(r'(`czbudget-janrezab\.budget_detail\.trade_\w+`)( AS (?:areas|observation)| [oc]\b)?',lambda m:m.group(1)+(m.group(2) or '')+' FOR SYSTEM_TIME AS OF @snapshot_at',sql)
    return sql.replace('CURRENT_DATE()','DATE(@snapshot_at)')

def bulk():
    result={'countries':SQL['TRADE_COUNTRIES_SQL'],'areas':SQL['AREAS_SQL'],'energy-periods':SQL['ENERGY_PERIODS_SQL']}
    s=SQL['TRADE_PROFILE_SQL']
    s=change(s,"    AND reporter_iso3 = @reporter_iso3\n",'')
    s=change(s,'PARTITION BY period, frequency, flow_code','PARTITION BY reporter_iso3, period, frequency, flow_code',2)
    s=change(s,"SELECT 'total' AS row_kind, period_start", "SELECT reporter_iso3 AS _reporter, 'total' AS row_kind, period_start",1)
    s=change(s,'GROUP BY period_start, period, ref_year, ref_month, frequency, flow_code','GROUP BY reporter_iso3, period_start, period, ref_year, ref_month, frequency, flow_code',1)
    s=change(s,"SELECT MAX(ref_year) AS ref_year FROM totals WHERE frequency = 'A'","SELECT _reporter, MAX(ref_year) AS ref_year FROM totals WHERE frequency = 'A' GROUP BY _reporter",1)
    s=change(s,'(SELECT ref_year FROM latest_annual)','(SELECT ref_year FROM latest_annual WHERE _reporter = scoped.reporter_iso3)',2)
    s=change(s,"SELECT 'partner' AS row_kind", "SELECT reporter_iso3 AS _reporter, 'partner' AS row_kind",1)
    s=change(s,'GROUP BY ref_year, flow_code, partner_area_code','GROUP BY reporter_iso3, ref_year, flow_code, partner_area_code',1)
    s=change(s,'PARTITION BY flow_code','PARTITION BY reporter_iso3, flow_code',2)
    s=change(s,'SELECT MIN(period_start) AS period_start','SELECT reporter_iso3 AS _reporter, MIN(period_start) AS period_start',1)
    s=change(s,'GROUP BY ref_year, flow_code, product_code','GROUP BY reporter_iso3, ref_year, flow_code, product_code',1)
    # UNION columns must agree: put the bulk key first on the product branch too.
    s=change(s,"SELECT 'product' AS row_kind, product_aggregates.* EXCEPT(value_usd, source_last_released, retrieved_at)","SELECT _reporter, 'product' AS row_kind, product_aggregates.* EXCEPT(_reporter, value_usd, source_last_released, retrieved_at)",1)
    result['profile']=s
    s=SQL['TRADE_PRODUCT_PARTNERS_SQL']
    s=change(s,'SELECT period_start, ref_year','SELECT reporter_iso3 AS _reporter, SUBSTR(product_code,1,2) AS _chapter, period_start, ref_year',1)
    s=change(s,'    AND reporter_iso3 = @reporter_iso3\n','')
    s=change(s,'    AND STARTS_WITH(product_code, @product_code)\n',"    AND REGEXP_CONTAINS(product_code, r'^[0-9]{2}')\n")
    s=change(s,'MAX(ref_year) OVER ()','MAX(ref_year) OVER (PARTITION BY _reporter, _chapter)',1)
    s=change(s,'PARTITION BY ref_year, flow_code, partner_area_code','PARTITION BY _reporter, _chapter, ref_year, flow_code, partner_area_code',1)
    s=change(s,'SELECT ref_year, flow_code, partner_area_code','SELECT _reporter, _chapter, ref_year, flow_code, partner_area_code',1)
    s=change(s,'GROUP BY ref_year, flow_code, partner_area_code','GROUP BY _reporter, _chapter, ref_year, flow_code, partner_area_code',1)
    s=change(s,'PARTITION BY flow_code','PARTITION BY _reporter, _chapter, flow_code',1)
    result['product-partners']=s
    s=SQL['ENERGY_FLOWS_SQL']
    s=change(s,'    observation.period,','    observation.product_code AS _product,\n    observation.period,',1)
    s=change(s,"WHERE observation.period_start = @period_start\n    AND observation.frequency = @frequency\n    AND observation.period = @period\n", "WHERE observation.period_start BETWEEN DATE '2019-01-01' AND CURRENT_DATE()\n    AND observation.frequency IN ('A','M')\n")
    s=change(s,'AND observation.product_code = @product_code',"AND observation.product_code IN ('270900','271111','271121')",1)
    s=change(s,'  ANY_VALUE(scoped.period) AS period,','  scoped._product, scoped.period AS period,',1)
    s=change(s,'  ANY_VALUE(scoped.frequency) AS frequency,','  scoped.frequency AS frequency,',1)
    s=change(s,'GROUP BY scoped.origin_iso3, scoped.market_iso3','GROUP BY scoped._product, scoped.frequency, scoped.period, scoped.origin_iso3, scoped.market_iso3',1)
    result['energy']=s
    s=SQL['RUSSIA_AGGREGATE_SQL']
    s=change(s,'SELECT period, reporter_iso3, flow_code','SELECT frequency AS _frequency, period, reporter_iso3, flow_code',1)
    s=change(s,"IF(@frequency='A', DATE '2014-01-01', DATE '2019-01-01')","DATE '2014-01-01'",1)
    s=change(s,"AND frequency=@frequency","AND (frequency='A' OR period_start >= DATE '2019-01-01') AND frequency=@frequency",1)
    s=change(s,'frequency=@frequency',"frequency IN ('A','M')",1)
    s=change(s,'PARTITION BY period,reporter_iso3','PARTITION BY frequency,period,reporter_iso3',1)
    s=change(s,'basket=@product',"basket IN ('"+"','".join(PRODUCTS)+"')",2)
    s=change(s,'SELECT period,reporter_iso3,flow_code','SELECT _frequency,period,reporter_iso3,flow_code',1)
    s=change(s,'GROUP BY period,reporter_iso3,flow_code','GROUP BY _frequency,period,reporter_iso3,flow_code',1)
    result['russia-aggregate']=s
    s=SQL['RUSSIA_BILATERAL_SQL'].replace('reporter_iso3=@country','reporter_iso3 IS NOT NULL AND reporter_iso3 != \'RUS\'')
    result['russia-bilateral']=s
    s=SQL['RUSSIA_ROUTES_SQL']
    s=change(s,'SELECT period, reporter_iso3, partner_iso3, primary_value_usd','SELECT product_code AS _product, period, reporter_iso3, partner_iso3, primary_value_usd',1)
    s=change(s,'product_code = @product',"product_code IN ('"+"','".join(HS6)+"')",1)
    s=change(s,"((reporter_iso3 = @exporter AND partner_iso3 IN ('RUS', @via))\n    OR (reporter_iso3 = @via AND partner_iso3 = 'RUS'))", "((reporter_iso3 IN ('"+"','".join(EXPORTERS)+"') AND partner_iso3 IN ('RUS','"+"','".join(VIAS)+"')) OR (reporter_iso3 IN ('"+"','".join(VIAS)+"') AND partner_iso3='RUS'))",1)
    s=change(s,'SELECT period, reporter_iso3, partner_iso3, CAST','SELECT _product, period, reporter_iso3, partner_iso3, CAST',1)
    result['russia-routes']=s
    s=SQL['TRADE_EXPLORER_SQL']
    s=change(s,'  AND o.reporter_iso3 IN (@country0, @country1, @country2, @country3)\n','  AND o.reporter_iso3 IS NOT NULL\n',1)
    s=s.replace('@end_date',"DATE '2025-12-31'")
    result['explorer']=s
    return {k:pinned(v) for k,v in result.items()}
