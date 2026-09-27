# Czech municipal history fixtures

Unchanged, gzip-compressed copies of three `data/municipal-history/<ico>.json`
files from commit `98abd60e20497611c1993bd884d499cb71d06728`, the commit the
history fan-out is pinned to in `pipeline/config/municipal-serving-inputs.v1.json`.
The fan-out itself is no longer tracked in Git; the data plane restores it with
`scripts/hydrate-municipal-fanout.py`.

- `00064581` Praha: `tests/api/routes.spec.mjs`
- `44992785` Brno and `00254398` Abertamy: `scripts/validate-site.mjs` snapshot rendering

Check one against the pin with
`git show 98abd60e2049:data/municipal-history/00064581.json | cmp - <(gunzip -c 00064581.json.gz)`.
