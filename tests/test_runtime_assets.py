import importlib.util
import json
import gzip
import hashlib
from pathlib import Path
import tempfile
import unittest


def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / 'scripts' / (name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


assets = module('prepare-runtime-assets')
runtime = module('stage-runtime')


class RuntimeAssetsTest(unittest.TestCase):
    def test_pack_is_deterministic_and_offsets_recover_exact_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for group in assets.PREFIXES:
                directory = root / 'data' / group
                directory.mkdir(parents=True)
                (directory / 'index.json').write_bytes(b'{"ok":true}\n')
                (directory / 'shard.json.gz').write_bytes(b'\x1f\x8b\x00\xff')
                if group == 'industry':
                    (directory / 'archive-manifest.json').write_text('[]')
            first = assets.pack(root, root / 'one')
            self.assertEqual(first, assets.pack(root, root / 'two'))
            for url, item in first['files'].items():
                packed = (root / 'one' / first['packs'][item['pack']]['file']).read_bytes()
                self.assertEqual(packed[item['offset']:item['offset'] + item['size']], (root / url[1:]).read_bytes())
            (root / 'data/isred/unsafe').symlink_to(root / 'data/isred/index.json')
            with self.assertRaises(ValueError):
                assets.pack(root, root / 'bad')

    def test_industry_json_alias_uses_only_verified_compressed_representation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for group in assets.PREFIXES:
                directory = root / 'data' / group
                directory.mkdir(parents=True)
                (directory / 'index.json').write_text('{}')
            raw = b'{"values":[1,2,3]}\n'
            compressed = gzip.compress(raw, mtime=0)
            industry = root / 'data/industry'
            (industry / 'CZE.json').write_bytes(raw)
            (industry / 'CZE.json.gz').write_bytes(compressed)
            (industry / 'archive-manifest.json').write_text(json.dumps([{'file': 'CZE.json', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}]))
            lock = assets.pack(root, root / 'packed')
            alias = lock['files']['/data/industry/CZE.json']
            stored = lock['files']['/data/industry/CZE.json.gz']
            self.assertEqual(alias['offset'], stored['offset'])
            self.assertEqual(alias['size'], len(compressed))
            self.assertEqual(alias['raw_size'], len(raw))
            self.assertEqual(alias['raw_sha256'], hashlib.sha256(raw).hexdigest())

    def test_cloud_verification_rejects_wrong_or_encoded_objects(self):
        descriptor = {'size': 7, 'md5': 'expected', 'crc32c': 'expected-crc', 'key': 'object'}
        valid = {'size': '7', 'md5Hash': 'expected', 'crc32c': 'expected-crc', 'generation': '123'}
        self.assertEqual(assets.verify_remote(descriptor, valid), '123')
        composite = {key: value for key, value in valid.items() if key != 'md5Hash'}
        self.assertEqual(assets.verify_remote(descriptor, composite), '123')
        for change in [{'size': '8'}, {'md5Hash': 'other'}, {'crc32c': 'wrong'}, {'contentEncoding': 'gzip'}, {'generation': None}]:
            with self.assertRaises(ValueError):
                assets.verify_remote(descriptor, {**valid, **change})

    def test_runtime_surface_excludes_build_and_offloaded_files(self):
        for value in ['data/isred/a.json', 'data/industrial-intelligence/index.json', 'data/.query.json', '.public-serving-build/current.json', 'scripts/tool.js', 'pipeline/raw.csv', 'tests/a.js', 'data/entities/00000001.json', 'cz/municipalities/praha/index.html', 'municipalities/finland/example/index.html', 'data/example 2.json']:
            self.assertFalse(runtime.included(Path(value)), value)
        for value in ['data/registry/countries.v1.json', 'data/municipal-benchmarks/fin.json', 'municipalities/france/profile/index.html', 'cityvizor/index.html', 'lib/money-flow-model.mjs', 'process/log/index.html', 'studio/data-in-one-place/index.html', 'global-nav.js']:
            self.assertTrue(runtime.included(Path(value)), value)

    def test_staged_image_has_only_runtime_files_and_pinned_locks(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for relative in ['index.html', 'server/index.mjs', 'server/start.sh', 'nginx.conf.template', 'Dockerfile.slim', 'data/cityvizor-current.v1.json', '.public-serving-build/current.json', 'data/isred/large.json', '.cityvizor-serving/large.json', 'data/compact.json', 'process/log/index.html']:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('{}')
            lock = root / 'lock.json'; lock.write_text('{}')
            inventory = runtime.stage(root, root / '.runtime-image', lock)
            self.assertIn('public/data/compact.json', inventory)
            self.assertIn('public/process/log/index.html', inventory)
            self.assertIn('server/municipal-pointer.json', inventory)
            self.assertNotIn('public/data/isred/large.json', inventory)
            self.assertNotIn('public/.cityvizor-serving/large.json', inventory)


if __name__ == '__main__':
    unittest.main()
