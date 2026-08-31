/**
 * Chart embedding — A2.
 *
 * A chart that can only be seen on this site is a chart most people will never see. An embed
 * puts the figure on the page where the argument is being made, and carries its attribution
 * and a link home with it — which is the only reason a publisher should be willing to host it.
 *
 * The embed renders the *real* chart, not a copy of it. `?embed=<slug>` loads the ordinary
 * page with its ordinary scripts and then hides everything that is not the requested chart.
 * A second implementation drawing the same figure from the same artifacts would look correct
 * on the day it was written and drift silently thereafter; an embed that quietly disagrees
 * with the page it cites is worse than no embed at all.
 *
 * The embed document is deliberately `noindex` with a canonical pointing home. Two URLs
 * showing the same figure compete with each other in search results, and the one that should
 * win is the page with the context around it. What helps is the visible attribution link the
 * embed carries onto the host page, which is a real inbound link from wherever the chart is
 * quoted.
 */
(function () {
  var params = new URLSearchParams(window.location.search);
  var slug = params.get("embed");
  if (!slug) return;

  var COPY = {
    cs: { on: "na", source: "Zdroj", view: "Zobrazit na publicspendingdata.org", missing: "Graf nenalezen" },
    en: { on: "on", source: "Source", view: "View on publicspendingdata.org", missing: "Chart not found" },
  };
  function lang() {
    var value = (window.PSDLanguage && window.PSDLanguage.current && window.PSDLanguage.current()) ||
      document.documentElement.lang || "cs";
    return COPY[value] ? value : "cs";
  }
  function t(key) { return COPY[lang()][key]; }

  document.documentElement.setAttribute("data-psd-embed", slug);

  // The host page keeps whatever <base>/asset paths it already had; only presentation changes.
  var style = document.createElement("style");
  style.textContent = [
    "html[data-psd-embed], html[data-psd-embed] body { margin: 0; padding: 0; background: var(--psd-embed-bg, #fff); }",
    // Declarative rather than a one-off sweep: sections, footers and the language bar are
    // injected after load, and anything hidden only at startup reappears when it arrives.
    "html[data-psd-embed] .psd-embed-keep > *:not(.psd-embed-keep):not(.psd-embed-stage):not(.psd-embed-credit) { display: none !important; }",
    "html[data-psd-embed] .psd-embed-stage { display: block; padding: 16px; box-sizing: border-box; }",
    "html[data-psd-embed] .psd-embed-stage > * { max-width: none; width: auto; margin: 0; }",
    ".psd-embed-credit { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline;",
    "  padding: 10px 16px 14px; font: 12px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;",
    "  color: #55606d; background: var(--psd-embed-bg, #fff);",
    "  border-top: 1px solid rgba(0,0,0,.09); }",
    ".psd-embed-credit a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }",
    ".psd-embed-credit a.psd-embed-home { font-weight: 600; color: #16324f; }",
    ".psd-embed-missing { padding: 24px; font: 14px system-ui, sans-serif; color: #55606d; }",
  ].join("\n");
  document.head.appendChild(style);

  // Search must be told which URL is the real one before it indexes either.
  var robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex, follow";
  document.head.appendChild(robots);

  var canonicalHref = window.location.origin + window.location.pathname;
  var canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalHref + "#" + slug;

  /**
   * Keep the chain from <body> down to the chart, and let CSS hide every branch off it. The
   * chart's own scripts hold references into the tree, so the node is never reparented — a
   * chart moved out from under the code that redraws it stops updating.
   */
  function isolate(host) {
    host.classList.add("psd-embed-stage");
    // Only ancestors are marked: the rule hides a kept node's unkept children, and marking the
    // chart itself would hide everything inside it.
    var node = host.parentElement;
    while (node) {
      node.classList.add("psd-embed-keep");
      if (node === document.body) break;
      node = node.parentElement;
    }
  }

  function credit(host) {
    var sources = Array.prototype.map.call(
      host.querySelectorAll(".chart-source-hover a[href^='http']"),
      function (anchor) { return { href: anchor.href, text: anchor.textContent.replace(/\s*↗\s*$/, "").trim() }; },
    );

    var bar = document.createElement("footer");
    bar.className = "psd-embed-credit";

    var home = document.createElement("a");
    home.className = "psd-embed-home";
    // The frame is a viewport onto this site; a click must leave it rather than nest a copy.
    home.target = "_top";
    home.rel = "noopener";
    function label() {
      var heading = host.querySelector("h3, .visual-head span");
      var name = (heading && heading.textContent || "").trim();
      home.href = canonicalHref + "?lang=" + lang() + "#" + slug;
      home.textContent = (name ? name + " — " : "") + t("view");
    }
    label();
    // The chart is isolated as soon as its element exists, which is before the page's
    // translator has replaced the Czech defaults — an English embed would otherwise carry a
    // Czech title. The event alone is not enough: on first load the language is set, never
    // changed, so nothing fires. Watch the heading instead.
    window.addEventListener("psdlanguagechange", label);
    if (window.MutationObserver) {
      new MutationObserver(label).observe(host, { subtree: true, childList: true, characterData: true });
    }
    bar.appendChild(home);

    if (sources.length) {
      var span = document.createElement("span");
      span.textContent = t("source") + ": ";
      sources.forEach(function (source, index) {
        if (index) span.appendChild(document.createTextNode(", "));
        var anchor = document.createElement("a");
        anchor.href = source.href;
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
        anchor.textContent = source.text;
        span.appendChild(anchor);
      });
      bar.appendChild(span);
    }
    document.body.appendChild(bar);
  }

  /**
   * Height is reported to the embedding page so an iframe can size itself. Without it every
   * host has to guess, and a guessed height either clips the chart or leaves a gap under it.
   */
  function reportHeight() {
    if (window.parent === window) return;
    var height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    window.parent.postMessage({ type: "psd-embed-size", slug: slug, height: height }, "*");
  }

  function activate() {
    var host = document.querySelector('[data-psd-chart="' + slug + '"]');
    if (!host) return false;
    isolate(host);
    credit(host);
    reportHeight();
    if (window.ResizeObserver) new ResizeObserver(reportHeight).observe(document.body);
    window.addEventListener("psdlanguagechange", reportHeight);
    return true;
  }

  function start() {
    if (activate()) return;
    // Charts on this site are registered after their data arrives, so the host element may not
    // exist yet at DOMContentLoaded. Watch for it rather than racing the fetch.
    var observer = new MutationObserver(function () {
      if (activate()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () {
      observer.disconnect();
      if (document.querySelector('[data-psd-chart="' + slug + '"]')) return;
      var note = document.createElement("p");
      note.className = "psd-embed-missing";
      note.textContent = t("missing") + ": " + slug;
      document.body.textContent = "";
      document.body.appendChild(note);
    }, 8000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
}());
