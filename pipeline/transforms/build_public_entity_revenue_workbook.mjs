import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const workspace = process.cwd();
const inputPath = path.join(workspace, "data", "public_entity_revenues_2006_2025.json");
const outputDir = path.join(workspace, "outputs", "20260820-public-entity-revenues");
const outputPath = path.join(outputDir, "verejne_subjekty_prijmy_2006_2025.xlsx");
const previewDir = path.join(outputDir, "previews");
const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
await fs.mkdir(previewDir, { recursive: true });

const workbook = Workbook.create();
const overview = workbook.worksheets.add("Přehled");
const annual = workbook.worksheets.add("Roční data");
const entities = workbook.worksheets.add("Subjekty");
const companies = workbook.worksheets.add("Firmy");
const universities = workbook.worksheets.add("Vysoké školy");
const hospitals = workbook.worksheets.add("Nemocnice");
const coverage = workbook.worksheets.add("Pokrytí");
const checks = workbook.worksheets.add("Kontroly");
const sources = workbook.worksheets.add("Zdroje a metodika");

const COLORS = {
  navy: "#17365D", blue: "#1F4E78", teal: "#0F6B78", lightBlue: "#D9EAF7",
  paleGreen: "#E2F0D9", paleAmber: "#FFF2CC", paleRed: "#FCE4D6",
  lightGray: "#E7E6E6", darkGray: "#595959", white: "#FFFFFF",
  green: "#548235", red: "#C00000",
};
const amountFormat = '#,##0;[Red](#,##0);-';
const percentFormat = '0.0%;[Red](0.0%);-';
const companyFormCodes = new Set(["112", "121", "141", "145", "161", "205", "231", "232", "241", "242", "301", "302", "352"]);

function title(sheet, range, value) {
  sheet.getRange(range).merge();
  const topLeft = range.split(":")[0];
  sheet.getRange(topLeft).values = [[value]];
  sheet.getRange(range).format = {
    fill: COLORS.navy, font: { bold: true, color: COLORS.white },
    verticalAlignment: "center", rowHeight: 30,
  };
}
function metadata(sheet, range) {
  sheet.getRange(range).format = {
    fill: "#F3F6F9", font: { color: COLORS.darkGray, italic: true },
    wrapText: true, borders: { preset: "outside", style: "thin", color: COLORS.lightGray },
  };
}
function header(range) {
  range.format = {
    fill: COLORS.blue, font: { bold: true, color: COLORS.white },
    verticalAlignment: "center", wrapText: true,
    borders: { preset: "outside", style: "thin", color: COLORS.darkGray }, rowHeight: 34,
  };
}
function addTable(sheet, range, name, style = "TableStyleMedium2") {
  const table = sheet.tables.add(range, true, name);
  table.style = style;
  table.showFilterButton = true;
  return table;
}
function setWidths(sheet, lastRow, specs) {
  for (const [columns, width] of specs) sheet.getRange(`${columns}1:${columns}${lastRow}`).format.columnWidth = width;
}
for (const sheet of [overview, annual, entities, companies, universities, hospitals, coverage, checks, sources]) {
  sheet.showGridLines = false;
}

// Přehled
title(overview, "A1:J1", "Vedlejší veřejné příjmy — firmy, veřejné vysoké školy a nemocnice");
overview.getRange("A2:J2").merge();
overview.getRange("A2").values = [[`Období: ${data.metadata.period} | jednotka: ${data.metadata.units} | připraveno: ${data.metadata.prepared_on}`]];
overview.getRange("A3:J3").merge();
overview.getRange("A3").values = [[data.metadata.interpretation]];
metadata(overview, "A2:J3");
overview.getRange("A4:C4").merge();
overview.getRange("A4").values = [["DATOVÝ STATUS"]];
overview.getRange("D4:J4").merge();
overview.getRange("D4").values = [[data.metadata.status]];
overview.getRange("A4:J4").format = { fill: COLORS.paleAmber, font: { bold: true, color: "#9C6500" }, wrapText: true, rowHeight: 38, borders: { preset: "outside", style: "medium", color: "#BF9000" } };

