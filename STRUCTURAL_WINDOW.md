# Structural window — scope boundary

**Status: open. Declared 2026-08-30 by the structural session. One-sided until acknowledged.**

This file is G0 of the consolidated plan ("One Quiet Window", 2026-08-29), which merges
Plan A (portability) and Plan B (data architecture). It exists so that concurrent automated
sessions do not destroy each other's work. If you are an agent working in this repository,
read this before your first write.

## Who is doing what

| Session | Branch | Owns | Must not touch |
| --- | --- | --- | --- |
| **Structural** (this one) | `structural-window` | `server/`, chart system in `website/` root, `data/registry/`, `data/manifest.v1.json`, `scripts/` additions, `CHART_SYSTEM.md` | `deep-dives/`, anything the deepdive session is generating |
| **Deepdive** | `deploy-copy-voice` / `main` | new deep-dive section and its artifacts | `structural-window`, `data/registry/`, `data/manifest.v1.json` |
| **Data check** | — | read-only verification of `data/` | any write to `data/` while the eviction below is staged |

## The rule that matters

`data/municipal-expansion/` is **635 MB across 28,559 tracked files** and is the single most
expensive object in this repository. The pack is at **489 MB after 228 commits**. Regenerating
that directory while it is tracked costs roughly its full weight again, every time.

**Do not regenerate `data/municipal-expansion/` until the eviction in B1 has landed.** If you
need to, say so here first and the structural session will land the eviction ahead of you.

## Recording discipline

Every session records `git log -1` and `git status` at the start of each work block and again
before reporting anything. Builds silently no-op when `main` moves mid-build and still report
SUCCESS — `scripts/assert-current-main.mjs` deletes the deploy marker and `deploy-immutable.sh`
exits 0. Never trust build status alone; grep the build log for
`Deployed immutable image` or `Skipping deployment`.

## What is frozen for the width of the window

- New country expansion (it would land in the old shape and need migrating).
- Regeneration of `data/municipal-expansion/`.
- Any redesign. The brand system is adopted and settled.

## What is explicitly NOT frozen

- The new deep-dive section in flight. It is additive and does not collide with the structural work.
- Data cross-checking, as long as it stays read-only.
- `cesky-rozpocet.html` — **kept as-is, deliberately.** It is the reference statement of the
  fiscal perimeter model and the non-additivity rule, and is preserved for later reuse.
  Do not refactor it during this window.
