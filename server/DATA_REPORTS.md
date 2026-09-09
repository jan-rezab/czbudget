# Data reports and the path to a community wiki

## Implemented

The shared footer loads a bilingual, keyboard-accessible “Report data” button on pages using the site shell, including server-rendered municipal profiles. The modal captures page title, a sanitized relative URL and hash, an optional data-point description, issue category, required explanation (20–4,000 characters), optional evidence URL and optional email. No account is required. It preserves input on failure and shows a reference only after a durable write.

For an exact data point, render a native button beside its source or chart:

```html
<button type="button" data-report-target="municipal-facts | CZE:00075370 | expenditure | 2024 | CZK | release:20260909">Report this figure</button>
```

Localize that button in its owning component. Alternatively call `window.PSDDataReport.open(target)`. The target remains a reader-supplied hint; it is not a trusted database key. Individual charts have not all been instrumented. Do not wrap every number in an action: source lines and chart menus are less disruptive.

`GET /api/data-reports/config` exposes only enabled state and the public reCAPTCHA site key. `POST /api/data-reports` runs inside the existing canonical Cloud Run service. There is no public report listing or public Firestore access.

## Storage decision

Use Firestore for this small operational review queue. It fits the existing Google Cloud service, supports atomic report/contact writes and avoids maintaining a new SQL instance. Keep official ingested facts, releases and analytical queries in the existing warehouse and snapshot pipeline. Firestore is not a replacement for BigQuery.

The REST API uses the Cloud Run service identity; no service-account key or browser database SDK. Server access is governed by IAM, not client Firestore rules: https://firebase.google.com/docs/firestore/use-rest-api.

- `dataReports/{uuid}`: schemaVersion, createdAt, status=new, page, title, target, reason, explanation, source.
- `dataReportContacts/{sameUuid}`: email, expiresAt (90 days). Private and separate so a future public projection cannot accidentally include email.
- Future `reportEvents/{uuid}`: immutable reviewer, timestamp, old/new status, rationale and linked correction ID. Implement this before introducing a moderation UI.

## Activation checklist (not provisioned or deployed)

1. Create or select a Firestore Native database in the existing `czbudget-janrezab` project; choose its location deliberately. Do not change an existing database's rules blindly. Deny client reads/writes to the two report collections. Give the existing Cloud Run service identity only the required Firestore document and reCAPTCHA assessment permissions; use a dedicated database if stronger isolation is required.
2. Enable the Firestore and reCAPTCHA Enterprise APIs. Create a score-based web key restricted to the canonical domain. The backend requires a valid token, hostname, `data_report` action and score >= 0.5. Monitor legitimate rejection rates before adjusting it. Reference: https://docs.cloud.google.com/recaptcha/docs/create-assessment-website.
3. Enable Firestore TTL for `dataReportContacts.expiresAt` before enabling the form. TTL deletion is asynchronous. Exempt free-text and email fields from indexing where they are not queried. Define operational report retention and deletion handling before public launch.
4. Configure `REPORTS_PROJECT_ID=czbudget-janrezab`, `REPORTS_DATABASE_ID=(default)` (or selected database), `REPORTS_RECAPTCHA_SITE_KEY`, `PUBLIC_ORIGIN=https://publicspendingdata.org`, then `DATA_REPORTS_ENABLED=true`. Deploy only through the existing Git → Cloud Build → `czbudget-public` path.
5. Assign an actual reviewer and queue-check cadence. Initially use restricted Cloud Console access; no automated notifications or moderation console are implemented. Test a real accepted report, spam rejection, contact TTL configuration and storage failure in the deployed environment.

The UI loads Google verification only when the dialog opens and includes Google privacy/terms links. Nginx's CSP allows only the required reCAPTCHA origins/paths. Disabled or missing configuration produces an honest unavailable message and the existing contact address.

## Contact and abuse

Keep email optional: someone finding a wrong number should not need an account. Explain its purpose beside the field. Do not promise email updates yet; delivery is not implemented. Do not publish contact details, use them for marketing, or treat an unverified email as identity. Require verified accounts later for attribution or edit privileges.

Implemented protection: same-origin POST, JSON-only input, existing 32 KiB body cap, strict field limits, honeypot, server-side reCAPTCHA assessment, outbound request deadlines, bounded concurrent work, and 30 submissions/minute per process. A process-local limiter is only a backstop across multiple Cloud Run instances; it is not a distributed quota. Before larger public rollout, add shared atomic quotas or an approved Google Cloud edge rate policy. Do not trust the first user-supplied X-Forwarded-For address. No raw IP or CAPTCHA token is persisted by this feature. Existing infrastructure logs have separate retention policies.

Evidence URLs are stored as text; the server never fetches them. Reviewers must treat submissions as untrusted text and avoid unsafe HTML rendering. Attachments are intentionally absent. Retries after an ambiguous storage timeout may create a duplicate report; add a scoped idempotency key before a high-volume rollout.

## Wiki evolution

1. Triage privately: new → reviewing → accepted / rejected / duplicate / needs_information. Every transition needs an authenticated reviewer and append-only event.
2. Accepted corrections become proposals keyed by dataset, entity, metric, period, unit and source/release version. Store old/new values, evidence and rationale. A report never overwrites a fact directly.
3. Correct the ingestion transform or versioned source override, run the relevant data integrity checks, and publish a new immutable release. Record the release and correction ID on the report; ensure subsequent ingestion cannot silently undo the correction.
4. Publish a deliberately redacted correction history with citations and revision diffs. Avoid exposing original free text automatically. Add verified contributor accounts, moderation roles, conflict handling and rollback before direct editing.

Firestore remains adequate for reports and review events. Reconsider PostgreSQL if relational revision workflows and contributor permissions become central; do not migrate the analytical warehouse for that reason.

## Review admin (implemented in the second release)

`/admin/reports` uses the existing Identity Platform login and a server-side `REPORTS_ADMIN_EMAILS` allowlist of verified email addresses. The default is deny-all. Both page/assets and every `/api/admin/data-reports` request enforce review authorization. A developer account alone grants no review access. Set the allowlist through the canonical deployment configuration; never accept roles from request bodies or the browser.

The queue pages through 40 reports at a time and filters the current page by status. Selecting a report loads the explanation, evidence link, private email (if retained), and latest 100 review events. Decisions require a rationale; `resolved` also requires a published correction/release reference. The report update and immutable event creation commit atomically with an update-time precondition, so concurrent edits return a conflict instead of overwriting another reviewer. There is no delete action, outbound email action or automatic fact editing.

Status decisions remain private. `accepted` means the correction is valid and pending publication; `resolved` means it has shipped. A rejected report can be reopened by selecting a new status and recording why. Reviewer identity is recorded from the verified server-side session. Review history has no edit endpoint. Access and storage failures remain visible rather than appearing as an empty queue.


The admin release adds `scripts/prepare-reporting.py` to the canonical Cloud Build pipeline after the current-main gate. It uses the existing build/runtime identity to use the owner-enabled APIs, create the dedicated `data-reports` Native database in europe-west1, deploy deny-all client rules only to that database, enable contact TTL, and create/reuse a score key restricted to the canonical domain. It does not grant IAM roles or change the default database. Setup must succeed before `/workspace/.reporting-env` enables intake on the new revision; unrelated service environment variables are preserved. If the deployment identity lacks setup permissions, the build fails with an explicit setup error. `REPORTS_ADMIN_EMAILS` remains independently configured and deny-all until the owner supplies reviewer addresses.
