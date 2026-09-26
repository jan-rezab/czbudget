# Reviewed care and wellbeing panels

`provider_panels(source_rows, by_source)` consumes only source releases admitted by the report publisher. It validates every streamed row's source ID, URL, release and SHA256; each selected cell requires a matching cached representation and exact reviewed schema anchors. A changed source snapshot produces an unresolved gap. It never reconstructs respondent weights or publishes patent/participant ledgers.

Seven panels bind two newer provider families from published care release `6c9dfbee-78b0-4081-8d95-99b80ff2f29d`, receipt SHA256 `0d9c6a1b3a768ab712aa398e060e6bf230595b60702ff010e1a9b85d29786fe0`:

- ITU November2025: World internet-use total/female/male2019–2025; Youth15–24 and source Rest of population2022–2025. Percent denominators remain group-specific; these are annual estimates, not live measurements. World2025 source observations are total73.6%, female70.5%, male76.6%, youth82.2%, rest71.9%.
- Sapien GMP2025: Global Overall pop MHQ and distressed/struggling proportions for overlapping2023+2024 and2024+2025 periods. The2024+2025 source sampleN is768448; earlierN is not given in this table. The source's revised methodology excludes Google Search responses previously downweighted to10%. Comparison values come from this same revised workbook, not a splice with MSW2024. These self-selected internet samples are not population censuses or clinical diagnoses.

Exact URLs, hashes, native units, cell coordinates, bilingual methods, coverage and source-native values are retained in `ch3_4_panel_bindings.json` and panel output. Aggregate schema previews and a bounded warehouse query (cached rows≤15,100rowlimit) verified the physical member and row ordinals; preview array indices were not mistaken for spreadsheet row numbers. The two selected sources and all7panelbindings were exercised against this bounded real source query;3additional synthetic tests cover coordinate extraction, hash mismatch and changed anchors.

WIPO conventional/emerging2021 remains a source-ledger gap requiring a reviewed derived patent counting method. Its workbook contains accession-level patent records, not ready aggregate figure cells; raw loading does not reproduce HDR4.2/4.3. SapienMSW2024/youth2025 exact panels and the pooled original smartphone figure remain unresolved. No respondent-level observations are exposed.
