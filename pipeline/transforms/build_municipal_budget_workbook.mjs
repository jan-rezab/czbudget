import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const workspace = process.cwd();
const inputPath = path.join(workspace, "data", "municipal_budgets_2025.json");
const outputDir = path.join(workspace, "outputs", "20260820-municipal-budgets");
const outputPath = path.join(outputDir, "rozpocty_statutarnich_mest_2025.xlsx");
const previewDir = path.join(outputDir, "previews");
const data = JSON.parse(await fs.readFile(inputPath, "utf8"));

await fs.mkdir(previewDir, { recursive: true });

const workbook = Workbook.create();
const overview = workbook.worksheets.add("Přehled");
const structure = workbook.worksheets.add("Struktura");
const detail = workbook.worksheets.add("Detail rozpočtu");
const cash = workbook.worksheets.add("Cash");
const checks = workbook.worksheets.add("Kontroly");
const sources = workbook.worksheets.add("Zdroje a metodika");

const COLORS = {
  navy: "#17365D",
  blue: "#1F4E78",
  teal: "#0F6B78",
  lightBlue: "#D9EAF7",
  paleGreen: "#E2F0D9",
  paleAmber: "#FFF2CC",
  paleRed: "#FCE4D6",
  lightGray: "#E7E6E6",
  darkGray: "#595959",
  white: "#FFFFFF",
  green: "#548235",
  red: "#C00000",
};

const amountFormat = '#,##0.00;[Red](#,##0.00);-';
const wholeAmountFormat = '#,##0;[Red](#,##0);-';
const percentFormat = '0.0%;[Red](0.0%);-';
const scoreFormat = '0.00';

function applyTitle(sheet, range, title) {
  sheet.getRange(range).merge();
  const cell = sheet.getRange(range.split(":")[0]);
  cell.values = [[title]];
  cell.format = {
    fill: COLORS.navy,
    font: { bold: true, color: COLORS.white },
    verticalAlignment: "center",
  };
  sheet.getRange(range).format.rowHeight = 30;
}

function applyHeader(range) {
  range.format = {
    fill: COLORS.blue,
    font: { bold: true, color: COLORS.white },
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: COLORS.darkGray },
  };
  range.format.rowHeight = 34;
}

function applyMetadata(sheet, range) {
  sheet.getRange(range).format = {
    fill: "#F3F6F9",
    font: { color: COLORS.darkGray, italic: true },
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: COLORS.lightGray },
  };
}

function addTable(sheet, range, name, style = "TableStyleMedium2") {
  const table = sheet.tables.add(range, true, name);
  table.style = style;
  table.showFilterButton = true;
  return table;
}

for (const sheet of [overview, structure, detail, cash, checks, sources]) {
  sheet.showGridLines = false;
}

// Přehled
applyTitle(overview, "A1:S1", "Rozpočty vybraných statutárních měst — rok 2025");
overview.getRange("A2:S2").merge();
overview.getRange("A2").values = [[
  `Období: ${data.metadata.period} | stav peněžních prostředků k ${data.metadata.as_of} | jednotka: ${data.metadata.units}`,
]];
overview.getRange("A3:S3").merge();
overview.getRange("A3").values = [[data.metadata.scope]];
applyMetadata(overview, "A2:S3");
overview.getRange("A4:D4").merge();
overview.getRange("A4").values = [["MODEL STATUS"]];
overview.getRange("E4:F4").merge();
overview.getRange("E4").formulas = [["='Kontroly'!C2"]];
overview.getRange("A4:F4").format = {
  fill: COLORS.lightBlue,
  font: { bold: true, color: COLORS.navy },
  borders: { preset: "outside", style: "medium", color: COLORS.blue },
};
overview.getRange("E4:F4").format.horizontalAlignment = "center";

const overviewHeaders = [[
  "Pořadí", "K–Index", "Skóre", "Město", "IČO",
  "Příjmy – schválený", "Příjmy – po změnách", "Příjmy – skutečnost", "Plnění příjmů",
  "Výdaje – schválený", "Výdaje – po změnách", "Výdaje – skutečnost", "Plnění výdajů",
  "Saldo skutečnost", "Financování skutečnost", "Cash 31. 12. 2025", "Cash 31. 12. 2024", "Změna cash", "Cash / výdaje",
]];
overview.getRange("A6:S6").values = overviewHeaders;
applyHeader(overview.getRange("A6:S6"));

