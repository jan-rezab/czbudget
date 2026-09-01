/**
 * Inline definitions — A5.
 *
 * A definition is only useful where the word is. This resolves `data-term` against the
 * glossary registry and attaches the definition to the word itself, so a reader meeting
 * "accrual" or "restos a pagar" for the first time can find out what it means without
 * leaving the figure they were looking at.
 *
 * Written once, surfaced everywhere: the registry is the only place a definition lives, so
 * a page cannot disagree with the methodology about what a word means.
 */
(function () {
  var CACHE = null;

  function lang() {
    var value = (window.PSDLanguage && window.PSDLanguage.current && window.PSDLanguage.current())
      || document.documentElement.lang || "cs";
    return value === "en" ? "en" : "cs";
  }

  function load() {
    if (CACHE) return CACHE;
    // Resolved relative to the document, so the same script works from a municipality page
    // three directories down as from the homepage.
    var base = document.body.getAttribute("data-glossary-root") || "";
    CACHE = fetch(base + "data/registry/glossary.v1.json")
      .then(function (response) { return response.ok ? response.json() : Promise.reject(response.status); })
      .then(function (payload) {
        var index = {};
        (payload.terms || []).forEach(function (entry) { index[entry.id] = entry; });
        return index;
      })
      .catch(function () { return {}; });
    return CACHE;
  }

  function decorate(index) {
    var nodes = document.querySelectorAll("[data-term]");
    if (!nodes.length) return;
    var code = lang();
    Array.prototype.forEach.call(nodes, function (node) {
      var entry = index[node.getAttribute("data-term")];
      if (!entry || !entry[code]) return;
      var side = entry[code];
      // title carries it for a mouse; aria-description for a screen reader. Both are the
      // same string, because a definition that differs by input device is two definitions.
      node.setAttribute("title", side.definition);
      node.setAttribute("aria-description", side.definition);
      node.classList.add("psd-term");
      if (!node.textContent.trim()) node.textContent = side.term;
    });
  }

  function start() {
    load().then(decorate);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  // The registry is bilingual, so a language change re-resolves rather than re-fetches.
  ["psdlanguagechange", "budgetlanguagechange"].forEach(function (name) {
    window.addEventListener(name, function () { load().then(decorate); });
  });
}());
