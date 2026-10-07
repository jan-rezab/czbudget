"""Project-wide observed-cost circuit breaker. Retention/other jobs are never deleted or cancelled.

Cloud control worker only. Billing lag means this is not an invoice ceiling.
"""
from datetime import datetime, timezone
import calendar
import json
import os
import re
from pathlib import Path
import sys
import urllib.parse
from zoneinfo import ZoneInfo

sys.path.insert(0,str(Path(__file__).resolve().parent))
from cloud_clients import Rest, BigQueryClient, QueryJobConfig

PROJECT='czbudget-janrezab'
PREFIX='static-assets/cost-control/'
ROOT='https://storage.googleapis.com/storage/v1/b/'+PROJECT+'-public-snapshots/o/'
UPLOAD='https://storage.googleapis.com/upload/storage/v1/b/'+PROJECT+'-public-snapshots/o'
PRAGUE=ZoneInfo('Europe/Prague')
RATES={'analysis_tib':129.4275,'cpu_second':.000497001,'gib_second':.000051771,
       'request':.000008283,'egress_gib':2.174382,'fixed_storage_month':531,
       'other_services_month_allowance':1000}

def timestamp(value):return datetime.fromisoformat(re.sub(r'(\.\d{6})\d+', r'\1', value).replace('Z','+00:00'))
def encoded(value):return urllib.parse.quote(value,safe='')
def dump(value):return json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()

def windows(now):
    local=now.astimezone(PRAGUE)
    return local.replace(day=1,hour=0,minute=0,second=0,microsecond=0).astimezone(timezone.utc),local.replace(hour=0,minute=0,second=0,microsecond=0).astimezone(timezone.utc)

def decision(previous,now,month_amount,day_amount,enforced=True):
    local=now.astimezone(PRAGUE);month=local.strftime('%Y-%m');day=local.strftime('%Y-%m-%d')
    month_stopped=month_amount>=10000 or (previous.get('month')==month and previous.get('month_stopped',False))
    day_stopped=day_amount>=2000 or (previous.get('day')==day and previous.get('day_stopped',False))
    return dict(schema_version='project-cost-control.v1',project=PROJECT,currency='CZK',
        month_limit=10000,day_limit=2000,warning_fraction=.75,month=month,day=day,
        checked_at=now.isoformat(),enforced=enforced,month_amount=round(month_amount,6),day_amount=round(day_amount,6),
        month_stopped=month_stopped,day_stopped=day_stopped,paused=enforced and (month_stopped or day_stopped),
        month_warning=month_amount>=7500,day_warning=day_amount>=1500,
        reason='monthly_limit' if month_stopped else 'daily_limit' if day_stopped else None,
        limitations='Observed gross/project usage and conservative query reservations; billing/metrics lag and retained storage prevent an exact invoice ceiling.')

def query(sql):
    client=BigQueryClient(PROJECT,'EU')
    config=QueryJobConfig(labels={'plane':'control','purpose':'project-cost-cap'},query_parameters=[],maximum_bytes_billed=2*1024**3)
    return client.query(sql,config,'EU').result()

def paged(api,url,field,bound=10):
    rows=[]
    for _ in range(bound):
        response=api.request(url);rows.extend(response.get(field,[]))
        if not response.get('nextPageToken'):return rows
        url=url.split('&pageToken=')[0]+'&pageToken='+encoded(response['nextPageToken'])
    raise RuntimeError('Cost metadata pagination bound exceeded')

def metric(api,kind,start,end):
    params=dict(filter='metric.type="'+kind+'" AND resource.type="cloud_run_revision"',
        **{'interval.startTime':start.isoformat(),'interval.endTime':end.isoformat(),
           'aggregation.alignmentPeriod':'3600s','aggregation.perSeriesAligner':'ALIGN_SUM',
           'aggregation.crossSeriesReducer':'REDUCE_SUM','pageSize':1000})
    series=paged(api,'https://monitoring.googleapis.com/v3/projects/'+PROJECT+'/timeSeries?'+urllib.parse.urlencode(params),'timeSeries')
    return sum(float(next(iter(point['value'].values()))) for item in series for point in item.get('points',[]))

