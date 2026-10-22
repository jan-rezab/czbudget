import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';

const source = await fs.readFile(new URL('../../site-pages.js', import.meta.url), 'utf8');
// Exercise the actual browser label logic with synthetic releases, without loading
// unrelated municipal datasets or relying on a current production release ID.
const labelSource = source.slice(source.indexOf('    const artifactAudit='), source.indexOf('    root.innerHTML=', source.indexOf('    const artifactAudit=')));
const sc = {verifiedArtifactAudit: 'Verified published-data audit', verifiedRelease: 'Verified data release', historicalCheck: 'Historical local check', verificationUnavailable: 'Verification unavailable', verificationScope: 'Scope', verificationDate: 'Verified', artifactAuditNote: 'Only the files listed in QA JSON', auditedReleases: 'Audited dataset releases'};
const evaluate = (qualityData, releaseData = {}) => vm.runInNewContext(`(()=>{${labelSource};return {verified,checkLabel,auditNote,auditedReleaseNote};})()`, {qualityData, releaseData, sc, current: 'en', esc: String, integer: String, Intl, Date});
const qa = {status: 'passed', release_id: 'release-one', verified_at: '2026-10-22T15:30:52Z', build_mode: 'published-release-audit', verification_scope: {en: 'Pinned municipal and static artifacts; original source coverage remains partial.'}, published_releases: [{dataset: 'municipal', release_id: 'municipal-published-123'}]};

test('published QA names its limited audit scope and actual verification date', () => {
  const result = evaluate(qa, {release_id: qa.release_id});
  assert.equal(result.verified, true);
  assert.equal(result.checkLabel, 'Verified published-data audit: release-one');
  assert.match(result.auditNote, /original source coverage remains partial/);
  assert.match(result.auditNote, /22 Oct 2026/);
  assert.match(result.auditedReleaseNote, /municipal-published-123/);
});

test('a local artifact or mixed/invalid release pair cannot claim a verified release', () => {
  assert.equal(evaluate({...qa, build_mode: 'local'}).checkLabel, 'Historical local check');
  assert.equal(evaluate(qa, {release_id: 'older-release'}).verified, false);
  assert.equal(evaluate(qa).checkLabel, 'Verification unavailable');
  assert.equal(evaluate({...qa, verified_at: 'unknown'}, {release_id: qa.release_id}).verified, false);
});

test('every direct site-pages consumer includes the deterministic content hash', async () => {
  const sha = crypto.createHash('sha256').update(source).digest('hex');
  for (const file of ['about.html', 'methodology.html']) {
    const html = await fs.readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.ok(html.includes(`site-pages.js?v=${sha}`), file);
  }
});
