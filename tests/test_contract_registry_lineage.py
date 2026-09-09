import contextlib
import gzip
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('lineage', Path(__file__).resolve().parents[1] / 'scripts/build-contract-registry-lineage.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class LineageTests(unittest.TestCase):
    def write_fixture(self, out, groups):
        months = []
        for period, rows in groups.items():
            name = period + '.jsonl.gz'
            with gzip.open(out / name, 'wt') as stream:
                for row in rows:
                    stream.write(json.dumps(row) + '\n')
            months.append({'period': period, 'artifact': name, 'matched_versions': len(rows),
                'artifact_sha256': m.registry.sha256_file(out / name), 'fingerprint': period})
        m.registry.atomic_json(out / 'manifest.v1.json', {'source': {}, 'coverage': {}, 'entities': {'00075370': {'name': 'Plzeň'}}, 'semantics': 'versions are not payments', 'months': months})

    def row(self, version='11', xml='<zaznam/>'):
        return {'contract_id': '10', 'version_id': version, 'metadata_xml': xml,
            'published_at': '2026-08-01', 'valid_record_raw': '0', 'matched_icos': ['00075370']}

    def run_build(self, out):
        with contextlib.redirect_stdout(io.StringIO()):
            m.build(out)
        return json.loads((out / 'lineage.v1.json').read_text())

    def test_deduplicate_versions_keep_contract_history(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder)
            self.write_fixture(out, {'2026-07': [self.row()], '2026-08': [self.row(), self.row('12')]})
            result = self.run_build(out)
            self.assertEqual(result['counts']['unique_versions'], 2)
            self.assertEqual(result['counts']['unique_contracts'], 1)
            self.assertEqual(result['counts']['duplicate_version_rows'], 1)
            with gzip.open(out / '00075370.lineage.jsonl.gz', 'rt') as stream:
                self.assertEqual(len(json.loads(next(stream))['versions']), 2)

    def test_conflicting_same_version_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder)
            self.write_fixture(out, {'2026-07': [self.row()], '2026-08': [self.row(xml='<changed/>')]})
            with self.assertRaises(ValueError):
                self.run_build(out)

    def test_revised_month_removes_withdrawn_metadata_from_lineage(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder)
            self.write_fixture(out, {'2026-08': [self.row()]})
            self.run_build(out)
            self.write_fixture(out, {'2026-08': []})
            result = self.run_build(out)
            self.assertEqual(result['counts'].get('unique_versions', 0), 0)
            with gzip.open(out / '00075370.lineage.jsonl.gz', 'rt') as stream:
                self.assertEqual(stream.read(), '')

if __name__ == '__main__':
    unittest.main()
