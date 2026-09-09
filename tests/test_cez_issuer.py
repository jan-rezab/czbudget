import unittest,json,importlib.util
from decimal import Decimal
from pathlib import Path
from lxml import etree
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('cez',ROOT/'scripts/build-cez-issuer-2025.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class CezIssuerTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.d=json.loads((ROOT/'data/cez-issuer-2025.v1.json').read_text())
 def individual(self,label,year=2025,statement='balance_sheet'):
  rows=[f for f in self.d['individual']['facts'] if f['label_cs']==label and f['year']==year and f['statement']==statement]
  self.assertEqual(len(rows),1);return Decimal(rows[0]['value'])
 def test_distinct_scope_and_old_comparator(self):
  self.assertEqual(self.individual('AKTIVA CELKEM'),654766)
  group=[f for f in self.d['group']['numeric_facts'] if f['concept']=='ifrs:Assets' and f['context_id']=='cez2025end'];self.assertEqual(Decimal(group[0]['value_in_base_unit']),864614000000)
  card=next(e for e in json.loads((ROOT/'data/cz-state-enterprises-2024.json').read_text())['entities'] if e.get('ico')=='45274649')
  self.assertEqual(card['metrics']['total_assets'],self.individual('AKTIVA CELKEM',2024));self.assertEqual(card['metrics']['net_result'],19685)
 def test_individual_cash_reconciles(self):
  f=lambda label:self.individual(label,statement='cash_flow')
  net=sum(f(x) for x in ['Čistý peněžní tok z provozní činnosti','Čistý peněžní tok z investiční činnosti','Čistý peněžní tok z finanční činnosti','Vliv kurzových rozdílů a opravných položek na výši peněžních prostředků'])
  self.assertEqual(net,f('Čistý přírůstek / úbytek peněžních prostředků a peněžních ekvivalentů'))
  self.assertEqual(f('Peněžní prostředky a peněžní ekvivalenty na počátku období')+net,f('Peněžní prostředky a peněžní ekvivalenty ke konci období'))
 def test_native_scale_sign_and_missing(self):
  e=etree.fromstring(b'<n format="ixt:num-comma-decimal" scale="6" sign="-">1 234,5</n>');self.assertEqual(Decimal(m.esef_number(e)),Decimal('-1234500000'))
  self.assertIsNone(m.parse_number('–'))
  with self.assertRaises(ValueError):m.parse_number('not reported')
 def test_dates_and_context_lineage(self):
  self.assertEqual(self.d['statement_authorised_for_issue_at'],'2026-04-07');self.assertEqual(self.d['publication_date'],'2026-04-28');self.assertIsNone(self.d['filing_date'])
  self.assertEqual(len(self.d['group']['numeric_facts']),496);self.assertEqual(len(self.d['individual']['facts']),250)
  for f in self.d['group']['numeric_facts']:self.assertIn(f['context_id'],self.d['group']['contexts']);self.assertIn(f['unit_id'],self.d['group']['units'])
if __name__=='__main__':unittest.main()
