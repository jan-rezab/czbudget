import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const dataset = JSON.parse(read('data/cz-public-entities-2024.json'));

test('all seven insurers reconcile and cash flows stay outside accounting totals', () => {
  const insurers = dataset.entities.filter(row => row.health_insurance);
  assert.equal(insurers.length, 7);
  for (const row of insurers) {
    const h = row.health_insurance;
    assert.ok(Math.abs(h.receipts_mczk - h.expenditure_mczk - h.cash_balance_mczk) < .001);
    assert.equal(h.year, 2024);
    assert.ok(row.assets_mczk > 0);
    for (const field of ['revenue_mczk', 'cost_mczk', 'net_result_mczk']) assert.equal(row[field], null);
    assert.equal(row.top_line.net_margin_pct, null);
  }
  const totals = dataset.summary.groups['Zdravotní pojišťovna'];
  assert.equal(totals.financial_data_count, 7);
  assert.equal(totals.revenue_sum_mczk, 0);
  assert.equal(totals.net_result_sum_mczk, 0);
  assert.equal(totals.health_insurance.receipts_mczk, 504667.887);
  assert.equal(totals.health_insurance.expenditure_mczk, 512186.394);
  assert.equal(totals.health_insurance.cash_balance_mczk, -7518.507);
  assert.equal(totals.health_insurance.assets_mczk, 116797.224);
});

// Exercise the real registry renderer and event handlers without starting a browser.
for (const embed of [false, true]) for (const lang of ['cs', 'en']) {
  test(`${embed ? 'embedded' : 'standalone'} registry: health tab, sort, search and return (${lang})`, () => {
    const prefix = embed ? 'embed-' : '';
    const html = read(embed ? 'cesky-rozpocet.html' : 'cesko.html');
    const nodes = new Map();
    const element = () => ({textContent: '', innerHTML: '', value: '', dataset: {}, listeners: {},
      insertAdjacentHTML() {}, setAttribute() {},
      addEventListener(name, fn) { this.listeners[name] = fn; }});
    for (const [, id] of html.matchAll(/id="([^"]+)"/g)) {
      const node = element();
      const label = element(), note = element();
      node.parentElement = {querySelector: tag => tag === 'span' ? label : note};
      nodes.set('#' + id, node);
    }
    const get = id => nodes.get('#' + prefix + id);
    get('entity-owner').value = 'all';
    get('entity-sort').value = 'topline';
    const tabs = ['all', 'Firma', 'Vysoká škola', 'Nemocnice', 'Zdravotní pojišťovna'].map(category => {
      const node = element(); node.dataset.category = category; return node;
    });
    const document = {
      documentElement: {lang},
      querySelector: query => nodes.get(query) ?? null,
      querySelectorAll: query => query === '#' + prefix + 'entity-tabs button' ? tabs : [],
    };
    let script = read(embed ? 'cz-firmy-embed.js' : 'cz-firmy.js');
    script = script.slice(0, script.indexOf('Promise.all(['));
    script += embed ? 'renderRegistry(dataset); })();' : 'renderPublicRegistry(dataset);';
    vm.runInNewContext(script, {document, dataset, Intl, console});
    const originalTotal = get('net-sum').textContent;
    tabs[4].listeners.click();
    assert.match(get('registry-coverage').textContent, /^7 \/ 7 /);
    assert.equal(get('profit-sum').textContent, lang === 'cs' ? '504,7' : '504.7');
    assert.equal(get('net-sum').textContent, lang === 'cs' ? '-7,5' : '-7.5');
    const rows = get('public-entity-rows').innerHTML;
    assert.equal((rows.match(/<tr>/g) || []).length, 7);
    assert.equal((rows.match(/<td[ >]/g) || []).length, 49);
    assert.ok(!rows.includes('<tr<'));
    assert.ok(!rows.includes('data-missing'));
    assert.match(rows, /mzd.gov.cz/);
    assert.ok(rows.includes(lang === 'cs' ? 'saldo příjmů a výdajů' : 'cash balance'));
    assert.ok(rows.includes(lang === 'cs' ? 'Výdaje' : 'Expenditure'));
    get('entity-sort').value = 'result'; get('entity-sort').listeners.change();
    assert.ok(get('public-entity-rows').innerHTML.indexOf('Vojenská') < get('public-entity-rows').innerHTML.indexOf('Všeobecná'));
    get('entity-search').value = '41197518'; get('entity-search').listeners.input();
    assert.equal((get('public-entity-rows').innerHTML.match(/<tr>/g) || []).length, 1);
    get('entity-search').value = ''; get('entity-search').listeners.input();
    tabs[0].listeners.click();
    assert.equal(get('net-sum').textContent, originalTotal);
    assert.equal(get('profit-sum').parentElement.querySelector('span').textContent, lang === 'cs' ? 'Suma zisků' : 'Sum of profits');
  });
}
