# Published metadata consumer

The website release only adds this consumer; it does not regenerate or publish data.
`metadata-paths.mjs` is the exact 16-file allowlist: the 12 source-reference artifacts,
QA, freshness, release manifest, and main sitemap. Nginx proxies those paths to
`PublishedMetadataStore`. Image copies remain as the pre-publication fallback.
The API uses the same store, so its release and fiscal responses cannot retain an
obsolete in-image JSON cache after publication.

The existing `static-assets/current.json` lock and bucket permissions are reused.
The dedicated data publisher adds one uncompressed immutable pack, all 16 file
descriptors, and this top-level lock member in a single generation-conditional swap:

```json
{
  "metadata_release": {
    "schema_version": "public-metadata-release.v1",
    "release_id": "unique-data-build-release-id",
    "verified_at": "2026-10-22T15:30:52Z",
    "pack": "public-metadata",
    "paths": ["the exact METADATA_PATHS set"]
  }
}
```

Existing lock packs and paths must be preserved. Each group descriptor must name
that single pack. The consumer bounds the group at 32 MiB, verifies every pinned
member's size/hash and JSON/XML structure, then checks the release linkage before
switching any member. The release manifest's `artifacts` list contains an exact
`path`, `bytes` and `sha256` entry for each other group member; the manifest itself
is pinned by its lock descriptor, avoiding a circular self-hash. A failed refresh,
missing descriptor or partial group retains the previous verified group. Before
any valid group, the byte-for-byte image fallback continues to work.

The QA document has `build_mode: "published-release-audit"`, the same `release_id`
and `verified_at`, and a precise scope. It must retain truthful coverage limits,
not reclassify old local checks as recent verification. Set `status: "passed"`
only when the documented audit has actually passed; the consumer rejects all other
statuses even when every content hash is valid. Nonempty `verification_scope.cs` and
`.en` describe what was checked; `published_releases` lists `{dataset, release_id}`
for the actual pinned releases inspected. At least one named, identified audited
release is required before this group can publish. Keep source URLs, generation/hash pins,
counts, validation results and explicit unavailable provenance in the QA JSON and
immutable processing receipt. Coverage shows this as a published-data audit,
with date, scope, release IDs and the QA download; mixed QA/manifest releases do
not acquire a verified badge.

The publisher must complete immutable raw capture, staging and validation before
the pointer swap. It runs only from a dedicated data branch/worktree in
`europe-west4` as `psd-data-builder` with `plane-data`; it never deploys Cloud Run.
This code release neither supplies nor runs that publisher. Per-request ETags and
`X-Data-Release` identify exact served bytes; a short cache lifetime permits data
updates without another website release. The existing website release does not
evict older responses from public caches; record live cache acceptance separately.