def fast_estimates(api,now):
    month_start,day_start=windows(now)
    totals={'month':0.,'day':0.};details={}
    rows=query("""SELECT SUM(IFNULL(total_bytes_billed,0)) month_bytes,
      SUM(IF(creation_time >= TIMESTAMP('%s'),IFNULL(total_bytes_billed,0),0)) day_bytes
      FROM `czbudget-janrezab.region-eu.INFORMATION_SCHEMA.JOBS_BY_PROJECT`
      WHERE creation_time >= TIMESTAMP('%s') AND job_type='QUERY'
      AND (statement_type IS NULL OR statement_type!='SCRIPT')"""%(day_start.isoformat(),month_start.isoformat()))
    for scope in totals:totals[scope]=float(rows[0][scope+'_bytes'] or 0)/2**40*RATES['analysis_tib']
    details['bigquery']=dict(totals)
    prices=json.loads(Path(__file__).with_name('cap-prices.json').read_text())
    builds=[]
    for region in ['europe-west1','europe-west4','global']:
        url='https://cloudbuild.googleapis.com/v1/projects/'+PROJECT+'/locations/'+region+'/builds?'+urllib.parse.urlencode(dict(pageSize=1000,filter='create_time>="'+month_start.isoformat()+'"'))
        for build in paged(api,url,'builds'):
            machine=build.get('options',{}).get('machineType','DEFAULT')
            rate=prices['build_minutes'][region].get(machine)
            if rate is None:raise RuntimeError('Unpriced worker type; cost control fails closed: '+machine)
            start=timestamp(build.get('startTime',now.isoformat()));end=min(now,timestamp(build.get('finishTime',now.isoformat())))
            disk=max(0,int(build.get('options',{}).get('diskSizeGb',100))-100)
            rate+=disk*prices['build_disk_month'][region]/(30.44*24*60)
            for scope,lower in [('month',month_start),('day',day_start)]:totals[scope]+=max(0,(end-max(start,lower)).total_seconds())/60*rate
            builds.append({'id':build['id'],'region':region,'machine':machine,'start':start.isoformat(),'end':end.isoformat()})
    details['builds_count']=len(builds)
    kinds=[('run.googleapis.com/container/cpu/allocation_time',RATES['cpu_second']),
           ('run.googleapis.com/container/memory/allocation_time',RATES['gib_second']),
           ('run.googleapis.com/request_count',RATES['request']),
           ('run.googleapis.com/container/network/sent_bytes_count',RATES['egress_gib']/2**30)]
    for scope,start in [('month',month_start),('day',day_start)]:
        run_cost=sum(metric(api,kind,start,now)*rate for kind,rate in kinds)
        days=calendar.monthrange(now.astimezone(PRAGUE).year,now.astimezone(PRAGUE).month)[1]
        allowance=(RATES['fixed_storage_month']+RATES['other_services_month_allowance'])*(now-start).total_seconds()/(days*86400)
        totals[scope]+=run_cost+allowance;details[scope]={'run_czk':run_cost,'storage_other_allowance_czk':allowance}
    return totals,details

def billing_estimates(api,now):
    root='https://bigquery.googleapis.com/bigquery/v2/projects/'+PROJECT+'/datasets/psd_cost_control/tables?maxResults=100'
    tables=api.request(root).get('tables',[])
    # Authorized project-only view is provisioned by the owner once export exists.
    view=next((t['tableReference']['tableId'] for t in tables if t['tableReference']['tableId']=='psd_project_costs'),None)
    if not view:return None
    month,day=windows(now)
    rows=query("""SELECT currency,SUM(cost) month_cost,SUM(IF(usage_start_time>=TIMESTAMP('%s'),cost,0)) day_cost
      FROM `czbudget-janrezab.psd_cost_control.psd_project_costs`
      WHERE usage_start_time>=TIMESTAMP('%s') AND project_id='czbudget-janrezab' GROUP BY currency"""%(day.isoformat(),month.isoformat()))
    if not rows:return None  # Newly enabled export has no observations yet.
    if any(row['currency']!='CZK' for row in rows):raise RuntimeError('Billing currency differs from configured CZK cap')
    return dict(month=sum(float(r['month_cost'] or 0) for r in rows),day=sum(float(r['day_cost'] or 0) for r in rows))

