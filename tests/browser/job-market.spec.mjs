import {test, expect} from '@playwright/test';

const divisions='G45 G46 G47 H49 H50 H51 H52 H53 I55 I56 J58 J59 J60 J61 J62 J63 K64 K65 K66 L68 M69 M70 M71 M72 M73 M74 M75 N77 N78 N79 N80 N81 N82 O84 P85 Q86 Q87 Q88 R90 R91 R92 R93 S94 S95 S96'.split(' ');
const url='https://example.org/source-table';
const series={
  employment_shares:['USA','CZE'].flatMap(country_code=>['agriculture','industry','services'].map((sector,index)=>({country_code,sector,source_value:String([2,18,80][index]),source_url:url}))),
  service_divisions:['USA','CZE'].flatMap(country_code=>divisions.map(isic_division=>({country_code,isic_division,isic_section:isic_division[0],persons_thousands:10,source_url:url,obs_status:isic_division==='H51'?'U':''}))),
  ownership:['TOTAL','O','P','Q',...('G H I J K L M N R S'.split(' '))].flatMap(isic_section=>['public','total'].map(employer_sector=>({country_code:'USA',isic_section,employer_sector,source_value:employer_sector==='public'?'25':'100',source_url:url}))),
  labour_status:['USA','CZE'].flatMap(country_code=>[['employed','60'],['unemployed','4'],['labour_force','64'],['outside_labour_force','36'],['unemployment_rate','6.25']].map(([metric,source_value])=>({country_code,metric,source_value,source_url:url}))),
  national_public:[['public_sector_fte','100'],['total_economy_fte','400'],['general_government_fte','80'],['reported_public_sector_share','25.0']].map(([metric,source_value])=>({country_code:'CZE',metric,source_value,source_url:url})),
};
const payload={release_id:'synthetic',period:2024,series,releases:Object.fromEntries(Object.keys(series).map(key=>[key,'synthetic']))};

test('full service table and public ownership render from one pointed release',async({page})=>{
  await page.route('**/api/v1/job-market/2024',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)}));
  await page.goto('/deep-dives/job-market/?lang=en&country=USA');
  await expect(page.locator('#jm-divisions tr')).toHaveCount(45);
  await expect(page.locator('#jm-ownership')).toContainText('25.0 %');
  await expect(page.locator('#jm-labour')).toContainText('6.3 %');
  await expect(page.locator('#jm-divisions .jm-flag')).toHaveCount(1);
  await page.locator('[data-section="Q"]').click();
  await expect(page.locator('[data-section="Q"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#jm-country').selectOption('CZE');
  await expect(page.locator('#jm-ownership')).toContainText('25.0 %');
  await expect(page.locator('#jm-ownership')).toContainText('National public employment');
});
