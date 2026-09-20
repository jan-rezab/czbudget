/* Revalidated entry point. A manifest pins a mutually compatible JS/CSS pair.
 * Old content-addressed files remain available across releases and rollbacks. */
(function () {
  if (window.PSDPlotReady) return;
  window.PSDPlotReady = (async () => {
    const response = await fetch('/assets/chart-releases/current.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Chart manifest unavailable: ${response.status}`);
    const release = await response.json();
    if (release.schema_version !== 1) throw new Error('Unsupported chart component contract');
    for (const asset of [release.script, release.style]) {
      if (!/^\/assets\/chart-releases\/[a-f0-9]{64}\.(js|css)$/.test(asset.url) || !/^sha256-[A-Za-z0-9+/]+=*$/.test(asset.integrity)) throw new Error('Invalid chart asset');
    }
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = release.style.url;
    css.integrity = release.style.integrity; css.crossOrigin = 'anonymous'; css.dataset.sharedCharts = '';
    const cssReady = new Promise((resolve, reject) => { css.onload=resolve; css.onerror=()=>reject(new Error('Chart style failed integrity/loading')); });
    document.head.append(css);
    const js = document.createElement('script'); js.src = release.script.url;
    js.integrity = release.script.integrity; js.crossOrigin = 'anonymous';
    const jsReady = new Promise((resolve, reject) => { js.onload=resolve; js.onerror=()=>reject(new Error('Chart renderer failed integrity/loading')); });
    document.head.append(js);
    await Promise.all([jsReady, cssReady]);
    return window.PSDPlot;
  })();
})();
