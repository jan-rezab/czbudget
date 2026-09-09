import unittest,importlib.util,sys,zipfile,io,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def module(name):
 s=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
class MonitorTests(unittest.TestCase):
 def setUp(self):self.m=module('build-monitor-2026')
 def test_native_partner_and_negative(self):
  self.assertEqual(self.m.partner_type('111'),'domestic_nonbusiness_person_aggregate');self.assertEqual(self.m.partner_type('CZ'),'source_native_other');self.assertEqual(self.m.partner_type('00006947'),'ico');self.assertEqual(self.m.amount('583.81-'),self.m.Decimal('-583.81'))
 def test_reordered_technical_columns(self):
  r={'ZC_VYKAZ':'063','0FISCPER':'2026006','ZC_ICO':'00006947','ZCMMT_ITM':'5331','0FUNC_AREA':'3111','ZC_PARTNF':'111','ZU_ROZSCH':'0','ZU_ROZPZM':'2','ZU_ROZKZ':'1-'}
  keys=list(reversed(r));out,_=self.m.convert(keys,[r[k] for k in keys],'2026006');self.assertEqual(out['actual_ytd_czk'],-1);self.assertEqual(out['partner_id'],'111')
  with self.assertRaises(ValueError):self.m.convert(keys,[r[k] for k in keys],'2026005')
  r['ZU_ROZKZ']=''
  with self.assertRaises(ValueError):self.m.convert(keys,[r[k] for k in keys],'2026006')
 def test_fixture_has_distinct_stage(self):
  d=json.loads((ROOT/'data/czech-budget.v1.json').read_text());self.assertIsNone(d['proposal_year']);self.assertEqual(d['approved_budget_year'],2026);self.assertEqual(d['actual_through'],2025)
class WorkbookTests(unittest.TestCase):
 def test_source_2026_and_proposal_2027(self):
  m=module('build-czech-mf-detail')
  from openpyxl import load_workbook
  with zipfile.ZipFile(m.ARCHIVE) as z:
   name=next(n for n in z.namelist() if n.startswith('F_01_') and n.endswith('.xlsx'));rows=m.budget_series(load_workbook(io.BytesIO(z.read(name)),data_only=True,read_only=True))
  r=next(r for r in rows if r['year']==2026);self.assertEqual(r['expense']-r['revenue'],310_000_000_000);self.assertEqual(r['wages'],196_981_378_053);self.assertEqual(rows[-1]['stage'],'proposal')
  self.assertEqual(rows[-1]['year'],2027)
 def test_consolidated_identity(self):
  d=json.loads((ROOT/'data/czech-consolidated-accounts.v1.json').read_text());a={r['year']:r['value_m_czk'] for r in d['history'] if r['code']=='AKTIVA' and r['measure']=='Netto'};p={r['year']:r['value_m_czk'] for r in d['history'] if r['code']=='PASIVA'}
  self.assertEqual(len(a),9)
  for y in a:self.assertAlmostEqual(a[y],p[y],places=2)

class GrantsTests(unittest.TestCase):
 def test_isred_preserves_duplicate_recipient_ico_and_exports(self):
  import tempfile,gzip
  m=module('build-isred-grants')
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp)/'rows.csv.gz'
   with gzip.open(p,'wt') as f:f.write('iriPrijemce,ico,datumExportu\na,00006947,2026-02-21\nb,00006947,2026-02-21\n')
   self.assertEqual(m.inspect(p,'iriPrijemce')['rows'],2)
   self.assertEqual(m.inspect(p,'iriPrijemce')['export_dates'],['2026-02-21'])
   with gzip.open(p,'wt') as f:f.write('iriPrijemce,ico\n,00006947\n')
   with self.assertRaises(ValueError):m.inspect(p,'iriPrijemce')
 def test_operations_not_assumed_unique_and_paid_stages_distinct(self):
  d=json.loads((ROOT/'data/czech-dotaceeu-operations.v1.json').read_text())
  self.assertGreater(d['row_count'],d['unique_project_count']);self.assertEqual(len(d['source_columns']),48)
  self.assertIn('not_cash_paid',d['financial_stages']['31-34'])
  d=json.loads((ROOT/'data/czech-monitor-grants.v1.json').read_text())
  self.assertEqual(sum(d['month_counts'].values()),d['row_count']);self.assertEqual(d['stage'],'paid')

