# Working in this repository

Read `AGENTS.md` first — it holds the deployment golden rule, the report
catalogue contract and the working agreement that applies to every agent here.
This file adds the traps that cost real time and are invisible from the code.

## Where the repository actually is

The Git repository is **`~/dev/czbudget/website`**, not `~/dev/czbudget`. The
directory above it is a workspace, not a checkout: it holds `data/source_cache`,
`data/sources`, `outputs/`, out-of-repo pipeline scripts and the cloud data
policy in `AGENTS.md` / `CLOUD_DATA.md`. Sessions often start there, where every
`git` command answers `not a git repository` — that is the workspace, not a
broken repo. `cd website` first.

## Two agents share this repository

Codex and Claude both commit here, and either may push to `main` while you work.
Fetch before you start, expect `main` to move under you, and never assume a file
you edited an hour ago is still the version on `main`.

## Deploying

`git push origin main` is the only production path. It starts the Cloud Build
trigger `czbudget-public-main` in **europe-west1** (a `gcloud builds list` with
no `--region` shows a different, stale set) and takes 12–15 minutes.

**A build can pass every gate and still not deploy.** Step 27
(`assert-current-main`) compares the build's commit against the live `main`; if
someone pushed while you were building, it prints `Stale build <sha>; current
main is <sha>. Deployment will be skipped.` and step 29 exits 0. The build
reports SUCCESS and production never changes. So:

- Land one change at a time, into a quiet window.
- Never trust build status alone. Confirm with
  `gcloud builds log <id> --region=europe-west1 | grep -E 'Deployed immutable image|Skipping deployment'`.
- Then confirm on the site itself, with a cache-busting query:
  `curl -s "https://publicspendingdata.org/<page>?cb=$(date +%s)" | grep <marker>`.

If a build passed but skipped promotion, its image is already in Artifact
Registry and can be deployed without rebuilding — this is what
`scripts/deploy-immutable.sh` does:

```sh
gcloud run deploy czbudget-public --project=czbudget-janrezab \
  --region=europe-west1 --platform=managed --image "<repo>@<digest>" \
  --allow-unauthenticated --min-instances=0 --max-instances=5 \
  --concurrency=80 --timeout=30s --labels=app=czbudget-public,source=github --quiet
```

Leave the env vars alone; the data snapshot they point at is set by the build.
Rollback is `gcloud run services update-traffic czbudget-public
--region=europe-west1 --to-revisions=<previous-revision>=100`.

## Before you push

`npm run validate` must pass, and the `.githooks/pre-push` hook runs it again
along with the API and pipeline tests. The browser suite runs in Cloud Build,
but run the specs you touched locally first:

```sh
npx playwright test tests/browser/<spec>.spec.mjs --project=desktop-chromium --reporter=line
```

Do not override `PLAYWRIGHT_BASE_URL`/`PORT`: some specs build absolute URLs
from the default `http://127.0.0.1:4173`, and they fail confusingly on any other
port. The webServer config reuses an existing server, so make sure a stale one
from another checkout is not already holding 4173.

## Things the validators enforce that are easy to trip

- **Shared header and footer are private.** `scripts/validate-site.mjs` rejects
  any top-level `.js` (except `global-nav.js` / `global-footer.js`) containing
  `data-global-footer`, `.glorious-footer`, `.site-header`, `.global-nav` and
  friends. To find the footer from a page script use `body > footer`, or listen
  for the public `psd:shared-footer-ready` event.
- **Some files are hashed in the release manifest**: `sitemap.xml`,
  `czech-sources.html/.js/.css` and the tracked datasets. Editing one — even a
  cache-busting `?v=` — fails `npm run validate` until
  `scripts/create-release-manifest.mjs` regenerates it.
- **Cache-busting is a query string, not a rename.** Production serves JS/CSS
  with `expires 1h`, so a version bump is only needed when a stale hour would
  actually hurt. Bumping a shared file's `?v=` rewrites it in thousands of
  generated pages — rarely worth it.
- `cz/**` and `municipalities/**` generated pages are gitignored; shipping one
  needs `git add -f`.

## Checking a page in the browser pane

The pane is often hidden, and a hidden tab pauses `requestAnimationFrame`, CSS
transitions and `innerText` layout. A transform driven by rAF will read as
"never applied", a transitioning element reports its start value, and
`element.innerText` comes back empty while `textContent` is fine. Verify with
`getBoundingClientRect()`, `getComputedStyle()` and `textContent`, and treat a
blank screenshot as a pane artifact, not a broken page.