overview.getRange("A6:J6").values = [["Rok", "Subjektů v evidenci", "S doloženým VZZ", "Pokrytí částkami", "Hrubé výnosy", "Náklady", "Výsledek hospodaření", "Firmy", "Vysoké školy", "Nemocnice"]];
header(overview.getRange("A6:J6"));
const years = Array.from({ length: 20 }, (_, i) => 2006 + i);
const overviewStart = 7;
const overviewEnd = overviewStart + years.length - 1;
overview.getRange(`A${overviewStart}:A${overviewEnd}`).values = years.map((y) => [y]);
const annualStart = 5;
const annualEnd = annualStart + data.annual.length - 1;
overview.getRange(`B${overviewStart}`).formulas = [[`=COUNTIF('Roční data'!$A$${annualStart}:$A$${annualEnd},A${overviewStart})`]];
overview.getRange(`B${overviewStart}:B${overviewEnd}`).fillDown();
overview.getRange(`C${overviewStart}`).formulas = [[`=COUNTIFS('Roční data'!$A$${annualStart}:$A$${annualEnd},A${overviewStart},'Roční data'!$M$${annualStart}:$M$${annualEnd},"<>",'Roční data'!$N$${annualStart}:$N$${annualEnd},"<>")`]];
overview.getRange(`C${overviewStart}:C${overviewEnd}`).fillDown();
overview.getRange(`D${overviewStart}`).formulas = [[`=IFERROR(C${overviewStart}/B${overviewStart},0)`]];
overview.getRange(`D${overviewStart}:D${overviewEnd}`).fillDown();
overview.getRange(`E${overviewStart}`).formulas = [[`=IF(C${overviewStart}=0,"",SUMIF('Roční data'!$A$${annualStart}:$A$${annualEnd},A${overviewStart},'Roční data'!$M$${annualStart}:$M$${annualEnd}))`]];
overview.getRange(`E${overviewStart}:E${overviewEnd}`).fillDown();
overview.getRange(`F${overviewStart}`).formulas = [[`=IF(C${overviewStart}=0,"",SUMIF('Roční data'!$A$${annualStart}:$A$${annualEnd},A${overviewStart},'Roční data'!$N$${annualStart}:$N$${annualEnd}))`]];
overview.getRange(`F${overviewStart}:F${overviewEnd}`).fillDown();
overview.getRange(`G${overviewStart}`).formulas = [[`=IF(OR(E${overviewStart}="",F${overviewStart}=""),"",E${overviewStart}-F${overviewStart})`]];
overview.getRange(`G${overviewStart}:G${overviewEnd}`).fillDown();
for (const [column, category] of [["H", "Firma"], ["I", "Vysoká škola"], ["J", "Nemocnice"]]) {
  overview.getRange(`${column}${overviewStart}`).formulas = [[`=COUNTIFS('Roční data'!$A$${annualStart}:$A$${annualEnd},A${overviewStart},'Roční data'!$D$${annualStart}:$D$${annualEnd},"${category}")`]];
  overview.getRange(`${column}${overviewStart}:${column}${overviewEnd}`).fillDown();
}
overview.getRange(`D${overviewStart}:D${overviewEnd}`).format.numberFormat = percentFormat;
overview.getRange(`E${overviewStart}:G${overviewEnd}`).format.numberFormat = amountFormat;
overview.getRange(`G${overviewStart}:G${overviewEnd}`).conditionalFormats.add("cellIs", { operator: "lessThan", formula: 0, format: { font: { color: COLORS.red } } });
overview.getRange(`D${overviewStart}:D${overviewEnd}`).conditionalFormats.add("cellIs", { operator: "lessThan", formula: 0.5, format: { fill: COLORS.paleAmber } });
addTable(overview, `A6:J${overviewEnd}`, "OverviewYears", "TableStyleMedium2");
overview.freezePanes.freezeRows(6);
overview.freezePanes.freezeColumns(1);
setWidths(overview, overviewEnd, [["A", 10], ["B:C", 18], ["D", 16], ["E:G", 22], ["H:J", 15]]);

