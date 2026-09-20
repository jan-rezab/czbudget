# Publishing data stories

This is the lightweight Git-backed editorial CMS. It uses the site's existing
static runtime; no database, admin credentials, or additional service is needed.
Inspired by Ravineo's Payload fields: title, slug, excerpt, author, publication
date, category, format, and draft/published state. There is no visual admin UI.

1. Add an entry to `catalog.mjs` with a stable slug and `status: 'draft'`.
2. Write the article body in `<slug>.fragment` here. Do not include a page shell or
   h1: the publisher adds the shared navigation, title, metadata and related links.
   Manuscripts are trusted, reviewed HTML, not user-submitted content.
3. Review every factual statement, source date, unit, estimate flag and causal
   caveat. Preserve provenance. Use the shared PSDChart rail for chart tables,
   source drawers, citations and CSV exports; enable PNG only for SVG charts.
4. Set `status: 'published'`, then `npm run build:stories`. Review generated
   `stories/` pages. `npm run check:stories` detects stale pages and invalid metadata.
   Draft manuscripts stay outside the runtime staging allowlist.
5. Run source and cloud browser gates, commit source and generated pages, then
   use the canonical verified-main release path. Never deploy a separate service.

`format: 'story'` is a full article; `format: 'mini'` is a short explainer.
The index, RSS feed and dedicated sitemap are generated from published entries.
English article bodies are marked `lang=en`; browsing controls support CS/EN.
Do not rename published slugs. To unpublish, explicitly remove/redirect the old
route after review; the publisher rejects stale directories rather than deleting
previously published pages silently. Preserve substantive corrections in Git and
update the article's `updated` date with a visible correction note.

Charts are dated editorial snapshots, not a new data ingestion layer. Do not put
warehouse extracts, raw downloads or generated datasets in this directory. Data
updates must come through the separate cloud data plane and editorial review.
