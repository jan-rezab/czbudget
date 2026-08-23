(() => {
  if (window.__psdPortalUi) return;
  window.__psdPortalUi = true;
  const interactive = "a,button,input,select,textarea,summary,[role='button'],[role='option']";
  const ignoredAsset = /\.(?:avif|csv|gif|ico|jpe?g|json|pdf|png|svg|txt|webp|xml|zip)$/i;
  let openSelect = null;
  const lang = () => document.documentElement.lang === "en" ? "en" : "cs";
  const copy = () => lang() === "en" ? { choose:"Choose an option", source:"Source" } : { choose:"Vyberte možnost", source:"Zdroj" };
  const simpleHeadings = new Map([
    ["Od systému k nemocnici.","Síť poskytovatelů zdravotní péče"],["From system to hospital.","Healthcare provider network"],
    ["Co systém dodává za své peníze.","Kapacita a výsledky zdravotnictví"],["What the system delivers for its money.","Healthcare capacity and outcomes"],
    ["Stejná otázka. Deset rozpočtů.","Výdaje podle kategorií v deseti zemích"],["One question. Ten budgets.","Spending by category in ten countries"],
    ["Konsolidace je vidět hned.","Rozsah městských rozpočtů"],["Consolidation is visible from the start.","Scope of city budgets"],
    ["Jedno místo. Čtyři měřítka.","Srovnání hlavních měst"],["One place. Four scales.","Capital-city comparison"],
    ["Všechny dostupné dílčí rozpočty.","Výdaje měst podle kategorií"],["Every available budget breakdown.","City spending by category"],
    ["Srovnání s přiznanými hranicemi.","Metodika srovnání měst"],["Comparison with explicit limits.","City comparison methodology"],
    ["Zisk není příjem rozpočtu.","Veřejné firmy a státní rozpočet"],["Profit is not budget revenue.","Public companies and the state budget"],
    ["Dva konce jednoho portfolia.","Výsledky veřejných firem"],["Co skutečně přiteklo státu.","Příjmy státu z veřejných firem"],
    ["Jedno vlastnictví. Tři různé logiky.","Tři typy veřejného vlastnictví"],["Bez dvojího započítání.","Metodika a zdroje"],
    ["Plán a skutečnost.","Plán a skutečné výsledky"],["Budget and actuals.","Budget and actual results"],
    ["Výsledek hospodaření a stav účtů.","Vývoj rozpočtu a účtů"],["Fiscal balance and cash.","Budget and cash over time"],
    ["Auditovatelný profil.","Zdroje a data"],["An auditable profile.","Sources and data"]
  ]);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  function localiseHref(href) {
    if (!href || href.startsWith("#") || /^(?:mailto|tel|javascript):/.test(href)) return href;
    try { const url = new URL(href, location.href); if (url.origin !== location.origin || ignoredAsset.test(url.pathname)) return href; url.searchParams.set("lang", lang()); return `${url.pathname}${url.search}${url.hash}`; } catch { return href; }
  }
  function localiseLinks(root = document) {
    const links = root.matches?.("a[href]") ? [root] : root.querySelectorAll?.("a[href]") || [];
    links.forEach((link) => { if (link.hasAttribute("download") || link.dataset.keepHref === "true") return; const next = localiseHref(link.getAttribute("href")); if (next && next !== link.getAttribute("href")) link.setAttribute("href", next); });
  }
  function close(component, focus = false) { if (!component) return; component.shell.classList.remove("open"); component.button.setAttribute("aria-expanded", "false"); component.button.removeAttribute("aria-activedescendant"); if (focus) component.button.focus(); if (openSelect === component) openSelect = null; }
  function enhanceSelect(select) {
    if (!(select instanceof HTMLSelectElement) || select.dataset.customSelect === "true") return;
    select.dataset.customSelect = "true"; select.classList.add("custom-select-native"); select.tabIndex = -1; select.setAttribute("aria-hidden", "true");
    const shell = document.createElement("span"); shell.className = "custom-select";
    const button = document.createElement("button"); button.type = "button"; button.className = "custom-select-button"; button.setAttribute("aria-haspopup", "listbox"); button.setAttribute("aria-expanded", "false");
    const value = document.createElement("span"); value.className = "custom-select-value";
    const arrow = document.createElement("span"); arrow.className = "custom-select-arrow"; arrow.setAttribute("aria-hidden", "true"); arrow.textContent = "⌄";
    const list = document.createElement("span"); list.className = "custom-select-options"; list.setAttribute("role", "listbox"); list.tabIndex = 0;
    button.append(value, arrow); select.before(shell); shell.append(select, button, list);
    const component = { shell, select, button, value, list, activeIndex:0 };
    const options = () => [...select.options].filter((option) => !option.hidden);
    const selectedIndex = () => Math.max(0, options().findIndex((option) => option.selected));
    const setActive = (index) => { const items = [...list.querySelectorAll("[role='option']")]; if (!items.length) return; component.activeIndex = Math.max(0, Math.min(index, items.length - 1)); items.forEach((item, i) => item.classList.toggle("active", i === component.activeIndex)); const active = items[component.activeIndex]; button.setAttribute("aria-activedescendant", active.id); active.scrollIntoView({ block:"nearest" }); };
    const sync = () => { const available = options(); const selected = available.find((option) => option.selected) || available[0]; value.textContent = selected?.textContent?.trim() || copy().choose; button.disabled = select.disabled; const label = select.closest("label")?.querySelector(":scope > span")?.textContent?.trim(); const accessibleName = select.getAttribute("aria-label") || label || selected?.textContent?.trim() || copy().choose; button.setAttribute("aria-label", accessibleName); list.setAttribute("aria-label", accessibleName); list.innerHTML = available.map((option, index) => `<span id="custom-option-${Math.random().toString(36).slice(2)}" role="option" data-option-index="${index}" aria-selected="${option === selected}" class="${option === selected ? "selected" : ""}">${esc(option.textContent)}</span>`).join(""); component.activeIndex = selectedIndex(); shell.classList.toggle("disabled", select.disabled); };
    const choose = (index) => { const option = options()[index]; if (!option || option.disabled) return; select.value = option.value; select.dispatchEvent(new Event("input", { bubbles:true })); select.dispatchEvent(new Event("change", { bubbles:true })); sync(); close(component, true); };
    const open = () => { if (select.disabled) return; if (openSelect && openSelect !== component) close(openSelect); sync(); shell.classList.add("open"); button.setAttribute("aria-expanded", "true"); openSelect = component; requestAnimationFrame(() => setActive(component.activeIndex)); };
    button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); shell.classList.contains("open") ? close(component) : open(); });
    button.addEventListener("keydown", (event) => { const count = options().length; if (!count) return; if (["ArrowDown","ArrowUp","Home","End","Enter"," ","Escape"].includes(event.key)) event.preventDefault(); if (event.key === "Escape") return close(component, true); if (!shell.classList.contains("open")) { if (["ArrowDown","ArrowUp","Enter"," "].includes(event.key)) open(); return; } if (event.key === "ArrowDown") setActive(component.activeIndex + 1); if (event.key === "ArrowUp") setActive(component.activeIndex - 1); if (event.key === "Home") setActive(0); if (event.key === "End") setActive(count - 1); if (event.key === "Enter" || event.key === " ") choose(component.activeIndex); });
    list.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); const option = event.target.closest("[data-option-index]"); if (option) choose(Number(option.dataset.optionIndex)); });
    select.addEventListener("change", sync); new MutationObserver(sync).observe(select, { childList:true, subtree:true, attributes:true, attributeFilter:["disabled","selected","label"] }); sync();
  }
  function markSource(element) { if (!(element instanceof HTMLElement) || element.dataset.sourceStyled === "true") return; element.dataset.sourceStyled = "true"; element.classList.add("psd-source-note"); if (!/^\s*(?:source|zdroj)\s*[:·]/i.test(element.textContent || "")) { const label = document.createElement("span"); label.className = "psd-source-label"; label.textContent = copy().source; element.prepend(label); } }
  function normaliseHeading(heading) { if (!(heading instanceof HTMLElement)) return; const replacement=simpleHeadings.get(heading.textContent.trim().replace(/\s+/g," ")); if (replacement) heading.textContent=replacement; }
  function makeCardClickable(card) { if (!(card instanceof HTMLElement) || card.dataset.clickableCard === "true") return; const link = card.matches(".municipality-card[data-href],.municipal-country-card[data-href]") ? { href:card.dataset.href, textContent:card.querySelector("h2,h3")?.textContent } : card.querySelector(".entity-detail-link, h2 a, footer a[href]:not([target='_blank'])"); if (!link?.href) return; card.dataset.clickableCard = "true"; card.dataset.cardHref = localiseHref(link.href); card.tabIndex = 0; card.setAttribute("role", "link"); card.setAttribute("aria-label", link.textContent?.trim() || card.querySelector("h2,h3")?.textContent?.trim() || "Open"); }
  function enhance(root = document) { localiseLinks(root); (root.matches?.("select") ? [root] : root.querySelectorAll?.("select") || []).forEach(enhanceSelect); (root.matches?.("h1,h2,h3") ? [root] : root.querySelectorAll?.("h1,h2,h3") || []).forEach(normaliseHeading); const sourceSelector = ".chart-source,.budget-stage-source,.breakdown-method-note,.source-note,.data-source-note,.capital-history-source,.spending-source,.transport-source-brief"; (root.matches?.(sourceSelector) ? [root] : root.querySelectorAll?.(sourceSelector) || []).forEach(markSource); const cardSelector = ".entity-card,.municipality-card,.municipal-country-card"; (root.matches?.(cardSelector) ? [root] : root.querySelectorAll?.(cardSelector) || []).forEach(makeCardClickable); }
  document.addEventListener("click", (event) => { if (openSelect && !openSelect.shell.contains(event.target)) close(openSelect); const card = event.target.closest?.("[data-clickable-card='true']"); if (card && !event.target.closest(interactive)) location.href = localiseHref(card.dataset.cardHref); });
  document.addEventListener("keydown", (event) => { const card = event.target.closest?.("[data-clickable-card='true']"); if (card && event.target === card && event.key === "Enter") location.href = localiseHref(card.dataset.cardHref); });
  const start = () => { enhance(); new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) enhance(node); }))).observe(document.body, { childList:true, subtree:true }); new MutationObserver(() => enhance()).observe(document.documentElement, { attributes:true, attributeFilter:["lang"] }); };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start, { once:true }) : start();
})();
