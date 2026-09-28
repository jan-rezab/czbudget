"""Install the exact bounded operational monitor; data ingestion is never invoked."""
import argparse,base64,json,re,subprocess,urllib.request
PROJECT='czbudget-janrezab';ACCOUNT='jan@ravineo.com'
SA='psd-cost-controller@'+PROJECT+'.iam.gserviceaccount.com'
NAME='projects/'+PROJECT+'/locations/europe-west4/jobs/psd-project-cost-cap'
ROOT='https://cloudscheduler.googleapis.com/v1/'
IMAGE='gcr.io/google.com/cloudsdktool/cloud-sdk:slim@sha256:b3c19d28b18621203fc6e360515061c086c3b103dc4cf09ff80051e1473ed5ec'
def definition(source_object,generation):
 if not source_object.startswith('processing-runs/cost-control/sources/') or '..' in source_object or not source_object.endswith('.tgz'):raise ValueError('Unrecognized controller source')
 if not re.fullmatch('[1-9][0-9]+',generation):raise ValueError('Exact source generation required')
 build={'source':{'storageSource':{'bucket':'czbudget-janrezab-data-layers','object':source_object,'generation':generation}},'steps':[{'id':'project-cost-circuit','name':IMAGE,'entrypoint':'python3','env':['BUILD_ID=$BUILD_ID','PYTHONUNBUFFERED=1'],'args':['pipeline/cost_controls/cap.py']}],'timeout':'180s','queueTtl':'120s','tags':['plane-control','project-cost-cap'],'options':{'logging':'CLOUD_LOGGING_ONLY','machineType':'E2_MEDIUM'},'serviceAccount':'projects/'+PROJECT+'/serviceAccounts/'+SA}
 # Metadata-only control deliberately uses the web region's independent 40-CPU
 # quota. It is not a web verification/deployment or a data-plane build.
 return {'name':NAME,'description':'PSD project cost checks; private exact-code source; no deployment or data ingestion','schedule':'*/15 * * * *','timeZone':'Europe/Prague','attemptDeadline':'30s','retryConfig':{'retryCount':0},'httpTarget':{'uri':'https://cloudbuild.googleapis.com/v1/projects/'+PROJECT+'/locations/europe-west1/builds','httpMethod':'POST','headers':{'Content-Type':'application/json'},'body':base64.b64encode(json.dumps(build).encode()).decode(),'oauthToken':{'serviceAccountEmail':SA,'scope':'https://www.googleapis.com/auth/cloud-platform'}}}
def main():
 p=argparse.ArgumentParser();p.add_argument('--source-object',required=True);p.add_argument('--source-generation',required=True);p.add_argument('--apply',action='store_true');a=p.parse_args();job=definition(a.source_object,a.source_generation)
 if not a.apply:print(json.dumps(job,indent=2));return
 token=subprocess.check_output(['gcloud','auth','print-access-token','--account='+ACCOUNT],text=True,timeout=30).strip()
 def api(url,data=None,method=None):
  r=urllib.request.Request(url,data=None if data is None else json.dumps(data).encode(),method=method,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
  with urllib.request.urlopen(r,timeout=30) as f:return json.load(f)
 existing=api(ROOT+NAME)
 if not existing['description'].startswith('PSD project cost checks;'):raise ValueError('Existing job is not this controller')
 # Do not alter pause state, notification channels or retry preferences.
 result=api(ROOT+NAME+'?updateMask=description,schedule,timeZone,attemptDeadline,httpTarget',{k:v for k,v in job.items() if k!='retryConfig'},'PATCH')
 print(json.dumps({'name':result['name'],'state':result['state'],'schedule':result['schedule'],'target':result['httpTarget']['uri']}))
if __name__=='__main__':main()
