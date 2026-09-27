import io,zipfile,unittest
from brfss_ascii import parse_layout,decode_record,rows_from_archive,native_numeric

SAS="""/* Source column syntax taken from reviewed2024 program; reduced fixture. */
INPUT
_STATE 1-2
SEQNO $36-45
_PSU 36-45
MENTHLTH 104-105
_LLCPWT 1749-1758
;
LABEL
_STATE = 'State FIPS'
SEQNO = 'Sequence'
_PSU = 'Primary sampling unit'
MENTHLTH = 'Mental health days'
_LLCPWT = 'Final weight'
;
"""
META=dict(url='https://www.cdc.gov/brfss/annual_data/2024/files/SASOUT24_LLCP.zip',sha256='a'*64,raw_uri='gs://synthetic/layout.zip',generation='7')
def row():
    data=bytearray(b' '*2061)
    for start,value in [(1,b'01'),(36,b'0000000123'),(104,b'88'),(1749,b' 123.45678')]:data[start-1:start-1+len(value)]=value
    return bytes(data)+b'\r\n'
def archive(rows):
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w') as z:z.writestr('LLCP2024.ASC',b''.join(rows))
    output.seek(0);return output
class Tests(unittest.TestCase):
    def test_actual_column_aliases_padding_and_explicit_decimal_weight_preserved(self):
        fields=parse_layout(SAS,5);result=decode_record(row(),fields,[2061,2111])
        self.assertEqual(result['values'],['01','0000000123','0000000123','88',' 123.45678'])
        self.assertEqual(result['numeric_decimal_values'],['1',None,'123','88','123.45678'])
        self.assertEqual(result['source_record'].encode()+result['source_line_ending'].encode(),row())
        self.assertEqual(result['source_record_bytes'],2061)
        self.assertTrue(all(f['implied_decimal_scale']==0 for f in fields))
    def test_native_system_missing_is_distinct_from_survey_missing_codes(self):
        self.assertEqual(native_numeric('  '),(None,'blank_system_missing'))
        self.assertEqual(native_numeric('.A'),(None,'sas_system_missing:.A'))
        self.assertEqual(native_numeric('77'),('77',None))
        self.assertEqual(native_numeric('99'),('99',None))
    def test_unknown_informat_and_duplicate_names_hold_source(self):
        with self.assertRaisesRegex(ValueError,'grammar'):parse_layout(SAS.replace('_STATE 1-2','_STATE @1 2.2'),5)
        with self.assertRaisesRegex(ValueError,'uniqueness'):parse_layout(SAS.replace('_PSU 36-45','SEQNO 36-45'),5)
        with self.assertRaisesRegex(ValueError,'width'):decode_record(row()[:2000],parse_layout(SAS,5),[2061])
    def test_archive_exact_case_count_and_pinned_layout_are_required(self):
        records=list(rows_from_archive(archive([row(),row()]),SAS,2,[2061],5,META))
        self.assertEqual(len(records),3);self.assertEqual(records[0][2]['fields'][2]['name'],'_PSU')
        with self.assertRaisesRegex(ValueError,'case count'):list(rows_from_archive(archive([row()]),SAS,2,[2061],5,META))
        with self.assertRaisesRegex(ValueError,'provenance'):list(rows_from_archive(archive([row()]),SAS,1,[2061],5,dict(META,generation='')))
if __name__=='__main__':unittest.main()
