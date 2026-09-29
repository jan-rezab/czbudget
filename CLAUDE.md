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

`git push origin main` is the only production path. It starts the code-only
Cloud Build trigger `czbudget-public-main` in **europe-west1** (a `gcloud builds
list` with no `--region` shows a different, stale set). Data processing runs in
**europe-west4** and must never deploy Cloud Run. Read `BUILD_PLANES.md` before
changing either path.

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
  --service-account=psd-web-runtime@czbudget-janrezab.iam.gserviceaccount.com \
  --min-instances=0 --max-instances=5 \
  --concurrency=80 --timeout=30s --labels=app=czbudget-public,source=github --quiet
```

Leave the env vars alone; the data snapshot they point at is set by the build.
Rollback is `gcloud run services update-traffic czbudget-public
--region=europe-west1 --to-revisions=<previous-revision>=100`.

## Before you push

**The JavaScript/CSS cache gate is mandatory before the first push.** Re-read
`/Users/johnwick/dev/czbudget/DELIVERY_GUARDRAILS.md` for each release. Record changed
assets, every consumer/import reference, old/new URLs and observed CDN cache headers.
Ship deterministic reference versions with the code change in the first candidate.
Verify the staged/served HTML references the new URL and that it serves the changed
bytes. Runtime staging versions registered adapters; confirm this for the actual
asset. Legacy/unregistered scripts need explicit versioned consumer references.

On 29 September the public-employment handler shipped under the old script URL.
Both cloud suites passed, but an existing browser kept the old code because the CDN
advertised `max-age=14400, must-revalidate`. The second release only changed the
script query. An HTML `?cb=` and `must-revalidate` do not invalidate a still-fresh
script response. Before reporting completion, ordinarily reload the pre-release
built-in browser session and verify the loaded URL and requested behavior, then
check a fresh page load. Do not clear caches to hide a failed acceptance check.
Record live cache failures separately from cloud failures and retain the original
task clock. Instruction-only changes must not trigger a website release.

The push hook runs source/component contracts. Broad changes require successful
full cloud verification of the exact candidate before main; component changes
run focused verification inside the one production build after the main push. Full integrity/API checks run in the
cloud broad gate; they are not repeated at each local push. Use the dependency
plan in `COMPONENT_RELEASES.md`; browser checks run in Cloud Build. Do not launch
a local external browser from this hook. The equivalent targeted cloud command is:

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
- **Chart assets are centrally versioned.** Follow `COMPONENT_RELEASES.md`.
  Shared chart JS/CSS is content-addressed with retained old versions. Stable
  legacy JS/CSS cache behavior must be checked at the public CDN; never assume it
  revalidates. Version every consuming reference for a changed legacy asset when
  staging does not already give it a new content-derived URL.
- `cz/**` and `municipalities/**` generated pages are gitignored; shipping one
  needs `git add -f`.

## Checking a page in the browser pane

The pane is often hidden, and a hidden tab pauses `requestAnimationFrame`, CSS
transitions and `innerText` layout. A transform driven by rAF will read as
"never applied", a transitioning element reports its start value, and
`element.innerText` comes back empty while `textContent` is fine. Verify with
`getBoundingClientRect()`, `getComputedStyle()` and `textContent`, and treat a
blank screenshot as a pane artifact, not a broken page.
