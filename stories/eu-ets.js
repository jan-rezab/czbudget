(() => {
  const host = document.querySelector('#ets-flow');
  if (!host) return;
  const model = JSON.parse(document.querySelector('#ets-flow-model').textContent);
  const query = new URLSearchParams(location.search);
  let mode = Object.hasOwn(model, query.get('flow')) ? query.get('flow') : 'money';
  let selected = Object.hasOwn(model[mode].nodes, query.get('node')) ? query.get('node') : model[mode].default;
  const lang = () => document.documentElement.lang === 'cs' ? 'cs' : 'en';
  const text = value => value[lang()];
  const ranks = host.querySelector('.ets-ranks');
  const controls = host.querySelector('.ets-controls');
  controls.hidden = false;
  function persist() {
    const url = new URL(location.href);
    url.searchParams.set('flow', mode); url.searchParams.set('node', selected);
    history.replaceState(null, '', url);
  }
  function inspect(key, save = false) {
    selected = key;
    const node = model[mode].nodes[key];
    host.querySelectorAll('[data-node]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.node === key)));
    host.querySelector('#ets-inspection-title').textContent = text(node.label);
    host.querySelector('#ets-inspection-copy').textContent = text(node.detail);
    host.querySelector('#ets-inspection-source').href = node.source;
    const targets = model[mode].edges.filter(([from]) => from === key).map(([,to]) => to);
    const routes = host.querySelector('#ets-routes');
    routes.replaceChildren();
    targets.forEach(target => {
      const link = document.createElement('button'); link.type = 'button'; link.dataset.flowTarget = target;
      link.textContent = '→ ' + text(model[mode].nodes[target].label); routes.append(link);
    });
    host.querySelectorAll('[data-node]').forEach(button => button.dataset.linked = String(targets.includes(button.dataset.node)));

    if (save) persist();
  }
  function render() {
    host.dataset.flow = mode;
    host.querySelectorAll('[data-flow-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.flowMode === mode)));
    host.querySelector('#ets-flow-scope').textContent = mode === 'money'
      ? (lang() === 'cs' ? 'EU ETS1 · aukční výnosy 2024 · šipky vyjadřují směr, nikoli objem' : 'EU ETS1 · auction receipts in 2024 · arrows show direction, not volume')
      : (lang() === 'cs' ? 'EU ETS1 · povolenky · stavy a roční toky se nesčítají' : 'EU ETS1 · allowances · stocks and annual flows stay separate');
    ranks.replaceChildren(...model[mode].ranks.map(keys => {
      const rank = document.createElement('div'); rank.className = 'ets-rank';
      keys.forEach(key => {
        const node = model[mode].nodes[key];
        const button = document.createElement('button'); button.type = 'button'; button.className = 'ets-node'; button.dataset.node = key;
        const label = document.createElement('span'); label.textContent = text(node.label);
        const value = document.createElement('strong'); value.textContent = text(node.value);
        button.append(label, value); rank.append(button);
      });
      return rank;
    }));
    inspect(selected);
  }
  host.addEventListener('click', event => {
    const switcher = event.target.closest('[data-flow-mode]');
    if (switcher) { mode = switcher.dataset.flowMode; selected = model[mode].default; render(); persist(); return; }
    const route = event.target.closest('[data-flow-target]');
    if (route) { inspect(route.dataset.flowTarget, true); ranks.querySelector(`[data-node="${selected}"]`).focus(); return; }
    const button = event.target.closest('[data-node]');
    if (button) inspect(button.dataset.node, true);
  });
  ranks.addEventListener('keydown', event => {
    const button = event.target.closest('[data-node]');
    if (!button) return;
    const keys = model[mode].ranks.flat(), index = keys.indexOf(button.dataset.node);
    let key;
    if (['ArrowRight', 'ArrowDown'].includes(event.key)) key = keys[(index + 1) % keys.length];
    if (['ArrowLeft', 'ArrowUp'].includes(event.key)) key = keys[(index + keys.length - 1) % keys.length];
    if (event.key === 'Home' || event.key === 'Escape') key = model[mode].default;
    if (event.key === 'End') key = keys.at(-1);
    if (key) { event.preventDefault(); inspect(key, true); ranks.querySelector(`[data-node="${key}"]`).focus(); }
  });
  window.addEventListener('psdlanguagechange', render);
  render(); host.dataset.ready = 'true';
})();
