# Local raw-cache bundles

Brazil, Ukraine and Netherlands raw sources can live in one `.raw-cache.tar.gz`
and one `.raw-cache.manifest.json` inside each country cache. The hidden files
are storage, not new source data. Already-gzipped responses stay byte-for-byte
unchanged. Raw sources are retained independently of whether BigQuery loaded or
published all their contents. These are local archives, not cloud backups.

From the website repository:

```sh
python3 pipeline/raw_cache_archives.py pack BRA --remove-loose
python3 pipeline/raw_cache_archives.py pack UKR --remove-loose
python3 pipeline/raw_cache_archives.py pack NLD --remove-loose
python3 pipeline/raw_cache_archives.py verify BRA
python3 pipeline/raw_cache_archives.py restore BRA
```

Use `--workspace /absolute/workspace` or `CZBUDGET_WORKSPACE_ROOT` for another
workspace. Packing without `--remove-loose` only creates and verifies the archive.
Packing requires all source files to have been inactive for at least 24 hours;
run only while the relevant importer is stopped. Active markers, partial downloads,
databases, symlinks and ambiguous duplicate names block packing. Dotfile rate
limiter state is left untouched. No trade-crawler files are included.

Before removal, every archive member is read back and checked by SHA-256, the
archive itself is hashed, and loose sources are rechecked. A per-group lock
serializes this helper's operations, but is not a lock on unrelated writers.
Only verified regular files are unlinked; archives and checksums remain local.

Relevant canonical importers restore their country cache before use. The older
workspace Netherlands importer is also supported. Manual/ad-hoc scripts and old
Git worktrees must run the restore command first. Replaying a source pipeline
therefore expands the relevant cache; re-run pack afterward to reclaim file count.
Restore verifies the archive and never overwrites refreshed loose files. If loose
files differ from an existing archive, repacking refuses to delete them: keep both
and review/version the updated archive separately.

Source-manifest and raw data-layer verification hash archived member bytes directly,
overlaid by any newer loose sources. Logical file counts and digests remain the
same; merely packing or restoring does not require regenerating those manifests.
Cloud raw-layer packing restores local bundles first so cloud archives retain the
ordinary source-tree format.
