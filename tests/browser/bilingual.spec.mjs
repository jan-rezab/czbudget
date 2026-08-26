import { test, expect } from "@playwright/test";

const previewRoutes = [
  "/",
  "/comparison.html",
  "/methodology.html",
  "/about.html",
  "/country.html?code=CZE",
  "/countries/japan/",
  "/eu-capitals.html",
  "/municipalities/",
  "/municipalities/czechia/",
  "/municipalities/denmark/",
  "/deep-dives/",
  "/deep-dives/transportation/?code=CZE",
  "/deep-dives/health/?code=CZE",
  "/deep-dives/state-owned-enterprises/",
  "/deep-dives/ageing/?code=CZE",
  "/deep-dives/capital-cities/?city=prague-cz",
  "/deep-dives/revenue/?code=CZE",
  "/cesky-rozpocet.html",
  "/cesko.html",
  "/cz/municipalities/",
  "/cz/mesta/",
  "/cz/municipalities/praha/",
  "/cz/municipalities/abertamy/",
];

function withLanguage(path, lang) {
  const url = new URL(path, "http://local.test");
  url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}`;
}

test("every public page family publishes language-matched social metadata", async ({ page }) => {
  test.setTimeout(180_000);
  for (const path of previewRoutes) {
    for (const lang of ["cs", "en"]) {
      await page.goto(withLanguage(path, lang), { waitUntil: "networkidle" });
      await expect(page.locator("html"), `${path} (${lang})`).toHaveAttribute("lang", lang);

      const metadata = await page.evaluate(() => {
        const content = (selector) => document.head.querySelector(selector)?.content || "";
        return {
          title: document.title,
          description: content('meta[name="description"]'),
          ogLocale: content('meta[property="og:locale"]'),
          ogTitle: content('meta[property="og:title"]'),
          ogDescription: content('meta[property="og:description"]'),
          ogImage: content('meta[property="og:image"]'),
          ogWidth: content('meta[property="og:image:width"]'),
          ogHeight: content('meta[property="og:image:height"]'),
          twitterCard: content('meta[name="twitter:card"]'),
          twitterTitle: content('meta[name="twitter:title"]'),
          twitterDescription: content('meta[name="twitter:description"]'),
          twitterImage: content('meta[name="twitter:image"]'),
        };
      });

      expect(metadata.title, `${path} (${lang}) title`).not.toBe("");
      expect(metadata.description, `${path} (${lang}) description`).not.toBe("");
      expect(metadata.ogLocale).toBe(lang === "en" ? "en_GB" : "cs_CZ");
      expect(metadata.ogTitle).toBe(metadata.title);
      expect(metadata.ogDescription).toBe(metadata.description);
      expect(metadata.ogImage).toMatch(/^https:\/\/publicspendingdata\.org\/assets\/og(?:-budget|-cesko)?\.png$/);
      expect(metadata.ogWidth).toBe("1200");
      expect(metadata.ogHeight).toBe("630");
      expect(metadata.twitterCard).toBe("summary_large_image");
      expect(metadata.twitterTitle).toBe(metadata.title);
      expect(metadata.twitterDescription).toBe(metadata.description);
      expect(metadata.twitterImage).toBe(metadata.ogImage);
    }
  }
});

test("the state-as-owner story is fully bilingual", async ({ page }) => {
  await page.goto("/cesko.html?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator(".enterprise-hero h1")).toContainText("Profit is not");
  await expect(page.locator("body")).toContainText(/What actually\s*reached the state\./);
  await expect(page.locator("body")).toContainText(/No double\s*counting\./);
  await expect(page.locator("body")).not.toContainText(/Co skutečně\s*přiteklo státu\./);

  await page.goto("/cesko.html?lang=cs", { waitUntil: "networkidle" });
  await expect(page.locator(".enterprise-hero h1")).toContainText("Zisk není");
  await expect(page.locator("body")).toContainText(/Co skutečně\s*přiteklo státu\./);
  await expect(page.locator("body")).toContainText(/Bez dvojího\s*započítání\./);
  await expect(page.locator("body")).not.toContainText(/What actually\s*reached the state\./);
});

test("high-risk static and generated templates switch their visible copy", async ({ page }) => {
  test.setTimeout(90_000);
  const pairs = [
    ["/cesky-rozpocet.html", ".budget-hero", "Český státní rozpočet", "Czech state budget"],
    ["/deep-dives/", ".deep-hero", "Jedno téma. Více zemí.", "One topic. More countries."],
    ["/deep-dives/transportation/?code=CZE", ".deep-hero", "Doprava", "Transportation"],
    ["/municipalities/", ".municipal-hero", "Rozpočty obcí ve 16 zemích", "Municipal budgets in 16 countries"],
    ["/municipalities/czechia/", ".municipal-hero", "Rozpočty českých obcí", "Budgets of Czech municipalities"],
    ["/countries/japan/", ".country-hero", "Detail země", "Country detail"],
    ["/cz/municipalities/praha/", "main", "Příjmy", "Revenue"],
    ["/cz/municipalities/abertamy/", "main", "Příjmy", "Revenue"],
  ];

  for (const [path, selector, czech, english] of pairs) {
    await page.goto(withLanguage(path, "cs"), { waitUntil: "networkidle" });
    await expect(page.locator(selector), `${path} Czech copy`).toContainText(czech);
    await page.goto(withLanguage(path, "en"), { waitUntil: "networkidle" });
    await expect(page.locator(selector), `${path} English copy`).toContainText(english);
  }
});

test("shared page modules do not retain Czech UI copy in English", async ({ page }) => {
  await page.goto("/methodology.html?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator('[data-page-copy="atlasTitle"]')).toHaveText("COVERAGE");
  await expect(page.locator(".atlas-table thead th").first()).toHaveText("Country");

  await page.goto("/cesky-rozpocet.html?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator(".hero-deficit small")).toHaveText("12.8% of expenditure");
  await expect(page.locator(".section-heading h2").first()).toHaveText("Revenue and expenditure over time");
  await expect(page.locator("body")).not.toContainText("Příjmy a výdaje v čase");

  await page.goto("/cesko.html?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("#reconciliation-note")).not.toContainText("Součet 38 individuálních karet");

  await page.goto("/cz/municipalities/praha/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator(".detail-hero .eyebrow")).toContainText("Municipal reporting entity · ID");
  await expect(page.locator(".method-warning")).toContainText("The fiscal balance is consolidated throughout the series.");
  await expect(page.locator(".data-contract p")).toContainText("A separate municipal reporting entity");
});

test("representative pages contain no standalone labels from the other language", async ({ page }) => {
  test.setTimeout(180_000);
  const forbidden = {
    en: ["Domů", "Srovnání", "Obce a města", "Metodika", "O projektu", "Přehled", "Výdaje", "Příjmy", "Výsledek", "Stav účtů", "Zdroje", "Vybraný rok", "Hledat", "Nahoru ↑", "Rozpočet", "Data a metodika"],
    cs: ["Home", "Compare", "Municipalities", "Methodology", "About", "Overview", "Expenditure", "Revenue", "Result", "Cash and deposits", "Sources", "Selected year", "Search", "Back to top ↑", "Budget", "Data and methodology"],
  };

  for (const path of previewRoutes) {
    for (const lang of ["cs", "en"]) {
      await page.goto(withLanguage(path, lang), { waitUntil: "networkidle" });
      const lines = new Set((await page.locator("body").innerText()).split("\n").map((line) => line.trim()).filter(Boolean));
      const leaked = forbidden[lang].filter((label) => lines.has(label));
      expect(leaked, `${path} (${lang}) contains labels from the other language`).toEqual([]);
    }
  }
});
