const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message", "request_id"],
      properties: { code: { type: "string" }, message: { type: "string" }, request_id: { type: "string" } },
    },
  },
};

const jsonResponse = (description = "Successful response") => ({
  description,
  content: { "application/json": { schema: { type: "object", additionalProperties: true } } },
});

const errors = {
  "401": { description: "Missing, invalid, or expired identity token", content: { "application/json": { schema: errorSchema } } },
  "403": { description: "The account email has not been verified", content: { "application/json": { schema: errorSchema } } },
  "404": { description: "Resource not found", content: { "application/json": { schema: errorSchema } } },
  "429": { description: "Rate limit exceeded", content: { "application/json": { schema: errorSchema } } },
};

const operation = (summary, description, tags, parameters = []) => ({
  summary,
  description,
  tags,
  security: [{ bearerAuth: [] }, { sessionCookie: [] }],
  parameters,
  responses: { "200": jsonResponse(), ...errors },
});

const country = { name: "country", in: "path", required: true, description: "ISO 3166-1 alpha-3 country code.", schema: { type: "string", pattern: "^[A-Z]{3}$", example: "CZE" } };
const pagination = [
  { name: "limit", in: "query", description: "Page size, from 1 to 200.", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
  { name: "cursor", in: "query", description: "Opaque cursor returned by the previous page.", schema: { type: "string" } },
];

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Public Spending Data API",
    version: "1.0.0",
    description: "Authenticated, source-traceable access to the datasets published by publicspendingdata.org. Amounts retain their stated currency, accounting perimeter, period, and budget stage. Missing values are never implied to be zero.",
    contact: { name: "Public Spending Data", url: "https://publicspendingdata.org/about.html" },
  },
  servers: [{ url: "https://publicspendingdata.org", description: "Production" }],
  tags: [
    { name: "Discovery", description: "API, release, and dataset discovery." },
    { name: "Countries", description: "National fiscal and thematic modules." },
    { name: "Cities", description: "Capital-city and municipality data." },
    { name: "Public entities", description: "Public-body directories and source-scoped aggregates." },
    { name: "Authentication", description: "Account, verification, and token lifecycle." },
    { name: "Embeds", description: "oEmbed discovery for charts published for reuse." },
  ],
  paths: {
    // oEmbed is the one route consumers reach unauthenticated and cross-origin by design: a
    // CMS resolving a pasted link has no credentials and never will.
    "/api/v1/oembed": {
      get: {
        summary: "Resolve a chart URL to an embed",
        description: "oEmbed 1.0 discovery. Given the URL of a published chart — the page URL with the chart's anchor, which is what the chart's own cite button produces — returns a rich embed with the iframe snippet, its dimensions, and attribution. A page URL with no anchor resolves to the chart at the top of that page, because a fragment never reaches the server.",
        tags: ["Embeds"],
        security: [],
        parameters: [
          { name: "url", in: "query", required: true, description: "URL of the chart to embed.", schema: { type: "string", format: "uri", example: "https://publicspendingdata.org/index.html#home-gross-debt-gdp" } },
          { name: "format", in: "query", description: "Only json is served.", schema: { type: "string", enum: ["json"], default: "json" } },
          { name: "maxwidth", in: "query", description: "Maximum frame width in pixels, from 240 to 1600.", schema: { type: "integer", minimum: 240, maximum: 1600, default: 640 } },
          { name: "maxheight", in: "query", description: "Maximum frame height in pixels, from 200 to 1200.", schema: { type: "integer", minimum: 200, maximum: 1200 } },
          { name: "lang", in: "query", description: "Language of the embedded chart and its title.", schema: { type: "string", enum: ["cs", "en"], default: "cs" } },
        ],
        responses: { "200": jsonResponse(), ...errors },
      },
    },
    "/api/v1": { get: operation("API index", "Returns API version, release, and documentation links.", ["Discovery"]) },
    "/api/v1/datasets": { get: operation("List datasets", "Lists every dataset represented in API v1 with its schema version and generation time.", ["Discovery"]) },
    "/api/v1/datasets/{dataset}": { get: operation("Get dataset metadata", "Returns provenance and methodology metadata without returning the full bulk artifact.", ["Discovery"], [{ name: "dataset", in: "path", required: true, schema: { type: "string" } }]) },
    "/api/v1/countries": { get: operation("List countries", "Lists all published country profiles and module coverage.", ["Countries"]) },
    "/api/v1/countries/{country}": { get: operation("Get country profile", "Returns profile metadata, module coverage, and official sources.", ["Countries"], [country]) },
    "/api/v1/countries/{country}/fiscal": { get: operation("Get sovereign fiscal series", "General-government IMF fiscal time series and summary statistics.", ["Countries"], [country]) },
    "/api/v1/countries/{country}/spending": { get: operation("Get administrative spending", "Native national spending classifications for the latest comparable periods.", ["Countries"], [country]) },
    "/api/v1/countries/{country}/spending/comparison": { get: operation("Get comparable spending", "Harmonised cross-country spending comparison layer.", ["Countries"], [country]) },
    "/api/v1/countries/{country}/spending/functions": { get: operation("Get functional spending", "Functional budget classifications for a country.", ["Countries"], [country]) },
    "/api/v1/countries/{country}/revenue": { get: operation("Get revenue profile", "Tax mix, government levels, environmental taxes, and municipal transfers.", ["Countries"], [country]) },
    "/api/v1/countries/{country}/health": { get: operation("Get health financing", "SHA health financing, provider shares, and capacity context.", ["Countries"], [country]) },
    "/api/v1/countries/{country}/health/performance": { get: operation("Get health performance", "Health workforce, utilisation, capacity, and outcomes.", ["Countries"], [country]) },
    "/api/v1/countries/{country}/demography": { get: operation("Get demographic projection", "Official principal population projection and common age bands.", ["Countries"], [country]) },
    "/api/v1/countries/{country}/transport": { get: operation("Get transport performance", "Transport investment, maintenance, networks, use, condition, and projects where available.", ["Countries"], [country]) },
    "/api/v1/capital-cities": { get: operation("List capital cities", "Paginated municipal budgets for all EU capitals plus London.", ["Cities"], [...pagination, { name: "country", in: "query", schema: { type: "string" } }]) },
    "/api/v1/capital-cities/{city_id}": { get: operation("Get capital-city budget", "Returns the complete source-scoped capital-city budget record.", ["Cities"], [{ name: "city_id", in: "path", required: true, schema: { type: "string", example: "prague-cz" } }]) },
    "/api/v1/municipalities": { get: operation("Search municipalities", "Searches the unified international municipality directory.", ["Cities"], [...pagination, { name: "country", in: "query", schema: { type: "string" } }, { name: "q", in: "query", schema: { type: "string" } }]) },
    "/api/v1/municipalities/{country}/{municipality_id}": { get: operation("Get municipality", "Returns a municipality from the international comparison tier.", ["Cities"], [country, { name: "municipality_id", in: "path", required: true, schema: { type: "string" } }]) },
    "/api/v1/municipalities/CZE/{municipality_id}/budget": { get: operation("Get Czech municipal budget", "Returns the full current budget, balance-sheet, population, sources, and classifications for one Czech municipality.", ["Cities"], [{ name: "municipality_id", in: "path", required: true, schema: { type: "string", pattern: "^\\d{8}$", example: "00064581" } }]) },
    "/api/v1/municipalities/CZE/{municipality_id}/history": { get: operation("Get Czech municipal history", "Returns annual budget and balance-sheet history from 2010 through 2025 where reported.", ["Cities"], [{ name: "municipality_id", in: "path", required: true, schema: { type: "string", pattern: "^\\d{8}$", example: "00064581" } }]) },
    "/api/v1/public-entities": { get: operation("Search public entities", "Searches a country directory. The country query parameter is required.", ["Public entities"], [...pagination, { ...country, in: "query", required: true }, { name: "q", in: "query", schema: { type: "string" } }, { name: "entity_class", in: "query", schema: { type: "string" } }]) },
    "/api/v1/public-entities/{country}/{record_id}": { get: operation("Get public entity", "Returns a decoded public-entity directory record.", ["Public entities"], [country, { name: "record_id", in: "path", required: true, schema: { type: "string" } }]) },
    "/api/v1/public-entities/aggregates": { get: operation("List public-entity aggregates", "Returns source-scoped aggregate observations. Perimeters are non-additive.", ["Public entities"], [...pagination, { name: "country", in: "query", schema: { type: "string" } }, { name: "metric", in: "query", schema: { type: "string" } }]) },
    "/auth/register": {
      post: {
        summary: "Register",
        description: "Creates an account and sends a verification email.",
        tags: ["Authentication"],
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", format: "password", minLength: 6 },
                },
              },
            },
          },
        },
        responses: { "201": jsonResponse("Account created"), "400": errors["401"] },
      },
    },
    "/auth/login": {
      post: {
        summary: "Log in",
        description: "Returns an Identity Platform ID token and refresh token and establishes the docs session. Email verification is required.",
        tags: ["Authentication"],
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: { "200": jsonResponse(), "401": errors["401"], "403": errors["403"] },
      },
    },
    "/auth/refresh": { post: { summary: "Refresh access", description: "Exchanges a refresh token (body or secure cookie) for a new ID token.", tags: ["Authentication"], security: [], responses: { "200": jsonResponse(), "401": errors["401"] } } },
    "/auth/verification/resend": {
      post: {
        summary: "Resend verification email",
        description: "Authenticates the pending account and sends another verification email.",
        tags: ["Authentication"],
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } } } },
        },
        responses: { "200": jsonResponse(), "401": errors["401"] },
      },
    },
    "/auth/password/reset": {
      post: {
        summary: "Request password reset",
        description: "Sends a reset email when the account exists. The response does not reveal account existence.",
        tags: ["Authentication"],
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } } },
        },
        responses: { "200": jsonResponse() },
      },
    },
    "/auth/logout": { post: { summary: "Log out", tags: ["Authentication"], security: [{ sessionCookie: [] }], responses: { "200": jsonResponse() } } },
    "/auth/me": { get: operation("Current account", "Returns the authenticated and verified account.", ["Authentication"]) },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "Firebase ID token", description: "ID token returned by POST /auth/login. Refresh before its one-hour expiry." },
      sessionCookie: { type: "apiKey", in: "cookie", name: "psd_session", description: "Secure docs-session cookie established by POST /auth/login." },
    },
    schemas: { Error: errorSchema },
  },
};
