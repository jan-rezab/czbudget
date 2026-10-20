import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({URL, Intl});
vm.runInContext(readFileSync('lib/public-entity-financial-detail.js', 'utf8'), context);
const portfolio = JSON.parse(readFileSync('data/cz-state-enterprises-2024.json'));
const publicData = JSON.parse(readFileSync('data/cz-public-entities-2024.json'));
const icos = ['70994234','00002739','49710371','00001279','70889953','70890005','70889988'];
test('all screenshot entities expose their own reviewed accounts and correct source pages', () => {
  for (const lang of ['cs','en']) {
    const detail = context.PublicEntityFinancialDetail.create(portfolio, lang, 'test');
    for (const ico of icos) {
      const entity = publicData.entities.find(row => row.ico === ico);
      const card = portfolio.entities.find(row => row.ico === ico);
      assert.match(detail.trigger(entity), /aria-expanded="false"/);
      const html = detail.detail(entity);
      assert.ok(html.includes(new Intl.NumberFormat(lang === 'en' ? 'en-GB':'cs-CZ').format(card.balance_sheet.cash_czk)));
      assert.ok(html.includes('#page='+card.balance_sheet.source.pdf_pages[0]));
      assert.ok(html.includes('#page='+card.source_page));
      assert.match(html, /colspan="7"/);
      assert.ok(html.includes(lang === 'en' ? 'not a planned budget' : 'nikoli plánovaný rozpočet'));
    }
  }
});
test('missing values stay missing, zero remains zero, and unsafe sources are not linked', () => {
  const fixture = {year:2024,sources:[],entities:[{ico:'12345678',name:'<img onerror="oops">',metrics:{turnover:0},balance_sheet:{source:{url:'javascript:alert(1)'},notes:[]}}]};
  const detail = context.PublicEntityFinancialDetail.create(fixture, 'en','test');
  const html = detail.detail(fixture.entities[0]);
  assert.match(html, /0 CZK m/);
  assert.match(html, /<td>—<\/td>/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.doesNotMatch(html, /<img/);
  assert.equal(detail.detail({ico:'absent'}), '');
});
