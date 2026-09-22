#!/usr/bin/env python3
"""Require completed verification of this exact candidate before production promotion.

Read-only: never submits a build, changes IAM, publishes data or deploys.
"""
import hashlib
import json
import os
import re
import subprocess
import sys

PROJECT = 'czbudget-janrezab'
REGION = 'europe-west1'
VERIFIER = 'psd-web-verifier@czbudget-janrezab.iam.gserviceaccount.com'
CONNECTED_REPOSITORY = 'projects/czbudget-janrezab/locations/europe-west1/connections/czbudget-github/repositories/czbudget'
FULL_TRIGGER = '8fb8b1d5-0e9f-4cd2-a76e-8e2fb18d50d3'


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
        return build.get('buildTriggerId') == FULL_TRIGGER and substitutions.get('COMMIT_SHA') == commit and any(step.get('id') == 'verification-complete' for step in build.get('steps', []))
    if lane != 'component' or 'fast-ui' not in tags:
        return False
    return substitutions.get('_CANDIDATE_SHA') == commit and substitutions.get('_BASE_SHA') == base and any('scripts/run-component-gate.mjs' in ' '.join(step.get('args', [])) for step in build.get('steps', []))


def valid_candidate_config_build(build, commit, base, config_sha):
    """An extra proof is required when the candidate changes the verifier YAML.

    The normal trigger reads its YAML from main even when --sha selects a PR
    commit as source. This connected-repository build uses the candidate's YAML.
    """
    if build.get('status') != 'SUCCESS' or build.get('buildTriggerId'):
        return False
    if not {'plane-verification', 'full-browser'} <= set(build.get('tags', [])):
        return False
    if build.get('serviceAccount', '').split('/')[-1] != VERIFIER:
        return False
    source = build.get('source', {}).get('connectedRepository', {})
    if source.get('repository') != CONNECTED_REPOSITORY or source.get('revision') != commit:
        return False
    substitutions = build.get('substitutions', {})
    if any(substitutions.get(key) != value for key, value in {
        '_CANDIDATE_SHA': commit, '_BASE_SHA': base, '_VERIFY_CONFIG_SHA': config_sha,
    }.items()):
        return False
    steps = {step.get('id') for step in build.get('steps', [])}
    return {'python-contracts', 'preflight-components', 'hydrate-published-releases',
            'verify-published-snapshots', 'verify-published-assets',
            'validate-source-contract', 'browser-contrast-a', 'nginx-routing',
            'verification-complete'} <= steps


def main():
    if sys.argv[1] == '--plan':
        with open(sys.argv[2]) as source:
            plan = json.load(source)
        commit, base, lane = plan['commit'], plan['base'], plan['lane']
        config_changed = 'cloudbuild.verify.yaml' in plan.get('files', [])
    else:
        commit, base, lane = sys.argv[1:4]
        changed_files = subprocess.check_output(['git', 'diff', '--name-only', base, commit], text=True).splitlines()
        config_changed = 'cloudbuild.verify.yaml' in changed_files
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
    verified = next((build for build in builds if valid_build(build, commit, base, lane)), None)
    if not verified:
        raise SystemExit('No successful '+lane+' verification for this exact candidate/base. Submit verification before promoting main.')
    if config_changed:
        with open('cloudbuild.verify.yaml', 'rb') as config_file:
            config_sha = hashlib.sha256(config_file.read()).hexdigest()
        candidate_config = next((build for build in builds if valid_candidate_config_build(build, commit, base, config_sha)), None)
        if not candidate_config:
            raise SystemExit('Verifier config changed: submit and pass the candidate-config build for this exact commit/base before promoting main.')
        print('Verified candidate verifier config in cloud build ' + candidate_config['id'])
    print('Verified exact candidate in cloud build ' + verified['id'])


if __name__ == '__main__':
    main()
