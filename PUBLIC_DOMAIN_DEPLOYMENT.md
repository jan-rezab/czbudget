# publicspendingdata.org deployment

The production application is the single Cloud Run service `czbudget-public`
in project `czbudget-janrezab`, region `europe-west1`. Pushes to `main` are
validated, built, and deployed by the regional Cloud Build trigger
`czbudget-public-main`.

## One-time domain connection

The domain uses Cloudflare DNS. From the repository root, run:

```sh
./scripts/prepare-public-domain.sh
```

The script opens Google's ownership verification when needed, creates the
Cloud Run mappings for the apex and `www`, and prints the exact DNS records.
Add those records in Cloudflare with **Proxy status: DNS only** while Google
provisions the certificate. Then check progress with:

```sh
./scripts/check-public-domain.sh
```

`www.publicspendingdata.org` redirects permanently to the apex domain.

## Future releases

Merge or push a reviewed commit to `main`. The existing Cloud Build trigger is
the only production release path; it validates the data and site, builds an
immutable container, and deploys it to `czbudget-public`.

Useful Google Cloud pages:

- [Cloud Run service](https://console.cloud.google.com/run/detail/europe-west1/czbudget-public/metrics?project=czbudget-janrezab)
- [Cloud Build trigger](https://console.cloud.google.com/cloud-build/triggers;region=europe-west1?project=czbudget-janrezab)
- [Build history](https://console.cloud.google.com/cloud-build/builds;region=europe-west1?project=czbudget-janrezab)
- [Cloud Run domain mappings](https://console.cloud.google.com/run/domains?project=czbudget-janrezab)