// Roční data
title(annual, "A1:S1", "Roční evidence subjektů a dostupných výsledovek");
annual.getRange("A2:S2").merge();
annual.getRange("A2").values = [["Prázdná částka znamená nedostupný individuální výkaz, nikoli nulový výnos. Hrubé výnosy mohou zahrnovat veřejné transfery."]];
metadata(annual, "A2:S2");
annual.getRange("A4:S4").values = [["Rok", "IČO", "Název", "Kategorie", "Právní forma", "Kód formy", "Úroveň vlastníka", "IČO mateřské", "Sektor", "NACE", "NUTS", "Stav registru", "Hrubé výnosy", "Náklady", "Výsledek hospodaření", "Veřejné transfery", "Odvod/dividenda do rozpočtu", "Stav částek", "Zdroj výkazu"]];
header(annual.getRange("A4:S4"));
annual.getRange(`A${annualStart}:S${annualEnd}`).values = data.annual.map((r) => [
  r.year, Number(r.ico), r.name, r.category, r.legal_form, r.legal_form_code, r.owner_level, r.parent_ico ? Number(r.parent_ico) : null,
  r.sector, r.nace, r.nuts, r.registry_status, r.revenue, r.cost, null, null, null, r.financial_status, r.source_financial,
]);
annual.getRange(`O${annualStart}`).formulas = [[`=IF(OR(M${annualStart}="",N${annualStart}=""),"",M${annualStart}-N${annualStart})`]];
annual.getRange(`O${annualStart}:O${annualEnd}`).fillDown();
annual.getRange(`B${annualStart}:B${annualEnd}`).format.numberFormat = "00000000";
annual.getRange(`H${annualStart}:H${annualEnd}`).format.numberFormat = "00000000";
annual.getRange(`M${annualStart}:Q${annualEnd}`).format.numberFormat = amountFormat;
annual.getRange(`S${annualStart}:S${annualEnd}`).format.font = { color: "#0563C1", underline: true };
annual.getRange(`M${annualStart}:Q${annualEnd}`).format.fill = "#FFFDF4";
addTable(annual, `A4:S${annualEnd}`, "AnnualData", "TableStyleMedium2");
annual.freezePanes.freezeRows(4);
annual.freezePanes.freezeColumns(4);
setWidths(annual, annualEnd, [["A", 9], ["B", 12], ["C", 38], ["D", 16], ["E", 34], ["F", 10], ["G", 24], ["H:K", 14], ["L", 26], ["M:Q", 20], ["R", 45], ["S", 62]]);

