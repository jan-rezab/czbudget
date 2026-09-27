"""Cloud-only PDF from one hash-verified public report snapshot; no BQ/ingestion."""
import argparse
from decimal import Decimal
import hashlib
from functools import partial
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import uuid
from xml.sax.saxutils import escape

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.graphics.shapes import Drawing, String
from reportlab.pdfgen.canvas import Canvas
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.charts.barcharts import HorizontalBarChart
from report_compaction import expanded_rows

PRIVATE='czbudget-janrezab-data-layers'
PUBLIC='czbudget-janrezab-public-snapshots'
POINTER='static-assets/human-development/current.json'
MAX_PDF=10*1024*1024
MAX_JSON=2*1024*1024
PALETTE=[colors.HexColor(x) for x in ['#235E91','#C05621','#2F855A','#805AD5','#B83280','#52606D']]


def en(value):
    value=value.get('en','') if isinstance(value,dict) else str(value or '')
    return value.replace('\u2011','-').replace('\u2013','-').replace('\u2014',' - ').replace('\u2212','-')

def exact(value): return '' if value is None else str(value)
def dump(value): return json.dumps(value,separators=(',',':'),ensure_ascii=False).encode()


def selected(chart):
    rows=sorted(expanded_rows(chart),key=period_order)
    if chart.get('status') not in {'ready','historical'}:return [],'Unavailable original report object'
    if any(r.get('country')=='CZE' for r in rows):return [r for r in rows if r.get('country')=='CZE'],'Czechia'
    if any(r.get('country')=='SURVEY21' for r in rows):return [r for r in rows if r.get('country')=='SURVEY21'],'Separate 21-country survey pool - Czechia was not surveyed'
    global_rows=[r for r in rows if r.get('country') in {None,'WLD','World','GLOBAL','OWID_WRL'}]
    return global_rows,'Global / source-category context; not Czechia' if global_rows else 'No Czechia or global observations; no country proxy supplied'


def xvalue(row):
    value=str(row.get('year',row.get('period','')))
    if re.fullmatch(r'\d{4}-\d{2}',value):return int(value[:4])+(int(value[5:])-1)/12
    try:return float(Decimal(value))
    except Exception:return None


def period_order(row):
    value=xvalue(row)
    return (0,value,str(row.get('label',''))) if value is not None else (1,str(row.get('period',row.get('year',''))),str(row.get('label','')))


def line_segments(rows,fields):
    """Explicit null observations end a line; no inferred missing years."""
    segments=[]
    for index,field in enumerate(fields):
        current=[]
        for row in sorted(rows,key=period_order):
            x=xvalue(row);value=row.get(field['key'])
            if x is None or value is None:
                if current:segments.append((index,current));current=[]
            else:current.append((x,float(value)))
        if current:segments.append((index,current))
    return segments


def plot(rows,fields,kind,cid):
    d=Drawing(490,225)
    if kind in {'bar','column','stacked','stacked_bar'}:
        # Category groups are split before calling; every supplied observation plotted.
        chart=HorizontalBarChart();chart.x=165;chart.y=28;chart.width=300;chart.height=180
        chart.data=[[float(r.get(f['key']) or 0) for r in rows] for f in fields]
        chart.categoryAxis.categoryNames=[en(r.get('label') or r.get('year') or r.get('period')) for r in rows]
        chart.categoryAxis.labels.fontSize=6;chart.categoryAxis.labels.maxWidth=155
        chart.valueAxis.labels.fontSize=7;chart.valueAxis.valueMin=0
        for i in range(len(fields)):chart.bars[i].fillColor=PALETTE[i%len(PALETTE)]
    else:
        chart=LinePlot();chart.x=48;chart.y=30;chart.width=410;chart.height=175
        segments=line_segments(rows,fields)
        if not segments:return None
        chart.data=[values for _,values in segments]
        chart.joinedLines=0 if 'rupp' in cid else 1
        from reportlab.graphics.widgets.markers import makeMarker
        for i,(field_index,values) in enumerate(segments):
            chart.lines[i].strokeColor=PALETTE[field_index%len(PALETTE)];chart.lines[i].strokeWidth=1
            if not chart.joinedLines or len(values)==1:
                chart.lines[i].symbol=makeMarker('FilledCircle');chart.lines[i].symbol.size=2
                chart.lines[i].symbol.fillColor=PALETTE[field_index%len(PALETTE)]
                chart.lines[i].symbol.strokeColor=PALETTE[field_index%len(PALETTE)]
        extent=sorted({x for _,values in segments for x,_ in values})
        if len(extent)==1:
            chart.xValueAxis.valueMin=extent[0]-.5;chart.xValueAxis.valueMax=extent[0]+.5
            chart.xValueAxis.valueSteps=[extent[0]]
        else:
            chart.xValueAxis.valueMin=extent[0];chart.xValueAxis.valueMax=extent[-1]
        chart.xValueAxis.labels.fontSize=7;chart.yValueAxis.labels.fontSize=7
    d.add(chart)
    d.add(String(48,218,'Verified source observations',fontName='Helvetica',fontSize=7))
    return d