const overviewRows = data.cities.map((city) => [
  city.rank, city.grade, city.score, city.name, Number(city.ico),
  city.revenue_approved, city.revenue_after_changes, city.revenue_actual, null,
  city.expense_approved, city.expense_after_changes, city.expense_actual, null,
  null, city.financing_actual, city.cash_2025, city.cash_2024, null, null,
]);
const overviewStart = 7;
const overviewEnd = overviewStart + overviewRows.length - 1;
overview.getRange(`A${overviewStart}:S${overviewEnd}`).values = overviewRows;
overview.getRange(`I${overviewStart}`).formulas = [[`=IFERROR(H${overviewStart}/G${overviewStart},0)`]];
overview.getRange(`I${overviewStart}:I${overviewEnd}`).fillDown();
overview.getRange(`M${overviewStart}`).formulas = [[`=IFERROR(L${overviewStart}/K${overviewStart},0)`]];
overview.getRange(`M${overviewStart}:M${overviewEnd}`).fillDown();
overview.getRange(`N${overviewStart}`).formulas = [[`=H${overviewStart}-L${overviewStart}`]];
overview.getRange(`N${overviewStart}:N${overviewEnd}`).fillDown();
overview.getRange(`R${overviewStart}`).formulas = [[`=P${overviewStart}-Q${overviewStart}`]];
overview.getRange(`R${overviewStart}:R${overviewEnd}`).fillDown();
overview.getRange(`S${overviewStart}`).formulas = [[`=IFERROR(P${overviewStart}/L${overviewStart},0)`]];
overview.getRange(`S${overviewStart}:S${overviewEnd}`).fillDown();

overview.getRange(`E${overviewStart}:E${overviewEnd}`).format.numberFormat = "00000000";
overview.getRange(`C${overviewStart}:C${overviewEnd}`).format.numberFormat = scoreFormat;
overview.getRange(`F${overviewStart}:H${overviewEnd}`).format.numberFormat = wholeAmountFormat;
overview.getRange(`J${overviewStart}:R${overviewEnd}`).format.numberFormat = wholeAmountFormat;
overview.getRange(`I${overviewStart}:I${overviewEnd}`).format.numberFormat = percentFormat;
overview.getRange(`M${overviewStart}:M${overviewEnd}`).format.numberFormat = percentFormat;
overview.getRange(`S${overviewStart}:S${overviewEnd}`).format.numberFormat = percentFormat;
overview.getRange(`B${overviewStart}:B${overviewEnd}`).conditionalFormats.add("cellIs", {
  operator: "equal", formula: '"B"', format: { fill: COLORS.paleGreen, font: { bold: true, color: COLORS.green } },
});
overview.getRange(`B${overviewStart}:B${overviewEnd}`).conditionalFormats.add("cellIs", {
  operator: "equal", formula: '"C"', format: { fill: COLORS.paleAmber, font: { bold: true, color: "#9C6500" } },
});
overview.getRange(`N${overviewStart}:N${overviewEnd}`).conditionalFormats.add("cellIs", {
  operator: "lessThan", formula: 0, format: { font: { color: COLORS.red } },
});
addTable(overview, `A6:S${overviewEnd}`, "OverviewTable", "TableStyleMedium2");
overview.freezePanes.freezeRows(6);
overview.freezePanes.freezeColumns(5);

overview.getRange(`A1:A${overviewEnd}`).format.columnWidth = 9;
overview.getRange(`B1:C${overviewEnd}`).format.columnWidth = 10;
overview.getRange(`D1:D${overviewEnd}`).format.columnWidth = 30;
overview.getRange(`E1:E${overviewEnd}`).format.columnWidth = 12;
overview.getRange(`F1:H${overviewEnd}`).format.columnWidth = 18;
overview.getRange(`I1:I${overviewEnd}`).format.columnWidth = 13;
overview.getRange(`J1:L${overviewEnd}`).format.columnWidth = 18;
overview.getRange(`M1:M${overviewEnd}`).format.columnWidth = 13;
overview.getRange(`N1:R${overviewEnd}`).format.columnWidth = 18;
overview.getRange(`S1:S${overviewEnd}`).format.columnWidth = 14;

