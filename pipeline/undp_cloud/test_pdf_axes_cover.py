import tempfile,unittest
from pathlib import Path
import render_report_pdf as pdf
from test_render_report_pdf import fixture,bilingual
from test_pdf_missing_ranges import chart

class Tests(unittest.TestCase):
    def test_single_year_axis_uses_native_extent_and_only_native_year_tick(self):
        c=chart();rows=[dict(country='CZE',year=2023,value=1)]
        native=pdf.plot(rows,c['fields'],'line',c['id']).contents[0]
        self.assertEqual(native.data,[[(2023.0,1.0)]])
        self.assertEqual(native.xValueAxis.valueMin,2022.5)
        self.assertEqual(native.xValueAxis.valueMax,2023.5)
        self.assertEqual(native.xValueAxis.valueSteps,[2023.0])
    def test_multiple_year_extent_preserves_data_without_inventing_points(self):
        c=chart();rows=[dict(year=2021,value=1),dict(year=2024,value=2)]
        native=pdf.plot(rows,c['fields'],'line',c['id']).contents[0]
        self.assertEqual(native.xValueAxis.valueMin,2021)
        self.assertEqual(native.xValueAxis.valueMax,2024)
        self.assertEqual(native.data,[[(2021.0,1.0),(2024.0,2.0)]])
    def test_large_source_registry_moves_to_appendix_and_chart_page_is_identified(self):
        payload,_,_=fixture();payload['charts']=[chart()]
        payload['source_releases']={f'source-identifier-{i:03}':f'exact-release-{i:03}' for i in range(216)}
        with tempfile.TemporaryDirectory(prefix='hdr-pdf-cover-') as folder:
            output=Path(folder)/'report.pdf';qa=pdf.build_pdf(payload,output)
            texts=[p.extract_text() or '' for p in pdf.PdfReader(str(output)).pages]
            self.assertNotIn('source-identifier-000',texts[0])
            self.assertIn(payload['generated_at'],texts[0])
            self.assertIn('Source provenance appendix','\n'.join(texts))
            for source,release in payload['source_releases'].items():
                self.assertIn(source,'\n'.join(texts));self.assertIn(release,'\n'.join(texts))
            self.assertIn('Verified source observations',texts[qa['first_chart_page']-1])

if __name__=='__main__':unittest.main()
