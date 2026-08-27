(() => {
  const DATA_URL = "/data/accountability/cze-regions.v1.json";
  const state = { data: null, regionId: null, functionCode: null };
  const html = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const lang = () => document.documentElement.lang === "en" ? "en" : "cs";
  const choose = (cs, en) => lang() === "en" ? en : cs;
  const locale = () => lang() === "en" ? "en-GB" : "cs-CZ";
  const money = (value) => {
    if (!Number.isFinite(value)) return "—";
    const abs = Math.abs(value), sign = value < 0 ? "−" : "";
    const [divisor, suffixCs, suffixEn] = abs >= 1e9 ? [1e9," mld. Kč","bn CZK"] : abs >= 1e6 ? [1e6," mil. Kč","m CZK"] : [1," Kč"," CZK"];
    const formatted = new Intl.NumberFormat(locale(), {maximumFractionDigits:1}).format(abs / divisor);
    return lang() === "en" ? `${sign}${formatted} ${suffixEn}` : `${sign}${formatted}${suffixCs}`;
  };
  const percent = (value) => Number.isFinite(value) ? new Intl.NumberFormat(locale(), {style:"percent",maximumFractionDigits:1}).format(value) : "—";
  const labelFromCode = (value) => String(value).replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

  const roleLabels = {
    sets_legal_framework:["stanoví zákonný rámec","sets legal framework"], sets_regional_policy:["stanoví krajskou politiku","sets regional policy"],
    approves_budget:["schvaluje rozpočet","approves budget"], approves_final_account:["schvaluje závěrečný účet","approves final account"], owns_assets:["vlastní majetek","owns assets"],
    proposes_budget:["navrhuje rozpočet","proposes budget"], implements_budget:["plní rozpočet","implements budget"], manages_assets:["spravuje majetek","manages assets"],
    reviews_financial_management:["přezkoumává hospodaření","reviews financial management"], publishes_execution_data:["zveřejňuje plnění","publishes execution"],
    assigns_mandate:["svěřuje působnost","assigns mandate"], sets_rules:["stanoví pravidla","sets rules"], funds_contribution:["financuje příspěvek","funds contribution"], supervises:["dohlíží","supervises"],
    administers:["vykonává agendu","administers"], decides_cases:["rozhoduje případy","decides cases"], supervises_delegated_municipal_tasks:["kontroluje přenesenou působnost obcí","supervises delegated municipal tasks"],
    sets_curriculum_and_standards:["stanoví kurikulum a standardy","sets curriculum and standards"], determines_direct_education_funding:["určuje přímé financování","determines direct funding"], funds_direct_costs:["hradí přímé náklady","funds direct costs"],
    plans_school_network:["plánuje síť škol","plans school network"], founds_and_closes_regional_schools:["zřizuje a ruší krajské školy","founds and closes regional schools"], funds_operations_and_investment:["hradí provoz a investice","funds operations and investment"],
    employs_staff:["zaměstnává","employs staff"], delivers_service:["poskytuje službu","delivers service"], reports_results:["vykazuje výsledky","reports results"],
    sets_legal_and_technical_framework:["stanoví právní a technický rámec","sets legal and technical framework"], cofunds_selected_programmes:["spolufinancuje programy","co-funds programmes"], plans_network:["plánuje síť","plans network"], commissions_service:["objednává službu","commissions service"], sets_integrated_tariff_policy:["stanoví integrovaný tarif","sets integrated tariff policy"], funds_public_service_obligation:["hradí veřejnou službu","funds public-service obligation"], coordinates_local_transport:["koordinuje místní dopravu","coordinates local transport"], cofunds_selected_services:["spolufinancuje služby","co-funds services"], operates_service:["provozuje službu","operates service"],
    sets_road_rules_and_standards:["stanoví pravidla silnic","sets road rules and standards"], cofunds_selected_investment:["spolufinancuje investice","co-funds investment"], approves_investment_strategy:["schvaluje investiční strategii","approves investment strategy"], funds_maintenance_and_investment:["hradí údržbu a investice","funds maintenance and investment"], commissions_works:["objednává práce","commissions works"], delivers_maintenance:["provádí údržbu","delivers maintenance"],
    sets_health_rules_and_standards:["stanoví zdravotní pravidla","sets health rules and standards"], licenses_and_supervises_system:["licencuje a dohlíží","licenses and supervises"], purchases_covered_care:["nakupuje hrazenou péči","purchases covered care"], funds_provider_activity:["hradí činnost poskytovatelů","funds provider activity"], founds_or_owns_regional_providers:["zakládá nebo vlastní poskytovatele","founds or owns providers"], sets_owner_strategy:["stanoví vlastnickou strategii","sets owner strategy"], funds_emergency_service:["hradí záchrannou službu","funds emergency service"], exercises_owner_control:["vykonává vlastnickou kontrolu","exercises owner control"], delivers_care:["poskytuje péči","delivers care"], operates_emergency_service:["provozuje záchrannou službu","operates emergency service"], reports_quality_and_finance:["vykazuje kvalitu a finance","reports quality and finance"],
    sets_entitlement_and_quality_rules:["stanoví nároky a kvalitu","sets entitlement and quality rules"], funds_state_grants:["financuje státní dotace","funds state grants"], plans_regional_network:["plánuje krajskou síť","plans regional network"], allocates_grants:["rozděluje dotace","allocates grants"], commissions_and_cofunds_services:["objednává a spolufinancuje","commissions and co-funds"], plans_local_access:["plánuje místní dostupnost","plans local access"], cofunds_services:["spolufinancuje služby","co-funds services"], delivers_selected_services:["poskytuje vybrané služby","delivers selected services"],
    sets_national_policy:["stanoví národní politiku","sets national policy"], funds_national_and_eu_programmes:["financuje národní a EU programy","funds national and EU programmes"], approves_regional_development_programme:["schvaluje program rozvoje","approves development programme"], approves_regional_spatial_planning_documents:["schvaluje krajské zásady plánování","approves regional spatial plans"], administers_planning_procedure:["vede plánovací řízení","administers planning procedure"], coordinates_municipal_planning:["koordinuje obecní plánování","coordinates municipal planning"], approves_local_spatial_plan:["schvaluje místní plán","approves local plan"], implements_local_development:["realizuje místní rozvoj","implements local development"],
    sets_heritage_rules:["stanoví pravidla památkové péče","sets heritage rules"], cofunds_programmes:["spolufinancuje programy","co-funds programmes"], founds_and_owns_regional_institutions:["zřizuje a vlastní instituce","founds and owns institutions"], funds_operations_and_investment:["hradí provoz a investice","funds operations and investment"], manages_collections_and_assets:["spravuje sbírky a majetek","manages collections and assets"],
    supervises_delegated_administration:["dohlíží na přenesenou správu","supervises delegated administration"], sets_regional_environment_policy:["stanoví krajskou politiku ŽP","sets regional environmental policy"], approves_selected_plans:["schvaluje vybrané plány","approves selected plans"], administers_permits_and_appeals:["vede povolení a odvolání","administers permits and appeals"], supervises_selected_municipal_administration:["kontroluje vybranou obecní správu","supervises selected municipal administration"],
    funds_selected_investment:["hradí vybrané investice","funds selected investment"], funds_programmes:["financuje programy","funds programmes"]
  };
  const roleLabel = (code) => roleLabels[code]?.[lang() === "en" ? 1 : 0] || labelFromCode(code);
  const mechanismLabels = {
    electoral:["Volby","Elections"], political_and_budgetary:["Politická a rozpočtová kontrola","Political and budgetary control"], external_financial_review:["Vnější přezkum hospodaření","External financial review"], administrative_hierarchy:["Správní dohled","Administrative supervision"], public_transparency:["Veřejné výkaznictví","Public reporting"], judicial:["Soudní přezkum","Judicial review"]
  };
  const typeLabel = (code, dictionary) => dictionary[code]?.[lang() === "en" ? 1 : 0] || labelFromCode(code);
  const codeLabels = {
    national_competence:["celostátní pravomoc","national competence"], self_government:["samospráva","self-government"], state_oversight:["státní dohled","state oversight"], state_administration:["státní správa","state administration"], delegated_state_administration:["přenesená státní správa","delegated state administration"], public_service_provider:["veřejný poskytovatel","public service provider"], municipal_self_government:["obecní samospráva","municipal self-government"], contracted_service_provider:["smluvní poskytovatel","contracted service provider"], social_insurance:["veřejné pojištění","social insurance"], mixed_self_and_delegated_administration:["smíšená samostatná a přenesená působnost","mixed self and delegated administration"],
    shared_tax:["sdílená daň","shared tax"], earmarked_transfer:["účelový transfer","earmarked transfer"], mandate_contribution:["příspěvek na svěřenou agendu","mandate contribution"], programme_transfer:["programový transfer","programme transfer"], fees_property_and_service_income:["poplatky, majetek a služby","fees, property and services"], asset_disposal_and_capital_receipts:["prodej majetku a kapitálové příjmy","asset disposal and capital receipts"], financing:["financování","financing"],
    general_revenue_subject_to_law:["obecný příjem podle zákona","general revenue subject to law"], restricted_to_eligible_direct_education_costs:["omezeno na uznatelné přímé výdaje vzdělávání","restricted to eligible direct education costs"], linked_to_delegated_state_administration:["vázáno na přenesenou státní správu","linked to delegated state administration"], programme_specific:["podle pravidel programu","programme-specific"], generally_regional:["obecně v dispozici kraje","generally regional"], regional_subject_to_budget_rules:["krajské použití podle rozpočtových pravidel","regional, subject to budget rules"], approved_regional_budget:["schválený krajský rozpočet","approved regional budget"],
    regional_self_government_policy_and_results:["politika a výsledky krajské samosprávy","regional self-government policy and results"], regional_budget_budget_amendments_final_account_and_financial_statements:["rozpočet, změny, závěrečný účet a účetní závěrka","budget, amendments, final account and statements"], regional_financial_management_and_compliance:["hospodaření kraje a soulad s právem","regional financial management and compliance"], legality_and_execution_of_delegated_state_administration:["zákonnost a výkon přenesené státní správy","legality and execution of delegated state administration"], budget_proposal_approved_budget_amendments_execution_and_final_account:["návrh, schválení, změny, plnění a závěrečný účet","proposal, approval, amendments, execution and final account"], legality_of_public_administration:["zákonnost veřejné správy","legality of public administration"],
    four_year_cycle:["čtyřletý cyklus","four-year cycle"], annual_and_in_year_amendments:["ročně a při změnách během roku","annual and in-year amendments"], annual:["ročně","annual"], continuous:["průběžně","continuous"], budget_cycle_and_monthly_reporting:["rozpočtový cyklus a měsíční výkaznictví","budget cycle and monthly reporting"], case_based:["podle jednotlivých případů","case-based"],
    high:["vysoká","high"], high_within_statute:["vysoká v mezích statutu","high within statute"], limited:["omezená","limited"], limited_subordinate_rules:["omezená podzákonná pravidla","limited subordinate rules"],
    assigned_tax_shares_and_equalisation_funds:["přidělené podíly na daních a vyrovnávací fondy","assigned tax shares and equalisation funds"], own_and_shared_taxes_equalisation:["vlastní a sdílené daně plus vyrovnání","own and shared taxes plus equalisation"], own_taxes_and_equalisation:["vlastní daně a vyrovnání","own taxes and equalisation"], regional_income_tax_and_grants:["regionální daň z příjmů a dotace","regional income tax and grants"], regionally_administered_taxes_less_contribution_to_state:["regionálně spravované daně po odvodu státu","regionally administered taxes less state contribution"], shared_taxes_and_transfers:["sdílené daně a transfery","shared taxes and transfers"], state_and_municipal_contributions:["státní a obecní příspěvky","state and municipal contributions"], state_taxes_federal_grants_and_borrowing:["státní daně, federální dotace a dluh","state taxes, federal grants and borrowing"],
    legal_basis:["právní základ","legal basis"], budget_execution:["plnění rozpočtu","budget execution"], methodology:["metodika","methodology"], transfer_methodology:["metodika transferu","transfer methodology"], comparative_methodology:["srovnávací metodika","comparative methodology"],
    fourteen_regional_entities_present:["přítomno všech 14 krajských rolí","all 14 regional roles present"], prague_dual_role_explicit:["dvojí role Prahy je výslovná","Prague dual role explicit"], municipalities_not_region_budget_children:["obce nejsou rozpočtovými dětmi kraje","municipalities are not regional budget children"], regional_revenue_components_reconcile:["složky příjmů krajů se rovnají součtu","regional revenue components reconcile"], every_function_has_assignments:["každá funkce má přiřazené role","every function has assignments"], responsibility_assignments_have_lineage:["každá role má zdroj","every assignment has lineage"], transfer_counterparty_gaps_explicit:["chybějící protistrany transferů jsou výslovné","transfer counterparty gaps explicit"], archetype_budget_coverage_explicit:["pokrytí rozpočtů archetypů je výslovné","archetype budget coverage explicit"]
  };
  const codeLabel = (code) => typeLabel(code, codeLabels);

  function translateStatic() {
    document.querySelectorAll("[data-cs][data-en]").forEach((node) => {
      const value = node.dataset[lang()];
      if (!value.includes("<br>")) { node.textContent = value; return; }
      const parts = value.split("<br>");
      node.replaceChildren(...parts.flatMap((part, index) => index ? [document.createElement("br"), document.createTextNode(part)] : [document.createTextNode(part)]));
    });
    const title = choose("Kdo řídí a financuje kraje — Public Spending Data", "Who governs and funds Czech regions — Public Spending Data");
    const description = choose("Auditovatelná mapa českých krajů: kdo rozhoduje, financuje, vlastní, poskytuje a kontroluje veřejné služby.", "An auditable map of Czech regions: who decides, funds, owns, delivers and oversees public services.");
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  }

  function renderSummary() {
    const data = state.data, scope = data.scope;
    document.querySelector("#coverage-entities").textContent = `${scope.entity_coverage.loaded} / ${scope.entity_coverage.expected}`;
    document.querySelector("#coverage-functions").textContent = scope.responsibility_coverage.function_count;
    document.querySelector("#coverage-assignments").textContent = scope.responsibility_coverage.assignment_count;
    const integrity = document.querySelector("#coverage-integrity"); integrity.textContent = data.integrity.status === "passed" ? choose("PROŠLO", "PASSED") : choose("SELHALO", "FAILED"); integrity.className = data.integrity.status;
  }

  function renderRegionOptions() {
    const select = document.querySelector("#region-select");
    if (!state.regionId) state.regionId = state.data.regional_entities.find((row) => !row.is_prague_dual_role)?.public_entity_id;
    select.innerHTML = state.data.regional_entities.map((row) => `<option value="${html(row.public_entity_id)}"${row.public_entity_id === state.regionId ? " selected" : ""}>${html(row.display_name)}</option>`).join("");
  }

  function renderFunding() {
    renderRegionOptions();
    const entity = state.data.regional_entities.find((row) => row.public_entity_id === state.regionId) || state.data.regional_entities[0];
    const category = [
      ["transfer_revenue", choose("Přijaté transfery", "Received transfers"), "var(--acc-transfer)"],
      ["tax_revenue", choose("Daňové příjmy — převážně sdílené daně", "Tax revenue — predominantly shared taxes"), "var(--acc-tax)"],
      ["nontax_revenue", choose("Nedaňové příjmy", "Non-tax revenue"), "var(--acc-own)"],
      ["capital_revenue", choose("Kapitálové příjmy", "Capital revenue"), "var(--acc-capital)"],
    ];
    document.querySelector("#funding-entity-type").textContent = entity.is_prague_dual_role ? choose("Obecní i krajská role", "Municipal and regional role") : choose("Krajská účetní jednotka", "Regional accounting entity");
    document.querySelector("#funding-entity-name").textContent = entity.display_name;
    document.querySelector("#funding-total").textContent = money(entity.revenue_actual);
    document.querySelector("#funding-bars").innerHTML = category.map(([code,label,color]) => {
      const value = entity.revenue_composition[code], share = entity.revenue_composition_shares[`${code}_share`];
      return `<div class="funding-bar"><div><span>${html(label)}</span><strong>${html(money(value))}</strong><b>${html(percent(share))}</b></div><div class="funding-track"><i style="width:${Math.max(.2,share*100).toFixed(2)}%;background:${color}"></i></div></div>`;
    }).join("");
    const proxy = entity.fiscal_autonomy_proxies.own_source_upper_bound_share;
    document.querySelector("#autonomy-proxy").textContent = choose(`Horní orientační hranice vlastních příjmů (nedaňové + kapitálové): ${percent(proxy)}. Není to přesná míra volně použitelných peněz.`, `Upper-bound proxy for own revenue (non-tax + capital): ${percent(proxy)}. This is not an exact measure of unrestricted money.`);
  }

  function renderInstruments() {
    const rows = state.data.revenue_instruments.filter((row) => row.instrument_id !== "CZE:REGION_BORROWING");
    const actors = Object.fromEntries(state.data.actors.map((row) => [row.actor_id,row]));
    document.querySelector("#funding-instruments").innerHTML = rows.map((row) => `<article class="instrument-card"><span>${html(codeLabel(row.instrument_type))}</span><h3>${html(row[`name_${lang()}`])}</h3><p>${html(choose(`Pravidlo určuje: ${actors[row.rate_setter_actor_id]?.name_cs || row.rate_setter_actor_id}. Použití: ${codeLabel(row.regional_use_discretion)}.`, `Rule setter: ${actors[row.rate_setter_actor_id]?.name_en || row.rate_setter_actor_id}. Use: ${codeLabel(row.regional_use_discretion)}.`))}</p><b>${row.is_own_source_revenue ? choose("Vlastní zdroj", "Own source") : choose("Cizí pravidla / sdílený zdroj", "External rules / shared source")}</b></article>`).join("");
  }

  function renderFunctionOptions() {
    if (!state.functionCode) state.functionCode = "hospitals_and_emergency_medical_service";
    document.querySelector("#function-select").innerHTML = state.data.functions.map((row) => `<option value="${html(row.function_code)}"${row.function_code === state.functionCode ? " selected" : ""}>${html(row[`name_${lang()}`])}</option>`).join("");
  }

  function renderRoles() {
    renderFunctionOptions();
    const actors = Object.fromEntries(state.data.actors.map((row) => [row.actor_id,row]));
    const selected = state.data.functions.find((row) => row.function_code === state.functionCode) || state.data.functions[0];
    document.querySelector("#role-grid").innerHTML = selected.assignments.map((assignment, index) => {
      const actor = actors[assignment.actor_id];
      return `<article class="role-card"><span>${String(index+1).padStart(2,"0")} · ${html(codeLabel(assignment.capacity))}</span><h3>${html(actor?.[`name_${lang()}`] || assignment.actor_id)}</h3><div class="role-tags">${assignment.roles.map((role) => `<b>${html(roleLabel(role))}</b>`).join("")}</div></article>`;
    }).join("");
  }

  function renderMechanisms() {
    const actors = Object.fromEntries(state.data.actors.map((row) => [row.actor_id,row]));
    document.querySelector("#mechanism-grid").innerHTML = state.data.accountability_mechanisms.map((row, index) => `<article class="mechanism-card"><span>${String(index+1).padStart(2,"0")} · ${html(typeLabel(row.mechanism_type, mechanismLabels))}</span><h3>${html(actors[row.answerable_actor_id]?.[`name_${lang()}`] || row.answerable_actor_id)}</h3><div class="mechanism-arrow"><b>→</b><span>${html(actors[row.forum_actor_id]?.[`name_${lang()}`] || row.forum_actor_id)}</span></div><p>${html(codeLabel(row.scope))} · ${html(codeLabel(row.frequency))}</p></article>`).join("");
  }

  function renderRisks() {
    document.querySelector("#risk-grid").innerHTML = state.data.risk_hypotheses.map((row, index) => `<article class="risk-card"><header><span>${String(index+1).padStart(2,"0")}</span><b class="${row.testable_now ? "now" : "later"}">${row.testable_now ? choose("měřitelné nyní","testable now") : choose("potřebuje další data","needs more data")}</b></header><h3>${html(row[`name_${lang()}`])}</h3><p>${html(row[`caution_${lang()}`])}</p><div class="risk-signals"><strong>${choose("Signály","Signals")}</strong>${row.signals.map((signal) => `<code>${html(signal)}</code>`).join("")}</div></article>`).join("");
  }

  function renderArchetypes() {
    const autonomy = {very_low:["velmi nízká","very low"],none:["žádná","none"],medium:["střední","medium"],high:["vysoká","high"],high_for_assigned_services:["vysoká pro svěřené služby","high for assigned services"]};
    document.querySelector("#archetype-grid").innerHTML = state.data.international_archetypes.map((row) => `<article class="archetype-card${row.examples.includes("CZE") ? " current" : ""}"><span>${html(row.examples.join(" · "))}</span><h3>${html(row[`name_${lang()}`])}</h3><dl><div><dt>${choose("Zákonodárná moc","Legislative power")}</dt><dd>${html(codeLabel(row.legislative_power))}</dd></div><div><dt>${choose("Daňová autonomie","Tax autonomy")}</dt><dd>${html(typeLabel(row.tax_autonomy, autonomy))}</dd></div><div><dt>${choose("Hlavní financování","Main funding")}</dt><dd>${html(codeLabel(row.main_funding))}</dd></div></dl><small>${row.budget_data_status.includes("not_loaded") ? choose("Rozpočty tieru nenačteny","Tier budgets not loaded") : choose("České souhrny načteny","Czech summaries loaded")}</small></article>`).join("");
  }

  function renderCoverage() {
    const checks = Object.entries(state.data.integrity.checks);
    document.querySelector("#coverage-checks").innerHTML = checks.map(([code,passed]) => `<div class="coverage-check"><b>${passed ? "✓" : "×"}</b>${html(codeLabel(code))}</div>`).join("");
    document.querySelector("#coverage-limitations").innerHTML = state.data.integrity[`limitations_${lang()}`].map((text) => `<div class="coverage-limitation"><b>!</b>${html(text)}</div>`).join("");
  }

  function renderSources() {
    document.querySelector("#accountability-sources").innerHTML = state.data.sources.map((row) => `<a class="source-entry" href="${html(row.url)}" target="_blank" rel="noopener"><span>${html(codeLabel(row.source_type))}</span><strong>${html(row.title)}</strong><b>↗</b></a>`).join("");
  }

  function render() {
    if (!state.data) return;
    translateStatic(); renderSummary(); renderFunding(); renderInstruments(); renderRoles(); renderMechanisms(); renderRisks(); renderArchetypes(); renderCoverage(); renderSources();
    window.psdLanguageReady?.(); dispatchEvent(new Event("psdlanguageready"));
  }

  document.querySelector("#region-select")?.addEventListener("change", (event) => { state.regionId = event.target.value; renderFunding(); });
  document.querySelector("#function-select")?.addEventListener("change", (event) => { state.functionCode = event.target.value; renderRoles(); });
  addEventListener("psdlanguagechange", render);
  fetch(DATA_URL).then((response) => { if (!response.ok) throw new Error(`Accountability data ${response.status}`); return response.json(); }).then((data) => { state.data = data; render(); }).catch((error) => {
    document.querySelector("#coverage-integrity").textContent = choose("CHYBA", "ERROR");
    document.querySelector("#role-grid").innerHTML = `<p>${html(error.message)}</p>`;
    window.psdLanguageReady?.();
  });
})();