// Struktura rozpočtu
applyTitle(structure, "A1:N1", "Struktura skutečných příjmů a výdajů — po konsolidaci");
structure.getRange("A2:N2").merge();
structure.getRange("A2").values = [["Členění podle tříd rozpočtové skladby; částky v Kč."]];
applyMetadata(structure, "A2:N2");
structure.getRange("A4:N4").values = [[
  "Pořadí", "Město", "IČO", "Daňové příjmy", "Nedaňové příjmy", "Kapitálové příjmy", "Přijaté transfery",
  "Příjmy celkem", "Běžné výdaje", "Kapitálové výdaje", "Výdaje celkem", "Podíl investic", "Podíl transferů", "Odkaz na MONITOR",
]];
applyHeader(structure.getRange("A4:N4"));
const structureStart = 5;
const structureEnd = structureStart + data.cities.length - 1;
structure.getRange(`A${structureStart}:N${structureEnd}`).values = data.cities.map((city) => [
  city.rank, city.name, Number(city.ico), city.tax_revenue, city.nontax_revenue, city.capital_revenue, city.transfer_revenue,
  null, city.current_expense, city.capital_expense, null, null, null, city.source_summary,
]);
structure.getRange(`H${structureStart}`).formulas = [[`=SUM(D${structureStart}:G${structureStart})`]];
structure.getRange(`H${structureStart}:H${structureEnd}`).fillDown();
structure.getRange(`K${structureStart}`).formulas = [[`=SUM(I${structureStart}:J${structureStart})`]];
structure.getRange(`K${structureStart}:K${structureEnd}`).fillDown();
structure.getRange(`L${structureStart}`).formulas = [[`=IFERROR(J${structureStart}/K${structureStart},0)`]];
structure.getRange(`L${structureStart}:L${structureEnd}`).fillDown();
structure.getRange(`M${structureStart}`).formulas = [[`=IFERROR(G${structureStart}/H${structureStart},0)`]];
structure.getRange(`M${structureStart}:M${structureEnd}`).fillDown();
structure.getRange(`C${structureStart}:C${structureEnd}`).format.numberFormat = "00000000";
structure.getRange(`D${structureStart}:K${structureEnd}`).format.numberFormat = wholeAmountFormat;
structure.getRange(`L${structureStart}:M${structureEnd}`).format.numberFormat = percentFormat;
structure.getRange(`N${structureStart}:N${structureEnd}`).format.font = { color: "#0563C1", underline: true };
addTable(structure, `A4:N${structureEnd}`, "StructureTable", "TableStyleMedium4");
structure.freezePanes.freezeRows(4);
structure.freezePanes.freezeColumns(3);
structure.getRange(`A1:A${structureEnd}`).format.columnWidth = 9;
structure.getRange(`B1:B${structureEnd}`).format.columnWidth = 30;
structure.getRange(`C1:C${structureEnd}`).format.columnWidth = 12;
structure.getRange(`D1:K${structureEnd}`).format.columnWidth = 18;
structure.getRange(`L1:M${structureEnd}`).format.columnWidth = 14;
structure.getRange(`N1:N${structureEnd}`).format.columnWidth = 48;