def read_optional(api,name):
    import urllib.error
    try:return api.request(ROOT+encoded(PREFIX+name)+'?alt=media')
    except urllib.error.HTTPError as error:
        if error.code==404:return {}
        raise

def run():
    execution=os.environ.get('CLOUD_RUN_EXECUTION') or os.environ.get('BUILD_ID')
    if not execution:raise RuntimeError('Run the control worker as a managed Cloud Run job or Cloud Build')
    api=Rest();now=datetime.now(timezone.utc)
    config=read_optional(api,'config.json');previous=read_optional(api,'current.json')
    metadata=api.request(ROOT+encoded(PREFIX+'current.json'))
    def log(payload,severity='INFO'):
        if os.environ.get('PSD_COST_DRY_RUN') == '1':return
        api.request('https://logging.googleapis.com/v2/entries:write',dict(logName='projects/'+PROJECT+'/logs/psd-cost-control',
            resource={'type':'global','labels':{'project_id':PROJECT}},entries=[dict(severity=severity,jsonPayload=payload)]))
    try:
        if config.get('month_limit')!=10000 or config.get('day_limit')!=2000 or config.get('warning_fraction')!=.75:raise RuntimeError('Unexpected controller configuration')
        fast,details=fast_estimates(api,now);billing=billing_estimates(api,now)
        amounts={key:max(value,(billing or {}).get(key,0)) for key,value in fast.items()}
        local=now.astimezone(PRAGUE);ledger=read_optional(api,'admission/'+local.strftime('%Y-%m')+'.json')
        amounts['month']+=float(ledger.get('month_reserved',0))
        if ledger.get('day')==local.strftime('%Y-%m-%d'):amounts['day']+=float(ledger.get('day_reserved',0))
        state=decision(previous,now,amounts['month'],amounts['day'],config.get('enabled') is True)
        state.update(reports_only=config.get('reports_only') is True,billing_export_pending=billing is None,
                     measured_billing=billing,fast_estimate=fast,details=details,build_id=execution,execution_id=execution)
    except Exception as error:
        state=dict(previous,checked_at=now.isoformat(),enforced=config.get('enabled') is True,
                   reports_only=config.get('reports_only') is True,paused=config.get('enabled') is True,
                   reason='cost_monitor_unavailable',monitor_error=str(error)[:500])
        print(json.dumps({'severity':'ERROR','event':'psd_cost_monitor_failure','reason':str(error)[:500]}),flush=True)
        log({'event':'psd_cost_monitor_failure','reason':str(error)[:500]},'ERROR')
    if os.environ.get('PSD_COST_DRY_RUN') == '1':
        print(json.dumps({'event':'psd_cost_dry_run','state':state}),flush=True)
        if state.get('monitor_error'):raise RuntimeError(state['monitor_error'])
        return state
    params=urllib.parse.urlencode(dict(uploadType='media',name=PREFIX+'current.json',ifGenerationMatch=metadata['generation']))
    api.request(UPLOAD+'?'+params,dump(state),content_type='application/json')
    for scope in ['month','day']:
        period=state.get(scope);warn=state.get(scope+'_warning',False);stopped=state.get(scope+'_stopped',False)
        old_warn=previous.get(scope)==period and previous.get(scope+'_warning',False)
        old_stop=previous.get(scope)==period and previous.get(scope+'_stopped',False)
        if (warn and not old_warn) or (stopped and not old_stop):
            event={'event':'psd_cost_threshold','scope':scope,'period':period,
                'threshold':1 if stopped else .75,'amount_czk':state.get(scope+'_amount'),'serving_paused':state['paused']}
            log(event,'WARNING');print(json.dumps(event),flush=True)
    print(json.dumps({'event':'psd_cost_check','paused':state['paused'],'month_czk':state.get('month_amount'),'day_czk':state.get('day_amount'),'enforced':state.get('enforced')}),flush=True)

if __name__=='__main__':run()
