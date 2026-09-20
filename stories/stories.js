(() => {
  const controls = document.querySelector('.stories-controls');
  const cards = [...document.querySelectorAll('.story-card')];
  const search = document.querySelector('#story-search');
  const query = new URLSearchParams(location.search);
  let format = ['story','mini'].includes(query.get('format')) ? query.get('format') : 'all';
  if(search) search.value = query.get('q') || '';
  const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function filter(persist = false) {
    const term = fold(search?.value.trim() || '');
    let count = 0;
    cards.forEach(card => { card.hidden = !(format === 'all' || card.dataset.format === format) || !fold(card.dataset.search).includes(term); if(!card.hidden) count++; });
    document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.filter===format)));
    const status = document.querySelector('#story-results');
    if(status) status.textContent = document.documentElement.lang==='cs' ? `Zobrazeno: ${count} z ${cards.length}` : `${count} of ${cards.length} stories`;
    const empty = document.querySelector('#stories-empty'); if(empty) empty.hidden = count !== 0;
    if(persist) { const url = new URL(location.href); format==='all'?url.searchParams.delete('format'):url.searchParams.set('format',format); search?.value.trim()?url.searchParams.set('q',search.value.trim()):url.searchParams.delete('q'); history.replaceState(null,'',url); }
  }
  function translate() {
    const lang = document.documentElement.lang === 'cs' ? 'cs' : 'en';
    document.querySelectorAll('[data-en][data-cs]').forEach(node => { node.textContent = node.dataset[lang]; });
    if(search) search.placeholder = lang==='cs'?'Cla, příjmy…':'Tariffs, revenue…';
    document.documentElement.removeAttribute('data-language-pending');
    filter();
  }
  if(controls) controls.hidden = false;
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{format=button.dataset.filter;filter(true);}));
  search?.addEventListener('input',()=>filter(true));
  document.addEventListener('click',event=>{const button=event.target.closest('button[data-lang]');if(button) window.PSDLanguage?.set(button.dataset.lang,{persist:true});});
  window.addEventListener('psdlanguagechange',translate);
  translate();
})();
