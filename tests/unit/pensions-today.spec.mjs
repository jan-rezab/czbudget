import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const data = JSON.parse(readFileSync(new URL('../../data/pensions-today.v1.json', import.meta.url)));
const countries = data.countries;
test('every source matches its archived evidence', () => {
  for (const s of Object.values(data.sources)) {
    const bytes=readFileSync(new URL(`../../pipeline/source_data/pensions/${s.file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),s.sha256);
    assert.match(s.url,/^https:\/\//);
  }
});
test('Czech bands reconcile across sex and include the median', () => {
  const p=countries.CZE.national;
  for(const kind of ['all','regular','early']) {
    for(const sex of ['total','male','female']) {
      const d=p.distribution[sex][kind];
      assert.equal(d.bands.reduce((n,b)=>n+b.count,0),d.count);
      const before=d.bands.filter(b=>b.upper!==null&&b.upper<d.median_band.lower).reduce((n,b)=>n+b.count,0);
      const at=d.bands.find(b=>b.lower===d.median_band.lower);
      assert.ok(before<d.count/2 && before+at.count>=d.count/2);
    }
    p.distribution.total[kind].bands.forEach((b,i)=>assert.equal(b.count,p.distribution.male[kind].bands[i].count+p.distribution.female[kind].bands[i].count));
  }
  assert.equal(p.distribution.total.all.count,1772834);
  assert.equal(p.distribution.total.all.mean,21094);
  assert.equal(p.payment_by_age,null);
  assert.equal(p.payment_by_retirement_year,null);
});
test('harmonised benchmarks retain coverage, age definitions and years', () => {
  const rows=Object.entries(countries).filter(([c,p])=>c!=='OECD'&&p.income);
  assert.equal(rows.length,37);
  for(const [,p] of rows) {
    assert.equal(p.income.year,p.poverty.year);
    assert.ok(p.income.year>=2017&&p.income.year<=2023);
    for(const key of ['age_66_75','age_76_plus']) {
      assert.ok(p.income[key]>0);
      assert.ok(p.poverty[key]>=0&&p.poverty[key]<=100);
    }
  }
  assert.equal(countries.COL.income,null);
  assert.ok(!countries.BRA.income&&!countries.UKR.income);
  assert.equal(countries.DEU.income.year,2021);
  assert.equal(countries.USA.income.year,2023);
  assert.equal(countries.OECD.income.year,null);
});
test('US age bands reconcile to recipient counts and weighted benefit means', () => {
  const groups=countries.USA.national.payment_by_age;
  for(const d of Object.values(groups)) {
    assert.equal(d.ages.reduce((n,a)=>n+a.count,0),d.count);
    assert.ok(Math.abs(d.ages.reduce((n,a)=>n+a.count*a.mean,0)/d.count-d.mean)<.011);
  }
  assert.equal(groups.total.count,groups.male.count+groups.female.count);
});
test('French birth cohorts use one snapshot and UK retains sex-specific scheme differences', () => {
  const p=countries.FRA.national;
  assert.equal(p.birth_year_date,'2020-12-31');
  for(const rows of Object.values(p.payment_by_birth_year)) {
    assert.deepEqual(rows.map(r=>r.birth_year),Array.from({length:24},(_,i)=>1930+i));
    assert.ok(rows.every(r=>r.mean>0&&r.full_career_mean>0));
  }
  for(const bands of Object.values(p.distribution_pct)) assert.ok(Math.abs(bands.reduce((n,b)=>n+b.share,0)-100)<1);
  const uk=countries.GBR.national.payment_by_scheme;
  assert.ok(uk.male.pre_2016>uk.male.new);
  assert.ok(uk.female.pre_2016<uk.female.new);
});

test('award cohorts reconcile by sex, amount and pension type for every year', () => {
  const cohorts=countries.CZE.national.awards_by_year;
  assert.equal(Object.keys(cohorts).length,18);
  for (const groups of Object.values(cohorts)) {
    for (const kind of ['all','regular','early']) {
      for (const sex of ['total','male','female']) {
        const d=groups[sex][kind];
        assert.equal(d.bands.reduce((n,b)=>n+b.count,0)+d.unknown_count,d.count);
        assert.ok(d.mean>0);
        for(let i=1;i<d.bands.length;i++) assert.equal(d.bands[i-1].upper+1,d.bands[i].lower);
      }
      assert.equal(groups.total[kind].count,groups.male[kind].count+groups.female[kind].count);
      groups.total[kind].bands.forEach((b,i)=>assert.equal(b.count,groups.male[kind].bands[i].count+groups.female[kind].bands[i].count));
    }
  }
  assert.equal(cohorts['2025'].total.all.count,55434);
  assert.equal(Math.round(cohorts['2025'].total.regular.mean),23688);
  // Composition changes the sign: all new awards are lower, regular awards higher.
  assert.ok(cohorts['2025'].total.all.mean<countries.CZE.national.distribution.total.all.mean);
  assert.ok(cohorts['2025'].total.regular.mean>countries.CZE.national.distribution.total.regular.mean);
});

import vm from 'node:vm';
test('Czech rendering and chart exports preserve selected populations in both languages', async () => {
  const source=readFileSync(new URL('../../pensions-today.js',import.meta.url),'utf8');
  for (const lang of ['cs','en']) for (const query of ['', '?pensionPopulation=new&pensionYear=2008', '?pensionPopulation=new&pensionYear=2025&pensionType=regular&pensionSex=female&pensionDetail=native', '?pensionPopulation=new&pensionYear=invalid']) {
    const root={innerHTML:''}, charts=[], errors=[];
    const ctx={URLSearchParams,URL,console:{error:(...e)=>errors.push(e)},location:{search:query,hash:'',href:'https://example.org/'+query},addEventListener(){},document:{documentElement:{lang},querySelector:()=>root,getElementById:()=>({addEventListener(){}})},window:{PSDChart:{register:c=>charts.push(c)}},fetch:async()=>({ok:true,json:async()=>data})};
    vm.runInNewContext(source,ctx);
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(errors,[]);
    assert.ok(root.innerHTML.includes('pension-award-history'));
    assert.ok(!/NaN|undefined/.test(root.innerHTML));
    const distribution=charts.find(c=>c.slug==='ageing-pension-payment-distribution');
    assert.ok(distribution);
    const rows=distribution.rows();
    assert.ok(Math.abs(rows.reduce((sum,r)=>sum+r.share,0)-100)<.2);
    assert.ok(rows.every(r=>r.population===(query ? 'new':'paid')));
    assert.equal(charts.find(c=>c.slug==='ageing-czech-pension-award-history').rows().length,18);
  }
});
