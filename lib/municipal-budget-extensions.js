(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MunicipalBudgetExtensions = api;
}(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  // Sources that exist for one municipality only. Everything else on the budget viewer
  // is derived from data published for every Czech municipality, so a new city needs
  // no entry here. Add one only for a genuinely city-specific source, never to hide or
  // relabel what the shared data says.
  const extensions = {
    "00064581": {
      // Published FIN 2-12 M totals reconcile; the Prague entity perimeter needs verification.
      scopeNote: {
        en: "Published Prague FIN 2-12 M reporting unit after consolidation. The city-and-district membership is under verification; do not add district accounts to these totals.",
        cs: "Publikovaná vykazující jednotka Praha ve FIN 2-12 M po konsolidaci. Zahrnutí města a městských částí se ověřuje; výkazy městských částí k těmto součtům nepřičítejte.",
      },
      consolidationUrl: "https://www.praha.eu/documents/d/praha/rozpocet-2024-plneni",
      // The magistrate is one of 263 Prague profiles; the integration lists all of them.
      cityvizorKey: "cityvizor.praha.eu/4",
      recordsUrl: "https://cityvizor.praha.eu/magistrat",
      // Districts publish their own profiles on the Prague instance, each with its own IČO.
      authorities: { instance: "https://cityvizor.praha.eu", keyPattern: "^cityvizor\\.praha\\.eu/\\d+$", defaultKey: "cityvizor.praha.eu/6", districtCount: 57 },
      companies: true,
      connectedResults: true,
      livingCostApi: "/api/v1/praha/living-cost",
      reconciliationApi: "/api/v1/praha/reconciliation/2025",
      contracts: {
        api: "/api/v1/praha/related-contracts",
        status: "verified_private_warehouse",
        warehouseReleaseId: "95efccaf-8f0f-421d-b5fc-1316ee967cc6",
        warehousePublishedAt: "2026-09-27T11:46:26.587055+00:00",
        warehouseReceiptSha256: "a1b27e9fbb1f0ab44441a85f57806341608a78427a732cec5fe8e43b460733fa",
        pageConnectionStatus: "curated_exact_party_lookup",
        joinedToBudget: false,
        acceptedRows: 115429,
        completedAt: "2026-09-21T00:52:20.294787+00:00",
        auditedAt: "2026-09-27",
        sourceQuery: "icoPlatce:00064581",
        receiptId: "628f5121-6622-4dab-a99b-47fb1f3f8dd5",
        normalizedSha256: "b96f132d6b8d23caf8267bf28ec514cd3504a4979aef35606d0486344b9c364d",
        parentCampaignStatus: "failed_after_partial_completion",
        publicationStatus: "published_private_warehouse",
      },
      warehouse: { releaseId: "3c1b0b77-f00f-42c9-ae74-1a2366034a62", note: { en: "Entire held archive, 9 September 2026: 557 profiles, 1,688 profile-years, 2,023,700 overlapping records (not distinct invoices)", cs: "Celý uložený archiv, 9. září 2026: 557 profilů, 1 688 profilových roků, 2 023 700 překrývajících se záznamů (nikoli počet faktur)" } },
      // Reader-facing names for the magistrate's largest project codes.
      projectNames: { "40106": "Data centres", "41944": "Document & support systems", "8936": "IT services & Lítačka", "40101": "Crisis management systems", "40082": "City administration systems", "41946": "Information & cyber security", "40445": "Maps & geographic information", "2912": "City computers & software", "40985": "Municipal police systems", "40099": "City websites & applications", "92911": "Public transport · DP", "91651": "City contributory organisations", "91653": "Private schools", "44553": "Emauzy complex renovation", "92914": "Public transport · rail", "98201": "Operating contributions · social care", "96201": "Operating contributions · culture", "95408": "Waste management", "92913": "Public transport · buses", "98106": "Operating contributions · health", "45029": "Industrial Palace reconstruction", "96203": "Culture grants" },
    },
  };
  const forIco = ico => extensions[String(ico)] || null;
  return { forIco, icos: Object.keys(extensions) };
}));
