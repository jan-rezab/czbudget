#!/usr/bin/env python3
"""Atomic production admission. No dataset reads, deployment or job cancellation."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

PROJECT = 'czbudget-janrezab'
BUCKET = PROJECT + '-public-snapshots'
PREFIX = 'build-admission/'
REGION = 'europe-west1'
TERMINAL = {'SUCCESS', 'FAILURE', 'INTERNAL_ERROR', 'TIMEOUT', 'CANCELLED', 'EXPIRED'}
FAILED = TERMINAL - {'SUCCESS'}
POLICY = {'schema': 1, 'budget_czk': 150, 'max_attempts': 6,
          'maximum_build_seconds': 1800, 'rate_czk_per_minute': 2.0}
# Conservative worker-compute allowance, above the current 32-CPU rate. This is
# not an invoice cap: startup/rejected submissions/storage are outside the ledger.

def now(): return dt.datetime.now(dt.timezone.utc).isoformat()
def stamp(value): return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
def git(*args): return subprocess.check_output(['git', *args], text=True).strip()
def encoded(value): return urllib.parse.quote(value, safe='')
def valid(value, pattern, label):
    if not re.fullmatch(pattern, value or ''): raise ValueError('Invalid or missing '+label)
    return value

class API:
    def __init__(self):
        self.token = subprocess.check_output(['gcloud','auth','print-access-token'] + ([] if os.environ.get('BUILD_ID') else ['--account=jan@ravineo.com']), text=True, timeout=30).strip()
    def request(self, url, body=None):
        headers={'Authorization':'Bearer '+self.token,'Content-Type':'application/json'}
        req=urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(),headers=headers)
        with urllib.request.urlopen(req,timeout=30) as response: return json.load(response)
    def read(self, key):
        url=f'https://storage.googleapis.com/storage/v1/b/{BUCKET}/o/{encoded(PREFIX+key)}'
        try: meta=self.request(url)
        except urllib.error.HTTPError as e:
            if e.code==404:return None,0
            raise
        return self.request(url+'?alt=media&generation='+meta['generation']),int(meta['generation'])
    def write(self,key,value,generation):
        query=urllib.parse.urlencode({'uploadType':'media','name':PREFIX+key,'ifGenerationMatch':generation})
        return self.request(f'https://storage.googleapis.com/upload/storage/v1/b/{BUCKET}/o?'+query,value)
    def build(self, build_id):
        return self.request(f'https://cloudbuild.googleapis.com/v1/projects/{PROJECT}/locations/{REGION}/builds/{build_id}')


def reconcile(entries, lookup):
    result=[]
    for old in entries:
        entry=dict(old)
        if entry.get('status') not in TERMINAL:
            build=lookup(entry['build_id'])
            entry['status']=build['status']
            if entry['status'] in TERMINAL:
                if build.get('startTime') and build.get('finishTime'):
                    seconds=max(0,(stamp(build['finishTime'])-stamp(build['startTime'])).total_seconds())
                    entry['charged_czk']=round(seconds/60*entry['rate_czk_per_minute'],6)
                else: entry['charged_czk']=entry['reserved_czk'] # unknown duration never refunds
                entry['finished_at']=build.get('finishTime')
        result.append(entry)
    return result


def decide(policy, entries, request, build_id, commit, tree):
    if policy.get('schema')!=1:raise ValueError('Unknown task policy')
    if request.get('commit')!=commit or request.get('tree')!=tree:raise ValueError('Admission receipt is not for this exact candidate')
    if not request.get('source_contracts_passed'):raise ValueError('Passing source preflight receipt required')
    if any(e['commit']==commit for e in entries):raise ValueError('Duplicate candidate: already admitted')
    if any(e['status'] not in TERMINAL for e in entries):raise ValueError('Task already has an in-flight build')
    if len(entries)>=policy['max_attempts']:raise ValueError('Task attempt allowance exhausted; do not rename the task to reset it')
    failures=[e['build_id'] for e in entries if e['status'] in FAILED]
    if len(failures)>=2:
        correction=request.get('correction') or {}
        if (correction.get('exit_code')!=0 or not correction.get('diagnosis') or
            not correction.get('command') or set(correction.get('failed_builds',[]))!=set(failures)):
            raise ValueError('Two failures: fresh passing focused correction and diagnosis required')
    reserve=policy['maximum_build_seconds']/60*policy['rate_czk_per_minute']
    spent=sum(e.get('charged_czk',e['reserved_czk']) for e in entries)
    if spent+reserve>policy['budget_czk']:raise ValueError('Task compute allowance would be exceeded')
    return {'build_id':build_id,'commit':commit,'status':'WORKING','admitted_at':now(),
            'reserved_czk':reserve,'rate_czk_per_minute':policy['rate_czk_per_minute']}


def assert_current_main(commit, opener=urllib.request.urlopen):
    req=urllib.request.Request('https://api.github.com/repos/jan-rezab/czbudget/git/ref/heads/main',headers={'User-Agent':'psd-build-admission','Accept':'application/vnd.github+json'})
    with opener(req,timeout=15) as response: head=json.load(response)['object']['sha']
    if head!=commit:raise ValueError('Stale candidate: current main differs; no expensive work admitted')


def admit(api,commit,build_id,tree):
    assert_current_main(commit)
    actual=api.build(build_id)
    seconds=float(actual.get('timeout','0s').removesuffix('s'))
    if actual.get('options',{}).get('machineType')!='E2_HIGHCPU_32' or not 0 < seconds <= POLICY['maximum_build_seconds']:
        raise ValueError('Worker configuration exceeds the priced production contract')
    request,_=api.read('requests/'+commit+'.json')
    if not request:raise ValueError('Missing pre-push admission receipt; register this exact commit')
    task=valid(request.get('task'),r'[A-Za-z0-9][A-Za-z0-9_.-]{2,100}','task ID')
    policy,_=api.read('tasks/'+task+'/policy.json')
    if not policy:raise ValueError('Task policy missing')
    # Candidate lock is global, so changing task IDs cannot admit the same SHA.
    # A rejected admission retains its claim; corrections require a new candidate.
    api.write('claims/'+commit+'.json',{'build_id':build_id,'task':task,'created_at':now()},0)
    key='tasks/'+task+'/ledger.json'
    for _ in range(5):
        ledger,generation=api.read(key)
        entries=reconcile((ledger or {}).get('entries',[]),api.build)
        entry=decide(policy,entries,request,build_id,commit,tree)
        try:
            api.write(key,{'task':task,'entries':entries+[entry]},generation)
            print(json.dumps({'event':'build_admitted','task':task,'reserved_czk':entry['reserved_czk'],'budget_czk':policy['budget_czk']}))
            return
        except urllib.error.HTTPError as e:
            if e.code!=412:raise
    raise RuntimeError('Concurrent admission conflict; no work admitted')


def register(api,args):
    commit=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}')
    if git('status','--porcelain'):raise ValueError('Commit all candidate changes before registration')
    task=args.task or os.environ.get('PSD_BUILD_TASK') or os.environ.get('CODEX_THREAD_ID')
    if not task:
        task=git('show','-s','--format=%(trailers:key=PSD-Task,valueonly)',commit)
    task=valid(task,r'[A-Za-z0-9][A-Za-z0-9_.-]{2,100}','stable task ID (set PSD_BUILD_TASK)')
    policy_key='tasks/'+task+'/policy.json'
    policy,_=api.read(policy_key)
    if not policy:
        policy=dict(POLICY,task=task,started_at=now())
        try:api.write(policy_key,policy,0)
        except urllib.error.HTTPError as e:
            if e.code!=412:raise
    ledger,_=api.read('tasks/'+task+'/ledger.json')
    entries=reconcile((ledger or {}).get('entries',[]),api.build)
    failures=[e['build_id'] for e in entries if e['status'] in FAILED]
    correction=None
    if len(failures)>=2:
        command=args.correction_command or os.environ.get('PSD_CORRECTION_COMMAND')
        diagnosis=args.diagnosis or os.environ.get('PSD_CORRECTION_DIAGNOSIS')
        if not command or not diagnosis:raise ValueError('Set PSD_CORRECTION_COMMAND and PSD_CORRECTION_DIAGNOSIS after two failures')
        completed=subprocess.run(shlex.split(command),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=300,check=True)
        print(completed.stdout.decode(errors='replace')[-6000:])
        correction={'command':command,'diagnosis':diagnosis,'failed_builds':failures,'exit_code':completed.returncode,'output_sha256':hashlib.sha256(completed.stdout).hexdigest(),'verified_at':now()}
    value={'schema':1,'task':task,'commit':commit,'tree':tree,'source_contracts_passed':True,'checked_at':now(),'correction':correction}
    existing,_=api.read('requests/'+commit+'.json')
    if existing:
        if existing['task']!=task or existing['tree']!=tree:raise ValueError('Candidate already registered to a different task')
        print('Existing immutable candidate receipt retained');return
    # Register is called only after successful mandatory checks by pre-push.
    api.write('requests/'+commit+'.json',value,0)
    print('Registered candidate '+commit+' for task '+task)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode',choices=['register','admit'])
    parser.add_argument('--task');parser.add_argument('--correction-command');parser.add_argument('--diagnosis')
    args=parser.parse_args();api=API()
    if args.mode=='register':register(api,args)
    else:
        commit=valid(os.environ.get('COMMIT_SHA'),r'[a-f0-9]{40}','commit SHA')
        build=valid(os.environ.get('BUILD_ID'),r'[a-f0-9-]{36}','build ID')
        admit(api,commit,build,git('rev-parse',commit+'^{tree}'))

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('BUILD ADMISSION BLOCKED: '+str(error),file=sys.stderr);sys.exit(2)