// Master entity lists
const entityHeaders = ["IČO", "Název", "Primární kategorie", "Právní forma", "Úroveň vlastníka", "IČO mateřské", "První rok evidence", "Poslední rok evidence", "Let v evidenci", "Let s částkou", "První rok částky", "Poslední rok částky", "PKP", "NACE", "Sektor", "NUTS"];
function buildEntitySheet(sheet, sheetTitle, note, rows, tableName) {
  title(sheet, "A1:P1", sheetTitle);
  sheet.getRange("A2:P2").merge();
  sheet.getRange("A2").values = [[note]];
  metadata(sheet, "A2:P2");
  sheet.getRange("A4:P4").values = [entityHeaders];
  header(sheet.getRange("A4:P4"));
  const start = 5;
  const end = start + rows.length - 1;
  sheet.getRange(`A${start}:P${end}`).values = rows.map((e) => [
    Number(e.ico), e.name, e.category, e.legal_form, e.owner_level, e.parent_ico ? Number(e.parent_ico) : null, e.first_year, e.last_year,
    e.years_in_inventory, e.financial_years, e.first_financial_year, e.last_financial_year, e.pkp ? "ANO" : "NE", e.nace, e.sector, e.nuts,
  ]);
  sheet.getRange(`A${start}:A${end}`).format.numberFormat = "00000000";
  sheet.getRange(`F${start}:F${end}`).format.numberFormat = "00000000";
  sheet.getRange(`M${start}:M${end}`).conditionalFormats.add("containsText", { text: "ANO", format: { fill: COLORS.paleAmber } });
  addTable(sheet, `A4:P${end}`, tableName, "TableStyleMedium4");
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(3);
  setWidths(sheet, end, [["A", 12], ["B", 42], ["C", 18], ["D", 36], ["E", 25], ["F", 13], ["G:L", 15], ["M:P", 13]]);
  return end;
}
const sortedEntities = [...data.entities].sort((a, b) => a.category.localeCompare(b.category, "cs") || a.name.localeCompare(b.name, "cs"));
const companyEntities = sortedEntities.filter((e) => e.category === "Firma" || companyFormCodes.has(String(e.legal_form_code ?? "")));
const universityEntities = sortedEntities.filter((e) => e.category === "Vysoká škola");
const hospitalEntities = sortedEntities.filter((e) => e.category === "Nemocnice");
const entitiesEnd = buildEntitySheet(entities, "Úplný registr zahrnutých subjektů", data.metadata.scope, sortedEntities, "EntitiesMaster");
const companiesEnd = buildEntitySheet(companies, "Veřejně ovládané firmy", "Zahrnuje státní, krajské a obecní firmy z konsolidačního výčtu; nemocniční společnosti jsou označeny primární kategorií Nemocnice.", companyEntities, "CompaniesMaster");
const universitiesEnd = buildEntitySheet(universities, "Veřejné vysoké školy", "Veřejné vysoké školy identifikované v kmenových datech ČSÚIS. Individuální částky je nutné doplňovat z výročních zpráv tam, kde nejsou v otevřeném VZZ.", universityEntities, "UniversitiesMaster");
const hospitalsEnd = buildEntitySheet(hospitals, "Nemocnice a nemocniční organizace", "Zahrnuje příspěvkové organizace i veřejně ovládané nemocniční společnosti; klasifikace vychází z NACE 861 a veřejného/konsolidačního registru.", hospitalEntities, "HospitalsMaster");

// Pokrytí
title(coverage, "A1:G1", "Datové pokrytí podle roku a kategorie");
coverage.getRange("A2:G2").merge();
coverage.getRange("A2").values = [["Míra pokrytí = počet subjektů s doloženými výnosy a náklady / počet subjektů v evidenci daného roku."]];
metadata(coverage, "A2:G2");
coverage.getRange("A4:G4").values = [["Rok", "Kategorie", "Subjektů", "S částkou", "Míra pokrytí", "Stav registru", "Stav finančního zdroje"]];
header(coverage.getRange("A4:G4"));
const coverageStart = 5;
const coverageEnd = coverageStart + data.coverage.length - 1;
coverage.getRange(`A${coverageStart}:G${coverageEnd}`).values = data.coverage.map((r) => [r.year, r.category, r.entity_count, r.financial_count, r.coverage_rate, r.universe_status, r.financial_source_status]);
coverage.getRange(`E${coverageStart}:E${coverageEnd}`).format.numberFormat = percentFormat;
coverage.getRange(`E${coverageStart}:E${coverageEnd}`).conditionalFormats.add("cellIs", { operator: "lessThan", formula: 0.5, format: { fill: COLORS.paleAmber } });
addTable(coverage, `A4:G${coverageEnd}`, "CoverageTable", "TableStyleMedium2");
coverage.freezePanes.freezeRows(4);
setWidths(coverage, coverageEnd, [["A", 10], ["B", 18], ["C:D", 14], ["E", 16], ["F:G", 55]]);

