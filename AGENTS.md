# CZ Budget deployment target

- GOLDEN RULE: Never create, save, preview, publish, deploy, or manage a ChatGPT Sites project for CZ Budget.
- Never add or restore `.openai/hosting.json` in this repository.
- Do not call any `sites_*` / ChatGPT Sites tool for this project, including read-only calls. Use GitHub, Google Cloud Build, and Cloud Run only.
- This directory is the canonical source for the CZ Budget public website.
- Production deploys from GitHub commits through Google Cloud Build.
- Google Cloud project: `czbudget-janrezab`.
- Cloud Run service: `czbudget-public`.
- Region: `europe-west1`.
- Never create or deploy `czbudget-web` or any other `czbudget-*` Cloud Run
  service. `czbudget-public` is the sole production service, and the build
  enforces this invariant.
- Never modify or deploy the Riverdata repository or `riverdata.org` from this project.
- Keep Czech and English navigation available on all municipal and regional pages.
- Brand assets, the palette and the adopted logo rules are in `BRAND.md`; the
  chart grammar is in `CHART_SYSTEM.md`. Preserve the primary mark and wordmark
  rules across hand-written and generated pages.
