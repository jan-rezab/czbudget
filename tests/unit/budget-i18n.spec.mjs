import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

// Run the page's pure dictionary/number translation path without its DOM observers.
const source = readFileSync(new URL('../../budget-i18n.js', import.meta.url), 'utf8');
const sandbox = { window: {}, document: { documentElement: { lang: 'cs' }, body: { dataset: {} } } };
vm.runInNewContext(source.slice(0, source.indexOf('  function translateAttributes')) + '\n globalThis.translate = (text, lang) => replaceText(text, lang === "en" ? csToEn : enToCs, lang); })();', sandbox);

test('pension explanation keeps the source year and amount in their correct roles in both languages', () => {
  const cs = 'Výdaje na důchody začínají v roce 2025 na 700,1 mld. Kč, nikoli na nule. „0 %“ v ovladači je pouze nulový roční reálný růst nákladu na osobu; celkové výdaje se i tehdy mění s demografií. Důchodový věk se zavádí lineárně během deseti let. Váhy zdravotnictví a péče jsou scénářové předpoklady, nikoli prognóza ČSÚ.';
  const en = sandbox.translate(cs, 'en');
  assert.match(en, /^In 2025, pension expenditure starts at CZK 700\.1bn, not at zero\./);
  assert.match(en, /‘0%’/);
  assert.equal(sandbox.translate(en, 'cs'), cs);
});

test('chart descriptions preserve source years and translate dynamic values', () => {
  assert.equal(sandbox.translate('Zdroj: ČSÚ · projekce obyvatelstva 2023–2100', 'en'), 'Source: CZSO · population projection 2023–2100');
  assert.equal(sandbox.translate('Datový graf', 'en'), 'Data chart');
  assert.equal(sandbox.translate('0,9 mil.', 'en'), '0.9 million');
  assert.equal(sandbox.translate('z 35,6 : 100 v roce 2025', 'en'), 'from 35.6 : 100 in 2025');
});


test('English grouped integer counts retain their value when returning to Czech', () => {
  assert.equal(sandbox.translate('1,112 organisations', 'cs'), '1\u00a0112 organizací');
  assert.equal(sandbox.translate('1,000,000 organisations', 'cs'), '1\u00a0000\u00a0000 organizací');
  assert.equal(sandbox.translate('1 112 organizací', 'en'), '1,112 organisations');
  assert.equal(sandbox.translate('from CZK 2,427.8bn in 2026', 'cs'), 'z 2\u00a0427,8 mld. Kč v roce 2026');
});


test('spending and entity control labels and data-loading errors translate', () => {
  for (const [cs, en] of [
    ['Podíl skupin na celkových výdajích', 'Group shares of total expenditure'],
    ['Filtrovat účelové oblasti', 'Filter spending purposes'],
    ['Řazení rozpočtových kapitol', 'Budget chapter order'],
    ['Typ veřejného subjektu', 'Public entity type'],
    ['Datová vrstva se nepodařila načíst. Obnovte prosím stránku.', 'The data layer could not be loaded. Please reload the page.'],
  ]) {
    assert.equal(sandbox.translate(cs, 'en'), en);
    assert.equal(sandbox.translate(en, 'cs'), cs);
  }
});
