// Website consumer only: read published serving contracts; never ingest or publish data.
(() => {
  const liveModules = [
    { id: 'trade_annual', family: 'deep_dive', label_cs: 'Zahraniční obchod · ročně', label_en: 'Foreign trade · annual', order: 17 },
    { id: 'trade_monthly', family: 'deep_dive', label_cs: 'Zahraniční obchod · měsíčně', label_en: 'Foreign trade · monthly', order: 18 },
    { id: 'education', family: 'deep_dive', label_cs: 'Vzdělávání · kapacity', label_en: 'Education · capacity', order: 20 },
    { id: 'job_market', family: 'deep_dive', label_cs: 'Trh práce', label_en: 'Job market', order: 19 },
  ];
  const freshnessBand = year => !year ? 'undated' : year >= new Date().getUTCFullYear() - 1 ? 'current' : year === new Date().getUTCFullYear() - 2 ? 'statistical_lag' : 'older';
  const tradePeriod = (period, monthly) => {
    const value = String(period || '');
    return (monthly ? /^(19|20)\d{2}(0[1-9]|1[0-2])$/ : /^(19|20)\d{2}$/).test(value) ? value : null;
  };
  function merge(base, trade, jobs, reports, unavailable = [], education = null) {
    const records = base.records.filter(row => !liveModules.some(item => item.id === row.module));
    const countries = new Map(base.countries.map(country => [country.code, country]));
    const knownCountry = code => countries.has(code);
    for (const country of trade?.data?.countries || []) {
      if (!knownCountry(country.code)) continue;
      for (const [module, monthly, field] of [['trade_annual', false, 'latest_annual_period'], ['trade_monthly', true, 'latest_monthly_period']]) {
        const period = tradePeriod(country[field], monthly);
        if (!period) continue;
        const latestYear = Number(period.slice(0, 4));
        records.push({ country_code: country.code, module, latest_year: latestYear, first_year: null,
          period_label: monthly ? `${period.slice(0, 4)}–${period.slice(4)}` : period,
          vintage_type: 'actual', freshness_band: freshnessBand(latestYear), coverage_status: 'partial',
          coverage_cs: 'Vlastní hlášení země o zboží. Nejnovější období může být neúplné; roční a měsíční data jsou oddělená.',
          coverage_en: 'Country-reported goods. The latest period may be partial; annual and monthly data remain separate.',
          artifact: '/api/v1/trade/countries', artifact_generated_at: null, source_url: 'https://comtradeplus.un.org/',
          view_url: `/deep-dives/trade/?code=${country.code}&freq=${monthly ? 'M' : 'A'}`, source_last_released: country.source_last_released || null,
        });
      }
    }
    if (jobs?.release_id && Number(jobs.period) === 2024) {
      const jobCountries = [...new Set((jobs.series?.employment_shares || []).map(row => row.country_code))];
      for (const code of jobCountries.filter(knownCountry)) {
        const observations = Object.values(jobs.series).flat().filter(row => row.country_code === code);
        records.push({ country_code: code, module: 'job_market', latest_year: 2024, first_year: 2024, period_label: '2024',
          vintage_type: 'actual_estimate', freshness_band: 'estimate_lag', coverage_status: 'partial',
          coverage_cs: 'Modelované podíly odvětví a pozorované zaměstnání ve službách. Osoby, místa a FTE zůstávají odlišné; chybějící vlastnictví se nedoplňuje.',
          coverage_en: 'Modelled sector shares and observed service employment. People, jobs and FTE remain distinct; missing ownership cells are not filled.',
          row_count: observations.length, entity_count: null, artifact: '/api/v1/job-market/2024',
          artifact_generated_at: jobs.generated_at || null, release_id: jobs.release_id,
          source_url: observations.find(row => row.source_url)?.source_url || 'https://ilostat.ilo.org/data/',
          view_url: `/deep-dives/job-market/?country=${code}`,
        });
      }
    }
    for (const country of education?.countries || []) {
      if (!knownCountry(country.code) || !country.levels?.some(level => Number.isFinite(level.learners_headcount))) continue;
      const year = Number(country.period);
      if (!Number.isInteger(year)) continue;
      records.push({country_code: country.code, module: 'education', latest_year: year, first_year: year, period_label: String(year),
        vintage_type: 'actual', freshness_band: freshnessBand(year), coverage_status: 'partial',
        coverage_cs: 'Žáci a studenti, učitelské FTE a poměry podle stupně vzdělání. Registry institucí mohou mít jiné období; jednotky se nesčítají.',
        coverage_en: 'Learners, teaching FTE and ratios by education level. Institution registers may use another period; units are not combined.',
        entity_count: country.levels.length, artifact: '/data/education-capacity-international.v1.json', artifact_generated_at: education.generated_at || null,
        source_url: education.sources?.find(source => source.dataset === 'educ_uoe_enra01')?.requests?.[0] || null,
        view_url: `/deep-dives/education/?code=${country.code}`,
      });
    }
    const modules = [...base.modules.filter(item => !liveModules.some(live => live.id === item.id)), ...liveModules];
    return { ...base, modules, records, reports: reports?.reports || [], unavailable,
      totals: { ...base.totals, countries: new Set(records.map(row => row.country_code)).size, modules: modules.length, records: records.length },
    };
  }
  let promise;
  async function load() {
    if (!promise) promise = (async () => {
      const base = await PSDData.loadJson('/data/data-freshness.v1.json');
      const endpoints = ['/api/v1/trade/countries', '/api/v1/job-market/2024', '/deep-dives/reports.json', '/data/education-capacity-international.v1.json'];
      const validators = [value => Array.isArray(value?.data?.countries), value => Boolean(value?.release_id) && Number(value?.period) === 2024 && Array.isArray(value?.series?.employment_shares), value => Array.isArray(value?.reports), value => Array.isArray(value?.countries)];
      const results = await Promise.allSettled(endpoints.map((url, index) => PSDData.loadJson(url).then(value => {
        if (!validators[index](value)) throw new Error(`Invalid published contract: ${url}`);
        return value;
      })));
      const [trade, jobs, reports, education] = results.map(result => result.status === 'fulfilled' ? result.value : null);
      return merge(base, trade, jobs, reports, endpoints.filter((_, index) => results[index].status === 'rejected'), education);
    })().catch(error => { promise = null; throw error; });
    return promise;
  }
  window.PSDCoverage = { load, merge };
})();
