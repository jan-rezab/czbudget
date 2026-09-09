#!/usr/bin/env python3
"""Idempotent reporting setup, only in the canonical Cloud Build release."""
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request

PROJECT = 'czbudget-janrezab'
DATABASE = 'data-reports'
KEY_NAME = 'Public Spending Data reports'
RULE = "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }"

def gcloud(*args):
    result = subprocess.run(['gcloud', *args, '--project='+PROJECT, '--quiet', '--format=json'], check=True, capture_output=True, text=True, timeout=600)
    return json.loads(result.stdout) if result.stdout.strip() else None

def main():
    if not os.environ.get('BUILD_ID') or os.environ.get('PROJECT_ID') != PROJECT:
        raise RuntimeError('Run only in the canonical Cloud Build project.')
    if not Path('/workspace/.deploy-current-main').exists():
        print('Skipping reporting setup for an obsolete release.')
        return
    # Required APIs were enabled by the project owner before this release.
    databases = gcloud('firestore', 'databases', 'list') or []
    existing = next((d for d in databases if d['name'].endswith('/'+DATABASE)), None)
    if existing is None:
        gcloud('firestore', 'databases', 'create', '--database='+DATABASE, '--location=europe-west1', '--type=firestore-native', '--delete-protection')
    elif existing.get('type') != 'FIRESTORE_NATIVE' or existing.get('locationId') != 'europe-west1':
        raise RuntimeError('The reporting database has unexpected settings; refusing to modify it.')

    token = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True).strip()
    def api(url, method='GET', body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(url, data=data, method=method, headers={'Authorization':'Bearer '+token, 'Content-Type':'application/json'})
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    rules_base = 'https://firebaserules.googleapis.com/v1/projects/'+PROJECT
    release_name = 'projects/'+PROJECT+'/releases/cloud.firestore/'+DATABASE
    try:
        release = api('https://firebaserules.googleapis.com/v1/'+release_name)
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        release = None
    current_rules = api('https://firebaserules.googleapis.com/v1/'+release['rulesetName']) if release else None
    files = (current_rules or {}).get('source', {}).get('files', [])
    if len(files) != 1 or files[0].get('content') != RULE:
        ruleset = api(rules_base+'/rulesets', 'POST', {'source':{'files':[{'name':'firestore.rules','content':RULE}]}})
        payload = {'name':release_name,'rulesetName':ruleset['name']}
        if release:
            api('https://firebaserules.googleapis.com/v1/'+release_name, 'PATCH', {'release':payload,'updateMask':'rulesetName'})
        else:
            api(rules_base+'/releases', 'POST', payload)
    try:
        field = api('https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/'+DATABASE+'/collectionGroups/dataReportContacts/fields/expiresAt')
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        field = {}
    if field.get('ttlConfig', {}).get('state') != 'ACTIVE':
        gcloud('firestore', 'fields', 'ttls', 'update', 'expiresAt', '--database='+DATABASE, '--collection-group=dataReportContacts', '--enable-ttl')
    keys = gcloud('recaptcha', 'keys', 'list') or []
    matches = [key for key in keys if key.get('displayName') == KEY_NAME]
    if len(matches) > 1:
        raise RuntimeError('Multiple reporting CAPTCHA keys exist; refusing to choose one.')
    key = matches[0] if matches else gcloud('recaptcha','keys','create','--display-name='+KEY_NAME,'--web','--domains=publicspendingdata.org','--integration-type=score')
    settings = key.get('webSettings', {})
    if settings.get('allowAllDomains') or settings.get('integrationType') != 'SCORE' or settings.get('allowedDomains') != ['publicspendingdata.org']:
        raise RuntimeError('The reporting CAPTCHA key has unexpected domain restrictions.')
    # Verify the existing runtime/build identity can read this dedicated database.
    api('https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/'+DATABASE+'/documents/dataReports?pageSize=1')
    values = {'DATA_REPORTS_ENABLED':'true','REPORTS_PROJECT_ID':PROJECT,'REPORTS_DATABASE_ID':DATABASE,'REPORTS_RECAPTCHA_SITE_KEY':key['name'].split('/')[-1]}
    Path('/workspace/.reporting-env').write_text('^|^'+'|'.join(name+'='+value for name,value in values.items()))
    print('Reporting database, deny-all client rules, contact TTL and domain-restricted CAPTCHA are ready.')

if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        print(error.stderr, file=sys.stderr)
        raise SystemExit(error.returncode)
