#!/usr/bin/env python3
"""Restore the per-entity municipal fan-out from its pinned, immutable source.

data/municipal-history/<ico>.json and data/municipal-benchmarks/<cc>/<id>.json are not
tracked in Git. pipeline/config/municipal-serving-inputs.v1.json pins each input to one
immutable raw copy (gs://czbudget-janrezab-data-layers/raw/<dataset>/<git-sha>/) and to
the exact bytes of that Git commit. This restores one or both inputs under DEST and
fails unless every file matches the pin:

  - the raw source manifest hashes to the pinned SHA-256 (--from gcs);
  - every file is listed there with the same size and SHA-256, and nothing else exists;
  - the directory totals and the per-directory tree digests equal the pin, which are the
    digests data/release-manifest.v1.json recorded while the files were still tracked.

  --from gcs   data plane: read the raw objects (read-only; nothing is written to GCS)
  --from git   materialize from local Git objects at the pinned commit, without network;
               for local byte-identity proofs and workers that already fetched the commit

Point the readers at the result with MUNICIPAL_HISTORY_ROOT / MUNICIPAL_BENCHMARK_ROOT,
or leave DEST at its default (.municipal-fanout), which they find on their own.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PINS = ROOT / 'pipeline' / 'config' / 'municipal-serving-inputs.v1.json'


def tree_digest(directory):
    """name\\0content over the directory's own *.json files, as the release manifest hashes it."""
    digest, files, size = hashlib.sha256(), 0, 0
    for path in sorted(p for p in directory.iterdir() if p.is_file() and p.name.endswith('.json')):
        body = path.read_bytes()
        digest.update(path.name.encode() + b'\0' + body)
        files += 1
        size += len(body)
    return {'files': files, 'bytes': size, 'sha256': digest.hexdigest()}


def verify(pin, dest, listed=None):
    """Fail unless DEST/<directory> is exactly the pinned input."""
    base = dest / pin['directory']
    found = {p.relative_to(dest).as_posix(): p for p in base.rglob('*') if p.is_file()}
    if listed is not None:
        extra, missing = sorted(set(found) - set(listed)), sorted(set(listed) - set(found))
        if extra or missing:
            raise ValueError(f'{pin["directory"]}: {len(missing)} missing, {len(extra)} unexpected (e.g. {(missing or extra)[:3]})')
        for relative, expected in listed.items():
            body = found[relative].read_bytes()
            if len(body) != expected['bytes'] or hashlib.sha256(body).hexdigest() != expected['sha256']:
                raise ValueError(f'{relative} differs from the raw source manifest')
    total = sum(p.stat().st_size for p in found.values())
    if len(found) != pin['files'] or total != pin['bytes']:
        raise ValueError(f'{pin["directory"]}: {len(found)} files / {total} bytes, pinned {pin["files"]} / {pin["bytes"]}')
    for relative, expected in pin['trees'].items():
        actual = tree_digest(dest / relative)
        if actual != expected:
            raise ValueError(f'{relative}: tree digest {actual} does not equal the pin {expected}')
    return {'directory': pin['directory'], 'root': str(base), 'files': len(found), 'bytes': total,
            'source_git_sha': pin['source_git_sha'], 'trees': pin['trees']}


def from_git(pin, dest, repo):
    tree = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', f'{pin["source_git_sha"]}:{pin["directory"]}'], text=True).strip()
    if tree != pin['source_git_tree']:
        raise ValueError(f'{pin["directory"]} at {pin["source_git_sha"]} is tree {tree}, pinned {pin["source_git_tree"]}')
    archive = subprocess.Popen(['git', '-C', str(repo), 'archive', '--format=tar', pin['source_git_sha'], pin['directory']], stdout=subprocess.PIPE)
    subprocess.run(['tar', '-x', '-C', str(dest)], stdin=archive.stdout, check=True)
    if archive.wait() != 0:
        raise ValueError(f'git archive failed for {pin["directory"]}')
    return None


def from_gcs(pin, dest):
    if pin.get('raw_manifest_sha256') is None:
        raise ValueError(f'{pin["dataset"]} has no published raw copy yet ({pin.get("publication_status")})')
    prefix = pin['raw_prefix']
    with tempfile.TemporaryDirectory() as temporary:
        manifest_path = Path(temporary) / 'source-manifest.json'
        subprocess.run(['gcloud', 'storage', 'cp', prefix + 'source-manifest.json', str(manifest_path)], check=True)
        if hashlib.sha256(manifest_path.read_bytes()).hexdigest() != pin['raw_manifest_sha256']:
            raise ValueError(f'{prefix}source-manifest.json does not hash to the pinned manifest')
        manifest = json.loads(manifest_path.read_text())
    if manifest.get('git_sha') != pin['source_git_sha']:
        raise ValueError(f'{prefix} records commit {manifest.get("git_sha")}, pinned {pin["source_git_sha"]}')
    listed = {item['path']: item for item in manifest['files'] if item['path'].startswith(pin['directory'] + '/')}
    target = dest / pin['directory']
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['gcloud', 'storage', 'cp', '--recursive', prefix + pin['directory'], str(target.parent)], check=True)
    return listed


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--input', choices=['municipal-history', 'municipal-benchmarks', 'all'], default='all')
    parser.add_argument('--from', dest='source', choices=['gcs', 'git'], required=True)
    parser.add_argument('--dest', default=str(ROOT / '.municipal-fanout'))
    parser.add_argument('--repo', default=str(ROOT), help='--from git: repository holding the pinned commit')
    parser.add_argument('--pins', default=str(PINS))
    parser.add_argument('--receipt', help='also write the verification summary to this path')
    args = parser.parse_args(argv)

    pins = json.loads(Path(args.pins).read_text())['inputs']
    names = list(pins) if args.input == 'all' else [args.input]
    dest = Path(args.dest).resolve()
    dest.mkdir(parents=True, exist_ok=True)
    summary = {'schema_version': '1.0.0', 'source': args.source, 'pins': str(Path(args.pins).name), 'inputs': {}}
    for name in names:
        pin = pins[name]
        target = dest / pin['directory']
        if target.exists():
            shutil.rmtree(target)
        listed = from_gcs(pin, dest) if args.source == 'gcs' else from_git(pin, dest, Path(args.repo))
        summary['inputs'][name] = verify(pin, dest, listed)
        print(f'{name}: {summary["inputs"][name]["files"]} files, {summary["inputs"][name]["bytes"]} bytes verified at {target}', file=sys.stderr)
    text = json.dumps(summary, indent=2, sort_keys=True) + '\n'
    if args.receipt:
        Path(args.receipt).write_text(text)
    sys.stdout.write(text)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, subprocess.CalledProcessError) as error:
        print(f'hydrate-municipal-fanout: {error}', file=sys.stderr)
        sys.exit(1)
