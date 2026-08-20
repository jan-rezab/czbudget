# CZ Budget deployment target

- This directory is the canonical source for the CZ Budget public website.
- Production deploys from GitHub commits through Google Cloud Build.
- Google Cloud project: `czbudget-janrezab`.
- Cloud Run service: `czbudget-public`.
- Region: `europe-west1`.
- Never deploy this project to the `czbudget-web` service.
- Never modify or deploy the Riverdata repository or `riverdata.org` from this project.
- Keep Czech and English navigation available on all municipal and regional pages.
