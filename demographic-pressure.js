(() => {
  const comparisonRoot = document.querySelector("#demographic-pressure-root");
  const countryRoot = document.querySelector("#country-demographic-pressure-root");
  if (!comparisonRoot && !countryRoot) return;

  const flags = {CZE:"cz",POL:"pl",DEU:"de",FRA:"fr",CHE:"ch",SWE:"se",DNK:"dk",GBR:"gb",UKR:"ua",GRC:"gr"};
  const copy = {
    cs: {
      kicker:"Demografie / 9 evropských zemí", title:"Méně narozených. Více starších. Migrace část mezery mění.",
      intro:"Plodnost sama neurčuje účet stárnutí. Proto ji čteme spolu s přirozenou změnou, pracovní populací, čistou migrací a dnešní expozicí veřejných rozpočtů.",
      medianFertility:"Medián plodnosti", belowReplacement:"Pod úrovní prosté reprodukce", naturalDecline:"Přirozený úbytek", dependencyRise:"Růst poměru 65+ / 20–64",
      countries:"zemí", birthsWoman:"dítěte na ženu", latestEstimate:"poslední společný odhad · 2023", replacement:"prostá reprodukce · 2,1", yearRange:"2025 → 2045",
      fertilityTitle:"Plodnost v čase", fertilityCopy:"Jednotná řada UN WPP od roku 1950; po roce 2023 střední varianta projekce.",
      country:"Země", tfr23:"Plodnost 2023", tfr50:"2050", natural:"Přirozená změna", migration:"Čistá migrace", working:"Věk 20–64", dependency:"65+ / 20–64", exposure:"Sociální + zdraví",
      perThousand:"na 1 000 obyv.", pctGdp:"% HDP", pressureTitle:"Demografická a fiskální expozice", pressureCopy:"Výdaje ukazují dnešní rozsah sociální ochrany a zdravotnictví. Nejsou odhadem nákladů nízké plodnosti ani migrace.",
      adminTitle:"Tři různé pohledy na migraci", recorded:"Registrované přistěhování", permits:"První pobytová povolení", irregular:"Záchyty neoprávněného pobytu", nonEu:"občané mimo EU", enforcement:"správní evidence", noData:"bez srovnatelných dat", latest:"poslední dostupný rok", openProfile:"Detail země",
      countryKicker:"Plodnost, migrace a budoucí účet", countryTitle:"Poměr plátců a příjemců v čase",
      countryIntro:"Nízká plodnost působí s dlouhým zpožděním. Migrace může změnit velikost pracovní populace, ale registrované příchody, pobytová povolení a záchyty neoprávněného pobytu nejsou zaměnitelné veličiny.",
      fertilityNow:"Poslední vykázaná plodnost", fertilityFuture:"Plodnost 2050", naturalChange:"Přirozená změna 2023", netMigration:"Čistá migrace 2023", oldDependency:"65+ na 100 lidí 20–64", fiscalExposure:"Sociální ochrana + zdraví", workingChange:"změna pracovní populace", projection:"střední projekce", officialSeries:"národní údaj v Eurostatu", source:"Zdroje a úplná metodika", unavailable:"Pro tento profil není evropský migrační modul dostupný.",
    },
    en: {
      kicker:"Demography / 9 European countries", title:"Fewer births. More older people. Migration changes part of the gap.",
      intro:"Fertility alone does not determine the ageing bill. We therefore read it alongside natural change, the working-age population, net migration and current fiscal exposure.",
      medianFertility:"Median fertility", belowReplacement:"Below replacement level", naturalDecline:"Natural decrease", dependencyRise:"Rise in 65+ / 20–64 ratio",
      countries:"countries", birthsWoman:"births per woman", latestEstimate:"latest common estimate · 2023", replacement:"replacement level · 2.1", yearRange:"2025 → 2045",
      fertilityTitle:"Fertility over time", fertilityCopy:"A common UN WPP series from 1950; the medium projection variant begins after 2023.",
      country:"Country", tfr23:"Fertility 2023", tfr50:"2050", natural:"Natural change", migration:"Net migration", working:"Ages 20–64", dependency:"65+ / 20–64", exposure:"Social + health",
      perThousand:"per 1,000 people", pctGdp:"% of GDP", pressureTitle:"Demographic and fiscal exposure", pressureCopy:"Spending measures the current scale of social protection and health. It is not an estimate of the cost of low fertility or migration.",
      adminTitle:"Three different views of migration", recorded:"Recorded immigration", permits:"First residence permits", irregular:"Irregular-presence detections", nonEu:"non-EU citizens", enforcement:"administrative records", noData:"no comparable data", latest:"latest available year", openProfile:"Country profile",
      countryKicker:"Fertility, migration and the future bill", countryTitle:"The contributor-to-recipient ratio over time",
      countryIntro:"Low fertility operates with a long lag. Migration can change the working-age population, but recorded arrivals, residence permits and irregular-presence detections are not interchangeable measures.",
      fertilityNow:"Latest reported fertility", fertilityFuture:"Fertility 2050", naturalChange:"Natural change 2023", netMigration:"Net migration 2023", oldDependency:"65+ per 100 people aged 20–64", fiscalExposure:"Social protection + health", workingChange:"working-age population change", projection:"medium projection", officialSeries:"national figure reported to Eurostat", source:"Sources and complete methodology", unavailable:"The European migration module is not available for this profile.",
    },
  };
  let data;
  const lang = () => document.documentElement.lang === "en" ? "en" : "cs";
  const locale = () => lang() === "en" ? "en-GB" : "cs-CZ";
  const fmt = (value, digits=1, sign=false) => Number.isFinite(value) ? `${sign && value > 0 ? "+" : ""}${value.toLocaleString(locale(), {minimumFractionDigits:digits, maximumFractionDigits:digits})}` : "—";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const flag = code => `<span class="demographic-flag"><img src="/assets/flags/${flags[code]}.svg" alt="" loading="lazy" decoding="async"><b>${code}</b></span>`;
  const name = profile => profile[`name_${lang()}`];
  const profileLink = code => window.PSDCountryRoutes?.href(code, lang(), "demography") || `country.html?code=${code}&lang=${lang()}#demography`;
  const wpp = (profile, year) => profile.wpp.find(row => row.year === year);
  const median = values => { const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b), mid=Math.floor(sorted.length/2); return sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2; };
  const latestMetric = row => row ? `${fmt(row.per_1000_population)}<small>${row.year} · ${copy[lang()].perThousand}</small>` : `—<small>${copy[lang()].noData}</small>`;

  function lineChart(profile) {
    const years = profile.wpp.filter(row => row.year >= 1950 && row.year <= 2100);
    const width=760, height=190, left=42, right=16, top=14, bottom=28;
    const x = year => left + (year-1950)/150*(width-left-right);
    const min = Math.min(0.8, ...years.map(row => row.total_fertility_rate));
    const max = Math.max(3, ...years.map(row => row.total_fertility_rate));
    const y = value => top + (max-value)/(max-min)*(height-top-bottom);
    const historical = years.filter(row=>row.year<=2023).map((row,index)=>`${index?"L":"M"}${x(row.year).toFixed(1)},${y(row.total_fertility_rate).toFixed(1)}`).join(" ");
    const projected = years.filter(row=>row.year>=2023).map((row,index)=>`${index?"L":"M"}${x(row.year).toFixed(1)},${y(row.total_fertility_rate).toFixed(1)}`).join(" ");
    return `<svg class="fertility-line" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(copy[lang()].fertilityTitle)}">
      <line x1="${left}" x2="${width-right}" y1="${y(2.1)}" y2="${y(2.1)}" class="replacement-line"/><text x="${left+4}" y="${y(2.1)-6}" class="line-label">2.1</text>
      <path d="${historical}" class="fertility-history"/><path d="${projected}" class="fertility-projection"/>
      ${[1950,1990,2023,2050,2100].map(year=>`<text x="${x(year)}" y="${height-7}" text-anchor="middle" class="line-label">${year}</text>`).join("")}
    </svg>`;
  }

  function comparison() {
    if (!comparisonRoot || !data) return;
    const t=copy[lang()], countries=Object.entries(data.countries).sort((a,b)=>wpp(b[1],2023).total_fertility_rate-wpp(a[1],2023).total_fertility_rate);
    const fertility=countries.map(([,profile])=>wpp(profile,2023).total_fertility_rate);
    const below=fertility.filter(value=>value<2.1).length;
    const declining=countries.filter(([,profile])=>wpp(profile,2023).natural_change_per_1000<0).length;
    const dependency=countries.map(([,profile])=>profile.fiscal_pressure.old_age_dependency_2045-profile.fiscal_pressure.old_age_dependency_2025);
    comparisonRoot.innerHTML = `<header class="demographic-heading"><div><span class="kicker">${t.kicker}</span><h2>${t.title}</h2></div><p>${t.intro}</p></header>
      <div class="demographic-summary"><article><span>${t.medianFertility}</span><strong>${fmt(median(fertility),2)}</strong><small>${t.latestEstimate}</small></article><article><span>${t.belowReplacement}</span><strong>${below} / ${countries.length}</strong><small>${t.replacement}</small></article><article><span>${t.naturalDecline}</span><strong>${declining} / ${countries.length}</strong><small>${t.latestEstimate}</small></article><article><span>${t.dependencyRise}</span><strong>+${fmt(median(dependency))}</strong><small>${t.yearRange}</small></article></div>
      <div class="demographic-split"><article class="fertility-ranking"><header><h3>${t.fertilityTitle}</h3><p>${t.fertilityCopy}</p></header>${countries.map(([code,profile])=>{const value=wpp(profile,2023).total_fertility_rate;return `<a href="${profileLink(code)}"><span>${flag(code)}<b>${esc(name(profile))}</b></span><i><u style="width:${Math.min(value/2.4*100,100)}%"></u><em style="left:${2.1/2.4*100}%"></em></i><strong>${fmt(value,2)}</strong></a>`}).join("")}<footer><i></i>${t.replacement}</footer></article>
      <article class="migration-definitions"><h3>${t.adminTitle}</h3><dl><div><dt>${t.recorded}</dt><dd>Eurostat migr_imm1ctz · ${t.latest}</dd></div><div><dt>${t.permits}</dt><dd>Eurostat migr_resfirst · ${t.nonEu}</dd></div><div><dt>${t.irregular}</dt><dd>Eurostat migr_eipre · ${t.enforcement}</dd></div></dl><p>${esc(data.methodology[`irregular_migration_warning_${lang()}`])}</p></article></div>
      <header class="pressure-heading"><div><h3>${t.pressureTitle}</h3><p>${t.pressureCopy}</p></div><a href="/data/europe-demographic-pressure.v1.json">JSON ↗</a></header>
      <div class="demographic-table-wrap"><table class="demographic-table"><thead><tr><th>${t.country}</th><th>${t.tfr23}</th><th>${t.tfr50}</th><th>${t.natural}<small>2023 · ‰</small></th><th>${t.migration}<small>2023 · ‰</small></th><th>${t.working}<small>2025→2045</small></th><th>${t.dependency}<small>2025→2045</small></th><th>${t.exposure}<small>2024 · ${t.pctGdp}</small></th></tr></thead><tbody>${countries.map(([code,profile])=>{const f=profile.fiscal_pressure, now=wpp(profile,2023), future=wpp(profile,2050); return `<tr><th><a href="${profileLink(code)}">${flag(code)}<span>${esc(name(profile))}<small>${t.openProfile} →</small></span></a></th><td>${fmt(now.total_fertility_rate,2)}</td><td>${fmt(future.total_fertility_rate,2)}</td><td class="${now.natural_change_per_1000<0?"negative":"positive"}">${fmt(now.natural_change_per_1000,1,true)}</td><td class="${now.net_migration_per_1000<0?"negative":"positive"}">${fmt(now.net_migration_per_1000,1,true)}</td><td>${fmt(f.working_age_change_2025_2045_pct,1,true)} %</td><td>${fmt(f.old_age_dependency_2025)} → ${fmt(f.old_age_dependency_2045)}</td><td>${fmt(f.combined_social_health_pct_gdp)} %</td></tr>`}).join("")}</tbody></table></div>`;
  }

  function country() {
    if (!countryRoot || !data) return;
    const code=window.PSDCountryRoutes?.codeFromLocation(), profile=data.countries[code];
    if (!profile) { countryRoot.hidden=true; return; }
    countryRoot.hidden=false;
    const t=copy[lang()], f=profile.fiscal_pressure, now=wpp(profile,2023), future=wpp(profile,2050), migration=profile.snapshot, observed=migration.latest_official_fertility_through_2024;
    countryRoot.innerHTML=`<div class="country-pressure-heading"><span class="kicker">${t.countryKicker}</span><h3>${t.countryTitle}</h3><p>${t.countryIntro}</p></div>
      <div class="country-pressure-kpis"><article><span>${t.fertilityNow}</span><strong>${fmt(observed?.value,2)}</strong><small>${observed?.year || "—"} · ${t.officialSeries}</small></article><article><span>${t.fertilityFuture}</span><strong>${fmt(future.total_fertility_rate,2)}</strong><small>${t.projection} · UN WPP</small></article><article><span>${t.naturalChange}</span><strong class="${now.natural_change_per_1000<0?"negative":"positive"}">${fmt(now.natural_change_per_1000,1,true)}‰</strong><small>${t.perThousand}</small></article><article><span>${t.netMigration}</span><strong class="${now.net_migration_per_1000<0?"negative":"positive"}">${fmt(now.net_migration_per_1000,1,true)}‰</strong><small>${t.perThousand}</small></article><article><span>${t.oldDependency}</span><strong>${fmt(f.old_age_dependency_2025)} → ${fmt(f.old_age_dependency_2045)}</strong><small>${t.workingChange} ${fmt(f.working_age_change_2025_2045_pct,1,true)} %</small></article><article><span>${t.fiscalExposure}</span><strong>${fmt(f.combined_social_health_pct_gdp)} %</strong><small>${f.spending_year} · ${t.pctGdp}</small></article></div>
      <article class="country-fertility-history"><header><div><h4>${t.fertilityTitle}</h4><p>${t.fertilityCopy}</p></div><span><i></i>${t.replacement}</span></header>${lineChart(profile)}</article>
      <div class="country-migration-cards"><article><span>${t.recorded}</span><strong>${latestMetric(migration.recorded_immigration_2024)}</strong></article><article><span>${t.permits}</span><strong>${latestMetric(migration.first_residence_permits_2024)}</strong></article><article><span>${t.irregular}</span><strong>${latestMetric(migration.irregular_presence_enforcement_2024)}</strong></article></div>
      <div class="pressure-method"><p>${esc(data.methodology[lang()])}</p><p><b>${t.irregular}:</b> ${esc(data.methodology[`irregular_migration_warning_${lang()}`])}</p><a href="/comparison.html?lang=${lang()}#demographic-pressure">${t.source} →</a></div>`;
  }

  function render(){ comparison(); country(); }
  fetch("/data/europe-demographic-pressure.v1.json").then(response=>{if(!response.ok) throw new Error(response.status); return response.json()}).then(payload=>{data=payload;render()}).catch(error=>console.error("Demographic pressure",error));
  addEventListener("countryprofilechange", render);
  addEventListener("psdlanguagechange", render);
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
})();