class EntityValidityTests(unittest.TestCase):
 def test_open_and_expired_dates(self):
  from datetime import date
  spec=importlib.util.spec_from_file_location('registry',ROOT/'pipeline/transforms/prepare_public_entity_registry.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  self.assertEqual(m.validity_status('2020-01-01','',date(2026,9,9)),'valid_at_extraction')
  self.assertEqual(m.validity_status('','',date(2026,9,9)),'validity_not_reported')
  self.assertEqual(m.validity_status('2020-01-01','2025-12-31',date(2026,9,9)),'inactive')
  self.assertEqual(m.validity_status('2027-01-01','9999-12-31',date(2026,9,9)),'not_yet_valid')

class TaxExtractionTests(unittest.TestCase):
 def setUp(self):
  spec=importlib.util.spec_from_file_location('tax',ROOT.parent/'scripts/prepare_czech_budget_tax_detail.py');self.m=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.m)
 def test_missing_is_not_zero(self):
  with self.assertRaises(ValueError):self.m.first_reported_amount('Majetkové daně',('Majetkové daně',))
  self.assertEqual(self.m.first_reported_amount('Majetkové daně   0   0',('Majetkové daně',)),0)
  for value in [None,'',float('nan')]:
   with self.assertRaises(ValueError):self.m.required_numeric(value,'2026 tax')
  self.assertEqual(self.m.required_numeric(0,'2026 tax'),0)
 def test_negative_source_value_preserved(self):
  self.assertEqual(self.m.first_reported_amount('Majetkové daně   -55 071,93',('Majetkové daně',)),-.05507193)

class Employment2025Tests(unittest.TestCase):
 def test_actual_scope_and_comparator(self):
  d=json.loads((ROOT/'data/cz-public-employment.v1.json').read_text())
  scopes=d['employment_explorer']['scopes'];s=next(x for x in scopes if x['id']=='state_regulated')
  self.assertEqual(s['year'],2025);self.assertEqual(s['root']['value'],490977);self.assertEqual(s['root']['unit'],'average_FTE')
  self.assertEqual(s['root']['details']['previous_value'],487078)
  self.assertEqual(next(x for x in scopes if x['id']=='public_sector')['year'],2024)

class MonthlyStageTests(unittest.TestCase):
 def test_future_months_are_null(self):
  d=json.loads((ROOT/'data/czech-mf-monthly-2026.v1.json').read_text())
  for row in d['rows']:
   if row['month']>d['latest_actual_month']:self.assertIsNone(row['revenue_ytd_bn_czk']);self.assertEqual(row['stage'],'not_yet_published')
   else:self.assertAlmostEqual(row['revenue_ytd_bn_czk']-row['expenditure_ytd_bn_czk'],row['balance_ytd_bn_czk'],places=1)

class HistoricalIncomeTests(unittest.TestCase):
 def test_reconciled_and_unresolved_vintages_are_distinct(self):
  d=json.loads((ROOT/'data/czech-budget.v1.json').read_text());controls=d['historical_income_source_controls']
  self.assertFalse([r for r in controls if r['status']=='source_vintage_requires_review'])
  for r in controls:
   self.assertAlmostEqual(r['taxes_bn']+r['compulsory_insurance_bn']+r['other_income_bn'],r['source_revenue_total_bn'],places=7)
   if r['status'].startswith('reconciled_'):
    published=next(row for row in d['rows'] if row[0]==r['year']);self.assertAlmostEqual(published[1],r['taxes_bn'],places=2)
 def test_english_comma_groups_do_not_become_tiny_czech_values(self):
  spec=importlib.util.spec_from_file_location('tax',ROOT.parent/'scripts/prepare_czech_budget_tax_detail.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  with self.assertRaises(ValueError):m.first_reported_amount('Tax total 699,665,054   754,080,652',('Tax total',))

class ProvenanceTests(unittest.TestCase):
 def test_legal_fiscal_year_does_not_assert_effective_version(self):
  d=json.loads((ROOT/'data/accountability/cze-regions.v1.json').read_text())
  self.assertEqual(d['valid_for_fiscal_year'],2025)
  self.assertEqual(d['legal_version_policy']['effective_version_coverage'],'unverified_for_full_fiscal_year')
  laws=[s for s in d['sources'] if s['source_type']=='legal_basis']
  self.assertEqual(len(laws),6)
  for s in laws:
   self.assertIn('e-sbirka.gov.cz',s['url']);self.assertIsNone(s['effective_from']);self.assertNotEqual(s['publisher'],s['enacting_institution'])
 def test_ares_update_is_not_retrieval_or_historical_validity(self):
  d=json.loads((ROOT/'data/municipal-snapshot.v1.json').read_text())
  for row in d['municipalities']:
   p=row['identity_provenance'];self.assertIsNone(p['retrieved_at']);self.assertIsNone(p['valid_from']);self.assertEqual(p['historical_validity'],'unverified_for_fiscal_2025')
 def test_shards_preserve_logical_rows_and_digest(self):
  import tempfile,gzip,hashlib
  m=module('build-monitor-2026');lines=b'{}\n{}\n{}\n'
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp)
   with gzip.open(p/'unit-facts.ndjson.gz','wb') as f:f.write(lines)
   result=m.shard_facts(p,3,chunk_rows=2)
   self.assertEqual([x['rows'] for x in result['shards']],[2,1]);self.assertEqual(result['logical_ndjson_sha256'],hashlib.sha256(lines).hexdigest())
   self.assertEqual(b''.join(gzip.decompress((p/Path(x['path']).name).read_bytes()) for x in result['shards']),lines)
   with self.assertRaises(ValueError):m.shard_facts(p,4,chunk_rows=2)

if __name__=='__main__':unittest.main()
