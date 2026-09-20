#!/usr/bin/env python3
"""Assemble the explicit runtime surface after validation, outside the source context."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil

DIRECTORIES = {'assets', 'cityvizor', 'cz', 'data', 'deep-dives', 'lib', 'municipalities', 'process', 'studio'}
OFFLOADED = {'isred', 'industrial-intelligence', 'czech-nku', 'contracts', 'czech-project-geography', 'industry'}
ROOT_EXTENSIONS = {'.html', '.js', '.css', '.svg', '.png', '.ico', '.xml', '.txt'}


def included(relative):
    parts = relative.parts
    if any(p.startswith('.') or re.search(r' \d{1,2}(?:\.|$)', p) for p in parts):
        return False
    name = relative.as_posix()
    if len(parts) == 1:
        return relative.suffix in ROOT_EXTENSIONS and name != 'brand-preview.html'
    if parts[0] not in DIRECTORIES:
        return False
    if parts[0] == 'data' and parts[1] in OFFLOADED:
        return False
    if re.fullmatch(r'data/(municipal-expansion|municipal-benchmarks)/[^/]+/[^/]+\.json', name):
        return False
    if re.fullmatch(r'data/(entities|municipal-history)/\d{8}\.json', name):
        return False
    if re.fullmatch(r'(municipalities/[^/]+/[^/]+|cz/municipalities/[^/]+)/index.html', name):
        return name in {'municipalities/france/profile/index.html', 'municipalities/germany/profile/index.html'}
    return True


def stage(root, output, lock=None):
    if output.exists():
        raise ValueError('Runtime staging must start in a new directory')
    output.mkdir(parents=True)
    inventory = {}

    def copy(source, target):
        if source.is_symlink():
            raise ValueError('Runtime symlink is not allowed: ' + str(source))
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(source, target)
        except OSError:
            shutil.copyfile(source, target)
        inventory[target.relative_to(output).as_posix()] = source.stat().st_size

    def walk(folder):
        for item in sorted(folder.iterdir()):
            relative = item.relative_to(root)
            if not included(relative):
                # Root directory names are classified independently of root file suffixes.
                if folder == root and item.name in DIRECTORIES and item.is_dir() and not item.is_symlink():
                    walk(item)
                continue
            if item.is_symlink():
                raise ValueError('Runtime symlink is not allowed: ' + str(item))
            if item.is_dir():
                walk(item)
            else:
                copy(item, output / 'public' / relative)
    walk(root)
    for source in (root / 'server').rglob('*'):
        if source.is_symlink():
            raise ValueError('Server symlink is not allowed')
        if source.is_file():
            copy(source, output / source.relative_to(root))
    if lock is not None:
        copy(lock, output / 'server/data-assets-lock.json')
    copy(root / 'nginx.conf.template', output / 'nginx.conf.template')
    copy(root / 'Dockerfile.slim', output / 'Dockerfile')
    total = sum(inventory.values())
    if total > 768 * 1024 * 1024:
        raise ValueError('Runtime context exceeds 768 MiB budget: ' + str(total))
    (output / 'inventory.json').write_text(json.dumps(inventory, sort_keys=True))
    print(json.dumps({'runtime_files': len(inventory), 'runtime_bytes': total}), flush=True)
    return inventory


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--lock', type=Path)
    args = parser.parse_args()
    stage(args.root.resolve(), args.output.resolve(), args.lock.resolve() if args.lock else None)
