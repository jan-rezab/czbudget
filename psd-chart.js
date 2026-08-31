/**
 * PSD chart object — A1 of the consolidated plan.
 *
 * Turns a rendered picture into an addressable object. One wrapper carries the whole
 * affordance rail (slug, URL state, table, download, cite, source drawer) so no page
 * reimplements it and no chart is left out.
 *
 * The rail is built against an abstract data accessor: a caller supplies `columns` and a
 * `rows()` function, never an artifact shape. When the fact store lands, what sits behind
 * `rows()` is swapped without touching anything here.
 *
 * Contract in CHART_SYSTEM.md. Slugs are permanent: renaming one breaks somebody else's
 * article and needs a redirect, not an edit.
 */
(function () {
  "use strict";

  var SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var registry = new Map();

  var COPY = {
    cs: {
      table: "Tabulka", chart: "Graf", download: "Stáhnout", csv: "Data (CSV)",
      png: "Obrázek (PNG)", cite: "Citovat", link: "Odkaz", copied: "Zkopírováno",
      embed: "Vložit", embed_failed: "Nelze načíst",
      sources: "Zdroje", definition: "Definice", excludes: "Neobsahuje",
      caveat: "Srovnatelnost", table_id: "Zdrojová tabulka", extracted: "Staženo",
      next: "Další vydání", vintage: "Typ údaje", edition: "Vydání zdroje", rows: "Stáhnout řádky",
      seriesLevel: "Původ je zatím uveden na úrovni řady, nikoli jednotlivého řádku.",
      close: "Zavřít", citation: "Citace",
      vintages: { plan: "plán", outturn: "skutečnost", projection: "projekce", register: "živý registr" },
    },
    en: {
      table: "Table", chart: "Chart", download: "Download", csv: "Data (CSV)",
      png: "Image (PNG)", cite: "Cite", link: "Link", copied: "Copied",
      embed: "Embed", embed_failed: "Unavailable",
      sources: "Sources", definition: "Definition", excludes: "Excludes",
      caveat: "Comparability", table_id: "Source table", extracted: "Extracted",
      next: "Next release", vintage: "Vintage", edition: "Source edition", rows: "Download these rows",
      seriesLevel: "Provenance is recorded at series level, not yet per row.",
      close: "Close", citation: "Citation",
      vintages: { plan: "plan", outturn: "outturn", projection: "projection", register: "live register" },
    },
  };

  function lang() {
    var value = (window.PSDLanguage && window.PSDLanguage.current && window.PSDLanguage.current()) ||
      document.documentElement.lang;
    return value === "en" ? "en" : "cs";
  }

  function t(key) {
    var pack = COPY[lang()] || COPY.cs;
    return pack[key] != null ? pack[key] : key;
  }

  function resolve(value) {
    return typeof value === "function" ? value() : value;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "class") node.className = attrs[key];
      else if (key === "text") node.textContent = attrs[key];
      else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2), attrs[key]);
      else if (attrs[key] != null) node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  /* ---------- URL state ----------
   * Namespaced by slug so several charts can share one page without colliding:
   *   #home-gdp.countries=CZE,POL&home-gdp.years=2005-2024
   */

  function readHash() {
    var raw = location.hash.replace(/^#/, "");
    var out = {};
    if (!raw) return out;
    raw.split("&").forEach(function (pair) {
      if (!pair) return;
      var index = pair.indexOf("=");
      if (index < 0) return;
      out[decodeURIComponent(pair.slice(0, index))] = decodeURIComponent(pair.slice(index + 1));
    });
    return out;
  }

  function writeHash(map) {
    var parts = Object.keys(map).sort().filter(function (key) {
      return map[key] !== "" && map[key] != null;
    }).map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(map[key]);
    });
    var next = parts.length ? "#" + parts.join("&") : location.pathname + location.search;
    history.replaceState(null, "", next);
  }

  function stateFromURL(slug, keys) {
    var hash = readHash();
    var params = new URLSearchParams(location.search);
    var out = {};
    keys.forEach(function (key) {
      var namespaced = slug + "." + key;
      if (hash[namespaced] != null) out[key] = hash[namespaced];
      // A bare query param is honoured too, so an embed URL can carry plain keys.
      else if (params.get(key) != null) out[key] = params.get(key);
    });
    return out;
  }

  function stateToURL(slug, keys, values) {
    var hash = readHash();
    keys.forEach(function (key) {
      var namespaced = slug + "." + key;
      if (values[key] == null || values[key] === "") delete hash[namespaced];
      else hash[namespaced] = String(values[key]);
    });
    writeHash(hash);
  }

  /* ---------- exports ---------- */

  function csvCell(value) {
    var text = value == null ? "" : String(value);
    return /[",\n;]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function toCSV(columns, rows) {
    var head = columns.map(function (column) { return csvCell(column.label); }).join(",");
    var body = rows.map(function (row) {
      return columns.map(function (column) { return csvCell(row[column.key]); }).join(",");
    });
    return "﻿" + [head].concat(body).join("\r\n") + "\r\n";
  }

  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = el("a", { href: url, download: filename });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // Styles do not travel with a serialised SVG, so the properties the chart grammar
  // actually uses are copied onto the clone before rasterising.
  var CARRIED = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity",
    "font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline"];

  function inlineStyles(live, clone) {
    var source = live.querySelectorAll("*");
    var target = clone.querySelectorAll("*");
    for (var i = 0; i < source.length && i < target.length; i += 1) {
      var computed = window.getComputedStyle(source[i]);
      var declaration = CARRIED.map(function (property) {
        var value = computed.getPropertyValue(property);
        return value ? property + ":" + value : "";
      }).filter(Boolean).join(";");
      if (declaration) target[i].setAttribute("style", declaration);
    }
  }

  function exportPNG(container, filename, scale) {
    var svg = container.querySelector("svg");
    if (!svg) return Promise.reject(new Error("no_svg"));
    var box = svg.getBoundingClientRect();
    var width = Math.max(1, Math.round(box.width));
    var height = Math.max(1, Math.round(box.height));
    var clone = svg.cloneNode(true);
    inlineStyles(svg, clone);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);

    var xml = new XMLSerializer().serializeToString(clone);
    var svgURL = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    var ratio = scale || 2;

    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        var canvas = el("canvas");
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        var context = canvas.getContext("2d");
        context.fillStyle = getComputedStyle(document.body).backgroundColor || "#faf7ef";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.drawImage(image, 0, 0);
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error("encode_failed"));
          saveBlob(blob, filename);
          resolve();
        }, "image/png");
      };
      image.onerror = function () { reject(new Error("render_failed")); };
      image.src = svgURL;
    });
  }

  /* ---------- citation ---------- */

  function permalink(slug) {
    // The hash carries chart state where a chart has any, and names the chart where it has
    // none. Either way a citation must land on the figure, not merely on the page holding it.
    var base = location.origin + location.pathname + location.search;
    return base + (location.hash || "#" + slug);
  }

  function citation(spec) {
    var source = spec.source || {};
    var parts = ["Public Spending Data", resolve(spec.title)];
    if (source.vintage) {
      var label = (COPY[lang()].vintages || {})[source.vintage] || source.vintage;
      parts.push(label);
    }
    if (source.edition) parts.push(source.edition);
    if (source.name) parts.push(source.name);
    if (source.table) parts.push(source.table);
    if (source.extracted) parts.push(t("extracted") + " " + source.extracted);
    parts.push(permalink(spec.slug));
    return parts.filter(Boolean).join(". ") + ".";
  }

  /* ---------- rail ---------- */

  function buildTable(columns, rows) {
    var head = el("tr", {}, columns.map(function (column) {
      return el("th", { scope: "col", text: column.label });
    }));
    var body = rows.map(function (row) {
      return el("tr", {}, columns.map(function (column) {
        var value = row[column.key];
        return el("td", { text: value == null ? "" : String(value), class: column.numeric ? "num" : null });
      }));
    });
    return el("div", { class: "psd-chart-tablewrap" }, [
      el("table", { class: "psd-chart-table" }, [
        el("thead", {}, [head]),
        el("tbody", {}, body),
      ]),
    ]);
  }

  function buildDrawer(spec) {
    var source = spec.source || {};
    var lines = [
      [t("definition"), source.definition],
      [t("excludes"), source.excludes],
      [t("caveat"), source.caveat],
      [t("table_id"), source.table],
      [t("edition"), source.edition],
      [t("extracted"), source.extracted],
      [t("next"), source.next_release],
      [t("vintage"), (COPY[lang()].vintages || {})[source.vintage] || source.vintage],
    ].filter(function (pair) { return pair[1]; });

    return el("div", { class: "psd-chart-drawer", hidden: "" }, [
      el("dl", {}, lines.reduce(function (nodes, pair) {
        nodes.push(el("dt", { text: pair[0] }));
        nodes.push(el("dd", { text: String(pair[1]) }));
        return nodes;
      }, [])),
      source.url ? el("p", {}, [
        el("a", { href: source.url, target: "_blank", rel: "noreferrer", text: source.name || source.url }),
      ]) : null,
      el("p", { class: "psd-chart-note", text: t("seriesLevel") }),
    ]);
  }

  function register(spec) {
    if (!spec || !spec.slug) throw new Error("PSDChart: a slug is required");
    if (!SLUG_PATTERN.test(spec.slug)) {
      throw new Error("PSDChart: slug '" + spec.slug + "' must be lowercase words joined by hyphens");
    }
    if (!spec.el) throw new Error("PSDChart: slug '" + spec.slug + "' has no element");
    if (registry.has(spec.slug)) {
      // A page that re-renders replaces its chart element, which takes the old rail with it.
      // Re-registering onto the fresh element is expected; two live elements sharing a slug
      // is a genuine collision that would steal each other's citations.
      var previous = registry.get(spec.slug);
      if (previous.spec.el !== spec.el && previous.spec.el.isConnected) {
        throw new Error("PSDChart: slug '" + spec.slug + "' is already registered on this page");
      }
      registry.delete(spec.slug);
    }

    var columns = spec.columns || [];
    var host = spec.el;
    host.setAttribute("data-chart-slug", spec.slug);

    var rail = el("div", { class: "psd-chart-rail", role: "group" });
    var panel = el("div", { class: "psd-chart-panel", hidden: "" });
    var drawer = buildDrawer(spec);
    var showingTable = false;

    function rows() {
      try { return resolve(spec.rows) || []; } catch (error) { return []; }
    }

    function filename(extension) {
      return spec.slug + "." + extension;
    }

    function toggleTable() {
      showingTable = !showingTable;
      panel.hidden = !showingTable;
      if (showingTable) {
        panel.textContent = "";
        panel.appendChild(buildTable(columns, rows()));
      }
      tableButton.textContent = showingTable ? t("chart") : t("table");
      tableButton.setAttribute("aria-pressed", String(showingTable));
    }

    var tableButton = el("button", {
      type: "button", class: "psd-chart-action", "aria-pressed": "false", "data-action": "table",
      text: t("table"), onclick: toggleTable,
    });

    var csvButton = el("button", {
      type: "button", class: "psd-chart-action", "data-action": "csv", text: t("csv"),
      onclick: function () {
        saveBlob(new Blob([toCSV(columns, rows())], { type: "text/csv;charset=utf-8" }), filename("csv"));
      },
    });

    // PNG is opt-in: only a chart that actually draws an SVG can be rasterised, and an
    // export button that quietly does nothing is worse than no button.
    var offersPNG = (spec.exports || ["csv"]).indexOf("png") !== -1;
    var pngButton = offersPNG ? el("button", {
      type: "button", class: "psd-chart-action", "data-action": "png", text: t("png"),
      onclick: function () {
        pngButton.disabled = true;
        exportPNG(host, filename("png"), 2).catch(function () {}).then(function () {
          pngButton.disabled = false;
        });
      },
    }) : null;

    var citeButton = el("button", {
      type: "button", class: "psd-chart-action", "data-action": "cite", text: t("cite"),
      onclick: function () {
        var text = citation(spec);
        if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
        citeButton.textContent = t("copied");
        setTimeout(function () { citeButton.textContent = t("cite"); }, 1600);
      },
    });

    /**
     * The embed snippet comes from the oEmbed endpoint rather than being assembled here.
     * Building the same iframe in two places guarantees they diverge, and the copy a
     * publisher pastes should be byte-identical to the one a CMS resolves for itself.
     */
    var embedButton = spec.embeddable === false ? null : el("button", {
      type: "button", class: "psd-chart-action", "data-action": "embed", text: t("embed"),
      onclick: function () {
        var query = "url=" + encodeURIComponent(permalink(spec.slug)) + "&lang=" + lang();
        embedButton.disabled = true;
        fetch("/api/v1/oembed?" + query)
          .then(function (response) { return response.ok ? response.json() : Promise.reject(response.status); })
          .then(function (payload) {
            var html = (payload && payload.data ? payload.data.html : payload && payload.html);
            if (!html) return Promise.reject("no_html");
            if (navigator.clipboard) return navigator.clipboard.writeText(html);
            return null;
          })
          .then(function () {
            embedButton.textContent = t("copied");
          })
          .catch(function () {
            embedButton.textContent = t("embed_failed");
          })
          .then(function () {
            embedButton.disabled = false;
            setTimeout(function () { embedButton.textContent = t("embed"); }, 1600);
          });
      },
    });

    var sourceButton = el("button", {
      type: "button", class: "psd-chart-action psd-chart-source-toggle", "data-action": "sources", text: t("sources"),
      "aria-expanded": "false",
      onclick: function () {
        drawer.hidden = !drawer.hidden;
        sourceButton.setAttribute("aria-expanded", String(!drawer.hidden));
      },
    });

    [tableButton, csvButton, pngButton, citeButton, embedButton, sourceButton].forEach(function (button) {
      if (button) rail.appendChild(button);
    });

    host.appendChild(rail);
    host.appendChild(panel);
    host.appendChild(drawer);

    // URL state
    var stateKeys = (spec.state && spec.state.keys) || [];
    var controller = {
      slug: spec.slug,
      spec: spec,
      readState: function () { return stateFromURL(spec.slug, stateKeys); },
      writeState: function (values) { stateToURL(spec.slug, stateKeys, values); },
      refresh: function () {
        if (showingTable) {
          panel.textContent = "";
          panel.appendChild(buildTable(columns, rows()));
        }
      },
      citation: function () { return citation(spec); },
      csv: function () { return toCSV(columns, rows()); },
    };

    if (spec.state && typeof spec.state.apply === "function") {
      var initial = controller.readState();
      if (Object.keys(initial).length) spec.state.apply(initial);
    }

    registry.set(spec.slug, controller);
    return controller;
  }

  function relabel() {
    registry.forEach(function (controller) {
      controller.spec.el.querySelectorAll(".psd-chart-action[data-action]").forEach(function (button) {
        var action = button.getAttribute("data-action");
        if (action === "table") {
          button.textContent = button.getAttribute("aria-pressed") === "true" ? t("chart") : t("table");
        } else {
          button.textContent = t(action);
        }
      });
      controller.refresh();
    });
  }

  window.addEventListener("psdlanguagechange", relabel);

  window.PSDChart = {
    register: register,
    get: function (slug) { return registry.get(slug); },
    slugs: function () { return Array.from(registry.keys()); },
    all: function () { return Array.from(registry.values()); },
    toCSV: toCSV,
  };
}());
