# Asia/Africa/Oceania city-loader recovery

Recovered on 2026-09-20 into the dedicated `codex/city-loader-data-plane`
worktree. This recovery contains code, source contracts, small test fixtures and
registry generators only. It contains no generated registries, raw source files,
warehouse extracts, caches or processing outputs.

The baseline files came from rescue commit `d05a4bec6434d3c1323f57a9c0c10ef9fcfb0a35`.
The production worker versions below were verified against immutable successful
Cloud Build source archives:

| Adapter | Build | Immutable source object generation |
|---|---|---|
| Korea Local Finance 365 | `a4558e2c-6757-40f4-99a1-3c81ec9c32dc` | `gs://czbudget-janrezab-data-layers/processing-build-source/1789882080.641059-d89c2bc1f82949f38319df35b006262c.tgz#1789882080960078` |
| Seoul project budget | `b2137799-28c1-4ac3-ad33-e22573486db4` | `gs://czbudget-janrezab-data-layers/processing-build-source/1789878748.122484-51280d2dc2aa4b99b34f02bc622a2f2b.tgz#1789878748331727` |
| Kaohsiung budget | `8e764c97-7ec7-4c4d-ac4d-07264c946f57` | `gs://czbudget-janrezab-data-layers/processing-build-source/1789869333.70304-79b02cdb1fb84df6ab7f13dc75f9d539.tgz#1789869333993516` |
| Taipei and Taichung | `bbf6b2ab-4ae4-49fc-b43a-15635abea327` | `gs://czbudget-janrezab-data-layers/processing-build-source/1789885736.315835-315fc73859e14917b5fc8ad6566c1d36.tgz#1789885736558776` |
| Tel Aviv | `c674a349-0cff-4f2e-a020-4e3b329b2b16` | `gs://czbudget-janrezab_cloudbuild/source/1789912481.968928-3262b88f7efe44b9a691071d11d8d867.tgz#1789912482667339` |
| India City Finance depth audit | `f10e7a6c-1e32-4568-8ef4-fbca13585830` | `gs://czbudget-janrezab_cloudbuild/source/1789915054.296596-4db78c54d31c462397ba7af70372da7f.tgz#1789915054993698` |

The AAO coverage generator now records Tel Aviv as production-loaded using the
verified immutable receipt at
`gs://czbudget-janrezab-data-layers/processing-runs/israel-tel-aviv/c674a349-0cff-4f2e-a020-4e3b329b2b16/completed.json`.
The expected regional state is 378 anchors: 56 production-loaded, 120 partial
and 202 hard-blocked. Generated JSON remains cloud/data-release output and is
intentionally absent from this recovery commit.
