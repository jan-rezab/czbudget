# Revenue deep dive — prepared, not deployed

The page reads the verified private release `7e5269b3-8555-46a8-a21d-4c3ff535e3b7` through `/api/v1/revenue/current`. The serving store checks its immutable generation, SHA-256, size and country eligibility before returning it. No loader runs during a website build.

Private serving export build `b79b7945-8dbc-4fc8-9105-c633547a71ee` succeeded on 27 September 2026, 12:01:01–12:02:12 UTC. Export size is 1,770,965 bytes, SHA-256 `32f78a71107059f96d48dc0214e6bf2a21fc1ed91452d46c7504291ec39cfbe3`. Its private atomic pointer is `processing-runs/revenue-serving/current.json`. The approved runtime reader grant covers only that serving prefix.

## Country and source boundaries

The switcher offers 64 eligible partial country profiles; 94 low-coverage geographies remain excluded. Every page shows its periods, recipient reconciliation coverage, missing sectors and source limitations. OECD attribution is not a source-to-recipient cash matrix. A local transfer percentage is never applied to VAT. WOFI grants and ESA accrual transfers remain distinct evidence.

Czech cash examples use cited 2023 receipts, with sources and gross recipient totals visible. Source selection reveals the independently reported tax allocation. Health premiums remain separate from social insurance. Clicking local budgets shows own receipts, transfers, alternative adjusted totals and the residual between reported rounded components. Gross recipient totals overlap through transfers and must not be added.

German 2023 VAT is an explicitly dated optional example beside its 2024 OECD profile. Rounded allocation percentages are retained without fabricating recipient currency amounts. Other countries show only separately evidenced tax routes; missing tax allocations remain unavailable.

## EUR display and reconciliation

The cloud export snapshots and hashes the direct ECB annual-average series, 2015–2025 selection: 362 reported currency/year observations for 36 currencies. Original decimal text, series key and status are retained. Source: https://data-api.ecb.europa.eu/service/data/EXR/A..EUR.SP00.A?startPeriod=2015&endPeriod=2025&format=csvdata

Calculated EUR = original amount / the same-year currency-per-EUR rate. Czech 2023 cash cards and budget components can be displayed in EUR; original CZK figures remain visible, shares unchanged, residuals converted with the same rate. OECD nominal observations with identified currencies have a calculated EUR detail when a tax is selected. EUR observations require no FX. No nearest-year fallback, PPP conversion or guessed historical currency basis is allowed. ESA MIO_NAC observations lack verified currency metadata here and remain visibly unavailable for EUR conversion.

## Verification

- 23 Python data/export/FX tests pass.
- 38 focused JavaScript model/API/renderer/registry/release/verification tests pass; ownership, release contracts and diff checks pass.
- Built-in browser verified real private data, the 64-option switcher, synchronized hero and sticky filters, Czech VAT in EUR, local-budget residuals, German historical VAT, Australian missing allocation and pause.
- Desktop switcher ends at the right viewport edge. At 390px, the right sticky selector remains visible and page scroll width is exactly 390px after correcting the historical chart's grid overflow.
- Local preview used existing operator credentials. Runtime impersonation was denied; no Token Creator permission was granted. The exact prefix-scoped runtime binding was verified separately, but an actual runtime smoke check is still required in the normal deployment lane.
- Sparse checkout omits ancillary OECD rate/trend packs; their local preview 404s are not evidence of production source coverage. No data pack was restored locally.

## Remaining release gates

The normal full website verification and runtime smoke check must pass during the authorized release process. No website build, push or deployment was made. These preparation checks do not replace that release gate.