def build_pdf(payload,output):
    if payload.get('schema_version')!='1.0.0':raise ValueError('Unexpected report schema')
    styles=getSampleStyleSheet();styles.add(ParagraphStyle(name='SmallSource',fontSize=7,leading=10,spaceAfter=5,wordWrap='CJK'))
    body=[]
    def para(text,style='BodyText'):
        return Paragraph(escape(en(text)).replace('\n','<br/>'),styles[style])
    def add(text,style='BodyText'):
        body.append(para(text,style))
        if not style.startswith('Heading'):body.append(Spacer(1,5))
    add('Human development and AI: verified data report','Title')
    add('Czechia, global source context and separately identified survey evidence','Heading2')
    add('Report dataset release: '+payload['release_id'])
    add('Generated verified snapshot: '+payload['generated_at'])
    source_ids=sorted({s.get('source_id','unknown') for c in payload['charts'] for s in c.get('source_refs',[])})
    add('Source editions and observation dates are stated with each panel. Complete source-release identifiers and provenance are retained in the final appendix.')
    add('Values in the tables preserve the decimal tokens serialized in the verified report JSON; no additional rounding is applied. These report numbers may have been normalized from source decimals. Full original source precision, metadata and source rows remain in the referenced source releases and available CSV exports. Plot tick labels are visual scales, not replacement observations.')
    add('Only explicitly recorded null periods are restored from lossless missing-period ranges. Missing values remain in the exact tables and break plotted lines; unknown gaps are never filled or inferred. Original row dictionaries, survey weights, valid shares and row-level source metadata are retained in the separate chart_details download and original-row CSV audit. These details are not replaced by chart percentages.')
    add('Czechia panels use only CZE observations. Global/source-category context is labelled separately. The 21-country survey pool is never a Czechia or world-population estimate. Missing source definitions and original figure recreations remain in the coverage ledger.')
    add('Downloads from verified snapshot','Heading2')
    for key,url in payload.get('downloads',{}).items():add(key+': '+str(url or 'Not available'),'SmallSource')
    body.append(PageBreak())
    ready=0;gaps=[];selected_cells=0
    for c in payload['charts']:
        rows,scope=selected(c)
        if not rows:gaps.append((c['id'],en(c['title']),c.get('status'),scope,en(c.get('method'))));continue
        fields=c['fields'];ready+=1
        add(c['title'],'Heading1');add(scope,'Heading2')
        add('Unit: '+c['unit']+' | Latest source observation: '+str(c.get('latest_period')))
        add('Method: '+en(c['method']));add('Denominator / coverage: '+en(c['denominator']))
        if c.get('row_details_download'):
            add('Original row metadata audit: '+str(payload.get('downloads',{}).get(c['row_details_download']) or 'Not available')+' | Includes original survey weighted/unweighted denominators and valid-share fields where supplied by the source.','SmallSource')
        for s in c['source_refs']:
            add('Source '+s.get('source_id','')+' | edition '+str(s['vintage'])+' | table '+str(s['table'])+' | release '+str(s['release_id'])+' | SHA256 '+s.get('sha256','')+' | '+s['url'],'SmallSource')
        if c.get('source_coverage'):add('Additional source coverage: '+json.dumps(c['source_coverage'],ensure_ascii=False,default=str),'SmallSource')
        add('Original report references: '+json.dumps(c.get('original_refs',[]),ensure_ascii=False),'SmallSource')
        for start in range(0,len(fields),6):
            fieldgroup=fields[start:start+6]
            body.append(Paragraph('Legend: '+'; '.join('<font color="'+PALETTE[i%len(PALETTE)].hexval().replace('0x','#')+'">'+escape(en(f['label']))+'</font>' for i,f in enumerate(fieldgroup)),styles['SmallSource']))
            # Bar groups bound label density, retaining every row in successive plots.
            parts=[rows[i:i+12] for i in range(0,len(rows),12)] if c['chart_type'] in {'bar','column','stacked','stacked_bar'} else [rows]
            for part in parts:
                # Missing is not zero. Sparse categories are shown in exact tables;
                # bar plots only admit records complete for every displayed field.
                complete=[r for r in part if all(r.get(f['key']) is not None for f in fieldgroup)] if len(parts)>1 or c['chart_type'] in {'bar','column','stacked','stacked_bar'} else part
                if not complete:continue
                drawing=plot(complete,fieldgroup,c['chart_type'],c['id'])
                if drawing:body.append(drawing)
        add('Exact verified report values','Heading2')
        for start in range(0,len(fields),4):
            group=fields[start:start+4]
            header=[para('Period / category','SmallSource')]+[para(f['label'],'SmallSource') for f in group]
            table=[header]
            for r in rows:
                label=str(r.get('year',r.get('period','')))+(' | '+en(r.get('label')) if r.get('label') is not None else '')
                table.append([para(label,'SmallSource')]+[para(exact(r.get(f['key'])) if r.get(f['key']) is not None else 'Missing','SmallSource') for f in group]);selected_cells+=len(group)
            t=Table(table,colWidths=[135]+[355/len(group)]*len(group),repeatRows=1,hAlign='LEFT')
            t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#E8EEF3')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.4,colors.HexColor('#A0AEC0')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F8FAFC')]),('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4)]));body.append(t)
        body.append(PageBreak())
    add('Original report coverage and gaps','Heading1')
    coverage=payload.get('coverage',{})
    add('Verified report coverage summary: '+json.dumps({k:v for k,v in coverage.items() if k not in {'original_figures','unavailable_sources'}},ensure_ascii=False,default=str),'SmallSource')
    originals=coverage.get('original_figures',[])
    if isinstance(originals,list):
        add('Original report object ledger: '+str(len(originals))+' objects','Heading2')
        for item in originals:
            add(str(item.get('id'))+' | '+en(item.get('title')),'Heading3')
            add('PDF page '+str(item.get('pdf_page'))+' | status '+str(item.get('status'))+' | '+str(item.get('classification'))+' | sources '+', '.join(str(v) for v in item.get('source_ids',[])),'SmallSource')
            add(item.get('reason',''),'SmallSource')
            for url in item.get('source_urls',[]):add(url,'SmallSource')
    for item in coverage.get('unavailable_sources',[]):
        add('Source gap '+(str(item.get('source_id'))+': '+str(item.get('reason')) if isinstance(item,dict) else str(item)),'SmallSource')
    add('Original object and missing-country ledger','Heading2')
    for cid,title,status,scope,method in gaps:
        add(cid+' | '+str(status)+' | '+title,'Heading3');add(scope+' | '+method,'SmallSource')
    body.append(PageBreak())
    add('Source provenance appendix','Heading1')
    add('Source releases and source identifiers','Heading2')
    for source,release in sorted(payload.get('source_releases',{}).items()):
        add(source+' | '+str(release),'SmallSource')
    add('All referenced source identifiers','Heading2')
    for source in source_ids:add(source,'SmallSource')
    def footer(canvas,doc):
        canvas.saveState();canvas.setFont('Helvetica',8);canvas.drawString(45,25,'Verified release '+payload['release_id']);canvas.drawRightString(A4[0]-45,25,str(doc.page));canvas.restoreState()
    SimpleDocTemplate(str(output),invariant=1,pagesize=A4,leftMargin=45,rightMargin=45,topMargin=40,bottomMargin=42,title='Human development verified data report',author='Public Spending Data').build(body,onFirstPage=footer,onLaterPages=footer,canvasmaker=partial(Canvas,invariant=1))
    if output.stat().st_size>MAX_PDF:raise ValueError('PDF exceeds10MB; no observations truncated')
    reader=PdfReader(str(output));texts=[p.extract_text() or '' for p in reader.pages]
    if not texts or payload['release_id'] not in texts[0] or 'Original report coverage and gaps' not in '\n'.join(texts):raise ValueError('PDF text/page verification failed')
    first_chart_page=next((i+1 for i,t in enumerate(texts) if 'Verified source observations' in t),None)
    return dict(first_chart_page=first_chart_page,page_count=len(reader.pages),selected_panels=ready,selected_numeric_cells=selected_cells,unavailable_or_missing_geography_panels=len(gaps),text_verified=True,pdf_bytes=output.stat().st_size)


