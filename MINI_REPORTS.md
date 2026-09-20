# Mini Reports — private preview

Entry point: `/mini-reports`. No public navigation, report-catalogue entry or sitemap entry is added. The HTML, JS, CSS and API all require a verified, allowlisted identity and return `no-store` and `noindex, nofollow`. The server-side starter data is not a public static asset.

## Authors and storage

- `MINI_REPORTS_AUTHOR_EMAILS`: comma-separated invited author emails. If absent, reuse `REPORTS_ADMIN_EMAILS`. An explicitly empty value denies everyone. Ordinary verified accounts have no access.
- `MINI_REPORTS_PROJECT_ID`: Firestore project; defaults to the existing `REPORTS_PROJECT_ID`.
- `MINI_REPORTS_DATABASE_ID`: Firestore database; defaults to `REPORTS_DATABASE_ID`, then `(default)`.
- `PUBLIC_ORIGIN`: the exact website origin for same-origin write checks, as used by the existing editorial tools.

The Cloud Run service identity uses the existing metadata-token flow. It needs read/write access to the `miniReports` collection in the configured Firestore database. No client Firestore access is required. This change does not provision a database, grant IAM access or alter production environment settings. With no project configured, the starter remains readable to invited authors, while saves return an explicit 503 instead of pretending to persist.

Documents have an immutable authenticated author ID, a display byline, timestamps, topics, countries, cities, structured chart rows, sources, methodology and a draft/published status. Writes use Firestore preconditions to prevent overwrites. Only the author may edit an existing report. The private feed exposes published reports to invited authors; personal drafts are visible only to their author. Saving a published report as a draft withdraws it from that feed.

Publishing requires a byline, sources, methodology and a human-review acknowledgement. Titles and prose render as text, never HTML; source URLs must use HTTPS. The composer accepts up to 40 chart rows and one or two nonnegative numeric measures. Categories are controlled topics; place tags are author-supplied. Filters apply to loaded reports; “Load more” traverses the next storage page. Cards have a data table, CSV download, PNG infographic export and a copyable citation.

## First report

`server/mini-reports-seed.json` contains the 28-city property-tax comparison as an **unassigned draft**. An invited author reviews it, adds their byline and claims it on the first save; it is not automatically published or attributed to a person. The saved Firestore document takes precedence over the bundled starter.

Prague’s 0.450363% is the peer median requested in the conversation. It is prominently labelled as a **scenario assumption**, never an observed Prague property-tax rate. The original comparison mixes official and approximate valuation bases and fiscal periods; its draft method explicitly identifies the remaining author review.

## Verification

```sh
node --test tests/api/mini-reports.spec.mjs tests/api/mini-reports-routes.spec.mjs tests/api/report-admin-routes.spec.mjs
node --check server/public/mini-reports.js
```

For built-in-browser verification, the loopback-only fixture uses the real routes and an in-memory Firestore substitute. It cannot write to Google Cloud and is excluded from the production image with the other tests:

```sh
/Users/johnwick/.codex/bin/resource-guard.py preview -- node tests/fixtures/mini-reports-preview.mjs
```

Open `http://127.0.0.1:4189/mini-reports`, then stop the owned preview after checking. Production must use the repository’s canonical Cloud Build → Cloud Run path.
