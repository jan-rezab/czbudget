"""Idempotent per-job web/data anomalies; retain the global daily backstop."""
from control import API, PROJECT

JOB='protoPayload.metadata.jobChange.job'
BASE='protoPayload.serviceName="bigquery.googleapis.com" AND protoPayload.metadata.jobChange.after="DONE" AND '+JOB+'.jobConfig.type="QUERY" AND NOT '+JOB+'.jobConfig.queryConfig.statementType="SCRIPT"'

def policy(plane,channels):
    threshold=(16 if plane=='web' else 64)*1024**3
    principals=([f'psd-web-runtime@{PROJECT}.iam.gserviceaccount.com'] if plane=='web' else
        [f'psd-data-builder@{PROJECT}.iam.gserviceaccount.com',f'comtrade-builder@{PROJECT}.iam.gserviceaccount.com'])
    identities=' OR '.join('protoPayload.authenticationInfo.principalEmail="'+p+'"' for p in principals)
    flt=BASE+' AND CAST('+JOB+'.jobStats.queryStats.totalBilledBytes, INT64)>'+str(threshold)+' AND ('+JOB+'.jobConfig.labels.plane="'+plane+'" OR ('+identities+'))'
    return dict(displayName='PSD BigQuery '+plane+' query above '+str(threshold//1024**3)+' GiB',
        userLabels={'managed_by':'psd-cost-audit','plane':plane},enabled=True,combiner='OR',
        conditions=[dict(displayName=plane+' single-query scan anomaly',conditionMatchedLog=dict(filter=flt,
            labelExtractors={'job':'EXTRACT('+JOB+'.jobName)','billed_bytes':'EXTRACT('+JOB+'.jobStats.queryStats.totalBilledBytes)',
                'run_id':'EXTRACT('+JOB+'.jobConfig.labels.run_id)','loader_sha':'EXTRACT('+JOB+'.jobConfig.labels.loader_sha)',
                'dataset':'EXTRACT('+JOB+'.jobConfig.labels.dataset)','purpose':'EXTRACT('+JOB+'.jobConfig.labels.purpose)'}))],
        notificationChannels=channels,alertStrategy={'notificationRateLimit':{'period':'3600s'},'autoClose':'86400s'},
        documentation={'mimeType':'text/markdown','content':f'A completed {plane} BigQuery query billed more than {threshold//1024**3} GiB. Numeric CAST avoids lexical comparisons of audit-log byte strings. Parent SCRIPT jobs are excluded. Plane labels are preferred; known runtime/builder identities also cover legacy unlabelled jobs.\n\nThis is a per-job anomaly, not a daily total, invoice or spending cap. The existing project-global 24h scan policy and 7,400 CZK monthly budget remain in place. Attribute the exact job/run/SHA before acting; preserve successful source checkpoints and never cancel unrelated workers. Website serving should use validated immutable releases. Data work stays in europe-west4 with its own per-query and cumulative admission limits. Evidence: outputs/20260928-bq-audit-fixes/.'})

def main():
    api=API('jan@ravineo.com','../outputs/20260928-bq-audit-fixes')
    root='https://monitoring.googleapis.com/v3/projects/'+PROJECT+'/alertPolicies'
    global_policy=api.request(root+'/18382163194667744698')
    existing=api.pages(root+'?pageSize=100','alertPolicies')
    for plane in ['web','data']:
        desired=policy(plane,global_policy['notificationChannels'])
        matches=[p for p in existing if p.get('displayName')==desired['displayName'] and p.get('userLabels',{}).get('managed_by')=='psd-cost-audit']
        if len(matches)>1: raise ValueError('Duplicate owned alert policies')
        if matches:
            result=api.request('https://monitoring.googleapis.com/v3/'+matches[0]['name']+'?updateMask=displayName,userLabels,enabled,combiner,conditions,notificationChannels,alertStrategy,documentation',desired,'PATCH')
        else: result=api.request(root,desired)
        verified=api.request('https://monitoring.googleapis.com/v3/'+result['name'])
        if verified['conditions'][0]['conditionMatchedLog']['filter']!=desired['conditions'][0]['conditionMatchedLog']['filter']: raise ValueError('Filter readback differs')
        api.save('scan-alert-'+plane,verified)
        print(plane+': '+verified['name'])

if __name__=='__main__': main()