// Detail rozpočtu
applyTitle(detail, "A1:N1", "Detail všech nenulových příjmů a výdajů — FIN 2-12 M");
detail.getRange("A2:N2").merge();
detail.getRange("A2").values = [[
  "Detail je před konsolidací vnitřních převodů. Oficiální konsolidované součty jsou na listech Přehled a Struktura.",
]];
applyMetadata(detail, "A2:N2");
detail.getRange("A4:N4").values = [[
  "Pořadí", "Město", "IČO", "Druh", "Třída", "Paragraf", "Název paragrafu", "Položka", "Název položky",
  "Schválený rozpočet", "Rozpočet po změnách", "Skutečnost", "Odchylka vs. po změnách", "Plnění",
]];
applyHeader(detail.getRange("A4:N4"));
const detailStart = 5;
const detailEnd = detailStart + data.budget_detail.length - 1;
detail.getRange(`A${detailStart}:L${detailEnd}`).values = data.budget_detail.map((row) => [
  row.rank, row.city, Number(row.ico), row.kind, Number(row.class), Number(row.paragraph), row.paragraph_name, Number(row.item), row.item_name,
  row.approved, row.after_changes, row.actual,
]);
detail.getRange(`M${detailStart}`).formulas = [[`=L${detailStart}-K${detailStart}`]];
detail.getRange(`M${detailStart}:M${detailEnd}`).fillDown();
detail.getRange(`N${detailStart}`).formulas = [[`=IFERROR(L${detailStart}/K${detailStart},0)`]];
detail.getRange(`N${detailStart}:N${detailEnd}`).fillDown();
detail.getRange(`C${detailStart}:C${detailEnd}`).format.numberFormat = "00000000";
detail.getRange(`E${detailStart}:E${detailEnd}`).format.numberFormat = "0";
detail.getRange(`F${detailStart}:F${detailEnd}`).format.numberFormat = "0000";
detail.getRange(`H${detailStart}:H${detailEnd}`).format.numberFormat = "0000";
detail.getRange(`J${detailStart}:M${detailEnd}`).format.numberFormat = amountFormat;
detail.getRange(`N${detailStart}:N${detailEnd}`).format.numberFormat = percentFormat;
detail.getRange(`D${detailStart}:D${detailEnd}`).conditionalFormats.add("containsText", {
  text: "Příjmy", format: { fill: "#E2F0D9" },
});
detail.getRange(`D${detailStart}:D${detailEnd}`).conditionalFormats.add("containsText", {
  text: "Výdaje", format: { fill: "#DDEBF7" },
});
addTable(detail, `A4:N${detailEnd}`, "BudgetDetailTable", "TableStyleMedium2");
detail.freezePanes.freezeRows(4);
detail.freezePanes.freezeColumns(3);
detail.getRange(`A1:A${detailEnd}`).format.columnWidth = 9;
detail.getRange(`B1:B${detailEnd}`).format.columnWidth = 30;
detail.getRange(`C1:C${detailEnd}`).format.columnWidth = 12;
detail.getRange(`D1:F${detailEnd}`).format.columnWidth = 12;
detail.getRange(`G1:G${detailEnd}`).format.columnWidth = 34;
detail.getRange(`H1:H${detailEnd}`).format.columnWidth = 11;
detail.getRange(`I1:I${detailEnd}`).format.columnWidth = 58;
detail.getRange(`J1:M${detailEnd}`).format.columnWidth = 19;
detail.getRange(`N1:N${detailEnd}`).format.columnWidth = 12;

// Cash
applyTitle(cash, "A1:I1", "Stav peněžních prostředků podle rozvahových účtů");
cash.getRange("A2:I2").merge();
cash.getRange("A2").values = [[data.metadata.cash_definition]];
cash.getRange("A3:I3").merge();
cash.getRange("A3").values = [["Hodnoty jsou netto k 31. 12.; sloupec Podíl města se počítá vůči celkovému cash na listu Přehled."]];
applyMetadata(cash, "A2:I3");
cash.getRange("A5:I5").values = [[
  "Pořadí", "Město", "IČO", "Syntetický účet", "Název účtu", "31. 12. 2025", "31. 12. 2024", "Změna", "Podíl města",
]];
applyHeader(cash.getRange("A5:I5"));
const cashStart = 6;
const cashEnd = cashStart + data.cash_components.length - 1;
cash.getRange(`A${cashStart}:G${cashEnd}`).values = data.cash_components.map((row) => [
  row.rank, row.city, Number(row.ico), Number(row.account), row.account_name, row.cash_2025, row.cash_2024,
]);
cash.getRange(`H${cashStart}`).formulas = [[`=F${cashStart}-G${cashStart}`]];
cash.getRange(`H${cashStart}:H${cashEnd}`).fillDown();
cash.getRange(`I${cashStart}`).formulas = [[`=IFERROR(F${cashStart}/INDEX('Přehled'!$P$${overviewStart}:$P$${overviewEnd},A${cashStart}),0)`]];
cash.getRange(`I${cashStart}:I${cashEnd}`).fillDown();
cash.getRange(`C${cashStart}:C${cashEnd}`).format.numberFormat = "00000000";
cash.getRange(`D${cashStart}:D${cashEnd}`).format.numberFormat = "000";
cash.getRange(`F${cashStart}:H${cashEnd}`).format.numberFormat = amountFormat;
cash.getRange(`I${cashStart}:I${cashEnd}`).format.numberFormat = percentFormat;
addTable(cash, `A5:I${cashEnd}`, "CashTable", "TableStyleMedium4");
cash.freezePanes.freezeRows(5);
cash.freezePanes.freezeColumns(3);
cash.getRange(`A1:A${cashEnd}`).format.columnWidth = 9;
cash.getRange(`B1:B${cashEnd}`).format.columnWidth = 30;
cash.getRange(`C1:D${cashEnd}`).format.columnWidth = 13;
cash.getRange(`E1:E${cashEnd}`).format.columnWidth = 48;
cash.getRange(`F1:H${cashEnd}`).format.columnWidth = 19;
cash.getRange(`I1:I${cashEnd}`).format.columnWidth = 13;

