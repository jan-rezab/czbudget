"""Synthetic access-boundary tests; no GCS, raw source data or publication."""
import contextlib
import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import types
import tempfile
import unittest
from unittest.mock import patch

import render_report_pdf as pdf

RID='12345678-1234-1234-1234-123456789012'
PREFIX='processing-runs/hdr-report-review/'+RID+'/'
URI='gs://'+pdf.PRIVATE+'/'+PREFIX+'validated-report-manifest.json'


def bilingual(v):return dict(en=v,cs=v)

def fixture():
    payload=dict(schema_version='1.0.0',release_id=RID,generated_at='2026-09-27T00:00:00Z',source_releases={'synthetic':'fixture'},geographies=[dict(code='CZE',name=bilingual('Czechia')),dict(code='WLD',name=bilingual('World'))],chapters=[dict(id='annex',title=bilingual('Annex'))],charts=[],coverage={})
    body=json.dumps(payload).encode()
    manifest=dict(schema_version='1.0.0',release_id=RID,bucket=pdf.PRIVATE,object=PREFIX+'reports.json',sha256=hashlib.sha256(body).hexdigest(),bytes=len(body),generation='7',publication_status='not_published',processing_status='validated',source_releases=payload['source_releases'])
    return payload,body,manifest


class Blob:
    def __init__(self,client,name,generation=None):self.client=client;self.name=name;self.requested_generation=generation;self.generation=7
    def exists(self):return self.name in self.client.objects
    def reload(self):pass
    def download_as_bytes(self,**kwargs):
        self.client.reads.append((self.name,kwargs,self.requested_generation))
        if self.requested_generation is not None and self.requested_generation!=7:raise ValueError('Generation missing')
        if kwargs.get('if_generation_match',7)!=7:raise ValueError('Wrong generation')
        return self.client.objects[self.name]
    def upload_from_string(self,body,**kwargs):
        if kwargs.get('if_generation_match')!=0:raise AssertionError('Nonimmutable write')
        self.client.writes.append(self.name);self.client.objects[self.name]=body.encode() if isinstance(body,str) else body


class GCS:
    def __init__(self,body,manifest):
        self.objects={PREFIX+'reports.json':body,PREFIX+'validated-report-manifest.json':json.dumps(manifest).encode()};self.buckets=[];self.reads=[];self.writes=[];self.name=pdf.PRIVATE
    def bucket(self,name):
        self.buckets.append(name)
        if name!=pdf.PRIVATE:raise AssertionError('Public bucket accessed in private mode')
        return self
    def blob(self,name,generation=None):return Blob(self,name,generation)


