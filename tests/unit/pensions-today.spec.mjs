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
