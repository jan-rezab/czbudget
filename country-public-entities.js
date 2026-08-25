(() => {
  const root = document.querySelector("#country-public-entities-root");
  if (!root) return;

  const state = {
    code: window.PSDCountryRoutes.codeFromLocation(),
    lang: document.documentElement.lang === "en" ? "en" : "cs",
    coverage: null, aggregates: null, manifest: null, shard: null,
    query: "", perimeter: "", entityClass: "", sort: "name", page: 1, selected: null,
    request: 0,
  };
  const C = {
    cs: {
      kicker:"05 / Veřejný sektor jako vlastník a provozovatel", title:"Veřejné subjekty bez slepých míst.",
      intro:"Úplný uložený registr, širší oficiální perimeter a ekonomická data jsou oddělené vrstvy. Země proto srovnáváme pouze tam, kde se definice skutečně potkávají.",
      universe:"Referenční veřejný sektor", stored:"Uložené řádky", finance:"Řádky s ekonomikou", sources:"Oficiální zdroje",
      comparison:"Srovnávací mapa pokrytí", comparisonNote:"Referenční počty a uložené seznamy mohou mít jiný perimeter. Řádky nesčítáme napříč zdroji.",
      country:"Země", perimeter:"Referenční perimeter", broad:"Širší počet", rows:"Řádky registru", financial:"Ekonomická data", status:"Integrita",
      complete:"řádkový registr", aggregate:"pouze agregát", mixed:"více nesčitatelných vrstev",
      boundary:"Co je skutečně zahrnuto", gaps:"Známé mezery", noGaps:"Pro uložený perimeter nebyla zjištěna další chybějící veřejná kategorie.",
      officialSources:"Zdrojové vrstvy", economy:"Ekonomická stopa", economyCopy:"Všechny nalezené agregáty jsou viditelné včetně jednotky, období, perimetru a dimenzí. Chybějící hodnota není nula.",
      metric:"Ukazatel", value:"Hodnota", unit:"Jednotka", period:"Období", dimensions:"Dimenze", source:"Zdroj",
      diagnostics:"Diagnostika podniků", diagnosticsCopy:"Mediány jsou počítány jen z řádků, kde jsou oba potřebné údaje. Kvůli rozdílným perimetrům nejde o žebříček efektivity zemí.",
      netMargin:"Čistá marže", opMargin:"Provozní marže", roa:"Návratnost aktiv", revenueEmployee:"Výnosy / zaměstnanec", observations:"pozorování",
      directory:"Úplný registr", directoryCopy:"Prohledává názvy, identifikátory i vlastníky. Detail uchovává původní právní formu, účetní jednotku a zdroj.",
      search:"Hledat název, IČO/ID nebo vlastníka", allPerimeters:"Všechny perimetry", allClasses:"Všechny typy", sortName:"Název A–Z", sortRevenue:"Výnosy sestupně", sortEmployees:"Zaměstnanci sestupně",
      shown:"nalezených řádků", represented:"reprezentovaných subjektů", previous:"Předchozí", next:"Další", details:"Detail záznamu", close:"Zavřít", choose:"Vyberte řádek pro úplný zdrojový detail.",
      downloadJson:"Stáhnout JSON", downloadCsv:"Stáhnout filtrované CSV", field:"Pole", rawValue:"Hodnota", loading:"Načítám úplný registr…", unavailable:"Není k dispozici", methodology:"Metodické pravidlo", crawl:"Crawl dokončen",
    },
    en: {
      kicker:"05 / The public sector as owner and operator", title:"Public entities, without blind spots.",
      intro:"The complete stored register, the broader official perimeter and economic data are separate layers. Countries are compared only where definitions genuinely align.",
      universe:"Reference public sector", stored:"Stored rows", finance:"Rows with economics", sources:"Official sources",
      comparison:"Coverage comparison map", comparisonNote:"Reference counts and stored lists can use different perimeters. Rows are never added across sources.",
      country:"Country", perimeter:"Reference perimeter", broad:"Broader count", rows:"Registry rows", financial:"Economic data", status:"Integrity",
      complete:"row-level register", aggregate:"aggregate only", mixed:"multiple non-additive layers",
      boundary:"What is actually included", gaps:"Known gaps", noGaps:"No further missing public category was identified within the stored perimeter.",
      officialSources:"Source layers", economy:"Economic footprint", economyCopy:"Every located aggregate is exposed with its unit, period, perimeter and dimensions. A missing value is not zero.",
      metric:"Metric", value:"Value", unit:"Unit", period:"Period", dimensions:"Dimensions", source:"Source",
      diagnostics:"Enterprise diagnostics", diagnosticsCopy:"Medians use only rows containing both required inputs. Different perimeters make this unsuitable as a country efficiency ranking.",
      netMargin:"Net margin", opMargin:"Operating margin", roa:"Return on assets", revenueEmployee:"Revenue / employee", observations:"observations",
      directory:"Complete registry", directoryCopy:"Searches names, identifiers and controlling authorities. The inspector retains native legal form, accounting unit and original source.",
      search:"Search name, ID or controlling authority", allPerimeters:"All perimeters", allClasses:"All entity types", sortName:"Name A–Z", sortRevenue:"Revenue descending", sortEmployees:"Employees descending",
      shown:"matching rows", represented:"represented entities", previous:"Previous", next:"Next", details:"Record detail", close:"Close", choose:"Select a row for its complete source record.",
      downloadJson:"Download JSON", downloadCsv:"Download filtered CSV", field:"Field", rawValue:"Value", loading:"Loading complete registry…", unavailable:"Unavailable", methodology:"Method rule", crawl:"Crawl completed",
    },
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const slug = value => esc(String(value || "").replaceAll("_", " "));
  const locale = () => state.lang === "en" ? "en-GB" : "cs-CZ";
  const integer = value => Number(value).toLocaleString(locale(), {maximumFractionDigits:0});
  const numeric = (value, digits=1) => Number(value).toLocaleString(locale(), {maximumFractionDigits:digits});
  const t = () => C[state.lang];
  const countryCoverage = code => state.coverage?.countries?.[code];
  const countryManifest = code => state.manifest?.countries?.find(item => item.country_code === code);
  const selectedCoverage = () => countryCoverage(state.code);
  const selectedManifest = () => countryManifest(state.code);
  const selectedAggregates = () => (state.aggregates?.observations || []).filter(row => row.country_code === state.code);
  const finite = value => value !== null && value !== "" && Number.isFinite(Number(value));
  const formatValue = value => value === null || value === "" ? "—" : typeof value === "number" ? numeric(value, Math.abs(value) < 100 ? 2 : 0) : esc(value);
  const fieldIndex = field => state.shard.fields.indexOf(field);
  const raw = (record, field) => record?.[fieldIndex(field)];
  const value = (record, field) => {
    const current = raw(record, field);
    return state.shard.dictionary_fields.includes(field) ? state.shard.dictionaries[field][current] : current;
  };
  const label = field => ({
    record_id:"Record ID", national_id:state.lang === "en" ? "National ID" : "Národní ID", name:state.lang === "en" ? "Name" : "Název",
    perimeter:t().perimeter, source_id:"Source ID", period:t().period, entity_class:state.lang === "en" ? "Entity type" : "Typ subjektu",
    legal_form_native:state.lang === "en" ? "Native legal form" : "Původní právní forma", ownership_level:state.lang === "en" ? "Ownership level" : "Úroveň vlastnictví",
    ownership_share_pct:state.lang === "en" ? "Ownership share (%)" : "Vlastnický podíl (%)", controlling_authority:state.lang === "en" ? "Controlling authority" : "Ovládající orgán",
    status:t().status, sector:state.lang === "en" ? "Sector" : "Odvětví", region:state.lang === "en" ? "Region" : "Region", body_count:state.lang === "en" ? "Bodies represented" : "Počet reprezentovaných subjektů",
    revenue:state.lang === "en" ? "Revenue" : "Výnosy", operating_result:state.lang === "en" ? "Operating result" : "Provozní výsledek", net_result:state.lang === "en" ? "Net result" : "Čistý výsledek",
    assets:state.lang === "en" ? "Assets" : "Aktiva", equity:state.lang === "en" ? "Equity" : "Vlastní kapitál", liabilities:state.lang === "en" ? "Liabilities" : "Závazky",
    employees:state.lang === "en" ? "Employees" : "Zaměstnanci", currency:state.lang === "en" ? "Currency" : "Měna", monetary_unit:state.lang === "en" ? "Monetary unit" : "Peněžní jednotka",
    financial_period:state.lang === "en" ? "Financial period" : "Účetní období", source_url:t().source, notes:state.lang === "en" ? "Source notes" : "Poznámky ke zdroji",
  }[field] || slug(field));

  function referenceCount(code) {
    const coverage = countryCoverage(code);
    if (finite(coverage.broad_entity_count)) return coverage.broad_entity_count;
    return coverage.perimeters?.[coverage.comparison_perimeter]?.represented_entity_count ?? null;
  }
  function statusFor(code) {
    const coverage = countryCoverage(code), layers = Object.keys(coverage.perimeters || {}).length;
    if (!countryManifest(code)?.record_count) return t().aggregate;
    return layers > 1 ? t().mixed : t().complete;
  }
  function coverageTable() {
    return `<article class="pe-comparison"><header><div><span>${t().comparison}</span><p>${t().comparisonNote}</p></div></header><div class="pe-table-scroll"><table><thead><tr><th>${t().country}</th><th>${t().perimeter}</th><th>${t().broad}</th><th>${t().rows}</th><th>${t().financial}</th><th>${t().status}</th></tr></thead><tbody>${state.manifest.countries.map(item => {
      const coverage = countryCoverage(item.country_code);
      return `<tr class="${item.country_code === state.code ? "selected" : ""}" data-country-row="${item.country_code}"><td><button type="button" data-country="${item.country_code}"><b>${item.country_code}</b></button></td><td>${slug(coverage.comparison_perimeter)}</td><td>${finite(referenceCount(item.country_code)) ? integer(referenceCount(item.country_code)) : "—"}</td><td>${integer(item.record_count)}</td><td>${integer(item.financial_record_count)}</td><td><span class="pe-status">${esc(statusFor(item.country_code))}</span></td></tr>`;
    }).join("")}</tbody></table></div></article>`;
  }
  function sourceLayers() {
    const coverage = selectedCoverage(), extra = selectedAggregates().map(row => ({source_id:row.source_id, period:row.period, url:row.source_url, record_granularity:"aggregate"}));
    const sources = [...(coverage.sources || []), ...extra].filter((source, index, all) => all.findIndex(item => item.source_id === source.source_id) === index);
    return `<div class="pe-boundary-grid"><article><span>${t().boundary}</span><h3>${slug(coverage.comparison_perimeter)}</h3><div class="pe-perimeters">${Object.entries(coverage.perimeters || {}).map(([name, detail]) => `<div><b>${slug(name)}</b><small>${integer(detail.represented_entity_count)} ${t().represented} · ${integer(detail.record_count)} ${t().rows}</small></div>`).join("")}</div></article><article><span>${t().gaps}</span>${coverage.unresolved_layers?.length ? `<ul>${coverage.unresolved_layers.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p>${t().noGaps}</p>`}</article><article class="pe-sources"><span>${t().officialSources}</span>${sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer"><b>${slug(source.source_id)}</b><small>${esc(source.period || "")} · ${slug(source.record_granularity || "aggregate")}</small></a>`).join("")}</article></div>`;
  }
  function aggregates() {
    const observations = selectedAggregates();
    return `<article class="pe-economy"><header><div><span>${t().economy}</span><p>${t().economyCopy}</p></div><b>${integer(observations.length)} ${t().observations}</b></header>${observations.length ? `<div class="pe-table-scroll pe-aggregate-table"><table><thead><tr><th>${t().metric}</th><th>${t().value}</th><th>${t().unit}</th><th>${t().period}</th><th>${t().perimeter}</th><th>${t().dimensions}</th><th>${t().source}</th></tr></thead><tbody>${observations.map(row => {
      const dimensions = Object.entries(row).filter(([key]) => !["country_code","source_id","period","perimeter","metric","value","unit","source_url"].includes(key)).map(([key,val]) => `${slug(key)}=${esc(val)}`).join(" · ");
      return `<tr><td><b>${slug(row.metric)}</b></td><td>${formatValue(row.value)}</td><td>${slug(row.unit)}</td><td>${esc(row.period)}</td><td>${slug(row.perimeter)}</td><td>${dimensions || "—"}</td><td><a href="${esc(row.source_url)}" target="_blank" rel="noreferrer">${slug(row.source_id)} ↗</a></td></tr>`;
    }).join("")}</tbody></table></div>` : `<p>${t().unavailable}</p>`}</article>`;
  }
  function diagnostics() {
    const info = selectedManifest().diagnostics;
    const entries = [["net_margin_pct",t().netMargin,"%"],["operating_margin_pct",t().opMargin,"%"],["return_on_assets_pct",t().roa,"%"],["revenue_per_employee",t().revenueEmployee,""]];
    return `<article class="pe-diagnostics"><header><span>${t().diagnostics}</span><p>${t().diagnosticsCopy}</p></header><div>${entries.map(([key,name,unit]) => { const item=info[key]; return `<section><span>${name}</span><strong>${item.value === null ? "—" : `${numeric(item.value,2)}${unit}`}</strong><small>n = ${integer(item.record_count)}</small></section>`; }).join("")}</div></article>`;
  }
  function summary() {
    const coverage = selectedCoverage(), manifest = selectedManifest();
    const sources = new Set([...(coverage.sources || []).map(item => item.source_id), ...selectedAggregates().map(item => item.source_id)]);
    return `<div class="detail-heading"><div><span class="kicker">${t().kicker}</span><h2 id="country-public-entities-title">${t().title}</h2></div><p>${t().intro}</p></div><div class="pe-crawl"><span>${t().crawl}</span><b>23. 8. 2026 · 20:12:23 CEST</b><small>${t().methodology}: ${esc(state.coverage.comparison_warning)}</small></div><div class="insight-kpis pe-kpis"><article><span>${t().universe}</span><strong>${finite(referenceCount(state.code)) ? integer(referenceCount(state.code)) : "—"}</strong><small>${slug(coverage.comparison_perimeter)}</small></article><article><span>${t().stored}</span><strong>${integer(manifest.record_count)}</strong><small>${integer(manifest.represented_entity_count)} ${t().represented}</small></article><article><span>${t().finance}</span><strong>${integer(manifest.financial_record_count)}</strong><small>${manifest.record_count ? numeric(manifest.financial_record_count / manifest.record_count * 100, 1) : 0}% ${t().rows}</small></article><article><span>${t().sources}</span><strong>${integer(sources.size)}</strong><small>${statusFor(state.code)}</small></article></div>${coverageTable()}${sourceLayers()}${aggregates()}${diagnostics()}`;
  }

  function matchingRecords() {
    if (!state.shard) return [];
    const q = state.query.trim().toLocaleLowerCase(locale());
    const records = state.shard.records.filter(record => {
      if (state.perimeter && value(record,"perimeter") !== state.perimeter) return false;
      if (state.entityClass && value(record,"entity_class") !== state.entityClass) return false;
      if (!q) return true;
      return ["name","national_id","controlling_authority"].some(field => String(value(record,field) || "").toLocaleLowerCase(locale()).includes(q));
    });
    records.sort((a,b) => {
      if (state.sort === "revenue" || state.sort === "employees") {
        const field = state.sort, av=Number(value(a,field) ?? -Infinity), bv=Number(value(b,field) ?? -Infinity);
        return bv-av || String(value(a,"name")).localeCompare(String(value(b,"name")),locale());
      }
      return String(value(a,"name")).localeCompare(String(value(b,"name")),locale());
    });
    return records;
  }
  function options(field, allLabel) {
    return `<option value="">${allLabel}</option>${(state.shard.dictionaries[field] || []).filter(Boolean).map(item => `<option value="${esc(item)}" ${item === state[field === "entity_class" ? "entityClass" : field] ? "selected" : ""}>${slug(item)}</option>`).join("")}`;
  }
  function directory() {
    const records = matchingRecords(), pages = Math.max(1,Math.ceil(records.length/100)); state.page=Math.min(state.page,pages);
    const visible=records.slice((state.page-1)*100,state.page*100), represented=records.reduce((sum,row)=>sum+(Number(value(row,"body_count"))||1),0);
    const unit = row => [value(row,"monetary_unit"),value(row,"currency")].filter(Boolean).join(" ");
    return `<article class="pe-directory"><header><div><span>${t().directory}</span><p>${t().directoryCopy}</p></div><div><a href="data/public-entity-directory/${state.code}.v1.json" download>${t().downloadJson} ↓</a><button type="button" data-download-csv>${t().downloadCsv} ↓</button></div></header><div class="pe-filters"><label><span>${t().search}</span><input type="search" data-pe-search value="${esc(state.query)}" placeholder="${t().search}"></label><label><span>${t().perimeter}</span><select data-pe-perimeter>${options("perimeter",t().allPerimeters)}</select></label><label><span>${state.lang === "en" ? "Entity type" : "Typ subjektu"}</span><select data-pe-class>${options("entity_class",t().allClasses)}</select></label><label><span>${state.lang === "en" ? "Sort" : "Řazení"}</span><select data-pe-sort><option value="name" ${state.sort === "name" ? "selected" : ""}>${t().sortName}</option><option value="revenue" ${state.sort === "revenue" ? "selected" : ""}>${t().sortRevenue}</option><option value="employees" ${state.sort === "employees" ? "selected" : ""}>${t().sortEmployees}</option></select></label></div><div class="pe-directory-meta"><b>${integer(records.length)} ${t().shown}</b><span>${integer(represented)} ${t().represented}</span><span>${state.page} / ${pages}</span></div><div class="pe-table-scroll"><table><thead><tr><th>${label("name")}</th><th>${label("entity_class")}</th><th>${label("controlling_authority")}</th><th>${label("revenue")}</th><th>${label("employees")}</th><th>${t().period}</th></tr></thead><tbody>${visible.map((record,index) => `<tr><td><button type="button" data-record="${(state.page-1)*100+index}"><b>${esc(value(record,"name"))}</b><small>${esc(value(record,"national_id") || value(record,"record_id"))}</small></button></td><td>${slug(value(record,"entity_class"))}</td><td>${esc(value(record,"controlling_authority") || "—")}</td><td>${finite(value(record,"revenue")) ? `${formatValue(value(record,"revenue"))} ${esc(unit(record))}` : "—"}</td><td>${finite(value(record,"employees")) ? integer(value(record,"employees")) : "—"}</td><td>${esc(value(record,"financial_period") || value(record,"period") || "—")}</td></tr>`).join("")}</tbody></table></div><div class="pe-pagination"><button type="button" data-page="${state.page-1}" ${state.page === 1 ? "disabled" : ""}>← ${t().previous}</button><span>${integer(records.length)} ${t().rows}</span><button type="button" data-page="${state.page+1}" ${state.page === pages ? "disabled" : ""}>${t().next} →</button></div><aside class="pe-inspector">${inspector()}</aside></article>`;
  }
  function inspector() {
    if (!state.selected) return `<header><span>${t().details}</span></header><p>${t().choose}</p>`;
    const record=state.selected;
    return `<header><div><span>${t().details}</span><h3>${esc(value(record,"name"))}</h3></div><button type="button" data-close-inspector>${t().close}</button></header><dl>${state.shard.fields.map(field => {
      const item=value(record,field); if (item === null || item === "") return "";
      const rendered=field === "source_url" ? `<a href="${esc(item)}" target="_blank" rel="noreferrer">${esc(item)} ↗</a>` : esc(item);
      return `<div><dt>${label(field)}</dt><dd>${rendered}</dd></div>`;
    }).join("")}</dl>`;
  }
  function bindDirectory() {
    root.querySelector("[data-pe-search]")?.addEventListener("input", event => {const cursor=event.target.selectionStart;state.query=event.target.value;state.page=1;renderDirectoryOnly();const input=root.querySelector("[data-pe-search]");input?.focus();input?.setSelectionRange(cursor,cursor)});
    root.querySelector("[data-pe-perimeter]")?.addEventListener("change", event => {state.perimeter=event.target.value;state.page=1;state.selected=null;renderDirectoryOnly()});
    root.querySelector("[data-pe-class]")?.addEventListener("change", event => {state.entityClass=event.target.value;state.page=1;state.selected=null;renderDirectoryOnly()});
    root.querySelector("[data-pe-sort]")?.addEventListener("change", event => {state.sort=event.target.value;state.page=1;renderDirectoryOnly()});
    root.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click",()=>{state.page=Number(button.dataset.page);renderDirectoryOnly()}));
    root.querySelectorAll("[data-record]").forEach(button => button.addEventListener("click",()=>{state.selected=matchingRecords()[Number(button.dataset.record)];renderDirectoryOnly();root.querySelector(".pe-inspector")?.scrollIntoView({behavior:"smooth",block:"nearest"})}));
    root.querySelector("[data-close-inspector]")?.addEventListener("click",()=>{state.selected=null;renderDirectoryOnly()});
    root.querySelector("[data-download-csv]")?.addEventListener("click",downloadCsv);
  }
  function bindCountries() {
    root.querySelectorAll("[data-country]").forEach(button => button.addEventListener("click",()=>{
      const select=document.querySelector("#country-switch"); if(select){select.value=button.dataset.country;select.dispatchEvent(new Event("change",{bubbles:true}))}
    }));
  }
  function renderDirectoryOnly() {
    const old=root.querySelector(".pe-directory"); if(!old)return;
    const holder=document.createElement("div");holder.innerHTML=directory();old.replaceWith(holder.firstElementChild);bindDirectory();
  }
  function downloadCsv() {
    const records=matchingRecords(), fields=state.shard.fields;
    const quote=item=>`"${String(item ?? "").replaceAll('"','""')}"`;
    const csv=[fields.map(quote).join(","),...records.map(record=>fields.map(field=>quote(value(record,field))).join(","))].join("\n");
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));link.download=`public-entities-${state.code}.csv`;link.click();URL.revokeObjectURL(link.href);
  }
  async function loadCountry() {
    const request=++state.request; state.shard=null;state.selected=null;state.query="";state.perimeter="";state.entityClass="";state.page=1;
    root.innerHTML=`<p class="pe-loading">${t().loading}</p>`;
    if(!state.manifest?.countries?.some(country=>country.country_code===state.code)) {
      root.innerHTML=`<p class="pe-loading">${state.lang==="en"?"A country-level public-entity register is not loaded for this profile.":"Registr veřejných subjektů na úrovni země není pro tento profil načten."}</p>`;
      return;
    }
    const response=await fetch(`data/public-entity-directory/${state.code}.v1.json`);if(!response.ok)throw new Error(`${state.code}: ${response.status}`);
    const shard=await response.json();if(request!==state.request)return;state.shard=shard;render();
  }
  function render() {
    if(!state.coverage||!state.aggregates||!state.manifest||!state.shard)return;
    document.querySelector('[data-insight-nav="entities"]')?.replaceChildren(document.createTextNode(state.lang === "en" ? "Entities" : "Subjekty"));
    root.innerHTML=`${summary()}${directory()}`;bindCountries();bindDirectory();
  }
  addEventListener("countryprofilechange",event=>{
    const changed=state.code!==event.detail.code;state.code=event.detail.code;state.lang=event.detail.lang === "en" ? "en" : "cs";
    if(changed)loadCountry().catch(error=>{root.innerHTML=`<p>${esc(error.message)}</p>`;console.error("Public entity directory",error)});else render();
  });
  Promise.all([fetch("data/public-entity-coverage.v1.json"),fetch("data/public-entity-aggregates.v1.json"),fetch("data/public-entity-directory/manifest.v1.json")]).then(async responses=>{
    for(const response of responses)if(!response.ok)throw new Error(response.status);
    [state.coverage,state.aggregates,state.manifest]=await Promise.all(responses.map(response=>response.json()));return loadCountry();
  }).catch(error=>{root.innerHTML=`<p>${esc(error.message)}</p>`;console.error("Public entity coverage",error)});
})();
