import shutil
import subprocess
import tempfile
from pathlib import Path

here = Path(__file__).resolve().parent
root = here.parents[1]
with tempfile.TemporaryDirectory(prefix="india-cityfinance-") as temp:
    target = Path(temp)
    for name in ("worker.py", "normalize.py", "requirements.txt", "cloudbuild.yaml"):
        shutil.copy2(here / name, target / name)
    shutil.copy2(root / "pipeline/config/india_cityfinance_sources.json", target / "config.json")
    subprocess.run([
        "gcloud", "builds", "submit", str(target), "--config=" + str(target / "cloudbuild.yaml"),
        "--project=czbudget-janrezab", "--region=europe-west1",
        "--service-account=projects/czbudget-janrezab/serviceAccounts/258433468858-compute@developer.gserviceaccount.com",
        "--gcs-source-staging-dir=gs://czbudget-janrezab-data-layers/processing-build-source",
        "--async", "--format=json", "--account=jan@ravineo.com",
    ], check=True)