def load_verified_report(gcs, manifest_uri=None):
    """Load one validated snapshot; private mode never opens the public bucket."""
    if manifest_uri:
        match=re.fullmatch(r'gs://'+PRIVATE+r'/processing-runs/hdr-report-review/([0-9a-f-]{36})/validated-report-manifest.json',manifest_uri)
        if not match:raise ValueError('Invalid private manifest URI')
        rid=match.group(1);uuid.UUID(rid)
        bucket=gcs.bucket(PRIVATE)
        manifest_name=manifest_uri.split('/',3)[3]
        manifest_data=bucket.blob(manifest_name).download_as_bytes(checksum='auto')
        if len(manifest_data)>128*1024:raise ValueError('Manifest size exceeds limit')
        pointer=json.loads(manifest_data)
        expected='processing-runs/hdr-report-review/'+rid+'/reports.json'
        if (pointer.get('schema_version')!='1.0.0' or pointer.get('bucket')!=PRIVATE or
            pointer.get('release_id')!=rid or pointer.get('object')!=expected or
            pointer.get('publication_status')!='not_published' or pointer.get('processing_status')!='validated'):
            raise ValueError('Private report manifest is not validated/unpublished or has wrong destination')
        generation=str(pointer.get('generation',''))
        if not generation.isdigit() or int(generation)<=0:raise ValueError('Missing exact report generation')
        blob=bucket.blob(expected,generation=int(generation))
        data=blob.download_as_bytes(checksum='auto',if_generation_match=int(generation))
        mode='private_validated_manifest'
    else:
        bucket=gcs.bucket(PUBLIC)
        pointer=json.loads(bucket.blob(POINTER).download_as_bytes(checksum='auto'))
        rid=pointer['release_id'];uuid.UUID(rid);expected=pointer['object']
        if pointer.get('bucket')!=PUBLIC or expected!='static-assets/human-development/releases/'+rid+'/reports.json':
            raise ValueError('Invalid verified public pointer destination')
        blob=bucket.blob(expected);blob.reload()
        generation=str(blob.generation)
        data=blob.download_as_bytes(checksum='auto',if_generation_match=int(generation))
        mode='public_verified_pointer'
    if (not re.fullmatch('[a-f0-9]{64}',str(pointer.get('sha256',''))) or
        len(data)>MAX_JSON or len(data)!=pointer.get('bytes') or hashlib.sha256(data).hexdigest()!=pointer['sha256']):
        raise ValueError('Report JSON hash/size mismatch')
    ordinary=json.loads(data)
    # Reuse the source publisher's complete public-report schema validation;
    # the validated data is parsed as decimals only after JSON numeric checks.
    from publish_reports import validate
    validate(ordinary)
    if ordinary['release_id']!=rid:raise ValueError('Report release mismatch')
    if not isinstance(ordinary.get('source_releases'),dict) or not ordinary['source_releases'] or not all(isinstance(k,str) and isinstance(v,str) and v for k,v in ordinary['source_releases'].items()):raise ValueError('Missing source release registry')
    if manifest_uri and ordinary.get('source_releases')!=pointer.get('source_releases'):
        raise ValueError('Manifest source releases differ from validated report')
    payload=json.loads(data,parse_float=Decimal)
    history_reads=[]
    for index,chart in enumerate(ordinary['charts']):
        descriptors=chart.get('history_by_country',{})
        code='CZE' if 'CZE' in descriptors else 'WLD' if 'WLD' in descriptors else None
        if not code:continue
        descriptor=descriptors[code]
        expected_history=f'static-assets/human-development/releases/{rid}/history/{chart["id"]}/{code}.json'
        if descriptor['object']!=expected_history:raise ValueError('History object outside exact report release')
        history_name=f'processing-runs/hdr-report-review/{rid}/history/{chart["id"]}/{code}.json' if manifest_uri else expected_history
        history_blob=bucket.blob(history_name);history_blob.reload();history_generation=int(history_blob.generation)
        history_data=bucket.blob(history_name,generation=history_generation).download_as_bytes(if_generation_match=history_generation,checksum='auto')
        if len(history_data)>MAX_JSON or len(history_data)!=descriptor['bytes'] or hashlib.sha256(history_data).hexdigest()!=descriptor['sha256']:raise ValueError('History checksum/size mismatch')
        full=json.loads(history_data)
        validate(dict(ordinary,charts=[full]))
        parent_refs={json.dumps(ref,sort_keys=True) for ref in chart['source_refs']}
        if full['id']!=chart['id'] or full['unit']!=chart['unit'] or full['fields']!=chart['fields'] or len(full['rows'])!=descriptor['rows'] or any(row.get('country')!=code for row in full['rows']) or any(json.dumps(ref,sort_keys=True) not in parent_refs for ref in full['source_refs']):raise ValueError('History definition/country/count mismatch')
        payload['charts'][index]=json.loads(history_data,parse_float=Decimal)
        history_reads.append(dict(object=history_name,generation=str(history_generation),sha256=descriptor['sha256'],bytes=len(history_data),rows=descriptor['rows'],country=code))
    pointer['history_reads']=history_reads
    return payload,dict(pointer,mode=mode,generation=generation,manifest_uri=manifest_uri)


