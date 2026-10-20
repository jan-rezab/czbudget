/* Read-only presentation of the existing MF cards and reviewed individual accounts. */
(function (root) {
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  function create(portfolio, language, prefix) {
    const en = language === 'en', locale = en ? 'en-GB' : 'cs-CZ';
    const entities = new Map(portfolio.entities.map(entity => [entity.ico, entity]));
    const text = (cs, english) => en ? english : cs;
    const number = value => Number.isFinite(value) ? new Intl.NumberFormat(locale, {maximumFractionDigits: 3}).format(value) : '—';
    const id = ico => `${prefix}-financial-${ico}`;
    const link = (url, label) => safeUrl(url) ? `<a href="${esc(safeUrl(url))}" target="_blank" rel="noreferrer">${esc(label)} ↗</a>` : '';
    const row = (label, value, unit) => `<tr><th scope="row">${esc(label)}</th><td>${number(value)}${Number.isFinite(value) ? ` ${esc(unit)}` : ''}</td></tr>`;
    const mfSource = portfolio.sources.find(source => /mf\.gov\.cz/.test(safeUrl(source.url)))?.url;
    function trigger(entity) {
      if (!entities.has(entity.ico)) return `<strong>${esc(entity.name)}</strong>`;
      return `<button type="button" class="entity-financial-trigger" data-entity-financial="${esc(entity.ico)}" aria-expanded="false" aria-controls="${esc(id(entity.ico))}"><strong>${esc(entity.name)}</strong><span>${text('Finanční detail a výkazy', 'Financial detail and statements')} ↓</span></button>`;
    }
    function detail(entity) {
      const card = entities.get(entity.ico);
      if (!card) return '';
      const m = card.metrics, b = card.balance_sheet;
      const million = text('mil. Kč', 'CZK m');
      const metrics = [
        ['Obrat', 'Turnover', 'turnover'], ['Výsledek po zdanění', 'Result after tax', 'net_result'],
        ['EBITDA', 'EBITDA', 'ebitda'], ['Investice', 'Investment', 'investment'],
        ['Aktiva podle MF', 'Assets reported by MF', 'total_assets'], ['Dlouhodobý majetek', 'Fixed assets', 'fixed_assets'],
        ['Vlastní kapitál podle MF', 'Equity reported by MF', 'equity'], ['Ukazatel dluhu MF', 'MF debt indicator', 'debt'],
        ['Základní kapitál', 'Registered capital', 'registered_capital'],
        [card.owner_transfer_type_cs || 'Příjem vlastníka podle MF', 'Owner receipt reported by MF', 'owner_transfer'],
        ['Zaměstnanci', 'Employees', 'employees'], ['Z toho ženy', 'Of whom women', 'women_employees']
      ];
      const mfUrl = safeUrl(mfSource);
      const sourceUrl = mfUrl ? `${mfUrl}#page=${Number(card.source_page) || 1}` : '';
      const balance = b ? `<section><h4>${text('Individuální rozvaha', 'Individual balance sheet')} · ${esc(b.as_of)}</h4><table class="entity-financial-values"><tbody>${[
        ['Aktiva netto', 'Total assets (net book value)', 'total_assets_czk'], ['Vlastní kapitál', 'Equity', 'equity_czk'],
        ['Ostatní pasiva (aktiva − vlastní kapitál)', 'Other funding (assets − equity)', 'non_equity_funding_czk'],
        ['Peněžní prostředky dle závěrky', 'Cash as defined in the accounts', 'cash_czk']
      ].map(([cs, english, key]) => row(text(cs, english), b[key], 'CZK')).join('')}</tbody></table><p>${text('Ostatní pasiva jsou dopočet zahrnující závazky, rezervy a časové rozlišení; nejde o úročený dluh. Účetní peníze nejsou automaticky volné prostředky státního rozpočtu.', 'Other funding is derived and includes liabilities, provisions and accruals; it is not interest-bearing debt. Accounting cash is not automatically available to the state budget.')}</p><p>${link(b.source?.url?.split('#')[0] + '#page=' + (b.source?.pdf_pages?.[0] || 1), text('Výroční zpráva a úplné výkazy', 'Annual report and full statements'))} · ${text('strany PDF', 'PDF pages')} ${esc(b.source?.pdf_pages?.join(', '))}</p>${b.notes?.length ? `<ul>${b.notes.map(note => `<li>${esc(note)}</li>`).join('')}</ul>` : ''}</section>` : '';
      return `<tr id="${esc(id(entity.ico))}" class="entity-financial-row" hidden><td colspan="7"><div class="entity-financial-panel"><h3>${esc(card.name)} · ${portfolio.year}</h3><p>${text('Skutečné výsledky individuálního subjektu, nikoli plánovaný rozpočet. Úplné položkové rozpady jsou v citovaných výkazech; zde jsou dostupné souhrny.', 'Actual results for the individual entity, not a planned budget. Full line-item breakdowns are in the cited statements; available summaries are shown here.')}</p><div class="entity-financial-grid"><section><h4>${text('Ukazatele Ministerstva financí', 'Ministry of Finance indicators')} · ${portfolio.year}</h4><table class="entity-financial-values"><tbody>${metrics.map(([cs, english, key]) => row(text(cs, english), m[key], key.includes('employees') ? text('osob', 'persons') : million)).join('')}</tbody></table><p>${text('Ukazatel dluhu MF není ověřený součet závazků ani úročeného dluhu. Zaměstnanci jsou osoby podle karty MF, nikoli předpokládané FTE.', 'The MF debt indicator is not a verified total of liabilities or interest-bearing debt. Employees are persons reported on the MF card, not assumed FTE.')}</p><p>${link(sourceUrl, text('Zdroj: karta MF', 'Source: MF card'))} · ${text('strana PDF', 'PDF page')} ${esc(card.source_page)}</p></section>${balance}</div>${b ? `<p>${text('Rozvaha a karta MF jsou samostatné zdroje; případné rozdíly nejsou přepisovány.', 'The accounts and the MF card are separate sources; differences are preserved.')}</p>` : ''}</div></td></tr>`;
    }
    function bind(body) {
      body.addEventListener('click', event => {
        const button = event.target.closest('[data-entity-financial]');
        if (!button || !body.contains(button)) return;
        const panel = body.querySelector(`#${id(button.dataset.entityFinancial)}`);
        if (!panel) return;
        panel.hidden = !panel.hidden;
        button.setAttribute('aria-expanded', String(!panel.hidden));
      });
      body.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const trigger = event.target.closest('[data-entity-financial]');
        const panel = event.target.closest('.entity-financial-row') || (trigger && body.querySelector(`#${id(trigger.dataset.entityFinancial)}`));
        if (!panel || panel.hidden) return;
        panel.hidden = true;
        const button = body.querySelector(`[aria-controls="${panel.id}"]`);
        button?.setAttribute('aria-expanded', 'false');
        button?.focus();
      });
    }
    return {trigger, detail, bind};
  }
  root.PublicEntityFinancialDetail = {create};
})(globalThis);