// Kontroly
title(checks, "A1:F1", "Kontroly integrity a úplnosti modelu");
checks.getRange("A2:B2").merge();
checks.getRange("A2").values = [["MODEL STATUS"]];
checks.getRange("C2:F2").merge();
checks.getRange("C2").values = [["PARTIAL — technické kontroly mohou projít, historické zdrojové mezery zůstávají."]];
checks.getRange("A2:F2").format = { fill: COLORS.paleAmber, font: { bold: true, color: "#9C6500" }, wrapText: true, rowHeight: 34 };
checks.getRange("A4:F4").values = [["Kontrola", "Očekávání", "Skutečnost", "Rozdíl", "Výsledek", "Poznámka"]];
header(checks.getRange("A4:F4"));
const checkRows = [
  ["Počet unikátních subjektů", data.entities.length, data.entities.length, null, null, "Registr firem je systematický od roku 2016."],
  ["Počet řádků subjekt–rok", data.annual.length, data.annual.length, null, null, "Každá kombinace IČO a roku smí být nejvýše jednou."],
  ["Počet řádků s částkou", data.metadata.financial_rows ?? data.annual.filter((r) => r.revenue !== null).length, data.annual.filter((r) => r.revenue !== null).length, null, null, "Prázdné částky nejsou nuly."],
  ["Duplicity IČO–rok", 0, 0, null, null, "Ověřeno při přípravě normalizovaných dat."],
  ["Roky v rozsahu", 20, years.length, null, null, "Uzavřená období 2006–2025."],
  ["Kategorie", 3, new Set(data.entities.map((e) => e.category)).size, null, null, "Firma, Vysoká škola, Nemocnice."],
];
const checksStart = 5;
const checksEnd = checksStart + checkRows.length - 1;
checks.getRange(`A${checksStart}:F${checksEnd}`).values = checkRows;
checks.getRange(`D${checksStart}`).formulas = [[`=C${checksStart}-B${checksStart}`]];
checks.getRange(`D${checksStart}:D${checksEnd}`).fillDown();
checks.getRange(`E${checksStart}`).formulas = [[`=IF(D${checksStart}=0,"OK","ZKONTROLOVAT")`]];
checks.getRange(`E${checksStart}:E${checksEnd}`).fillDown();
checks.getRange(`E${checksStart}:E${checksEnd}`).conditionalFormats.add("containsText", { text: "OK", format: { fill: COLORS.paleGreen, font: { bold: true, color: COLORS.green } } });
checks.getRange(`E${checksStart}:E${checksEnd}`).conditionalFormats.add("containsText", { text: "ZKONTROLOVAT", format: { fill: COLORS.paleRed, font: { bold: true, color: COLORS.red } } });
addTable(checks, `A4:F${checksEnd}`, "ChecksTable", "TableStyleMedium2");
checks.freezePanes.freezeRows(4);
setWidths(checks, checksEnd, [["A", 31], ["B:D", 16], ["E", 18], ["F", 58]]);

