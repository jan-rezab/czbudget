# Structural window — closed

**Status: closed 2026-08-31. Nothing in this repository is frozen.**

This was G0 of the consolidated plan ("One Quiet Window", 2026-08-29), which merged Plan A
(portability) and Plan B (data architecture). It existed so that concurrent automated sessions
did not destroy each other's work, and it froze three things while the storage layer moved.

All three freezes are lifted. They are recorded below with what they were protecting, because
a freeze whose reason is forgotten gets reinstated by the next person who reads about it.

## What was frozen, and why it no longer is

**New country expansion.** Frozen because a new country would have landed in the old shape —
a bespoke per-municipality fan-out — and then needed migrating. That shape is no longer where
countries land. A country now arrives as facts in `budget_detail.municipal_budget_line_facts`,
identity in `data/registry/municipal-entities/`, and a headline rule derived by
`scripts/derive-municipal-headline-rules.mjs` and checked against every figure the source
publishes. Thirteen of fifteen countries are served that way. A fourteenth can be added today
without migrating anything afterwards.

**Regeneration of `data/municipal-expansion/`.** Frozen because the directory was 28,559
tracked files and 635 MB, so regenerating it cost roughly its own weight in pack every time.
It is now untracked — 0 files in the index — along with the generated pages and the per-entity
profiles. Regenerating it is cheap, and for thirteen countries it is not the source of truth
anyway. The pack is 309 MB, down from 768 MB.

**Redesign.** This was never really a window rule. The brand system is adopted and settled,
and that stands on its own without a freeze behind it.

## What the window produced

Thirty-three commits. The storage layer moved from committed files to a warehouse of
29,399,903 municipal facts across 24 countries, with the serving artifacts regenerated and
verified against every headline the site publishes — 51,020 of them, all agreeing. Nine of the
fifteen planned items are complete; four more shipped and are working but incomplete (B3 covers
municipal data and not the other 58 artifacts; B4, B5 and A4 each landed their mechanism and
part of their content); two have not started (A5 glossary, A6 second axis).

The remaining work, what blocks each piece of it, and a suggested order are in
`pipeline/config/data_layers.json` under `known_gaps`, which is the record kept as the work
went along rather than a summary written after it.

## The one thing worth keeping

Concurrent sessions still write here. During this window another session switched the active
gcloud account between commands, which surfaces as `bigquery.jobs.create` permission denied
rather than as a race — the same query failed five times and then succeeded three times when
pinned. The warehouse scripts now pin their account per invocation via `BQ_ACCOUNT` rather than
changing the shared config, because changing it is what caused the problem in the first place.

If you are an agent working here and you are about to run a long build, say so somewhere the
other sessions can see, and check `git log -1` before you report anything: builds silently
no-op when `main` moves mid-build and still exit 0.

## A note on `cesky-rozpocet.html`

This page was held out of the window as the reference statement of the fiscal perimeter model
and the non-additivity rule. It still is, and it is still not for refactoring. A revenue donut
was added to section 03 on 2026-08-31 at the maintainer's explicit request — an addition to the
page, deliberately made, not a refactor of it.

## Working in parallel

The window that this file used to guard is closed, but two sessions still share this machine.
Nothing here is about git. Every collision that actually cost time came from shared state that
git does not track: the raw data directories live outside the repository, and gcloud keeps one
active account for every process on the machine. A branch or a worktree would not have helped
with either.

### Downloading while someone else pushes

The pre-push gate hashes every raw input under `data/source_cache` and `data/sources` to prove
the manifest describes real bytes. A crawl writing into those directories moves the hash faster
than a regeneration can land — the gate rehashes after running the test suite, so the window is
never smaller than about a minute. Hashing a directory mid-write produces a value that is wrong
before the command that wrote it returns.

So a writer declares itself:

```bash
touch data/sources/<group>/.in-flight   # before the batch
rm    data/sources/<group>/.in-flight   # when it is complete
```

A group holding that marker is recorded as in flight rather than hashed, and verification
passes over it. Nothing becomes silently unverified: the manifest carries an `in_flight` list
with the moment each marker was set, and verification prints every one with its age. A marker
older than twelve hours is reported as probably forgotten. Everything outside those groups is
still compared byte for byte.

Leaving a marker in place indefinitely does not break a build. It quietly removes that group
from what the manifest can claim, which is worse — so remove it when the batch lands.

### Two sessions, one gcloud

`gcloud` keeps a single active account per machine, and `bq` reads it at the moment it runs.
When the other session ran `gcloud config set account`, queries here began failing with
`bigquery.jobs.create` permission denied — which reads as an IAM problem and is not one. The
same query failed five times and then succeeded three times when pinned.

Each session uses its own named configuration instead:

```bash
gcloud config configurations create <name> --no-activate
CLOUDSDK_ACTIVE_CONFIG_NAME=<name> gcloud config set account you@example.com
CLOUDSDK_ACTIVE_CONFIG_NAME=<name> gcloud config set project <project>
```

`--no-activate` matters: creating a configuration otherwise switches to it and breaks the other
session in exactly the way this avoids. This repository's warehouse scripts default to the
`czbudget` configuration and honour `CZBUDGET_GCLOUD_CONFIG` if you need another.

### Two more, learned the expensive way

**Do not run `git gc --prune=now` here.** This is a partial clone with a promisor remote.
Pruning destroyed three local branches that existed nowhere else, permanently.

**`gcloud builds submit` uploads the working tree, not the pushed commit.** A deploy therefore
ships whatever is on the machine that submits it. Local drift in a hydrated layer is invisible
until the build hashes it — a six-byte cache-buster difference in `municipalities/` once cost a
twenty-six minute build. Re-hydrate before deploying, or check the layers verify first:

```bash
node scripts/hydrate-data-layers.mjs --layer pages --verify
```
