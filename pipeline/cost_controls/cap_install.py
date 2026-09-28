"""Idempotent, narrowly scoped identities and alert preparation; no cloud data deletion."""
from pathlib import Path
from control import API,PROJECT

ACCOUNT='jan@ravineo.com'
SA='psd-cost-controller@'+PROJECT+'.iam.gserviceaccount.com'
SA_RESOURCE='projects/'+PROJECT+'/serviceAccounts/'+SA
MEMBER='serviceAccount:'+SA
IAM='https://iam.googleapis.com/v1/'
COST_ROLE='projects/'+PROJECT+'/roles/psdCostCircuit'
ADMISSION_ROLE='projects/'+PROJECT+'/roles/psdWebQueryAdmission'

def optional(api,url):
    try:return api.request(url)
    except RuntimeError as error:
        if 'API HTTP 404:' in str(error):return None
        raise

def bind(policy,role,member,condition=None):
    for binding in policy.setdefault('bindings',[]):
        if binding['role']==role and binding.get('condition')==condition:
            if member not in binding['members']:binding['members'].append(member)
            return
    value={'role':role,'members':[member]}
    if condition:value['condition']=condition;policy['version']=3
    policy['bindings'].append(value)

def prepare():
    api=API(ACCOUNT,'/Users/johnwick/dev/czbudget/outputs/20260928-report-cache-cap')
    if not optional(api,IAM+SA_RESOURCE):
        api.request(IAM+'projects/'+PROJECT+'/serviceAccounts',{'accountId':'psd-cost-controller','serviceAccount':{'displayName':'PSD project cost circuit controller'}})
    permissions=['bigquery.jobs.create','bigquery.jobs.get','bigquery.jobs.list','bigquery.jobs.listAll',
        'bigquery.datasets.get','bigquery.tables.list','cloudbuild.builds.create','cloudbuild.builds.get','cloudbuild.builds.list',
        'monitoring.timeSeries.list','logging.logEntries.create','resourcemanager.projects.get']
    for role,perms,title in [(COST_ROLE,permissions,'PSD cost circuit metadata and control worker'),
            (ADMISSION_ROLE,['storage.objects.get','storage.objects.create','storage.objects.delete'],'PSD web query admission ledger only')]:
        previous=optional(api,IAM+role)
        desired={'title':title,'description':'Owned PSD cost cutoff role; no source data, Cloud Run deployment, cancellation or billing-disable permission.','stage':'GA','includedPermissions':perms}
        if previous:
            if set(previous['includedPermissions'])!=set(perms):
                api.request(IAM+role+'?updateMask=title,description,stage,includedPermissions',dict(desired,etag=previous['etag']),'PATCH')
        else:api.request(IAM+'projects/'+PROJECT+'/roles',{'roleId':role.rsplit('/',1)[1],'role':desired})
        api.save(role.rsplit('/',1)[1],api.request(IAM+role))
    crm='https://cloudresourcemanager.googleapis.com/v1/projects/'+PROJECT
    policy=api.request(crm+':getIamPolicy',{'options':{'requestedPolicyVersion':3}});api.save('controller-project-iam-before',policy)
    bind(policy,COST_ROLE,MEMBER)
    api.request(crm+':setIamPolicy',{'policy':policy});api.save('controller-project-iam-after',api.request(crm+':getIamPolicy',{'options':{'requestedPolicyVersion':3}}))
    existing=api.request(IAM+SA_RESOURCE+':getIamPolicy',{});bind(existing,'roles/iam.serviceAccountUser',MEMBER)
    api.request(IAM+SA_RESOURCE+':setIamPolicy',{'policy':existing})
    for bucket,prefix,role,member,title in [
        (PROJECT+'-public-snapshots','static-assets/cost-control/', 'roles/storage.objectUser',MEMBER,'psd-cost-controller-state'),
        (PROJECT+'-public-snapshots','static-assets/cost-control/admission/', ADMISSION_ROLE,'serviceAccount:psd-web-runtime@'+PROJECT+'.iam.gserviceaccount.com','psd-web-query-admission'),
        (PROJECT+'-data-layers','processing-runs/cost-control/', 'roles/storage.objectViewer',MEMBER,'psd-cost-controller-source')]:
        url='https://storage.googleapis.com/storage/v1/b/'+bucket+'/iam'
        policy=api.request(url+'?optionsRequestedPolicyVersion=3');api.save(title+'-before',policy)
        condition={'title':title,'expression':"resource.name.startsWith('projects/_/buckets/"+bucket+'/objects/'+prefix+"')"}
        bind(policy,role,member,condition);api.request(url,policy,'PUT');api.save(title+'-after',api.request(url+'?optionsRequestedPolicyVersion=3'))
    dataset='https://bigquery.googleapis.com/bigquery/v2/projects/'+PROJECT+'/datasets/psd_cost_control'
    view={'projectId':PROJECT,'datasetId':'psd_cost_control','tableId':'psd_project_costs'}
    # Authorize only this project-filtered view; the controller never receives a
    # reader grant on the billing export table or the whole dataset.
    table=api.request(dataset+'/tables/psd_project_costs')
    if "WHERE project.id='czbudget-janrezab'" not in table['view']['query']:
        raise RuntimeError('Refusing a billing view without the exact project restriction')
    policy=api.request(dataset)
    access=policy.setdefault('access',[])
    if not any(entry.get('view')==view for entry in access):
        access.append({'view':view})
        api.request(dataset,{'access':access,'etag':policy['etag']},'PATCH')
    url=dataset+'/tables/psd_project_costs'
    policy=api.request(url+':getIamPolicy',{})
    bind(policy,'roles/bigquery.dataViewer',MEMBER)
    api.request(url+':setIamPolicy',{'policy':policy})
    api.save('controller-project-cost-view-iam',api.request(url+':getIamPolicy',{}))
    root='https://monitoring.googleapis.com/v3/projects/'+PROJECT+'/alertPolicies'
    channels=api.request(root+'/18382163194667744698')['notificationChannels']
    for event,name in [('psd_cost_threshold','PSD project cost warning or cutoff'),('psd_cost_monitor_failure','PSD cost controller failed closed')]:
        desired=dict(displayName=name,userLabels={'managed_by':'psd-cost-cap'},enabled=True,combiner='OR',
            conditions=[dict(displayName=name,conditionMatchedLog={'filter':'logName="projects/'+PROJECT+'/logs/psd-cost-control" AND jsonPayload.event="'+event+'"'})],
            notificationChannels=channels,alertStrategy={'notificationRateLimit':{'period':'900s'},'autoClose':'86400s'},
            documentation={'mimeType':'text/markdown','content':'PSD project total observed/estimated gross costs. Warning at 7,500 CZK/month or 1,500 CZK/Prague day; serving stops at 10,000 or 2,000. Billing/metric lag and retained storage mean this is not an exact invoice ceiling. Status is private static-assets/cost-control/current.json; the site serves a lightweight bilingual pause notice. Never delete retained data or cancel unrelated workers.'})
        matches=[p for p in api.pages(root+'?pageSize=100','alertPolicies') if p.get('displayName')==name and p.get('userLabels',{}).get('managed_by')=='psd-cost-cap']
        if len(matches)>1:raise RuntimeError('Duplicate owned cost alert')
        result=api.request('https://monitoring.googleapis.com/v3/'+matches[0]['name']+'?updateMask=displayName,userLabels,enabled,combiner,conditions,notificationChannels,alertStrategy,documentation',desired,'PATCH') if matches else api.request(root,desired)
        api.save(event+'-alert',api.request('https://monitoring.googleapis.com/v3/'+result['name']))
    print('Controller identity, prefix-scoped state/admission permissions and existing-channel alerts prepared; cutoff remains inactive.')

if __name__=='__main__':prepare()
