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
    out=dict(url=url,attempted_method='HEAD',range_get_attempted=False)
    try:
        with opener(Request(url,method='HEAD'),timeout=10) as response:
            out.update(head_status=response.status,content_length=response.headers.get('Content-Length'),content_type=response.headers.get('Content-Type'))
        # No GET retry following denied HEAD. A successful HEAD permits one bounded
        # range request; if Range is ignored, close after4096 bytes immediately.
        out.update(attempted_method='GET',range_get_attempted=True)
        with opener(Request(url,headers={'Range':'bytes=0-4095'},method='GET'),timeout=10) as response:
            sample=response.read(LIMIT)
            out.update(range_status=response.status,received_bytes=len(sample),sample_sha256=hashlib.sha256(sample).hexdigest(),zip_signature=sample.startswith(b'PK\x03\x04'),content_range=response.headers.get('Content-Range'))
        out['status']='accessible_bounded_probe'
    except HTTPError as error:
        out.update(status='access_denied' if error.code in (401,403) else 'http_error',http_status=error.code)
        if error.fp is not None: error.close()
    except (URLError,TimeoutError,OSError,ValueError) as error:
        out.update(status='probe_error',error=str(error))
    return out

def probe_sources(sources,clock=time.monotonic,access_probe=probe):
    results=[];started=clock()
    requests=[(source,kind) for source in sources for kind in ('ascii','layout','sas') if kind in source]
    unattempted=[]
    for index,(source,kind) in enumerate(requests):
        if clock()-started>220:
            unattempted=[dict(year=s['year'],kind=k,url=s[k],reason='Probe runtime bound reached') for s,k in requests[index:]]
            break
        result=access_probe(source[kind]);result.update(year=source['year'],kind=kind,official_metadata_page=source['page']);results.append(result)
    return results,unattempted

def main():
    from google.cloud import storage
    build=os.environ['BUILD_ID'];sha=os.environ['LOADER_SHA']
    if not build or not sha:raise ValueError('Immutable run identity required')
    manifest=json.load(open('pipeline/undp_cloud/audit/brfss_access_probe.json'))
    authorization=json.load(open('pipeline/undp_cloud/receipts/cdc-access-override-20260927.json'))
    results,unattempted=probe_sources(manifest['sources'])
    receipt=dict(schema_version='1.0.0',build_id=build,loader_git_sha=sha,region='europe-west4',service_account='psd-data-builder@czbudget-janrezab.iam.gserviceaccount.com',generated_at=datetime.now(timezone.utc).isoformat(),processing_status='access_probe_completed',publication_status='not_published',raw_ingestion_status='not_attempted',max_received_bytes_per_url=LIMIT,original_started_at=authorization['original_started_at'],budget_minutes=authorization['budget_minutes'],cumulative_failed_attempts=authorization['cumulative_failed_attempts'],checkpoint_override=authorization['named_exception'],unattempted=unattempted,results=results)
    raw=json.dumps(receipt,sort_keys=True).encode()
    obj=f'processing-runs/hdr-cdc-access/{build}/receipt.json'
    storage.Client().bucket('czbudget-janrezab-data-layers').blob(obj).upload_from_string(raw,content_type='application/json',if_generation_match=0)
    print(json.dumps(dict(receipt_uri='gs://czbudget-janrezab-data-layers/'+obj,sha256=hashlib.sha256(raw).hexdigest(),results=results)))

if __name__=='__main__':main()
