(async () => {
  if (!window.PSDChart) return; // The authored tables remain available without JS.
  const chartsReady = await window.PSDStoryChartsReady;
  document.querySelectorAll('[data-story-table]').forEach(table => {
    const host = table.parentElement;
    const columns = [...table.querySelectorAll('thead th')].map((cell,i)=>({key:String(i),label:cell.textContent}));
    const rows = [...table.querySelectorAll('tbody tr')].map(row=>Object.fromEntries([...row.cells].map((cell,i)=>[String(i),cell.textContent])));
    window.PSDChart.register({
      slug: table.dataset.storyTable, el: host, title: table.dataset.chartTitle,
      columns, rows:()=>rows, source:JSON.parse(table.dataset.chartSource),
      // The three responsive SVG charts support a real 2x image export.
      exports:host.querySelector('.chart svg')?['csv','png']:['csv'], embeddable:false,
    });
    table.hidden = chartsReady === true;
  });
})();
