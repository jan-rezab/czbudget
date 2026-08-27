(() => {
  const ROOT = document.querySelector("#country-spending-root");
  if (!ROOT) return;

  const COPY = {
    cs: {
      kicker: "03 / Kam peníze jdou", title: "Rozpočet bez černé skříňky.",
      copy: "Každá koruna má adresu. Dvě období ve stejném národním členění ukazují velikost položek i to, kde se rozpočet mění.",
      distribution: "Výdaje podle oblasti", change: "Největší meziroční změny", scope: "Rozsah dat",
      previous: "Předchozí období", current: "Aktuální období", local: "místní měna", eur: "přepočet EUR",
      showAll: "Zobrazit všechny položky", showLess: "Zobrazit největší položky", source: "Primární zdroje",
      method: "Jak číst graf", methodText: "Délka čáry odpovídá částce v daném období. Změnový graf řadí absolutně největší přírůstky a poklesy; nejde o harmonizované srovnání mezi státy.",
      topShare: "Podíl 5 největších", total: "Součet zobrazeného členění", up: "růst", down: "pokles", functional: "FUNKCE", department: "KAPITOLA",
      unavailable: "Detailní členění pro tuto zemi se nepodařilo načíst.", rows: "položek", fx: "Kurz pro orientační přepočet",
    },
    en: {
      kicker: "03 / Where the money goes", title: "A budget without the black box.",
      copy: "Every unit of currency has a destination. Two periods under the same national classification show both scale and where the budget is moving.",
      distribution: "Expenditure by area", change: "Largest period-on-period changes", scope: "Data perimeter",
      previous: "Previous period", current: "Current period", local: "local currency", eur: "EUR conversion",
      showAll: "Show every line", showLess: "Show largest lines", source: "Primary sources",
      method: "How to read this", methodText: "Line length represents the amount in each period. The change chart ranks the largest absolute increases and decreases; it is not a harmonised cross-country comparison.",
      topShare: "Top-five share", total: "Classified total", up: "increase", down: "decrease", functional: "FUNCTION", department: "DEPARTMENT",
      unavailable: "Detailed spending data could not be loaded for this country.", rows: "lines", fx: "Indicative conversion rate",
    }
  };

  let payload;
  let expanded = false;
  const ENGLISH_LABELS = {
    "Ministerstvo práce a sociálních věcí":"Ministry of Labour and Social Affairs", "Ministerstvo školství, mládeže a tělovýchovy":"Ministry of Education, Youth and Sports", "Všeobecná pokladní správa":"General Treasury Administration", "Ministerstvo obrany":"Ministry of Defence", "Ministerstvo dopravy":"Ministry of Transport", "Ministerstvo vnitra":"Ministry of the Interior", "Státní dluh":"State debt", "Ministerstvo průmyslu a obchodu":"Ministry of Industry and Trade", "Ministerstvo spravedlnosti":"Ministry of Justice", "Ministerstvo zemědělství":"Ministry of Agriculture", "Ministerstvo financí":"Ministry of Finance", "Ministerstvo kultury":"Ministry of Culture", "Ministerstvo zdravotnictví":"Ministry of Health", "Ministerstvo zahraničních věcí":"Ministry of Foreign Affairs", "Národní sportovní agentura":"National Sports Agency", "Ministerstvo životního prostředí":"Ministry of the Environment",
    "Bundesministerium für Arbeit und Soziales":"Federal Ministry of Labour and Social Affairs", "Allgemeine Finanzverwaltung":"General financial administration", "Bundesministerium der Verteidigung":"Federal Ministry of Defence", "Bundesschuld":"Federal debt", "Bundesministerium für Verkehr":"Federal Ministry of Transport", "Bundesministerium für Forschung, Technologie und Raumfahrt":"Federal Ministry of Research, Technology and Space", "Bundesministerium für Gesundheit":"Federal Ministry of Health", "Bundesministerium für Bildung, Familie, Senioren, Frauen und Jugend":"Federal Ministry of Education, Family Affairs, Senior Citizens, Women and Youth", "Bundesministerium des Innern":"Federal Ministry of the Interior", "Bundesministerium für Landwirtschaft, Ernährung und Heimat":"Federal Ministry of Agriculture, Food and Regional Identity", "Bundesministerium der Finanzen":"Federal Ministry of Finance", "Bundesministerium für wirtschaftliche Zusammenarbeit und Entwicklung":"Federal Ministry for Economic Cooperation and Development", "Bundesministerium für Wohnen, Stadtentwicklung und Bauwesen":"Federal Ministry for Housing, Urban Development and Building", "Auswärtiges Amt":"Federal Foreign Office", "Bundesministerium für Wirtschaft und Energie":"Federal Ministry for Economic Affairs and Energy", "Bundesministerium für Digitales und Staatsmodernisierung":"Federal Ministry for Digital Transformation and Government Modernisation", "Bundeskanzler und Bundeskanzleramt":"Federal Chancellor and Federal Chancellery",
    "Indenrigs- og Sundhedsministeriet":"Ministry of the Interior and Health", "Beskæftigelsesministeriet":"Ministry of Employment", "Forsvarsministeriet":"Ministry of Defence", "Uddannelses- og Forskningsministeriet":"Ministry of Higher Education and Science", "Børne- og Undervisningsministeriet":"Ministry of Children and Education", "Finansministeriet":"Ministry of Finance", "Generelle reserver":"General reserves", "Pensionsvæsenet":"Pensions administration", "Transportministeriet":"Ministry of Transport", "Udenrigsministeriet":"Ministry of Foreign Affairs", "Justitsministeriet":"Ministry of Justice", "Kulturministeriet":"Ministry of Culture", "Social- og Boligministeriet":"Ministry of Social Affairs and Housing", "Skatteministeriet":"Ministry of Taxation", "Ministeriet for Grøn Trepart":"Ministry for the Green Tripartite", "Digitaliseringsministeriet":"Ministry of Digital Government", "Ældreministeriet":"Ministry for Senior Citizens",
    "Enseignement scolaire":"School education", "Engagements financiers de l’État":"State financial commitments", "Défense":"Defence", "Recherche et enseignement supérieur":"Research and higher education", "Solidarité, insertion et égalité des chances":"Solidarity, inclusion and equal opportunities", "Cohésion des territoires":"Territorial cohesion", "Écologie, développement et mobilité durables":"Ecology, sustainable development and mobility", "Sécurités":"Security", "Travail, emploi et administration des ministères sociaux":"Labour, employment and social-ministry administration", "Gestion des finances publiques":"Public-finance management", "Régimes sociaux et de retraite":"Social and pension schemes", "Investir pour la France de 2030":"Investing for France 2030", "Administration générale et territoriale de l’État":"General and territorial state administration", "Relations avec les collectivités territoriales":"Relations with local authorities", "Aide publique au développement":"Official development assistance", "Sport, jeunesse et vie associative":"Sport, youth and community life",
    "Obowiązkowe ubezpieczenia społeczne":"Compulsory social insurance", "Różne rozliczenia":"Miscellaneous settlements", "Obrona narodowa":"National defence", "Rodzina":"Family", "Obsługa długu publicznego":"Public-debt service", "Ochrona zdrowia":"Health care", "Szkolnictwo wyższe i nauka":"Higher education and science", "Bezpieczeństwo publiczne i ochrona przeciwpożarowa":"Public safety and fire protection", "Administracja publiczna":"Public administration", "Wymiar sprawiedliwości":"Justice system", "Transport i łączność":"Transport and communications", "Rolnictwo i łowiectwo":"Agriculture and hunting", "Gospodarka mieszkaniowa":"Housing", "Pomoc społeczna":"Social assistance", "Górnictwo i kopalnictwo":"Mining and quarrying", "Pozostałe zadania w zakresie polityki społecznej":"Other social-policy tasks",
    "Soziale Wohlfahrt":"Social welfare", "Finanzen und Steuern":"Finance and taxes", "Bildung und Forschung":"Education and research", "Verkehr":"Transport", "Übrige Aufgabengebiete":"Other task areas", "Sicherheit":"Security", "Beziehungen zum Ausland – Internationale Zusammenarbeit":"Foreign relations – international cooperation", "Landwirtschaft und Ernährung":"Agriculture and food",
    "Оборона":"Defence", "Загальнодержавні функції":"General public services", "Громадський порядок, безпека та судова влада":"Public order, security and the judiciary", "Соціальний захист та соціальне забезпечення":"Social protection and social security", "Охорона здоров'я":"Health care", "Економічна діяльність":"Economic affairs", "Освіта":"Education", "Духовний та фізичний розвиток":"Culture, religion and physical development", "Охорона навколишнього природного середовища":"Environmental protection", "Житлово-комунальне господарство":"Housing and communal services"
  };
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const lang = () => document.documentElement.lang === "en" ? "en" : "cs";
  const code = () => window.PSDCountryRoutes.codeFromLocation(document.querySelector("#country-code")?.textContent?.trim() || "CZE");
  const eurMode = () => document.querySelector('[data-currency="eur"]')?.classList.contains("active");
  const current = () => payload?.countries.find(country => country.code === code());
  const amount = (value, country) => eurMode() ? value / payload.fx.local_per_eur[country.currency] : value;
  const unit = country => eurMode() ? "EUR" : country.currency;
  const fmt = (value, country, signed = false) => {
    const converted = amount(value, country);
    const digits = Math.abs(converted) < 10 ? 2 : Math.abs(converted) < 100 ? 1 : 0;
    const sign = signed && converted > 0 ? "+" : "";
    return `${sign}${converted.toLocaleString(lang() === "en" ? "en-GB" : "cs-CZ", {maximumFractionDigits: digits})} ${lang() === "en" ? "bn" : "mld."} ${unit(country)}`;
  };
  const rowLabel = row => {
    const translated = row.label_en || ENGLISH_LABELS[row.label_native];
    const differs = translated && translated.toLocaleLowerCase("en") !== row.label_native.toLocaleLowerCase("en");
    if (lang() === "en" && differs) return `<strong title="${esc(row.label_native)}">${esc(translated)}</strong><small>${esc(row.label_native)}</small>`;
    return `<strong>${esc(row.label_native)}</strong>${differs ? `<small>${esc(translated)}</small>` : ""}`;
  };

  function render() {
    const c = current();
    const t = COPY[lang()];
    if (!c) { ROOT.innerHTML = `<p class="spending-error">${t.unavailable}</p>`; return; }
    const rows = [...c.rows].sort((a,b) => b.amounts.current - a.amounts.current);
    const visible = expanded ? rows : rows.slice(0, 15);
    const max = Math.max(...visible.flatMap(row => [Math.abs(row.amounts.previous), Math.abs(row.amounts.current)]), 1);
    const previous = c.periods.previous;
    const currentPeriod = c.periods.current;
    const changes = rows.map(row => ({...row, delta: row.amounts.current - row.amounts.previous})).sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 10);
    const deltaMax = Math.max(...changes.map(row => Math.abs(row.delta)), 1);
    const total = c.totals.current;
    const topFive = rows.slice(0,5).reduce((sum,row) => sum + row.amounts.current,0) / total * 100;
    const status = period => period[`status_${lang()}`];
    const scope = c[`scope_${lang()}`];

    ROOT.innerHTML = `
      <div class="detail-heading spending-heading">
        <div><span class="kicker">${t.kicker}</span><h2 id="country-spending-title">${t.title}</h2></div><p>${t.copy}</p>
      </div>
      <div class="spending-meta">
        <div><span>${t.scope}</span><strong>${esc(scope)}</strong></div>
        <div><span>${t.previous}</span><strong>${esc(previous.label)} · ${esc(status(previous))}</strong></div>
        <div><span>${t.current}</span><strong>${esc(currentPeriod.label)} · ${esc(status(currentPeriod))}</strong></div>
        <div><span>${t.fx}</span><strong>1 EUR = ${payload.fx.local_per_eur[c.currency].toLocaleString(lang()==="en"?"en-GB":"cs-CZ")} ${c.currency}</strong></div>
      </div>
      <div class="spending-chart-grid">
        <article class="spending-panel spending-distribution">
          <header><div><span>01 / ${c.dimension === "functional" ? t.functional : t.department}</span><h3>${t.distribution}</h3></div><div class="spending-legend"><i class="previous"></i>${esc(previous.label)}<i class="current"></i>${esc(currentPeriod.label)}</div></header>
          <div class="spending-bars">
            ${visible.map((row,index) => `<div class="spending-row">
              <div class="spending-row-label"><span>${String(index+1).padStart(2,"0")}</span><div>${rowLabel(row)}</div></div>
              <div class="spending-pair">
                <div class="spending-track"><i class="previous" style="width:${Math.abs(row.amounts.previous)/max*100}%"></i><b>${fmt(row.amounts.previous,c)}</b></div>
                <div class="spending-track"><i class="current ${row.amounts.current < 0 ? "negative" : ""}" style="width:${Math.abs(row.amounts.current)/max*100}%"></i><b>${fmt(row.amounts.current,c)}</b></div>
              </div>
            </div>`).join("")}
          </div>
          ${rows.length > 15 ? `<button class="spending-expand" type="button">${expanded ? t.showLess : `${t.showAll} · ${rows.length} ${t.rows}`}</button>` : ""}
        </article>
        <article class="spending-panel spending-change">
          <header><div><span>02 / Δ</span><h3>${t.change}</h3></div><div class="spending-legend"><i class="down"></i>${t.down}<i class="up"></i>${t.up}</div></header>
          <div class="delta-chart">
            ${changes.map(row => `<div class="delta-row"><div class="delta-row-label">${rowLabel(row)}</div><div class="delta-scale"><i class="zero"></i><span class="${row.delta >= 0 ? "up" : "down"}" style="width:${Math.abs(row.delta)/deltaMax*50}%;${row.delta < 0 ? "right:50%" : "left:50%"}"></span></div><b class="${row.delta >= 0 ? "positive" : "negative"}">${fmt(row.delta,c,true)}</b></div>`).join("")}
          </div>
          <div class="spending-summary"><div><span>${t.total}</span><strong>${fmt(total,c)}</strong></div><div><span>${t.topShare}</span><strong>${topFive.toLocaleString(lang()==="en"?"en-GB":"cs-CZ",{maximumFractionDigits:1})}%</strong></div></div>
          <div class="spending-method"><span>${t.method}</span><p>${t.methodText}</p><p>${esc(c[`note_${lang()}`])}</p></div>
          <div class="spending-sources"><span>${t.source}</span>${c.sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a>`).join("")}</div>
        </article>
      </div>`;
    ROOT.querySelector(".spending-expand")?.addEventListener("click", () => { expanded = !expanded; render(); });
    document.querySelector('[data-i18n="specificKicker"]')?.replaceChildren(document.createTextNode(lang()==="en"?"04 / National specifics":"04 / Národní specifika"));
    const hasHealth=["DEU","FRA","POL","GBR","USA","CHE","SWE","DNK"].includes(c.code);
    document.querySelector('[data-i18n="sourcesKicker"]')?.replaceChildren(document.createTextNode(lang()==="en"?`${hasHealth?"07":"05"} / Primary sources`:`${hasHealth?"07":"05"} / Primární zdroje`));
  }

  fetch("/data/country-spending-2025-2026.v1.json")
    .then(response => { if (!response.ok) throw new Error(response.status); return response.json(); })
    .then(data => { payload = data; render(); })
    .catch(error => { console.error("country spending", error); ROOT.innerHTML = `<p class="spending-error">${COPY[lang()].unavailable}</p>`; });

  document.querySelectorAll("[data-lang],[data-currency]").forEach(button => button.addEventListener("click", () => setTimeout(render, 0)));
  document.querySelector("#country-switch")?.addEventListener("change", () => { expanded = false; setTimeout(render, 0); });
  new MutationObserver(() => { if (payload) render(); }).observe(document.documentElement, {attributes: true, attributeFilter: ["lang"]});
})();
