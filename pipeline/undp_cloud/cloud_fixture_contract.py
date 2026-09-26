"""Tiny runtime fixtures protect survey nonresponse and native source decimals."""
from pathlib import Path
import tempfile,json
import pandas as pd
import pyreadstat
from report_sources import records,dump
with tempfile.TemporaryDirectory() as d:
 root=Path(d);path=root/'fixture.sav'
 pyreadstat.write_sav(pd.DataFrame({'answer':[1.,99.,None],'weight':[0.1,0.2,0.3]}),str(path),
  variable_value_labels={'answer':{99.:'Refusal'}},missing_ranges={'answer':[99.]})
 rows=list(records(path,'sav',root));meta=rows[0][2];values=[r[2] for r in rows[1:]]
 assert values[1]['answer']==99.,'User-defined nonresponse code was lost'
 assert values[2]['answer'] is None,'System missing must remain separate'
 assert meta['missing_ranges']['answer'],'Nonresponse ranges must stay attached'
 assert meta['value_labels']['answer'][99.]=='Refusal'
 path=root/'exact.csv';path.write_text('metric,value\nshare,0.12345678901234567890123456789\n')
 assert list(records(path,'csv',root))[1][2]['values'][1]=='0.12345678901234567890123456789'
 assert json.loads(dump({'nan':float('nan')}))['nan']['source_ieee_special']=='nan'
 print('cloud fixture contracts passed: native decimals, SAV user/system missing, labels and IEEE specials')
