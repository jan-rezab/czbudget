"""Small decoder regression cases protect sparse positions and original flags."""
import importlib.util
from pathlib import Path
import unittest
import hashlib
import json
import tempfile

spec = importlib.util.spec_from_file_location('eurostat', Path(__file__).resolve().parents[1] / 'scripts/fetch-industrial-eurostat-2026.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
overlay_spec = importlib.util.spec_from_file_location('overlay', Path(__file__).resolve().parents[1] / 'scripts/assemble-industrial-federation.py')
overlay = importlib.util.module_from_spec(overlay_spec)
overlay_spec.loader.exec_module(overlay)


class DecoderTests(unittest.TestCase):
    def fixture(self):
        codes = {'time': ['2026-01', '2026-02'], 'geo': ['CZ'], 'unit': ['I21', 'PCH_SM'],
                 's_adj': ['CA'], 'nace_r2': ['C'], 'indic_bt': ['PRD'], 'freq': ['M']}
        data = dict(id=list(codes), size=[len(v) for v in codes.values()],
                    dimension={k: {'category': {'index': {x: i for i, x in enumerate(v)}, 'label': {x: x for x in v}}} for k, v in codes.items()},
                    value={'0': 0, '3': -1.5}, status={'3': 'p b'}, updated='2026-09-05')
        meta = dict(sha256='test', source_url='https://example.test', retrieved_at='2026-09-07', raw_file='/fixture')
        return data, meta

    def test_sparse_reordered_dimensions_zero_and_flags(self):
        data, meta = self.fixture()
        rows = list(module.decode(data, 'CZE', meta))
        self.assertEqual([(r['period'], r['measure'], r['value']) for r in rows], [('2026-01', 'index', 0), ('2026-02', 'yoy_pct', -1.5)])
        self.assertEqual(rows[1]['source_status'], 'p b')
        self.assertEqual(rows[1]['status'], 'provisional')
        self.assertIsNone(rows[1]['publication_at'])
        self.assertNotEqual(rows[0]['observation_id'], rows[1]['observation_id'])

    def test_empty_country_is_not_zero(self):
        data, meta = self.fixture()
        data['value'] = {}
        data['size'][1] = 0
        data['dimension']['geo']['category']['index'] = {}
        self.assertEqual(list(module.decode(data, 'USA', meta)), [])

    def test_unknown_unit_fails(self):
        data, meta = self.fixture()
        data['dimension']['unit']['category']['index'] = {'UNKNOWN': 0, 'PCH_SM': 1}
        with self.assertRaises(AssertionError):
            list(module.decode(data, 'CZE', meta))

    def test_overlay_preserves_conflicting_source_values_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for channel, value in [('national', 100), ('eurostat', 101)]:
                folder = root / channel
                folder.mkdir()
                raw = folder / 'raw.json'
                raw.write_text(json.dumps({'value': value}))
                (folder / 'manifest.json').write_text(json.dumps([dict(raw_file=str(raw), sha256=hashlib.sha256(raw.read_bytes()).hexdigest())]))
                row = dict(country='CZE', dataset='same', series_id='same', frequency='M', period='2026-01', value=value,
                           raw_file=str(raw), publisher=channel)
                (folder / 'observations.jsonl').write_text(json.dumps(row) + '\n')
                (folder / 'coverage.json').write_text('{}')
            output = root / 'output'
            overlay.assemble(root / 'national', root / 'eurostat', output)
            result = [json.loads(line) for line in (output / 'observations.jsonl').read_text().splitlines()]
            self.assertEqual([r['value'] for r in result], [100, 101])
            self.assertEqual(len({r['observation_id'] for r in result}), 2)
            self.assertTrue(all(r['mapping_status'] == 'not_assessed' for r in result))
            with self.assertRaises(ValueError):
                overlay.assemble(root / 'national', root / 'eurostat', output)


if __name__ == '__main__':
    unittest.main()
