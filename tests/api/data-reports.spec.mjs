import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReportService, reportConfig, validateReport } from '../../server/data-reports.mjs';
const origin = 'https://publicspendingdata.org';
const body = { page: '/country.html?code=CZE&token=private#spending', title: 'Czechia', target: 'Expenditure 2024', reason: 'incorrect', explanation: 'The total differs from the official annual report.', source: 'https://example.org/report', email: 'reader@example.org', token: 'verified-token' };
const env = { DATA_REPORTS_ENABLED: 'true', REPORTS_PROJECT_ID: 'test-project', REPORTS_RECAPTCHA_SITE_KEY: 'site-key' };
test('reports are disabled by default and require all configuration', () => {
  assert.equal(reportConfig({}).enabled, false);
  assert.equal(reportConfig({ DATA_REPORTS_ENABLED: 'true' }).enabled, false);
  assert.equal(reportConfig(env).enabled, true);
});
test('validation strips unknown URL state and rejects invalid input', () => {
  assert.equal(validateReport(body, origin).page, '/country.html?code=CZE#spending');
  for (const patch of [{page:'//evil.org'}, {page:'https://evil.org'}, {reason:'bad'}, {explanation:'short'}, {source:'javascript:alert(1)'}, {source:'https://user:password@example.org'}, {email:'invalid'}, {target:'x'.repeat(501)}, {token:''}]) assert.throws(() => validateReport({...body, ...patch}, origin));
  assert.equal(validateReport({...body,email:''}, origin).email, '');
});
function mock(assessment, commitOK = true) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    if (url.includes('metadata.google')) return {ok:true,json:async()=>({access_token:'server-only'})};
    if (url.includes('recaptchaenterprise')) return {ok:true,json:async()=>assessment};
    return {ok:commitOK,json:async()=>({})};
  };
  return {calls, submit:createReportService({env,fetchImpl})};
}
const valid = {tokenProperties:{valid:true,action:'data_report',hostname:'publicspendingdata.org'},riskAnalysis:{score:0.9}};
test('verified reports and private contacts commit atomically without tokens', async () => {
  const {calls,submit} = mock(valid); const result = await submit(body,origin);
  assert.equal(result.status,'new'); assert.match(result.id,/^[a-f0-9-]{36}$/);
  const {writes} = JSON.parse(calls[2].options.body);
  assert.equal(writes.length,2); assert.equal(writes[0].update.fields.email,undefined);
  assert.equal(writes[0].update.fields.token,undefined);
  assert.equal(writes[1].update.fields.email.stringValue,body.email);
  assert.equal(writes[0].currentDocument.exists,false);
});
test('anonymous reports do not create contact records', async () => {
  const {calls,submit} = mock(valid); await submit({...body,email:''},origin);
  assert.equal(JSON.parse(calls[2].options.body).writes.length,1);
});
test('invalid, wrong-action, wrong-host and low-score tokens never write', async () => {
  for (const assessment of [{...valid,tokenProperties:{...valid.tokenProperties,valid:false}}, {...valid,tokenProperties:{...valid.tokenProperties,action:'login'}}, {...valid,tokenProperties:{...valid.tokenProperties,hostname:'evil.org'}}, {...valid,riskAnalysis:{score:0.1}}]) {
    const {calls,submit} = mock(assessment); await assert.rejects(submit(body,origin)); assert.equal(calls.length,2);
  }
});
test('honeypot fails before external requests; storage failures never confirm success', async () => {
  const {calls,submit} = mock(valid); await assert.rejects(submit({...body,website:'bot'},origin)); assert.equal(calls.length,0);
  await assert.rejects(mock(valid,false).submit(body,origin));
});