def main():
    if not os.environ.get('BUILD_ID'):raise RuntimeError('Cloud Build only; no local source data rendering')
    parser=argparse.ArgumentParser();parser.add_argument('--loader-sha',required=True);parser.add_argument('--report-manifest');parser.add_argument('--private-only',action='store_true');args=parser.parse_args()
    if args.private_only and not args.report_manifest:raise ValueError('Private PDF rerender requires an exact validated manifest')
    from google.cloud import storage
    gcs=storage.Client(project='czbudget-janrezab');private=gcs.bucket(PRIVATE)
    prefix='processing-runs/hdr-report-pdf/'+os.environ['BUILD_ID']
    receipt_blob=private.blob(prefix+'/receipt.json')
    if receipt_blob.exists():
        receipt=json.loads(receipt_blob.download_as_bytes(checksum='auto'))
        if receipt.get('source_report_manifest')!=args.report_manifest:raise ValueError('Retry source manifest differs')
        for artifact in receipt['objects']:
            key=artifact['uri'].split('/',3)[3]
            saved=private.blob(key).download_as_bytes(checksum='auto')
            if len(saved)!=artifact['bytes'] or hashlib.sha256(saved).hexdigest()!=artifact['sha256']:raise ValueError('Retry artifact hash mismatch')
        print(dump(dict(event='immutable_pdf_retry_verified',receipt=receipt)).decode(),flush=True);return
    payload,pointer=load_verified_report(gcs,args.report_manifest)
    rid=pointer['release_id'];name=pointer['object']
    directory=Path('/tmp/hdr-report-pdf');directory.mkdir(exist_ok=True);output=directory/'report.pdf'
    qa=build_pdf(payload,output)
    pages=sorted({1,max(1,qa['page_count']//2),qa['page_count']} | ({qa['first_chart_page']} if qa.get('first_chart_page') else set()));proof=[]
    for page in pages:
        prefix=directory/('proof-'+str(page))
        subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-scale-to','1000','-singlefile','-png',str(output),str(prefix)],check=True,timeout=45)
        proof.append(prefix.with_suffix('.png'))
    prefix='processing-runs/hdr-report-pdf/'+os.environ['BUILD_ID'];objects=[]
    for path in [output,*proof]:
        body=path.read_bytes();sha=hashlib.sha256(body).hexdigest();blob=private.blob(prefix+'/'+path.name)
        if blob.exists():
            if blob.download_as_bytes(checksum='auto')!=body:raise ValueError('Immutable PDF run object differs')
        else:blob.upload_from_string(body,content_type='application/pdf' if path.suffix=='.pdf' else 'image/png',if_generation_match=0,checksum='auto')
        blob.reload()
        if hashlib.sha256(blob.download_as_bytes(checksum='auto')).hexdigest()!=sha:raise ValueError('Artifact roundtrip hash mismatch')
        objects.append(dict(uri='gs://'+PRIVATE+'/'+blob.name,generation=str(blob.generation),bytes=len(body),sha256=sha))
    receipt=dict(schema_version='1.0.0',created_at=datetime.now(timezone.utc).isoformat(),build_id=os.environ['BUILD_ID'],loader_git_sha=args.loader_sha,source_report_release_id=rid,source_report_object=name,source_report_sha256=pointer['sha256'],source_report_generation=pointer['generation'],source_report_mode=pointer['mode'],source_report_manifest=args.report_manifest,verified_history_objects=pointer.get('history_reads',[]),source_releases=payload.get('source_releases'),source_ids=sorted({s.get('source_id','') for c in payload['charts'] for s in c.get('source_refs',[])}),objects=objects,qa=qa,rendered_proof_pages=pages,visual_review_status='PNG proof created; human/agent inspection pending before user delivery',publication_status='private_immutable_artifact_only; website pointer untouched',region='europe-west4',service_account=os.environ.get('DATA_SERVICE_ACCOUNT','not_provided'))
    private.blob(prefix+'/receipt.json').upload_from_string(dump(receipt),content_type='application/json',if_generation_match=0,checksum='auto')
    print(dump(receipt).decode(),flush=True)


if __name__=='__main__':main()
