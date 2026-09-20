#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

here = Path(__file__).resolve().parent
command = [
    "gcloud", "builds", "submit", str(here), "--config", str(here / "cloudbuild.yaml"),
    "--project", "czbudget-janrezab", "--region", "europe-west1",
    "--service-account", "projects/czbudget-janrezab/serviceAccounts/258433468858-compute@developer.gserviceaccount.com",
    "--gcs-source-staging-dir", "gs://czbudget-janrezab-data-layers/processing-build-source",
    "--async", "--format=json",
]
result = subprocess.run(command, check=True, text=True, capture_output=True, timeout=180)
print(json.dumps(json.loads(result.stdout), indent=2))
