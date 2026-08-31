/**
 * Embeds and oEmbed discovery — A2.
 *
 * Two things make a chart embeddable in practice. The first is a URL that renders the figure
 * and nothing else, which `/embed/<slug>` provides by loading the ordinary page in embed mode.
 * The second is oEmbed: pasting a link into WordPress, Ghost, Notion or a newsroom CMS should
 * produce the chart rather than a bare URL, and those systems all discover embeds the same way.
 *
 * The registry below is the list of charts that may be embedded. It is deliberately explicit
 * rather than "any slug on any page": an embed endpoint that accepts arbitrary input becomes a
 * way to frame arbitrary pages of this site under someone else's headline, and the slugs are
 * few enough to name.
 */

export const PROVIDER = {
  name: "Public Spending Data",
  url: "https://publicspendingdata.org",
};

/**
 * Embeddable charts, with the page each lives on. Adding a chart here is the deliberate act of
 * publishing it for reuse — the invariant check keeps this list honest against the slugs the
 * markup actually declares.
 */
export const EMBEDDABLE = {
  "home-government-expenditure-gdp": {
    page: "/index.html", height: 460,
    title: { en: "General government expenditure, % of GDP", cs: "Výdaje sektoru vládních institucí, % HDP" },
  },
  "home-gdp-per-capita": {
    page: "/index.html", height: 420,
    title: { en: "GDP per capita, EUR", cs: "HDP na obyvatele, EUR" },
  },
  "home-gross-debt-gdp": {
    page: "/index.html", height: 420,
    title: { en: "General government gross debt, % of GDP", cs: "Hrubý dluh sektoru vládních institucí, % HDP" },
  },
  "home-gdp-per-capita-ppp": {
    page: "/index.html", height: 420,
    title: { en: "GDP per capita at PPP, international $", cs: "HDP na obyvatele v PPP, mezinárodní $" },
  },
  "home-surplus-frequency": {
    page: "/index.html", height: 420,
    title: { en: "Share of years in surplus, 2005–24", cs: "Podíl let s přebytkem, 2005–24" },
  },
};

/** The chart's own name, in the language the consumer asked for. */
export const titleOf = (slug, lang = "cs") => EMBEDDABLE[slug]?.title?.[lang]
  || EMBEDDABLE[slug]?.title?.en
  || slug.replace(/-/g, " ");

/**
 * oEmbed discovery is per document, and a fragment never reaches the server — a consumer that
 * follows the `<link rel="alternate">` on a page sends only the page URL. Each page therefore
 * names the chart a bare link to it should resolve to, which is the one at the top of it.
 */
const PAGE_DEFAULT = {
  "/index.html": "home-government-expenditure-gdp",
  "/": "home-government-expenditure-gdp",
};

const DEFAULT_WIDTH = 640;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class EmbedError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** The URL that renders one chart on its own. */
export function embedURL(slug, origin = PROVIDER.url, lang) {
  const entry = EMBEDDABLE[slug];
  const query = new URLSearchParams({ embed: slug });
  if (lang) query.set("lang", lang);
  return `${origin}${entry.page}?${query}`;
}

/** The page a reader should land on, which is never the embed itself. */
export function canonicalURL(slug, origin = PROVIDER.url, lang) {
  const entry = EMBEDDABLE[slug];
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  return `${origin}${entry.page}${query}#${slug}`;
}

/**
 * The snippet a publisher pastes. It carries a real anchor as well as the frame: a reader with
 * scripts or frames blocked still sees where the figure came from, and the link is crawlable,
 * which is the part that makes embedding worth anything to this site.
 */
export function embedHTML(slug, { origin = PROVIDER.url, width = DEFAULT_WIDTH, height, lang, title } = {}) {
  const entry = EMBEDDABLE[slug];
  if (!entry) throw new EmbedError("chart_not_embeddable", `No embeddable chart named '${slug}'`, 404);
  const frameHeight = height || entry.height;
  const label = title || titleOf(slug, lang || "cs");
  return [
    `<iframe src="${embedURL(slug, origin, lang)}" width="${width}" height="${frameHeight}"`,
    ` style="border:0;max-width:100%" loading="lazy" scrolling="no"`,
    ` title="${escapeAttribute(label)} — ${PROVIDER.name}"></iframe>`,
    `<p><a href="${canonicalURL(slug, origin, lang)}">${escapeAttribute(label)}</a> — ${PROVIDER.name}</p>`,
  ].join("");
}

const escapeAttribute = (value) => String(value).replace(/[<>&"]/g, (character) => (
  { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[character]
));

/**
 * Resolve an oEmbed `url` parameter to a chart. Consumers send the URL a reader pasted, which
 * is the canonical page URL with the chart's anchor — the same thing the chart's own "cite"
 * button produces.
 */
export function slugFromURL(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new EmbedError("invalid_url", "The url parameter is not a URL");
  }
  const candidate = url.hash.replace(/^#/, "")
    || url.searchParams.get("embed")
    || PAGE_DEFAULT[url.pathname]
    || "";
  if (!SLUG_PATTERN.test(candidate)) throw new EmbedError("chart_not_identified", "That URL names no chart");
  if (!EMBEDDABLE[candidate]) throw new EmbedError("chart_not_embeddable", `No embeddable chart named '${candidate}'`, 404);
  return candidate;
}

/** An oEmbed 1.0 rich response. */
export function oembed(params, origin = PROVIDER.url) {
  const format = params.get("format") || "json";
  if (format !== "json") throw new EmbedError("unsupported_format", "Only the json format is served", 501);

  const slug = slugFromURL(params.get("url") || "");
  const entry = EMBEDDABLE[slug];
  const lang = params.get("lang") === "en" ? "en" : undefined;

  const width = clamp(Number(params.get("maxwidth")) || DEFAULT_WIDTH, 240, 1600);
  const height = clamp(Number(params.get("maxheight")) || entry.height, 200, 1200);
  const title = titleOf(slug, lang || "cs");

  return {
    version: "1.0",
    type: "rich",
    provider_name: PROVIDER.name,
    provider_url: PROVIDER.url,
    title,
    width,
    height,
    html: embedHTML(slug, { origin, width, height, lang, title }),
    // The figure changes when its source publishes, not by the hour; a day is honest and
    // spares consumers from re-requesting an unchanged embed.
    cache_age: 86400,
  };
}
