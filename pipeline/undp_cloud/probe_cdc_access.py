"""Official alternate-source access probe. No archive ingestion or publication."""
import hashlib,json,os,time
from datetime import datetime,timezone
from urllib.parse import urlsplit
from urllib.request import Request,urlopen,HTTPRedirectHandler,build_opener
from urllib.error import HTTPError,URLError

LIMIT=4096

def official(url):
    parsed=urlsplit(url)
    if parsed.scheme!='https' or parsed.hostname!='www.cdc.gov' or not parsed.path.startswith('/brfss/annual_data/') or parsed.query or parsed.fragment or parsed.username or parsed.password or parsed.port not in (None,443):
        raise ValueError('Unreviewed official source URL')
    return url

class OfficialRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        official(newurl)
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def probe(url,opener=None):
    official(url);opener=opener or build_opener(OfficialRedirect()).open
    out=dict(url=url)
    try:
        with opener(Request(url,method='HEAD'),timeout=10) as response:
            out.update(head_status=response.status,content_length=response.headers.get('Content-Length'),content_type=response.headers.get('Content-Type'))
        # No GET retry following denied HEAD. A successful HEAD permits one bounded
        # range request; if Range is ignored, close after4096 bytes immediately.
        with opener(Request(url,headers={'Range':'bytes=0-4095'},method='GET'),timeout=10) as response:
            sample=response.read(LIMIT)
            out.update(range_status=response.status,received_bytes=len(sample),sample_sha256=hashlib.sha256(sample).hexdigest(),zip_signature=sample.startswith(b'PK\x03\x04'),content_range=response.headers.get('Content-Range'))
        out['status']='accessible_bounded_probe'
    except HTTPError as error:
        out.update(status='access_denied' if error.code in (401,403) else 'http_error',http_status=error.code)
        error.close()
    except (URLError,TimeoutError,OSError,ValueError) as error:
        out.update(status='probe_error',error=str(error))
    return out

def main():
    from google.cloud import storage
    build=os.environ['BUILD_ID'];sha=os.environ['LOADER_SHA']
    if not build or not sha:raise ValueError('Immutable run identity required')
    manifest=json.load(open('pipeline/undp_cloud/audit/brfss_access_probe.json'))
    results=[];started=time.monotonic()
    for source in manifest['sources']:
        for kind in ('ascii','layout','sas'):
            if kind not in source:continue
            if time.monotonic()-started>220:break
            result=probe(source[kind]);result.update(year=source['year'],kind=kind,official_metadata_page=source['page']);results.append(result)
    receipt=dict(schema_version='1.0.0',build_id=build,loader_git_sha=sha,region='europe-west4',service_account='psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com',generated_at=datetime.now(timezone.utc).isoformat(),processing_status='access_probe_completed',publication_status='not_published',raw_ingestion_status='not_attempted',max_received_bytes_per_url=LIMIT,original_started_at=1790461758,budget_minutes=179,cumulative_failed_attempts=4,checkpoint_override='Explicit user authorization for corrected DATA recovery; counter retained',results=results)
    raw=json.dumps(receipt,sort_keys=True).encode()
    obj=f'processing-runs/hdr-cdc-access/{build}/receipt.json'
    storage.Client().bucket('czbudget-janrezab-data-layers').blob(obj).upload_from_string(raw,content_type='application/json',if_generation_match=0)
    print(json.dumps(dict(receipt_uri='gs://czbudget-janrezab-data-layers/'+obj,sha256=hashlib.sha256(raw).hexdigest(),results=results)))

if __name__=='__main__':main()
