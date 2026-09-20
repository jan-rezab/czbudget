const views = document.querySelector('.funding-views');
function updateViews() {
  if (!views) return;
  const cs = document.documentElement.lang === 'cs';
  const lang = cs ? 'cs' : 'en';
  views.setAttribute('aria-label', cs ? 'Pohled na peníze' : 'Money-flow view');
  views.innerHTML = `<a href="money-flow.html?lang=${lang}" ${views.dataset.current === 'budget' ? 'aria-current="page"' : ''}><span>01</span> ${cs ? 'Kolik peněz teče' : 'How much money flows'}</a><a href="/deep-dives/funding/?lang=${lang}"><span>02</span> ${cs ? 'Jak peníze dorazí ke službám' : 'How money reaches services'} <b aria-hidden="true">↗</b></a>`;
}
updateViews();
addEventListener('psdlanguagechange', updateViews);
