# Canonical CZ Budget source

## Non-negotiable hosting rule

CZ Budget must never use ChatGPT Sites. Do not create, save, preview, publish, deploy, inspect, or reconnect a Sites project, and never restore `.openai/hosting.json`. The only permitted deployment path is this Git repository through Google Cloud Build to Cloud Run.

This Git repository is the only source allowed to deploy the public CZ Budget service.

- GitHub repository: `jan-rezab/czbudget`
- Google Cloud project: `czbudget-janrezab`
- Cloud Run service: `czbudget-public`
- Region: `europe-west1`
- Source identity: `czbudget-public-canonical-v1`

The existing `czbudget-web` service is a separate legacy service and must not be used by this deployment.
