(() => {
  const datasetUrl = "../../data/cz-public-employment.v1.json?v=1.1.0";
  const lang = document.documentElement.lang === "en" ? "en" : "cs";
  const locale = lang === "en" ? "en-GB" : "cs-CZ";
  const copy = {
    cs: {
      eyebrow: "Report / Veřejná zaměstnanost",
      titleLead: "Kdo pracuje",
      titleEm: "pro český veřejný sektor",
      intro: "Ministerstva jsou jen začátek. Jedna hranice spojuje úřady, školy, nemocnice, samosprávy, infrastrukturu i veřejné podniky — bez dvojího započtení.",
      heroLabel: "Veřejný sektor celkem",
      heroUnit: "FTE · 2024 · oficiální kontrolní součet",
      heroShare: "všech pracovních míst v ekonomice",
      navHistory: "Vývoj",
      navGrowth: "Růst",
      navBoundary: "Hranice",
      navLayers: "Detail",
      navEntities: "Subjekty",
      navMethod: "Metodika",
      historyKicker: "Desetiletá řada",
      historyTitle: "O 121 744 veřejných FTE více než v roce 2015",
      historyIntro: "ČSÚ měří pracovní místa v přepočtených osobách. Řada je srovnatelná v čase a zahrnuje všechny institucionální jednotky kontrolované vládními institucemi.",
      chartTitle: "Pracovní místa podle institucionálního sektoru",
      publicSector: "Veřejný sektor",
      generalGovernment: "Vládní instituce",
      publicCorporations: "Veřejné korporace",
      year: "Rok",
      share: "Podíl",
      growthKicker: "Kam šel růst",
      growthTitle: "98,5 % nových veřejných FTE vzniklo uvnitř vládních institucí",
      growthIntro: "Mezi roky 2015 a 2024 přibylo 121 744 veřejných FTE. Vládní instituce vysvětlují 119 974; veřejné korporace pouze 1 770. To je přesný, plně srovnatelný rozklad.",
      growthSplitTitle: "Rozdělení přírůstku veřejného sektoru",
      growthAria: "Rozdělení růstu veřejné zaměstnanosti mezi vládní instituce a veřejné korporace",
      growthExact: "přesný přírůstek",
      growthReadingTitle: "Téměř celý čistý nárůst je vláda, ne firmy",
      growthReadingBody: "Vládní instituce přidaly {government} FTE, zatímco veřejné korporace skončily jen o {corporations} FTE výše. Korporace tedy nebyly motorem desetiletého růstu.",
      schoolKicker: "Nejlépe doložený motor",
      schoolTitle: "Regionální školství: +65 899 FTE",
      schoolIntro: "Samostatná řada MŠMT ukazuje, kde leží velká část růstu: ve školách přibylo 56 743 pedagogických a 9 156 nepedagogických FTE.",
      schoolCaveat: "Pozor na hranici: školská řada zahrnuje všechny zřizovatele a zdroje financování, tedy i soukromé a církevní školy. Je to silný důkaz o motoru růstu, nikoli přesná část sektoru S.13, kterou lze mechanicky odečíst.",
      pedagogical: "Pedagogičtí pracovníci",
      nonpedagogical: "Nepedagogičtí zaměstnanci",
      schoolTotal: "Regionální školství celkem",
      costKicker: "Kolik to stálo",
      costTitle: "Průměrný náklad zaměstnavatele vzrostl na 68 194 Kč za FTE měsíčně",
      costIntro: "Kompenzace zaměstnanců D.1 zahrnuje hrubé mzdy a platy i sociální příspěvky zaměstnavatele. Není to čistá mzda zaměstnance.",
      costChartTitle: "Průměrná měsíční kompenzace na FTE",
      costAria: "Průměrná měsíční kompenzace zaměstnavatele na jeden FTE nominálně a v cenách roku 2015",
      nominal: "Nominálně",
      real2015: "V cenách roku 2015",
      functionTitle: "Kde vzrostla kompenzace",
      functionUnit: "změna 2015–2024 · mld. Kč",
      costCaveat: "Funkční rozpad měří růst mzdových nákladů, nikoli počtu lidí: kombinuje více FTE, vyšší platy a příspěvky. Po očištění spotřebitelskou inflací vzrostl průměrný náklad na FTE o 12,5 %.",
      totalCompensation: "Kompenzace celkem",
      monthlyEmployerCost: "Náklad na FTE / měsíc",
      realMonthlyCost: "Reálný náklad / měsíc",
      employerContributions: "Příspěvky zaměstnavatele",
      czkBn: "mld. Kč",
      versus2015: "proti 2015",
      in2015Prices: "v cenách 2015",
      ofCompensation: "kompenzace 2024",
      boundaryKicker: "Účetní hranice",
      boundaryTitle: "947 878 uvnitř vlády. 164 412 ve veřejných korporacích.",
      boundaryIntro: "Veřejný sektor je širší než státní rozpočet. Tržní firmy kontrolované státem, krajem nebo obcí jsou mimo sektor vládních institucí, ale uvnitř veřejného sektoru.",
      derivedNote: "ČSÚ za rok 2024 publikuje celkový veřejný sektor a vládní instituce. Hodnota veřejných korporací je proto přesný reziduál těchto dvou oficiálních hodnot; samostatné nefinanční a finanční složky jsou naposledy zveřejněny za rok 2023.",
      layersKicker: "Zdrojové vrstvy",
      layersTitle: "Čtyři detailní pohledy. Ani jeden není další zaměstnanec.",
      layersIntro: "Každá karta řeže stejný veřejný sektor jinak. Školství se překrývá s příspěvkovými organizacemi, samosprávy jsou neúplné a podniky používají osoby místo FTE.",
      noSum: "Karty se nesčítají. Slouží k vysvětlení kontrolního součtu 1 112 290 FTE a každá si zachovává vlastní jednotku, rozsah a pokrytí.",
      entitiesKicker: "Od součtu k organizaci",
      entitiesTitle: "18 238 jmen. Zatím 38 přímých údajů o zaměstnanosti.",
      entitiesIntro: "Konsolidační registr dává IČO a úplný seznam veřejných jednotek, nikoli počet zaměstnanců. Další krok je spojovat resortní výkazy a výroční zprávy přes IČO a zbytek ponechat jako nepřiřazený — ne jako nulu.",
      download: "Stáhnout auditovatelný JSON ↓",
      methodKicker: "Metodika",
      methodTitle: "Jeden kontrolní součet. Mnoho nepřičitatelných důkazů.",
      methodIntro: "Přepočtené osoby, fyzické osoby, systemizovaná místa a rozpočtované pozice nejsou zaměnitelné. Datový kontrakt je proto uchovává odděleně.",
      ofEconomy: "ekonomiky",
      ofPublicSector: "veřejného sektoru",
      change: "Změna od 2015",
      control: "Kontrolní součet",
      official: "oficiální",
      partial: "částečné",
      persons: "osob",
      average_employees: "průměrných zaměstnanců",
      FTE: "FTE",
      coverage: "Pokrytí",
      notAdd: "nepřičítat",
      registered: "Subjektů v registru",
      observed: "S přímým headcountem",
      missing: "Bez zaměstnaneckého pole",
      join: "Spojovací klíč",
      methodCards: [
        ["01", "Kontrolní součet", "ČSÚ satelitní účet určuje celkový počet FTE a institucionální hranici."],
        ["02", "Jednotky zůstávají oddělené", "FTE, osoby a průměrný počet zaměstnanců se bez převodního údaje nemíchají."],
        ["03", "Reziduál je viditelný", "Nevysvětlená část zůstává nepřiřazená. Chybějící údaj nikdy není nula."],
      ],
      loadError: "Data veřejné zaměstnanosti se nepodařilo načíst.",
    },
    en: {
      eyebrow: "Report / Public employment",
      titleLead: "Who works",
      titleEm: "for the Czech public sector",
      intro: "Ministries are only the beginning. One boundary joins authorities, schools, hospitals, local government, infrastructure and public corporations—without double counting.",
      heroLabel: "Total public sector",
      heroUnit: "FTE · 2024 · official control total",
      heroShare: "of all jobs in the economy",
      navHistory: "History",
      navGrowth: "Growth",
      navBoundary: "Boundary",
      navLayers: "Detail",
      navEntities: "Entities",
      navMethod: "Method",
      historyKicker: "Ten-year series",
      historyTitle: "121,744 more public-sector FTE than in 2015",
      historyIntro: "CZSO measures jobs in full-time equivalents. The series is comparable over time and includes every institutional unit controlled by government.",
      chartTitle: "Jobs by institutional sector",
      publicSector: "Public sector",
      generalGovernment: "General government",
      publicCorporations: "Public corporations",
      year: "Year",
      share: "Share",
      growthKicker: "Where the growth went",
      growthTitle: "98.5% of new public-sector FTE appeared inside general government",
      growthIntro: "Between 2015 and 2024, the public sector added 121,744 FTE. General government explains 119,974; public corporations just 1,770. This is the exact, like-for-like split.",
      growthSplitTitle: "Split of the public-sector increase",
      growthAria: "Public-employment growth split between general government and public corporations",
      growthExact: "exact increase",
      growthReadingTitle: "Almost all net growth is government, not corporations",
      growthReadingBody: "General government added {government} FTE while public corporations ended just {corporations} FTE higher. Corporations were not the engine of the decade's growth.",
      schoolKicker: "Best-documented driver",
      schoolTitle: "Regional education: +65,899 FTE",
      schoolIntro: "A separate Ministry of Education series locates a large part of the growth: schools added 56,743 pedagogical and 9,156 non-pedagogical FTE.",
      schoolCaveat: "Boundary warning: the education series covers every founder and funding source, including private and church schools. It is strong evidence of a growth driver, not an exact S.13 slice that can simply be subtracted.",
      pedagogical: "Pedagogical workers",
      nonpedagogical: "Non-pedagogical workers",
      schoolTotal: "Regional education total",
      costKicker: "What it cost",
      costTitle: "Average employer cost rose to CZK 68,194 per FTE per month",
      costIntro: "D.1 compensation of employees includes gross wages and salaries plus employers' social contributions. It is not an employee's take-home pay.",
      costChartTitle: "Average monthly compensation per FTE",
      costAria: "Average monthly employer compensation per FTE in nominal and 2015 prices",
      nominal: "Nominal",
      real2015: "In 2015 prices",
      functionTitle: "Where compensation increased",
      functionUnit: "change 2015–2024 · CZK bn",
      costCaveat: "The functional split measures growth in employment costs, not people: it combines more FTE, higher pay and contributions. After consumer-price inflation, average cost per FTE increased 12.5%.",
      totalCompensation: "Total compensation",
      monthlyEmployerCost: "Cost per FTE / month",
      realMonthlyCost: "Real cost / month",
      employerContributions: "Employer contributions",
      czkBn: "CZK bn",
      versus2015: "versus 2015",
      in2015Prices: "in 2015 prices",
      ofCompensation: "of 2024 compensation",
      boundaryKicker: "Accounting boundary",
      boundaryTitle: "947,878 inside government. 164,412 in public corporations.",
      boundaryIntro: "The public sector is broader than the state budget. Market producers controlled by central, regional or local government sit outside general government but inside the public sector.",
      derivedNote: "For 2024 CZSO publishes total public sector and general government. Public corporations are therefore the exact residual of those two official values; separate non-financial and financial components were last published for 2023.",
      layersKicker: "Source layers",
      layersTitle: "Four detailed views. None is an extra employee.",
      layersIntro: "Each card slices the same public sector differently. Education overlaps contributory organisations, local reporting is incomplete, and companies report persons rather than FTE.",
      noSum: "Do not add the cards. They explain the 1,112,290 FTE control total while retaining their own unit, scope and coverage.",
      entitiesKicker: "From total to organisation",
      entitiesTitle: "18,238 names. So far, 38 direct employment observations.",
      entitiesIntro: "The consolidation register provides IDs and a complete public-unit roster, not employee counts. The next step is joining ministry returns and annual reports by ID and leaving the remainder unallocated—not zero.",
      download: "Download auditable JSON ↓",
      methodKicker: "Method",
      methodTitle: "One control total. Many non-additive pieces of evidence.",
      methodIntro: "Full-time equivalents, persons, established posts and budgeted positions are not interchangeable. The data contract keeps them separate.",
      ofEconomy: "of the economy",
      ofPublicSector: "of the public sector",
      change: "Change since 2015",
      control: "Control total",
      official: "official",
      partial: "partial",
      persons: "persons",
      average_employees: "average employees",
      FTE: "FTE",
      coverage: "Coverage",
      notAdd: "do not add",
      registered: "Entities in register",
      observed: "With direct headcount",
      missing: "No employee field",
      join: "Join key",
      methodCards: [
        ["01", "Control total", "The CZSO satellite account fixes the total FTE and institutional boundary."],
        ["02", "Units stay separate", "FTE, persons and average employees are not mixed without a conversion factor."],
        ["03", "The residual stays visible", "Unexplained employment remains unallocated. A missing value is never zero."],
      ],
      loadError: "Public-employment data could not be loaded.",
    },
  }[lang];

  document.querySelectorAll("[data-emp-copy]").forEach((node) => {
    if (copy[node.dataset.empCopy]) node.textContent = copy[node.dataset.empCopy];
  });
  window.psdLanguageReady?.();

  const $ = (selector) => document.querySelector(selector);
  const fmt = (value) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const pct = (value) => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  const bn = (value) => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 1000);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const sourceMap = (data) => Object.fromEntries(data.sources.map((source) => [source.id, source]));

  function renderChart(history) {
    const width = 900;
    const height = 410;
    const left = 70;
    const right = 24;
    const top = 28;
    const bottom = 50;
    const min = 750000;
    const max = 1150000;
    const x = (index) => left + index * (width - left - right) / (history.length - 1);
    const y = (value) => top + (max - value) / (max - min) * (height - top - bottom);
    const path = (field) => history.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(row[field]).toFixed(1)}`).join(" ");
    const grid = [800000, 900000, 1000000, 1100000].map((value) => `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${fmt(value / 1000)}k</text>`).join("");
    const labels = history.map((row, index) => `<text x="${x(index)}" y="${height - 18}" text-anchor="middle">${row.year}</text>`).join("");
    $("#employment-history-chart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(copy.chartTitle)}"><g class="emp-grid">${grid}${labels}</g><path class="emp-area" d="${path("public_sector_fte")} L${x(history.length - 1)},${y(history.at(-1).general_government_fte)} ${[...history].reverse().map((row, index) => `L${x(history.length - 1 - index)},${y(row.general_government_fte)}`).join(" ")} Z"/><path class="emp-line government" d="${path("general_government_fte")}"/><path class="emp-line total" d="${path("public_sector_fte")}"/>${history.map((row, index) => `<circle class="emp-point" cx="${x(index)}" cy="${y(row.public_sector_fte)}" r="4"><title>${row.year}: ${fmt(row.public_sector_fte)} FTE</title></circle>`).join("")}</svg>`;
  }

  function renderCostChart(history) {
    const width = 900;
    const height = 370;
    const left = 70;
    const right = 26;
    const top = 30;
    const bottom = 52;
    const min = 30000;
    const max = 75000;
    const x = (index) => left + index * (width - left - right) / (history.length - 1);
    const y = (value) => top + (max - value) / (max - min) * (height - top - bottom);
    const path = (field) => history.map((row, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(row[field]).toFixed(1)}`).join(" ");
    const grid = [30000, 40000, 50000, 60000, 70000].map((value) => `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${fmt(value / 1000)}k</text>`).join("");
    const labels = history.map((row, index) => `<text x="${x(index)}" y="${height - 18}" text-anchor="middle">${row.year}</text>`).join("");
    const nominal = "average_monthly_employer_compensation_per_fte_czk";
    const real = "average_monthly_employer_compensation_per_fte_2015_czk";
    $("#employment-cost-chart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(copy.costAria)}"><g class="emp-grid">${grid}${labels}</g><path class="emp-cost-area" d="${path(nominal)} L${x(history.length - 1)},${y(min)} L${x(0)},${y(min)} Z"/><path class="emp-cost-line nominal" d="${path(nominal)}"/><path class="emp-cost-line real" d="${path(real)}"/>${history.map((row, index) => `<circle class="emp-cost-point nominal" cx="${x(index)}" cy="${y(row[nominal])}" r="4"><title>${row.year}: ${fmt(row[nominal])} CZK</title></circle><circle class="emp-cost-point real" cx="${x(index)}" cy="${y(row[real])}" r="3"><title>${row.year}: ${fmt(row[real])} CZK (${copy.real2015.toLowerCase()})</title></circle>`).join("")}</svg>`;
  }

  function renderGrowth(data) {
    const growth = data.growth;
    const school = growth.regional_education_evidence;
    const compensation = data.compensation;
    const cost = compensation.headline;
    const latestCost = compensation.history.at(-1);
    $("#employment-growth-split").innerHTML = `<div class="employment-growth-donut" style="--government-share:${growth.general_government_share_of_public_growth_pct}" role="img" aria-label="${esc(copy.growthAria)}"><div><strong>${pct(growth.general_government_share_of_public_growth_pct)} %</strong><span>${copy.generalGovernment}</span></div></div><div class="employment-growth-legend"><article><i class="government"></i><div><span>${copy.generalGovernment}</span><strong>+${fmt(growth.general_government_change_fte)}</strong><small>${pct(growth.general_government_share_of_public_growth_pct)} %</small></div></article><article><i class="corporations"></i><div><span>${copy.publicCorporations}</span><strong>+${fmt(growth.public_corporations_change_fte)}</strong><small>${pct(growth.public_corporations_share_of_public_growth_pct)} %</small></div></article></div>`;
    $("#employment-growth-reading").innerHTML = `<span>${copy.growthExact}</span><strong>+${fmt(growth.public_sector_change_fte)}</strong><small>FTE · ${growth.year_from} → ${growth.year_to}</small><h3>${copy.growthReadingTitle}</h3><p>${copy.growthReadingBody.replace("{government}", fmt(growth.general_government_change_fte)).replace("{corporations}", fmt(growth.public_corporations_change_fte))}</p>`;
    const pedagogicalShare = school.pedagogical_change_fte / school.change_fte * 100;
    const nonpedagogicalShare = 100 - pedagogicalShare;
    $("#employment-school-growth").innerHTML = `<div class="employment-school-total"><span>${copy.schoolTotal}</span><strong>${fmt(school.total_fte_from)} <i>→</i> ${fmt(school.total_fte_to)}</strong><small>+${fmt(school.change_fte)} FTE</small></div><div class="employment-school-bar" aria-label="${esc(copy.schoolTitle)}"><i class="pedagogical" style="width:${pedagogicalShare}%"></i><i class="nonpedagogical" style="width:${nonpedagogicalShare}%"></i></div><div class="employment-school-legend"><article><i class="pedagogical"></i><span>${copy.pedagogical}</span><strong>+${fmt(school.pedagogical_change_fte)}</strong></article><article><i class="nonpedagogical"></i><span>${copy.nonpedagogical}</span><strong>+${fmt(school.nonpedagogical_change_fte)}</strong></article></div>`;
    const contributionsShare = latestCost.employer_social_contributions_czk_m / latestCost.compensation_employees_czk_m * 100;
    $("#employment-cost-kpis").innerHTML = `<article class="primary"><span>${copy.totalCompensation}</span><strong>${bn(cost.compensation_2024_czk_m)} <i>${copy.czkBn}</i></strong><small>+${bn(cost.change_czk_m)} ${copy.czkBn} · +${pct(cost.change_pct)} %</small></article><article><span>${copy.monthlyEmployerCost}</span><strong>${fmt(cost.average_monthly_cost_2024_czk)} <i>CZK</i></strong><small>+${pct(cost.average_monthly_cost_change_pct)} % ${copy.versus2015}</small></article><article><span>${copy.realMonthlyCost}</span><strong>${fmt(cost.average_monthly_real_cost_2024_2015_czk)} <i>CZK</i></strong><small>+${pct(cost.average_monthly_real_cost_change_pct)} % · ${copy.in2015Prices}</small></article><article><span>${copy.employerContributions}</span><strong>${bn(latestCost.employer_social_contributions_czk_m)} <i>${copy.czkBn}</i></strong><small>${pct(contributionsShare)} % ${copy.ofCompensation}</small></article>`;
    renderCostChart(compensation.history);
    const maxFunctionChange = Math.max(...compensation.change_by_function.map((row) => row.change_czk_m));
    $("#employment-function-growth").innerHTML = [...compensation.change_by_function].sort((a, b) => b.change_czk_m - a.change_czk_m).map((row) => `<article><div><span>${esc(row[lang === "en" ? "label_en" : "label_cs"])}</span><strong>+${bn(row.change_czk_m)}</strong></div><div class="employment-function-track"><i style="width:${row.change_czk_m / maxFunctionChange * 100}%"></i></div><small>${pct(row.share_of_total_change_pct)} %</small></article>`).join("");
  }

  function render(data) {
    const headline = data.headline;
    const sources = sourceMap(data);
    $("#employment-hero-total").textContent = fmt(headline.public_sector_fte);
    $("#employment-hero-share").textContent = `${pct(headline.public_sector_share_pct)} %`;
    $("#employment-kpis").innerHTML = `<article class="primary"><span>${copy.control}</span><strong>${fmt(headline.public_sector_fte)}</strong><small>FTE · ${headline.year}</small></article><article><span>${copy.share}</span><strong>${pct(headline.public_sector_share_pct)} %</strong><small>${copy.ofEconomy}</small></article><article><span>${copy.change}</span><strong>+${fmt(headline.change_since_first_fte)}</strong><small>+${pct(headline.change_since_first_pct)} %</small></article><article><span>${copy.generalGovernment}</span><strong>${fmt(headline.general_government_fte)}</strong><small>FTE · ${headline.year}</small></article>`;
    renderChart(data.history);
    $("#employment-history-body").innerHTML = [...data.history].reverse().map((row) => `<tr><th>${row.year}</th><td>${fmt(row.public_sector_fte)}</td><td>${fmt(row.general_government_fte)}</td><td>${fmt(row.public_corporations_combined_fte)}${row.public_corporations_combined_status === "derived_residual" ? "*" : ""}</td><td>${pct(row.public_sector_share_pct)} %</td></tr>`).join("");
    renderGrowth(data);
    $("#employment-boundary-equation").innerHTML = `<article><span>${copy.generalGovernment}</span><strong>${fmt(headline.general_government_fte)}</strong><small>${pct(headline.general_government_fte / headline.public_sector_fte * 100)} %</small></article><b>+</b><article><span>${copy.publicCorporations}</span><strong>${fmt(headline.public_corporations_combined_fte)}</strong><small>${pct(headline.public_corporations_combined_fte / headline.public_sector_fte * 100)} %</small></article><b>=</b><article class="final"><span>${copy.publicSector}</span><strong>${fmt(headline.public_sector_fte)}</strong><small>100 %</small></article>`;
    $("#employment-layer-grid").innerHTML = data.evidence_layers.map((layer) => {
      const source = sources[layer.source_id];
      return `<article class="${layer.coverage_status}"><header><span>${esc(layer[lang === "en" ? "label_en" : "label_cs"])}</span><b>${copy[layer.coverage_status]}</b></header><strong>${fmt(layer.value)}</strong><small>${copy[layer.unit] || layer.unit} · ${layer.year}</small><div><i style="width:${layer.share_of_public_sector_pct}%"></i></div><p>${pct(layer.share_of_public_sector_pct)} % ${copy.ofPublicSector}</p><footer><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.publisher)} ↗</a><b>${copy.notAdd}</b></footer></article>`;
    }).join("");
    const entities = data.entity_resolution;
    $("#employment-entity-status").innerHTML = `<article><span>${copy.registered}</span><strong>${fmt(entities.registered_entities)}</strong><small>${entities.public_entity_register_period}</small></article><article><span>${copy.observed}</span><strong>${fmt(entities.entities_with_employee_observation)}</strong><small>2024</small></article><article><span>${copy.missing}</span><strong>${fmt(entities.registered_entities - entities.entities_with_employee_observation)}</strong><small>${copy.coverage}</small></article><article><span>${copy.join}</span><strong>IČO</strong><small>${esc(entities.join_key)}</small></article>`;
    $("#employment-method-grid").innerHTML = copy.methodCards.map((row) => `<article><b>${row[0]}</b><h3>${row[1]}</h3><p>${row[2]}</p></article>`).join("");
    $("#employment-sources").innerHTML = data.sources.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener"><span>${esc(source.publisher)}</span><strong>${esc(source[lang === "en" ? "title_en" : "title_cs"])} · ${esc(source.period)} ↗</strong></a>`).join("");
  }

  fetch(datasetUrl, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then(render)
    .catch((error) => {
      console.error("public employment", error);
      $("main").insertAdjacentHTML("afterbegin", `<p class="employment-load-error">${copy.loadError}</p>`);
    });
})();
