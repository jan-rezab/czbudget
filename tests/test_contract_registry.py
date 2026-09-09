import gzip
import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('registry', Path(__file__).resolve().parents[1] / 'scripts/fetch-contract-registry.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

RECORD = '''<zaznam><identifikator><idSmlouvy>10</idSmlouvy><idVerze>12</idVerze></identifikator><smlouva><subjekt><ico>75370</ico></subjekt><hodnotaBezDph>0</hodnotaBezDph><ciziMena><hodnota>0</hodnota><mena>EUR</mena></ciziMena></smlouva><prilohy><priloha><hash algoritmus="sha256">abc</hash><odkaz>https://example.org/a</odkaz></priloha></prilohy><platnyZaznam>0</platnyZaznam></zaznam>'''

def fixture(record=RECORD):
    data = f'<monthly xmlns="http://portal.gov.cz/rejstriky/ISRS/1.2/"><mesic>8</mesic><rok>2026</rok><casGenerovani>2026-09-09</casGenerovani><dokoncenyMesic>1</dokoncenyMesic>{record}</monthly>'.encode()
    entry = {'period': '2026-08', 'hash_algorithm': 'sha1', 'expected_hash': hashlib.sha1(data).hexdigest(),
        'expected_bytes': len(data), 'source_generated_at': '2026-09-09', 'completed_month': True}
    return data, entry

class RegistryTests(unittest.TestCase):
    def test_zero_invalid_currency_attachment_and_version_survive(self):
        data, entry = fixture()
        output = io.StringIO()
        stats = m.parse_dump(io.BytesIO(data), entry, output)
        row = json.loads(output.getvalue())
        self.assertEqual(row['matched_icos'], ['00075370'])
        self.assertEqual(row['source_price_fields']['hodnotaBezDph']['text'], '0')
        self.assertEqual(row['valid_record_raw'], '0')
        self.assertEqual(row['contract_id'], '10')
        self.assertEqual(row['version_id'], '12')
        self.assertIn('EUR', row['metadata_xml'])
        self.assertIn('algoritmus="sha256"', row['metadata_xml'])
        self.assertEqual(stats['matched_versions'], 1)

    def test_unmatched_and_multiple_versions_not_collapsed(self):
        record = RECORD + RECORD.replace('<idVerze>12', '<idVerze>13') + RECORD.replace('75370', '12345678')
        data, entry = fixture(record)
        output = io.StringIO()
        stats = m.parse_dump(io.BytesIO(data), entry, output)
        self.assertEqual(stats['records_scanned'], 3)
        self.assertEqual(stats['matched_versions'], 2)
        self.assertEqual(len(output.getvalue().splitlines()), 2)

    def test_hash_and_generation_mismatches_fail(self):
        data, entry = fixture()
        for override in [{'expected_hash': '0' * 40}, {'expected_bytes': 1}, {'source_generated_at': 'yesterday'}, {'completed_month': False}]:
            with self.assertRaises(ValueError):
                m.parse_dump(io.BytesIO(data), {**entry, **override}, io.StringIO())

    def test_resume_checks_generation_and_output_integrity(self):
        _, entry = fixture()
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder)
            path = out / '2026-08.jsonl.gz'
            path.write_bytes(gzip.compress(b'{}\n'))
            status = {'fingerprint': m.fingerprint(entry), 'artifact_sha256': m.sha256_file(path)}
            m.atomic_json(out / '2026-08.meta.json', status)
            self.assertIsNotNone(m.cached_month(out, entry))
            self.assertIsNone(m.cached_month(out, {**entry, 'source_generated_at': 'changed'}))
            path.write_bytes(b'corrupt')
            self.assertIsNone(m.cached_month(out, entry))

    def test_daily_exports_excluded(self):
        fields = '<mesic>8</mesic><rok>2026</rok><hashDumpu algoritmus="sha1">abc</hashDumpu><velikostDumpu>1</velikostDumpu><casGenerovani>x</casGenerovani><dokoncenyMesic>1</dokoncenyMesic><odkaz>https://data.smlouvy.gov.cz/dump_2026_08.xml</odkaz>'
        index = f'<index><dump>{fields}</dump><dump><den>1</den>{fields}</dump></index>'
        self.assertEqual(len(m.monthly_entries(index)), 1)

if __name__ == '__main__':
    unittest.main()
