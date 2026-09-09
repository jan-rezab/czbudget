import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

PIPELINE = Path(__file__).resolve().parents[1]

class InFlightManifestTests(unittest.TestCase):
    def check(self, unfinished, declared):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp) / 'pipeline'
            directory.mkdir()
            for name in ('create-source-manifest.mjs', 'raw-cache-inventory.mjs'):
                shutil.copyfile(PIPELINE / name, directory / name)
            asset = {'path': 'data/source_cache/test/2024/**'}
            if unfinished: asset['in_flight_since'] = '2026-09-09T13:54:36.861Z'
            manifest = {'schema_version': '2.0.0', 'algorithm': 'sha256', 'assets': [asset], 'total_bytes': 0, 'asset_count': 1, 'entry_count': 1, 'in_flight': []}
            if declared: manifest['in_flight'] = [{'path': asset['path'], 'since': asset.get('in_flight_since')}]
            (directory / 'source-assets.manifest.json').write_text(json.dumps(manifest))
            return subprocess.run(['node', str(directory / 'create-source-manifest.mjs'), '--self-check'], capture_output=True, text=True)

    def test_explicit_matching_unfinished_tree_is_accepted(self):
        result = self.check(True, True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_undeclared_unfinished_tree_is_rejected(self):
        self.assertNotEqual(self.check(True, False).returncode, 0)

    def test_finished_tree_still_requires_checksums(self):
        self.assertNotEqual(self.check(False, False).returncode, 0)
