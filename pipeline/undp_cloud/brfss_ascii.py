"""Lossless reviewed BRFSS SAS column-input decoder; no fetching or estimates.

Current2023–2025 source programs use column input, with optional `$` character
fields. They declare no implied-decimal informat. Unreviewed SAS syntax is held,
not guessed. Survey codes77/88/99 remain source codes, never generic missing.
"""
from decimal import Decimal,InvalidOperation
import re
import zipfile

NAME=r'[A-Za-z_][A-Za-z_0-9]*'
COLUMN=re.compile(r'('+NAME+r')\s+(\$?)(\d+)(?:-(\d+))?')
LABEL=re.compile(r"("+NAME+r")\s*=\s*'((?:[^']|'')*)'",re.S)


def parse_layout(text,expected_columns):
    # Anchoring to a statement line avoids INPUT words in instructional comments.
    source=re.sub(r'/\*.*?\*/','',text,flags=re.S)
    inputs=re.findall(r'^\s*INPUT\b(.*?);',source,re.M|re.I|re.S)
    labels=re.findall(r'^\s*LABEL\b(.*?);',source,re.M|re.I|re.S)
    if len(inputs)!=1 or len(labels)!=1:raise ValueError('Need one reviewed SAS INPUT and LABEL statement')
    fields=[];cursor=0
    for match in COLUMN.finditer(inputs[0]):
        if inputs[0][cursor:match.start()].strip():raise ValueError('Unreviewed SAS input grammar')
        name,character,start,end=match.groups();start=int(start);end=int(end or start)
        if start<1 or end<start:raise ValueError('Invalid native SAS column interval')
        fields.append(dict(name=name,start=start,end=end,type='character' if character else 'numeric',implied_decimal_scale=0))
        cursor=match.end()
    if inputs[0][cursor:].strip():raise ValueError('Unreviewed SAS input grammar')
    names=[f['name'] for f in fields]
    if len(names)!=expected_columns or len(names)!=len(set(names)):raise ValueError('Source field count or uniqueness mismatch')
    descriptions={};cursor=0
    for match in LABEL.finditer(labels[0]):
        if labels[0][cursor:match.start()].strip():raise ValueError('Unreviewed SAS label grammar')
        name,label=match.groups()
        if name in descriptions:raise ValueError('Duplicate native label')
        descriptions[name]=label.replace("''", "'");cursor=match.end()
    if labels[0][cursor:].strip() or set(descriptions)!=set(names):raise ValueError('Source labels do not cover every native field')
    for field in fields:field['label']=descriptions[field['name']]
    return fields


def native_numeric(raw):
    token=raw.strip()
    if not token:return None,'blank_system_missing'
    if re.fullmatch(r'\.[A-Z_]?|[A-Z_]\.',token,re.I):return None,'sas_system_missing:'+token
    # No implicit scale is introduced: native column INPUT uses explicit decimal
    # points. Labels do not supply numeric informats or recoding instructions.
    if not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?',token):raise ValueError('Invalid source numeric token')
    try:value=Decimal(token)
    except InvalidOperation:raise ValueError('Invalid source numeric token')
    if not value.is_finite():raise ValueError('Nonfinite native numeric')
    return str(value),None


def decode_record(raw,fields,expected_widths):
    ending='\r\n' if raw.endswith(b'\r\n') else '\n' if raw.endswith(b'\n') else ''
    body=raw[:-len(ending)] if ending else raw
    if len(body) not in expected_widths or len(body)<max(f['end'] for f in fields):raise ValueError('Native fixed record width mismatch')
    source=body.decode('ascii');values=[];numeric=[];missing={}
    for field in fields:
        value=source[field['start']-1:field['end']];values.append(value)
        if field['type']=='numeric':
            parsed,kind=native_numeric(value);numeric.append(parsed)
            if kind:missing[field['name']]=kind
        else:numeric.append(None)
    return dict(kind='data',columns=[f['name'] for f in fields],values=values,
        numeric_decimal_values=numeric,system_missing=missing,source_record=source,
        source_line_ending=ending,source_record_bytes=len(body))


def rows_from_archive(zip_path,layout_text,expected_rows,expected_widths,expected_columns,layout_meta):
    """Yield original(member,row_number,record); final count validated on exhaustion."""
    if not isinstance(expected_rows,int) or expected_rows<=0:raise ValueError('Exact official case count required')
    if not expected_widths or any(not isinstance(w,int) or w<=0 for w in expected_widths):raise ValueError('Reviewed source widths required')
    if not re.fullmatch('[a-f0-9]{64}',layout_meta.get('sha256','')) or not layout_meta.get('url') or not layout_meta.get('raw_uri') or not layout_meta.get('generation'):raise ValueError('Pinned immutable SAS layout provenance required')
    fields=parse_layout(layout_text,expected_columns)
    with zipfile.ZipFile(zip_path) as archive:
        members=[m for m in archive.infolist() if not m.is_dir()]
        if len(members)!=1 or members[0].filename.lower().split('.')[-1] not in {'asc','txt','dat'}:raise ValueError('Expected one native ASCII archive member')
        member=members[0]
        if member.file_size>3_000_000_000:raise ValueError('ASCII member exceeds reviewed bound')
        yield member.filename,0,dict(kind='header',columns=[f['name'] for f in fields],fields=fields,layout_source=layout_meta,expected_case_count=expected_rows,source_declared_widths=list(expected_widths),interpretation='Original SAS column-input values; no item-code recoding or implied scale')
        count=0;observed_width=None
        with archive.open(member) as stream:
            for raw in stream:
                count+=1
                if count>expected_rows:raise ValueError('Official case count exceeded')
                record=decode_record(raw,fields,expected_widths)
                if observed_width is not None and record['source_record_bytes']!=observed_width:raise ValueError('Nonuniform native record width')
                observed_width=record['source_record_bytes']
                yield member.filename,count,record
        if count!=expected_rows:raise ValueError('Official case count mismatch')
