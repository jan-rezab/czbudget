"""PDF restores explicit missing source periods and never bridges them."""
from decimal import Decimal
from pathlib import Path
import tempfile
import unittest
import render_report_pdf as pdf
from test_render_report_pdf import fixture,bilingual


def chart():
    return dict(id='synthetic-cze-source-gap',status='ready',chapter='annex',title=bilingual('Synthetic source gaps'),unit='source units',chart_type='line',latest_period='2025',fields=[dict(key='value',label=bilingual('Value'))],rows=[dict(country='WLD',period='2024',value=99),dict(country='CZE',period='2025',value=Decimal('1.23456789')),dict(country='CZE',period='2021',value=Decimal('0.12345678'))],missing_periods_by_country={'CZE':[dict(start=2022,end=2023)]},source_refs=[dict(source_id='synthetic',url='https://example.org/exact-source',vintage='fixture',table='fixture',release_id='fixture',sha256='a'*64)],method=bilingual('Synthetic native source'),denominator=bilingual('Exact fixture denominator'),original_refs=['synthetic'])

class Tests(unittest.TestCase):
    def test_restores_only_known_country_nulls_and_sorts_source_periods(self):
        rows,scope=pdf.selected(chart())
        self.assertEqual(scope,'Czechia')
        self.assertEqual([r['period'] for r in rows],['2021','2022','2023','2025'])
        self.assertNotIn('2024',[r['period'] for r in rows])
        self.assertTrue(all(r['country']=='CZE' for r in rows))
        self.assertIsNone(rows[1]['value'])
        self.assertEqual(rows[-1]['value'],Decimal('1.23456789'))
    def test_lines_break_at_explicit_nulls_without_changing_legend_colors(self):
        c=chart();rows,_=pdf.selected(c)
        self.assertEqual(pdf.line_segments(rows,c['fields']),[(0,[(2021.0,0.12345678)]),(0,[(2025.0,1.23456789)])])
        drawing=pdf.plot(rows,c['fields'],'line',c['id']);native=drawing.contents[0]
        self.assertEqual(len(native.data),2)
        self.assertEqual(native.lines[0].strokeColor,native.lines[1].strokeColor)
        self.assertIsNotNone(native.lines[0].symbol)
        self.assertEqual(native.lines[0].symbol.fillColor,native.lines[0].strokeColor)
    def test_real_pdf_tables_include_missing_years_and_exact_native_values(self):
        payload,_,_=fixture();payload['charts']=[chart()]
        payload['downloads']={'chart_details':'gs://synthetic-private/chart-details.json'}
        payload['charts'][0]['row_details_download']='chart_details'
        with tempfile.TemporaryDirectory(prefix='hdr-pdf-missing-test-') as folder:
            output=Path(folder)/'report.pdf';pdf.build_pdf(payload,output)
            text='\n'.join(page.extract_text() or '' for page in pdf.PdfReader(str(output)).pages)
            self.assertIn('2022\nMissing',text)
            self.assertIn('2023\nMissing',text)
            self.assertIn('1.23456789',text)
            self.assertIn('Exact fixture denominator',text)
            self.assertIn('gs://synthetic-private/chart-details.json',text)

if __name__=='__main__':unittest.main()
