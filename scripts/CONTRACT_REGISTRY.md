# Official Czech contract metadata

`fetch-contract-registry.py` filters official monthly XML dumps to Plzeň
(`00075370`), ŘSD (`65993390`) and Správa železnic (`70994234`). It matches
publisher and contracting-party IČO, retaining every matching published version.
Identifiers retain leading zeros. Entity identity references are in the manifest.

```sh
python3 scripts/fetch-contract-registry.py
python3 scripts/build-contract-registry-lineage.py
python3 -m unittest discover -s tests -p 'test_contract_registry*.py'
```

The first command downloads the current official index. For a reproducible frozen
index, use `--index /path/to/index.xml`. `--limit N` bounds new monthly transfers;
the manifest still names every indexed month and explicitly lists pending months.
The latest complete months are processed first. Current-month metadata remains
marked partial. Daily exports are excluded because they overlap monthly exports.

## Outputs

`data/contracts/official-registry/` contains:

- `index.xml`: the exact index used for that run.
- `YYYY-MM.jsonl.gz`: matching version records only, with native prices as text
  (including zero), native validity, IDs and the complete metadata XML. This XML
  includes all attachment names, hashes and download links. No binaries are read.
- `YYYY-MM.meta.json`: verified raw dump hash/size, source generation time,
  retrieval timestamps, scanned and matched counts, per-entity counts, and output
  integrity hash.
- `manifest.v1.json`: source, selected entities, month coverage and limitations.
- `ICO.lineage.jsonl.gz`: contract groups and their available versions, referencing
  one-based lines in the monthly files. It exposes native valid-record IDs and
  multiple-valid-record cases without declaring a contract legally valid.
- `lineage.v1.json`: deduplicated counts, per-entity artifacts and the exact month
  fingerprints underlying that derived snapshot.

The raw monthly XML is hashed while being parsed from curl stdout. Completed XML
records are released from the parser. Only compressed matching metadata and a
temporary SQLite index of those matches consume disk space. The full 13 GB source
corpus is never retained. Gzip CRC and source/output hashes are checked before a
derived lineage is accepted.

## Revisions and boundaries

The official publisher can revise historical months, including removing every
version of a withdrawn contract. Resume requires unchanged source hash, byte size,
generation timestamp, filter and extraction revision, plus an intact output hash.
A changed month is fully replaced after verification, not appended. Rebuilding
lineage then removes rows absent from the replacement. Consumers must use manifest
months and match lineage fingerprints; files outside the manifest are not coverage.
Do not treat a frozen snapshot as an ongoing withdrawal-monitoring service.

Version ID is unique; repeated identical IDs are deduplicated in lineage, while
conflicting metadata for the same version causes an error. Contract ID groups
versions but does not imply additive expenditure. No price totals are generated.
Some versions may lack the selected IČO; they cannot be inferred from this scoped
pass. A complete import means all indexed monthly files were checked for this
filter, not that unpublished, withdrawn or differently identified versions exist.

[Official format and revision semantics](https://smlouvy.gov.cz/stranka/otevrena-data)
