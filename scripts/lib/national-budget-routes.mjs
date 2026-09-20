export const NATIONAL_BUDGET_ROUTES = Object.freeze({
  CZE: "czechia",
  UKR: "ukraine",
  POL: "poland",
  DEU: "germany",
  GBR: "united-kingdom",
  FRA: "france",
  USA: "united-states",
  CHE: "switzerland",
  SWE: "sweden",
  DNK: "denmark",
  FIN: "finland",
  BRA: "brazil",
  ESP: "spain",
  JPN: "japan",
  NLD: "netherlands",
  NOR: "norway",
  GRC: "greece",
});

export const nationalBudgetPath = (countryCode) => {
  const slug = NATIONAL_BUDGET_ROUTES[String(countryCode || "").toUpperCase()];
  if (!slug) throw new Error(`No national-budget route for ${countryCode}`);
  return `/national-budgets/${slug}`;
};