// Kontroly
applyTitle(checks, "A1:G1", "Kontroly a reconciliace");
checks.getRange("A2:B2").merge();
checks.getRange("A2").values = [["MODEL STATUS"]];
checks.getRange("C2:D2").merge();
checks.getRange("C2").formulas = [[`=IF(COUNTIF(F6:F${5 + data.cities.length},"<>OK")=0,"PASS","FAIL")`]];
checks.getRange("A2:D2").format = {
  fill: COLORS.lightBlue,
  font: { bold: true, color: COLORS.navy },
  borders: { preset: "outside", style: "medium", color: COLORS.blue },
};
checks.getRange("C2:D2").format.horizontalAlignment = "center";
checks.getRange("A4:G4").values = [["Město", "IČO", "Kontrola", "Rozdíl", "Tolerance", "Status", "Poznámka"]];
applyHeader(checks.getRange("A4:G4"));
const checkStart = 6;
const checkEnd = checkStart + data.cities.length - 1;
checks.getRange(`A${checkStart}:C${checkEnd}`).values = data.cities.map((city) => [
  city.name, Number(city.ico), "Příjmy − výdaje + financování = 0",
]);
checks.getRange(`E${checkStart}:E${checkEnd}`).values = data.cities.map(() => [1]);
checks.getRange(`G${checkStart}:G${checkEnd}`).values = data.cities.map(() => ["Tolerance 1 Kč kvůli zaokrouhlení dat."]);
for (let i = 0; i < data.cities.length; i += 1) {
  const row = checkStart + i;
  const overviewRow = overviewStart + i;
  checks.getRange(`D${row}`).formulas = [[`=ROUND('Přehled'!H${overviewRow}-'Přehled'!L${overviewRow}+'Přehled'!O${overviewRow},2)`]];
  checks.getRange(`F${row}`).formulas = [[`=IF(ABS(D${row})<=E${row},"OK","ZKONTROLOVAT")`]];
}
checks.getRange(`B${checkStart}:B${checkEnd}`).format.numberFormat = "00000000";
checks.getRange(`D${checkStart}:E${checkEnd}`).format.numberFormat = amountFormat;
checks.getRange(`F${checkStart}:F${checkEnd}`).conditionalFormats.add("containsText", {
  text: "OK", format: { fill: COLORS.paleGreen, font: { bold: true, color: COLORS.green } },
});
checks.getRange(`F${checkStart}:F${checkEnd}`).conditionalFormats.add("containsText", {
  text: "ZKONTROLOVAT", format: { fill: COLORS.paleRed, font: { bold: true, color: COLORS.red } },
});
addTable(checks, `A4:G${checkEnd}`, "ChecksTable", "TableStyleMedium2");
checks.freezePanes.freezeRows(4);
checks.getRange(`A1:A${checkEnd}`).format.columnWidth = 30;
checks.getRange(`B1:B${checkEnd}`).format.columnWidth = 12;
checks.getRange(`C1:C${checkEnd}`).format.columnWidth = 38;
checks.getRange(`D1:E${checkEnd}`).format.columnWidth = 17;
checks.getRange(`F1:F${checkEnd}`).format.columnWidth = 16;
checks.getRange(`G1:G${checkEnd}`).format.columnWidth = 36;

