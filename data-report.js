(() => {
  if (window.PSDDataReport) return;
  const root = new URL('.', document.currentScript.src);
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = new URL('data-report.css?v=20260909', root); document.head.append(style);
  const I = {
    en: { button: 'Report data', eyebrow: 'BETTER DATA, TOGETHER', title: 'Help get the details right.', intro: 'Spotted something? A small correction can make a big difference.', page: 'Reporting on', target: 'Data point or section (optional)', targetHint: 'e.g. Total expenditure · 2024 · CZK 12.5bn', reason: 'What needs attention?', reasons: ['Incorrect figure', 'Outdated data', 'Missing or broken source', 'Missing context', 'Something else'], explanation: 'Tell us what you noticed', hint: 'Which figure looks wrong, why, and what should it be? At least 20 characters.', source: 'Supporting source (optional)', email: 'Email (optional)', contact: 'Only for questions about this report. Stored privately and scheduled for deletion after 90 days; no marketing. You can report without it.', privacy: 'Your report starts in a private review queue. Please avoid personal or sensitive information in the explanation.', send: 'Send for review', close: 'Close', pending: 'Sending…', checking: 'Preparing secure reporting…', unavailable: 'Online reporting is not available yet. You can contact info@hlidacstatu.cz.', error: 'We could not confirm your report. Your text is still here; please try again.', success: 'Thank you for making the data better.', received: 'Your report is saved for review. Published data changes only after verification.', ref: 'Report reference', steps: '01 You flag it  →  02 We check the source  →  03 We correct it', protection: 'Protected by reCAPTCHA.', googlePrivacy: 'Privacy', googleTerms: 'Terms' },
    cs: { button: 'Nahlásit data', eyebrow: 'LEPŠÍ DATA SPOLEČNĚ', title: 'Pomozte nám doladit detaily.', intro: 'Něco nesedí? I malá oprava může hodně změnit.', page: 'Nahlášení ke stránce', target: 'Datový bod nebo sekce (nepovinné)', targetHint: 'např. Celkové výdaje · 2024 · 12,5 mld. Kč', reason: 'Co potřebuje pozornost?', reasons: ['Nesprávná hodnota', 'Zastaralá data', 'Chybějící nebo nefunkční zdroj', 'Chybějící kontext', 'Něco jiného'], explanation: 'Popište, čeho jste si všimli', hint: 'Která hodnota nesedí, proč a jaká by měla být? Alespoň 20 znaků.', source: 'Podkladový zdroj (nepovinné)', email: 'E-mail (nepovinné)', contact: 'Pouze pro dotazy k tomuto hlášení. Uchováváme jej neveřejně a po 90 dnech jej zařadíme ke smazání, bez marketingu. Hlášení lze poslat i bez něj.', privacy: 'Hlášení nejprve projde neveřejnou kontrolou. Do popisu neuvádějte osobní ani citlivé údaje.', send: 'Odeslat ke kontrole', close: 'Zavřít', pending: 'Odesílání…', checking: 'Připravujeme zabezpečený formulář…', unavailable: 'Online hlášení zatím není dostupné. Můžete napsat na info@hlidacstatu.cz.', error: 'Přijetí hlášení se nepodařilo potvrdit. Text zůstává vyplněný; zkuste to znovu.', success: 'Děkujeme, že pomáháte zlepšovat data.', received: 'Hlášení je uloženo ke kontrole. Publikovaná data měníme až po ověření.', ref: 'Číslo hlášení', steps: '01 Upozorníte nás  →  02 Ověříme zdroj  →  03 Opravíme data', protection: 'Chráněno službou reCAPTCHA.', googlePrivacy: 'Soukromí', googleTerms: 'Podmínky' }
  };
  const copy = () => I[document.documentElement.lang === 'en' ? 'en' : 'cs'];
  const button = document.createElement('button'); button.type = 'button'; button.className = 'dr-launch';
  button.textContent = copy().button;
  document.body.append(button);
  new MutationObserver(() => { button.textContent = copy().button; }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  let dialog, captcha;
  function loadCaptcha(key) {
    if (!captcha) captcha = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(key)}`;
      const timer = setTimeout(() => reject(new Error('timeout')), 12000);
      script.onload = () => { clearTimeout(timer); window.grecaptcha.enterprise.ready(resolve); };
      script.onerror = () => { clearTimeout(timer); reject(new Error('captcha')); }; document.head.append(script);
    }).catch(error => { captcha = null; throw error; });
    return captcha;
  }
  async function open(target = '') {
    if (dialog?.open) return;
    const t = copy();
    dialog?.remove(); dialog = document.createElement('dialog'); dialog.className = 'dr-dialog'; dialog.setAttribute('aria-labelledby', 'dr-title');
    dialog.innerHTML = `<button type="button" class="dr-close" aria-label="${t.close}">×</button><div class="dr-eyebrow">${t.eyebrow}</div><h2 id="dr-title">${t.title}</h2><p class="dr-intro">${t.intro}</p><div class="dr-context"><small>${t.page}</small><strong></strong></div><form><label>${t.target}<input name="target" maxlength="500" placeholder="${t.targetHint}"></label><label>${t.reason}<select name="reason">${['incorrect', 'outdated', 'source', 'context', 'other'].map((v, i) => `<option value="${v}">${t.reasons[i]}</option>`).join('')}</select></label><label>${t.explanation}<textarea name="explanation" required minlength="20" maxlength="4000" rows="3" placeholder="${t.hint}"></textarea></label><label>${t.source}<input name="source" type="url" maxlength="2000" placeholder="https://"></label><label>${t.email}<input name="email" type="email" maxlength="254" autocomplete="email" aria-describedby="dr-contact"></label><p id="dr-contact" class="dr-note">${t.contact}</p><label class="dr-trap" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><p class="dr-note">${t.privacy}</p><p class="dr-status" role="status">${t.checking}</p><button class="dr-submit" disabled>${t.send} ↗</button><p class="dr-note">${t.protection} <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">${t.googlePrivacy}</a> · <a href="https://policies.google.com/terms" target="_blank" rel="noopener">${t.googleTerms}</a></p></form><div class="dr-steps">${t.steps}</div>`;
    const current = dialog;
    dialog.querySelector('.dr-context strong').textContent = document.title;
    const form = dialog.querySelector('form'); form.elements.target.value = String(target).slice(0, 500);
    dialog.querySelector('.dr-close').onclick = () => dialog.close();
    document.body.append(dialog); dialog.showModal();
    const status = dialog.querySelector('.dr-status'), submit = dialog.querySelector('.dr-submit');
    let config;
    try {
      const response = await fetch('/api/data-reports/config', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('config'); config = await response.json();
      if (!config.enabled) throw new Error('disabled');
      await loadCaptcha(config.siteKey);
      if (dialog !== current) return;
      status.textContent = ''; submit.disabled = false;
    } catch { status.textContent = t.unavailable; return; }
    form.onsubmit = async event => {
      event.preventDefault(); submit.disabled = true; status.textContent = t.pending;
      try {
        const token = await window.grecaptcha.enterprise.execute(config.siteKey, { action: 'data_report' });
        const url = new URL(location.href);
        for (const key of [...url.searchParams.keys()]) if (!['lang', 'code', 'country', 'year', 'id'].includes(key)) url.searchParams.delete(key);
        const response = await fetch('/api/data-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000), body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), page: url.pathname + url.search + url.hash, title: document.title.slice(0, 300), token }) });
        const result = await response.json(); if (!response.ok || !result.id) throw new Error('submit');
        form.replaceChildren(); const heading = document.createElement('h3'); heading.textContent = t.success;
        const note = document.createElement('p'); note.textContent = t.received;
        const reference = document.createElement('p'); reference.className = 'dr-reference'; reference.textContent = `${t.ref}: ${result.id}`;
        form.append(heading, note, reference); heading.tabIndex = -1; heading.focus();
      } catch { status.textContent = t.error; submit.disabled = false; }
    };
  }
  button.onclick = () => open();
  document.addEventListener('click', event => { const trigger = event.target.closest('[data-report-target]'); if (trigger) { event.preventDefault(); open(trigger.dataset.reportTarget); } });
  window.PSDDataReport = { open };
})();
