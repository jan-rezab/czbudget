#!/usr/bin/env python3
"""Require completed verification of this exact candidate before production promotion.

Read-only: never submits a build, changes IAM, publishes data or deploys.
"""
import json
import os
import re
import subprocess
import sys

PROJECT = 'czbudget-janrezab'
REGION = 'europe-west1'
VERIFIER = 'psd-web-verifier@czbudget-janrezab.iam.gserviceaccount.com'


def valid_build(build, commit, base, lane):
    if build.get('status') != 'SUCCESS':
        return False
    substitutions = build.get('substitutions', {})
    tags = build.get('tags', [])
    if 'plane-verification' not in tags:
        return False
    account = build.get('serviceAccount', '').split('/')[-1]
    if account != VERIFIER:
        return False
    if 'full-browser' in tags:
        return build.get('buildTriggerId') == '8fb8b1d5-0e9f-4cd2-a76e-8e2fb18d50d3' and substitutions.get('COMMIT_SHA') == commit and any(step.get('id') == 'verification-complete' for step in build.get('steps', []))
    if lane != 'component' or 'fast-ui' not in tags:
        return False
    return substitutions.get('_CANDIDATE_SHA') == commit and substitutions.get('_BASE_SHA') == base and any('scripts/run-component-gate.mjs' in ' '.join(step.get('args', [])) for step in build.get('steps', []))


def main():
    if sys.argv[1] == '--plan':
        with open(sys.argv[2]) as source:
            plan = json.load(source)
        commit, base, lane = plan['commit'], plan['base'], plan['lane']
    else:
        commit, base, lane = sys.argv[1:4]
    if not all(re.fullmatch('[a-f0-9]{40}', value) for value in [commit, base]) or lane not in ['component', 'full']:
        raise SystemExit('Invalid verification identity')
    # Cloud Build substitutions use different keys for Git-triggered full runs
    # and explicitly packaged component contexts. Retrieve both, deduplicated.
    builds = []
    for key in ['COMMIT_SHA', '_CANDIDATE_SHA']:
        command = ['gcloud', 'builds', 'list', '--project='+PROJECT, '--region='+REGION,
                   '--filter=status=SUCCESS AND substitutions.'+key+'='+commit, '--limit=20', '--format=json']
        if not os.environ.get('BUILD_ID') and not os.environ.get('K_SERVICE') and not os.path.isdir('/workspace'):
            command.append('--account='+os.environ.get('PSD_GCLOUD_ACCOUNT','jan@ravineo.com'))
        builds.extend(json.loads(subprocess.check_output(command, text=True)))
    for build in builds:
        if valid_build(build, commit, base, lane):
            print('Verified exact candidate in cloud build ' + build['id'])
            return
    raise SystemExit('No successful '+lane+' verification for this exact candidate/base. Submit verification before promoting main.')


if __name__ == '__main__':
    main()