// Zdroje a metodika
applyTitle(sources, "A1:F1", "Zdroje, rozsah a metodika");
const metadataRows = [
  ["Období", data.metadata.period],
  ["Rozvahový den", data.metadata.as_of],
  ["Jednotka", data.metadata.units],
  ["Rozsah", data.metadata.scope],
  ["Definice cash", data.metadata.cash_definition],
];
sources.getRange("A3:A7").values = metadataRows.map(([label]) => [label]);
for (let i = 0; i < metadataRows.length; i += 1) {
  const row = 3 + i;
  sources.getRange(`B${row}:F${row}`).merge();
  sources.getRange(`B${row}`).values = [[metadataRows[i][1]]];
}
sources.getRange("A3:A7").format = { fill: COLORS.lightBlue, font: { bold: true, color: COLORS.navy } };
sources.getRange("A3:F7").format.wrapText = true;
sources.getRange("A6:F7").format.rowHeight = 30;
sources.getRange("A9:F9").values = [["Položka", "Období", "Zdroj", "URL", "Poznámka", "Přístup / příprava"]];
applyHeader(sources.getRange("A9:F9"));
const sourceRows = [
  ...data.sources.map((source) => [source.item, source.period, source.source, source.url, source.note, new Date(data.metadata.prepared_on)]),
  ["Ověření názvů a IČO", "aktuální", "ARES", "https://ares.gov.cz/ekonomicke-subjekty", "Ověřeno pro všech 26 účetních jednotek.", new Date(data.metadata.prepared_on)],
];
const sourceStart = 10;
const sourceEnd = sourceStart + sourceRows.length - 1;
sources.getRange(`A${sourceStart}:F${sourceEnd}`).values = sourceRows;
sources.getRange(`D${sourceStart}:D${sourceEnd}`).format.font = { color: "#0563C1", underline: true };
sources.getRange(`F${sourceStart}:F${sourceEnd}`).format.numberFormat = "yyyy-mm-dd";
sources.getRange(`A${sourceStart}:F${sourceEnd}`).format.wrapText = true;
addTable(sources, `A9:F${sourceEnd}`, "SourcesTable", "TableStyleMedium4");
sources.getRange("A17:F17").merge();
sources.getRange("A17").values = [["Interpretace"]];
sources.getRange("A17:F17").format = { fill: COLORS.navy, font: { bold: true, color: COLORS.white } };
sources.getRange("A18:F21").merge(true);
sources.getRange("A18").values = [["Rozpočtová skutečnost je vedena na peněžním (cash) principu. Detailní FIN 2-12 M obsahuje i vnitřní převody; konsolidované součty na listech Přehled a Struktura je eliminují."]];
sources.getRange("A19").values = [["Stav cash vychází z rozvahy, tedy ze stavu účtů k 31. 12. 2025, nikoli z ročního toku příjmů a výdajů."]];
sources.getRange("A20").values = [["U statutárních měst je zachycena uvedená účetní jednotka. Samostatné příspěvkové organizace a městské části/obvody nejsou přičítány."]];
sources.getRange("A21").values = [["Skóre K–Indexu je převzato ze zadání; u Olomouce nebyla číselná hodnota uvedena, proto zůstává prázdná."]];
sources.getRange("A18:F21").format = { fill: "#F3F6F9", wrapText: true, font: { color: COLORS.darkGray } };
sources.getRange("A18:F21").format.rowHeight = 34;
sources.getRange("A1:A21").format.columnWidth = 28;
sources.getRange("B1:B21").format.columnWidth = 18;
sources.getRange("C1:C21").format.columnWidth = 30;
sources.getRange("D1:D21").format.columnWidth = 65;
sources.getRange("E1:E21").format.columnWidth = 55;
sources.getRange("F1:F21").format.columnWidth = 18;
sources.freezePanes.freezeRows(9);

// Compact verification before export.
const overviewInspect = await workbook.inspect({
  kind: "table",
  range: `Přehled!A1:S${overviewEnd}`,
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 19,
  maxChars: 10000,
});
console.log("OVERVIEW_INSPECT");
console.log(overviewInspect.ndjson);

const checksInspect = await workbook.inspect({
  kind: "table",
  range: `Kontroly!A1:G${checkEnd}`,
  include: "values,formulas",
  tableMaxRows: 32,
  tableMaxCols: 7,
  maxChars: 12000,
});
console.log("CHECKS_INSPECT");
console.log(checksInspect.ndjson);

const errorScan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
  maxChars: 4000,
});
console.log("FORMULA_ERRORS");
console.log(errorScan.ndjson);

const renderSpecs = [
  ["Přehled", `A1:S${overviewEnd}`],
  ["Struktura", `A1:N${structureEnd}`],
  ["Detail rozpočtu", "A1:N24"],
  ["Cash", "A1:I34"],
  ["Kontroly", `A1:G${checkEnd}`],
  ["Zdroje a metodika", "A1:F21"],
];
for (const [sheetName, range] of renderSpecs) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  const safeName = sheetName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_");
  await fs.writeFile(path.join(previewDir, `${safeName}.png`), new Uint8Array(await preview.arrayBuffer()));
  console.log(`RENDERED ${sheetName} ${range}`);
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, overviewEnd, structureEnd, detailEnd, cashEnd, checkEnd }));