class PrivatePDFTests(unittest.TestCase):
    def test_private_render_loads_complete_pinned_country_history_and_rejects_wrong_country(self):
        payload,_,manifest=fixture()
        source=dict(source_id='synthetic',release_id='fixture',sha256='a'*64,url='https://example.org/source',table='Native series',vintage='Synthetic')
        chart=dict(id='native-history',chapter='annex',title=bilingual('Native history'),method=bilingual('Synthetic only'),denominator=bilingual('Synthetic country'),unit='index',chart_type='line',status='ready',fields=[dict(key='value',label=bilingual('Value'))],source_refs=[source],rows=[dict(country='CZE',year=2024,value=.2)],original_refs=[])
        full=dict(chart,rows=[dict(country='CZE',year=1900,value=0),dict(country='CZE',year=1901,value=None),dict(country='CZE',year=2024,value=.123456789)])
        history_body=json.dumps(full).encode();name=PREFIX+'history/native-history/CZE.json'
        chart['history_by_country']={'CZE':dict(object=f'static-assets/human-development/releases/{RID}/history/native-history/CZE.json',bytes=len(history_body),sha256=hashlib.sha256(history_body).hexdigest(),rows=3,first_period='1900',last_period='2024')}
        payload['charts']=[chart];body=json.dumps(payload).encode();manifest.update(bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
        g=GCS(body,manifest);g.objects[name]=history_body
        result,receipt=pdf.load_verified_report(g,URI)
        self.assertEqual([row['value'] for row in result['charts'][0]['rows']],[0,None,pdf.Decimal('0.123456789')]);self.assertEqual(receipt['history_reads'][0]['rows'],3)
        full['rows'][0]['country']='WLD';history_body=json.dumps(full).encode();chart['history_by_country']['CZE'].update(bytes=len(history_body),sha256=hashlib.sha256(history_body).hexdigest())
        body=json.dumps(payload).encode();manifest.update(bytes=len(body),sha256=hashlib.sha256(body).hexdigest());g=GCS(body,manifest);g.objects[name]=history_body
        with self.assertRaisesRegex(ValueError,'definition/country/count'):pdf.load_verified_report(g,URI)
    def test_private_snapshot_uses_exact_generation_without_public_bucket(self):
        payload,body,m=fixture();g=GCS(body,m)
        result,source=pdf.load_verified_report(g,URI)
        self.assertEqual(result,payload);self.assertEqual(source['mode'],'private_validated_manifest')
        self.assertEqual(g.buckets,[pdf.PRIVATE]);self.assertFalse(g.writes)
        reportread=g.reads[-1];self.assertEqual(reportread[1]['if_generation_match'],7);self.assertEqual(reportread[2],7)
    def test_wrong_hash_rejected(self):
        _,body,m=fixture();m['sha256']='b'*64
        with self.assertRaisesRegex(ValueError,'hash/size'):pdf.load_verified_report(GCS(body,m),URI)
    def test_wrong_generation_rejected(self):
        _,body,m=fixture();m['generation']='8'
        with self.assertRaisesRegex(ValueError,'Generation'):pdf.load_verified_report(GCS(body,m),URI)
    def test_public_destination_and_source_release_mismatch_rejected(self):
        _,body,m=fixture();m['bucket']=pdf.PUBLIC
        with self.assertRaises(ValueError):pdf.load_verified_report(GCS(body,m),URI)
        _,body,m=fixture();m['source_releases']={'changed':'fixture'}
        with self.assertRaisesRegex(ValueError,'source releases'):pdf.load_verified_report(GCS(body,m),URI)
    def test_real_pdf_keeps_all_86_original_objects_and_source_locators(self):
        payload,_,_=fixture()
        payload['coverage']={'original_figures':[dict(id='object-'+str(i),title='Synthetic original object',pdf_page=i+15,status='needs_definition',classification='historical',source_ids=['synthetic'],source_urls=['https://example.org/table/'+str(i)],reason='Original transformation unresolved') for i in range(86)],'unavailable_sources':[dict(source_id='synthetic',reason='Synthetic gap')]}
        with tempfile.TemporaryDirectory(prefix='hdr-pdf-test-') as folder:
            output=Path(folder)/'report.pdf'
            qa=pdf.build_pdf(payload,output)
            text='\n'.join(p.extract_text() or '' for p in pdf.PdfReader(str(output)).pages)
            for i in range(86):
                self.assertIn('object-'+str(i),text)
                self.assertIn('https://example.org/table/'+str(i),text)
            self.assertGreater(qa['page_count'],1)
            first=output.read_bytes();pdf.build_pdf(payload,output)
            self.assertEqual(first,output.read_bytes())

    def test_full_private_main_only_private_reads_and_immutable_private_outputs(self):
        _,body,m=fixture();g=GCS(body,m)
        storage=types.ModuleType('google.cloud.storage');storage.Client=lambda **kwargs:g
        cloud=types.ModuleType('google.cloud');cloud.storage=storage
        google=types.ModuleType('google');google.cloud=cloud
        def build(payload,path):path.write_bytes(b'synthetic_pdf_fixture');return dict(page_count=1,text_verified=True)
        def render(cmd,**kwargs):Path(cmd[-1]+'.png').write_bytes(b'synthetic_png_fixture')
        with patch.dict(sys.modules,{'google':google,'google.cloud':cloud,'google.cloud.storage':storage}),patch.dict('os.environ',{'BUILD_ID':RID,'DATA_SERVICE_ACCOUNT':'synthetic@fixture'}),patch.object(sys,'argv',['render_report_pdf.py','--loader-sha','synthetic','--report-manifest',URI]),patch.object(pdf,'build_pdf',side_effect=build),patch.object(pdf.subprocess,'run',side_effect=render),contextlib.redirect_stdout(io.StringIO()):pdf.main()
        self.assertTrue(g.writes);self.assertEqual(set(g.buckets),{pdf.PRIVATE})
        self.assertTrue(all(name.startswith('processing-runs/hdr-report-pdf/'+RID+'/') for name in g.writes))
        self.assertFalse(any('current.json' in name for name,_,_ in g.reads))
        receipt=json.loads(g.objects['processing-runs/hdr-report-pdf/'+RID+'/receipt.json'])
        self.assertEqual(receipt['source_report_mode'],'private_validated_manifest');self.assertEqual(receipt['source_report_generation'],'7');self.assertEqual(receipt['source_report_manifest'],URI)
        self.assertEqual(receipt['region'],'europe-west4');self.assertEqual(receipt['service_account'],'synthetic@fixture')


if __name__=='__main__':unittest.main()
