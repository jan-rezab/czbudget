"""Offline completeness and native geometry regression checks."""
import contextlib
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    'project_geography', Path(__file__).resolve().parents[1] / 'scripts/fetch-czech-project-geography.py')
geo = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(geo)


class ProjectGeographyTests(unittest.TestCase):
    def archive(self, case='valid'):
        schema = {'name': 'Fixture', 'maxRecordCount': 1, 'hasM': True, 'hasZ': True,
                  'fields': [{'name': 'OID', 'type': 'esriFieldTypeOID'}]}
        meta = {'url': 'fixture', 'retrieved_at': '2026-09-09T00:00:00Z', 'sha256': 'fixture'}
        requests = []

        def query(base, params, key):
            requests.append(params)
            if 'returnIdsOnly' in params:
                return {'objectIds': [1, 1] if case == 'duplicate_ids' else [1, 2]}, meta
            if 'returnCountOnly' in params:
                return {'count': 3 if case == 'count_mismatch' else 2}, meta
            oid = int(params['objectIds'])
            feature = {'attributes': {'OID': oid, 'RECORD_ID': '00211', 'zero': 0, 'missing': None},
                       'geometry': {'paths': [[[-700000, -1000000, 350, 0]]]}}
            rows = [] if case == 'missing_row' else [feature, feature] if case == 'duplicate_row' else [feature]
            payload = {'features': rows, 'hasM': True, 'hasZ': True,
                       'spatialReference': {'wkid': 102067, 'latestWkid': 5514},
                       'exceededTransferLimit': case == 'truncated'}
            return payload, {**meta, 'retrieved_at': f'2026-09-09T00:00:0{oid}Z'}

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(geo, 'ROOT', root), patch.object(geo, 'OUT', root / 'website/data/geo'), \
                 patch.object(geo, 'fetch', return_value=(schema, meta)), patch.object(geo, 'query', side_effect=query), \
                 contextlib.redirect_stdout(io.StringIO()):
                geo.archive_layer('fixture', 'plzen-investments', {})
            manifest = json.loads((root / 'website/data/geo/plzen-investments/manifest.json').read_text())
            payloads = []
            for page in manifest['pages']:
                raw = (root / 'website' / page['path']).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(), page['sha256'])
                self.assertEqual(len(raw), page['bytes'])
                payloads.append(json.loads(gzip.decompress(raw)))
            return manifest, payloads, requests

    def test_native_geometry_identifiers_and_acquisition_range(self):
        manifest, payloads, requests = self.archive()
        self.assertEqual(manifest['feature_count'], 2)
        self.assertEqual(manifest['native_project_record_ids'], 1)
        self.assertEqual(manifest['retrieved_from'], '2026-09-09T00:00:01Z')
        self.assertEqual(manifest['retrieved_to'], '2026-09-09T00:00:02Z')
        for request in requests:
            if 'objectIds' in request:
                self.assertEqual(request['returnM'], 'true')
                self.assertEqual(request['returnZ'], 'true')
                self.assertEqual(request['returnGeometry'], 'true')
                self.assertEqual(request['outFields'], '*')
        for payload in payloads:
            self.assertEqual(payload['spatialReference'], {'wkid': 102067, 'latestWkid': 5514})
            row = payload['features'][0]
            self.assertEqual(row['geometry']['paths'][0][0], [-700000, -1000000, 350, 0])
            self.assertEqual(row['attributes']['RECORD_ID'], '00211')
            self.assertEqual(row['attributes']['zero'], 0)
            self.assertIsNone(row['attributes']['missing'])

    def test_duplicate_source_ids_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate source'):
            self.archive('duplicate_ids')

    def test_count_drift_rejected(self):
        with self.assertRaisesRegex(ValueError, 'ID/count'):
            self.archive('count_mismatch')

    def test_missing_feature_rejected(self):
        with self.assertRaisesRegex(ValueError, 'coverage mismatch'):
            self.archive('missing_row')

    def test_duplicate_feature_rejected(self):
        with self.assertRaisesRegex(ValueError, 'coverage mismatch'):
            self.archive('duplicate_row')

    def test_transfer_limit_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Truncated'):
            self.archive('truncated')


if __name__ == '__main__':
    unittest.main()
