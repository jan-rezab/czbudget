"""Extract native MV grant workbooks, retaining historical layouts and source rows.

Requires openpyxl and xlrd==2.0.2. Reads archive members without extracting or
executing bundled calculators. Uses cached Excel values; never recomputes formulas.
"""
import gzip
import hashlib
import io
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
import xlrd
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT.parent / 'data/sources/mv/prispevek-2006-2025.zip'
URL = 'https://mv.gov.cz/documents/prispevek-na-vykon-statni-spravy---archiv-2006-2025?disposition=attachment'

def sheets(content, suffix):
    if suffix == '.xls':
        try:
            book = xlrd.open_workbook(file_contents=content)
        except xlrd.XLRDError as error:
            if 'encrypted' not in str(error):
                raise
            import msoffcrypto
            office = msoffcrypto.OfficeFile(io.BytesIO(content))
            office.load_key(password='VelvetSweatshop')  # Excel default write-protection key.
            decoded = io.BytesIO()
            office.decrypt(decoded)
            book = xlrd.open_workbook(file_contents=decoded.getvalue())
        return [(s.name, [s.row_values(i) for i in range(s.nrows)]) for s in book.sheets()]
    book = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    return [(s.title, [list(r) for r in s.values]) for s in book]

def main():
    target = ROOT / 'data/mv-administration-grants'
    target.mkdir(exist_ok=True)
    years = []
    with zipfile.ZipFile(ARCHIVE) as archive:
        inventory = [{'path': i.filename, 'bytes': i.file_size} for i in archive.infolist() if not i.is_dir()]
        for year in range(2006, 2026):
            files = [n for n in archive.namelist() if n.startswith(f'{year}/') and
                ('Rozpis příspěvku' in n or 'Příspěvek na výkon' in n) and n.endswith(('.xls', '.xlsx'))]
            assert files, f'No grant workbook for {year}'
            tables = []
            for name in files:
                content = archive.read(name)
                for title, rows in sheets(content, Path(name).suffix):
                    header_row = next((i for i, r in enumerate(rows[:20]) if r and
                        str(r[0] or '').strip().lower() in ('obec', 'název obce')), None)
                    tables.append({'file': name, 'file_sha256': hashlib.sha256(content).hexdigest(),
                        'sheet': title, 'header_row': header_row + 1 if header_row is not None else None,
                        'rows': rows})
            data = {'year': year, 'stage': 'allocated_contribution', 'tables': tables,
                'method': 'Native cells with one-based source row positions. Historical identifiers/layouts retained. No name-only entity joins or cross-year component sums.'}
            filename = f'{year}.json.gz'
            with gzip.open(target / filename, 'wt', encoding='utf-8') as stream:
                json.dump(data, stream, ensure_ascii=False, default=str)
            years.append({'year': year, 'artifact': f'data/mv-administration-grants/{filename}',
                'files': files, 'sheets': len(tables), 'source_rows': sum(len(t['rows']) for t in tables)})
    output = {'schema_version': '1.0.0', 'generated_at': datetime.now(timezone.utc).isoformat(),
        'source': {'provider': 'Ministerstvo vnitra ČR', 'title': 'Příspěvek na výkon státní správy, archive 2006–2025',
            'url': URL, 'landing_url': 'https://mv.gov.cz/prispevek-na-vykon-statni-spravy-3',
            'retrieved_at': '2026-09-09', 'sha256': hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()},
        'scope': 'Partial contribution for delegated state administration; not full administrative cost or all transfers.',
        'years': years, 'archive_inventory': inventory,
        'limitations': 'Native historical tables are available for discovery/download. Harmonized municipality allocations and historic classification joins require year-specific mappings. Formulas are represented by cached values.'}
    (ROOT / 'data/mv-administration-grants.v1.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(f'MV: {len(years)} years; {sum(y["source_rows"] for y in years)} source rows')

if __name__ == '__main__':
    main()
