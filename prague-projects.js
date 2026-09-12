(() => {
  const DATA_URL = "/data/prague-accountability.v1.json";
  const state = { data: null, entity: "all", status: "all", open: null };
  const html = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const lang = () => document.documentElement.lang === "en" ? "en" : "cs";
  const choose = (cs, en) => lang() === "en" ? en : cs;
  const locale = () => lang() === "en" ? "en-GB" : "cs-CZ";
  const fmt = (value, digits = 1) => new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(value);
  const money = (value) => {
    if (!Number.isFinite(value)) return "—";
    const abs = Math.abs(value);
    if (abs >= 1e9) return choose(`${fmt(abs / 1e9, 2)} mld. Kč`, `CZK ${fmt(abs / 1e9, 2)}bn`);
    if (abs >= 1e6) return choose(`${fmt(abs / 1e6, 1)} mil. Kč`, `CZK ${fmt(abs / 1e6, 1)}m`);
    return choose(`${fmt(abs, 0)} Kč`, `CZK ${fmt(abs, 0)}`);
  };
  const pct = (share) => Number.isFinite(share) ? `${fmt(share * 100, 1)} %` : "—";
  const $ = (id) => document.getElementById(id);

  const statusLabels = {
    stuck: ["Uvízlo", "Stuck", "red"], abandoned: ["Opuštěno", "Abandoned", "gray"],
    stalled_in_study: ["Uvízlo ve studii", "Stuck in study", "red"], delivered_elsewhere: ["Dodáno jinudy", "Delivered elsewhere", "green"],
    blocked_by_dependency: ["Blokováno závislostí", "Blocked by dependency", ""], lapsed_reprocured: ["Propadlo, znovu soutěženo", "Lapsed, re-procured", ""],
    no_resolution_found: ["Bez usnesení", "No resolution", "red"], design_contract_collapsed: ["Soutěž zkolabovala", "Design contract collapsed", ""],
    permitting_halted: ["Povolování zastaveno", "Permitting halted", ""], sequenced_behind_other_project: ["Čeká na jinou stavbu", "Waits on another project", ""],
    identity_unresolved: ["Identita nejasná", "Identity unresolved", "gray"], unblocking: ["Odblokováno", "Unblocking", "green"], not_found: ["Nenalezeno", "Not found", "gray"],
  };
  const confidenceLabels = { high: ["vysoká jistota", "high confidence"], medium: ["střední jistota", "medium confidence"], low: ["nízká jistota", "low confidence"] };
  const checkLabels = {
    execution_measured_from_accounting_stream: ["plnění měřeno z účetnictví, ne z přehledu akcí", "execution measured from the accounting stream, not the events feed"],
    broken_feed_years_excluded_from_spend: ["roky s poškozeným zveřejněním vyloučeny z čerpání", "broken publication years excluded from spend"],
    stuck_projects_have_three_or_more_trusted_years: ["každý uvízlý projekt má 3+ důvěryhodné roky", "every stuck project has 3+ trusted years"],
    stuck_projects_confirmed_by_events_feed: ["přehled akcí potvrzuje nulové čerpání", "the events feed confirms zero spend"],
    traces_reference_published_events: ["každá stopa rozhodnutí odkazuje na zveřejněnou akci", "every decision trail references a published event"],
    input_digests_pinned: ["vstupní tabulky mají připnuté otisky SHA-256", "input tables carry pinned SHA-256 digests"],
    city_baseline_trusted_years_within_band: ["důvěryhodné roky města leží v pásmu 70–95 %", "trusted city years fall within the 70–95% band"],
    compare_year_excludes_broken_feeds: ["srovnávací rok neobsahuje poškozené feedy", "the comparison year contains no broken feeds"],
  };
  const chip = (code) => { const [cs, en, tone] = statusLabels[code] || [code, code, "gray"]; return `<span class="pp-chip ${tone}">${html(choose(cs, en))}</span>`; };

  function translateStatic() {
    document.querySelectorAll("[data-cs][data-en]").forEach((node) => {
      const value = node.dataset[lang()];
      if (!value.includes("<br>")) { node.textContent = value; return; }
      node.replaceChildren(...value.split("<br>").flatMap((part, index) => index ? [document.createElement("br"), document.createTextNode(part)] : [document.createTextNode(part)]));
    });
    const title = choose("Projekty Prahy: co město rozpočtuje a nestaví — Public Spending Data", "Prague projects: what the city budgets and never builds — Public Spending Data");
    const description = choose("Registr uvízlých projektů hl. m. Prahy: akce rozpočtované tři a více let bez čerpání, plnění rozpočtu 2018–2026, stopy rozhodnutí rady a integrita zveřejněných dat.", "Prague's stuck-project register: events budgeted three or more years without spend, budget execution 2018–2026, council decision trails and publication integrity.");
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  }

  function renderHeadline() {
    const { execution_baseline: baseline, stuck_summary: summary, carry_forward: carry, broken_feeds: broken } = state.data;
    const trusted = baseline.filter((row) => row.trusted && !row.partial_year).map((row) => row.execution_share * 100);
    const lo = Math.round(Math.min(...trusted)), hi = Math.round(Math.max(...trusted));
    $("pp-baseline-headline").textContent = choose(`Praha utratí ${lo}–${hi} % toho, co schválí. Každý rok.`, `Prague spends ${lo}–${hi}% of what it approves. Every year.`);
    const city = broken.find((row) => row.year === 2025 && row.entity === state.data.entity.cityvizor_name);
    $("pp-baseline-note").textContent = city
      ? choose(`Rok 2025 ukazuje ${fmt(city.execution_share * 100, 0)} %. To není hospodaření: ${city.note_cs}`, `2025 shows ${fmt(city.execution_share * 100, 0)}%. That is not spending behaviour: ${city.note_en}`)
      : $("pp-baseline-note").dataset[lang()];
    $("pp-kpi-projects").textContent = fmt(summary.projects, 0);
    $("pp-kpi-budget").textContent = money(summary.cum_budget_czk);
    $("pp-kpi-live").textContent = fmt(summary.still_live_2026, 0);
    $("pp-kpi-live").classList.add("red");
    $("pp-kpi-abandoned").textContent = choose(`${fmt(summary.abandoned, 0)} tiše opuštěno, nikdy nepostaveno`, `${fmt(summary.abandoned, 0)} quietly abandoned, never built`);
    $("pp-kpi-carry").textContent = fmt(carry.cases, 0);
  }

  function renderBaseline() {
    const rows = state.data.execution_baseline;
    $("pp-baseline-columns").innerHTML = rows.map((row) => {
      const cls = !row.trusted ? "broken" : row.partial_year ? "partial" : "";
      const height = Math.max(2, Math.round(row.execution_share * 180));
      return `<div class="${cls}"><span>${pct(row.execution_share)}</span><b style="height:${height}px" title="${html(money(row.actual_czk))} / ${html(money(row.budget_czk))}"></b><small>${row.year}${!row.trusted ? " ✱" : row.partial_year ? " ◌" : ""}</small></div>`;
    }).join("");
    $("pp-broken").innerHTML = state.data.broken_feeds.map((row) => `<div><b>✱ ${html(row.entity)} ${row.year}</b><span>${html(lang() === "en" ? row.note_en : row.note_cs)}</span></div>`).join("")
      + `<div><b>◌ ${state.data.rules ? 2026 : ""}</b><span>${html(choose("Částečný rok: data platná k únoru až srpnu 2026 podle profilu. Nesrovnává se napříč profily.", "Partial year: data valid to February–August 2026 depending on the profile. Never compared across profiles."))}</span></div>`;
  }

  function trajectoryText(project) {
    const byYear = new Map(project.trajectory.map((t) => [t.year, t]));
    const parts = [];
    for (let year = project.first_year; year <= project.last_year; year += 1) {
      const t = byYear.get(year);
      parts.push(t ? `${fmt(t.budget_czk / 1e6, 2)}${t.trusted ? "" : "<i>✱</i>"}` : "—");
    }
    return parts.join(" · ");
  }

  function detailMarkup(project) {
    const peak = Math.max(...project.trajectory.map((t) => t.budget_czk));
    const bars = project.trajectory.map((t) => {
      const h = Math.max(2, Math.round((t.budget_czk / peak) * 100));
      const a = t.budget_czk ? Math.round(Math.min(1, t.actual_czk / t.budget_czk) * h) : 0;
      return `<div class="${t.trusted ? "" : "broken"}"><span>${fmt(t.budget_czk / 1e6, 2)}</span><b style="height:${h}px"><i style="height:${a}px"></i></b></div>`;
    }).join("");
    const years = project.trajectory.map((t) => `<span class="${t.trusted ? "" : "broken"}">${t.year}${t.trusted ? "" : " ✱"}</span>`).join("");
    const trace = project.trace;
    let traceMarkup;
    if (!trace) {
      traceMarkup = `<h3>${html(choose("Stopa rozhodnutí", "Decision trail"))}</h3><p class="none">${html(choose("Zatím bez rešerše. Registr roste projekt po projektu; tenhle ještě nikdo neotevřel.", "Not yet researched. The register grows one project at a time; nobody has opened this one yet."))}</p>`;
    } else {
      const resolutions = trace.resolutions.length
        ? `<table>${trace.resolutions.map((r) => `<tr><td>${html(r.date)}</td><td><a href="${html(r.url)}" target="_blank" rel="noopener">${html(r.body)} č. ${html(r.number)}</a><br><span>${html(r.title)}</span></td></tr>`).join("")}</table>`
        : `<p class="none">${html(choose("Žádné usnesení rady ani zastupitelstva, které by projekt jmenovalo.", "No council or assembly resolution names this project."))}</p>`;
      const sources = trace.sources.length ? `<div class="pp-sources">${trace.sources.map((s) => `<a href="${html(s.url)}" target="_blank" rel="noopener">${html(s.label)} ↗</a>`).join("")}</div>` : "";
      const [ccs, cen] = confidenceLabels[trace.confidence] || [trace.confidence, trace.confidence];
      traceMarkup = `<h3>${html(choose("Stopa rozhodnutí", "Decision trail"))} ${chip(trace.status)} <span class="pp-chip gray">${html(choose(ccs, cen))}</span></h3><p>${html(lang() === "en" ? trace.verdict_en : trace.verdict_cs)}</p>${resolutions}${sources}`;
    }
    return `<tr class="pp-detail"><td colspan="7"><div class="pp-detail-grid"><div><div class="pp-mini">${bars}</div><div class="pp-mini-years">${years}</div><div class="pp-legend"><span><i></i>${html(choose("rozpočet", "budget"))}</span><span><i class="ink"></i>${html(choose("utraceno", "spent"))}</span><span>✱ ${html(choose("poškozené zveřejnění", "broken publication"))}</span></div></div><div class="pp-trace">${traceMarkup}</div></div></td></tr>`;
  }

  function filteredProjects() {
    return state.data.stuck_projects.filter((p) => (state.entity === "all" || p.entity === state.entity)
      && (state.status === "all" || (state.status === "live" && p.still_live_2026) || (state.status === "abandoned" && !p.still_live_2026) || (state.status === "traced" && p.trace)));
  }

  function renderRegister() {
    const entities = [...new Set(state.data.stuck_projects.map((p) => p.entity))].sort((a, b) => a.localeCompare(b, "cs"));
    const select = $("pp-filter-entity");
    select.innerHTML = `<option value="all">${html(choose("Všechny", "All"))}</option>` + entities.map((e) => `<option value="${html(e)}">${html(e)}</option>`).join("");
    select.value = state.entity;
    $("pp-filter-status").value = state.status;
    const rows = filteredProjects();
    $("pp-count").textContent = choose(`${fmt(rows.length, 0)} projektů · ${money(rows.reduce((s, p) => s + p.cum_budget_czk, 0))}`, `${fmt(rows.length, 0)} projects · ${money(rows.reduce((s, p) => s + p.cum_budget_czk, 0))}`);
    $("pp-rows").innerHTML = rows.map((p) => {
      const key = `${p.entity}|${p.event_id}`;
      const verdict = p.trace ? chip(p.trace.status) : chip(p.still_live_2026 ? "stuck" : "abandoned");
      const corrupted = p.name_corrupted_at_source ? ` <span class="pp-chip gray" title="${html(choose("název ve zdroji poškozen, opraveno vzorem", "name corrupted at source, pattern-repaired"))}">✱</span>` : "";
      return `<tr class="pp-row${state.open === key ? " open" : ""}" data-key="${html(key)}"><td><strong>${html(p.name)}</strong>${corrupted}</td><td>${html(p.entity)}</td><td>${p.first_year}–${String(p.last_year).slice(2)} · ${p.years_budgeted}</td><td class="num">${html(money(p.cum_budget_czk))}</td><td class="num${p.cum_actual_czk === 0 ? " red" : ""}">${p.cum_actual_czk === 0 ? "0" : html(money(p.cum_actual_czk))}</td><td class="traj">${trajectoryText(p)}</td><td>${verdict}</td></tr>${state.open === key ? detailMarkup(p) : ""}`;
    }).join("");
    const excluded = state.data.stuck_summary.excluded;
    const provision = excluded.provision || { count: 0, cum_budget_czk: 0 };
    $("pp-excluded").textContent = choose(
      `Co tu není: ${fmt(provision.count, 0)} rezerv a provizí za ${money(provision.cum_budget_czk)} — nečerpají se záměrně. Mechanické přepisy celkem: ${fmt(state.data.carry_forward.cases, 0)} případů u ${fmt(state.data.carry_forward.projects, 0)} projektů, ${money(state.data.carry_forward.budget_czk)} opsaného rozpočtu.`,
      `Not shown: ${fmt(provision.count, 0)} reserves and provisions worth ${money(provision.cum_budget_czk)} — unspent by design. Carry-forwards overall: ${fmt(state.data.carry_forward.cases, 0)} cases across ${fmt(state.data.carry_forward.projects, 0)} projects, ${money(state.data.carry_forward.budget_czk)} of copied budget.`);
  }

  function renderCompare() {
    const { rows, year } = state.data.district_compare;
    const districts = rows.filter((r) => !r.is_city).map((r) => r.execution_share).sort((a, b) => a - b);
    const median = districts.length ? districts[Math.floor(districts.length / 2)] : null;
    $("pp-compare").innerHTML = `<span class="head">${html(choose("Entita", "Entity"))}</span><span class="head">${year}</span><span class="head" style="text-align:right">${html(choose("Plnění", "Execution"))}</span><span class="head" style="text-align:right">${html(choose("Rozpočet", "Budget"))}</span>`
      + rows.map((r) => {
        const flag = r.review_flag ? ` <span class="pp-chip gray" title="${html(lang() === "en" ? r.review_flag.note_en : r.review_flag.note_cs)}">${html(choose("prověřit", "check"))}</span>` : "";
        const tone = r.is_city ? "city" : r.review_flag ? "flag" : "";
        return `<span class="name">${r.is_city ? "<strong>" : ""}${html(r.entity)}${r.is_city ? "</strong>" : ""}${flag}</span><div class="bar"><i class="${tone}" style="width:${Math.round(r.execution_share * 100)}%"></i></div><span class="pct">${pct(r.execution_share)}</span><span class="bud">${html(money(r.budget_czk))}</span>`;
      }).join("")
      + `<p class="pp-compare-note" style="grid-column:1/-1">${html(choose(`Medián městských částí: ${pct(median)}. Kolovraty: ${rows.find((r) => r.review_flag)?.review_flag.note_cs || ""}`, `District median: ${pct(median)}. Kolovraty: ${rows.find((r) => r.review_flag)?.review_flag.note_en || ""}`))}</p>`;
  }

  function renderIntegrity() {
    const { integrity, sources } = state.data;
    $("pp-integrity").textContent = integrity.status === "passed" ? choose("PROŠLO", "PASSED") : choose("SELHALO", "FAILED");
    $("pp-checks").innerHTML = Object.entries(integrity.checks).map(([code, ok]) => { const [cs, en] = checkLabels[code] || [code, code]; return `<div class="coverage-check"><b>${ok ? "✓" : "×"}</b>${html(choose(cs, en))}</div>`; }).join("");
    $("pp-limitations").innerHTML = integrity[`limitations_${lang()}`].map((text) => `<div class="coverage-limitation"><b>!</b>${html(text)}</div>`).join("");
    $("pp-sources").innerHTML = sources.map((s) => `<a class="source-entry" href="${html(s.url)}" target="_blank" rel="noopener"><span>${html(s.id)}</span><strong>${html(lang() === "en" ? s.label_en : s.label_cs)}</strong></a>`).join("");
  }

  function render() {
    if (!state.data) return;
    translateStatic(); renderHeadline(); renderBaseline(); renderRegister(); renderCompare(); renderIntegrity();
    window.psdLanguageReady?.(); dispatchEvent(new Event("psdlanguageready"));
  }

  $("pp-filter-entity").addEventListener("change", (event) => { state.entity = event.target.value; renderRegister(); });
  $("pp-filter-status").addEventListener("change", (event) => { state.status = event.target.value; renderRegister(); });
  $("pp-rows").addEventListener("click", (event) => {
    const row = event.target.closest("tr.pp-row");
    if (!row || event.target.closest("a")) return;
    state.open = state.open === row.dataset.key ? null : row.dataset.key;
    renderRegister();
  });
  addEventListener("psdlanguagechange", render);
  fetch(DATA_URL).then((response) => { if (!response.ok) throw new Error(`Prague accountability data ${response.status}`); return response.json(); }).then((data) => { state.data = data; render(); }).catch((error) => {
    translateStatic();
    $("pp-integrity").textContent = choose("CHYBA", "ERROR");
    $("pp-rows").innerHTML = `<tr><td colspan="7">${html(error.message)}</td></tr>`;
    window.psdLanguageReady?.(); dispatchEvent(new Event("psdlanguageready"));
  });
})();
