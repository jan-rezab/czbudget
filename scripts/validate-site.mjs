import { readFile, stat } from "node:fs/promises";

const identity = (await readFile(".czbudget-canonical", "utf8")).trim();
if (identity !== "czbudget-public-canonical-v1") throw new Error("Invalid canonical source identity");

const snapshot = JSON.parse(await readFile("data/municipal-snapshot.v1.json", "utf8"));
const history = JSON.parse(await readFile("data/large-city-history.v1.json", "utf8"));
if (snapshot.municipalities.length !== 6254) throw new Error("Expected 6,254 municipalities");
if (snapshot.scope.combined_unique_entity_count !== 6267) throw new Error("Expected 6,267 unique municipal and regional entities");
if (history.cities.length !== 27 || history.cities.some((city) => city.series.length !== 20)) throw new Error("Expected 20 annual observations for 27 large cities");
for (const required of ["index.html", "cz/obce/index.html", "cz/mesta/index.html", "municipal-i18n.js", "sitemap.xml"]) await stat(required);
console.log("CZ Budget site validation passed");
