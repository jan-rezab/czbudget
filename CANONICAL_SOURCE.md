# Canonical CZ Budget source

## Non-negotiable hosting rule

The only permitted deployment path is this Git repository through Google Cloud Build to Cloud Run. Do not create or connect any alternate hosting project, source repository, preview, deployment integration, or provider-specific project metadata.

This Git repository is the only source allowed to deploy the public CZ Budget service.

- GitHub repository: `jan-rezab/czbudget`
- Google Cloud project: `czbudget-janrezab`
- Cloud Run service: `czbudget-public`
- Region: `europe-west1`
- Source identity: `czbudget-public-canonical-v1`

`czbudget-web` was retired on 2026-08-21 after its complete source snapshot was
compared with this repository. Do not recreate it or any other `czbudget-*`
Cloud Run service. The build fails when a non-canonical CZ Budget service exists.
