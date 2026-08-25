# Umami for Public Spending Data

This package prepares a self-hosted Umami 3.3.0 deployment at
`analytics.publicspendingdata.org` on Cloud Run in the existing
`czbudget-janrezab` project.

It intentionally uses the separate service name `publicspending-umami`. It
does not create a `czbudget-*` service and does not alter the canonical
`czbudget-public` website deployment.

## Architecture

- Cloud Run service: `publicspending-umami`, `europe-west1`, scale to zero.
- Image: official Umami 3.3.0 image, pinned by digest and mirrored into the
  project's existing Artifact Registry repository.
- Database: PostgreSQL 12.14 or newer, preferably in the EU and configured for
  UTC. The database is external to Cloud Run and is not provisioned here.
- Secrets: dedicated Secret Manager entries for the database URL, application
  secret, and two-factor encryption key. The Cloud Run service uses a
  dedicated service account with access only to those secrets.
- Privacy defaults: Umami telemetry and external network calls are disabled.

## Prerequisites

1. Create an empty PostgreSQL database. Cloud SQL, Neon, Supabase, or another
   managed PostgreSQL provider will work. Keep the database in an EU region.
2. Obtain a direct PostgreSQL connection string beginning with `postgresql://`
   or `postgres://`. Include the provider's required TLS query parameters.
3. Authenticate `gcloud` with an account that can enable APIs, manage service
   accounts and secrets, run Cloud Build, and deploy Cloud Run services.

Umami runs its Prisma migrations automatically when the container starts.
Use a direct database connection for this first deployment; a pooled URL needs
a separate `DIRECT_DATABASE_URL` secret before it is suitable here.

## Deploy

From the repository root:

```sh
chmod +x ops/umami/*.sh
./ops/umami/setup-gcp.sh
./ops/umami/deploy.sh
```

`setup-gcp.sh` asks for the database URL without echoing it, stores it in
Secret Manager, generates two 256-bit secrets, and records only secret version
numbers in the ignored `.deployment.env` file. `deploy.sh` builds the pinned
image, resolves the Artifact Registry digest, and deploys that immutable image.

For Cloud SQL, grant the dedicated service account `roles/cloudsql.client`, use
a PostgreSQL URL that points at the `/cloudsql/PROJECT:REGION:INSTANCE` socket,
and deploy with:

```sh
UMAMI_CLOUD_SQL_INSTANCE='PROJECT:REGION:INSTANCE' ./ops/umami/deploy.sh
```

## Domain and DNS

The lowest-friction option, matching the current public-site setup, is a Cloud
Run domain mapping:

```sh
./ops/umami/map-domain.sh
```

The command prints the exact DNS records to add for
`analytics.publicspendingdata.org`. Google documents Cloud Run domain mapping
as Preview and does not recommend it for production workloads; a global
external Application Load Balancer is the stronger long-term option if strict
TLS controls or an SLA become important.

Certificate provisioning can take up to 24 hours. Verify after DNS and TLS are
ready:

```sh
./ops/umami/verify.sh
```

## First login and website setup

1. Open `https://analytics.publicspendingdata.org`.
2. Sign in with Umami's initial `admin` / `umami` credentials and change the
   password immediately.
3. Enable two-factor authentication.
4. Add a website named `Public Spending Data` with domain
   `publicspendingdata.org`.
5. Copy the website UUID and enable tracking in the public-site Nginx template:

```sh
node ops/umami/enable-tracking.mjs 'WEBSITE-UUID'
npm run validate
```

The helper adds the tracker to every HTML response, updates the CSP, restricts
tracking to the apex and `www` domains, respects Do Not Track, excludes URL
query strings, and enables Core Web Vitals. Review and deploy that website
change through the normal GitHub-to-Cloud-Build path.

Tracking is deliberately not enabled before a real website UUID exists.

## Operations

- Backup PostgreSQL before every Umami upgrade.
- Upgrade by changing the pinned image version and digest in `Dockerfile`, then
  rerun `deploy.sh`.
- Rotate a database credential by rerunning `setup-gcp.sh`, which creates a new
  secret version, then rerun `deploy.sh`.
- Umami is cookieless, but the site's privacy information should still name the
  analytics purpose, data categories, retention period, and operator.

## References

- [Umami installation](https://docs.umami.is/docs/install)
- [Umami environment variables](https://docs.umami.is/docs/environment-variables)
- [Umami tracker configuration](https://docs.umami.is/docs/tracker-configuration)
- [Cloud Run secrets](https://cloud.google.com/run/docs/configuring/services/secrets)
- [Cloud Run custom domains](https://cloud.google.com/run/docs/mapping-custom-domains)
- [Cloud SQL connections from Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run)
