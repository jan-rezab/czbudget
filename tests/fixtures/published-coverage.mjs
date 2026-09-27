export const tradeCoverage = {data:{countries:[
  {code:'CZE',latest_annual_period:'2025',latest_monthly_period:'202608',source_last_released:'2026-09-01'},
  {code:'DEU',latest_annual_period:'2024',latest_monthly_period:null},
]}};
export const jobMarket = {schema_version:'1.0.0',release_id:'fixture-published-job-release',period:2024,series:{
  employment_shares:['CZE','DEU','USA','FRA','GBR','POL'].flatMap(country_code => [
    {country_code,sector:'services',source_value:'59.1234',source_url:'https://api.worldbank.org/v2/country/CZE/indicator/SL.SRV.EMPL.ZS?date=2024&format=json'},
    {country_code,sector:'industry',source_value:'38.1234',source_url:'https://api.worldbank.org/v2/country/CZE/indicator/SL.IND.EMPL.ZS?date=2024&format=json'},
    {country_code,sector:'agriculture',source_value:'2.7532',source_url:'https://api.worldbank.org/v2/country/CZE/indicator/SL.AGR.EMPL.ZS?date=2024&format=json'},
  ]), service_divisions:[], ownership:[], labour_status:[], national_public:[],
}};
export async function mockPublishedCoverage(page) {
  for (const [url,body] of [['**/api/v1/trade/countries',tradeCoverage],['**/api/v1/job-market/2024',jobMarket]]) {
    await page.route(url,route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)}));
  }
}