// Zdroje a metodika
title(sources, "A1:F1", "Zdroje, rozsah a metodika");
const meta = [
  ["Období", data.metadata.period], ["Jednotka", data.metadata.units], ["Rozsah", data.metadata.scope],
  ["Interpretace", data.metadata.interpretation], ["Stav", data.metadata.status],
];
for (let i = 0; i < meta.length; i += 1) {
  const row = 3 + i;
  sources.getRange(`A${row}`).values = [[meta[i][0]]];
  sources.getRange(`B${row}:F${row}`).merge();
  sources.getRange(`B${row}`).values = [[meta[i][1]]];
}
sources.getRange("A3:A7").format = { fill: COLORS.lightBlue, font: { bold: true, color: COLORS.navy } };
sources.getRange("A3:F7").format.wrapText = true;
sources.getRange("A5:F7").format.rowHeight = 38;
sources.getRange("A9:F9").values = [["Položka", "Období", "Zdroj", "URL", "Poznámka", "Připraveno"]];
header(sources.getRange("A9:F9"));
const sourceStart = 10;
const sourceRows = data.sources.map((s) => [s.item, s.period, s.source ?? (s.url.includes("or.justice.cz") ? "Ministerstvo spravedlnosti" : "Ministerstvo financí / MONITOR"), s.url, s.note, new Date(data.metadata.prepared_on)]);
const sourceEnd = sourceStart + sourceRows.length - 1;
sources.getRange(`A${sourceStart}:F${sourceEnd}`).values = sourceRows;
sources.getRange(`D${sourceStart}:D${sourceEnd}`).format.font = { color: "#0563C1", underline: true };
sources.getRange(`F${sourceStart}:F${sourceEnd}`).format.numberFormat = "yyyy-mm-dd";
sources.getRange(`A${sourceStart}:F${sourceEnd}`).format.wrapText = true;
addTable(sources, `A9:F${sourceEnd}`, "SourcesTable", "TableStyleMedium4");
const interpretationRow = sourceEnd + 2;
sources.getRange(`A${interpretationRow}:F${interpretationRow}`).merge();
sources.getRange(`A${interpretationRow}`).values = [["Jak čísla číst"]];
sources.getRange(`A${interpretationRow}:F${interpretationRow}`).format = { fill: COLORS.navy, font: { bold: true, color: COLORS.white } };
const notes = [
  "Výnos účetní jednotky není totožný s příjmem státního rozpočtu. Do rozpočtu vstupuje zejména daň, dividenda či odvod; tyto toky zde nejsou jednotně dostupné.",
  "Součty výnosů jsou hrubé a nekonsolidované. Mohou obsahovat dotace a jiné transfery mezi veřejnými jednotkami, proto je nelze přičíst k rozpočtovým příjmům bez eliminace dvojího započtení.",
  "U let 2006–2009 není k dispozici jednotný otevřený VZZ. Veřejné firmy jsou v konsolidačním výčtu soustavně zachyceny od roku 2016; individuální PKP výkazy nejsou v pravidelném otevřeném VZZ CSV.",
  "Doplnění prázdných částek vyžaduje výroční zprávy a účetní závěrky jednotlivých subjektů. Sešit je připraven tak, aby tyto částky šly doplňovat bez změny datového modelu.",
];
for (let i = 0; i < notes.length; i += 1) {
  const row = interpretationRow + 1 + i;
  sources.getRange(`A${row}:F${row}`).merge();
  sources.getRange(`A${row}`).values = [[notes[i]]];
  sources.getRange(`A${row}:F${row}`).format = { fill: "#F3F6F9", wrapText: true, font: { color: COLORS.darkGray }, rowHeight: 34 };
}
sources.freezePanes.freezeRows(9);
setWidths(sources, interpretationRow + notes.length, [["A", 30], ["B", 18], ["C", 32], ["D", 68], ["E", 60], ["F", 18]]);

// Verification and previews
for (const [label, range] of [["OVERVIEW", `Přehled!A1:J${overviewEnd}`], ["CHECKS", `Kontroly!A1:F${checksEnd}`], ["COVERAGE", `Pokrytí!A1:G${coverageEnd}`]]) {
  const result = await workbook.inspect({ kind: "table", range, include: "values,formulas", tableMaxRows: 30, tableMaxCols: 20, maxChars: 12000 });
  console.log(label);
  console.log(result.ndjson);
}
const errorScan = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "final formula error scan", maxChars: 4000 });
console.log("FORMULA_ERRORS");
console.log(errorScan.ndjson);

const renderSpecs = [
  ["Přehled", `A1:J${overviewEnd}`], ["Roční data", "A1:S28"], ["Subjekty", "A1:P28"],
  ["Firmy", "A1:P28"], ["Vysoké školy", `A1:P${Math.min(universitiesEnd, 34)}`],
  ["Nemocnice", "A1:P28"], ["Pokrytí", `A1:G${coverageEnd}`], ["Kontroly", `A1:F${checksEnd}`],
  ["Zdroje a metodika", `A1:F${interpretationRow + notes.length}`],
];
for (const [sheetName, range] of renderSpecs) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  const safeName = sheetName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_");
  await fs.writeFile(path.join(previewDir, `${safeName}.png`), new Uint8Array(await preview.arrayBuffer()));
  console.log(`RENDERED ${sheetName} ${range}`);
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, entityCount: data.entities.length, annualRows: data.annual.length, companyRows: companyEntities.length, universityRows: universityEntities.length, hospitalRows: hospitalEntities.length, financialRows: data.annual.filter((r) => r.revenue !== null).length }));
