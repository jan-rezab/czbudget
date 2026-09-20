import shutil, subprocess, tempfile
from pathlib import Path
here=Path(__file__).resolve().parent; root=here.parents[1]
with tempfile.TemporaryDirectory(prefix="korea-lofin365-") as temp:
    target=Path(temp)
    for name in ("worker.py","requirements.txt","cloudbuild.yaml"): shutil.copy2(here/name,target/name)
    shutil.copy2(root/"pipeline/config/korea_lofin365_city_sources.json",target/"config.json")
    subprocess.run(["gcloud","builds","submit",str(target),"--config="+str(target/"cloudbuild.yaml"),"--project=czbudget-janrezab","--region=us-central1","--service-account=projects/czbudget-janrezab/serviceAccounts/258433468858-compute@developer.gserviceaccount.com","--gcs-source-staging-dir=gs://czbudget-janrezab-data-layers/processing-build-source","--async","--format=json","--account=jan@ravineo.com"],check=True)
