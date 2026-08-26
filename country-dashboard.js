(() => {
  const main = document.querySelector(".country-page main");
  const kpis = document.querySelector("#country-kpis");
  const rail = document.querySelector(".country-context-rail");
  if (!main || !kpis || !rail) return;

  const copy = {
    cs: {
      label: "Národní dashboard",
      intro: "Stejná redakční struktura jako český dashboard. Každá kapitola používá národní data v jejich vlastním účetním rozsahu; metodika a pokrytí jsou součástí příběhu, ne náhradou za něj.",
      chapters: [
        ["Hranice", "Co se smí sčítat"], ["Rozpočet", "Příjmy, výdaje a vývoj"],
        ["Kam peníze jdou", "Účel, kapitola a překlad"], ["Stát jako vlastník", "Subjekty a dostupné účty"],
        ["Zdraví", "Výdaje, tok a poskytovatelé"], ["Demografie", "Sociální tlak do roku 2045"],
        ["Doprava a pravidla", "Výkon a národní specifika"], ["Metodika", "Pokrytí a primární zdroje"],
      ],
      top: "Přehled",
    },
    en: {
      label: "National dashboard",
      intro: "The same editorial structure as the Czech dashboard. Every chapter uses national data inside its own accounting perimeter; methodology and coverage support the story instead of replacing it.",
      chapters: [
        ["Boundaries", "What can be added"], ["Budget", "Revenue, spending and trend"],
        ["Where money goes", "Purpose, department and translation"], ["The state as owner", "Entities and available accounts"],
        ["Health", "Spending, flows and providers"], ["Demography", "Social pressure to 2045"],
        ["Transport and rules", "Performance and national specifics"], ["Methodology", "Coverage and primary sources"],
      ],
      top: "Overview",
    },
  };
  const chapters = [
    {anchor:"scope", ids:["scope"]},
    {anchor:"trend", ids:["trend", "cash-in", "macro", "recovery"]},
    {anchor:"spending", ids:["spending", "budget-map"]},
    {anchor:"public-entities", ids:["public-entities"]},
    {anchor:"healthcare", ids:["healthcare", "healthcare-system", "provider-network", "hospital-benchmark"]},
    {anchor:"social-system", ids:["social-system", "demography"]},
    {anchor:"transportation", ids:["transportation", "specifics"]},
    {anchor:"data-parity", ids:["data-parity", "sources"]},
  ];

  let index = document.querySelector("#country-dashboard-index");
  if (!index) {
    index = document.createElement("section");
    index.id = "country-dashboard-index";
    index.className = "country-dashboard-index";
    kpis.after(index);
  }

  for (const [chapterIndex, chapter] of chapters.entries()) {
    chapter.ids.forEach((id, itemIndex) => {
      const section = document.getElementById(id);
      if (!section) return;
      section.dataset.dashboardChapter = String(chapterIndex + 1).padStart(2, "0");
      section.dataset.dashboardItem = String(itemIndex + 1);
      if (itemIndex === 0) section.classList.add("dashboard-chapter-start");
      main.append(section);
    });
  }

  function renderChrome(lang = document.documentElement.lang === "en" ? "en" : "cs") {
    const t = copy[lang];
    index.innerHTML = `<header><span>${t.label}</span><p>${t.intro}</p></header><div>${chapters.map((chapter, i) => `<a href="#${chapter.anchor}"><b>${String(i + 1).padStart(2, "0")}</b><span><strong>${t.chapters[i][0]}</strong><small>${t.chapters[i][1]}</small></span></a>`).join("")}</div>`;
    rail.innerHTML = `<a href="#top">${t.top}</a>${chapters.map((chapter, i) => `<a href="#${chapter.anchor}">${String(i + 1).padStart(2, "0")} · ${t.chapters[i][0]}</a>`).join("")}`;
    chapters.forEach((chapter, i) => {
      const first = document.getElementById(chapter.anchor);
      if (first) first.dataset.dashboardLabel = `${String(i + 1).padStart(2, "0")} / ${t.chapters[i][0]}`;
    });
  }

  renderChrome();
  addEventListener("countryprofilechange", event => renderChrome(event.detail.lang === "en" ? "en" : "cs"));
  new MutationObserver(() => renderChrome()).observe(document.documentElement, {attributes:true, attributeFilter:["lang"]});
})();
