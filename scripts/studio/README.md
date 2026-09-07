# Source-network film

`python3 scripts/studio/build-source-network.py` rebuilds the inventory used by
`studio/data-in-one-place/film.js`. It reads loaded methodology rows, the source
provenance registry and source metadata from the published reports listed in the
script. Research-only catalogs and raw caches are not included.

The animation distinguishes citation URLs, publisher groups, municipalities,
state-budget chapters and record-volume measures. They are different units and
must never be summed. Every reference retains its URL, citing artifacts and
available period; input hashes are included in `network-data.json`.

The 60-second film autoplays unless reduced motion is requested. It supports
pause, scrubbing, six chapters, full screen, source-origin and family filters,
and entity search. The earlier country/year/indicator count explorer remains
available in a disclosure below the source explorer.

The production route is unlisted and noindex. Deployment uses the repository's
existing GitHub → Cloud Build → `czbudget-public` Cloud Run path.
