import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest


def module():
    path = Path(__file__).resolve().parents[1] / 'scripts' / 'publish-repo-asset-packs.py'
    spec = importlib.util.spec_from_file_location('publish_repo_asset_packs', path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


publisher = module()
BASE = {'version': 1, 'bucket': publisher.BUCKET, 'release_id': 'static-assets:base',
        'packs': {'paq': {'file': 'a' * 64 + '.pack', 'key': 'static-assets/v1/' + 'a' * 64 + '.pack', 'size': 3, 'generation': '1'}},
        'files': {'/data/paq/index.json': {'pack': 'paq', 'offset': 0, 'size': 3, 'sha256': 'b' * 64}}}


class RepoAssetPacksTest(unittest.TestCase):
    def repository(self, temp, files):
        root = Path(temp) / 'repo'
        for relative, body in files.items():
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(body)
        subprocess.run(['git', 'init', '-q', str(root)], check=True)
        subprocess.run(['git', '-C', str(root), 'add', '.'], check=True)
        subprocess.run(['git', '-C', str(root), '-c', 'user.name=t', '-c', 'user.email=t@example.org',
                        'commit', '-q', '-m', 'fixture'], check=True)
        base = Path(temp) / 'base.json'
        base.write_text(json.dumps(BASE))
        return root, base

    def test_directory_and_file_packs_recover_committed_bytes(self):
        big = json.dumps({'rows': [{'value': index} for index in range(400)]}).encode()
        with tempfile.TemporaryDirectory() as temp:
            root, base = self.repository(temp, {
                'data/countries/cze/providers.v1.json': big,
                'data/countries/deu/providers.v1.json': b'{}',
                'data/registry/source-provenance/sources-001.json.gz': gzip.compress(b'{"a":1}', mtime=0),
                'data/registry/countries.v1.json': b'{"kept":true}',
                'data/municipal-snapshot.v1.json': big,
                'data/methodology-sources.v1.json': b'[1,2,3]',
            })
            directories = publisher.parse_directories('countries,registry/source-provenance')
            files = publisher.parse_file_packs('top-level-datasets=municipal-snapshot.v1.json,methodology-sources.v1.json')
            lock, packs, summary = publisher.assemble(root, directories, files, base, Path(temp) / 'out')
            self.assertEqual(set(packs), {'countries', 'registry-source-provenance', 'top-level-datasets'})
            self.assertEqual(lock['files']['/data/paq/index.json'], BASE['files']['/data/paq/index.json'])
            self.assertNotIn('/data/registry/countries.v1.json', lock['files'])
            self.assertEqual(summary['top-level-datasets']['kind'], 'files')
            self.assertEqual(set(summary['top-level-datasets']['blobs']), {'data/municipal-snapshot.v1.json', 'data/methodology-sources.v1.json'})
            for url, item in lock['files'].items():
                if item['pack'] == 'paq':
                    continue
                pack = (Path(temp) / 'out' / packs[item['pack']]['file']).read_bytes()
                body = pack[item['offset']:item['offset'] + item['size']]
                self.assertEqual(hashlib.sha256(body).hexdigest(), item['sha256'])
                committed = (root / url[1:]).read_bytes()
                if item.get('encoding') == 'gzip':
                    self.assertEqual(gzip.decompress(body), committed)
                    self.assertEqual(item['raw_size'], len(committed))
                    self.assertEqual(item['raw_sha256'], hashlib.sha256(committed).hexdigest())
                else:
                    self.assertEqual(body, committed)
            # Large text is stored compressed; an already-gzipped shard and tiny files are not.
            self.assertEqual(lock['files']['/data/municipal-snapshot.v1.json']['encoding'], 'gzip')
            self.assertNotIn('encoding', lock['files']['/data/registry/source-provenance/sources-001.json.gz'])
            self.assertNotIn('encoding', lock['files']['/data/countries/deu/providers.v1.json'])
            uncompressed, _packs, _summary = publisher.assemble(root, directories, files, base, Path(temp) / 'plain', compress=False)
            self.assertFalse(any('encoding' in item for item in uncompressed['files'].values()))

    def test_rejects_conflicts_edits_and_unsafe_names(self):
        with tempfile.TemporaryDirectory() as temp:
            root, base = self.repository(temp, {
                'data/paq/index.json': b'{}',
                'data/economy/manifest.v1.json': b'{}',
                'data/single.v1.json': b'{}',
            })
            with self.assertRaises(ValueError):  # already published by another pack
                publisher.assemble(root, [], {'extra': ['paq/index.json']}, base, Path(temp) / 'a')
            with self.assertRaises(ValueError):  # the same URL in two packs of one run
                publisher.assemble(root, ['economy'], {'extra': ['economy/manifest.v1.json']}, base, Path(temp) / 'b')
            with self.assertRaises(ValueError):  # untracked or directory names are not single files
                publisher.assemble(root, [], {'extra': ['economy']}, base, Path(temp) / 'c')
            with self.assertRaises(ValueError):
                publisher.assemble(root, [], {'extra': ['missing.v1.json']}, base, Path(temp) / 'd')
            (root / 'data/single.v1.json').write_text('{"edited":true}')
            with self.assertRaises(ValueError):  # checkout differs from the pinned commit
                publisher.assemble(root, [], {'extra': ['single.v1.json']}, base, Path(temp) / 'e')
            for bad in ['../x', 'Upper', 'a//b', '.hidden']:
                with self.assertRaises(ValueError):
                    publisher.parse_directories(bad)
            for bad in ['noequals', 'Bad=a.json', 'x=', 'x=../a.json', 'x=a.json;x=b.json', 'x=a.json,a.json', 'x=.env']:
                with self.assertRaises(ValueError):
                    publisher.parse_file_packs(bad)
            with self.assertRaises(ValueError):
                publisher.assemble(root, [], {}, base, Path(temp) / 'f')


if __name__ == '__main__':
    unittest.main()
