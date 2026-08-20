import { readFile, stat } from "node:fs/promises";

const identity = (await readFile(".czbudget-canonical", "utf8")).trim();
if (identity !== "czbudget-public-canonical-v1") throw new Error("Invalid canonical source identity");

const snapshot = JSON.parse(await readFile("data/municipal-snapshot.v1.json", "utf8"));
const history = JSON.parse(await readFile("data/large-city-history.v1.json", "utf8"));
const capitals = JSON.parse(await readFile("data/eu-capital-budgets.v1.json", "utf8"));
const homepage = await readFile("index.html", "utf8");
if (snapshot.municipalities.length !== 6254) throw new Error("Expected 6,254 municipalities");
if (snapshot.scope.combined_unique_entity_count !== 6267) throw new Error("Expected 6,267 unique municipal and regional entities");
if (history.cities.length !== 27 || history.cities.some((city) => city.series.length !== 20)) throw new Error("Expected 20 annual observations for 27 large cities");
if (capitals.cities.length !== 28 || capitals.cities.filter((city) => city.eu_capital).length !== 27) throw new Error("Expected 27 EU capitals plus London");
if (capitals.cities.some((city) => !Number.isFinite(city.budget?.local_amount) || !Number.isFinite(city.budget?.eur_amount) || !city.benchmarks?.population || !city.benchmarks?.tourism)) throw new Error("Incomplete European capitals facts");
if (capitals.cities.some((city) => !city.fiscal_details?.expenditure || !city.fiscal_details?.balance_classification || !Array.isArray(city.fiscal_details?.components))) throw new Error("Incomplete European capital fiscal details");
if (capitals.cities.filter((city) => city.fiscal_details.balance).length < 20) throw new Error("Expected at least twenty sourced capital-city balances");
if (!homepage.includes('href="eu-capitals.html?lang=cs"') || !homepage.includes('data-i18n="capitalsCta"')) throw new Error("Homepage must expose the European capitals comparison");
for (const required of ["index.html", "eu-capitals.html", "eu-capitals.js", "eu-capitals.css", "cz/obce/index.html", "cz/mesta/index.html", "municipal-i18n.js", "sitemap.xml"]) await stat(required);
console.log("CZ Budget site validation passed");
