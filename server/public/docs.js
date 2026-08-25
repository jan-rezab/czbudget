const endpointList = document.querySelector("#endpoint-list");
const sideNav = document.querySelector("#side-nav");
const search = document.querySelector("#search");
let endpoints = [];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parameterTable(parameters) {
  if (!parameters.length) return "";
  return `<table class="params"><thead><tr><th>Name</th><th>Location</th><th>Required</th><th>Description</th></tr></thead><tbody>${parameters.map((parameter) => `<tr><td><code>${escapeHTML(parameter.name)}</code></td><td>${escapeHTML(parameter.in)}</td><td>${parameter.required ? "yes" : "no"}</td><td>${escapeHTML(parameter.description || "")}</td></tr>`).join("")}</tbody></table>`;
}

function render(filter = "") {
  const needle = filter.trim().toLowerCase();
  const visible = endpoints.filter((endpoint) => `${endpoint.path} ${endpoint.summary} ${endpoint.description} ${endpoint.tags.join(" ")}`.toLowerCase().includes(needle));
  document.querySelector("#endpoint-count").textContent = `${visible.length} of ${endpoints.length}`;
  endpointList.innerHTML = visible.map((endpoint) => {
    const id = `endpoint-${slug(`${endpoint.method}-${endpoint.path}`)}`;
    const params = endpoint.parameters || [];
    return `<details class="endpoint" id="${id}"><summary><span class="method">${escapeHTML(endpoint.method.toUpperCase())}</span><span class="route">${escapeHTML(endpoint.path)}</span><span class="summary">${escapeHTML(endpoint.summary)}</span></summary><div class="endpoint-body"><p>${escapeHTML(endpoint.description || "")}</p>${parameterTable(params)}<div class="try"><span class="kicker">Try this request</span><div class="try-row"><input aria-label="Request URL" value="${escapeHTML(endpoint.path)}"><button type="button">Send</button></div><pre class="response hidden"><code></code></pre></div></div></details>`;
  }).join("") || "<p>No endpoints match that filter.</p>";
  endpointList.querySelectorAll(".try button").forEach((button) => button.addEventListener("click", tryRequest));
}

async function authenticatedFetch(url, options = {}) {
  let response = await fetch(url, { credentials: "include", ...options });
  if (response.status === 401) {
    const refreshed = await fetch("/auth/refresh", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: "{}" });
    if (refreshed.ok) response = await fetch(url, { credentials: "include", ...options });
  }
  return response;
}

async function tryRequest(event) {
  const container = event.currentTarget.closest(".try");
  const url = container.querySelector("input").value;
  const output = container.querySelector(".response");
  const code = output.querySelector("code");
  output.classList.remove("hidden");
  code.textContent = "Loading…";
  try {
    const response = await authenticatedFetch(url);
    const text = await response.text();
    let formatted = text;
    try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch {}
    code.textContent = `HTTP ${response.status}\n${formatted}`;
  } catch (error) {
    code.textContent = error.message;
  }
}

async function start() {
  const [specResponse, accountResponse] = await Promise.all([authenticatedFetch("/docs/openapi.json"), authenticatedFetch("/auth/me")]);
  if (!specResponse.ok) throw new Error("Could not load the API specification.");
  const spec = await specResponse.json();
  endpoints = Object.entries(spec.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => ({ path, method, ...operation }))).filter((endpoint) => endpoint.path.startsWith("/api/"));
  const groups = new Map();
  for (const endpoint of endpoints) {
    const tag = endpoint.tags?.[0] || "Other";
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag).push(endpoint);
  }
  sideNav.innerHTML = [...groups].map(([tag, items]) => `<strong>${escapeHTML(tag)}</strong>${items.map((endpoint) => `<a href="#endpoint-${slug(`${endpoint.method}-${endpoint.path}`)}">${escapeHTML(endpoint.path.replace("/api/v1", "") || "/")}</a>`).join("")}`).join("");
  if (accountResponse.ok) {
    const account = await accountResponse.json();
    document.querySelector("#account").textContent = `Verified · ${account.data.email}`;
  }
  render();
}

search.addEventListener("input", () => render(search.value));
document.querySelector("#logout").addEventListener("click", async () => {
  await fetch("/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: "{}" });
  location.assign("/developers/login");
});
document.querySelector(".copy").addEventListener("click", async (event) => {
  await navigator.clipboard.writeText(event.currentTarget.nextElementSibling.textContent);
  event.currentTarget.textContent = "Copied";
});

start().catch((error) => { endpointList.innerHTML = `<p>${escapeHTML(error.message)}</p>`; });

