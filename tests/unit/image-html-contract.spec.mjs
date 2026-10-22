import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {htmlIds,sectionIds} from '../release/html-attributes.mjs';

const budget=readFileSync(new URL('../../cesky-rozpocet.html',import.meta.url),'utf8');
const analytics='<script defer src="https://analytics.example/script.js" data-website-id="b80e941b-3a25-40ef-bdf4-3ecb0e91e053"></script>';
const injected=budget.replace('</head>',`${analytics}</head>`);

test('full budget ID contract tolerates analytics data attributes and retains every real ID',()=>{
  assert.deepEqual(htmlIds(injected),htmlIds(budget));
  assert.deepEqual(sectionIds(injected),sectionIds(budget));
  assert.equal(sectionIds(injected).length,10);
  assert.equal((injected.match(/<section\b/g)||[]).length,12);
  assert.deepEqual(htmlIds('<div data-id="fake" aria-labelledby="label" id="real"></div>'),['real']);
});

test('deleting a real budget section ID still fails the complete image contract',()=>{
  const missing=injected.replace('id="demografie"','');
  assert.throws(()=>assert.deepEqual(htmlIds(missing),htmlIds(budget)),assert.AssertionError);
  assert.throws(()=>assert.deepEqual(sectionIds(missing),sectionIds(budget)),assert.AssertionError);
  assert.equal((missing.match(/<section\b/g)||[]).length,12);
});
